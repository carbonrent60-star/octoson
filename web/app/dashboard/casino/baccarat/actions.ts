"use server";

import { sendOctosonCasinoActivity } from "@/lib/discord-server";

import { randomInt } from "node:crypto";

import { auth } from "@/auth";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";

export type BaccaratSuit =
  | "spades"
  | "hearts"
  | "diamonds"
  | "clubs";

export type BaccaratRank =
  | "A"
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "10"
  | "J"
  | "Q"
  | "K";

export type BaccaratCard = {
  rank: BaccaratRank;
  suit: BaccaratSuit;
};

export type BaccaratChoice =
  | "player"
  | "banker"
  | "tie";

export type BaccaratWinner =
  | "player"
  | "banker"
  | "tie";

export type BaccaratStatus =
  | "active"
  | "won"
  | "lost"
  | "push"
  | "cancelled";

export type BaccaratSession = {
  id: string;
  bet: number;
  cost: number;
  ticketCover: number;
  usedTicket: boolean;
  choice: BaccaratChoice;

  playerHand: BaccaratCard[];
  bankerHand: BaccaratCard[];

  playerTotal: number;
  bankerTotal: number;

  winner: BaccaratWinner | null;
  status: BaccaratStatus;

  payout: number;
  net: number;
};

export type BaccaratResult = {
  ok: boolean;
  message: string;
  session?: BaccaratSession | null;
  balance?: number;
};

type BaccaratRow = {
  id: string;
  user_id: string;

  bet: number | string;
  cost: number | string;

  ticket_cover: number | string;
  used_ticket: boolean;

  choice: BaccaratChoice;

  deck: unknown;
  player_hand: unknown;
  banker_hand: unknown;

  player_total: number | string | null;
  banker_total: number | string | null;

  winner: BaccaratWinner | null;
  status: BaccaratStatus;

  payout: number | string;
  net: number | string;

  created_at: number | string;
  updated_at: number | string;
  finished_at: number | string | null;
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
  getCasinoCooldown(
    userId: string
  ): Promise<number>;

  markCasinoPlayed(
    userId: string
  ): Promise<unknown>;

  prepareCasinoEntry(
    userId: string,
    bet: number,
    game: string,
    options: {
      reserve: boolean;
    }
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

function isCard(
  value: unknown
): value is BaccaratCard {
  if (
    !value ||
    typeof value !== "object"
  ) {
    return false;
  }

  const card =
    value as Record<string, unknown>;

  return (
    typeof card.rank === "string" &&
    typeof card.suit === "string"
  );
}

function cardArray(
  value: unknown
): BaccaratCard[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isCard);
}

function createDeck(): BaccaratCard[] {
  const suits: BaccaratSuit[] = [
    "spades",
    "hearts",
    "diamonds",
    "clubs",
  ];

  const ranks: BaccaratRank[] = [
    "A",
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "9",
    "10",
    "J",
    "Q",
    "K",
  ];

  const deck: BaccaratCard[] = [];

  for (const suit of suits) {
    for (const rank of ranks) {
      deck.push({
        rank,
        suit,
      });
    }
  }

  for (
    let i = deck.length - 1;
    i > 0;
    i -= 1
  ) {
    const j = randomInt(0, i + 1);

    [deck[i], deck[j]] = [
      deck[j],
      deck[i],
    ];
  }

  return deck;
}

function cardValue(
  card: BaccaratCard
) {
  if (card.rank === "A") {
    return 1;
  }

  if (
    card.rank === "10" ||
    card.rank === "J" ||
    card.rank === "Q" ||
    card.rank === "K"
  ) {
    return 0;
  }

  return Number(card.rank);
}

function handTotal(
  hand: BaccaratCard[]
) {
  const sum = hand.reduce(
    (total, card) =>
      total + cardValue(card),
    0
  );

  return sum % 10;
}

function shouldBankerDraw(
  bankerTotal: number,
  playerThird:
    | BaccaratCard
    | null,
  playerDrew: boolean
) {
  if (!playerDrew) {
    return bankerTotal <= 5;
  }

  if (!playerThird) {
    return bankerTotal <= 5;
  }

  const third =
    cardValue(playerThird);

  if (bankerTotal <= 2) {
    return true;
  }

  if (bankerTotal === 3) {
    return third !== 8;
  }

  if (bankerTotal === 4) {
    return (
      third >= 2 &&
      third <= 7
    );
  }

  if (bankerTotal === 5) {
    return (
      third >= 4 &&
      third <= 7
    );
  }

  if (bankerTotal === 6) {
    return (
      third === 6 ||
      third === 7
    );
  }

  return false;
}

async function currentUserId() {
  const session = await auth();

  return (
    session?.user?.discordId ??
    null
  );
}

async function activeRow(
  userId: string
) {
  const supabase: any =
    getSupabaseServerClient();

  const {
    data,
    error,
  } = await supabase
    .from("web_baccarat_sessions")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", {
      ascending: false,
    })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (
    (data as BaccaratRow | null) ??
    null
  );
}

