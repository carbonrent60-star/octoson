"use client";

import {
  useEffect,
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
  BadgeDollarSign,
  CircleStop,
  Hand,
  Layers3,
  LoaderCircle,
  Plus,
  RotateCcw,
  Sparkles,
  WalletCards,
} from "lucide-react";

import {
  getActiveBlackjackAction,
  hitBlackjackAction,
  standBlackjackAction,
  startBlackjackAction,
  type BlackjackCard,
  type BlackjackSession,
} from "./actions";

import {
  useOctosonAudio,
} from "@/components/audio/octoson-audio";

function formatAura(value: number) {
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

function blackjackTotal(
  cards: (BlackjackCard | null)[]
) {
  let total = 0;
  let aces = 0;

  for (const card of cards) {
    if (!card) continue;

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
      total += Number(card.rank) || 0;
    }
  }

  while (total > 21 && aces > 0) {
    total -= 10;
    aces -= 1;
  }

  return total;
}

function sessionOutcome(
  session: BlackjackSession | null
): "win" | "lose" | "push" | null {
  if (!session) return null;

  if (
    session.status === "won" ||
    session.status === "blackjack"
  ) {
    return "win";
  }

  if (session.status === "lost") {
    return "lose";
  }

  if (session.status === "push") {
    return "push";
  }

  return null;
}

function suitSymbol(
  suit: BlackjackCard["suit"]
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

function isRed(
  suit: BlackjackCard["suit"]
) {
  return (
    suit === "hearts" ||
    suit === "diamonds"
  );
}

function Card({
  card,
  hidden = false,
  index = 0,
}: {
  card?: BlackjackCard | null;
  hidden?: boolean;
  index?: number;
}) {
  if (hidden || !card) {
    return (
      <motion.div
        initial={{
          opacity: 0,
          y: -24,
          rotateY: 90,
        }}
        animate={{
          opacity: 1,
          y: 0,
          rotateY: 0,
        }}
        transition={{
          delay: index * 0.08,
          type: "spring",
          stiffness: 190,
          damping: 18,
        }}
        className="relative h-[154px] w-[108px] overflow-hidden rounded-[15px] border border-cyan-100/[0.15] bg-[#0c151b] shadow-[0_18px_50px_rgba(0,0,0,0.32)] sm:h-[182px] sm:w-[128px]"
      >
        <div className="absolute inset-[7px] rounded-[10px] border border-cyan-100/[0.12]" />

        <div
          className="absolute inset-[14px] rounded-[8px] opacity-40"
          style={{
            backgroundImage:
              "linear-gradient(45deg,rgba(165,243,252,.08) 25%,transparent 25%,transparent 75%,rgba(165,243,252,.08) 75%),linear-gradient(45deg,rgba(165,243,252,.08) 25%,transparent 25%,transparent 75%,rgba(165,243,252,.08) 75%)",
            backgroundPosition:
              "0 0, 8px 8px",
            backgroundSize:
              "16px 16px",
          }}
        />

        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-[13px] border border-cyan-100/[0.12] bg-black/20">
            <Layers3 className="h-5 w-5 text-cyan-100/45" />
          </div>
        </div>
      </motion.div>
    );
  }

  const symbol =
    suitSymbol(card.suit);

  const red =
    isRed(card.suit);

  return (
    <motion.div
      initial={{
        opacity: 0,
        y: -30,
        x: 18,
        rotate: 5,
        scale: 0.88,
      }}
      animate={{
        opacity: 1,
        y: 0,
        x: 0,
        rotate: 0,
        scale: 1,
      }}
      transition={{
        delay: index * 0.08,
        type: "spring",
        stiffness: 210,
        damping: 19,
      }}
      className="relative h-[154px] w-[108px] rounded-[15px] border border-black/10 bg-[#f4f1e9] shadow-[0_18px_50px_rgba(0,0,0,0.3)] sm:h-[182px] sm:w-[128px]"
    >
      <div
        className={`absolute left-3 top-2.5 text-left ${
          red
            ? "text-[#b82e3b]"
            : "text-[#17191d]"
        }`}
      >
        <p className="text-[22px] font-bold leading-none sm:text-[26px]">
          {card.rank}
        </p>

        <p className="mt-1 text-[19px] leading-none sm:text-[22px]">
          {symbol}
        </p>
      </div>

      <div
        className={`absolute inset-0 flex items-center justify-center ${
          red
            ? "text-[#b82e3b]"
            : "text-[#17191d]"
        }`}
      >
        <span className="text-[46px] sm:text-[56px]">
          {symbol}
        </span>
      </div>

      <div
        className={`absolute bottom-2.5 right-3 rotate-180 text-left ${
          red
            ? "text-[#b82e3b]"
            : "text-[#17191d]"
        }`}
      >
        <p className="text-[22px] font-bold leading-none sm:text-[26px]">
          {card.rank}
        </p>

        <p className="mt-1 text-[19px] leading-none sm:text-[22px]">
          {symbol}
        </p>
      </div>
    </motion.div>
  );
}

function HandArea({
  title,
  total,
  cards,
  dealer = false,
}: {
  title: string;
  total?: number;
  cards:
    (BlackjackCard | null)[];
  dealer?: boolean;
}) {
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-white/25">
            {title}
          </p>

          <p className="mt-1 text-[12px] text-white/18">
            {dealer
              ? "Dealer 17 və yuxarıda dayanır."
              : "21-i keçmə."}
          </p>
        </div>

        {typeof total ===
          "number" && (
          <motion.div
            key={total}
            initial={{
              scale: 0.88,
              opacity: 0,
            }}
            animate={{
              scale: 1,
              opacity: 1,
            }}
            className={`rounded-full border px-3 py-1.5 text-[12px] font-semibold ${
              total > 21
                ? "border-red-300/15 bg-red-300/[0.05] text-red-200/75"
                : total === 21
                  ? "border-emerald-300/15 bg-emerald-300/[0.05] text-emerald-200/80"
                  : "border-white/[0.07] bg-white/[0.025] text-white/60"
            }`}
          >
            {total}
          </motion.div>
        )}
      </div>

      <div className="flex min-h-[182px] flex-wrap items-center gap-3">
        {cards.map(
          (card, index) => (
            <Card
              key={`${card?.rank ?? "hidden"}-${card?.suit ?? "hidden"}-${index}`}
              card={card}
              hidden={!card}
              index={index}
            />
          )
        )}
      </div>
    </div>
  );
}

