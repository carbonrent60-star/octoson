"use client";

import {
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";

import { useRouter } from "next/navigation";
import {
  AnimatePresence,
  motion,
} from "motion/react";

import {
  ArrowLeft,
  CircleDollarSign,
  CircleGauge,
  Coins,
  Crown,
  Dice5,
  Dices,
  Goal,
  LoaderCircle,
  RotateCcw,
  Sparkles,
  Spade,
  Trophy,
  WalletCards,
} from "lucide-react";

import { useOctosonAudio } from "@/components/audio/octoson-audio";

import {
  CasinoGame,
  CasinoPlayResult,
  playCasinoAction,
} from "../actions";

type GameConfig = {
  name: string;
  subtitle: string;
  tag: string;
  icon: React.ElementType;
  choices?: [string, string][];
  defaultChoice?: string;
  crash?: boolean;
};

type GenericCasinoGame = Exclude<
  CasinoGame,
  "slots" | "risk" | "tower" | "higherlower"
>;

const configs: Record<GenericCasinoGame, GameConfig> = {
  coinflip: {
    name: "Coinflip",
    subtitle: "Üz və ya arxa seç. Sikkənin taleyini yoxla.",
    tag: "1.95X",
    icon: Coins,
    defaultChoice: "heads",
    choices: [
      ["heads", "Üz"],
      ["tails", "Arxa"],
    ],
  },

  dice: {
    name: "Dice",
    subtitle: "Sistemə qarşı zər at. Böyük rəqəm qalibdir.",
    tag: "1.80X",
    icon: Dice5,
  },

  roulette: {
    name: "Roulette",
    subtitle: "Qırmızı və ya qara. Çarx qərar versin.",
    tag: "1.95X",
    icon: CircleDollarSign,
    defaultChoice: "red",
    choices: [
      ["red", "Qırmızı"],
      ["black", "Qara"],
    ],
  },

  crash: {
    name: "Crash",
    subtitle: "Multiplier yüksəlir. Crash-dan əvvəl çıx.",
    tag: "1.10–10X",
    icon: CircleGauge,
    crash: true,
  },

  wheel: {
    name: "Lucky Wheel",
    subtitle: "Çarxı fırlat və multiplier-i tut.",
    tag: "2.40X",
    icon: RotateCcw,
  },

  rps: {
    name: "RPS",
    subtitle: "Daş, kağız və ya qayçı ilə sistemi məğlub et.",
    tag: "1.80X",
    icon: Dices,
    defaultChoice: "rock",
    choices: [
      ["rock", "Daş"],
      ["paper", "Kağız"],
      ["scissors", "Qayçı"],
    ],
  },

  baccarat: {
    name: "Baccarat",
    subtitle: "Oyunçu, Bankir və ya Bərabər seç.",
    tag: "8.00X",
    icon: Spade,
    defaultChoice: "player",
    choices: [
      ["player", "Oyunçu"],
      ["banker", "Bankir"],
      ["tie", "Bərabər"],
    ],
  },

  poker: {
    name: "Poker",
    subtitle: "Virtual əlini aç və kombinasiyanı gör.",
    tag: "5.00X",
    icon: Crown,
  },

  horse: {
    name: "Horse Racing",
    subtitle: "Altı atdan birini seç və yarışı izlə.",
    tag: "5.00X",
    icon: Trophy,
    defaultChoice: "1",
    choices: [
      ["1", "#1"],
      ["2", "#2"],
      ["3", "#3"],
      ["4", "#4"],
      ["5", "#5"],
      ["6", "#6"],
    ],
  },

  penalty: {
    name: "Penalty",
    subtitle: "Küncü seç və qapıçını keç.",
    tag: "1.35X",
    icon: Goal,
    defaultChoice: "center",
    choices: [
      ["left", "Sol"],
      ["center", "Orta"],
      ["right", "Sağ"],
    ],
  },

  lottery: {
    name: "Lottery",
    subtitle: "Bileti aç. Böyük multiplier səni gözləyə bilər.",
    tag: "8.00X",
    icon: Sparkles,
  },

  jackpot: {
    name: "Jackpot",
    subtitle: "Octoson-un ən yüksək riskli raundlarından biri.",
    tag: "25.0X",
    icon: Crown,
  },
};

function aura(value: number) {
  return Math.max(
    0,
    Math.floor(value)
  ).toLocaleString("en-US");
}

function parseNumbers(text?: string) {
  return (
    text?.match(/\d+(?:\.\d+)?/g)?.map(Number) ?? []
  );
}

function parseCoinSide(description?: string) {
  if (!description) return null;

  if (description.includes("Düşdü: Üz")) {
    return "heads";
  }

  if (description.includes("Düşdü: Arxa")) {
    return "tails";
  }

  return null;
}

function parseRoulette(description?: string) {
  if (!description) {
    return {
      label: "?",
      number: "?",
      color: "unknown",
    };
  }

  const number =
    description.match(/(\d+)\s*$/)?.[1] ?? "?";

  let color = "unknown";
  let label = "?";

  if (description.includes("Düşdü: Qırmızı")) {
    color = "red";
    label = "Qırmızı";
  } else if (
    description.includes("Düşdü: Qara")
  ) {
    color = "black";
    label = "Qara";
  } else if (
    description.includes("Düşdü: Yaşıl")
  ) {
    color = "green";
    label = "Yaşıl";
  }

  return {
    label,
    number,
    color,
  };
}

function parseRps(description?: string) {
  if (!description) {
    return ["?", "?"];
  }

  const match = description.match(
    /Sən:\s*(.+?)\s*•\s*Sistem:\s*(.+)$/
  );

  if (!match) {
    return ["?", "?"];
  }

  return [match[1], match[2]];
}

function parseHorse(description?: string) {
  if (!description) {
    return {
      selected: 0,
      winner: 0,
    };
  }

  const match = description.match(
    /Sənin atın:\s*#(\d+).*Qalib:\s*#(\d+)/
  );

  return {
    selected: Number(match?.[1] ?? 0),
    winner: Number(match?.[2] ?? 0),
  };
}

function parsePenalty(description?: string) {
  if (!description) {
    return {
      shot: "?",
      keeper: "?",
    };
  }

  const match = description.match(
    /Zərbə:\s*(.+?)\s*•\s*Qapıçı:\s*(.+)$/
  );

  return {
    shot: match?.[1] ?? "?",
    keeper: match?.[2] ?? "?",
  };
}


function wait(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function gameRevealTiming(game: CasinoGame) {
  switch (game) {
    case "coinflip":
      return { motion: 1850, settle: 520 };

    case "dice":
      return { motion: 1250, settle: 420 };

    case "roulette":
      return { motion: 2900, settle: 650 };

    case "crash":
      return { motion: 2400, settle: 450 };

    case "wheel":
      return { motion: 3200, settle: 650 };

    case "rps":
      return { motion: 1050, settle: 350 };

    case "baccarat":
    case "poker":
      return { motion: 1750, settle: 450 };

    case "horse":
      return { motion: 3000, settle: 500 };

    case "penalty":
      return { motion: 1450, settle: 420 };

    case "lottery":
      return { motion: 2200, settle: 500 };

    case "jackpot":
      return { motion: 2500, settle: 550 };

    default:
      return { motion: 1500, settle: 400 };
  }
}

function soundForGame(game: CasinoGame) {
  switch (game) {
    case "coinflip":
      return "coin" as const;

    case "dice":
      return "dice" as const;

    case "roulette":
      return "roulette" as const;

    case "wheel":
      return "wheel" as const;

    case "baccarat":
    case "poker":
      return "card" as const;

    default:
      return "bet" as const;
  }
}

export default function GameClient({
  game,
  initialBalance,
}: {
  game: CasinoGame;
  initialBalance: number;
}) {
  const router = useRouter();
  const audio = useOctosonAudio();

  if (
    game === "slots" ||
    game === "risk" ||
    game === "tower" ||
    game === "higherlower"
  ) {
    throw new Error(
      `Game ${game} must use SpecialGameClient`
    );
  }

  const genericGame: GenericCasinoGame = game;
  const config = configs[genericGame];
  const Icon = config.icon;

  const [balance, setBalance] =
    useState(initialBalance);

  const [bet, setBet] = useState("100");

  const [choice, setChoice] = useState(
    config.defaultChoice ?? ""
  );

  const [cashout, setCashout] =
    useState("2.00");

  const [result, setResult] =
    useState<CasinoPlayResult | null>(null);

  /*
   * visualResult is allowed to drive the physical landing animation.
   * result is the PUBLIC result and stays hidden until the animation
   * has actually completed.
   */
  const [visualResult, setVisualResult] =
    useState<CasinoPlayResult | null>(null);

  const [visualPending, setVisualPending] =
    useState(false);

  const [transitionPending, startTransition] =
    useTransition();

  const pending =
    transitionPending || visualPending;

  const [visualRun, setVisualRun] =
    useState(0);

  useEffect(() => {
    if (!result) {
      return;
    }

    if (!result.ok) {
      audio.play("error");
      return;
    }

    const net = Number(result.net ?? 0);

    if (net > 0) {
      const multiplier = Number(
        result.multiplier ?? 0
      );

      audio.play(
        multiplier >= 5 || net >= 10000
          ? "bigwin"
          : "win"
      );
    } else if (net < 0) {
      audio.play("lose");
    } else {
      audio.play("click");
    }
  }, [result, audio]);

  function play() {
    const amount = Number(bet);

    if (
      !Number.isSafeInteger(amount) ||
      amount <= 0
    ) {
      setResult({
        ok: false,
        message: "Düzgün mərc daxil et.",
      });

      return;
    }

    if (amount > balance) {
      setResult({
        ok: false,
        message:
          "Wallet-də kifayət qədər Aura yoxdur.",
      });

      return;
    }

    const timing =
      gameRevealTiming(game);

    const animationStartedAt =
      performance.now();

    audio.play("bet");

    window.setTimeout(() => {
      audio.play(soundForGame(game));
    }, 90);

    setResult(null);
    setVisualResult(null);
    setVisualPending(true);
    setVisualRun((current) => current + 1);

    startTransition(async () => {
      const next = await playCasinoAction({
        game,
        bet: amount,
        choice:
          config.choices
            ? choice
            : undefined,
        cashout:
          config.crash
            ? Number(cashout)
            : undefined,
      });

      if (!next.ok) {
        setVisualPending(false);
        setVisualResult(next);
        setResult(next);
        return;
      }

      /*
       * The backend may answer in 80ms or 1500ms.
       * The player should still get the full physical animation.
       */
      const elapsed =
        performance.now() -
        animationStartedAt;

      const remaining =
        Math.max(
          0,
          timing.motion - elapsed
        );

      if (remaining > 0) {
        await wait(remaining);
      }

      /*
       * Give the visual the authoritative server result first.
       * This lets a coin/wheel/roulette physically land correctly.
       */
      setVisualResult(next);
      setVisualPending(false);

      /*
       * Keep wallet + result panel + win/loss sound hidden while
       * the object performs its final landing/bounce.
       */
      await wait(Math.min(timing.settle, 120));

      setResult(next);

      if (
        typeof next.balance === "number"
      ) {
        setBalance(next.balance);
      }

      
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
        onClick={() => {
          audio.play("navigate");
          router.push("/dashboard/casino");
        }}
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

          <h1 className="mt-3 text-[40px] font-semibold tracking-[-0.05em] text-white">
            {config.name}
          </h1>

          <p className="mt-2 max-w-xl text-[12px] leading-5 text-white/25">
            {config.subtitle}
          </p>
        </div>

        <motion.div
          key={balance}
          initial={{
            scale: 0.96,
            opacity: 0.75,
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
        <section className="relative min-h-[540px] overflow-hidden rounded-[26px] border border-white/[0.07] bg-[#08090c]">
          <div className="pointer-events-none absolute left-1/2 top-[-160px] h-[430px] w-[560px] -translate-x-1/2 rounded-full bg-cyan-200/[0.045] blur-[120px]" />

          <div
            className={`pointer-events-none absolute inset-0 transition duration-500 ${
              won
                ? "bg-emerald-300/[0.025]"
                : lost
                  ? "bg-red-300/[0.02]"
                  : ""
            }`}
          />

          <GameVisual
            game={game}
            choice={choice}
            cashout={cashout}
            pending={pending}
            result={visualResult}
            run={visualRun}
          />

          <AnimatePresence>
            {won && (
              <WinParticles
                key={`particles-${visualRun}`}
              />
            )}
          </AnimatePresence>
        </section>

        <section className="rounded-[24px] border border-white/[0.07] bg-[#09090c] p-5 lg:sticky lg:top-[92px] lg:self-start">
          <div className="flex items-center justify-between">
            <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-white/20">
              Mərc
            </p>

            <span className="rounded-full border border-white/[0.06] bg-white/[0.025] px-2 py-1 text-[8px] font-semibold text-cyan-100/35">
              {config.tag}
            </span>
          </div>

          <div className="mt-3 flex items-center rounded-[14px] border border-white/[0.07] bg-black/25 px-4 transition focus-within:border-cyan-100/[0.15]">
            <input
              value={bet}
              disabled={pending}
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

          <div className="mt-2 flex gap-2">
            <Quick
              disabled={pending}
              onClick={() => {
                audio.play("click");

                setBet(
                  String(
                    Math.max(
                      1,
                      Math.floor(
                        Number(bet || 0) / 2
                      )
                    )
                  )
                );
              }}
            >
              ½
            </Quick>

            <Quick
              disabled={pending}
              onClick={() => {
                audio.play("click");

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
                );
              }}
            >
              2×
            </Quick>

            <Quick
              disabled={pending}
              onClick={() => {
                audio.play("click");

                setBet(
                  String(
                    Math.floor(balance)
                  )
                );
              }}
            >
              MAX
            </Quick>
          </div>

          {config.choices && (
            <div className="mt-5">
              <p className="text-[9px] uppercase tracking-[0.14em] text-white/20">
                Seçim
              </p>

              <div
                className={`mt-2 grid gap-2 ${
                  config.choices.length > 3
                    ? "grid-cols-3"
                    : config.choices.length === 2
                      ? "grid-cols-2"
                      : "grid-cols-3"
                }`}
              >
                {config.choices.map(
                  ([id, label]) => (
                    <motion.button
                      type="button"
                      whileTap={{
                        scale: 0.96,
                      }}
                      key={id}
                      disabled={pending}
                      onClick={() => {
                        audio.play("click");
                        setChoice(id);
                      }}
                      className={`rounded-[11px] border px-3 py-3 text-[10px] transition ${
                        choice === id
                          ? "border-cyan-100/[0.16] bg-cyan-100/[0.06] text-cyan-50 shadow-[0_0_24px_rgba(165,243,252,0.025)]"
                          : "border-white/[0.06] bg-white/[0.02] text-white/30 hover:bg-white/[0.04] hover:text-white/55"
                      }`}
                    >
                      {label}
                    </motion.button>
                  )
                )}
              </div>
            </div>
          )}

          {config.crash && (
            <div className="mt-5">
              <div className="flex items-center justify-between">
                <p className="text-[9px] uppercase tracking-[0.14em] text-white/20">
                  Auto cashout
                </p>

                <p className="text-[8px] text-white/15">
                  1.10x – 10.00x
                </p>
              </div>

              <div className="mt-2 flex items-center rounded-[12px] border border-white/[0.07] bg-black/20 px-4 focus-within:border-cyan-100/[0.15]">
                <input
                  value={cashout}
                  disabled={pending}
                  inputMode="decimal"
                  onChange={(event) =>
                    setCashout(
                      event.target.value.replace(
                        /[^0-9.]/g,
                        ""
                      )
                    )
                  }
                  className="min-w-0 flex-1 bg-transparent py-3 text-[15px] font-semibold text-white/70 outline-none"
                />

                <span className="text-cyan-100/40">
                  ×
                </span>
              </div>
            </div>
          )}

          <motion.button
            type="button"
            whileTap={{
              scale: 0.98,
            }}
            onClick={play}
            disabled={
              pending ||
              !bet ||
              Number(bet) <= 0 ||
              balance <= 0
            }
            className="relative mt-5 flex h-12 w-full overflow-hidden rounded-[13px] bg-cyan-100 text-[11px] font-semibold text-[#061014] transition hover:bg-white disabled:opacity-25"
          >
            {!pending && (
              <motion.span
                aria-hidden
                initial={{
                  x: "-150%",
                }}
                animate={{
                  x: "350%",
                }}
                transition={{
                  duration: 2.8,
                  repeat: Infinity,
                  repeatDelay: 2.4,
                }}
                className="absolute inset-y-0 w-12 rotate-12 bg-white/35 blur-md"
              />
            )}

            <span className="relative flex h-full w-full items-center justify-center gap-2">
              {pending ? (
                <>
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  Raund gedir...
                </>
              ) : (
                <>
                  <Dices className="h-4 w-4" />
                  {aura(
                    Number(bet || 0)
                  )}{" "}
                  Aura oyna
                </>
              )}
            </span>
          </motion.button>

          <AnimatePresence mode="wait">
            {result && !pending && (
              <motion.div
                key={`${visualRun}-${result.message}`}
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
                className={`mt-4 rounded-[14px] border p-4 ${
                  !result.ok
                    ? "border-red-300/10 bg-red-300/[0.03]"
                    : won
                      ? "border-emerald-300/10 bg-emerald-300/[0.03]"
                      : lost
                        ? "border-red-300/10 bg-red-300/[0.03]"
                        : "border-white/[0.07] bg-white/[0.025]"
                }`}
              >
                <p
                  className={`text-[15px] font-semibold ${
                    !result.ok
                      ? "text-red-200/70"
                      : won
                        ? "text-emerald-200/80"
                        : lost
                          ? "text-red-200/70"
                          : "text-white/60"
                  }`}
                >
                  {result.message}
                </p>

                {typeof result.multiplier ===
                  "number" && (
                  <p className="mt-1.5 text-[9px] text-white/20">
                    Nəticə{" "}
                    {result.multiplier.toFixed(
                      2
                    )}
                    x
                  </p>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          <p className="mt-5 border-t border-white/[0.05] pt-4 text-[9px] leading-5 text-white/17">
            Aura yalnız Octoson daxilində istifadə olunan
            virtual oyun valyutasıdır. Real pul dəyəri
            yoxdur və pula çevrilə bilməz.
          </p>
        </section>
      </div>
    </div>
  );
}

function GameVisual({
  game,
  choice,
  cashout,
  pending,
  result,
  run,
}: {
  game: CasinoGame;
  choice: string;
  cashout: string;
  pending: boolean;
  result: CasinoPlayResult | null;
  run: number;
}) {
  const config = configs[game as GenericCasinoGame];

  return (
    <div className="relative flex min-h-[540px] flex-col">
      <div className="flex items-center justify-between border-b border-white/[0.05] px-6 py-4">
        <div className="flex items-center gap-2">
          <config.icon className="h-3.5 w-3.5 text-cyan-100/45" />

          <span className="text-[9px] font-semibold uppercase tracking-[0.16em] text-white/22">
            {config.name}
          </span>
        </div>

        <span className="text-[9px] font-semibold text-white/16">
          {config.tag}
        </span>
      </div>

      <div className="relative flex flex-1 items-center justify-center overflow-hidden p-6 sm:p-10">
        {game === "coinflip" && (
          <CoinflipVisual
            pending={pending}
            result={result}
            run={run}
          />
        )}

        {game === "dice" && (
          <DiceVisual
            pending={pending}
            result={result}
            run={run}
          />
        )}

        {game === "roulette" && (
          <RouletteVisual
            pending={pending}
            result={result}
            run={run}
          />
        )}

        {game === "crash" && (
          <CrashVisual
            pending={pending}
            result={result}
            cashout={cashout}
            run={run}
          />
        )}

        {game === "wheel" && (
          <WheelVisual
            pending={pending}
            result={result}
            run={run}
          />
        )}

        {game === "rps" && (
          <RpsVisual
            pending={pending}
            result={result}
            choice={choice}
            run={run}
          />
        )}

        {game === "baccarat" && (
          <CardTableVisual
            kind="baccarat"
            pending={pending}
            result={result}
            run={run}
          />
        )}

        {game === "poker" && (
          <CardTableVisual
            kind="poker"
            pending={pending}
            result={result}
            run={run}
          />
        )}

        {game === "horse" && (
          <HorseVisual
            pending={pending}
            result={result}
            choice={choice}
            run={run}
          />
        )}

        {game === "penalty" && (
          <PenaltyVisual
            pending={pending}
            result={result}
            choice={choice}
            run={run}
          />
        )}

        {game === "lottery" && (
          <LotteryVisual
            pending={pending}
            result={result}
            run={run}
          />
        )}

        {game === "jackpot" && (
          <JackpotVisual
            pending={pending}
            result={result}
            run={run}
          />
        )}
      </div>
    </div>
  );
}

function CoinflipVisual({
  pending,
  result,
  run,
}: VisualProps) {
  const landed = parseCoinSide(result?.description);

  /*
   * ONE continuous animation.
   *
   * Front  = ÜZ
   * Back   = ARXA
   *
   * The server result determines the final half-turn.
   * There is no second correction animation after landing.
   */
  const finalRotation =
    landed === "tails" ? 1980 : 2160;

  return (
    <div className="flex w-full flex-col items-center">
      <div
        className="relative flex h-[330px] w-full items-center justify-center"
        style={{
          perspective: "1200px",
        }}
      >
        {/* soft atmospheric glow */}
        <motion.div
          animate={
            pending
              ? {
                  scale: [0.82, 1.08, 0.92],
                  opacity: [0.08, 0.18, 0.1],
                }
              : {
                  scale: 0.9,
                  opacity: 0.09,
                }
          }
          transition={{
            duration: 1.9,
            ease: "easeInOut",
          }}
          className="pointer-events-none absolute h-[190px] w-[190px] rounded-full bg-cyan-200 blur-[90px]"
        />

        {/* floor shadow */}
        <motion.div
          key={`coin-shadow-${run}`}
          animate={
            pending
              ? {
                  scaleX: [1, 0.78, 0.42, 0.32, 0.5, 0.78, 1],
                  opacity: [0.24, 0.17, 0.07, 0.045, 0.09, 0.17, 0.24],
                  filter: [
                    "blur(10px)",
                    "blur(13px)",
                    "blur(18px)",
                    "blur(20px)",
                    "blur(16px)",
                    "blur(12px)",
                    "blur(10px)",
                  ],
                }
              : {
                  scaleX: 1,
                  opacity: 0.24,
                  filter: "blur(10px)",
                }
          }
          transition={{
            duration: 1.9,
            times: [0, 0.16, 0.34, 0.5, 0.68, 0.86, 1],
            ease: "easeInOut",
          }}
          className="absolute bottom-[37px] h-[13px] w-[142px] rounded-full bg-black"
        />

        {/* toss container controls ONLY height */}
        <motion.div
          key={`coin-toss-${run}`}
          initial={{
            y: 0,
          }}
          animate={
            pending
              ? {
                  y: [
                    0,
                    -55,
                    -118,
                    -168,
                    -190,
                    -181,
                    -143,
                    -87,
                    -32,
                    0,
                  ],
                }
              : {
                  y: 0,
                }
          }
          transition={{
            duration: 1.9,
            times: [
              0,
              0.11,
              0.23,
              0.36,
              0.48,
              0.57,
              0.69,
              0.81,
              0.92,
              1,
            ],
            ease: "easeInOut",
          }}
          className="relative h-[190px] w-[190px] sm:h-[210px] sm:w-[210px]"
          style={{
            transformStyle: "preserve-3d",
          }}
        >
          {/* coin controls ONLY rotation */}
          <motion.div
            initial={{
              rotateX: 0,
              rotateY: -7,
              rotateZ: -2,
            }}
            animate={
              pending
                ? {
                    rotateX: finalRotation,
                    rotateY: [
                      -7,
                      -3,
                      4,
                      7,
                      4,
                      -2,
                      0,
                    ],
                    rotateZ: [
                      -2,
                      1,
                      2.5,
                      1,
                      -1,
                      0,
                    ],
                  }
                : result
                  ? {
                      rotateX: finalRotation,
                      rotateY: 0,
                      rotateZ: 0,
                    }
                  : {
                      rotateX: 0,
                      rotateY: -7,
                      rotateZ: -2,
                    }
            }
            transition={{
              duration: pending ? 1.9 : 0,
              ease: [0.16, 0.7, 0.18, 1],
            }}
            className="absolute inset-0"
            style={{
              transformStyle: "preserve-3d",
              willChange: "transform",
            }}
          >
            {/* COIN BODY / THICK EDGE */}
            <div
              className="absolute inset-[1px] rounded-full"
              style={{
                transform: "translateZ(0px)",
                background:
                  "linear-gradient(90deg,#26363b 0%,#8fa9ad 12%,#d7e8e9 25%,#657d82 42%,#d9e8e9 58%,#748d92 76%,#25373c 100%)",
                boxShadow:
                  "0 0 0 8px #52686d, 0 0 0 9px rgba(214,244,246,.18), inset 0 0 15px rgba(0,0,0,.65)",
              }}
            />

            {/* ÜZ */}
            <div
              className="absolute inset-0 overflow-hidden rounded-full border border-white/60"
              style={{
                transform: "translateZ(9px)",
                backfaceVisibility: "hidden",
                WebkitBackfaceVisibility: "hidden",
                background:
                  "radial-gradient(circle at 31% 22%, #ffffff 0%, #dff3f4 22%, #9eb9bd 62%, #53696e 100%)",
                boxShadow:
                  "inset 0 0 0 3px rgba(8,22,26,.15), inset 0 0 30px rgba(255,255,255,.32), inset 0 -25px 35px rgba(0,0,0,.18), 0 10px 35px rgba(0,0,0,.32)",
              }}
            >
              <div className="absolute inset-[8px] rounded-full border-2 border-[#26383d]/25" />
              <div className="absolute inset-[17px] rounded-full border border-white/40" />
              <div className="absolute inset-[25px] rounded-full border border-[#15272b]/15" />

              <div className="relative flex h-full w-full flex-col items-center justify-center">
                <div
                  className="flex h-[82px] w-[82px] items-center justify-center rounded-full border border-[#17292e]/20"
                  style={{
                    boxShadow:
                      "inset 0 3px 9px rgba(255,255,255,.32), inset 0 -4px 10px rgba(0,0,0,.13)",
                  }}
                >
                  <span className="select-none text-[52px] font-black leading-none tracking-[-0.1em] text-[#07161a]/80">
                    O
                  </span>
                </div>

                <span className="mt-2.5 text-[8px] font-black uppercase tracking-[0.27em] text-[#07161a]/55">
                  OCTOSON
                </span>

                <span className="mt-1 text-[7px] font-black uppercase tracking-[0.25em] text-[#07161a]/38">
                  ÜZ
                </span>
              </div>

              <div
                className="pointer-events-none absolute inset-0"
                style={{
                  background:
                    "linear-gradient(125deg,transparent 17%,rgba(255,255,255,.42) 36%,transparent 52%)",
                  mixBlendMode: "screen",
                }}
              />
            </div>

            {/* ARXA */}
            <div
              className="absolute inset-0 overflow-hidden rounded-full border border-cyan-100/25"
              style={{
                transform: "rotateX(180deg) translateZ(9px)",
                backfaceVisibility: "hidden",
                WebkitBackfaceVisibility: "hidden",
                background:
                  "radial-gradient(circle at 31% 22%,#344b51 0%,#17272c 42%,#0b1418 76%,#05090b 100%)",
                boxShadow:
                  "inset 0 0 0 3px rgba(165,243,252,.12), inset 0 0 30px rgba(165,243,252,.08), inset 0 -25px 35px rgba(0,0,0,.4), 0 10px 35px rgba(0,0,0,.4)",
              }}
            >
              <div className="absolute inset-[8px] rounded-full border-2 border-cyan-100/20" />
              <div className="absolute inset-[17px] rounded-full border border-white/[0.08]" />
              <div className="absolute inset-[25px] rounded-full border border-cyan-100/[0.07]" />

              <div className="relative flex h-full w-full flex-col items-center justify-center">
                <div className="relative flex h-[82px] w-[82px] items-center justify-center rounded-full border border-cyan-100/15">
                  <div className="absolute inset-[14px] rotate-45 rounded-[14px] border border-cyan-100/30" />
                  <div className="absolute inset-[25px] rotate-45 rounded-[8px] border border-cyan-100/20" />

                  <Coins
                    className="relative h-[34px] w-[34px] text-cyan-100/85"
                    strokeWidth={1.5}
                  />
                </div>

                <span className="mt-2.5 text-[8px] font-black uppercase tracking-[0.27em] text-cyan-100/75">
                  AURA
                </span>

                <span className="mt-1 text-[7px] font-black uppercase tracking-[0.25em] text-cyan-100/40">
                  ARXA
                </span>
              </div>

              <div
                className="pointer-events-none absolute inset-0"
                style={{
                  background:
                    "linear-gradient(125deg,transparent 18%,rgba(190,245,250,.13) 37%,transparent 53%)",
                }}
              />
            </div>
          </motion.div>
        </motion.div>

        {/* landing flash */}
        <AnimatePresence>
          {result && !pending && (
            <motion.div
              key={`coin-impact-${run}`}
              initial={{
                opacity: 0.28,
                scale: 0.45,
              }}
              animate={{
                opacity: 0,
                scale: 1.55,
              }}
              exit={{
                opacity: 0,
              }}
              transition={{
                duration: 0.55,
                ease: "easeOut",
              }}
              className="pointer-events-none absolute bottom-[28px] h-[22px] w-[145px] rounded-full border border-cyan-100/18"
            />
          )}
        </AnimatePresence>
      </div>

      <VisualText
        pending={pending}
        result={result}
        idle="Sikkə hazırdır"
        pendingText="Sikkə havadadır..."
      />
    </div>
  );
}

function DiceVisual({
  pending,
  result,
  run,
}: VisualProps) {
  const numbers = parseNumbers(
    result?.description
  );

  const player = numbers[0] ?? 6;
  const house = numbers[1] ?? 6;

  return (
    <div className="w-full max-w-xl">
      <div className="grid grid-cols-2 gap-5 sm:gap-10">
        <DiceBox
          key={`p-${run}`}
          label="SƏN"
          value={player}
          pending={pending}
          delay={0}
        />

        <DiceBox
          key={`h-${run}`}
          label="SİSTEM"
          value={house}
          pending={pending}
          delay={0.08}
        />
      </div>

      <VisualText
        pending={pending}
        result={result}
        idle="Zərlər hazırdır"
        pendingText="Zərlər atılır..."
      />
    </div>
  );
}

function DiceBox({
  label,
  value,
  pending,
  delay,
}: {
  label: string;
  value: number;
  pending: boolean;
  delay: number;
}) {
  return (
    <div className="text-center">
      <p className="mb-4 text-[9px] font-semibold tracking-[0.18em] text-white/20">
        {label}
      </p>

      <motion.div
        animate={
          pending
            ? {
                rotate: [
                  0,
                  90,
                  180,
                  270,
                  360,
                ],
                x: [0, -8, 7, -3, 0],
                y: [0, -15, 4, -7, 0],
              }
            : {
                rotate: 0,
                x: 0,
                y: 0,
              }
        }
        transition={{
          duration: 0.55,
          repeat: pending
            ? Infinity
            : 0,
          delay,
        }}
        className="mx-auto flex aspect-square w-full max-w-[170px] items-center justify-center rounded-[32px] border border-white/[0.11] bg-gradient-to-br from-white/[0.09] to-white/[0.025] shadow-[0_30px_80px_rgba(0,0,0,.3)]"
      >
        <DiceFace
          value={
            pending
              ? 1 +
                Math.floor(
                  Math.random() * 6
                )
              : value
          }
        />
      </motion.div>
    </div>
  );
}

function DiceFace({
  value,
}: {
  value: number;
}) {
  const positions: Record<
    number,
    string[]
  > = {
    1: ["mm"],
    2: ["tl", "br"],
    3: ["tl", "mm", "br"],
    4: ["tl", "tr", "bl", "br"],
    5: [
      "tl",
      "tr",
      "mm",
      "bl",
      "br",
    ],
    6: [
      "tl",
      "tr",
      "ml",
      "mr",
      "bl",
      "br",
    ],
  };

  const coords: Record<
    string,
    string
  > = {
    tl: "left-[24%] top-[24%]",
    tr: "right-[24%] top-[24%]",
    ml: "left-[24%] top-1/2 -translate-y-1/2",
    mm: "left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2",
    mr: "right-[24%] top-1/2 -translate-y-1/2",
    bl: "bottom-[24%] left-[24%]",
    br: "bottom-[24%] right-[24%]",
  };

  return (
    <div className="relative h-full w-full">
      {(positions[value] ??
        positions[1]).map(
        (position) => (
          <span
            key={position}
            className={`absolute h-4 w-4 rounded-full bg-cyan-50/80 shadow-[0_0_16px_rgba(207,250,254,.2)] ${coords[position]}`}
          />
        )
      )}
    </div>
  );
}

function RouletteVisual({
  pending,
  result,
  run,
}: VisualProps) {
  const roulette = parseRoulette(
    result?.description
  );

  const segments = Array.from({
    length: 18,
  });

  return (
    <div className="flex flex-col items-center">
      <div className="relative h-72 w-72 sm:h-80 sm:w-80">
        <motion.div
          key={run}
          animate={{
            rotate: pending
              ? 2160
              : result
                ? 1440
                : 0,
          }}
          transition={{
            duration: pending
              ? 3.4
              : 1,
            ease: pending
              ? [0.12, 0.72, 0.18, 1]
              : "easeOut",
          }}
          className="absolute inset-0 rounded-full border border-white/[0.12] bg-[#111216] shadow-[0_35px_100px_rgba(0,0,0,.45)]"
        >
          {segments.map((_, index) => (
            <div
              key={index}
              className="absolute left-1/2 top-1/2 h-[48%] w-[2px] origin-bottom bg-white/[0.07]"
              style={{
                transform: `translate(-50%,-100%) rotate(${
                  index * 20
                }deg)`,
              }}
            />
          ))}

          <div className="absolute inset-[12%] rounded-full border border-white/[0.09] bg-[#090a0d]" />

          <div className="absolute inset-[31%] rounded-full border border-cyan-100/[0.12] bg-[#0d1013] shadow-[inset_0_0_35px_rgba(103,232,249,.04)]" />

          <div className="absolute left-1/2 top-[7%] h-3 w-3 -translate-x-1/2 rounded-full bg-cyan-100 shadow-[0_0_16px_rgba(207,250,254,.6)]" />
        </motion.div>

        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <motion.p
              key={
                result
                  ? roulette.number
                  : "idle"
              }
              initial={{
                scale: 0.7,
                opacity: 0,
              }}
              animate={{
                scale: 1,
                opacity: 1,
              }}
              className="text-[48px] font-semibold tracking-[-0.06em] text-white/85"
            >
              {pending
                ? "•"
                : result
                  ? roulette.number
                  : "00"}
            </motion.p>

            <p
              className={`mt-1 text-[9px] font-semibold uppercase tracking-[0.16em] ${
                roulette.color === "red"
                  ? "text-red-200/60"
                  : roulette.color ===
                      "green"
                    ? "text-emerald-200/60"
                    : "text-white/25"
              }`}
            >
              {pending
                ? "FIRLANIR"
                : result
                  ? roulette.label
                  : "ROULETTE"}
            </p>
          </div>
        </div>
      </div>

      <VisualText
        pending={pending}
        result={result}
        idle="Çarx hazırdır"
        pendingText="Top hərəkətdədir..."
      />
    </div>
  );
}

function CrashVisual({
  pending,
  result,
  cashout,
  run,
}: VisualProps & {
  cashout: string;
}) {
  const numbers = parseNumbers(
    result?.description
  );

  const finalCrash =
    numbers.length >= 2
      ? numbers[numbers.length - 1]
      : null;

  return (
    <div className="w-full max-w-2xl">
      <div className="relative h-[300px] overflow-hidden rounded-[24px] border border-white/[0.06] bg-black/20">
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,.25) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.25) 1px, transparent 1px)",
            backgroundSize:
              "48px 48px",
          }}
        />

        <div className="absolute bottom-7 left-7 right-7 top-7">
          <svg
            viewBox="0 0 600 240"
            className="h-full w-full overflow-visible"
          >
            <motion.path
              key={run}
              d="M 0 220 C 150 215, 250 190, 350 135 C 450 80, 520 35, 590 8"
              fill="none"
              stroke="rgba(165,243,252,.75)"
              strokeWidth="4"
              strokeLinecap="round"
              initial={{
                pathLength: 0,
              }}
              animate={{
                pathLength: pending
                  ? 0.9
                  : result
                    ? 1
                    : 0.18,
              }}
              transition={{
                duration: pending
                  ? 2.8
                  : 0.8,
                ease: "easeOut",
              }}
            />

            <motion.circle
              key={`dot-${run}`}
              r="7"
              fill="rgb(207,250,254)"
              initial={{
                cx: 0,
                cy: 220,
              }}
              animate={
                pending
                  ? {
                      cx: 520,
                      cy: 35,
                    }
                  : result
                    ? {
                        cx: 590,
                        cy: 8,
                      }
                    : {
                        cx: 100,
                        cy: 212,
                      }
              }
              transition={{
                duration: pending
                  ? 2.8
                  : 0.8,
                ease: "easeOut",
              }}
            />
          </svg>
        </div>

        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <motion.p
              key={`${run}-${pending}`}
              animate={
                pending
                  ? {
                      scale: [1, 1.04, 1],
                    }
                  : {}
              }
              transition={{
                duration: 0.5,
                repeat: pending
                  ? Infinity
                  : 0,
              }}
              className={`text-[58px] font-semibold tracking-[-0.07em] ${
                result &&
                Number(
                  result.multiplier ?? 0
                ) === 0
                  ? "text-red-200/80"
                  : "text-cyan-50/90"
              }`}
            >
              {pending
                ? `${cashout || "2.00"}x`
                : finalCrash
                  ? `${finalCrash.toFixed(
                      2
                    )}x`
                  : "1.00x"}
            </motion.p>

            <p className="mt-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-white/20">
              {pending
                ? "MULTIPLIER YÜKSƏLİR"
                : result
                  ? "CRASH"
                  : "RAUND HAZIRDIR"}
            </p>
          </div>
        </div>
      </div>

      <VisualText
        pending={pending}
        result={result}
        idle="Auto cashout nöqtəni seç"
        pendingText="Multiplier yüksəlir..."
      />
    </div>
  );
}

function WheelVisual({
  pending,
  result,
  run,
}: VisualProps) {
  const values = [
    "0X",
    "2X",
    ".4X",
    "2.4X",
    ".8X",
    "1.2X",
    "0X",
    "2X",
  ];

  const sliceAngle = 360 / values.length;

  const resultMultiplier =
    typeof result?.multiplier === "number"
      ? result.multiplier
      : null;

  /*
   * Find a segment matching the actual result.
   * Duplicate values intentionally use run so the wheel
   * doesn't always stop on the same duplicate segment.
   */
  const matchingIndexes =
    resultMultiplier === null
      ? []
      : values
          .map((value, index) => ({
            index,
            number: Number(
              value.replace("X", "")
            ),
          }))
          .filter(
            (entry) =>
              Math.abs(
                entry.number - resultMultiplier
              ) < 0.001
          )
          .map((entry) => entry.index);

  const winnerIndex =
    matchingIndexes.length > 0
      ? matchingIndexes[
          run % matchingIndexes.length
        ]
      : 0;

  /*
   * Pointer is at 12 o'clock.
   * Segment center starts at 12 o'clock.
   * Five full turns + exact winning segment.
   */
  const finalRotation =
    1800 - winnerIndex * sliceAngle;

  const wheelRotation = pending
    ? finalRotation
    : result
      ? finalRotation
      : 0;

  return (
    <div className="flex w-full flex-col items-center">
      <div className="relative flex h-[340px] w-[340px] items-center justify-center sm:h-[380px] sm:w-[380px]">
        {/* ambient light */}
        <div className="pointer-events-none absolute inset-[15%] rounded-full bg-cyan-200/[0.055] blur-[65px]" />

        {/* pointer */}
        <div className="absolute left-1/2 top-[1px] z-30 -translate-x-1/2">
          <div
            className="h-[30px] w-[26px]"
            style={{
              clipPath:
                "polygon(0 0,100% 0,50% 100%)",
              background:
                "linear-gradient(180deg,#e9fdff,#9eeaf2)",
              filter:
                "drop-shadow(0 5px 10px rgba(103,232,249,.22))",
            }}
          />
        </div>

        {/* outer housing */}
        <div className="absolute inset-[17px] rounded-full border border-white/[0.1] bg-[#080a0d] shadow-[0_35px_100px_rgba(0,0,0,.5)]" />

        <div className="absolute inset-[24px] rounded-full border border-cyan-100/[0.08]" />

        {/* rotating wheel */}
        <motion.div
          key={`wheel-${run}`}
          initial={{
            rotate: 0,
          }}
          animate={{
            rotate: wheelRotation,
          }}
          transition={{
            duration: pending ? 3.35 : 0,
            ease: [0.08, 0.62, 0.12, 1],
          }}
          className="absolute inset-[31px] overflow-hidden rounded-full border border-white/[0.1]"
          style={{
            willChange: "transform",
            background: `
              conic-gradient(
                from -22.5deg,
                #12171c 0deg 45deg,
                #1a262b 45deg 90deg,
                #101419 90deg 135deg,
                #1b2d32 135deg 180deg,
                #11161a 180deg 225deg,
                #1b272c 225deg 270deg,
                #101419 270deg 315deg,
                #19282d 315deg 360deg
              )
            `,
            boxShadow:
              "inset 0 0 35px rgba(0,0,0,.55), inset 0 0 0 1px rgba(255,255,255,.025)",
          }}
        >
          {/* wedge separators */}
          {values.map((_, index) => {
            const angle =
              index * sliceAngle -
              sliceAngle / 2;

            return (
              <div
                key={`separator-${index}`}
                className="absolute left-1/2 top-1/2 h-1/2 w-px origin-bottom bg-white/[0.075]"
                style={{
                  transform:
                    `translate(-50%,-100%) rotate(${angle}deg)`,
                }}
              />
            );
          })}

          {/* labels */}
          {values.map((value, index) => {
            const angle =
              index * sliceAngle;

            /*
             * Label follows its wedge.
             * We position the whole label around the circle
             * instead of counter-rotating floating text.
             */
            return (
              <div
                key={`${value}-${index}`}
                className="absolute left-1/2 top-1/2 h-1/2 w-[58px] origin-bottom"
                style={{
                  transform:
                    `translate(-50%,-100%) rotate(${angle}deg)`,
                }}
              >
                <div className="flex h-full w-full justify-center pt-[24px]">
                  <span
                    className={`whitespace-nowrap text-[11px] font-bold tracking-[-0.02em] ${
                      value === "2.4X"
                        ? "text-cyan-100/95"
                        : value === "0X"
                          ? "text-white/30"
                          : "text-white/68"
                    }`}
                  >
                    {value}
                  </span>
                </div>
              </div>
            );
          })}

          {/* inner rings */}
          <div className="absolute inset-[23%] rounded-full border border-white/[0.075] bg-[#090c0f] shadow-[0_0_35px_rgba(0,0,0,.4)]" />

          <div className="absolute inset-[34%] rounded-full border border-cyan-100/[0.1] bg-[#0d1316]" />

          <div className="absolute inset-[43%] rounded-full border border-cyan-100/[0.2] bg-cyan-100/75 shadow-[0_0_30px_rgba(165,243,252,.16)]" />

          <div className="absolute inset-[46%] rounded-full bg-[#081014]" />

          {/* glass highlight */}
          <div
            className="pointer-events-none absolute inset-0 rounded-full"
            style={{
              background:
                "linear-gradient(125deg,rgba(255,255,255,.08),transparent 32%,transparent 66%,rgba(165,243,252,.025))",
            }}
          />
        </motion.div>

        {/* pointer axle cap */}
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-20 h-[22px] w-[22px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/20 bg-[#d8f5f6] shadow-[0_0_25px_rgba(165,243,252,.15)]">
          <div className="absolute inset-[6px] rounded-full bg-[#152327]" />
        </div>
      </div>

      <VisualText
        pending={pending}
        result={result}
        idle="Çarxı fırlat"
        pendingText="Çarx fırlanır..."
      />
    </div>
  );
}

function RpsVisual({
  pending,
  result,
  choice,
  run,
}: VisualProps & {
  choice: string;
}) {
  const [player, house] = parseRps(
    result?.description
  );

  const symbols: Record<string, string> = {
    rock: "✊",
    paper: "✋",
    scissors: "✌️",
    Daş: "✊",
    Kağız: "✋",
    Qayçı: "✌️",
  };

  const labels: Record<string, string> = {
    rock: "Daş",
    paper: "Kağız",
    scissors: "Qayçı",
    Daş: "Daş",
    Kağız: "Kağız",
    Qayçı: "Qayçı",
  };

  const selectedSymbol =
    symbols[choice] ?? "✊";

  const selectedLabel =
    labels[choice] ?? "Daş";

  const playerSymbol = result
    ? symbols[player] ?? selectedSymbol
    : selectedSymbol;

  const playerLabel = result
    ? labels[player] ?? selectedLabel
    : selectedLabel;

  const houseSymbol =
    result && !pending
      ? symbols[house] ?? "?"
      : "?";

  const houseLabel =
    result && !pending
      ? labels[house] ?? "?"
      : "Gizli";

  return (
    <div className="w-full max-w-[660px]">
      <div className="mb-7 text-center">
        <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-white/22">
          Sənin seçimin
        </p>

        <motion.div
          key={choice}
          initial={{
            opacity: 0,
            y: 4,
            scale: 0.94,
          }}
          animate={{
            opacity: 1,
            y: 0,
            scale: 1,
          }}
          className="mt-2 inline-flex items-center gap-2 rounded-full border border-cyan-100/[0.13] bg-cyan-100/[0.055] px-4 py-2"
        >
          <span className="text-[18px]">
            {selectedSymbol}
          </span>

          <span className="text-[11px] font-semibold text-cyan-50/80">
            {selectedLabel}
          </span>
        </motion.div>
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-stretch gap-3 sm:gap-6">
        <motion.div
          key={`player-panel-${choice}`}
          initial={{
            opacity: 0.7,
            scale: 0.98,
          }}
          animate={{
            opacity: 1,
            scale: 1,
          }}
          className="rounded-[24px] border border-cyan-100/[0.1] bg-cyan-100/[0.035] p-4 sm:p-6"
        >
          <p className="text-center text-[8px] font-semibold uppercase tracking-[0.18em] text-cyan-100/45">
            SƏN
          </p>

          <div className="mt-4">
            <RpsHand
              key={`you-${run}-${choice}`}
              label=""
              symbol={playerSymbol}
              pending={pending}
            />
          </div>

          <motion.p
            key={playerLabel}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-3 text-center text-[12px] font-semibold text-white/75"
          >
            {playerLabel}
          </motion.p>
        </motion.div>

        <div className="flex flex-col items-center justify-center">
          <motion.div
            animate={
              pending
                ? {
                    scale: [1, 1.15, 1],
                    opacity: [0.25, 0.7, 0.25],
                  }
                : {
                    scale: 1,
                    opacity: 1,
                  }
            }
            transition={{
              duration: 0.55,
              repeat: pending ? 2 : 0,
            }}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/[0.08] bg-black/30 text-[9px] font-bold tracking-[0.12em] text-white/30"
          >
            VS
          </motion.div>
        </div>

        <div className="rounded-[24px] border border-white/[0.075] bg-white/[0.025] p-4 sm:p-6">
          <p className="text-center text-[8px] font-semibold uppercase tracking-[0.18em] text-white/28">
            SİSTEM
          </p>

          <div className="mt-4">
            <RpsHand
              key={`house-${run}`}
              label=""
              symbol={houseSymbol}
              pending={pending}
              reverse
            />
          </div>

          <motion.p
            key={houseLabel}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-3 text-center text-[12px] font-semibold text-white/55"
          >
            {houseLabel}
          </motion.p>
        </div>
      </div>

      {!result && !pending && (
        <p className="mt-6 text-center text-[10px] text-white/28">
          Aşağıdan Daş, Kağız və ya Qayçı seç.
        </p>
      )}

      <VisualText
        pending={pending}
        result={result}
        idle=""
        pendingText="Daş • Kağız • Qayçı..."
      />
    </div>
  );
}

function RpsHand({
  label,
  symbol,
  pending,
  reverse = false,
}: {
  label: string;
  symbol: string;
  pending: boolean;
  reverse?: boolean;
}) {
  return (
    <div className="text-center">
      <p className="mb-4 text-[9px] font-semibold tracking-[0.16em] text-white/20">
        {label}
      </p>

      <motion.div
        animate={
          pending
            ? {
                rotate: reverse
                  ? [0, 15, -10, 0]
                  : [0, -15, 10, 0],
                y: [0, -12, 0],
              }
            : {
                rotate: 0,
                y: 0,
              }
        }
        transition={{
          duration: 0.45,
          repeat: pending
            ? Infinity
            : 0,
        }}
        className="mx-auto flex aspect-square max-w-[180px] items-center justify-center rounded-[36px] border border-white/[0.08] bg-white/[0.025] text-[72px]"
      >
        {symbol}
      </motion.div>
    </div>
  );
}

function CardTableVisual({
  kind,
  pending,
  result,
  run,
}: VisualProps & {
  kind: "poker" | "baccarat";
}) {
  const pokerCards = [
    ["A", "♠"],
    ["K", "♦"],
    ["Q", "♣"],
    ["J", "♥"],
    ["10", "♠"],
  ];

  return (
    <div className="w-full max-w-2xl">
      <div className="relative min-h-[310px] rounded-[120px] border border-emerald-200/[0.08] bg-emerald-300/[0.025] p-8 shadow-[inset_0_0_80px_rgba(52,211,153,.025)]">
        {kind === "poker" ? (
          <div className="flex h-full min-h-[245px] items-center justify-center">
            <div className="flex -space-x-4 sm:-space-x-2">
              {pokerCards.map(
                ([rank, suit], index) => (
                  <PlayingCard
                    key={`${run}-${index}`}
                    rank={rank}
                    suit={suit}
                    pending={pending}
                    delay={index * 0.09}
                    rotate={
                      (index - 2) * 4
                    }
                  />
                )
              )}
            </div>
          </div>
        ) : (
          <div className="grid min-h-[245px] grid-cols-2 items-center gap-8">
            <div className="text-center">
              <p className="mb-5 text-[9px] font-semibold tracking-[0.16em] text-white/20">
                OYUNÇU
              </p>

              <div className="flex justify-center -space-x-5">
                <PlayingCard
                  key={`bp1-${run}`}
                  rank="8"
                  suit="♠"
                  pending={pending}
                  delay={0}
                  rotate={-5}
                />

                <PlayingCard
                  key={`bp2-${run}`}
                  rank="A"
                  suit="♦"
                  pending={pending}
                  delay={0.12}
                  rotate={5}
                />
              </div>
            </div>

            <div className="text-center">
              <p className="mb-5 text-[9px] font-semibold tracking-[0.16em] text-white/20">
                BANKİR
              </p>

              <div className="flex justify-center -space-x-5">
                <PlayingCard
                  key={`bb1-${run}`}
                  rank="K"
                  suit="♣"
                  pending={pending}
                  delay={0.2}
                  rotate={-5}
                />

                <PlayingCard
                  key={`bb2-${run}`}
                  rank="7"
                  suit="♥"
                  pending={pending}
                  delay={0.32}
                  rotate={5}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      <VisualText
        pending={pending}
        result={result}
        idle={
          kind === "poker"
            ? "Kartları aç"
            : "Mərc tərəfini seç"
        }
        pendingText="Kartlar paylanır..."
      />
    </div>
  );
}

function PlayingCard({
  rank,
  suit,
  pending,
  delay,
  rotate,
}: {
  rank: string;
  suit: string;
  pending: boolean;
  delay: number;
  rotate: number;
}) {
  const red =
    suit === "♦" || suit === "♥";

  return (
    <motion.div
      initial={{
        opacity: 0,
        y: -70,
        x: 50,
        rotate: rotate + 12,
      }}
      animate={{
        opacity: 1,
        y: 0,
        x: 0,
        rotate,
        rotateY: pending
          ? 180
          : 0,
      }}
      transition={{
        delay,
        duration: 0.5,
        type: "spring",
      }}
      className="relative h-36 w-24 rounded-[14px] border border-white/10 bg-[#e9edf0] p-3 shadow-[0_20px_50px_rgba(0,0,0,.35)] sm:h-40 sm:w-28"
      style={{
        transformStyle: "preserve-3d",
      }}
    >
      {pending ? (
        <div className="absolute inset-2 rounded-[10px] border border-[#071014]/15 bg-[#10161b]">
          <div
            className="absolute inset-0 opacity-20"
            style={{
              backgroundImage:
                "radial-gradient(circle, rgba(165,243,252,.8) 1px, transparent 1px)",
              backgroundSize:
                "8px 8px",
            }}
          />
        </div>
      ) : (
        <>
          <p
            className={`text-[20px] font-bold ${
              red
                ? "text-red-600"
                : "text-[#101216]"
            }`}
          >
            {rank}
          </p>

          <p
            className={`text-[26px] ${
              red
                ? "text-red-600"
                : "text-[#101216]"
            }`}
          >
            {suit}
          </p>

          <p
            className={`absolute bottom-3 right-3 rotate-180 text-[24px] ${
              red
                ? "text-red-600"
                : "text-[#101216]"
            }`}
          >
            {suit}
          </p>
        </>
      )}
    </motion.div>
  );
}

function HorseVisual({
  pending,
  result,
  choice,
  run,
}: VisualProps & {
  choice: string;
}) {
  const parsed = parseHorse(
    result?.description
  );

  return (
    <div className="w-full max-w-2xl">
      <div className="overflow-hidden rounded-[20px] border border-white/[0.06] bg-black/20 p-4">
        {Array.from({
          length: 6,
        }).map((_, index) => {
          const horse = index + 1;

          const winner =
            parsed.winner === horse;

          const selected =
            Number(choice) === horse;

          return (
            <div
              key={`${run}-${horse}`}
              className={`relative mb-2 h-12 overflow-hidden rounded-[10px] border last:mb-0 ${
                selected
                  ? "border-cyan-100/[0.11] bg-cyan-100/[0.025]"
                  : "border-white/[0.045] bg-white/[0.012]"
              }`}
            >
              <div className="absolute bottom-0 left-0 right-0 border-b border-dashed border-white/[0.05]" />

              <motion.div
                initial={{
                  left: "2%",
                }}
                animate={
                  pending
                    ? {
                        left: [
                          "2%",
                          `${20 + horse * 4}%`,
                          `${40 +
                            ((horse * 9) %
                              15)}%`,
                          `${62 +
                            ((horse * 7) %
                              20)}%`,
                        ],
                      }
                    : result
                      ? {
                          left: winner
                            ? "88%"
                            : `${55 +
                                ((horse *
                                  7) %
                                  25)}%`,
                        }
                      : {
                          left: "2%",
                        }
                }
                transition={{
                  duration: pending
                    ? 1.2
                    : 0.8,
                  repeat: pending
                    ? Infinity
                    : 0,
                  ease: "easeInOut",
                }}
                className="absolute top-1/2 -translate-y-1/2 text-[25px]"
              >
                🐎
              </motion.div>

              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[8px] font-semibold text-white/18">
                #{horse}
              </span>

              <div className="absolute bottom-0 right-[6%] top-0 border-r border-dashed border-white/10" />
            </div>
          );
        })}
      </div>

      <VisualText
        pending={pending}
        result={result}
        idle={`At #${choice || "1"} seçilib`}
        pendingText="Yarış başladı..."
      />
    </div>
  );
}

function PenaltyVisual({
  pending,
  result,
  choice,
  run,
}: VisualProps & {
  choice: string;
}) {
  const parsed = parsePenalty(
    result?.description
  );

  const directionX: Record<
    string,
    string
  > = {
    left: "-115px",
    center: "0px",
    right: "115px",
    Sol: "-115px",
    Orta: "0px",
    Sağ: "115px",
  };

  return (
    <div className="w-full max-w-xl">
      <div className="relative mx-auto h-[320px] max-w-[520px] overflow-hidden rounded-[24px] border border-white/[0.06] bg-gradient-to-b from-[#0a1214] to-[#08100d]">
        <div className="absolute left-[12%] right-[12%] top-[12%] h-[54%] border-[5px] border-white/55">
          <div
            className="absolute inset-0 opacity-[0.12]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.5) 1px, transparent 1px)",
              backgroundSize:
                "25px 25px",
            }}
          />

          <motion.div
            key={`keeper-${run}`}
            animate={
              pending
                ? {
                    x: [
                      0,
                      -80,
                      80,
                      -30,
                      0,
                    ],
                  }
                : result
                  ? {
                      x:
                        directionX[
                          parsed.keeper
                        ] ?? "0px",
                    }
                  : {
                      x: 0,
                    }
            }
            transition={{
              duration: pending
                ? 0.7
                : 0.5,
              repeat: pending
                ? Infinity
                : 0,
            }}
            className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[46px]"
          >
            🧤
          </motion.div>
        </div>

        <motion.div
          key={`ball-${run}`}
          initial={{
            x: 0,
            y: 0,
            scale: 1,
          }}
          animate={
            pending
              ? {
                  x:
                    directionX[
                      choice
                    ] ?? "0px",
                  y: -175,
                  scale: 0.55,
                }
              : result
                ? {
                    x:
                      directionX[
                        parsed.shot
                      ] ?? "0px",
                    y: -175,
                    scale: 0.55,
                  }
                : {
                    x: 0,
                    y: 0,
                    scale: 1,
                  }
          }
          transition={{
            duration: 0.65,
            type: "spring",
          }}
          className="absolute bottom-7 left-1/2 -translate-x-1/2 text-[42px]"
        >
          ⚽
        </motion.div>

        <div className="absolute bottom-0 left-0 right-0 h-1/3 bg-emerald-300/[0.025]" />
      </div>

      <VisualText
        pending={pending}
        result={result}
        idle="Zərbə istiqamətini seç"
        pendingText="Zərbə vurulur..."
      />
    </div>
  );
}

function LotteryVisual({
  pending,
  result,
  run,
}: VisualProps) {
  return (
    <div className="flex flex-col items-center">
      <motion.div
        key={run}
        initial={{
          rotate: -3,
          scale: 0.96,
        }}
        animate={
          pending
            ? {
                rotate: [-3, 2, -2, 1, 0],
                scale: [0.96, 1.03, 1],
              }
            : {
                rotate: -2,
                scale: 1,
              }
        }
        transition={{
          duration: 0.8,
          repeat: pending
            ? Infinity
            : 0,
        }}
        className="relative h-64 w-[390px] max-w-[90vw] overflow-hidden rounded-[24px] border border-cyan-100/[0.13] bg-gradient-to-br from-cyan-100/[0.08] via-white/[0.025] to-blue-400/[0.035] p-7 shadow-[0_30px_100px_rgba(103,232,249,.07)]"
      >
        <div className="absolute -left-3 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-[#08090c]" />

        <div className="absolute -right-3 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-[#08090c]" />

        <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-cyan-100/35">
          OCTOSON
        </p>

        <p className="mt-3 text-[28px] font-semibold tracking-[-0.05em] text-white/85">
          AURA LOTTERY
        </p>

        <div className="mt-7 grid grid-cols-3 gap-3">
          {[1, 2, 3].map(
            (item) => (
              <motion.div
                key={item}
                animate={
                  pending
                    ? {
                        opacity: [
                          0.2,
                          0.8,
                          0.2,
                        ],
                      }
                    : {}
                }
                transition={{
                  delay:
                    item * 0.1,
                  duration: 0.5,
                  repeat: pending
                    ? Infinity
                    : 0,
                }}
                className="flex h-16 items-center justify-center rounded-[12px] border border-white/[0.07] bg-black/20"
              >
                <Sparkles className="h-5 w-5 text-cyan-100/35" />
              </motion.div>
            )
          )}
        </div>

        <p className="absolute bottom-5 right-7 font-mono text-[9px] tracking-[0.15em] text-white/15">
          #AURA-{String(run).padStart(
            4,
            "0"
          )}
        </p>
      </motion.div>

      <VisualText
        pending={pending}
        result={result}
        idle="Bilet hazırdır"
        pendingText="Bilet açılır..."
      />
    </div>
  );
}

function JackpotVisual({
  pending,
  result,
  run,
}: VisualProps) {
  const won =
    result?.ok &&
    Number(result.net ?? 0) > 0;

  const reels = won
    ? ["◆", "◆", "◆"]
    : ["◆", "●", "▲"];

  return (
    <div className="flex w-full max-w-xl flex-col items-center">
      <motion.div
        animate={
          won
            ? {
                scale: [
                  1,
                  1.04,
                  1,
                  1.025,
                  1,
                ],
              }
            : {}
        }
        transition={{
          duration: 0.8,
        }}
        className={`relative w-full overflow-hidden rounded-[30px] border p-7 ${
          won
            ? "border-amber-200/[0.16] bg-amber-200/[0.025] shadow-[0_0_100px_rgba(253,230,138,.06)]"
            : "border-white/[0.07] bg-black/20"
        }`}
      >
        <div className="mb-7 flex items-center justify-between">
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-white/20">
              OCTOSON
            </p>

            <p className="mt-1 text-[20px] font-semibold tracking-[-0.04em] text-white/70">
              JACKPOT
            </p>
          </div>

          <Crown className="h-6 w-6 text-amber-100/40" />
        </div>

        <div className="grid grid-cols-3 gap-3">
          {reels.map(
            (symbol, index) => (
              <motion.div
                key={`${run}-${index}`}
                animate={
                  pending
                    ? {
                        y: [
                          -20,
                          20,
                          -35,
                          15,
                          0,
                        ],
                        filter: [
                          "blur(0px)",
                          "blur(5px)",
                          "blur(2px)",
                          "blur(5px)",
                          "blur(0px)",
                        ],
                      }
                    : {
                        y: 0,
                        filter:
                          "blur(0px)",
                      }
                }
                transition={{
                  duration: 0.45,
                  delay:
                    index * 0.06,
                  repeat: pending
                    ? Infinity
                    : 0,
                }}
                className="flex aspect-square items-center justify-center rounded-[18px] border border-white/[0.08] bg-white/[0.025] text-[42px] text-cyan-50/70"
              >
                {pending
                  ? ["◆", "●", "▲"][
                      (index +
                        run) %
                        3
                    ]
                  : symbol}
              </motion.div>
            )
          )}
        </div>

        <div className="mt-6 flex items-center justify-between border-t border-white/[0.05] pt-5">
          <span className="text-[9px] text-white/18">
            MAX MULTIPLIER
          </span>

          <span className="text-[22px] font-semibold text-amber-100/65">
            25.0X
          </span>
        </div>
      </motion.div>

      <VisualText
        pending={pending}
        result={result}
        idle="Jackpot raundu hazırdır"
        pendingText="Jackpot açılır..."
      />
    </div>
  );
}

type VisualProps = {
  pending: boolean;
  result: CasinoPlayResult | null;
  run: number;
};

function VisualText({
  pending,
  result,
  idle,
  pendingText,
}: {
  pending: boolean;
  result: CasinoPlayResult | null;
  idle: string;
  pendingText: string;
}) {
  const won =
    result?.ok &&
    Number(result.net ?? 0) > 0;

  const lost =
    result?.ok &&
    Number(result.net ?? 0) < 0;

  return (
    <div className="mt-7 min-h-[72px] text-center">
      <AnimatePresence mode="wait">
        <motion.div
          key={
            pending
              ? "pending"
              : result
                ? result.message
                : "idle"
          }
          initial={{
            opacity: 0,
            y: 7,
          }}
          animate={{
            opacity: 1,
            y: 0,
          }}
          exit={{
            opacity: 0,
            y: -5,
          }}
        >
          {pending ? (
            <>
              <p className="text-[13px] font-semibold text-cyan-50/65">
                {pendingText}
              </p>

              <div className="mx-auto mt-3 flex w-fit gap-1">
                {[0, 1, 2].map(
                  (item) => (
                    <motion.span
                      key={item}
                      animate={{
                        opacity: [
                          0.15,
                          0.8,
                          0.15,
                        ],
                        y: [0, -3, 0],
                      }}
                      transition={{
                        duration: 0.8,
                        delay:
                          item * 0.12,
                        repeat: Infinity,
                      }}
                      className="h-1 w-1 rounded-full bg-cyan-100"
                    />
                  )
                )}
              </div>
            </>
          ) : result ? (
            <>
              {result.title && (
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/25">
                  {result.title}
                </p>
              )}

              {result.description && (
                <p className="mt-2 text-[11px] text-white/35">
                  {result.description}
                </p>
              )}

              <motion.p
                initial={{
                  scale: 0.92,
                }}
                animate={{
                  scale: 1,
                }}
                className={`mt-2 text-[26px] font-semibold tracking-[-0.04em] ${
                  !result.ok
                    ? "text-red-200/75"
                    : won
                      ? "text-emerald-200/85"
                      : lost
                        ? "text-red-200/75"
                        : "text-white/65"
                }`}
              >
                {result.message}
              </motion.p>
            </>
          ) : (
            <>
              <p className="text-[13px] font-semibold text-white/45">
                {idle}
              </p>

              <p className="mt-1.5 text-[9px] text-white/16">
                Mərcini təyin et və raundu başlat.
              </p>
            </>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function WinParticles() {
  const particles = useMemo(
    () =>
      Array.from({
        length: 18,
      }).map((_, index) => ({
        id: index,
        x:
          Math.random() *
            100 -
          50,
        y:
          -40 -
          Math.random() * 100,
        rotate:
          Math.random() * 300,
        delay:
          Math.random() * 0.25,
      })),
    []
  );

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {particles.map(
        (particle) => (
          <motion.span
            key={particle.id}
            initial={{
              left: "50%",
              top: "55%",
              opacity: 0,
              scale: 0,
            }}
            animate={{
              x: `${particle.x}vw`,
              y: particle.y,
              rotate:
                particle.rotate,
              opacity: [
                0,
                0.75,
                0,
              ],
              scale: [
                0,
                1,
                0.4,
              ],
            }}
            transition={{
              duration:
                1.1 +
                Math.random() *
                  0.7,
              delay:
                particle.delay,
              ease: "easeOut",
            }}
            className="absolute h-1.5 w-1.5 rounded-[2px] bg-cyan-100/70 shadow-[0_0_12px_rgba(165,243,252,.5)]"
          />
        )
      )}
    </div>
  );
}

function Quick({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="rounded-[8px] border border-white/[0.06] bg-white/[0.02] px-3 py-1.5 text-[9px] text-white/30 transition hover:bg-white/[0.05] hover:text-white/60 disabled:opacity-25"
    >
      {children}
    </button>
  );
}
