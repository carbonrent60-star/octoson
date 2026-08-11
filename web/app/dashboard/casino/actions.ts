"use server";

import { sendOctosonCasinoActivity } from "@/lib/discord-server";

import { auth } from "@/auth";
export type CasinoGame =
  | "coinflip"
  | "dice"
  | "roulette"
  | "crash"
  | "wheel"
  | "rps"
  | "baccarat"
  | "poker"
  | "horse"
  | "penalty"
  | "lottery"
  | "jackpot"
  | "slots"
  | "risk"
  | "tower"
  | "higherlower";

export type CasinoPlayInput = {
  game: CasinoGame;
  bet: number;
  choice?: string;
  cashout?: number;
};

export type CasinoPlayResult = {
  ok: boolean;
  message: string;
  title?: string;
  description?: string;
  multiplier?: number;
  net?: number;
  payout?: number;
  balance?: number;
  won?: boolean;
  cooldownMs?: number;
  usedTicket?: boolean;
  ticketCover?: number;
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
  boosterEffect?: unknown;
  balanceBefore?: number;
  balanceAfter?: number;
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
    "../../../../src/economy.js"
  ) as unknown as Promise<CasinoEconomyModule>;
}

const allowedGames = new Set<CasinoGame>([
  "coinflip",
  "dice",
  "roulette",
  "crash",
  "wheel",
  "rps",
  "baccarat",
  "poker",
  "horse",
  "penalty",
  "lottery",
  "jackpot",
  "slots",
  "risk",
  "tower",
  "higherlower",
]);

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

function pick<T>(values: T[]): T {
  return values[Math.floor(Math.random() * values.length)];
}

