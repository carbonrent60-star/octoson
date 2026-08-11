"use server";

import { sendOctosonCasinoActivity } from "@/lib/discord-server";

import { randomInt } from "node:crypto";

import { auth } from "@/auth";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";

export type BlackjackSuit =
  | "spades"
  | "hearts"
  | "diamonds"
  | "clubs";

export type BlackjackRank =
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

export type BlackjackCard = {
  rank: BlackjackRank;
  suit: BlackjackSuit;
};

export type BlackjackStatus =
  | "active"
  | "won"
  | "lost"
  | "push"
  | "blackjack"
  | "cancelled";

export type BlackjackSession = {
  id: string;
  bet: number;
  cost: number;
  ticketCover: number;
  usedTicket: boolean;
  playerHand: BlackjackCard[];
  dealerHand: (BlackjackCard | null)[];
  playerTotal: number;
  dealerTotal?: number;
  status: BlackjackStatus;
  payout: number;
  net: number;
  balance?: number;
};

export type BlackjackResult = {
  ok: boolean;
  message: string;
  session?: BlackjackSession | null;
  balance?: number;
};

type BlackjackRow = {
  id: string;
  user_id: string;
  bet: number | string;
  cost: number | string;
  ticket_cover: number | string;
  used_ticket: boolean;
  deck: unknown;
  player_hand: unknown;
  dealer_hand: unknown;
  status: BlackjackStatus;
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

function isCard(value: unknown): value is BlackjackCard {
  if (!value || typeof value !== "object") {
    return false;
  }

  const card = value as Record<string, unknown>;

  return (
    typeof card.rank === "string" &&
    typeof card.suit === "string"
  );
}

function cardArray(value: unknown): BlackjackCard[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isCard);
}

function createDeck(): BlackjackCard[] {
  const suits: BlackjackSuit[] = [
    "spades",
    "hearts",
    "diamonds",
    "clubs",
  ];

  const ranks: BlackjackRank[] = [
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

  const deck: BlackjackCard[] = [];

  for (const suit of suits) {
    for (const rank of ranks) {
      deck.push({
        rank,
        suit,
      });
    }
  }

  for (let i = deck.length - 1; i > 0; i -= 1) {
    const j = randomInt(0, i + 1);

    [deck[i], deck[j]] = [
      deck[j],
      deck[i],
    ];
  }

  return deck;
}

function handValue(hand: BlackjackCard[]) {
  let total = 0;
  let aces = 0;

  for (const card of hand) {
    if (card.rank === "A") {
      total += 11;
      aces += 1;
    } else if (
      card.rank === "K" ||
      card.rank === "Q" ||
      card.rank === "J"
    ) {
      total += 10;
    } else {
      total += Number(card.rank);
    }
  }

  while (total > 21 && aces > 0) {
    total -= 10;
    aces -= 1;
  }

  return total;
}

function naturalBlackjack(hand: BlackjackCard[]) {
  return (
    hand.length === 2 &&
    handValue(hand) === 21
  );
}

async function currentUserId() {
  const session = await auth();
  return session?.user?.discordId ?? null;
}

async function activeRow(userId: string) {
  const supabase: any =
    getSupabaseServerClient();

  const { data, error } = await supabase
    .from("web_blackjack_sessions")
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

  return (data as BlackjackRow | null) ?? null;
}

function publicSession(
  row: BlackjackRow,
  revealDealer = false
): BlackjackSession {
  const playerHand =
    cardArray(row.player_hand);

  const dealerFull =
    cardArray(row.dealer_hand);

  const dealerHand:
    (BlackjackCard | null)[] =
    revealDealer || row.status !== "active"
      ? dealerFull
      : dealerFull.map((card, index) =>
          index === 1 ? null : card
        );

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
    playerHand,
    dealerHand,
    playerTotal: handValue(playerHand),
    ...(revealDealer ||
    row.status !== "active"
      ? {
          dealerTotal:
            handValue(dealerFull),
        }
      : {}),
    status: row.status,
    payout: Number(row.payout ?? 0),
    net: Number(row.net ?? 0),
  };
}

function blockedMessage(entry: CasinoEntry) {
  if (entry.reason === "casino_max_bet") {
    const maxBet = Number(
      entry.restriction?.maxBet ?? 0
    );

    if (maxBet > 0) {
      return `Bu hesab üçün maksimum mərc ${maxBet.toLocaleString(
        "en-US"
      )} Aura-dır.`;
    }
  }

  if (
    entry.reason === "casino_restricted"
  ) {
    return "Casino istifadən hazırda məhdudlaşdırılıb.";
  }

  return "Wallet-də kifayət qədər Aura yoxdur.";
}

