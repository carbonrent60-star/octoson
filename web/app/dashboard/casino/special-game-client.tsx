"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  CircleDollarSign,
  Crown,
  Grid3X3,
  Layers3,
  ShieldQuestion,
  Swords,
  WalletCards,
} from "lucide-react";

import {
  playCasinoAction,
  type CasinoGame,
  type CasinoPlayResult,
} from "./actions";

type SpecialGame =
  | "slots"
  | "risk"
  | "tower"
  | "higherlower";

type Props = {
  game: SpecialGame;
  initialBalance: number;
};

const gameInfo: Record<
  SpecialGame,
  {
    name: string;
    subtitle: string;
    tag: string;
    icon: typeof Grid3X3;
  }
> = {
  slots: {
    name: "Slots",
    subtitle:
      "Üç çarxı fırlat. Simvolları uyğunlaşdır və multiplier qazan.",
    tag: "5X",
    icon: Grid3X3,
  },

  risk: {
    name: "Risk",
    subtitle:
      "Riski artır. Hər uğurlu mərhələ multiplier-i yüksəldir.",
    tag: "RISK",
    icon: Swords,
  },

  tower: {
    name: "Tower",
    subtitle:
      "Mərtəbələri keç. Yuxarı qalxdıqca mükafat artır.",
    tag: "4X",
    icon: ShieldQuestion,
  },

  higherlower: {
    name: "Higher / Lower",
    subtitle:
      "Növbəti kartın daha yüksək və ya aşağı olacağını təxmin et.",
    tag: "1.85X",
    icon: Layers3,
  },
};