export default function BlackjackClient({
  initialBalance,
}: {
  initialBalance: number;
}) {
  const router = useRouter();
  const audio =
    useOctosonAudio();

  const [balance, setBalance] =
    useState(initialBalance);

  const [bet, setBet] =
    useState("100");

  const [
    session,
    setSession,
  ] =
    useState<BlackjackSession | null>(
      null
    );

  const [
    message,
    setMessage,
  ] =
    useState<string | null>(null);

  const [
    outcome,
    setOutcome,
  ] = useState<
    "win" | "lose" | "push" | null
  >(null);

  const [
    cinematic,
    setCinematic,
  ] = useState(false);

  const [
    transitionPending,
    startTransition,
  ] = useTransition();

  const pending =
    transitionPending || cinematic;

  useEffect(() => {
    startTransition(async () => {
      const result =
        await getActiveBlackjackAction();

      if (
        result.ok &&
        result.session
      ) {
        setSession(
          result.session
        );
      }
    });
  }, []);

  const active =
    session?.status === "active";


  async function applyResult(
    result: {
      ok: boolean;
      message: string;
      session?:
        | BlackjackSession
        | null;
      balance?: number;
    },
    previousCards = 0
  ) {
    setOutcome(null);

    if (!result.ok) {
      setMessage(result.message);
      audio.play("error");
      return;
    }

    if (result.session) {
      const nextSession =
        result.session;

      const drewCard =
        nextSession.playerHand.length >
        previousCards;

      setSession(nextSession);

      if (drewCard) {
        audio.play("card");
      }

      const finalOutcome =
        sessionOutcome(nextSession);

      if (finalOutcome) {
        /*
         * Let the last card physically arrive before showing
         * WIN / LOSS / PUSH.
         */
        setCinematic(true);

        await sleep(
          drewCard ? 320 : 180
        );

        setMessage(result.message);
        setOutcome(finalOutcome);

        if (
          nextSession.status ===
          "blackjack"
        ) {
          audio.play("bigwin");
        } else if (
          nextSession.status ===
          "won"
        ) {
          audio.play("win");
        } else if (
          nextSession.status ===
          "lost"
        ) {
          audio.play("lose");
        } else {
          audio.play("cashout");
        }

        setCinematic(false);
      } else {
        setMessage(result.message);
      }
    }

    if (
      typeof result.balance ===
      "number"
    ) {
      setBalance(result.balance);
    }

    
  }

  function startGame() {
    const amount =
      Number(bet);

    if (
      !Number.isSafeInteger(
        amount
      ) ||
      amount <= 0
    ) {
      setMessage(
        "Düzgün mərc daxil et."
      );

      audio.play("error");
      return;
    }

    setMessage(null);
    audio.play("bet");

    startTransition(
      async () => {
        const result =
          await startBlackjackAction(
            amount
          );

        await applyResult(
          result,
          0
        );
      }
    );
  }

  function hit() {
    if (!session || !active) {
      return;
    }

    const before =
      session.playerHand.length;

    audio.play("click");

    startTransition(
      async () => {
        const result =
          await hitBlackjackAction();

        await applyResult(
          result,
          before
        );
      }
    );
  }

  function stand() {
    if (!session || !active || pending) {
      return;
    }

    audio.play("click");
    setMessage("Dealer oynayır...");
    setOutcome(null);

    const beforeSession =
      session;

    startTransition(
      async () => {
        setCinematic(true);

        const result =
          await standBlackjackAction();

        if (
          !result.ok ||
          !result.session
        ) {
          setMessage(result.message);
          audio.play("error");
          setCinematic(false);
          return;
        }

        const finalSession =
          result.session;

        /*
         * Begin from exactly what the player could see before STAND.
         * Usually: dealer first card + one face-down card.
         */
        const visibleDealer:
          (BlackjackCard | null)[] =
          [...beforeSession.dealerHand];

        /*
         * Reveal dealer's hidden card, then any additional dealer
         * draws ONE AT A TIME.
         */
        for (
          let index = 0;
          index <
          finalSession.dealerHand.length;
          index += 1
        ) {
          const finalCard =
            finalSession.dealerHand[index];

          if (!finalCard) {
            continue;
          }

          const existing =
            visibleDealer[index];

          const alreadyVisible =
            existing &&
            existing.rank ===
              finalCard.rank &&
            existing.suit ===
              finalCard.suit;

          if (alreadyVisible) {
            continue;
          }

          visibleDealer[index] =
            finalCard;

          setSession({
            ...finalSession,
            status: "active",
            dealerHand:
              [...visibleDealer],
            dealerTotal:
              blackjackTotal(
                visibleDealer
              ),
          });

          audio.play("card");

          /*
           * Hidden-card flip gets a touch more time.
           * Later dealer draws stay snappy.
           */
          await sleep(
            index <= 1 ? 380 : 300
          );
        }

        /*
         * Small beat after dealer completes the hand.
         */
        await sleep(100);

        setSession(finalSession);

        const finalOutcome =
          sessionOutcome(finalSession);

        setMessage(result.message);
        setOutcome(finalOutcome);

        if (
          finalSession.status ===
          "blackjack"
        ) {
          audio.play("bigwin");
        } else if (
          finalSession.status ===
          "won"
        ) {
          audio.play("win");
        } else if (
          finalSession.status ===
          "lost"
        ) {
          audio.play("lose");
        } else {
          audio.play("cashout");
        }

        if (
          typeof result.balance ===
          "number"
        ) {
          setBalance(
            result.balance
          );
        }

        setCinematic(false);
        
      }
    );
  }

  function newRound() {
    audio.play("click");
    setSession(null);
    setMessage(null);
    setOutcome(null);
    setCinematic(false);
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          audio.play("navigate");
          router.push(
            "/dashboard/casino"
          );
        }}
        className="mb-6 flex items-center gap-2 text-[10px] text-white/35 transition hover:text-white/80"
      >
        <ArrowLeft className="h-4 w-4" />
        Casino
      </button>

      <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-200 shadow-[0_0_16px_rgba(165,243,252,.5)]" />

            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-100/55">
              Octoson Casino
            </p>
          </div>

          <h1 className="mt-3 text-[38px] font-semibold tracking-[-0.05em] text-white sm:text-[44px]">
            Blackjack
          </h1>

          <p className="mt-2 max-w-xl text-[12px] leading-6 text-white/30">
            21-ə mümkün qədər yaxınlaş.
            Dealer 17 və yuxarıda dayanır.
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
          className="rounded-[15px] border border-white/[0.08] bg-white/[0.03] px-5 py-3 shadow-[0_14px_50px_rgba(0,0,0,.2)]"
        >
          <div className="flex items-center gap-2 text-[9px] text-white/30">
            <WalletCards className="h-3.5 w-3.5" />
            Wallet
          </div>

          <p className="mt-1.5 text-[17px] font-semibold text-white/85">
            {formatAura(balance)}

            <span className="ml-1.5 text-[8px] text-cyan-100/45">
              AURA
            </span>
          </p>
        </motion.div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <section className="relative overflow-hidden rounded-[26px] border border-white/[0.08] bg-[#080a0d] p-5 sm:p-7">
          <div className="pointer-events-none absolute left-1/2 top-[-220px] h-[460px] w-[700px] -translate-x-1/2 rounded-full bg-cyan-300/[0.045] blur-[110px]" />

          {!session ? (
            <div className="relative flex min-h-[530px] flex-col items-center justify-center text-center">
              <motion.div
                animate={{
                  y: [0, -5, 0],
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                className="flex h-24 w-24 items-center justify-center rounded-[28px] border border-cyan-100/[0.12] bg-cyan-100/[0.04]"
              >
                <Layers3 className="h-10 w-10 text-cyan-100/60" />
              </motion.div>

              <h2 className="mt-7 text-[25px] font-semibold tracking-[-0.04em] text-white/85">
                Masa hazırdır
              </h2>

              <p className="mt-2 max-w-sm text-[11px] leading-6 text-white/25">
                Mərcini seç və kartları payla.
                Dealer-in ikinci kartı raund
                bitənədək gizli qalacaq.
              </p>
            </div>
          ) : (
            <div className="relative">
              <HandArea
                title="Dealer"
                total={
                  session.dealerTotal
                }
                cards={
                  session.dealerHand
                }
                dealer
              />

              <div className="my-8 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />

              <HandArea
                title="Sənin əlin"
                total={
                  session.playerTotal
                }
                cards={
                  session.playerHand
                }
              />

              <AnimatePresence>
                {outcome && (
                  <motion.div
                    initial={{
                      opacity: 0,
                      scale: 0.92,
                      y: 16,
                    }}
                    animate={{
                      opacity: 1,
                      scale: 1,
                      y: 0,
                    }}
                    className={`mt-8 rounded-[20px] border p-5 text-center ${
                      outcome === "win"
                        ? "border-emerald-300/[0.15] bg-emerald-300/[0.045]"
                        : outcome === "lose"
                          ? "border-red-300/[0.15] bg-red-300/[0.04]"
                          : "border-white/[0.08] bg-white/[0.025]"
                    }`}
                  >
                    {outcome ===
                      "win" && (
                      <Sparkles className="mx-auto h-5 w-5 text-emerald-200/80" />
                    )}

                    <p
                      className={`${
                        outcome === "win"
                          ? "mt-2 text-emerald-100/85"
                          : outcome === "lose"
                            ? "text-red-100/80"
                            : "text-white/70"
                      } text-[19px] font-semibold tracking-[-0.025em]`}
                    >
                      {message}
                    </p>

                    {session.net !==
                      0 && (
                      <p className="mt-2 text-[11px] text-white/35">
                        {session.net >
                        0
                          ? "+"
                          : ""}
                        {session.net.toLocaleString(
                          "en-US"
                        )}{" "}
                        Aura
                      </p>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </section>

        <aside className="rounded-[24px] border border-white/[0.08] bg-[#090a0d] p-5 lg:sticky lg:top-[92px] lg:self-start">
          {!active ? (
            <>
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
                  className="rounded-[9px] border border-white/[0.07] bg-white/[0.025] py-2 text-[9px] text-white/35 transition hover:bg-white/[0.05] hover:text-white/70"
                >
                  ½
                </button>

                <button
                  type="button"
                  onClick={() => {
                    audio.play(
                      "click"
                    );
                    setBet(
                      String(
                        Math.min(
                          Math.floor(
                            balance
                          ),
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
                  className="rounded-[9px] border border-white/[0.07] bg-white/[0.025] py-2 text-[9px] text-white/35 transition hover:bg-white/[0.05] hover:text-white/70"
                >
                  2×
                </button>

                <button
                  type="button"
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
                  className="rounded-[9px] border border-white/[0.07] bg-white/[0.025] py-2 text-[9px] text-white/35 transition hover:bg-white/[0.05] hover:text-white/70"
                >
                  MAX
                </button>
              </div>

              {session &&
              session.status !==
                "active" ? (
                <button
                  type="button"
                  onClick={
                    newRound
                  }
                  className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-[13px] border border-white/[0.09] bg-white/[0.04] text-[11px] font-semibold text-white/65 transition hover:bg-white/[0.07]"
                >
                  <RotateCcw className="h-4 w-4" />
                  Yeni raund
                </button>
              ) : (
                <motion.button
                  whileTap={{
                    scale: 0.98,
                  }}
                  type="button"
                  disabled={
                    pending ||
                    !bet ||
                    Number(bet) <=
                      0 ||
                    balance <= 0
                  }
                  onClick={
                    startGame
                  }
                  className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-[13px] bg-cyan-100 text-[11px] font-semibold text-[#061014] transition hover:bg-white disabled:opacity-30"
                >
                  {pending ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  ) : (
                    <BadgeDollarSign className="h-4 w-4" />
                  )}

                  {formatAura(
                    Number(
                      bet || 0
                    )
                  )}{" "}
                  Aura ilə başla
                </motion.button>
              )}
            </>
          ) : (
            <>
              <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-white/25">
                Aktiv əl
              </p>

              <div className="mt-4 rounded-[14px] border border-white/[0.07] bg-white/[0.025] p-4">
                <p className="text-[9px] text-white/25">
                  Mərc
                </p>

                <p className="mt-1 text-[18px] font-semibold text-white/80">
                  {formatAura(
                    session.bet
                  )}{" "}
                  Aura
                </p>
              </div>

              <div className="mt-3 rounded-[14px] border border-cyan-100/[0.09] bg-cyan-100/[0.025] p-4">
                <p className="text-[9px] text-white/25">
                  Əl dəyəri
                </p>

                <p className="mt-1 text-[26px] font-semibold tracking-[-0.04em] text-cyan-100/80">
                  {
                    session.playerTotal
                  }
                </p>
              </div>

              <motion.button
                whileTap={{
                  scale: 0.98,
                }}
                type="button"
                disabled={
                  pending
                }
                onClick={hit}
                className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-[13px] bg-cyan-100 text-[11px] font-semibold text-[#061014] transition hover:bg-white disabled:opacity-30"
              >
                {pending ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}

                HIT
              </motion.button>

              <motion.button
                whileTap={{
                  scale: 0.98,
                }}
                type="button"
                disabled={
                  pending
                }
                onClick={
                  stand
                }
                className="mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-[13px] border border-white/[0.09] bg-white/[0.04] text-[11px] font-semibold text-white/70 transition hover:bg-white/[0.07] disabled:opacity-30"
              >
                <CircleStop className="h-4 w-4" />
                STAND
              </motion.button>
            </>
          )}

          {message &&
            !outcome && (
              <motion.div
                key={message}
                initial={{
                  opacity: 0,
                  y: 5,
                }}
                animate={{
                  opacity: 1,
                  y: 0,
                }}
                className="mt-4 rounded-[12px] border border-white/[0.07] bg-white/[0.025] p-3 text-[10px] leading-5 text-white/45"
              >
                {message}
              </motion.div>
            )}

          <div className="mt-5 border-t border-white/[0.055] pt-4">
            <div className="flex items-start gap-2">
              <Hand className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-100/30" />

              <p className="text-[9px] leading-5 text-white/20">
                Normal qələbə 2.00x.
                Təbii Blackjack 2.50x
                ümumi payout verir.
                Aura real pul deyil və
                pula çevrilmir.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
