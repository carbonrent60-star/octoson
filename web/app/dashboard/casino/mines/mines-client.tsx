"use client";

import {
  useEffect,
  useState,
  useTransition,
} from "react";

import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";

import {
  ArrowLeft,
  Bomb,
  Gem,
  LoaderCircle,
  ShieldCheck,
  Sparkles,
  WalletCards,
  Zap,
} from "lucide-react";

import { useOctosonAudio } from "@/components/audio/octoson-audio";

import {
  cashoutMinesAction,
  getActiveMinesAction,
  revealMinesTileAction,
  startMinesAction,
  type WebMinesSession,
} from "./actions";

function formatAura(value: number) {
  return Math.max(
    0,
    Math.floor(value)
  ).toLocaleString("en-US");
}

export default function MinesClient({
  initialBalance,
}: {
  initialBalance: number;
}) {
  const router = useRouter();
  const audio = useOctosonAudio();

  const [balance, setBalance] =
    useState(initialBalance);

  const [bet, setBet] = useState("100");

  const [mineCount, setMineCount] =
    useState(3);

  const [session, setSession] =
    useState<WebMinesSession | null>(null);

  const [message, setMessage] =
    useState<string | null>(null);

  const [pending, startTransition] =
    useTransition();

  const [lastRevealed, setLastRevealed] =
    useState<number | null>(null);

  useEffect(() => {
    startTransition(async () => {
      const result = await getActiveMinesAction();

      if (result.ok && result.session) {
        setSession(result.session);
      }
    });
  }, []);

  function startGame() {
    const amount = Number(bet);

    if (
      !Number.isSafeInteger(amount) ||
      amount <= 0
    ) {
      setMessage("Düzgün mərc məbləği daxil et.");
      audio.play("error");
      return;
    }

    if (amount > balance) {
      setMessage("Balansında kifayət qədər Aura yoxdur.");
      audio.play("error");
      return;
    }

    setMessage(null);
    setLastRevealed(null);
    audio.play("bet");

    startTransition(async () => {
      const result = await startMinesAction(
        amount,
        mineCount
      );

      setMessage(result.message);

      if (result.session) {
        setSession(result.session);
      }

      if (typeof result.balance === "number") {
        setBalance(result.balance);
      }

      if (!result.ok) {
        audio.play("error");
      }

      
    });
  }

  function reveal(tile: number) {
    if (!session || session.status !== "active") {
      return;
    }

    setLastRevealed(tile);

    startTransition(async () => {
      const result = await revealMinesTileAction(tile);

      setMessage(result.message);

      if (result.session) {
        const isMine =
          result.session.mines?.includes(tile);

        if (isMine) {
          audio.play("mine");
        } else {
          audio.play("gem");
        }

        setSession(result.session);
      } else if (!result.ok) {
        audio.play("error");
      }

      if (typeof result.balance === "number") {
        setBalance(result.balance);
      }

      
    });
  }

  function cashout() {
    audio.play("cashout");

    startTransition(async () => {
      const result = await cashoutMinesAction();

      setMessage(result.message);

      if (result.session) {
        setSession(result.session);
      }

      if (typeof result.balance === "number") {
        setBalance(result.balance);
      }

      if (result.ok) {
        audio.play("win");
      } else {
        audio.play("error");
      }

      
    });
  }

  function resetFinished() {
    setSession(null);
    setMessage(null);
    setLastRevealed(null);
    audio.play("click");
  }

  const active = session?.status === "active";

  const revealedCount =
    session?.revealed.length ?? 0;

  const potentialPayout =
    session
      ? Math.floor(
          session.bet * session.multiplier
        )
      : 0;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          audio.play("navigate");
          router.push("/dashboard/casino");
        }}
        className="mb-6 flex items-center gap-2 text-[10px] text-white/40 transition hover:text-white/80"
      >
        <ArrowLeft className="h-4 w-4" />
        Casino
      </button>

      <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-200 opacity-20" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-200/80" />
            </span>

            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-100/55">
              OCTOSON CASINO
            </p>
          </div>

          <h1 className="mt-3 text-[42px] font-semibold tracking-[-0.05em] text-white">
            Mines
          </h1>

          <p className="mt-2 max-w-lg text-[12px] leading-5 text-white/38">
            Təhlükəsiz xanaları tap, çarpanı yüksəlt və mina
            çıxmamış qazancını götür.
          </p>
        </div>

        <motion.div
          key={balance}
          initial={{ scale: 0.97 }}
          animate={{ scale: 1 }}
          className="rounded-[15px] border border-white/[0.09] bg-white/[0.035] px-5 py-3 shadow-[0_20px_70px_rgba(0,0,0,0.25)]"
        >
          <div className="flex items-center gap-2 text-[9px] text-white/38">
            <WalletCards className="h-3.5 w-3.5" />
            Wallet
          </div>

          <p className="mt-1 text-[17px] font-semibold text-white/90">
            {formatAura(balance)}
            <span className="ml-1.5 text-[8px] text-cyan-100/55">
              AURA
            </span>
          </p>
        </motion.div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section className="relative overflow-hidden rounded-[22px] border border-white/[0.09] bg-[#0b0c10] p-3 min-[390px]:p-4 sm:rounded-[26px] sm:p-7">
          <div className="pointer-events-none absolute left-1/2 top-[-160px] h-[350px] w-[520px] -translate-x-1/2 rounded-full bg-cyan-200/[0.06] blur-[100px]" />

          <div className="relative mb-6 flex items-end justify-between gap-4">
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-white/32">
                Oyun sahəsi
              </p>

              <div className="mt-2 flex items-center gap-3">
                <span className="flex items-center gap-1.5 text-[10px] text-red-100/55">
                  <Bomb className="h-3.5 w-3.5" />
                  {session?.mineCount ?? mineCount} mina
                </span>

                <span className="h-3 w-px bg-white/10" />

                <span className="flex items-center gap-1.5 text-[10px] text-cyan-50/55">
                  <Gem className="h-3.5 w-3.5" />
                  {session?.safeCount ?? 25 - mineCount} təhlükəsiz
                </span>
              </div>
            </div>

            <div className="text-right">
              <p className="text-[9px] uppercase tracking-[0.12em] text-white/28">
                Çarpan
              </p>

              <motion.p
                key={session?.multiplier ?? 1}
                initial={{ scale: 0.86, opacity: 0.4 }}
                animate={{ scale: 1, opacity: 1 }}
                className="mt-1 text-[28px] font-semibold tracking-[-0.04em] text-cyan-50"
              >
                {(session?.multiplier ?? 1).toFixed(2)}
                <span className="ml-0.5 text-[15px] text-cyan-100/45">
                  ×
                </span>
              </motion.p>
            </div>
          </div>

          <div className="relative grid grid-cols-5 gap-1.5 min-[390px]:gap-2 sm:gap-3 lg:gap-4">
            {Array.from({ length: 25 }).map(
              (_, tile) => {
                const revealed =
                  session?.revealed.includes(tile);

                const mine =
                  session?.mines?.includes(tile);

                const finished =
                  Boolean(
                    session &&
                      session.status !== "active"
                  );

                const showMine =
                  Boolean(mine && finished);

                const safe =
                  Boolean(revealed && !mine);

                const justRevealed =
                  lastRevealed === tile;

                return (
                  <motion.button
                    key={tile}
                    type="button"
                    whileHover={
                      active && !revealed
                        ? {
                            y: -3,
                            scale: 1.015,
                          }
                        : undefined
                    }
                    whileTap={
                      active && !revealed
                        ? { scale: 0.96 }
                        : undefined
                    }
                    animate={
                      showMine && justRevealed
                        ? {
                            x: [0, -5, 5, -3, 3, 0],
                            scale: [1, 1.08, 1],
                          }
                        : {}
                    }
                    transition={{
                      duration: 0.34,
                    }}
                    disabled={
                      pending ||
                      !active ||
                      Boolean(revealed)
                    }
                    onClick={() => reveal(tile)}
                    className={`relative flex aspect-square min-w-0 items-center justify-center overflow-hidden rounded-[12px] border transition-colors min-[390px]:rounded-[14px] sm:rounded-[18px] lg:rounded-[20px] ${
                      showMine
                        ? "border-red-300/25 bg-red-300/[0.075] shadow-[inset_0_0_35px_rgba(248,113,113,0.05)]"
                        : safe
                          ? "border-cyan-100/25 bg-cyan-100/[0.075] shadow-[inset_0_0_35px_rgba(165,243,252,0.04)]"
                          : finished
                            ? "border-white/[0.06] bg-white/[0.018]"
                            : active
                              ? "border-white/[0.11] bg-white/[0.04] hover:border-cyan-100/25 hover:bg-cyan-100/[0.065]"
                              : "border-white/[0.075] bg-white/[0.025]"
                    }`}
                  >
                    <div className="absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

                    <AnimatePresence mode="wait">
                      {showMine ? (
                        <motion.div
                          key="mine"
                          initial={{
                            scale: 0,
                            rotate: -35,
                            opacity: 0,
                          }}
                          animate={{
                            scale: 1,
                            rotate: 0,
                            opacity: 1,
                          }}
                          transition={{
                            type: "spring",
                            stiffness: 260,
                            damping: 15,
                          }}
                          className="relative"
                        >
                          <div className="absolute inset-0 scale-[2.2] rounded-full bg-red-300/10 blur-xl" />
                          <Bomb className="relative h-6 w-6 text-red-100/85 sm:h-8 sm:w-8" />
                        </motion.div>
                      ) : safe ? (
                        <motion.div
                          key="gem"
                          initial={{
                            scale: 0,
                            rotate: -25,
                            opacity: 0,
                          }}
                          animate={{
                            scale: 1,
                            rotate: 0,
                            opacity: 1,
                          }}
                          transition={{
                            type: "spring",
                            stiffness: 300,
                            damping: 16,
                          }}
                          className="relative"
                        >
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{
                              opacity: [0, 0.8, 0],
                              scale: [0.5, 1.5, 1.8],
                            }}
                            transition={{
                              duration: 0.55,
                            }}
                            className="absolute inset-0 rounded-full bg-cyan-100/15 blur-xl"
                          />

                          <Gem className="relative h-6 w-6 text-cyan-50/90 sm:h-8 sm:w-8" />
                        </motion.div>
                      ) : (
                        <motion.div
                          key="closed"
                          className="flex h-8 w-8 items-center justify-center rounded-full border border-white/[0.06] bg-black/10"
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-white/18" />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.button>
                );
              }
            )}
          </div>

          <div className="relative mt-5 flex items-center justify-between rounded-[14px] border border-white/[0.07] bg-black/20 px-4 py-3">
            <div className="flex items-center gap-2 text-[9px] text-white/35">
              <ShieldCheck className="h-3.5 w-3.5 text-cyan-100/55" />
              Açılan təhlükəsiz xana
            </div>

            <span className="text-[11px] font-semibold text-white/65">
              {revealedCount}
              <span className="text-white/25">
                {" / "}
                {session?.safeCount ??
                  25 - mineCount}
              </span>
            </span>
          </div>
        </section>

        <section className="h-fit rounded-[24px] border border-white/[0.09] bg-[#0b0c10] p-5 lg:sticky lg:top-[92px]">
          {!active ? (
            <>
              <div className="flex items-center justify-between">
                <label className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/35">
                  Mərc
                </label>

                <span className="text-[8px] text-white/25">
                  Balans {formatAura(balance)}
                </span>
              </div>

              <div className="mt-4">
                <div className="flex items-center justify-between">
                  <label className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/35">
                    Mina sayı
                  </label>

                  <div className="flex items-center gap-1.5">
                    <Bomb className="h-3 w-3 text-red-100/50" />
                    <span className="text-[10px] font-semibold text-white/70">
                      {mineCount}
                    </span>
                  </div>
                </div>

                <div className="mt-2.5 rounded-[16px] border border-white/[0.08] bg-white/[0.025] p-3">
                  <div className="grid grid-cols-[42px_minmax(0,1fr)_42px] items-center gap-2">
                    <button
                      type="button"
                      disabled={pending || mineCount <= 1}
                      onClick={() => {
                        setMineCount((current) =>
                          Math.max(1, current - 1)
                        );
                        audio.play("click");
                      }}
                      className="flex h-10 items-center justify-center rounded-[11px] border border-white/[0.08] bg-white/[0.035] text-[18px] font-medium text-white/55 transition hover:border-cyan-100/20 hover:bg-cyan-100/[0.05] hover:text-white disabled:cursor-not-allowed disabled:opacity-20"
                      aria-label="Mina sayını azalt"
                    >
                      −
                    </button>

                    <div className="flex h-10 min-w-0 items-center justify-center rounded-[11px] border border-cyan-100/[0.12] bg-cyan-100/[0.04] px-2">
                      <div className="text-center">
                        <span className="text-[18px] font-semibold tracking-[-0.04em] text-cyan-50">
                          {mineCount}
                        </span>
                        <span className="ml-1.5 text-[8px] font-medium uppercase tracking-[0.1em] text-white/28">
                          mina
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={pending || mineCount >= 12}
                      onClick={() => {
                        setMineCount((current) =>
                          Math.min(12, current + 1)
                        );
                        audio.play("click");
                      }}
                      className="flex h-10 items-center justify-center rounded-[11px] border border-white/[0.08] bg-white/[0.035] text-[18px] font-medium text-white/55 transition hover:border-cyan-100/20 hover:bg-cyan-100/[0.05] hover:text-white disabled:cursor-not-allowed disabled:opacity-20"
                      aria-label="Mina sayını artır"
                    >
                      +
                    </button>
                  </div>

                  <div className="mt-3">
                    <input
                      type="range"
                      min={1}
                      max={12}
                      step={1}
                      value={mineCount}
                      disabled={pending}
                      onChange={(event) =>
                        setMineCount(
                          Number(event.target.value)
                        )
                      }
                      className="h-1.5 w-full cursor-pointer accent-cyan-100 disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label="Mina sayı"
                    />

                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-[8px] text-white/25">
                        Az risk
                      </span>

                      <span className="text-[8px] text-white/32">
                        {25 - mineCount} təhlükəsiz xana
                      </span>

                      <span className="text-[8px] text-white/25">
                        Yüksək risk
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-3 flex items-center rounded-[14px] border border-white/[0.09] bg-black/30 px-4">
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

                <span className="text-[9px] font-semibold text-cyan-100/55">
                  AURA
                </span>
              </div>

              {!session && (
                <div className="mt-2 grid grid-cols-3 gap-2">
                  <Quick
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
                    onClick={() =>
                      setBet(
                        String(
                          Math.floor(balance)
                        )
                      )
                    }
                  >
                    MAX
                  </Quick>
                </div>
              )}

              {session &&
              session.status !== "active" ? (
                <button
                  type="button"
                  onClick={resetFinished}
                  className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-[13px] border border-white/[0.1] bg-white/[0.045] text-[11px] font-semibold text-white/75 transition hover:border-cyan-100/15 hover:bg-cyan-100/[0.05]"
                >
                  <Zap className="h-4 w-4" />
                  Yeni raund
                </button>
              ) : (
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  type="button"
                  disabled={
                    pending ||
                    !bet ||
                    Number(bet) <= 0 ||
                    Number(bet) > balance
                  }
                  onClick={startGame}
                  className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-[13px] bg-cyan-100 text-[11px] font-semibold text-[#061014] transition hover:bg-white disabled:opacity-30"
                >
                  {pending ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  ) : (
                    <Bomb className="h-4 w-4" />
                  )}

                  {formatAura(Number(bet || 0))} Aura ilə başla
                </motion.button>
              )}
            </>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <p className="text-[9px] font-semibold uppercase tracking-[0.15em] text-white/35">
                  Aktiv raund
                </p>

                <span className="flex items-center gap-1 text-[8px] text-emerald-100/55">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-200/70" />
                  LIVE
                </span>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2">
                <Stat
                  label="Mərc"
                  value={`${formatAura(session.bet)} Aura`}
                />

                <Stat
                  label="Mina"
                  value={`${session.mineCount}`}
                />

                <Stat
                  label="Açılıb"
                  value={`${revealedCount} xana`}
                />
              </div>

              <div className="mt-3 overflow-hidden rounded-[16px] border border-cyan-100/[0.12] bg-cyan-100/[0.045] p-4">
                <div className="flex items-center gap-2 text-[9px] text-cyan-50/45">
                  <Sparkles className="h-3.5 w-3.5" />
                  Potensial payout
                </div>

                <motion.p
                  key={potentialPayout}
                  initial={{
                    y: 6,
                    opacity: 0,
                  }}
                  animate={{
                    y: 0,
                    opacity: 1,
                  }}
                  className="mt-2 text-[25px] font-semibold tracking-[-0.04em] text-cyan-50"
                >
                  {formatAura(potentialPayout)}
                  <span className="ml-1.5 text-[9px] text-cyan-100/45">
                    AURA
                  </span>
                </motion.p>

                <p className="mt-1 text-[9px] text-white/28">
                  {session.multiplier.toFixed(2)}× çarpan
                </p>
              </div>

              <motion.button
                whileTap={{ scale: 0.98 }}
                type="button"
                disabled={
                  pending ||
                  session.revealed.length === 0
                }
                onClick={cashout}
                className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-[13px] bg-cyan-100 text-[11px] font-semibold text-[#061014] transition hover:bg-white disabled:opacity-25"
              >
                {pending ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}

                Qazancı götür
              </motion.button>
            </>
          )}

          <AnimatePresence mode="wait">
            {message && (
              <motion.div
                key={message}
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
                className="mt-4 rounded-[13px] border border-white/[0.08] bg-white/[0.03] p-3 text-[10px] leading-5 text-white/55"
              >
                {message}
              </motion.div>
            )}
          </AnimatePresence>

          <p className="mt-5 border-t border-white/[0.06] pt-4 text-[9px] leading-5 text-white/25">
            Mina sayı artdıqca risk və potensial çarpan yüksəlir.
            Təhlükəsiz xana açdıqca payout artır. Mina açılarsa
            raund bitir və mərc itirilir.
          </p>
        </section>
      </div>
    </div>
  );
}

function Quick({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-[9px] border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[9px] font-medium text-white/45 transition hover:border-cyan-100/15 hover:bg-cyan-100/[0.045] hover:text-white/75"
    >
      {children}
    </button>
  );
}

function Stat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[13px] border border-white/[0.07] bg-white/[0.025] p-3">
      <p className="text-[8px] uppercase tracking-[0.1em] text-white/28">
        {label}
      </p>

      <p className="mt-1.5 text-[11px] font-semibold text-white/70">
        {value}
      </p>
    </div>
  );
}
