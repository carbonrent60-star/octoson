import "server-only";

import { getSupabaseServerClient } from "./supabase-server";
import { ensureEarningMissions } from "./earning-system.js";

export const OCTOSON_SEASON_KEY = "s1_dark_city";

export type EarningMission = {
  id: string;
  periodType: "daily" | "weekly";
  periodKey: string;
  missionKey: string;
  title: string;
  description: string;
  metric: string;
  target: number;
  progress: number;
  auraReward: number;
  xpReward: number;
  seasonXpReward: number;
  completedAt: number | null;
  claimedAt: number | null;
  primeOnly: boolean;
};

export type EarningOverview = {
  accountLevel: number;
  accountXp: number;

  missions: EarningMission[];

  season: {
    key: string;
    level: number;
    xp: number;
    totalXp: number;
    nextLevelXp: number;
    progress: number;
  };

  activeContract: {
    id: string;
    title: string;
    metric: string;
    target: number;
    progress: number;
    auraReward: number;
    xpReward: number;
    seasonXpReward: number;
    expiresAt: number | null;
    status: string;
  } | null;

  activeBounties: Array<{
    id: string;
    title: string;
    description: string;
    metric: string;
    target: number;
    progress: number;
    auraReward: number;
    xpReward: number;
    seasonXpReward: number;
    endsAt: number;
    claimed: boolean;
  }>;
};