async function markFinal(
  row: BlackjackRow,
  input: {
    status:
      | "won"
      | "lost"
      | "push"
      | "blackjack";
    deck: BlackjackCard[];
    playerHand: BlackjackCard[];
    dealerHand: BlackjackCard[];
    payout: number;
    multiplier: number;
    won: boolean;
    message: string;
  }
): Promise<BlackjackResult> {
  const userId = row.user_id;
  const supabase: any =
    getSupabaseServerClient();

  const now = Date.now();

  const {
    data: claimed,
    error: claimError,
  } = await supabase
    .from("web_blackjack_sessions")
    .update({
      deck: input.deck,
      player_hand: input.playerHand,
      dealer_hand: input.dealerHand,
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
        "Bu raund artıq yenilənib. Səhifəni yenilə.",
    };
  }

  const economy =
    await getEconomyModule();

  try {
    const settlement =
      await economy.settleCasinoGame(
        userId,
        {
          game: "blackjack",
          bet: Number(row.bet),
          cost: Number(row.cost),
          payout: input.payout,
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

    const finalNet = Number(
      settlement.net ?? 0
    );

    const finalPayout = Number(
      settlement.payout ?? 0
    );

    const {
      data: finalRow,
      error: finalError,
    } = await supabase
      .from("web_blackjack_sessions")
      .update({
        payout: finalPayout,
        net: finalNet,
        updated_at: Date.now(),
      })
      .eq("id", row.id)
      .eq("user_id", userId)
      .select("*")
      .single();

    if (finalError) {
      throw finalError;
    }

revalidatePath(
      "/dashboard/casino/blackjack"
    );

    void sendOctosonCasinoActivity({
      userId,
      game: "blackjack",
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
        "[OCTOSON BLACKJACK DISCORD]",
        error
      );
    });

    return {
      ok: true,
      message: input.message,
      session: publicSession(
        finalRow as BlackjackRow,
        true
      ),
      balance: Number(
        settlement.profile?.balance ?? 0
      ),
    };
  } catch (error) {
    console.error(
      "[OCTOSON BLACKJACK SETTLE]",
      error
    );

    try {
      await economy.refundReservedCasinoBet(
        userId,
        Number(row.cost),
        "blackjack",
        Boolean(row.used_ticket)
      );

      await supabase
        .from(
          "web_blackjack_sessions"
        )
        .update({
          status: "cancelled",
          payout: 0,
          net: 0,
          updated_at: Date.now(),
          finished_at: Date.now(),
        })
        .eq("id", row.id)
        .eq("user_id", userId);
    } catch (refundError) {
      console.error(
        "[OCTOSON BLACKJACK REFUND]",
        refundError
      );
    }

    return {
      ok: false,
      message:
        "Blackjack hesablanarkən xəta oldu. Mərc geri qaytarıldı.",
    };
  }
}

async function finishDealer(
  row: BlackjackRow,
  playerHand: BlackjackCard[],
  deck: BlackjackCard[],
  dealerHand: BlackjackCard[]
) {
  const playerTotal =
    handValue(playerHand);

  while (
    handValue(dealerHand) < 17 &&
    deck.length > 0
  ) {
    const card = deck.shift();

    if (card) {
      dealerHand.push(card);
    }
  }

  const dealerTotal =
    handValue(dealerHand);

  if (dealerTotal > 21) {
    return markFinal(row, {
      status: "won",
      deck,
      playerHand,
      dealerHand,
      payout:
        Number(row.bet) * 2,
      multiplier: 2,
      won: true,
      message:
        "Dealer bust etdi. Qələbə!",
    });
  }

  if (playerTotal > dealerTotal) {
    return markFinal(row, {
      status: "won",
      deck,
      playerHand,
      dealerHand,
      payout:
        Number(row.bet) * 2,
      multiplier: 2,
      won: true,
      message: "Əlin daha güclüdür.",
    });
  }

  if (playerTotal < dealerTotal) {
    return markFinal(row, {
      status: "lost",
      deck,
      playerHand,
      dealerHand,
      payout: 0,
      multiplier: 0,
      won: false,
      message:
        "Dealer daha yüksək əl topladı.",
    });
  }

  return markFinal(row, {
    status: "push",
    deck,
    playerHand,
    dealerHand,
    payout: Number(row.cost),
    multiplier: 1,
    won: false,
    message: "Push — mərc qaytarıldı.",
  });
}

export async function getActiveBlackjackAction(): Promise<BlackjackResult> {
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
      await activeRow(userId);

    return {
      ok: true,
      message: row
        ? "Aktiv Blackjack raundu tapıldı."
        : "Aktiv Blackjack raundu yoxdur.",
      session: row
        ? publicSession(row)
        : null,
    };
  } catch (error) {
    console.error(
      "[OCTOSON BLACKJACK LOAD]",
      error
    );

    return {
      ok: false,
      message:
        "Blackjack raundunu yükləmək mümkün olmadı.",
    };
  }
}

