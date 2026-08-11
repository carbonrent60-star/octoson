"use server";

import { sendOctosonCasinoActivity } from "@/lib/discord-server";

import { randomInt } from "node:crypto";

import { auth } from "@/auth";
import { getSupabaseServerClient } from "@/lib/supabase-server";
export type WebMinesSession = {
  id: string;
  bet: number;
  cost: number;
  ticketCover: number;
  usedTicket: boolean;
  revealed: number[];
  mines?: number[];
  mineCount: number;
  safeCount: number;
  multiplier: number;
  status: "active" | "won" | "lost" | "cancelled";
  balance?: number;
};

export type MinesResult = {
  ok: boolean;
  message: string;
  session?: WebMinesSession | null;
  balance?: number;
  net?: number;
  payout?: number;
};

type CasinoEntry = {
  ok: boolean;
  reason?: string;
  cost: number;
  ticketCover: number;
  usedTicket: boolean;
  profile?: {
    balance?: number;
  };
  restriction?: {
    maxBet?: number;
    [key: string]: unknown;
  };
};

type CasinoSettlement = {
  ok: boolean;
  reason?: string;
  profile?: {
    balance?: number;
  };
  payout?: number;
  net?: number;
};

type CasinoEconomyModule = {
  getCasinoCooldown(userId: string): Promise<number>;

  markCasinoPlayed(userId: string): Promise<unknown>;

  prepareCasinoEntry(
    userId: string,
    bet: number,
    game: string,
    options: { reserve: boolean }
  ): Promise<CasinoEntry>;

  settleCasinoGame(
    userId: string,
    input: {
      game: string;
      bet: number;
      cost: number;
      payout: number;
      won: boolean;
      multiplier: number;
      reserved: boolean;
    }
  ): Promise<CasinoSettlement>;

  refundReservedCasinoBet(
    userId: string,
    amount: number,
    game?: string,
    usedTicket?: boolean
  ): Promise<unknown>;
};

type MinesRow = {
  id: string;
  user_id: string;
  bet: number | string;
  cost: number | string;
  ticket_cover: number | string;
  used_ticket: boolean;
  mines: unknown;
  revealed: unknown;
  multiplier: number | string;
  status: "active" | "won" | "lost" | "cancelled";
};

async function getEconomyModule(): Promise<CasinoEconomyModule> {
  return import(
    "../../../../../src/economy.js"
  ) as unknown as Promise<CasinoEconomyModule>;
}

function validBet(value: unknown) {
  const amount = Number(value);

  if (
    !Number.isSafeInteger(amount) ||
    amount <= 0 ||
    amount > 100_000_000
  ) {
    return 0;
  }

  return amount;
}

const MINES_BOARD_SIZE = 25;
const MIN_MINES = 1;
const MAX_MINES = 12;
const MINES_HOUSE_EDGE = 0.97;

function numberArray(value: unknown): number[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return [...new Set(
    value
      .map(Number)
      .filter(
        (item) =>
          Number.isInteger(item) &&
          item >= 0 &&
          item < MINES_BOARD_SIZE
      )
  )].sort((a, b) => a - b);
}

function validMineCount(value: unknown) {
  const count = Number(value);

  if (
    !Number.isInteger(count) ||
    count < MIN_MINES ||
    count > MAX_MINES
  ) {
    return 0;
  }

  return count;
}

function createMines(mineCount: number): number[] {
  const positions = new Set<number>();

  while (positions.size < mineCount) {
    positions.add(randomInt(0, MINES_BOARD_SIZE));
  }

  return [...positions].sort((a, b) => a - b);
}

function multiplierFor(
  revealedCount: number,
  mineCount: number
) {
  if (revealedCount <= 0) {
    return 1;
  }

  const safeCount =
    MINES_BOARD_SIZE - mineCount;

  if (
    mineCount < MIN_MINES ||
    mineCount > MAX_MINES ||
    revealedCount > safeCount
  ) {
    return 1;
  }

  /*
   * Probability of successfully revealing
   * revealedCount safe tiles without hitting a mine.
   */
  let probability = 1;

  for (
    let index = 0;
    index < revealedCount;
    index += 1
  ) {
    probability *=
      (safeCount - index) /
      (MINES_BOARD_SIZE - index);
  }

  /*
   * 97% RTP / 3% house edge.
   */
  return Number(
    Math.max(
      1,
      MINES_HOUSE_EDGE / probability
    ).toFixed(2)
  );
}