function aura(value: number) {
  return Math.max(
    0,
    Math.floor(value)
  ).toLocaleString("en-US");
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function parseSlotSymbols(description?: string) {
  if (!description) return ["◆", "◆", "◆"];

  const match = description.match(
    /(?:Nəticə|Simvollar):\s*(.+?)\s*[•|$]/
  );

  if (!match) {
    const symbols = description.match(
      /[🍒🍋💎⭐7]/g
    );

    if (symbols?.length) {
      return symbols.slice(0, 3);
    }

    return ["◆", "◆", "◆"];
  }

  return match[1]
    .trim()
    .split(/\s+/)
    .slice(0, 3);
}

function parseHigherLower(description?: string) {
  if (!description) {
    return {
      current: "?",
      next: "?",
    };
  }

  const current =
    description.match(
      /(?:Cari|İlk kart):\s*([^•]+)/
    )?.[1]?.trim() ?? "?";

  const next =
    description.match(
      /(?:Növbəti kart|Sonrakı):\s*([^•]+)/
    )?.[1]?.trim() ?? "?";

  return {
    current,
    next,
  };
}

export default function SpecialGameClient({
  game,
  initialBalance,
}: Props) {
  const router = useRouter();

  const info = gameInfo[game];
  const Icon = info.icon;

  const [balance, setBalance] =
    useState(initialBalance);

  const [bet, setBet] = useState("100");

  const [result, setResult] =
    useState<CasinoPlayResult | null>(null);

  const [pending, startTransition] =
    useTransition();

  const [visualPending, setVisualPending] =
    useState(false);

  const [run, setRun] = useState(0);

  const [slotStage, setSlotStage] =
    useState(0);

  const [riskLevel, setRiskLevel] =
    useState(1);

  const [towerFloor, setTowerFloor] =
    useState(1);

  const [higherChoice, setHigherChoice] =
    useState<"higher" | "lower">("higher");

  const [displaySlots, setDisplaySlots] =
    useState(["◆", "◆", "◆"]);

  const [displayCard, setDisplayCard] =
    useState("?");

  const busy = pending || visualPending;

  function validAmount() {
    const amount = Number(bet);

    return Number.isSafeInteger(amount) &&
      amount > 0 &&
      amount <= balance
      ? amount
      : 0;
  }

  function settle(next: CasinoPlayResult) {
    setResult(next);

    if (
      next.ok &&
      typeof next.balance === "number"
    ) {
      setBalance(next.balance);
    }

    router.refresh();
  }

  function playSlots() {
    const amount = validAmount();

    if (!amount) {
      setResult({
        ok: false,
        message:
          "Düzgün mərc daxil et və balansını yoxla.",
      });
      return;
    }

    setResult(null);
    setVisualPending(true);
    setSlotStage(0);
    setRun((value) => value + 1);

    startTransition(async () => {
      const next = await playCasinoAction({
        game: "slots" as CasinoGame,
        bet: amount,
      });

      if (!next.ok) {
        setVisualPending(false);
        settle(next);
        return;
      }

      const finalSymbols =
        parseSlotSymbols(next.description);

      /*
       * Result exists on the server already,
       * but the player does not see it until
       * every reel physically stops.
       */

      await sleep(1050);

      setDisplaySlots((old) => [
        finalSymbols[0] ?? old[0],
        old[1],
        old[2],
      ]);
      setSlotStage(1);

      await sleep(430);

      setDisplaySlots((old) => [
        old[0],
        finalSymbols[1] ?? old[1],
        old[2],
      ]);
      setSlotStage(2);

      await sleep(430);

      setDisplaySlots([
        finalSymbols[0] ?? "◆",
        finalSymbols[1] ?? "◆",
        finalSymbols[2] ?? "◆",
      ]);
      setSlotStage(3);

      await sleep(550);

      setVisualPending(false);
      settle(next);
    });
  }

  function playRisk() {
    const amount = validAmount();

    if (!amount) {
      setResult({
        ok: false,
        message:
          "Düzgün mərc daxil et və balansını yoxla.",
      });
      return;
    }

    setResult(null);
    setVisualPending(true);
    setRun((value) => value + 1);

    startTransition(async () => {
      const next = await playCasinoAction({
        game: "risk" as CasinoGame,
        bet: amount,
        choice: String(riskLevel),
      });

      await sleep(1250);

      setVisualPending(false);
      settle(next);
    });
  }

  function playTower() {
    const amount = validAmount();

    if (!amount) {
      setResult({
        ok: false,
        message:
          "Düzgün mərc daxil et və balansını yoxla.",
      });
      return;
    }

    setResult(null);
    setVisualPending(true);
    setRun((value) => value + 1);

    startTransition(async () => {
      const next = await playCasinoAction({
        game: "tower" as CasinoGame,
        bet: amount,
        choice: String(towerFloor),
      });

      await sleep(950);

      setVisualPending(false);
      settle(next);
    });
  }

  function playHigherLower(
    choice: "higher" | "lower"
  ) {
    const amount = validAmount();

    if (!amount) {
      setResult({
        ok: false,
        message:
          "Düzgün mərc daxil et və balansını yoxla.",
      });
      return;
    }

    setHigherChoice(choice);
    setResult(null);
    setVisualPending(true);
    setRun((value) => value + 1);

    startTransition(async () => {
      const next = await playCasinoAction({
        game: "higherlower" as CasinoGame,
        bet: amount,
        choice,
      });

      if (!next.ok) {
        setVisualPending(false);
        settle(next);
        return;
      }

      const cards =
        parseHigherLower(next.description);

      setDisplayCard(cards.current);

      await sleep(900);

      setDisplayCard(cards.next);

      await sleep(550);

      setVisualPending(false);
      settle(next);
    });
  }

  const won =
    result?.ok &&
    Number(result.net ?? 0) > 0;

  const lost =
    result?.ok &&
    Number(result.net ?? 0) < 0;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() =>
          router.push("/dashboard/casino")
        }
        className="mb-6 flex items-center gap-2 text-[10px] text-white/30 transition hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        Casino
      </button>

      <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <div className="flex items-center gap-2">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-200 opacity-20" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-cyan-200" />
            </span>

            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-100/45">
              OCTOSON CASINO
            </p>
          </div>

          <div className="mt-3 flex items-center gap-3">
            <Icon className="h-6 w-6 text-cyan-100/40" />

            <h1 className="text-[40px] font-semibold tracking-[-0.05em] text-white">
              {info.name}
            </h1>
          </div>

          <p className="mt-2 max-w-xl text-[12px] leading-5 text-white/25">
            {info.subtitle}
          </p>
        </div>

        <motion.div
          key={balance}
          initial={{
            scale: 0.96,
            opacity: 0.7,
          }}
          animate={{
            scale: 1,
            opacity: 1,
          }}
          className="rounded-[15px] border border-white/[0.07] bg-white/[0.02] px-5 py-3"
        >
          <div className="flex items-center gap-2 text-[9px] text-white/25">
            <WalletCards className="h-3.5 w-3.5" />
            Wallet
          </div>

          <p className="mt-1 text-[17px] font-semibold text-white/80">
            {aura(balance)}

            <span className="ml-1.5 text-[8px] text-cyan-100/40">
              AURA
            </span>
          </p>
        </motion.div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_390px]">
        <section className="relative min-h-[560px] overflow-hidden rounded-[26px] border border-white/[0.07] bg-[#08090c]">
          <div className="pointer-events-none absolute left-1/2 top-[-180px] h-[500px] w-[620px] -translate-x-1/2 rounded-full bg-cyan-200/[0.045] blur-[130px]" />

          <AnimatePresence mode="wait">
            {game === "slots" && (
              <SlotsVisual
                key={`slots-${run}`}
                spinning={visualPending}
                stage={slotStage}
                symbols={displaySlots}
              />
            )}

            {game === "risk" && (
              <RiskVisual
                key={`risk-${run}`}
                level={riskLevel}
                pending={visualPending}
              />
            )}

            {game === "tower" && (
              <TowerVisual
                key={`tower-${run}`}
                floor={towerFloor}
                pending={visualPending}
              />
            )}

            {game === "higherlower" && (
              <HigherLowerVisual
                key={`hl-${run}`}
                card={displayCard}
                choice={higherChoice}
                pending={visualPending}
              />
            )}
          </AnimatePresence>

          <div
            className={`pointer-events-none absolute inset-0 transition duration-700 ${
              won
                ? "bg-emerald-300/[0.025]"
                : lost
                  ? "bg-red-300/[0.02]"
                  : ""
            }`}
          />
        </section>

        <section className="rounded-[24px] border border-white/[0.07] bg-[#09090c] p-5 lg:sticky lg:top-[92px] lg:self-start">
          <div className="flex items-center justify-between">
            <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-white/20">
              Mərc
            </p>

            <span className="rounded-full border border-white/[0.06] bg-white/[0.025] px-2 py-1 text-[8px] font-semibold text-cyan-100/35">
              {info.tag}
            </span>
          </div>

          <div className="mt-3 flex items-center rounded-[14px] border border-white/[0.07] bg-black/25 px-4">
            <input
              value={bet}
              disabled={busy}
              inputMode="numeric"
              onChange={(event) =>
                setBet(
                  event.target.value.replace(
                    /[^\d]/g,
                    ""
                  )
                )
              }
              className="min-w-0 flex-1 bg-transparent py-4 text-[23px] font-semibold text-white outline-none"
            />

            <span className="text-[9px] font-semibold text-cyan-100/45">
              AURA
            </span>
          </div>

          <div className="mt-2 grid grid-cols-3 gap-2">
            <Quick
              disabled={busy}
              onClick={() =>
                setBet(
                  String(
                    Math.max(
                      1,
                      Math.floor(
                        Number(bet || 0) / 2
                      )
                    )
                  )
                )
              }
            >
              ½
            </Quick>

            <Quick
              disabled={busy}
              onClick={() =>
                setBet(
                  String(
                    Math.min(
                      balance,
                      Math.max(
                        1,
                        Math.floor(
                          Number(bet || 0) * 2
                        )
                      )
                    )
                  )
                )
              }
            >
              2×
            </Quick>

            <Quick
              disabled={busy}
              onClick={() =>
                setBet(
                  String(Math.floor(balance))
                )
              }
            >
              MAX
            </Quick>
          </div>

          {game === "risk" && (
            <div className="mt-6">
              <p className="text-[9px] uppercase tracking-[0.14em] text-white/20">
                Risk səviyyəsi
              </p>

              <div className="mt-3 grid grid-cols-4 gap-2">
                {[1, 2, 3, 4].map(
                  (level) => (
                    <Choice
                      key={level}
                      active={
                        riskLevel === level
                      }
                      disabled={busy}
                      onClick={() =>
                        setRiskLevel(level)
                      }
                    >
                      {level}
                    </Choice>
                  )
                )}
              </div>

              <p className="mt-3 text-[10px] text-white/25">
                Yüksək səviyyə = daha yüksək
                multiplier və daha çox risk.
              </p>
            </div>
          )}

          {game === "tower" && (
            <div className="mt-6">
              <p className="text-[9px] uppercase tracking-[0.14em] text-white/20">
                Hədəf mərtəbə
              </p>

              <div className="mt-3 grid grid-cols-4 gap-2">
                {[1, 2, 3, 4].map(
                  (floor) => (
                    <Choice
                      key={floor}
                      active={
                        towerFloor === floor
                      }
                      disabled={busy}
                      onClick={() =>
                        setTowerFloor(floor)
                      }
                    >
                      {floor}
                    </Choice>
                  )
                )}
              </div>
            </div>
          )}

          {game === "higherlower" ? (
            <div className="mt-6 grid grid-cols-2 gap-2">
              <ActionButton
                disabled={busy}
                onClick={() =>
                  playHigherLower("higher")
                }
              >
                <ChevronUp className="h-4 w-4" />
                Yüksək
              </ActionButton>

              <ActionButton
                disabled={busy}
                onClick={() =>
                  playHigherLower("lower")
                }
              >
                <ChevronDown className="h-4 w-4" />
                Aşağı
              </ActionButton>
            </div>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                if (game === "slots") {
                  playSlots();
                }

                if (game === "risk") {
                  playRisk();
                }

                if (game === "tower") {
                  playTower();
                }
              }}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-[15px] border border-cyan-100/[0.14] bg-cyan-100/[0.08] py-4 text-[11px] font-semibold text-cyan-50 transition hover:bg-cyan-100/[0.12] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <CircleDollarSign className="h-4 w-4" />

              {busy
                ? "Oynanılır..."
                : "Oyna"}
            </button>
          )}

          <AnimatePresence mode="wait">
            {result && !visualPending && (
              <motion.div
                key={`${run}-result`}
                initial={{
                  opacity: 0,
                  y: 8,
                }}
                animate={{
                  opacity: 1,
                  y: 0,
                }}
                exit={{
                  opacity: 0,
                }}
                className={`mt-5 rounded-[15px] border p-4 ${
                  !result.ok
                    ? "border-red-300/[0.1] bg-red-300/[0.03]"
                    : won
                      ? "border-emerald-300/[0.1] bg-emerald-300/[0.03]"
                      : "border-white/[0.07] bg-white/[0.02]"
                }`}
              >
                <div className="flex items-center gap-2">
                  {won && (
                    <Crown className="h-4 w-4 text-emerald-200/60" />
                  )}

                  <p className="text-[11px] font-semibold text-white/75">
                    {result.title ??
                      (result.ok
                        ? "Nəticə"
                        : "Xəta")}
                  </p>
                </div>

                <p className="mt-2 text-[10px] leading-5 text-white/35">
                  {result.description ??
                    result.message}
                </p>

                {result.ok && (
                  <div className="mt-4 flex items-end justify-between border-t border-white/[0.05] pt-3">
                    <span className="text-[9px] text-white/20">
                      Net
                    </span>

                    <span
                      className={`text-[15px] font-semibold ${
                        Number(
                          result.net ?? 0
                        ) > 0
                          ? "text-emerald-200/80"
                          : Number(
                                result.net ?? 0
                              ) < 0
                            ? "text-red-200/70"
                            : "text-white/50"
                      }`}
                    >
                      {Number(
                        result.net ?? 0
                      ) > 0
                        ? "+"
                        : ""}
                      {aura(
                        Number(
                          result.net ?? 0
                        )
                      )}{" "}
                      AURA
                    </span>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      </div>
    </div>
  );
}



function normalizeSlotSymbol(value: unknown): string {
  const raw = String(value ?? "")
    .trim()
    .toLowerCase();

  // Already an actual display symbol
  if (["🍒", "🍋", "⭐", "💎", "👑", "7️⃣"].includes(String(value))) {
    return String(value);
  }

  // Backend/text variants
  if (
    raw === "cherry" ||
    raw === "cherries" ||
    raw === "albalı" ||
    raw === "albali"
  ) {
    return "🍒";
  }

  if (
    raw === "lemon" ||
    raw === "limon"
  ) {
    return "🍋";
  }

  if (
    raw === "star" ||
    raw === "ulduz"
  ) {
    return "⭐";
  }

  if (
    raw === "diamond" ||
    raw === "almaz" ||
    raw === "brilliant"
  ) {
    return "💎";
  }

  if (
    raw === "crown" ||
    raw === "tac" ||
    raw === "taç"
  ) {
    return "👑";
  }

  if (
    raw === "7" ||
    raw === "seven" ||
    raw === "lucky7" ||
    raw === "lucky-7"
  ) {
    return "7️⃣";
  }

  // Do NOT silently turn unknown backend values into cherry.
  return String(value ?? "❔");
}

function SlotSymbol({
  value,
  muted = false,
}: {
  value: string;
  muted?: boolean;
}) {
  const raw = String(value ?? "").trim();
  const normalized = raw.toLowerCase();

  let symbol = "🍒";

  if (
    raw === "7" ||
    normalized.includes("seven") ||
    normalized.includes("yeddi")
  ) {
    symbol = "7";
  } else if (
    raw === "💎" ||
    normalized.includes("diamond") ||
    normalized.includes("almaz") ||
    normalized.includes("brilyant")
  ) {
    symbol = "💎";
  } else if (
    raw === "⭐" ||
    raw === "🌟" ||
    normalized.includes("star") ||
    normalized.includes("ulduz")
  ) {
    symbol = "⭐";
  } else if (
    raw === "🍒" ||
    normalized.includes("cherry") ||
    normalized.includes("gilas") ||
    normalized.includes("albal")
  ) {
    symbol = "🍒";
  } else if (
    raw === "🍋" ||
    normalized.includes("lemon") ||
    normalized.includes("limon")
  ) {
    symbol = "🍋";
  } else if (
    raw === "👑" ||
    normalized.includes("crown") ||
    normalized.includes("tac") ||
    normalized.includes("jackpot")
  ) {
    symbol = "👑";
  } else if (
    raw === "🍀" ||
    normalized.includes("clover") ||
    normalized.includes("yonca")
  ) {
    symbol = "🍀";
  }

  if (symbol === "7") {
    return (
      <div
        className={`relative z-20 flex h-full w-full items-center justify-center overflow-visible ${
          muted ? "opacity-30" : ""
        }`}
      >
        <span
          className="block select-none text-[58px] font-black italic leading-none text-red-400"
          style={{
            textShadow:
              "0 8px 22px rgba(0,0,0,0.7), 0 0 18px rgba(248,113,113,0.14)",
          }}
        >
          7
        </span>
      </div>
    );
  }

  return (
    <div
      className={`relative z-20 flex h-full w-full items-center justify-center overflow-visible ${
        muted ? "opacity-30" : ""
      }`}
    >
      <span
        className="block select-none text-[50px] leading-none"
        style={{
          fontFamily:
            '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif',
          filter: muted
            ? "grayscale(0.35)"
            : "drop-shadow(0 8px 13px rgba(0,0,0,0.65))",
        }}
      >
        {symbol}
      </span>
    </div>
  );
}

function SlotsVisual({
  spinning,
  stage,
  symbols,
}: {
  spinning: boolean;
  stage: number;
  symbols: string[];
}) {
  const reelSymbols = [
    "🍒",
    "🍋",
    "⭐",
    "💎",
    "7",
    "👑",
    "🍒",
    "🍋",
    "⭐",
    "💎",
  ];

  const reelStopped = (index: number) =>
    !spinning || stage > index;

  return (
    <div className="relative z-10 flex min-h-[560px] w-full items-center justify-center overflow-hidden px-5 py-10 sm:px-8">
      {/* Ambient casino lighting */}
      <div className="pointer-events-none absolute left-1/2 top-[5%] h-[260px] w-[520px] -translate-x-1/2 rounded-full bg-cyan-300/[0.055] blur-[100px]" />

      <div className="pointer-events-none absolute bottom-[-100px] left-1/2 h-[240px] w-[520px] -translate-x-1/2 rounded-full bg-blue-500/[0.035] blur-[110px]" />

      <motion.div
        initial={{
          opacity: 0,
          y: 18,
          scale: 0.98,
        }}
        animate={{
          opacity: 1,
          y: 0,
          scale: 1,
        }}
        transition={{
          duration: 0.45,
          ease: "easeOut",
        }}
        className="relative w-full max-w-[650px]"
      >
        {/* Machine crown */}
        <div className="relative z-20 mx-auto w-[88%]">
          <div className="absolute inset-x-12 top-0 h-16 rounded-full bg-cyan-200/[0.08] blur-[35px]" />

          <div className="relative overflow-hidden rounded-t-[34px] border border-b-0 border-white/[0.09] bg-gradient-to-b from-white/[0.055] to-[#0a0c10] px-6 pb-5 pt-6 shadow-[0_-20px_70px_rgba(130,230,255,0.025)]">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-100/30 to-transparent" />

            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-cyan-200 shadow-[0_0_12px_rgba(165,243,252,0.7)]" />

                  <p className="text-[8px] font-semibold uppercase tracking-[0.3em] text-cyan-100/35">
                    OCTOSON
                  </p>
                </div>

                <p className="mt-1 text-[24px] font-semibold tracking-[-0.055em] text-white/90">
                  SLOTS
                </p>
              </div>

              <div className="text-right">
                <p className="text-[8px] uppercase tracking-[0.2em] text-white/20">
                  MAX WIN
                </p>

                <p className="mt-1 text-[15px] font-semibold text-cyan-100/65">
                  5.00×
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Main machine */}
        <div className="relative overflow-hidden rounded-[34px] border border-white/[0.09] bg-[#080a0e] p-3 shadow-[0_40px_100px_rgba(0,0,0,0.55)] sm:p-5">
          {/* metallic upper edge */}
          <div className="pointer-events-none absolute inset-x-12 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

          <div className="relative overflow-hidden rounded-[25px] border border-white/[0.07] bg-[#050609] p-3 sm:p-5">
            {/* Reel glass reflection */}
            <div className="pointer-events-none absolute inset-x-0 top-0 z-30 h-[45%] bg-gradient-to-b from-white/[0.035] to-transparent" />

            {/* Pay line */}
            <div className="pointer-events-none absolute left-1 right-1 top-1/2 z-40 -translate-y-1/2">
              <div className="relative h-px bg-gradient-to-r from-transparent via-cyan-100/45 to-transparent">
                <div className="absolute left-0 top-1/2 h-2 w-2 -translate-y-1/2 rotate-45 border-l border-b border-cyan-100/40" />
                <div className="absolute right-0 top-1/2 h-2 w-2 -translate-y-1/2 rotate-[-135deg] border-l border-b border-cyan-100/40" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              {[0, 1, 2].map((index) => {
                const stopped = reelStopped(index);

                return (
                  <div
                    key={index}
                    className="relative h-[250px] overflow-hidden rounded-[17px] border border-white/[0.07] bg-gradient-to-b from-[#0d1117] via-[#080a0e] to-[#0d1117] sm:h-[290px]"
                  >
                    {/* Reel separators */}
                    <div className="pointer-events-none absolute inset-x-0 top-1/3 z-20 h-px bg-white/[0.035]" />
                    <div className="pointer-events-none absolute inset-x-0 bottom-1/3 z-20 h-px bg-white/[0.035]" />

                    {/* top/bottom reel shadow */}
                    <div className="pointer-events-none absolute inset-x-0 top-0 z-30 h-20 bg-gradient-to-b from-black/90 to-transparent" />
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 h-20 bg-gradient-to-t from-black/90 to-transparent" />

                    <AnimatePresence mode="wait">
                      {!stopped ? (
                        <motion.div
                          key={`rolling-${index}`}
                          initial={{
                            y: -180,
                          }}
                          animate={{
                            y: [0, -420],
                          }}
                          transition={{
                            duration:
                              0.38 + index * 0.035,
                            repeat: Infinity,
                            ease: "linear",
                          }}
                          className="absolute inset-x-0 top-[-80px] flex flex-col items-center gap-[28px]"
                        >
                          {[
                            ...reelSymbols,
                            ...reelSymbols,
                            ...reelSymbols,
                          ].map((symbol, i) => (
                            <div
                              key={i}
                              className="flex h-[64px] items-center justify-center"
                            >
                              <div className="scale-[0.62]">
                                <SlotSymbol
                                  value={symbol}
                                  muted
                                />
                              </div>
                            </div>
                          ))}
                        </motion.div>
                      ) : (
                        <motion.div
                          key={`stopped-${index}-${symbols[index]}`}
                          initial={{
                            y: -46,
                            opacity: 0,
                            scale: 0.72,
                            filter: "blur(8px)",
                          }}
                          animate={{
                            y: 0,
                            opacity: 1,
                            scale: [0.72, 1.12, 0.97, 1],
                            filter: "blur(0px)",
                          }}
                          transition={{
                            duration: 0.46,
                            ease: [0.16, 1, 0.3, 1],
                          }}
                          className="absolute inset-0 z-20 flex items-center justify-center"
                        >
                          {/* Glow only — NOT a symbol container */}
                          <motion.div
                            initial={{
                              opacity: 0,
                              scale: 0.5,
                            }}
                            animate={{
                              opacity: [0, 0.22, 0.08],
                              scale: [0.5, 1.3, 1.05],
                            }}
                            transition={{
                              duration: 0.6,
                              ease: "easeOut",
                            }}
                            className="pointer-events-none absolute h-[150px] w-[150px] rounded-full bg-cyan-200/[0.07] blur-[42px]"
                          />

                          {/* Exactly ONE large final reel symbol */}
                          <span
                            className="relative z-20 block select-none text-center leading-none"
                            style={{
                              fontSize: "clamp(76px, 6vw, 104px)",
                              lineHeight: "1",
                              fontFamily:
                                '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif',
                              filter:
                                "drop-shadow(0 16px 22px rgba(0,0,0,0.48))",
                            }}
                          >
                            {normalizeSlotSymbol(symbols[index])}
                          </span>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Machine status strip */}
          <div className="mt-3 flex items-center justify-between rounded-[18px] border border-white/[0.055] bg-white/[0.018] px-4 py-3">
            <div className="flex items-center gap-2">
              <motion.span
                animate={
                  spinning
                    ? {
                        opacity: [0.25, 1, 0.25],
                        scale: [0.8, 1, 0.8],
                      }
                    : {
                        opacity: 0.45,
                        scale: 1,
                      }
                }
                transition={{
                  repeat: spinning
                    ? Infinity
                    : 0,
                  duration: 0.8,
                }}
                className="h-1.5 w-1.5 rounded-full bg-cyan-200 shadow-[0_0_9px_rgba(165,243,252,0.65)]"
              />

              <span className="text-[8px] font-semibold uppercase tracking-[0.18em] text-white/25">
                {spinning
                  ? `REEL ${Math.min(
                      stage + 1,
                      3
                    )} / 3`
                  : "READY"}
              </span>
            </div>

            <div className="flex items-center gap-4">
              <span className="text-[8px] uppercase tracking-[0.15em] text-white/15">
                3 REELS
              </span>

              <span className="text-[8px] font-semibold uppercase tracking-[0.15em] text-cyan-100/30">
                PAYLINE 01
              </span>
            </div>
          </div>
        </div>

        {/* machine feet / shadow */}
        <div className="mx-auto flex w-[84%] justify-between px-10">
          <div className="h-3 w-14 rounded-b-xl border-x border-b border-white/[0.06] bg-[#090b0e]" />
          <div className="h-3 w-14 rounded-b-xl border-x border-b border-white/[0.06] bg-[#090b0e]" />
        </div>

        <div className="mx-auto mt-1 h-8 w-[72%] rounded-full bg-black/50 blur-xl" />
      </motion.div>
    </div>
  );
}

function RiskVisual({
  level,
  pending,
}: {
  level: number;
  pending: boolean;
}) {
  return (
    <div className="relative z-10 flex min-h-[560px] flex-col items-center justify-center px-8">
      <motion.div
        animate={
          pending
            ? {
                scale: [
                  1,
                  1.08,
                  0.98,
                  1.05,
                  1,
                ],
              }
            : { scale: 1 }
        }
        transition={{
          duration: 0.7,
          repeat: pending
            ? Infinity
            : 0,
        }}
        className="relative flex h-[230px] w-[230px] items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.02]"
      >
        <div className="absolute inset-5 rounded-full border border-cyan-100/[0.08]" />
        <div className="absolute inset-10 rounded-full border border-cyan-100/[0.05]" />

        <div className="text-center">
          <Swords className="mx-auto h-8 w-8 text-cyan-100/40" />

          <p className="mt-4 text-[46px] font-semibold tracking-[-0.06em] text-white">
            {level}
          </p>

          <p className="text-[9px] uppercase tracking-[0.2em] text-white/25">
            risk level
          </p>
        </div>
      </motion.div>

      <div className="mt-10 flex gap-2">
        {[1, 2, 3, 4].map((value) => (
          <motion.div
            key={value}
            animate={{
              opacity:
                value <= level ? 1 : 0.2,
              scale:
                pending &&
                value === level
                  ? [1, 1.25, 1]
                  : 1,
            }}
            transition={{
              repeat:
                pending &&
                value === level
                  ? Infinity
                  : 0,
              duration: 0.8,
            }}
            className="h-1.5 w-12 rounded-full bg-cyan-100/40"
          />
        ))}
      </div>
    </div>
  );
}

function TowerVisual({
  floor,
  pending,
}: {
  floor: number;
  pending: boolean;
}) {
  return (
    <div className="relative z-10 flex min-h-[560px] items-center justify-center px-8">
      <div className="flex w-full max-w-[360px] flex-col-reverse gap-3">
        {[1, 2, 3, 4].map((value) => {
          const active =
            value <= floor;

          return (
            <motion.div
              key={value}
              animate={{
                x:
                  pending &&
                  value === floor
                    ? [-3, 3, -2, 2, 0]
                    : 0,
                scale:
                  value === floor
                    ? 1.03
                    : 1,
              }}
              transition={{
                duration: 0.5,
                repeat:
                  pending &&
                  value === floor
                    ? Infinity
                    : 0,
              }}
              className={`flex h-[78px] items-center justify-between rounded-[18px] border px-5 ${
                active
                  ? "border-cyan-100/[0.12] bg-cyan-100/[0.045]"
                  : "border-white/[0.05] bg-white/[0.015]"
              }`}
            >
              <div>
                <p className="text-[9px] uppercase tracking-[0.16em] text-white/20">
                  Mərtəbə
                </p>

                <p className="mt-1 text-[20px] font-semibold text-white/75">
                  {value}
                </p>
              </div>

              <ShieldQuestion
                className={`h-5 w-5 ${
                  active
                    ? "text-cyan-100/45"
                    : "text-white/10"
                }`}
              />
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

function HigherLowerVisual({
  card,
  choice,
  pending,
}: {
  card: string;
  choice: "higher" | "lower";
  pending: boolean;
}) {
  return (
    <div className="relative z-10 flex min-h-[560px] flex-col items-center justify-center">
      <div className="mb-8 flex items-center gap-2 text-[9px] uppercase tracking-[0.18em] text-white/20">
        {choice === "higher" ? (
          <ChevronUp className="h-3.5 w-3.5" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5" />
        )}

        {choice === "higher"
          ? "Yüksək"
          : "Aşağı"}
      </div>

      <motion.div
        animate={
          pending
            ? {
                rotateY: [0, 90, 180, 270, 360],
              }
            : {
                rotateY: 0,
              }
        }
        transition={{
          duration: 0.9,
          repeat: pending
            ? Infinity
            : 0,
          ease: "easeInOut",
        }}
        className="flex h-[260px] w-[180px] items-center justify-center rounded-[24px] border border-white/[0.1] bg-gradient-to-br from-white/[0.07] to-white/[0.015] shadow-2xl"
        style={{
          transformStyle: "preserve-3d",
        }}
      >
        <span className="text-[54px] font-semibold tracking-[-0.06em] text-white/80">
          {pending ? "?" : card}
        </span>
      </motion.div>

      <p className="mt-8 text-[10px] text-white/20">
        Növbəti kartı təxmin et
      </p>
    </div>
  );
}

function Quick({
  children,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="rounded-[11px] border border-white/[0.06] bg-white/[0.02] py-2.5 text-[9px] font-semibold text-white/30 transition hover:border-white/[0.1] hover:bg-white/[0.04] hover:text-white/60 disabled:opacity-30"
    >
      {children}
    </button>
  );
}

function Choice({
  children,
  active,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`rounded-[12px] border py-3 text-[10px] font-semibold transition ${
        active
          ? "border-cyan-100/[0.18] bg-cyan-100/[0.08] text-cyan-50"
          : "border-white/[0.06] bg-white/[0.02] text-white/30 hover:text-white/60"
      } disabled:opacity-30`}
    >
      {children}
    </button>
  );
}

function ActionButton({
  children,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex items-center justify-center gap-2 rounded-[15px] border border-cyan-100/[0.12] bg-cyan-100/[0.06] py-4 text-[10px] font-semibold text-cyan-50/80 transition hover:bg-cyan-100/[0.1] disabled:opacity-30"
    >
      {children}
    </button>
  );
}
