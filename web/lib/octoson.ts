import "server-only";

import { getSupabaseServerClient } from "./supabase-server";

export type OctosonProfile = {
  balance?: number;
  bank?: number;
  xp?: number;
  level?: number;
  rank?: string;
  prestige?: number;
  reputation?: number;
  luck?: number;
  inventory?: Record<string, unknown>;
  stats?: Record<string, unknown>;
  badges?: unknown[];
  achievements?: unknown[];
  prime?: Record<string, unknown>;
  world?: Record<string, unknown>;
  season?: Record<string, unknown>;
  [key: string]: unknown;
};

type EconomyUserRow = {
  user_id: string;
  profile: OctosonProfile | null;
  version: number | null;
};

export type OctosonUser = {
  userId: string;
  version: number;
  profile: OctosonProfile;
};

export async function getOctosonUser(
  discordUserId: string
): Promise<OctosonUser | null> {
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase
    .from("economy_users")
    .select("user_id, profile, version")
    .eq("user_id", discordUserId)
    .maybeSingle();

  if (error) {
    console.error(
      "[OCTOSON WEB] Supabase profile error:",
      error
    );

    throw new Error(
      `Octoson profilini yükləmək mümkün olmadı: ${error.message}`
    );
  }

  if (!data) {
    return null;
  }

  const row = data as unknown as EconomyUserRow;

  return {
    userId: String(row.user_id),
    version: Number(row.version ?? 0),
    profile: row.profile ?? {},
  };
}

export type OctosonLeaderboardEntry = {
  userId: string;
  balance: number;
  level: number;
  prestige: number;
  rank: string;
  primeActive: boolean;
  verified: boolean;
  wins: number;
};

function readNumber(
  value: unknown,
  fallback = 0
): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function readRecord(
  value: unknown
): Record<string, unknown> {
  if (
    value &&
    typeof value === "object" &&
    !Array.isArray(value)
  ) {
    return value as Record<string, unknown>;
  }

  return {};
}

export function isOctosonVerified(
  profileValue: unknown
): boolean {
  const profile = readRecord(profileValue);
  const identity = readRecord(profile.identity);

  return (
    identity.verified === true ||
    profile.verified === true
  );
}

export function getOctosonAppearance(
  profileValue: unknown
): {
  gradient: string;
  bannerAnimation: string;
  primaryColor: string;
  secondaryColor: string;
  glowIntensity: number;
} {
  const profile = readRecord(profileValue);
  const appearance = readRecord(profile.appearance);

  const validHex = (
    value: unknown,
    fallback: string
  ) =>
    typeof value === "string" &&
    /^#[0-9a-fA-F]{6}$/.test(value)
      ? value
      : fallback;

  const rawGlow =
    Number(appearance.glowIntensity);

  return {
    gradient:
      typeof appearance.gradient === "string"
        ? appearance.gradient
        : "cyan",

    bannerAnimation:
      typeof appearance.bannerAnimation === "string"
        ? appearance.bannerAnimation
        : "aurora",

    primaryColor:
      validHex(
        appearance.primaryColor,
        "#67e8f9"
      ),

    secondaryColor:
      validHex(
        appearance.secondaryColor,
        "#6366f1"
      ),

    glowIntensity:
      Number.isFinite(rawGlow)
        ? Math.min(
            100,
            Math.max(0, rawGlow)
          )
        : 55,
  };
}

export async function getOctosonLeaderboard(
  limit = 100
): Promise<OctosonLeaderboardEntry[]> {
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase
    .from("economy_users")
    .select("user_id, profile");

  if (error) {
    console.error(
      "[OCTOSON WEB] Leaderboard error:",
      error
    );

    throw new Error(
      `Leaderboard yüklənmədi: ${error.message}`
    );
  }

  const rows = (data ?? []) as unknown as Array<{
    user_id: string;
    profile: OctosonProfile | null;
  }>;

  return rows
    .map((row) => {
      const profile = readRecord(row.profile);
      const stats = readRecord(profile.stats);
      const prime = readRecord(profile.prime);

      const primeUntil = readNumber(
        prime.until ??
          prime.expiresAt ??
          profile.primeUntil
      );

      const primeActive =
        prime.active === true ||
        profile.primeActive === true ||
        primeUntil > Date.now();

      return {
        userId: String(row.user_id),
        balance: readNumber(profile.balance),
        level: readNumber(profile.level, 1),
        prestige: readNumber(profile.prestige),
        rank: String(
          profile.rank ?? "Yeni başlayan"
        ),
        primeActive,
        verified: isOctosonVerified(profile),
        wins: readNumber(
          stats.gamesWon ??
            stats.wins ??
            profile.gamesWon
        ),
      };
    })
    .sort(
      (a, b) =>
        b.balance - a.balance ||
        b.level - a.level ||
        b.prestige - a.prestige
    )
    .slice(0, Math.max(1, limit));
}