function publicSession(
  row: MinesRow,
  revealMines = false
): WebMinesSession {
  const mines = numberArray(row.mines);
  const mineCount = mines.length;

  return {
    id: row.id,
    bet: Number(row.bet),
    cost: Number(row.cost),
    ticketCover: Number(
      row.ticket_cover ?? 0
    ),
    usedTicket: Boolean(row.used_ticket),
    revealed: numberArray(row.revealed),
    mineCount,
    safeCount:
      MINES_BOARD_SIZE - mineCount,
    ...(revealMines ? { mines } : {}),
    multiplier: Number(
      row.multiplier ?? 1
    ),
    status: row.status,
  };
}

async function currentUserId() {
  const session = await auth();
  return session?.user?.discordId ?? null;
}

async function activeRow(userId: string) {
  const supabase: any = getSupabaseServerClient();

  const { data, error } = await supabase
    .from("web_mines_sessions")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data as MinesRow | null) ?? null;
}

function blockedMessage(entry: CasinoEntry) {
  if (entry.reason === "casino_max_bet") {
    const maxBet = Number(
      entry.restriction?.maxBet ?? 0
    );

    return maxBet > 0
      ? `Bu hesab üçün maksimum mərc ${maxBet.toLocaleString(
          "en-US"
        )} Aura-dır.`
      : "Bu mərc limiti keçib.";
  }

  if (entry.reason === "casino_restricted") {
    return "Casino istifadən hazırda məhdudlaşdırılıb.";
  }

  return "Wallet-də bu mərc üçün kifayət qədər Aura yoxdur.";
}

export async function getActiveMinesAction(): Promise<MinesResult> {
  const userId = await currentUserId();

  if (!userId) {
    return {
      ok: false,
      message: "Discord sessiyası tapılmadı.",
    };
  }

  try {
    const row = await activeRow(userId);

    return {
      ok: true,
      message: row
        ? "Aktiv Mines raundu tapıldı."
        : "Aktiv Mines raundu yoxdur.",
      session: row ? publicSession(row) : null,
    };
  } catch (error) {
    console.error("[OCTOSON MINES LOAD]", error);

    return {
      ok: false,
      message: "Mines raundunu yükləmək mümkün olmadı.",
    };
  }
}

export async function startMinesAction(
  rawBet: number,
  rawMineCount: number = 3
): Promise<MinesResult> {
  const userId = await currentUserId();

  if (!userId) {
    return {
      ok: false,
      message: "Discord sessiyası tapılmadı.",
    };
  }

  const bet = validBet(rawBet);
  const mineCount =
    validMineCount(rawMineCount);

  if (!bet) {
    return {
      ok: false,
      message: "Düzgün mərc məbləği daxil et.",
    };
  }

  if (!mineCount) {
    return {
      ok: false,
      message:
        "Mina sayı 1 ilə 12 arasında olmalıdır.",
    };
  }

  const supabase: any = getSupabaseServerClient();
  const economy = await getEconomyModule();

  try {
    const existing = await activeRow(userId);

    if (existing) {
      return {
        ok: false,
        message:
          "Əvvəlcə aktiv Mines raundunu tamamla.",
        session: publicSession(existing),
      };
    }

    const cooldownMs =
      await economy.getCasinoCooldown(userId);

    if (cooldownMs > 0) {
      return {
        ok: false,
        message: `Növbəti oyun üçün ${Math.ceil(
          cooldownMs / 1000
        )} saniyə gözlə.`,
      };
    }

    /*
     * IMPORTANT:
     * Existing economy system reserves/deducts the bet.
     */
    const entry = await economy.prepareCasinoEntry(
      userId,
      bet,
      "mines",
      { reserve: true }
    );

    if (!entry.ok) {
      return {
        ok: false,
        message: blockedMessage(entry),
        balance: Number(entry.profile?.balance ?? 0),
      };
    }

    let inserted = false;

    try {
      const now = Date.now();

      const { data, error } = await supabase
        .from("web_mines_sessions")
        .insert({
          user_id: userId,
          bet,
          cost: entry.cost,
          ticket_cover: entry.ticketCover,
          used_ticket: entry.usedTicket,
          mines: createMines(mineCount),
          revealed: [],
          multiplier: 1,
          status: "active",
          created_at: now,
          updated_at: now,
        })
        .select("*")
        .single();

      if (error) {
        throw error;
      }

      inserted = true;


return {
        ok: true,
        message: "Mines başladı.",
        session: publicSession(data as MinesRow),
        balance: Number(entry.profile?.balance ?? 0),
      };
    } catch (error) {
      /*
       * Reservation succeeded but session creation failed.
       * Never eat the user's Aura.
       */
      if (!inserted) {
        await economy.refundReservedCasinoBet(
          userId,
          entry.cost,
          "mines",
          entry.usedTicket
        );
      }

      throw error;
    }
  } catch (error) {
    console.error("[OCTOSON MINES START]", error);

    return {
      ok: false,
      message:
        "Mines raundunu başlatmaq mümkün olmadı.",
    };
  }
}

