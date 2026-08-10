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