function number(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function seasonXpNeeded(level: number) {
  return 180 + (Math.max(1, level) - 1) * 45;
}

function utcDayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function utcWeekKey(date = new Date()) {
  const copy = new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate()
    )
  );

  const day = copy.getUTCDay() || 7;
  copy.setUTCDate(copy.getUTCDate() + 4 - day);

  const yearStart = new Date(
    Date.UTC(copy.getUTCFullYear(), 0, 1)
  );

  const week = Math.ceil(
    (((copy.getTime() - yearStart.getTime()) / 86400000) + 1) / 7
  );

  return `${copy.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function startOfUtcDayMs(date = new Date()) {
  return Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate()
  );
}

function startOfUtcWeekMs(date = new Date()) {
  const current = new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate()
    )
  );

  const day = current.getUTCDay() || 7;

  current.setUTCDate(
    current.getUTCDate() - day + 1
  );

  current.setUTCHours(0, 0, 0, 0);

  return current.getTime();
}

/*
 * Positive balance movements that MUST NOT count toward
 * "Aura qazan" missions.
 *
 * Mission progress should represent genuine economy earnings,
 * not money that was transferred, borrowed, administratively
 * granted, refunded, or paid out by another mission.
 */
function countsAsEarnedAura(type: unknown) {
  const value = String(type ?? "").toLowerCase();

  if (!value) {
    return false;
  }

  if (value === "transfer") return false;
  if (value === "social_gift") return false;

  if (value === "admin_give") return false;
  if (value === "admin_setbalance") return false;
  if (value === "admin_drop") return false;

  if (value.startsWith("loan_")) return false;

  if (value === "prime_refund") return false;
  if (value === "casino_timeout_refund") return false;

  /*
   * Prevent claiming one mission from progressing another
   * Aura mission.
   */
  if (value === "mission") return false;

  return true;
}

/*
 * Reconcile Aura missions from the real shared transaction ledger.
 *
 * This makes the reward page self-healing:
 * even if one gameplay path forgot to call recordEarningProgress(),
 * the mission still reflects the Aura the player actually earned.
 */
async function syncAuraMissionProgress(
  supabase: any,
  userId: string
) {
  const now = new Date();

  const dailyKey = utcDayKey(now);
  const weeklyKey = utcWeekKey(now);

  const dailyStart = startOfUtcDayMs(now);
  const weeklyStart = startOfUtcWeekMs(now);

  const { data: transactions, error: transactionError } =
    await supabase
      .from("economy_transactions")
      .select("amount,type,created_at")
      .eq("user_id", userId)
      .gt("amount", 0)
      .gte("created_at", weeklyStart)
      .order("created_at", {
        ascending: true,
      });

  if (transactionError) {
    throw transactionError;
  }

  let dailyEarned = 0;
  let weeklyEarned = 0;

  for (const transaction of transactions ?? []) {
    if (!countsAsEarnedAura(transaction.type)) {
      continue;
    }

    const amount = Math.max(
      0,
      number(transaction.amount)
    );

    if (!amount) {
      continue;
    }

    const createdAt = number(
      transaction.created_at
    );

    weeklyEarned += amount;

    if (createdAt >= dailyStart) {
      dailyEarned += amount;
    }
  }

  const { data: auraMissions, error: missionError } =
    await supabase
      .from("earning_missions")
      .select(
        "id,period_type,period_key,target,progress,completed_at"
      )
      .eq("user_id", userId)
      .eq("metric", "aura_earned")
      .or(
        `and(period_type.eq.daily,period_key.eq.${dailyKey}),and(period_type.eq.weekly,period_key.eq.${weeklyKey})`
      );

  if (missionError) {
    throw missionError;
  }

  const completedNow = Date.now();

  for (const mission of auraMissions ?? []) {
    const target = Math.max(
      1,
      number(mission.target, 1)
    );

    const actualEarned =
      mission.period_type === "weekly"
        ? weeklyEarned
        : dailyEarned;

    const newProgress = Math.min(
      target,
      Math.max(
        number(mission.progress),
        actualEarned
      )
    );

    const shouldComplete =
      newProgress >= target;

    const update: Record<string, unknown> = {
      progress: newProgress,
    };

    if (
      shouldComplete &&
      mission.completed_at == null
    ) {
      update.completed_at = completedNow;
    }

    const { error: updateError } =
      await supabase
        .from("earning_missions")
        .update(update)
        .eq("id", mission.id);

    if (updateError) {
      throw updateError;
    }
  }
}


/*
|--------------------------------------------------------------------------
| CONTRACTS
|--------------------------------------------------------------------------
|
| One personal contract at a time.
| A completed contract remains visible until its reward is claimed.
|
*/

const CONTRACT_CATALOG = [
  {
    key: "casino_operator",
    title: "Casino operatoru",
    metric: "casino_bet",
    target: 30,
    aura: 8500,
    xp: 220,
    seasonXp: 320,
    durationMs: 24 * 60 * 60 * 1000,
  },
  {
    key: "game_runner",
    title: "Raund ustası",
    metric: "game_played",
    target: 25,
    aura: 7000,
    xp: 190,
    seasonXp: 280,
    durationMs: 24 * 60 * 60 * 1000,
  },
  {
    key: "aura_hunter",
    title: "Aura ovçusu",
    metric: "aura_earned",
    target: 15000,
    aura: 9000,
    xp: 240,
    seasonXp: 350,
    durationMs: 24 * 60 * 60 * 1000,
  },
  {
    key: "server_regular",
    title: "Server rezidenti",
    metric: "activity",
    target: 20,
    aura: 6000,
    xp: 170,
    seasonXp: 250,
    durationMs: 24 * 60 * 60 * 1000,
  },
  {
    key: "casino_marathon",
    title: "Risk marafonu",
    metric: "casino_bet",
    target: 60,
    aura: 18000,
    xp: 400,
    seasonXp: 600,
    durationMs: 48 * 60 * 60 * 1000,
  },
  {
    key: "grinder",
    title: "Grind rejimi",
    metric: "game_played",
    target: 60,
    aura: 16500,
    xp: 380,
    seasonXp: 570,
    durationMs: 48 * 60 * 60 * 1000,
  },
  {
    key: "capital_run",
    title: "Kapital əməliyyatı",
    metric: "aura_earned",
    target: 50000,
    aura: 22000,
    xp: 480,
    seasonXp: 720,
    durationMs: 72 * 60 * 60 * 1000,
  },
  {
    key: "octoson_core",
    title: "Octoson nüvəsi",
    metric: "activity",
    target: 50,
    aura: 15000,
    xp: 360,
    seasonXp: 540,
    durationMs: 72 * 60 * 60 * 1000,
  },
] as const;

function hashContractSeed(value: string) {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

async function ensureUserContract(
  supabase: any,
  userId: string
) {
  const now = Date.now();

  /*
   * Expire only unfinished active contracts.
   */
  const { error: expireError } = await supabase
    .from("user_contracts")
    .update({
      status: "expired",
    })
    .eq("user_id", userId)
    .eq("status", "active")
    .lt("expires_at", now);

  if (expireError) {
    throw expireError;
  }

  /*
   * A completed contract must stay visible until claimed.
   */
  const { data: existing, error: existingError } =
    await supabase
      .from("user_contracts")
      .select("*")
      .eq("user_id", userId)
      .in("status", ["active", "completed"])
      .order("accepted_at", {
        ascending: false,
      })
      .limit(1)
      .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if (existing) {
    return existing;
  }

  const day = utcDayKey();

  const seed = hashContractSeed(
    `${userId}:${day}`
  );

  const contract =
    CONTRACT_CATALOG[
      seed % CONTRACT_CATALOG.length
    ];

  const { data, error } = await supabase
    .from("user_contracts")
    .insert({
      user_id: userId,
      contract_key: `${day}:${contract.key}`,
      title: contract.title,
      metric: contract.metric,
      target: contract.target,
      progress: 0,
      aura_reward: contract.aura,
      xp_reward: contract.xp,
      season_xp_reward: contract.seasonXp,
      status: "active",
      accepted_at: now,
      expires_at: now + contract.durationMs,
    })
    .select("*")
    .single();

  if (!error) {
    return data;
  }

  /*
   * Concurrent page requests may both try to provision.
   * Re-read the winner instead of failing the Earn page.
   */
  const { data: fallback, error: fallbackError } =
    await supabase
      .from("user_contracts")
      .select("*")
      .eq("user_id", userId)
      .in("status", ["active", "completed"])
      .order("accepted_at", {
        ascending: false,
      })
      .limit(1)
      .maybeSingle();

  if (fallbackError) {
    throw fallbackError;
  }

  if (fallback) {
    return fallback;
  }

  throw error;
}

export async function getEarningOverview(
  userId: string
): Promise<EarningOverview> {
  const supabase =
    getSupabaseServerClient();

  const now = Date.now();

  /*
   * Provision today's missions first.
   */
  await ensureEarningMissions(
    supabase,
    userId
  );

  await ensureUserContract(
    supabase,
    userId
  );

  /*
   * Then reconcile Aura progress from the authoritative
   * transaction history.
   */
  await syncAuraMissionProgress(
    supabase,
    userId
  );

  const currentDate =
    new Date();

  const dailyPeriodKey =
    utcDayKey(currentDate);

  const weeklyPeriodKey =
    utcWeekKey(currentDate);

  const [
    profileResult,
    missionsResult,
    contractResult,
    bountiesResult,
    bountyProgressResult,
  ] =
    await Promise.all([
      supabase
        .from("economy_users")
        .select("profile")
        .eq("user_id", userId)
        .maybeSingle(),

      supabase
        .from("earning_missions")
        .select("*")
        .eq("user_id", userId)
        .or(
          `and(period_type.eq.daily,period_key.eq.${dailyPeriodKey}),and(period_type.eq.weekly,period_key.eq.${weeklyPeriodKey})`
        )
        .order(
          "created_at",
          {
            ascending: false,
          }
        ),

      supabase
        .from("user_contracts")
        .select("*")
        .eq("user_id", userId)
        .in("status", ["active", "completed"])
        .order("accepted_at", {
          ascending: false,
        })
        .limit(1)
        .maybeSingle(),

      supabase
        .from("earning_bounties")
        .select("*")
        .eq("active", true)
        .lte("starts_at", now)
        .gt("ends_at", now)
        .order(
          "ends_at",
          {
            ascending: true,
          }
        ),

      supabase
        .from("user_bounty_progress")
        .select("*")
        .eq("user_id", userId),
    ]);

  if (profileResult.error) {
    throw profileResult.error;
  }

  if (missionsResult.error) {
    throw missionsResult.error;
  }

  if (contractResult.error) {
    throw contractResult.error;
  }

  if (bountiesResult.error) {
    throw bountiesResult.error;
  }

  if (bountyProgressResult.error) {
    throw bountyProgressResult.error;
  }

  const profile =
    profileResult.data?.profile &&
    typeof profileResult.data.profile ===
      "object"
      ? profileResult.data.profile
      : {};

  const season =
    profile.season &&
    typeof profile.season ===
      "object" &&
    !Array.isArray(profile.season)
      ? profile.season
      : {};

  const seasonLevel =
    Math.min(
      50,
      Math.max(
        1,
        number(
          season.level,
          1
        )
      )
    );

  const seasonXp =
    Math.max(
      0,
      number(
        season.xp
      )
    );

  const nextLevelXp =
    seasonXpNeeded(
      seasonLevel
    );

  const progressByBounty =
    new Map(
      (
        bountyProgressResult.data ??
        []
      ).map(
        (item: any) => [
          String(
            item.bounty_id
          ),
          item,
        ]
      )
    );

  return {
    accountLevel:
      Math.min(
        50,
        Math.max(
          1,
          number(
            profile.level,
            1
          )
        )
      ),

    accountXp:
      Math.max(
        0,
        number(
          profile.xp
        )
      ),

    missions:
      (
        missionsResult.data ??
        []
      ).map(
        (mission: any) => ({
          id:
            String(
              mission.id
            ),

          periodType:
            mission.period_type ===
            "weekly"
              ? "weekly"
              : "daily",

          periodKey:
            String(
              mission.period_key
            ),

          missionKey:
            String(
              mission.mission_key
            ),

          title:
            String(
              mission.title
            ),

          description:
            String(
              mission.description ??
                ""
            ),

          metric:
            String(
              mission.metric
            ),

          target:
            Math.max(
              1,
              number(
                mission.target,
                1
              )
            ),

          progress:
            Math.max(
              0,
              number(
                mission.progress
              )
            ),

          auraReward:
            Math.max(
              0,
              number(
                mission.aura_reward
              )
            ),

          xpReward:
            Math.max(
              0,
              number(
                mission.xp_reward
              )
            ),

          seasonXpReward:
            Math.max(
              0,
              number(
                mission.season_xp_reward
              )
            ),

          completedAt:
            mission.completed_at ==
            null
              ? null
              : number(
                  mission.completed_at
                ),

          claimedAt:
            mission.claimed_at ==
            null
              ? null
              : number(
                  mission.claimed_at
                ),

          primeOnly:
            String(
              mission.mission_key ?? ""
            ).startsWith("prime_") ||
            Boolean(
              mission.metadata &&
              typeof mission.metadata === "object" &&
              !Array.isArray(mission.metadata) &&
              mission.metadata.primeOnly === true
            ),
        })
      ),

    season: {
      key:
        String(
          season.key ??
            OCTOSON_SEASON_KEY
        ),

      level:
        seasonLevel,

      xp:
        seasonXp,

      totalXp:
        Math.max(
          0,
          number(
            season.totalXp,
            seasonXp
          )
        ),

      nextLevelXp,

      progress:
        seasonLevel >= 50
          ? 100
          : Math.min(
              100,
              (
                seasonXp /
                nextLevelXp
              ) * 100
            ),
    },

    activeContract:
      contractResult.data
        ? {
            id:
              String(
                contractResult
                  .data.id
              ),

            title:
              String(
                contractResult
                  .data.title
              ),

            metric:
              String(
                contractResult
                  .data.metric
              ),

            target:
              Math.max(
                1,
                number(
                  contractResult
                    .data.target,
                  1
                )
              ),

            progress:
              Math.max(
                0,
                number(
                  contractResult
                    .data.progress
                )
              ),

            auraReward:
              Math.max(
                0,
                number(
                  contractResult
                    .data
                    .aura_reward
                )
              ),

            xpReward:
              Math.max(
                0,
                number(
                  contractResult
                    .data.xp_reward
                )
              ),

            seasonXpReward:
              Math.max(
                0,
                number(
                  contractResult
                    .data
                    .season_xp_reward
                )
              ),

            expiresAt:
              contractResult
                .data
                .expires_at ==
              null
                ? null
                : number(
                    contractResult
                      .data
                      .expires_at
                  ),

            status:
              String(
                contractResult
                  .data.status
              ),
          }
        : null,

    activeBounties:
      (
        bountiesResult.data ??
        []
      ).map(
        (bounty: any) => {
          const progress =
            progressByBounty.get(
              String(
                bounty.id
              )
            ) as any;

          return {
            id:
              String(
                bounty.id
              ),

            title:
              String(
                bounty.title
              ),

            description:
              String(
                bounty.description ??
                  ""
              ),

            metric:
              String(
                bounty.metric
              ),

            target:
              Math.max(
                1,
                number(
                  bounty.target,
                  1
                )
              ),

            progress:
              Math.max(
                0,
                number(
                  progress
                    ?.progress
                )
              ),

            auraReward:
              Math.max(
                0,
                number(
                  bounty
                    .aura_reward
                )
              ),

            xpReward:
              Math.max(
                0,
                number(
                  bounty
                    .xp_reward
                )
              ),

            seasonXpReward:
              Math.max(
                0,
                number(
                  bounty
                    .season_xp_reward
                )
              ),

            endsAt:
              number(
                bounty.ends_at
              ),

            claimed:
              progress
                ?.claimed_at !=
              null,
          };
        }
      ),
  };
}