async function latestRow(
  userId: string
) {
  const supabase: any =
    getSupabaseServerClient();

  const {
    data,
    error,
  } = await supabase
    .from("web_baccarat_sessions")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", {
      ascending: false,
    })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (
    (data as BaccaratRow | null) ??
    null
  );
}

function publicSession(
  row: BaccaratRow
): BaccaratSession {
  const playerHand =
    cardArray(row.player_hand);

  const bankerHand =
    cardArray(row.banker_hand);

  return {
    id: row.id,

    bet: Number(row.bet),
    cost: Number(row.cost),

    ticketCover: Number(
      row.ticket_cover ?? 0
    ),

    usedTicket: Boolean(
      row.used_ticket
    ),

    choice: row.choice,

    playerHand,
    bankerHand,

    playerTotal:
      row.player_total == null
        ? handTotal(playerHand)
        : Number(row.player_total),

    bankerTotal:
      row.banker_total == null
        ? handTotal(bankerHand)
        : Number(row.banker_total),

    winner: row.winner,
    status: row.status,

    payout: Number(
      row.payout ?? 0
    ),

    net: Number(
      row.net ?? 0
    ),
  };
}

function blockedMessage(
  entry: CasinoEntry
) {
  if (
    entry.reason ===
    "casino_max_bet"
  ) {
    const maxBet = Number(
      entry.restriction?.maxBet ??
        0
    );

    if (maxBet > 0) {
      return `Bu hesab üçün maksimum mərc ${maxBet.toLocaleString(
        "en-US"
      )} Aura-dır.`;
    }
  }

  if (
    entry.reason ===
    "casino_restricted"
  ) {
    return "Casino istifadən hazırda məhdudlaşdırılıb.";
  }

  return "Wallet-də kifayət qədər Aura yoxdur.";
}

function winnerLabel(
  winner: BaccaratWinner
) {
  if (winner === "player") {
    return "Oyunçu";
  }

  if (winner === "banker") {
    return "Bankir";
  }

  return "Bərabər";
}