// ===== OCTOSON PUBLIC ACTIVITY =====

export type OctosonPublicTransaction = {
  id: string;
  userId: string;
  amount: number;
  type: string;
  note: string;
  metadata: Record<string, unknown>;
  balanceBefore: number | null;
  balanceAfter: number | null;
  createdAt: string;
};

export type OctosonPublicProfile = {
  userId: string;
  balance: number;
  bank: number;
  level: number;
  xp: number;
  prestige: number;
  rank: string;
  reputation: number;
  luck: number;
  gamesPlayed: number;
  gamesWon: number;
  gamesLost: number;
  primeActive: boolean;
  verified: boolean;
  badges: unknown[];
  achievements: unknown[];
  rawProfile: OctosonProfile;
};

type PublicTransactionRow = {
  transaction_key: string | null;
  user_id: string;
  amount: number | string | null;
  type: string | null;
  note: string | null;
  metadata: Record<string, unknown> | null;
  balance_before: number | string | null;
  balance_after: number | string | null;
  created_at: string | number;
};

function nullableNumber(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : null;
}

function publicTransactionFromRow(
  row: PublicTransactionRow
): OctosonPublicTransaction {
  return {
    id:
      String(row.transaction_key ?? "") ||
      `${row.user_id}-${String(row.created_at)}`,
    userId: String(row.user_id),
    amount: readNumber(row.amount),
    type: String(row.type ?? "transaction"),
    note: String(row.note ?? ""),
    metadata: readRecord(row.metadata),
    balanceBefore: nullableNumber(row.balance_before),
    balanceAfter: nullableNumber(row.balance_after),
    createdAt: new Date(row.created_at).toISOString(),
  };
}

export async function getOctosonPublicActivity(
  limit = 100,
  userId?: string
): Promise<OctosonPublicTransaction[]> {
  const supabase = getSupabaseServerClient();

  const safeLimit = Math.min(
    Math.max(Math.floor(limit), 1),
    500
  );

  let query = supabase
    .from("economy_transactions")
    .select(
      "transaction_key,user_id,amount,type,note,metadata,balance_before,balance_after,created_at"
    )
    .order("created_at", { ascending: false })
    .limit(safeLimit);

  if (userId) {
    query = query.eq("user_id", userId);
  }

  const { data, error } = await query;

  if (error) {
    console.error(
      "[OCTOSON WEB] Public activity error:",
      error
    );

    throw new Error(
      `Fəaliyyət tarixçəsi yüklənmədi: ${error.message}`
    );
  }

  return (
    (data ?? []) as unknown as PublicTransactionRow[]
  ).map(publicTransactionFromRow);
}

export async function getOctosonPublicProfile(
  userId: string
): Promise<OctosonPublicProfile | null> {
  const user = await getOctosonUser(userId);

  if (!user) {
    return null;
  }

  const profile = readRecord(user.profile);
  const stats = readRecord(profile.stats);
  const prime = readRecord(profile.prime);

  const primeUntil = readNumber(
    prime.until ??
      prime.expiresAt ??
      profile.primeUntil
  );

  const gamesPlayed = readNumber(
    stats.gamesPlayed ??
      stats.played ??
      profile.gamesPlayed
  );

  const gamesWon = readNumber(
    stats.gamesWon ??
      stats.wins ??
      profile.gamesWon
  );

  const explicitLosses = readNumber(
    stats.gamesLost ??
      stats.losses ??
      profile.gamesLost,
    -1
  );

  const gamesLost =
    explicitLosses >= 0
      ? explicitLosses
      : Math.max(0, gamesPlayed - gamesWon);

  return {
    userId,
    balance: readNumber(profile.balance),
    bank: readNumber(profile.bank),
    level: readNumber(profile.level, 1),
    xp: readNumber(profile.xp),
    prestige: readNumber(profile.prestige),
    rank: String(profile.rank ?? "Yeni başlayan"),
    reputation: readNumber(profile.reputation),
    luck: readNumber(profile.luck),
    gamesPlayed,
    gamesWon,
    gamesLost,
    primeActive:
      prime.active === true ||
      profile.primeActive === true ||
      primeUntil > Date.now(),
    verified: isOctosonVerified(profile),
    badges: Array.isArray(profile.badges)
      ? profile.badges
      : [],
    achievements: Array.isArray(profile.achievements)
      ? profile.achievements
      : [],
    rawProfile: user.profile,
  };
}