function resolveOutcome(input: CasinoPlayInput) {
  const { game } = input;
  const choice = String(input.choice ?? "");

  if (game === "coinflip") {
    if (!["heads", "tails"].includes(choice)) {
      throw new Error("invalid_choice");
    }

    const landed =
      Math.random() < 0.48
        ? choice
        : choice === "heads"
          ? "tails"
          : "heads";

    const won = landed === choice;

    return {
      title: "Sikkə atışı",
      description:
        `Seçim: ${choice === "heads" ? "Üz" : "Arxa"} • ` +
        `Düşdü: ${landed === "heads" ? "Üz" : "Arxa"}`,
      multiplier: won ? 1.95 : 0,
      won,
    };
  }

  if (game === "dice") {
    const player = 1 + Math.floor(Math.random() * 6);
    const house = 1 + Math.floor(Math.random() * 6);

    const multiplier =
      player > house
        ? 1.8
        : player === house
          ? 0.75
          : 0;

    return {
      title: "Zər oyunu",
      description: `Sən: ${player} • Sistem: ${house}`,
      multiplier,
      won: player > house,
    };
  }

  if (game === "roulette") {
    if (!["red", "black"].includes(choice)) {
      throw new Error("invalid_choice");
    }

    const roll = Math.floor(Math.random() * 37);

    const landed =
      roll === 0
        ? "green"
        : roll % 2 === 0
          ? "black"
          : "red";

    const won = landed === choice;

    const labels: Record<string, string> = {
      red: "Qırmızı",
      black: "Qara",
      green: "Yaşıl",
    };

    return {
      title: "Rulet",
      description:
        `Seçim: ${labels[choice]} • ` +
        `Düşdü: ${labels[landed]} ${roll}`,
      multiplier: won ? 1.95 : 0,
      won,
    };
  }

  if (game === "crash") {
    const cashout = Number(input.cashout);

    if (
      !Number.isFinite(cashout) ||
      cashout < 1.1 ||
      cashout > 10
    ) {
      throw new Error("invalid_cashout");
    }

    const crashAt = Math.max(
      1,
      Number((1 / Math.random()).toFixed(2))
    );

    const survived = cashout <= crashAt;

    return {
      title: "Crash",
      description:
        `Çıxış: ${cashout.toFixed(2)}x • ` +
        `Crash: ${crashAt.toFixed(2)}x`,
      multiplier: survived ? cashout * 0.92 : 0,
      won: survived,
    };
  }

  if (game === "wheel") {
    const slices = [0, 0, 0.4, 0.8, 1.2, 2, 2.4];
    const multiplier = pick(slices);

    return {
      title: "Lucky Wheel",
      description:
        `Çarx ${multiplier.toFixed(2)}x üzərində dayandı.`,
      multiplier,
      won: multiplier > 1,
    };
  }

  if (game === "rps") {
    if (
      !["rock", "paper", "scissors"].includes(choice)
    ) {
      throw new Error("invalid_choice");
    }

    const house = pick([
      "rock",
      "paper",
      "scissors",
    ]);

    const won =
      (choice === "rock" && house === "scissors") ||
      (choice === "paper" && house === "rock") ||
      (choice === "scissors" && house === "paper");

    const tie = choice === house;

    const labels: Record<string, string> = {
      rock: "Daş",
      paper: "Kağız",
      scissors: "Qayçı",
    };

    return {
      title: "Daş Kağız Qayçı",
      description:
        `Sən: ${labels[choice]} • ` +
        `Sistem: ${labels[house]}`,
      multiplier: won ? 1.8 : tie ? 1 : 0,
      won,
    };
  }

  if (game === "baccarat") {
    if (
      !["player", "banker", "tie"].includes(choice)
    ) {
      throw new Error("invalid_choice");
    }

    const player = Math.floor(Math.random() * 10);
    const banker = Math.floor(Math.random() * 10);

    const winner =
      player === banker
        ? "tie"
        : player > banker
          ? "player"
          : "banker";

    const multipliers: Record<string, number> = {
      player: 1.9,
      banker: 1.85,
      tie: 8,
    };

    const won = winner === choice;

    return {
      title: "Baccarat",
      description:
        `Oyunçu: ${player} • Bankir: ${banker}`,
      multiplier: won ? multipliers[choice] : 0,
      won,
    };
  }

  if (game === "poker") {
    const hands = [
      { name: "Yüksək kart", multiplier: 0 },
      { name: "Cüt", multiplier: 1.2 },
      { name: "İki cüt", multiplier: 1.8 },
      { name: "Üç eyni", multiplier: 2.6 },
      { name: "Straight", multiplier: 4 },
      { name: "Flush", multiplier: 5 },
    ];

    const index = Math.min(
      hands.length - 1,
      Math.floor(
        Math.random() ** 2.4 * hands.length
      )
    );

    const hand = hands[index];

    return {
      title: "Poker",
      description: `Əl açıldı: ${hand.name}`,
      multiplier: hand.multiplier,
      won: hand.multiplier > 1,
    };
  }

  if (game === "horse") {
    const horse = Number(choice);

    if (
      !Number.isInteger(horse) ||
      horse < 1 ||
      horse > 6
    ) {
      throw new Error("invalid_choice");
    }

    const winner =
      1 + Math.floor(Math.random() * 6);

    const won = horse === winner;

    return {
      title: "At yarışı",
      description:
        `Sənin atın: #${horse} • Qalib: #${winner}`,
      multiplier: won ? 5 : 0,
      won,
    };
  }

  if (game === "penalty") {
    if (
      !["left", "center", "right"].includes(choice)
    ) {
      throw new Error("invalid_choice");
    }

    const keeper = pick([
      "left",
      "center",
      "right",
    ]);

    const won = choice !== keeper;

    const labels: Record<string, string> = {
      left: "Sol",
      center: "Orta",
      right: "Sağ",
    };

    return {
      title: "Penalti",
      description:
        `Zərbə: ${labels[choice]} • ` +
        `Qapıçı: ${labels[keeper]}`,
      multiplier: won ? 1.35 : 0,
      won,
    };
  }


  if (game === "slots") {
    const symbols = [
      "Saç",
      "Dəri",
      "Fit",
      "Duruş",
      "Foto",
      "Ətir",
    ];

    const reels = [
      pick(symbols),
      pick(symbols),
      pick(symbols),
    ];

    const [a, b, c] = reels;

    const triple =
      a === b && b === c;

    const pair =
      !triple &&
      (a === b || a === c || b === c);

    const multiplier =
      triple ? 5 : pair ? 1.7 : 0;

    return {
      title: "Slots",
      description:
        `Reels: ${a} | ${b} | ${c}`,
      multiplier,
      won: multiplier > 1,
    };
  }

  if (game === "risk") {
    if (
      !["safe", "balanced", "bold"].includes(choice)
    ) {
      throw new Error("invalid_choice");
    }

    const configs = {
      safe: {
        label: "Safe",
        chance: 0.64,
        payout: 1.42,
      },
      balanced: {
        label: "Balanced",
        chance: 0.44,
        payout: 2,
      },
      bold: {
        label: "Bold",
        chance: 0.24,
        payout: 3.7,
      },
    } as const;

    const config =
      configs[
        choice as keyof typeof configs
      ];

    const roll = Math.random();
    const won = roll < config.chance;

    return {
      title: "Risk",
      description:
        `${config.label} • ` +
        `${Math.round(config.chance * 100)}% şans • ` +
        `${config.payout.toFixed(2)}x`,
      multiplier: won
        ? config.payout
        : 0,
      won,
    };
  }

  if (game === "tower") {
    const target = Number(choice);

    if (
      !Number.isInteger(target) ||
      target < 1 ||
      target > 6
    ) {
      throw new Error("invalid_choice");
    }

    let reached = 0;

    for (
      let floor = 1;
      floor <= target;
      floor += 1
    ) {
      /*
       * Discord Tower starts around 74% and becomes
       * harder as the player climbs.
       */
      const chance =
        Math.max(
          0.38,
          0.74 - (floor - 1) * 0.06
        );

      if (Math.random() >= chance) {
        break;
      }

      reached = floor;
    }

    const won = reached >= target;

    const multiplier =
      won
        ? target === 6
          ? 4
          : Number(
              (
                1 +
                target * 0.42
              ).toFixed(2)
            )
        : 0;

    return {
      title: "Tower",
      description:
        won
          ? `Hədəf: ${target} • Çatdın: ${reached} • Qüllə keçildi`
          : `Hədəf: ${target} • Çatdın: ${reached} • Qüllə dağıldı`,
      multiplier,
      won,
    };
  }

  if (game === "higherlower") {
    if (
      !["higher", "lower"].includes(choice)
    ) {
      throw new Error("invalid_choice");
    }

    /*
     * Web single-round variant:
     * both cards are server generated and revealed in order.
     * Ace = 14.
     */
    const first =
      2 + Math.floor(Math.random() * 13);

    const second =
      2 + Math.floor(Math.random() * 13);

    const tie = first === second;

    const won =
      choice === "higher"
        ? second > first
        : second < first;

    const multiplier =
      tie
        ? 1
        : won
          ? 1.85
          : 0;

    const cardLabel = (value: number) => {
      if (value === 14) return "A";
      if (value === 13) return "K";
      if (value === 12) return "Q";
      if (value === 11) return "J";
      return String(value);
    };

    return {
      title: "Higher / Lower",
      description:
        `İlk kart: ${cardLabel(first)} • ` +
        `Növbəti: ${cardLabel(second)} • ` +
        `Seçim: ${
          choice === "higher"
            ? "Yuxarı"
            : "Aşağı"
        }`,
      multiplier,
      won,
    };
  }

  if (game === "lottery") {
    const hit = Math.random() < 0.12;

    return {
      title: "Lotereya",
      description: hit
        ? "Biletin mükafatlı çıxdı."
        : "Bu bilet boş çıxdı.",
      multiplier: hit ? 8 : 0,
      won: hit,
    };
  }

  if (game === "jackpot") {
    const jackpot = Math.random() < 0.025;

    const smallWin =
      !jackpot && Math.random() < 0.15;

    return {
      title: "Jackpot",
      description: jackpot
        ? "Jackpot vuruldu."
        : smallWin
          ? "Kiçik jackpot payı düşdü."
          : "Pot böyüdü, bu raund boş keçdi.",
      multiplier: jackpot
        ? 25
        : smallWin
          ? 2
          : 0,
      won: jackpot || smallWin,
    };
  }

  throw new Error("invalid_game");
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

export async function playCasinoAction(
  input: CasinoPlayInput
): Promise<CasinoPlayResult> {
  const session = await auth();

  if (!session?.user?.discordId) {
    return {
      ok: false,
      message: "Discord sessiyası tapılmadı.",
    };
  }

  if (!allowedGames.has(input.game)) {
    return {
      ok: false,
      message: "Bu oyun tanınmadı.",
    };
  }

  const bet = validBet(input.bet);

  if (!bet) {
    return {
      ok: false,
      message: "Düzgün mərc məbləği daxil et.",
    };
  }

  const economy = await getEconomyModule();
  const userId = session.user.discordId;

  const cooldownMs =
    await economy.getCasinoCooldown(userId);

  if (cooldownMs > 0) {
    return {
      ok: false,
      message: `Növbəti oyun üçün ${Math.ceil(
        cooldownMs / 1000
      )} saniyə gözlə.`,
      cooldownMs,
    };
  }

  /*
   * Reserve first.
   * This is the same economy path used by the Discord bot.
   */
  const entry = await economy.prepareCasinoEntry(
    userId,
    bet,
    input.game,
    { reserve: true }
  );

  if (!entry.ok) {
    return {
      ok: false,
      message: blockedMessage(entry),
    };
  }

  let settled = false;

  try {
    /*
     * Mark immediately after the reservation.
     * It prevents normal repeated web requests from bypassing
     * Octoson's existing casino cooldown.
     */

    const outcome = resolveOutcome({
      ...input,
      bet,
    });

    const payout = Math.floor(
      bet * outcome.multiplier
    );

    const settlement =
      await economy.settleCasinoGame(userId, {
        game: input.game,
        bet,
        cost: entry.cost,
        payout,
        won: outcome.won,
        multiplier: outcome.multiplier,
        reserved: entry.cost > 0,
      });

    if (!settlement.ok) {
      if (entry.cost > 0 || entry.usedTicket) {
        await economy.refundReservedCasinoBet(
          userId,
          entry.cost,
          input.game,
          entry.usedTicket
        );
      }

      return {
        ok: false,
        message:
          "Casino nəticəsini hesablamaq mümkün olmadı. Mərc geri qaytarıldı.",
      };
    }

    settled = true;

const net = Number(settlement.net ?? 0);
    const balance = Number(
      settlement.profile?.balance ?? 0
    );

    // Discord activity is intentionally fire-and-forget.
    // A Discord failure must never affect casino settlement.
    void sendOctosonCasinoActivity({
      userId,
      game: input.game,
      bet,
      payout: Number(settlement.payout ?? 0),
      net,
      multiplier: outcome.multiplier,
      balance,
      result: outcome.description,
    }).catch((error) => {
      console.error(
        "[OCTOSON CASINO DISCORD]",
        error
      );
    });

    return {
      ok: true,
      message:
        net > 0
          ? `+${net.toLocaleString("en-US")} Aura`
          : net < 0
            ? `-${Math.abs(net).toLocaleString(
                "en-US"
              )} Aura`
            : "Balans qorundu",
      title: outcome.title,
      description: outcome.description,
      multiplier: outcome.multiplier,
      net,
      payout: Number(settlement.payout ?? 0),
      balance,
      won: net > 0,
      usedTicket: entry.usedTicket,
      ticketCover: entry.ticketCover,
    };
  } catch (error) {
    console.error(
      "[OCTOSON WEB CASINO]",
      error
    );

    if (
      !settled &&
      (entry.cost > 0 || entry.usedTicket)
    ) {
      try {
        await economy.refundReservedCasinoBet(
          userId,
          entry.cost,
          input.game,
          entry.usedTicket
        );
      } catch (refundError) {
        console.error(
          "[OCTOSON WEB CASINO REFUND]",
          refundError
        );
      }
    }

    if (
      error instanceof Error &&
      error.message === "invalid_cashout"
    ) {
      return {
        ok: false,
        message:
          "Crash çıxışı 1.10x ilə 10.00x arasında olmalıdır.",
      };
    }

    if (
      error instanceof Error &&
      error.message === "invalid_choice"
    ) {
      return {
        ok: false,
        message: "Oyunda düzgün seçim et.",
      };
    }

    return {
      ok: false,
      message:
        "Casino əməliyyatı zamanı xəta baş verdi.",
    };
  }
}