export async function revealMinesTileAction(
  tile: number
): Promise<MinesResult> {
  const userId = await currentUserId();

  if (!userId) {
    return {
      ok: false,
      message: "Discord sessiyası tapılmadı.",
    };
  }

  if (
    !Number.isInteger(tile) ||
    tile < 0 ||
    tile >= MINES_BOARD_SIZE
  ) {
    return {
      ok: false,
      message: "Yanlış xana seçildi.",
    };
  }

  const supabase: any = getSupabaseServerClient();

  try {
    const row = await activeRow(userId);

    if (!row) {
      return {
        ok: false,
        message: "Aktiv Mines raundu yoxdur.",
      };
    }

    const mines = numberArray(row.mines);
    const revealed = numberArray(row.revealed);

    if (revealed.includes(tile)) {
      return {
        ok: false,
        message: "Bu xana artıq açılıb.",
        session: publicSession(row),
      };
    }

    /*
     * BOOM.
     * The stake was already reserved at start, so settle with
     * payout 0.
     */
    if (mines.includes(tile)) {
      const economy = await getEconomyModule();

      const settlement =
        await economy.settleCasinoGame(userId, {
          game: "mines",
          bet: Number(row.bet),
          cost: Number(row.cost),
          payout: 0,
          won: false,
          multiplier: 0,
          reserved: Number(row.cost) > 0,
        });

      if (!settlement.ok) {
        return {
          ok: false,
          message:
            "Mines nəticəsini hesablamaq mümkün olmadı.",
          session: publicSession(row),
        };
      }

      const finalRevealed = [...revealed, tile];

      const { data, error } = await supabase
        .from("web_mines_sessions")
        .update({
          revealed: finalRevealed,
          multiplier: 0,
          status: "lost",
          updated_at: Date.now(),
          finished_at: Date.now(),
        })
        .eq("id", row.id)
        .eq("user_id", userId)
        .eq("status", "active")
        .select("*")
        .single();

      if (error) {
        throw error;
      }

void sendOctosonCasinoActivity({
        userId,
        game: "mines",
        bet: Number(row.bet),
        payout: Number(settlement.payout ?? 0),
        net: Number(settlement.net ?? 0),
        multiplier: 0,
        balance: Number(
          settlement.profile?.balance ?? 0
        ),
        result: "Mina partladı.",
      }).catch((error) => {
        console.error(
          "[OCTOSON MINES DISCORD]",
          error
        );
      });

      return {
        ok: true,
        message: `Mina partladı. -${Number(
          row.cost
        ).toLocaleString("en-US")} Aura`,
        session: publicSession(
          data as MinesRow,
          true
        ),
        balance: Number(
          settlement.profile?.balance ?? 0
        ),
        net: Number(settlement.net ?? 0),
        payout: Number(settlement.payout ?? 0),
      };
    }

    /*
     * Safe tile.
     */
    const nextRevealed = [...revealed, tile].sort(
      (a, b) => a - b
    );

    const mineCount = mines.length;
    const safeCount =
      MINES_BOARD_SIZE - mineCount;

    const nextMultiplier = multiplierFor(
      nextRevealed.length,
      mineCount
    );

    /*
     * Automatically cash out after every
     * safe tile has been revealed.
     */
    if (nextRevealed.length >= safeCount) {
      const economy = await getEconomyModule();

      const payout = Math.floor(
        Number(row.bet) * nextMultiplier
      );

      const settlement =
        await economy.settleCasinoGame(userId, {
          game: "mines",
          bet: Number(row.bet),
          cost: Number(row.cost),
          payout,
          won: true,
          multiplier: nextMultiplier,
          reserved: Number(row.cost) > 0,
        });

      if (!settlement.ok) {
        return {
          ok: false,
          message:
            "Mines qazancını hesablamaq mümkün olmadı.",
          session: publicSession(row),
        };
      }

      const { data, error } = await supabase
        .from("web_mines_sessions")
        .update({
          revealed: nextRevealed,
          multiplier: nextMultiplier,
          status: "won",
          updated_at: Date.now(),
          finished_at: Date.now(),
        })
        .eq("id", row.id)
        .eq("user_id", userId)
        .eq("status", "active")
        .select("*")
        .single();

      if (error) {
        throw error;
      }

void sendOctosonCasinoActivity({
        userId,
        game: "mines",
        bet: Number(row.bet),
        payout: Number(settlement.payout ?? 0),
        net: Number(settlement.net ?? 0),
        multiplier: nextMultiplier,
        balance: Number(
          settlement.profile?.balance ?? 0
        ),
        result:
          "Bütün təhlükəsiz xanaları tapdı.",
      }).catch((error) => {
        console.error(
          "[OCTOSON MINES DISCORD]",
          error
        );
      });

      return {
        ok: true,
        message: `Bütün təhlükəsiz xanaları tapdın. +${Math.max(
          0,
          Number(settlement.net ?? 0)
        ).toLocaleString("en-US")} Aura`,
        session: publicSession(
          data as MinesRow,
          true
        ),
        balance: Number(
          settlement.profile?.balance ?? 0
        ),
        net: Number(settlement.net ?? 0),
        payout: Number(settlement.payout ?? 0),
      };
    }

    const { data, error } = await supabase
      .from("web_mines_sessions")
      .update({
        revealed: nextRevealed,
        multiplier: nextMultiplier,
        updated_at: Date.now(),
      })
      .eq("id", row.id)
      .eq("user_id", userId)
      .eq("status", "active")
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    return {
      ok: true,
      message: `Təmiz xana • ${nextMultiplier.toFixed(
        2
      )}x`,
      session: publicSession(data as MinesRow),
    };
  } catch (error) {
    console.error("[OCTOSON MINES REVEAL]", error);

    return {
      ok: false,
      message: "Xananı açmaq mümkün olmadı.",
    };
  }
}