async function markFinal(
  row: BaccaratRow,
  input: {
    deck: BaccaratCard[];
    playerHand: BaccaratCard[];
    bankerHand: BaccaratCard[];
    winner: BaccaratWinner;

    status:
      | "won"
      | "lost"
      | "push";

    payout: number;
    multiplier: number;
    won: boolean;
    message: string;
  }
): Promise<BaccaratResult> {
  const supabase: any =
    getSupabaseServerClient();

  const userId =
    row.user_id;

  const playerTotal =
    handTotal(input.playerHand);

  const bankerTotal =
    handTotal(input.bankerHand);

  const now = Date.now();

  const {
    data: claimed,
    error: claimError,
  } = await supabase
    .from("web_baccarat_sessions")
    .update({
      deck: input.deck,

      player_hand:
        input.playerHand,

      banker_hand:
        input.bankerHand,

      player_total:
        playerTotal,

      banker_total:
        bankerTotal,

      winner: input.winner,
      status: input.status,

      payout: input.payout,

      updated_at: now,
      finished_at: now,
    })
    .eq("id", row.id)
    .eq("user_id", userId)
    .eq("status", "active")
    .eq(
      "updated_at",
      Number(row.updated_at)
    )
    .select("*")
    .maybeSingle();

  if (claimError) {
    throw claimError;
  }

  if (!claimed) {
    return {
      ok: false,
      message:
        "Bu əl artıq hesablanıb.",
    };
  }

  const economy =
    await getEconomyModule();

  try {
    const settlement =
      await economy.settleCasinoGame(
        userId,
        {
          game: "baccarat",

          bet: Number(row.bet),
          cost: Number(row.cost),

          payout:
            input.payout,

          won: input.won,

          multiplier:
            input.multiplier,

          reserved:
            Number(row.cost) > 0,
        }
      );

    if (!settlement.ok) {
      throw new Error(
        settlement.reason ??
          "settlement_failed"
      );
    }

    const finalNet =
      Number(
        settlement.net ?? 0
      );

    const finalPayout =
      Number(
        settlement.payout ?? 0
      );

    const {
      data: finalRow,
      error: finalError,
    } = await supabase
      .from(
        "web_baccarat_sessions"
      )
      .update({
        payout:
          finalPayout,

        net:
          finalNet,

        updated_at:
          Date.now(),
      })
      .eq("id", row.id)
      .eq("user_id", userId)
      .select("*")
      .single();

    if (finalError) {
      throw finalError;
    }

    revalidatePath(
      "/dashboard"
    );

    revalidatePath(
      "/dashboard/casino"
    );

    revalidatePath(
      "/dashboard/casino/baccarat"
    );

    void sendOctosonCasinoActivity({
      userId,
      game: "baccarat",
      bet: Number(row.bet),
      payout: finalPayout,
      net: finalNet,
      multiplier: input.multiplier,
      balance: Number(
        settlement.profile?.balance ?? 0
      ),
      result: input.message,
    }).catch((error) => {
      console.error(
        "[OCTOSON BACCARAT DISCORD]",
        error
      );
    });

    return {
      ok: true,
      message:
        input.message,

      session:
        publicSession(
          finalRow as BaccaratRow
        ),

      balance: Number(
        settlement.profile
          ?.balance ?? 0
      ),
    };
  } catch (error) {
    console.error(
      "[OCTOSON BACCARAT SETTLE]",
      error
    );

    try {
      await economy.refundReservedCasinoBet(
        userId,
        Number(row.cost),
        "baccarat",
        Boolean(
          row.used_ticket
        )
      );

      await supabase
        .from(
          "web_baccarat_sessions"
        )
        .update({
          status:
            "cancelled",

          payout: 0,
          net: 0,

          updated_at:
            Date.now(),

          finished_at:
            Date.now(),
        })
        .eq("id", row.id)
        .eq(
          "user_id",
          userId
        );
    } catch (
      refundError
    ) {
      console.error(
        "[OCTOSON BACCARAT REFUND]",
        refundError
      );
    }

    return {
      ok: false,
      message:
        "Baccarat hesablanarkən xəta oldu. Mərc geri qaytarıldı.",
    };
  }
}

export async function getLatestBaccaratAction(): Promise<BaccaratResult> {
  const userId =
    await currentUserId();

  if (!userId) {
    return {
      ok: false,
      message:
        "Discord sessiyası tapılmadı.",
    };
  }

  try {
    const row =
      await latestRow(userId);

    return {
      ok: true,

      message: row
        ? "Son Baccarat əli yükləndi."
        : "Baccarat əli yoxdur.",

      session: row
        ? publicSession(row)
        : null,
    };
  } catch (error) {
    console.error(
      "[OCTOSON BACCARAT LOAD]",
      error
    );

    return {
      ok: false,
      message:
        "Baccarat əlini yükləmək mümkün olmadı.",
    };
  }
}

