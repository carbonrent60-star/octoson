"use client";

import {
  useEffect,
  useState,
  useTransition,
} from "react";

import {
  useRouter,
} from "next/navigation";

import {
  AnimatePresence,
  motion,
} from "motion/react";

import {
  ArrowLeft,
  CircleDollarSign,
  LoaderCircle,
  Sparkles,
  WalletCards,
} from "lucide-react";

import {
  getLatestBaccaratAction,
  startBaccaratAction,
  type BaccaratCard,
  type BaccaratChoice,
  type BaccaratSession,
} from "./actions";

import {
  useOctosonAudio,
} from "@/components/audio/octoson-audio";

function aura(
  value: number
) {
  return Math.max(
    0,
    Math.floor(value)
  ).toLocaleString(
    "en-US"
  );
}

function symbol(
  suit: BaccaratCard["suit"]
) {
  switch (suit) {
    case "hearts":
      return "♥";

    case "diamonds":
      return "♦";

    case "clubs":
      return "♣";

    default:
      return "♠";
  }
}

function redSuit(
  suit: BaccaratCard["suit"]
) {
  return (
    suit === "hearts" ||
    suit === "diamonds"
  );
}

function BaccaratCardView({
  card,
  index,
  side,
  run,
}: {
  card: BaccaratCard;
  index: number;
  side:
    | "player"
    | "banker";
  run: number;
}) {
  const suit =
    symbol(card.suit);

  const red =
    redSuit(card.suit);

  return (
    <motion.div
      key={`${run}-${side}-${index}-${card.rank}-${card.suit}`}
      initial={{
        opacity: 0,
        y: -70,
        x:
          side === "player"
            ? 28
            : -28,
        rotate:
          side === "player"
            ? 7
            : -7,
        scale: 0.8,
      }}
      animate={{
        opacity: 1,
        y: 0,
        x: 0,
        rotate:
          index === 2
            ? side === "player"
              ? -5
              : 5
            : 0,
        scale: 1,
      }}
      transition={{
        delay:
          0.12 +
          index * 0.22 +
          (side === "banker"
            ? 0.1
            : 0),

        type: "spring",
        stiffness: 190,
        damping: 18,
      }}
      className="relative h-[150px] w-[102px] shrink-0 overflow-hidden rounded-[13px] border border-[#e4dccb]/80 bg-[#f5f0e5] shadow-[0_22px_55px_rgba(0,0,0,.32)] sm:h-[180px] sm:w-[122px]"
    >
      <div className="absolute inset-[5px] rounded-[9px] border border-black/[0.06]" />

      <div
        className={`absolute left-3 top-2.5 ${
          red
            ? "text-[#a82d3c]"
            : "text-[#17191c]"
        }`}
      >
        <p className="text-[20px] font-bold leading-none sm:text-[24px]">
          {card.rank}
        </p>

        <p className="mt-1 text-[17px] leading-none sm:text-[20px]">
          {suit}
        </p>
      </div>

      <div
        className={`absolute inset-0 flex items-center justify-center ${
          red
            ? "text-[#a82d3c]"
            : "text-[#17191c]"
        }`}
      >
        <span className="text-[42px] sm:text-[50px]">
          {suit}
        </span>
      </div>

      <div
        className={`absolute bottom-2.5 right-3 rotate-180 ${
          red
            ? "text-[#a82d3c]"
            : "text-[#17191c]"
        }`}
      >
        <p className="text-[20px] font-bold leading-none sm:text-[24px]">
          {card.rank}
        </p>

        <p className="mt-1 text-[17px] leading-none sm:text-[20px]">
          {suit}
        </p>
      </div>
    </motion.div>
  );
}

