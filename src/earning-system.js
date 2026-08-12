const DAY_MS = 86_400_000;

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
    (((copy - yearStart) / DAY_MS) + 1) / 7
  );

  return `${copy.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/*
|--------------------------------------------------------------------------
| DAILY MISSIONS
|--------------------------------------------------------------------------
|
| Stable production mission catalog.
| Do not reuse an existing mission key for a different objective.
|
*/

const DAILY_MISSIONS = [
  {
    key: "activity_3",
    title: "Gündəlik ritm",
    description: "Octoson-da 3 aktivlik tamamla.",
    metric: "activity",
    target: 3,
    difficulty: "easy",
    tier: "small",
    aura: 750,
    xp: 30,
    seasonXp: 45,
  },

  {
    key: "games_3",
    title: "İlk raundlar",
    description: "Bu gün 3 oyun tamamla.",
    metric: "game_played",
    target: 3,
    difficulty: "easy",
    tier: "small",
    aura: 900,
    xp: 35,
    seasonXp: 50,
  },

  {
    key: "activity_8",
    title: "Aktiv gün",
    description: "Bu gün 8 aktivlik tamamla.",
    metric: "activity",
    target: 8,
    difficulty: "medium",
    tier: "medium",
    aura: 1800,
    xp: 60,
    seasonXp: 85,
  },

  {
    key: "games_8",
    title: "Oyun sessiyası",
    description: "Bu gün 8 oyun tamamla.",
    metric: "game_played",
    target: 8,
    difficulty: "medium",
    tier: "medium",
    aura: 2200,
    xp: 70,
    seasonXp: 100,
  },

  {
    key: "casino_8",
    title: "Risk protokolu",
    description: "Casino-da 8 mərc tamamla.",
    metric: "casino_bet",
    target: 8,
    difficulty: "medium",
    tier: "medium",
    aura: 3000,
    xp: 85,
    seasonXp: 115,
  },

  {
    key: "casino_20",
    title: "High roller",
    description: "Bu gün Casino-da 20 mərc tamamla.",
    metric: "casino_bet",
    target: 20,
    difficulty: "hard",
    tier: "large",
    aura: 5500,
    xp: 135,
    seasonXp: 190,
  },

  {
    key: "earn_2500",
    title: "Aura axını",
    description: "Bu gün 2,500 Aura qazan.",
    metric: "aura_earned",
    target: 2500,
    difficulty: "medium",
    tier: "medium",
    aura: 2500,
    xp: 75,
    seasonXp: 100,
  },

  {
    key: "earn_10000",
    title: "Güclü gün",
    description: "Bu gün 10,000 Aura qazan.",
    metric: "aura_earned",
    target: 10000,
    difficulty: "hard",
    tier: "large",
    aura: 6500,
    xp: 160,
    seasonXp: 225,
  },
];

/*
|--------------------------------------------------------------------------
| WEEKLY MISSIONS
|--------------------------------------------------------------------------
*/

const WEEKLY_MISSIONS = [
  {
    key: "games_20",
    title: "Həftənin oyunçusu",
    description: "Bu həftə 20 oyun tamamla.",
    metric: "game_played",
    target: 20,
    difficulty: "medium",
    tier: "medium",
    aura: 5500,
    xp: 180,
    seasonXp: 260,
  },

  {
    key: "games_50",
    title: "Dominasiya",
    description: "Bu həftə 50 oyun tamamla.",
    metric: "game_played",
    target: 50,
    difficulty: "hard",
    tier: "large",
    aura: 15000,
    xp: 400,
    seasonXp: 600,
  },

  {
    key: "games_100",
    title: "Marafon",
    description: "Bu həftə 100 oyun tamamla.",
    metric: "game_played",
    target: 100,
    difficulty: "elite",
    tier: "large",
    aura: 32000,
    xp: 700,
    seasonXp: 1050,
  },

  {
    key: "activity_35",
    title: "Server ritmi",
    description: "Bu həftə 35 aktivlik tamamla.",
    metric: "activity",
    target: 35,
    difficulty: "medium",
    tier: "medium",
    aura: 6500,
    xp: 200,
    seasonXp: 300,
  },

  {
    key: "activity_75",
    title: "Server dayağı",
    description: "Bu həftə 75 aktivlik tamamla.",
    metric: "activity",
    target: 75,
    difficulty: "hard",
    tier: "large",
    aura: 16000,
    xp: 420,
    seasonXp: 620,
  },

  {
    key: "casino_50",
    title: "Risk həftəsi",
    description: "Bu həftə Casino-da 50 mərc tamamla.",
    metric: "casino_bet",
    target: 50,
    difficulty: "hard",
    tier: "large",
    aura: 18000,
    xp: 450,
    seasonXp: 650,
  },

  {
    key: "casino_100",
    title: "Casino veteranı",
    description: "Bu həftə Casino-da 100 mərc tamamla.",
    metric: "casino_bet",
    target: 100,
    difficulty: "elite",
    tier: "large",
    aura: 35000,
    xp: 750,
    seasonXp: 1100,
  },

  {
    key: "earn_25000",
    title: "Kapital qur",
    description: "Bu həftə 25,000 Aura qazan.",
    metric: "aura_earned",
    target: 25000,
    difficulty: "hard",
    tier: "large",
    aura: 12500,
    xp: 350,
    seasonXp: 500,
  },

  {
    key: "earn_75000",
    title: "Kapital maşını",
    description: "Bu həftə 75,000 Aura qazan.",
    metric: "aura_earned",
    target: 75000,
    difficulty: "elite",
    tier: "large",
    aura: 30000,
    xp: 650,
    seasonXp: 950,
  },
];

export async function ensureEarningMissions(supabase, userId) {
  const now = new Date();

  const periods = [
    {
      type: "daily",
      key: utcDayKey(now),
      missions: DAILY_MISSIONS,
    },
    {
      type: "weekly",
      key: utcWeekKey(now),
      missions: WEEKLY_MISSIONS,
    },
  ];

  for (const period of periods) {
    const rows = period.missions.map((mission) => ({
      id: `${userId}:${period.type}:${period.key}:${mission.key}`,

      user_id: userId,

      period_type: period.type,
      period_key: period.key,

      mission_key: mission.key,

      title: mission.title,
      description: mission.description,

      metric: mission.metric,
      target: mission.target,

      progress: 0,

      aura_reward: mission.aura,
      xp_reward: mission.xp,
      season_xp_reward: mission.seasonXp,

      metadata: {
        difficulty: mission.difficulty,
        tier: mission.tier,
      },
    }));

    /*
     * Missions are immutable once provisioned.
     *
     * IMPORTANT:
     * Never overwrite an existing mission here. In particular,
     * `progress`, `completed_at`, and `claimed_at` belong to the
     * player's live state.
     *
     * Previously ignoreDuplicates:false caused every visit to the
     * Earn page to upsert `progress: 0` over existing missions,
     * resetting real gameplay progress written by the bot.
     */
    const { error } = await supabase
      .from("earning_missions")
      .upsert(rows, {
        onConflict:
          "user_id,period_type,period_key,mission_key",
        ignoreDuplicates: true,
      });

    if (error) {
      /*
       * Compatibility fallback in case your current
       * earning_missions table doesn't have metadata yet.
       */
      const fallbackRows = rows.map(
        ({ metadata, ...row }) => row
      );

      const fallback = await supabase
        .from("earning_missions")
        .upsert(fallbackRows, {
          onConflict:
            "user_id,period_type,period_key,mission_key",
          ignoreDuplicates: true,
        });

      if (fallback.error) {
        throw fallback.error;
      }
    }
  }
}

export async function recordEarningProgress(
  supabase,
  userId,
  metric,
  amount = 1
) {
  const safeAmount = Math.max(
    0,
    Math.floor(Number(amount) || 0)
  );

  if (!safeAmount) return;

  await ensureEarningMissions(
    supabase,
    userId
  );

  const now = Date.now();

  const today = utcDayKey();
  const week = utcWeekKey();

  const { data: missions, error } =
    await supabase
      .from("earning_missions")
      .select(
        "id,target,progress,completed_at"
      )
      .eq("user_id", userId)
      .eq("metric", metric)
      .or(
        `and(period_type.eq.daily,period_key.eq.${today}),and(period_type.eq.weekly,period_key.eq.${week})`
      );

  if (error) throw error;

  for (const mission of missions ?? []) {
    const oldProgress = Math.max(
      0,
      Number(mission.progress ?? 0)
    );

    const target = Math.max(
      1,
      Number(mission.target ?? 1)
    );

    if (oldProgress >= target) {
      continue;
    }

    const newProgress = Math.min(
      target,
      oldProgress + safeAmount
    );

    const update = {
      progress: newProgress,
    };

    if (
      newProgress >= target &&
      mission.completed_at == null
    ) {
      update.completed_at = now;
    }

    const { error: updateError } =
      await supabase
        .from("earning_missions")
        .update(update)
        .eq("id", mission.id)
        .eq("progress", oldProgress);

    if (updateError) {
      throw updateError;
    }
  }

  await updateContractProgress(
    supabase,
    userId,
    metric,
    safeAmount,
    now
  );

  await updateBountyProgress(
    supabase,
    userId,
    metric,
    safeAmount,
    now
  );
}

async function updateContractProgress(
  supabase,
  userId,
  metric,
  amount,
  now
) {
  const { data: contracts, error } =
    await supabase
      .from("user_contracts")
      .select(
        "id,target,progress,status"
      )
      .eq("user_id", userId)
      .eq("status", "active")
      .eq("metric", metric);

  if (error) throw error;

  for (const contract of contracts ?? []) {
    const target = Math.max(
      1,
      Number(contract.target ?? 1)
    );

    const oldProgress = Math.max(
      0,
      Number(contract.progress ?? 0)
    );

    if (oldProgress >= target) {
      continue;
    }

    const newProgress = Math.min(
      target,
      oldProgress + amount
    );

    const update = {
      progress: newProgress,
    };

    if (newProgress >= target) {
      update.status = "completed";
      update.completed_at = now;
    }

    const { error: updateError } =
      await supabase
        .from("user_contracts")
        .update(update)
        .eq("id", contract.id)
        .eq("progress", oldProgress);

    if (updateError) {
      throw updateError;
    }
  }
}

async function updateBountyProgress(
  supabase,
  userId,
  metric,
  amount,
  now
) {
  const { data: bounties, error } =
    await supabase
      .from("earning_bounties")
      .select("id,target")
      .eq("active", true)
      .eq("metric", metric)
      .lte("starts_at", now)
      .gt("ends_at", now);

  if (error) throw error;

  for (const bounty of bounties ?? []) {
    const {
      data: current,
      error: currentError,
    } = await supabase
      .from("user_bounty_progress")
      .select(
        "progress,completed_at"
      )
      .eq("user_id", userId)
      .eq("bounty_id", bounty.id)
      .maybeSingle();

    if (currentError) {
      throw currentError;
    }

    const target = Math.max(
      1,
      Number(bounty.target ?? 1)
    );

    const oldProgress = Math.max(
      0,
      Number(current?.progress ?? 0)
    );

    if (oldProgress >= target) {
      continue;
    }

    const newProgress = Math.min(
      target,
      oldProgress + amount
    );

    const { error: upsertError } =
      await supabase
        .from("user_bounty_progress")
        .upsert(
          {
            user_id: userId,
            bounty_id: bounty.id,

            progress: newProgress,

            completed_at:
              newProgress >= target
                ? current?.completed_at ??
                  now
                : current?.completed_at ??
                  null,
          },
          {
            onConflict:
              "user_id,bounty_id",
          }
        );

    if (upsertError) {
      throw upsertError;
    }
  }
}