export async function cashoutMinesAction(): Promise<MinesResult> {
  const userId = await currentUserId();

  if (!userId) {
    return {
      ok: false,
      message: "Discord sessiyası tapılmadı.",
    };
  }

  try {
    const row = await activeRow(userId);

    if (!row) {
      return {
        ok: false,
        message: "Aktiv Mines raundu yoxdur.",
      };
    }

    const revealed = numberArray(row.revealed);

    if (revealed.length === 0) {
      return {
        ok: false,
        message:
          "Qazancı götürmək üçün ən azı bir təhlükəsiz xana aç.",
        session: publicSession(row),
      };
    }

    const multiplier = Number(row.multiplier);
    const payout = Math.floor(
      Number(row.bet) * multiplier
    );

    const economy = await getEconomyModule();

    const settlement =
      await economy.settleCasinoGame(userId, {
        game: "mines",
        bet: Number(row.bet),
        cost: Number(row.cost),
        payout,
        won: multiplier > 1,
        multiplier,
        reserved: Number(row.cost) > 0,
      });

    if (!settlement.ok) {
      return {
        ok: false,
        message:
          "Mines qazancını hesablamaq mümkün olmadı.",
        session: publicSession(row),
      };
    }

    const supabase: any = getSupabaseServerClient();

    const { data, error } = await supabase
      .from("web_mines_sessions")
      .update({
        status: "won",
        updated_at: Date.now(),
        finished_at: Date.now(),
      })
      .eq("id", row.id)
      .eq("user_id", userId)
      .eq("status", "active")
      .select("*")
      .single();

    if (error) {
      throw error;
    }

const net = Number(settlement.net ?? 0);

    void sendOctosonCasinoActivity({
      userId,
      game: "mines",
      bet: Number(row.bet),
      payout: Number(settlement.payout ?? 0),
      net,
      multiplier,
      balance: Number(
        settlement.profile?.balance ?? 0
      ),
      result: `Cashout • ${multiplier.toFixed(
        2
      )}×`,
    }).catch((error) => {
      console.error(
        "[OCTOSON MINES DISCORD]",
        error
      );
    });

    return {
      ok: true,
      message:
        net >= 0
          ? `+${net.toLocaleString("en-US")} Aura götürüldü.`
          : `${net.toLocaleString("en-US")} Aura`,
      session: publicSession(
        data as MinesRow,
        true
      ),
      balance: Number(
        settlement.profile?.balance ?? 0
      ),
      net,
      payout: Number(settlement.payout ?? 0),
    };
  } catch (error) {
    console.error("[OCTOSON MINES CASHOUT]", error);

    return {
      ok: false,
      message: "Cashout zamanı xəta baş verdi.",
    };
  }
}