function BetChoice({
  value,
  selected,
  title,
  subtitle,
  multiplier,
  onClick,
  disabled,
}: {
  value: BaccaratChoice;
  selected: boolean;
  title: string;
  subtitle: string;
  multiplier: string;
  onClick: (
    value: BaccaratChoice
  ) => void;
  disabled: boolean;
}) {
  return (
    <motion.button
      whileTap={{
        scale: 0.975,
      }}
      type="button"
      disabled={disabled}
      onClick={() =>
        onClick(value)
      }
      className={`relative overflow-hidden rounded-[16px] border p-4 text-left transition ${
        selected
          ? "border-cyan-100/[0.2] bg-cyan-100/[0.065]"
          : "border-white/[0.075] bg-white/[0.025] hover:border-white/[0.13] hover:bg-white/[0.045]"
      }`}
    >
      {selected && (
        <motion.div
          layoutId="baccarat-choice"
          className="absolute inset-x-3 bottom-0 h-px bg-cyan-100/70"
        />
      )}

      <div className="flex items-start justify-between gap-3">
        <div>
          <p
            className={`text-[12px] font-semibold ${
              selected
                ? "text-cyan-50/90"
                : "text-white/65"
            }`}
          >
            {title}
          </p>

          <p className="mt-1 text-[9px] text-white/25">
            {subtitle}
          </p>
        </div>

        <span className="text-[9px] font-semibold text-cyan-100/45">
          {multiplier}
        </span>
      </div>
    </motion.button>
  );
}