export async function startBaccaratAction(
  rawBet: number,
  rawChoice: BaccaratChoice
): Promise<BaccaratResult> {
  const userId =
    await currentUserId();

  if (!userId) {
    return {
      ok: false,
      message:
        "Discord sessiyası tapılmadı.",
    };
  }

  const bet =
    validBet(rawBet);

  if (!bet) {
    return {
      ok: false,
      message:
        "Düzgün mərc məbləği daxil et.",
    };
  }

  if (
    ![
      "player",
      "banker",
      "tie",
    ].includes(rawChoice)
  ) {
    return {
      ok: false,
      message:
        "Düzgün seçim et.",
    };
  }

  const choice =
    rawChoice;

  const supabase: any =
    getSupabaseServerClient();

  const economy =
    await getEconomyModule();

  try {
    const existing =
      await activeRow(userId);

    if (existing) {
      return {
        ok: false,
        message:
          "Aktiv Baccarat əli artıq var.",
        session:
          publicSession(existing),
      };
    }

    const cooldownMs =
      await economy.getCasinoCooldown(
        userId
      );

    if (cooldownMs > 0) {
      return {
        ok: false,
        message: `Növbəti oyun üçün ${Math.ceil(
          cooldownMs / 1000
        )} saniyə gözlə.`,
      };
    }

    const entry =
      await economy.prepareCasinoEntry(
        userId,
        bet,
        "baccarat",
        {
          reserve: true,
        }
      );

    if (!entry.ok) {
      return {
        ok: false,

        message:
          blockedMessage(entry),

        balance: Number(
          entry.profile?.balance ??
            0
        ),
      };
    }

    const deck =
      createDeck();

    const playerHand: BaccaratCard[] =
      [];

    const bankerHand: BaccaratCard[] =
      [];

    // Real Baccarat dealing order:
    // Player, Banker, Player, Banker.
    playerHand.push(
      deck.shift()!
    );

    bankerHand.push(
      deck.shift()!
    );

    playerHand.push(
      deck.shift()!
    );

    bankerHand.push(
      deck.shift()!
    );

    const now =
      Date.now();

    let inserted:
      | BaccaratRow
      | null = null;

    try {
      const {
        data,
        error,
      } = await supabase
        .from(
          "web_baccarat_sessions"
        )
        .insert({
          user_id:
            userId,

          bet,

          cost:
            entry.cost,

          ticket_cover:
            entry.ticketCover,

          used_ticket:
            entry.usedTicket,

          choice,

          deck,

          player_hand:
            playerHand,

          banker_hand:
            bankerHand,

          player_total:
            handTotal(
              playerHand
            ),

          banker_total:
            handTotal(
              bankerHand
            ),

          winner: null,
          status: "active",

          payout: 0,
          net: 0,

          created_at: now,
          updated_at: now,
          finished_at: null,
        })
        .select("*")
        .single();

      if (error) {
        throw error;
      }

      inserted =
        data as BaccaratRow;

      await economy.markCasinoPlayed(
        userId
      );
    } catch (error) {
      await economy.refundReservedCasinoBet(
        userId,
        entry.cost,
        "baccarat",
        entry.usedTicket
      );

      throw error;
    }

    let playerTotal =
      handTotal(playerHand);

    let bankerTotal =
      handTotal(bankerHand);

    const natural =
      playerTotal >= 8 ||
      bankerTotal >= 8;

    let playerDrew =
      false;

    let playerThird:
      | BaccaratCard
      | null = null;

    if (!natural) {
      if (
        playerTotal <= 5
      ) {
        const card =
          deck.shift();

        if (card) {
          playerHand.push(
            card
          );

          playerThird =
            card;

          playerDrew =
            true;

          playerTotal =
            handTotal(
              playerHand
            );
        }
      }

      bankerTotal =
        handTotal(
          bankerHand
        );

      if (
        shouldBankerDraw(
          bankerTotal,
          playerThird,
          playerDrew
        )
      ) {
        const card =
          deck.shift();

        if (card) {
          bankerHand.push(
            card
          );

          bankerTotal =
            handTotal(
              bankerHand
            );
        }
      }
    }

    playerTotal =
      handTotal(playerHand);

    bankerTotal =
      handTotal(bankerHand);

    let winner:
      BaccaratWinner;

    if (
      playerTotal >
      bankerTotal
    ) {
      winner =
        "player";
    } else if (
      bankerTotal >
      playerTotal
    ) {
      winner =
        "banker";
    } else {
      winner =
        "tie";
    }

    let status:
      | "won"
      | "lost"
      | "push";

    let payout = 0;
    let multiplier = 0;
    let won = false;

    if (
      winner === "tie" &&
      choice !== "tie"
    ) {
      // Standard Baccarat:
      // Player / Banker bets push on Tie.
      status = "push";

      payout =
        entry.cost;

      multiplier = 1;
    } else if (
      winner === choice
    ) {
      status = "won";
      won = true;

      if (
        choice === "player"
      ) {
        multiplier = 1.9;
      } else if (
        choice === "banker"
      ) {
        multiplier = 1.85;
      } else {
        multiplier = 8;
      }

      payout =
        Math.floor(
          bet *
            multiplier
        );
    } else {
      status = "lost";
      payout = 0;
      multiplier = 0;
    }

    const label =
      winnerLabel(winner);

    let message: string;

    if (
      status === "push"
    ) {
      message =
        `Bərabər • ${playerTotal}-${bankerTotal} • Mərc qaytarıldı`;
    } else if (
      status === "won"
    ) {
      message =
        `${label} qalib gəldi • ${playerTotal}-${bankerTotal}`;
    } else {
      message =
        `${label} qalib gəldi • ${playerTotal}-${bankerTotal}`;
    }

    return markFinal(
      inserted,
      {
        deck,
        playerHand,
        bankerHand,

        winner,
        status,

        payout,
        multiplier,
        won,
        message,
      }
    );
  } catch (error) {
    console.error(
      "[OCTOSON BACCARAT START]",
      error
    );

    return {
      ok: false,
      message:
        "Baccarat əlini başlatmaq mümkün olmadı.",
    };
  }
}
