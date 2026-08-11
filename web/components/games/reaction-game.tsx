"use client";

import {
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";

import {
  Activity,
  RotateCcw,
  Trophy,
  Zap,
} from "lucide-react";

import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

import {
  reactionClickAction,
  reactionRematchAction,
} from "@/app/dashboard/games/actions";

type Result = {
  user_id: string;
  reaction_ms: number;
  false_start?: boolean;
};

type MatchState = {
  phase?: "waiting" | "go" | "finished";
  go_at?: string;
  results?: Result[];
  bet?: number;
};

type Props = {
  code: string;
  roomId: string;
  matchId: string;
  state: MatchState | null;
  matchStatus: string;
  isHost: boolean;
  myUserId: string;

  players: {
    user_id: string;
    name: string;
    balance: number;
  }[];
};

export default function ReactionGame({
  code,
  roomId,
  matchId,
  state: initialState,
  matchStatus: initialStatus,
  isHost,
  myUserId,
  players,
}: Props) {
  const [state, setState] =
    useState<MatchState>(
      initialState ?? {}
    );

  const [matchStatus, setMatchStatus] =
    useState(initialStatus);

  const [now, setNow] =
    useState(() => Date.now());

  const [pending, startTransition] =
    useTransition();

  const [bet, setBet] =
    useState(0);

  const clickedRef =
    useRef(false);

  useEffect(() => {
    setState(initialState ?? {});
    setMatchStatus(initialStatus);
  }, [
    initialState,
    initialStatus,
    matchId,
  ]);

  /*
   * IMPORTANT:
   * Game state updates locally from the changed match row.
   *
   * No router.refresh().
   * No 700 ms polling.
   * No complete dashboard rerender.
   */
  useEffect(() => {
    const supabase =
      getSupabaseBrowserClient();

    const channel = supabase
      .channel(
        `reaction-match:${matchId}`
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "game_matches",
          filter: `id=eq.${matchId}`,
        },
        (payload) => {
          const next =
            payload.new as {
              status?: string;
              state?: MatchState;
            };

          if (next.state) {
            setState(next.state);
          }

          if (next.status) {
            setMatchStatus(
              next.status
            );
          }
        }
      )
      .subscribe((status) => {
        console.log(
          "[REACTION REALTIME]",
          matchId,
          status
        );
      });

    return () => {
      void supabase.removeChannel(
        channel
      );
    };
  }, [matchId]);

  const goAt =
    state?.go_at
      ? new Date(
          state.go_at
        ).getTime()
      : null;

  const results =
    state?.results ?? [];

  const myResult =
    results.find(
      (result) =>
        result.user_id === myUserId
    );

  const finished =
    state?.phase === "finished" ||
    matchStatus === "finished";

  useEffect(() => {
    clickedRef.current =
      Boolean(myResult);
  }, [myResult]);

  useEffect(() => {
    if (!goAt || finished) {
      return;
    }

    const delay =
      Math.max(
        0,
        goAt - Date.now()
      );

    /*
     * We don't need a 25ms permanent timer.
     * Wake exactly when GO should appear.
     */
    const goTimer =
      window.setTimeout(() => {
        setNow(Date.now());
      }, delay + 2);

    /*
     * Tiny animation refresh only around
     * the actual reaction phase.
     */
    const interval =
      window.setInterval(() => {
        if (
          Date.now() >= goAt
        ) {
          setNow(Date.now());
        }
      }, 100);

    return () => {
      window.clearTimeout(
        goTimer
      );

      window.clearInterval(
        interval
      );
    };
  }, [
    goAt,
    finished,
  ]);

  const hasGone =
    Boolean(goAt) &&
    now >= Number(goAt);

  const canClick =
    !finished &&
    !myResult &&
    Boolean(goAt);

  const sortedResults =
    [...results].sort(
      (a, b) => {
        if (
          a.false_start &&
          !b.false_start
        ) {
          return 1;
        }

        if (
          !a.false_start &&
          b.false_start
        ) {
          return -1;
        }

        return (
          a.reaction_ms -
          b.reaction_ms
        );
      }
    );

  const winner =
    sortedResults.find(
      (result) =>
        !result.false_start
    );

  function playerName(
    userId: string
  ) {
    return (
      players.find(
        (player) =>
          player.user_id ===
          userId
      )?.name ?? "Player"
    );
  }

  function click() {
    if (
      !canClick ||
      clickedRef.current ||
      pending
    ) {
      return;
    }

    clickedRef.current = true;

    const formData =
      new FormData();

    formData.set(
      "code",
      code
    );

    startTransition(
      async () => {
        const result =
          await reactionClickAction(
            formData
          );

        if (!result.ok) {
          clickedRef.current =
            false;
        }
      }
    );
  }

  function rematch() {
    if (
      !isHost ||
      pending
    ) {
      return;
    }

    const formData =
      new FormData();

    formData.set(
      "code",
      code
    );

    formData.set(
      "bet",
      String(bet)
    );

    startTransition(
      async () => {
        const result =
          await reactionRematchAction(
            formData
          );

        if (result.ok) {
          setBet(0);
        }
      }
    );
  }

  const currentBet = Math.max(
    0,
    Math.floor(
      Number(state?.bet ?? 0)
    )
  );

  const currentPot =
    currentBet * players.length;

  const winnerProfit =
    Math.max(
      0,
      currentPot - currentBet
    );

  const myBalance =
    players.find(
      (player) =>
        player.user_id === myUserId
    )?.balance ?? 0;

  const didIWin =
    Boolean(
      winner &&
        winner.user_id ===
          myUserId
    );

  const nextPot =
    bet * players.length;

  return (
    <section className="relative overflow-hidden rounded-[28px] border border-white/[0.065] bg-[#09090c] shadow-2xl shadow-black/20">
      <div className="pointer-events-none absolute left-1/2 top-[-180px] h-[320px] w-[520px] -translate-x-1/2 rounded-full bg-cyan-300/[0.04] blur-[120px]" />

      <div className="relative flex items-center justify-between border-b border-white/[0.055] px-5 py-4 md:px-7">
        <div>
          <div className="flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[0.22em] text-cyan-100/40">
            <Activity className="h-3.5 w-3.5" />
            Live Arena
          </div>

          <h2 className="mt-1.5 text-[17px] font-semibold tracking-[-0.025em] text-white/90">
            Reaction
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-20" />
            <span className="relative h-2 w-2 rounded-full bg-emerald-300" />
          </span>

          <span className="text-[9px] font-medium uppercase tracking-[0.12em] text-white/25">
            {results.length}/
            {players.length}
          </span>
        </div>
      </div>

      {!finished ? (
        <button
          type="button"
          disabled={
            !canClick ||
            pending
          }
          onPointerDown={click}
          className={`relative flex min-h-[420px] w-full select-none flex-col items-center justify-center overflow-hidden p-8 text-center transition-colors duration-100 ${
            myResult
              ? "cursor-default bg-white/[0.012]"
              : hasGone
                ? "cursor-pointer bg-emerald-300/[0.095] active:bg-emerald-300/[0.18]"
                : "cursor-pointer bg-red-300/[0.028] active:bg-red-300/[0.055]"
          }`}
        >
          {hasGone &&
            !myResult && (
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(110,231,183,0.08),transparent_55%)]" />
            )}

          {myResult ? (
            <>
              <div className="flex h-[74px] w-[74px] items-center justify-center rounded-[24px] border border-white/[0.07] bg-white/[0.035]">
                <Zap className="h-8 w-8 text-white/45" />
              </div>

              <h3 className="mt-6 text-3xl font-semibold tracking-[-0.055em]">
                {myResult.false_start
                  ? "Çox tez!"
                  : `${myResult.reaction_ms} ms`}
              </h3>

              <p className="mt-2 max-w-sm text-[11px] leading-5 text-white/25">
                {myResult.false_start
                  ? "Siqnaldan əvvəl basdın."
                  : "Nəticən qeydə alındı. Digər oyunçuları gözləyirik."}
              </p>
            </>
          ) : hasGone ? (
            <>
              <div className="relative flex h-24 w-24 items-center justify-center rounded-[30px] border border-emerald-200/20 bg-emerald-200/[0.09] shadow-[0_0_100px_rgba(110,231,183,0.13)]">
                <Zap className="h-11 w-11 text-emerald-100" />
              </div>

              <h3 className="mt-7 text-5xl font-bold tracking-[-0.065em] text-emerald-100">
                İNDİ
              </h3>

              <p className="mt-3 text-[11px] font-medium uppercase tracking-[0.16em] text-emerald-100/35">
                Bas
              </p>
            </>
          ) : (
            <>
              <div className="relative">
                <div className="absolute inset-0 animate-ping rounded-full bg-red-200/10" />

                <div className="relative h-4 w-4 rounded-full border border-red-100/20 bg-red-200/70" />
              </div>

              <h3 className="mt-7 text-3xl font-semibold tracking-[-0.05em] text-white/78">
                Gözlə
              </h3>

              <p className="mt-3 text-[11px] text-white/25">
                Yaşıl siqnal görünməmiş basma.
              </p>
            </>
          )}
        </button>
      ) : (
        <div className="relative p-5 md:p-7">
          <div className="rounded-[22px] border border-amber-200/10 bg-amber-200/[0.032] p-7 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-[18px] border border-amber-200/10 bg-amber-200/[0.04]">
              <Trophy className="h-6 w-6 text-amber-200/60" />
            </div>

            <p className="mt-4 text-[9px] font-semibold uppercase tracking-[0.22em] text-amber-100/30">
              Qalib
            </p>

            <h3 className="mt-1 text-2xl font-semibold tracking-[-0.04em]">
              {winner
                ? playerName(
                    winner.user_id
                  )
                : "Qalib yoxdur"}
            </h3>

            {winner && (
              <p className="mt-1.5 font-mono text-[12px] text-white/30">
                {winner.reaction_ms} ms
              </p>
            )}
          </div>

          {currentBet > 0 && (
            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              <div className="rounded-[15px] border border-white/[0.055] bg-black/25 p-4">
                <p className="text-[8px] font-semibold uppercase tracking-[0.14em] text-white/20">
                  Mərcin
                </p>

                <p className="mt-1 font-mono text-[12px] font-semibold text-red-100/55">
                  -{currentBet.toLocaleString(
                    "en-US"
                  )} AURA
                </p>
              </div>

              <div className="rounded-[15px] border border-white/[0.055] bg-black/25 p-4">
                <p className="text-[8px] font-semibold uppercase tracking-[0.14em] text-white/20">
                  Nəticən
                </p>

                <p
                  className={`mt-1 font-mono text-[12px] font-semibold ${
                    didIWin
                      ? "text-emerald-100/65"
                      : "text-red-100/55"
                  }`}
                >
                  {didIWin
                    ? `+${winnerProfit.toLocaleString(
                        "en-US"
                      )} AURA`
                    : `-${currentBet.toLocaleString(
                        "en-US"
                      )} AURA`}
                </p>
              </div>

              <div className="rounded-[15px] border border-cyan-100/[0.08] bg-cyan-100/[0.025] p-4">
                <p className="text-[8px] font-semibold uppercase tracking-[0.14em] text-cyan-100/25">
                  Cari balans
                </p>

                <p className="mt-1 font-mono text-[12px] font-semibold text-cyan-50/65">
                  {myBalance.toLocaleString(
                    "en-US"
                  )} AURA
                </p>
              </div>
            </div>
          )}

          <div className="mt-4 space-y-2">
            {sortedResults.map(
              (
                result,
                index
              ) => (
                <div
                  key={
                    result.user_id
                  }
                  className="flex items-center justify-between rounded-[15px] border border-white/[0.055] bg-black/25 px-4 py-3.5"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="w-5 shrink-0 text-[10px] font-semibold text-white/20">
                      #{index + 1}
                    </span>

                    <span className="truncate text-[11px] font-medium text-white/65">
                      {playerName(
                        result.user_id
                      )}
                    </span>
                  </div>

                  <span
                    className={`font-mono text-[11px] font-semibold ${
                      result.false_start
                        ? "text-red-200/55"
                        : "text-cyan-100/65"
                    }`}
                  >
                    {result.false_start
                      ? "FALSE START"
                      : `${result.reaction_ms} ms`}
                  </span>
                </div>
              )
            )}
          </div>

          {isHost && (
            <div className="mt-5 rounded-[20px] border border-white/[0.06] bg-white/[0.018] p-4">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-[8px] font-semibold uppercase tracking-[0.18em] text-white/20">
                    Növbəti raund
                  </p>

                  <h4 className="mt-1 text-[12px] font-semibold text-white/70">
                    Aura mərci
                  </h4>
                </div>

                <div className="text-right">
                  <p className="font-mono text-[11px] font-semibold text-cyan-100/65">
                    {bet.toLocaleString("en-US")} AURA
                  </p>

                  {bet > 0 && (
                    <p className="mt-1 text-[8px] text-white/20">
                      Pot: {nextPot.toLocaleString("en-US")} AURA
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-4 grid grid-cols-5 gap-1.5">
                {[0, 100, 500, 1000, 5000].map(
                  (amount) => (
                    <button
                      key={amount}
                      type="button"
                      disabled={pending}
                      onClick={() =>
                        setBet(amount)
                      }
                      className={`h-9 rounded-[10px] border text-[9px] font-semibold transition-colors duration-100 disabled:opacity-40 ${
                        bet === amount
                          ? "border-cyan-200/[0.16] bg-cyan-200/[0.07] text-cyan-100/75"
                          : "border-white/[0.055] bg-black/20 text-white/30 hover:bg-white/[0.035]"
                      }`}
                    >
                      {amount === 0
                        ? "Pulsuz"
                        : amount >= 1000
                          ? `${amount / 1000}K`
                          : amount}
                    </button>
                  )
                )}
              </div>

              <div className="mt-2 flex gap-2">
                <input
                  type="number"
                  min={0}
                  max={1000000}
                  step={1}
                  disabled={pending}
                  value={bet}
                  onChange={(event) =>
                    setBet(
                      Math.max(
                        0,
                        Math.min(
                          1000000,
                          Math.floor(
                            Number(
                              event.target.value
                            ) || 0
                          )
                        )
                      )
                    )
                  }
                  className="h-11 min-w-0 flex-1 rounded-[12px] border border-white/[0.06] bg-black/25 px-3 text-center font-mono text-[10px] text-white/60 outline-none transition focus:border-cyan-100/20 disabled:opacity-40"
                />

                <button
                  type="button"
                  disabled={pending}
                  onClick={rematch}
                  className="flex h-11 min-w-[150px] items-center justify-center gap-2 rounded-[12px] bg-cyan-100 px-5 text-[10px] font-semibold text-black transition-colors duration-100 hover:bg-white disabled:opacity-40"
                >
                  <RotateCcw className="h-3.5 w-3.5" />

                  {pending
                    ? "Başladılır..."
                    : bet > 0
                      ? `${bet.toLocaleString("en-US")} Aura ilə oyna`
                      : "Pulsuz oyna"}
                </button>
              </div>

              <p className="mt-3 text-[9px] leading-4 text-white/20">
                Risk: -{bet.toLocaleString("en-US")} Aura · Qələbədə xalis qazanc: +{Math.max(0, nextPot - bet).toLocaleString("en-US")} Aura. Rəqib otaqdan çıxsa rematch başlamayacaq.
              </p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