export async function startBlackjackAction(
  rawBet: number
): Promise<BlackjackResult> {
  const userId =
    await currentUserId();

  if (!userId) {
    return {
      ok: false,
      message:
        "Discord sessiyası tapılmadı.",
    };
  }

  const bet = validBet(rawBet);

  if (!bet) {
    return {
      ok: false,
      message:
        "Düzgün mərc məbləği daxil et.",
    };
  }

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
          "Əvvəlcə aktiv Blackjack raundunu tamamla.",
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
        "blackjack",
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
          entry.profile?.balance ?? 0
        ),
      };
    }

    const deck = createDeck();

    const playerHand: BlackjackCard[] =
      [];

    const dealerHand: BlackjackCard[] =
      [];

    playerHand.push(
      deck.shift()!,
      deck.shift()!
    );

    dealerHand.push(
      deck.shift()!,
      deck.shift()!
    );

    const now = Date.now();

    let inserted:
      | BlackjackRow
      | null = null;

    try {
      const {
        data,
        error,
      } = await supabase
        .from(
          "web_blackjack_sessions"
        )
        .insert({
          user_id: userId,
          bet,
          cost: entry.cost,
          ticket_cover:
            entry.ticketCover,
          used_ticket:
            entry.usedTicket,
          deck,
          player_hand:
            playerHand,
          dealer_hand:
            dealerHand,
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
        data as BlackjackRow;

    } catch (error) {
      await economy.refundReservedCasinoBet(
        userId,
        entry.cost,
        "blackjack",
        entry.usedTicket
      );

      throw error;
    }

    const playerNatural =
      naturalBlackjack(playerHand);

    const dealerNatural =
      naturalBlackjack(dealerHand);

    if (
      playerNatural &&
      dealerNatural
    ) {
      return markFinal(inserted, {
        status: "push",
        deck,
        playerHand,
        dealerHand,
        payout: entry.cost,
        multiplier: 1,
        won: false,
        message:
          "Hər iki tərəfdə Blackjack. Push.",
      });
    }

    if (playerNatural) {
      return markFinal(inserted, {
        status: "blackjack",
        deck,
        playerHand,
        dealerHand,
        payout: Math.floor(
          bet * 2.5
        ),
        multiplier: 2.5,
        won: true,
        message:
          "BLACKJACK! 3:2 qazanc.",
      });
    }

    if (dealerNatural) {
      return markFinal(inserted, {
        status: "lost",
        deck,
        playerHand,
        dealerHand,
        payout: 0,
        multiplier: 0,
        won: false,
        message:
          "Dealer Blackjack açdı.",
      });
    }

    revalidatePath(
      "/dashboard/casino/blackjack"
    );
return {
      ok: true,
      message:
        "Kartlar paylandı.",
      session:
        publicSession(inserted),
      balance: Number(
        entry.profile?.balance ?? 0
      ),
    };
  } catch (error) {
    console.error(
      "[OCTOSON BLACKJACK START]",
      error
    );

    return {
      ok: false,
      message:
        "Blackjack raundunu başlatmaq mümkün olmadı.",
    };
  }
}

export async function hitBlackjackAction(): Promise<BlackjackResult> {
  const userId =
    await currentUserId();

  if (!userId) {
    return {
      ok: false,
      message:
        "Discord sessiyası tapılmadı.",
    };
  }

  const supabase: any =
    getSupabaseServerClient();

  try {
    const row =
      await activeRow(userId);

    if (!row) {
      return {
        ok: false,
        message:
          "Aktiv Blackjack raundu yoxdur.",
      };
    }

    const deck =
      cardArray(row.deck);

    const playerHand =
      cardArray(row.player_hand);

    const dealerHand =
      cardArray(row.dealer_hand);

    const nextCard =
      deck.shift();

    if (!nextCard) {
      return {
        ok: false,
        message:
          "Deck boşdur.",
      };
    }

    playerHand.push(nextCard);

    const total =
      handValue(playerHand);

    if (total > 21) {
      return markFinal(row, {
        status: "lost",
        deck,
        playerHand,
        dealerHand,
        payout: 0,
        multiplier: 0,
        won: false,
        message: `Bust — ${total}.`,
      });
    }

    if (total === 21) {
      return finishDealer(
        row,
        playerHand,
        deck,
        dealerHand
      );
    }

    const now = Date.now();

    const {
      data,
      error,
    } = await supabase
      .from(
        "web_blackjack_sessions"
      )
      .update({
        deck,
        player_hand:
          playerHand,
        updated_at: now,
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

    if (error) {
      throw error;
    }

    if (!data) {
      return {
        ok: false,
        message:
          "Raund artıq yenilənib. Bir an gözlə.",
      };
    }

    return {
      ok: true,
      message: `${nextCard.rank} çəkildi • ${total}`,
      session: publicSession(
        data as BlackjackRow
      ),
    };
  } catch (error) {
    console.error(
      "[OCTOSON BLACKJACK HIT]",
      error
    );

    return {
      ok: false,
      message:
        "Kart çəkmək mümkün olmadı.",
    };
  }
}

export async function standBlackjackAction(): Promise<BlackjackResult> {
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
      await activeRow(userId);

    if (!row) {
      return {
        ok: false,
        message:
          "Aktiv Blackjack raundu yoxdur.",
      };
    }

    return finishDealer(
      row,
      cardArray(row.player_hand),
      cardArray(row.deck),
      cardArray(row.dealer_hand)
    );
  } catch (error) {
    console.error(
      "[OCTOSON BLACKJACK STAND]",
      error
    );

    return {
      ok: false,
      message:
        "Stand əməliyyatı zamanı xəta oldu.",
    };
  }
}