export default function BaccaratClient({
  initialBalance,
}: {
  initialBalance: number;
}) {
  const router =
    useRouter();

  const audio =
    useOctosonAudio();

  const [
    balance,
    setBalance,
  ] =
    useState(
      initialBalance
    );

  const [
    bet,
    setBet,
  ] =
    useState("100");

  const [
    choice,
    setChoice,
  ] =
    useState<BaccaratChoice>(
      "player"
    );

  const [
    session,
    setSession,
  ] =
    useState<BaccaratSession | null>(
      null
    );

  const [
    message,
    setMessage,
  ] =
    useState<string | null>(
      null
    );

  const [
    run,
    setRun,
  ] =
    useState(0);

  const [
    pending,
    startTransition,
  ] =
    useTransition();

  useEffect(() => {
    startTransition(
      async () => {
        const result =
          await getLatestBaccaratAction();

        if (
          result.ok &&
          result.session
        ) {
          setSession(
            result.session
          );
        }
      }
    );
  }, []);

  function choose(
    value: BaccaratChoice
  ) {
    if (pending) {
      return;
    }

    audio.play(
      "click"
    );

    setChoice(value);
  }

  function play() {
    const amount =
      Number(bet);

    if (
      !Number.isSafeInteger(
        amount
      ) ||
      amount <= 0
    ) {
      setMessage(
        "Düzgün mərc məbləği daxil et."
      );

      audio.play(
        "error"
      );

      return;
    }

    setMessage(null);
    setSession(null);

    setRun(
      (current) =>
        current + 1
    );

    audio.play(
      "bet"
    );

    startTransition(
      async () => {
        const result =
          await startBaccaratAction(
            amount,
            choice
          );

        setMessage(
          result.message
        );

        if (
          result.session
        ) {
          setSession(
            result.session
          );

          // Deal sound sequence.
          audio.play(
            "card"
          );

          window.setTimeout(
            () =>
              audio.play(
                "card"
              ),
            180
          );

          window.setTimeout(
            () =>
              audio.play(
                "card"
              ),
            360
          );

          window.setTimeout(
            () =>
              audio.play(
                "card"
              ),
            540
          );

          const net =
            Number(
              result.session.net ??
                0
            );

          window.setTimeout(
            () => {
              if (
                result.session
                  ?.status ===
                "won"
              ) {
                audio.play(
                  Math.abs(net) >=
                    amount * 4
                    ? "bigwin"
                    : "win"
                );
              } else if (
                result.session
                  ?.status ===
                "lost"
              ) {
                audio.play(
                  "lose"
                );
              } else {
                audio.play(
                  "cashout"
                );
              }
            },
            980
          );
        } else if (
          !result.ok
        ) {
          audio.play(
            "error"
          );
        }

        if (
          typeof result.balance ===
          "number"
        ) {
          setBalance(
            result.balance
          );
        }

        
      }
    );
  }

  const selectedWinner =
    session?.winner ===
    choice;

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          audio.play(
            "navigate"
          );

          router.push(
            "/dashboard/casino"
          );
        }}
        className="mb-6 flex items-center gap-2 text-[10px] text-white/35 transition hover:text-white/75"
      >
        <ArrowLeft className="h-4 w-4" />
        Casino
      </button>

      <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-200 shadow-[0_0_15px_rgba(165,243,252,.45)]" />

            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-100/55">
              Octoson Casino
            </p>
          </div>

          <h1 className="mt-3 text-[40px] font-semibold tracking-[-0.05em] text-white sm:text-[45px]">
            Baccarat
          </h1>

          <p className="mt-2 max-w-xl text-[12px] leading-6 text-white/30">
            Oyunçu, Bankir və ya Bərabər seç.
            Kartlar real deck-dən paylanır və üçüncü
            kart qaydaları avtomatik tətbiq olunur.
          </p>
        </div>

        <motion.div
          key={balance}
          initial={{
            scale: 0.96,
          }}
          animate={{
            scale: 1,
          }}
          className="rounded-[15px] border border-white/[0.08] bg-white/[0.03] px-5 py-3"
        >
          <div className="flex items-center gap-2 text-[9px] text-white/30">
            <WalletCards className="h-3.5 w-3.5" />
            Wallet
          </div>

          <p className="mt-1.5 text-[17px] font-semibold text-white/85">
            {aura(balance)}

            <span className="ml-1.5 text-[8px] text-cyan-100/45">
              AURA
            </span>
          </p>
        </motion.div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_330px]">
        <section className="relative overflow-hidden rounded-[27px] border border-white/[0.08] bg-[#070a0c]">
          <div className="pointer-events-none absolute left-1/2 top-[-220px] h-[500px] w-[760px] -translate-x-1/2 rounded-full bg-cyan-300/[0.045] blur-[120px]" />

          <div className="pointer-events-none absolute inset-x-[12%] top-12 h-px bg-gradient-to-r from-transparent via-cyan-100/[0.12] to-transparent" />

          <div className="relative min-h-[590px] p-5 sm:p-8">
            {!session &&
            !pending ? (
              <div className="flex min-h-[520px] flex-col items-center justify-center text-center">
                <div className="flex h-24 w-24 items-center justify-center rounded-[30px] border border-cyan-100/[0.12] bg-cyan-100/[0.04]">
                  <CircleDollarSign className="h-10 w-10 text-cyan-100/60" />
                </div>

                <p className="mt-7 text-[24px] font-semibold tracking-[-0.04em] text-white/80">
                  Masa hazırdır
                </p>

                <p className="mt-2 max-w-md text-[11px] leading-6 text-white/27">
                  Mərc tərəfini seç və əli başlat.
                  Kartlar Oyunçu və Bankir arasında
                  növbə ilə paylanacaq.
                </p>
              </div>
            ) : pending ? (
              <div className="flex min-h-[520px] flex-col items-center justify-center">
                <motion.div
                  animate={{
                    rotate: [
                      0,
                      4,
                      -4,
                      0,
                    ],
                    y: [
                      0,
                      -5,
                      0,
                    ],
                  }}
                  transition={{
                    duration:
                      0.7,
                    repeat: 1,
                  }}
                  className="relative h-[150px] w-[105px] rounded-[14px] border border-cyan-100/[0.15] bg-[#0d171d]"
                >
                  <div className="absolute inset-[8px] rounded-[9px] border border-cyan-100/[0.12]" />

                  <div className="absolute inset-0 flex items-center justify-center">
                    <CircleDollarSign className="h-8 w-8 text-cyan-100/40" />
                  </div>
                </motion.div>

                <p className="mt-7 text-[11px] font-medium text-white/35">
                  Kartlar paylanır...
                </p>
              </div>
            ) : (
              <div>
                <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
                  <div
                    className={`rounded-[22px] border p-5 transition ${
                      session?.winner ===
                      "player"
                        ? "border-cyan-100/[0.18] bg-cyan-100/[0.045]"
                        : "border-white/[0.065] bg-white/[0.018]"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-cyan-100/45">
                          PLAYER
                        </p>

                        <p className="mt-1 text-[10px] text-white/20">
                          Oyunçu
                        </p>
                      </div>

                      <motion.span
                        key={
                          session?.playerTotal
                        }
                        initial={{
                          scale:
                            0.8,
                        }}
                        animate={{
                          scale: 1,
                        }}
                        className="flex h-11 w-11 items-center justify-center rounded-full border border-cyan-100/[0.14] bg-cyan-100/[0.045] text-[18px] font-semibold text-cyan-50/75"
                      >
                        {
                          session?.playerTotal
                        }
                      </motion.span>
                    </div>

                    <div className="mt-7 flex min-h-[185px] flex-wrap items-center justify-center gap-2">
                      {session?.playerHand.map(
                        (
                          card,
                          index
                        ) => (
                          <BaccaratCardView
                            key={`${run}-p-${index}`}
                            card={
                              card
                            }
                            index={
                              index
                            }
                            side="player"
                            run={
                              run
                            }
                          />
                        )
                      )}
                    </div>
                  </div>

                  <div
                    className={`rounded-[22px] border p-5 transition ${
                      session?.winner ===
                      "banker"
                        ? "border-violet-200/[0.18] bg-violet-200/[0.04]"
                        : "border-white/[0.065] bg-white/[0.018]"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-violet-100/45">
                          BANKER
                        </p>

                        <p className="mt-1 text-[10px] text-white/20">
                          Bankir
                        </p>
                      </div>

                      <motion.span
                        key={
                          session?.bankerTotal
                        }
                        initial={{
                          scale:
                            0.8,
                        }}
                        animate={{
                          scale: 1,
                        }}
                        className="flex h-11 w-11 items-center justify-center rounded-full border border-violet-100/[0.14] bg-violet-100/[0.045] text-[18px] font-semibold text-violet-50/75"
                      >
                        {
                          session?.bankerTotal
                        }
                      </motion.span>
                    </div>

                    <div className="mt-7 flex min-h-[185px] flex-wrap items-center justify-center gap-2">
                      {session?.bankerHand.map(
                        (
                          card,
                          index
                        ) => (
                          <BaccaratCardView
                            key={`${run}-b-${index}`}
                            card={
                              card
                            }
                            index={
                              index
                            }
                            side="banker"
                            run={
                              run
                            }
                          />
                        )
                      )}
                    </div>
                  </div>
                </div>

                <AnimatePresence>
                  {session && (
                    <motion.div
                      initial={{
                        opacity: 0,
                        y: 14,
                        scale:
                          0.96,
                      }}
                      animate={{
                        opacity: 1,
                        y: 0,
                        scale: 1,
                      }}
                      transition={{
                        delay:
                          0.85,
                      }}
                      className={`mx-auto mt-7 max-w-xl rounded-[18px] border p-5 text-center ${
                        session.status ===
                        "won"
                          ? "border-emerald-300/[0.14] bg-emerald-300/[0.04]"
                          : session.status ===
                              "lost"
                            ? "border-red-300/[0.14] bg-red-300/[0.035]"
                            : "border-white/[0.08] bg-white/[0.025]"
                      }`}
                    >
                      {session.status ===
                        "won" && (
                        <Sparkles className="mx-auto h-5 w-5 text-emerald-200/80" />
                      )}

                      <p className="mt-2 text-[17px] font-semibold tracking-[-0.025em] text-white/80">
                        {
                          message
                        }
                      </p>

                      <p
                        className={`mt-2 text-[12px] font-semibold ${
                          session.net >
                          0
                            ? "text-emerald-200/75"
                            : session.net <
                                0
                              ? "text-red-200/70"
                              : "text-white/45"
                        }`}
                      >
                        {session.net >
                        0
                          ? "+"
                          : ""}
                        {session.net.toLocaleString(
                          "en-US"
                        )}{" "}
                        Aura
                      </p>

                      <p className="mt-2 text-[9px] text-white/20">
                        Sənin seçimin:{" "}
                        {choice ===
                        "player"
                          ? "Oyunçu"
                          : choice ===
                              "banker"
                            ? "Bankir"
                            : "Bərabər"}
                        {selectedWinner
                          ? " • Düz seçim"
                          : ""}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>
        </section>

        <aside className="rounded-[24px] border border-white/[0.08] bg-[#090a0d] p-5 xl:sticky xl:top-[92px] xl:self-start">
          <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-white/25">
            Mərc
          </p>

          <div className="mt-3 flex items-center rounded-[14px] border border-white/[0.08] bg-black/30 px-4 focus-within:border-cyan-100/20">
            <input
              value={bet}
              disabled={
                pending
              }
              inputMode="numeric"
              onChange={(
                event
              ) =>
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
            <button
              type="button"
              disabled={
                pending
              }
              onClick={() => {
                audio.play(
                  "click"
                );

                setBet(
                  String(
                    Math.max(
                      1,
                      Math.floor(
                        Number(
                          bet ||
                            0
                        ) /
                          2
                      )
                    )
                  )
                );
              }}
              className="rounded-[9px] border border-white/[0.07] bg-white/[0.025] py-2 text-[9px] text-white/35 hover:bg-white/[0.05]"
            >
              ½
            </button>

            <button
              type="button"
              disabled={
                pending
              }
              onClick={() => {
                audio.play(
                  "click"
                );

                setBet(
                  String(
                    Math.min(
                      balance,
                      Math.max(
                        1,
                        Math.floor(
                          Number(
                            bet ||
                              0
                          ) *
                            2
                        )
                      )
                    )
                  )
                );
              }}
              className="rounded-[9px] border border-white/[0.07] bg-white/[0.025] py-2 text-[9px] text-white/35 hover:bg-white/[0.05]"
            >
              2×
            </button>

            <button
              type="button"
              disabled={
                pending
              }
              onClick={() => {
                audio.play(
                  "click"
                );

                setBet(
                  String(
                    Math.floor(
                      balance
                    )
                  )
                );
              }}
              className="rounded-[9px] border border-white/[0.07] bg-white/[0.025] py-2 text-[9px] text-white/35 hover:bg-white/[0.05]"
            >
              MAX
            </button>
          </div>

          <p className="mt-6 text-[9px] font-semibold uppercase tracking-[0.16em] text-white/25">
            Tərəf
          </p>

          <div className="mt-3 grid gap-2">
            <BetChoice
              value="player"
              selected={
                choice ===
                "player"
              }
              title="Oyunçu"
              subtitle="Player hand"
              multiplier="1.90X"
              onClick={
                choose
              }
              disabled={
                pending
              }
            />

            <BetChoice
              value="banker"
              selected={
                choice ===
                "banker"
              }
              title="Bankir"
              subtitle="Banker hand"
              multiplier="1.85X"
              onClick={
                choose
              }
              disabled={
                pending
              }
            />

            <BetChoice
              value="tie"
              selected={
                choice ===
                "tie"
              }
              title="Bərabər"
              subtitle="Equal totals"
              multiplier="8.00X"
              onClick={
                choose
              }
              disabled={
                pending
              }
            />
          </div>

          <motion.button
            whileTap={{
              scale:
                0.98,
            }}
            type="button"
            disabled={
              pending ||
              !bet ||
              Number(bet) <=
                0 ||
              balance <= 0
            }
            onClick={play}
            className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-[13px] bg-cyan-100 text-[11px] font-semibold text-[#061014] transition hover:bg-white disabled:opacity-30"
          >
            {pending ? (
              <>
                <LoaderCircle className="h-4 w-4 animate-spin" />
                Kartlar paylanır...
              </>
            ) : (
              <>
                <CircleDollarSign className="h-4 w-4" />
                {aura(
                  Number(
                    bet ||
                      0
                  )
                )}{" "}
                Aura oyna
              </>
            )}
          </motion.button>

          <div className="mt-5 border-t border-white/[0.055] pt-4">
            <p className="text-[9px] leading-5 text-white/20">
              Baccarat kart dəyərləri 0–9 arasındadır.
              10/J/Q/K = 0, A = 1. Natural 8/9 və
              üçüncü kart qaydaları avtomatik hesablanır.
              Oyunçu və Bankir mərcində Tie baş verərsə
              mərc qaytarılır.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
