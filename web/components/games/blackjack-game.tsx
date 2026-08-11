"use client";

import {
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";

import {
  CircleDollarSign,
  Crown,
  Hand,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

import {
  blackjackHitAction,
  blackjackStandAction,
} from "@/app/dashboard/games/actions";

type Suit =
  | "spades"
  | "hearts"
  | "diamonds"
  | "clubs";

type Rank =
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

type Card = {
  suit: Suit;
  rank: Rank;
};

type BlackjackPlayer = {
  user_id: string;
  hand: Card[];
  status:
    | "playing"
    | "stand"
    | "bust"
    | "blackjack"
    | "finished";
};

type BlackjackState = {
  phase?: "playing" | "dealer" | "finished";
  bet?: number;
  deck?: Card[];
  dealer?: Card[];
  players?: BlackjackPlayer[];
  turn_index?: number;
  turn?: string | null;
  winners?: string[];
  result?: Record<
    string,
    "win" | "lose" | "push"
  >;
};

type Props = {
  code: string;
  matchId: string;
  matchStatus: string;
  state: BlackjackState | null;
  myUserId: string;

  players: {
    user_id: string;
    name: string;
    image?: string | null;
    balance: number;
  }[];
};

function handValue(hand: Card[]) {
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

function suitSymbol(suit: Suit) {
  if (suit === "spades") return "♠";
  if (suit === "hearts") return "♥";
  if (suit === "diamonds") return "♦";

  return "♣";
}

function suitIsRed(suit: Suit) {
  return (
    suit === "hearts" ||
    suit === "diamonds"
  );
}

function playerName(
  players: Props["players"],
  userId: string | null | undefined,
) {
  if (!userId) {
    return "Player";
  }

  return (
    players.find(
      (player) =>
        player.user_id === userId,
    )?.name ?? "Player"
  );
}

function CardView({
  card,
  hidden = false,
  animate = false,
  delay = 0,
}: {
  card: Card;
  hidden?: boolean;
  animate?: boolean;
  delay?: number;
}) {
  const red = suitIsRed(card.suit);
  const symbol = suitSymbol(card.suit);

  return (
    <div
      className={`octo-card-shell ${
        animate ? "octo-card-deal" : ""
      }`}
      style={
        {
          "--octo-card-delay": `${delay}ms`,
        } as React.CSSProperties
      }
    >
      <div
        className={`octo-card-inner ${
          hidden ? "octo-card-hidden" : ""
        }`}
      >
        <div className="octo-card-face octo-card-back">
          <div className="octo-card-back-frame">
            <div className="octo-card-back-pattern" />
            <div className="octo-card-back-mark">
              <Sparkles className="h-4 w-4" />
            </div>
          </div>
        </div>

        <div className="octo-card-face octo-card-front">
          <div
            className={`octo-card-corner octo-card-corner-top ${
              red ? "octo-card-red" : "octo-card-black"
            }`}
          >
            <span className="octo-card-rank">
              {card.rank}
            </span>
            <span className="octo-card-suit-small">
              {symbol}
            </span>
          </div>

          <div
            className={`octo-card-center ${
              red ? "octo-card-red" : "octo-card-black"
            }`}
          >
            {symbol}
          </div>

          <div
            className={`octo-card-corner octo-card-corner-bottom ${
              red ? "octo-card-red" : "octo-card-black"
            }`}
          >
            <span className="octo-card-rank">
              {card.rank}
            </span>
            <span className="octo-card-suit-small">
              {symbol}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BlackjackGame({
  code,
  matchId,
  matchStatus: initialStatus,
  state: initialState,
  myUserId,
  players,
}: Props) {
  const [state, setState] =
    useState<BlackjackState>(
      initialState ?? {},
    );

  const [matchStatus, setMatchStatus] =
    useState(initialStatus);

  const [pending, startTransition] =
    useTransition();

  const [error, setError] =
    useState("");

  /*
   * Presentation-only bookkeeping.
   *
   * Supabase remains authoritative. These refs merely remember how
   * many cards we had on the previous realtime update so existing
   * cards do not replay their deal animation.
   */
  const previousHandsRef = useRef<
    Record<string, number>
  >({});

  const previousDealerCountRef =
    useRef(0);

  const previousPhaseRef =
    useRef<BlackjackState["phase"]>(
      initialState?.phase,
    );

  const [newCards, setNewCards] =
    useState<Set<string>>(
      () => new Set(),
    );

  const [dealerReveal, setDealerReveal] =
    useState(
      initialState?.phase === "dealer" ||
        initialState?.phase === "finished",
    );

  useEffect(() => {
    setState(initialState ?? {});
    setMatchStatus(initialStatus);
  }, [
    initialState,
    initialStatus,
    matchId,
  ]);

  useEffect(() => {
    const supabase =
      getSupabaseBrowserClient();

    const channel = supabase
      .channel(
        `blackjack-match:${matchId}`,
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
              state?: BlackjackState;
              status?: string;
            };

          if (next.state) {
            setState(next.state);
          }

          if (next.status) {
            setMatchStatus(
              next.status,
            );
          }
        },
      )
      .subscribe((status) => {
        console.log(
          "[BLACKJACK REALTIME]",
          matchId,
          status,
        );
      });

    return () => {
      void supabase.removeChannel(
        channel,
      );
    };
  }, [matchId]);

  useEffect(() => {
    const nextKeys = new Set<string>();

    const currentPlayers =
      Array.isArray(state.players)
        ? state.players
        : [];

    for (const gamePlayer of currentPlayers) {
      const previousCount =
        previousHandsRef.current[
          gamePlayer.user_id
        ] ?? 0;

      /*
       * On the first observed state we still animate the initial
       * two-card deal. Later realtime updates animate only cards
       * appended to the hand.
       */
      const from =
        previousCount === 0
          ? 0
          : previousCount;

      for (
        let index = from;
        index < gamePlayer.hand.length;
        index += 1
      ) {
        nextKeys.add(
          `player:${gamePlayer.user_id}:${index}`,
        );
      }

      previousHandsRef.current[
        gamePlayer.user_id
      ] = gamePlayer.hand.length;
    }

    const currentDealer =
      Array.isArray(state.dealer)
        ? state.dealer
        : [];

    const previousDealerCount =
      previousDealerCountRef.current;

    const dealerFrom =
      previousDealerCount === 0
        ? 0
        : previousDealerCount;

    for (
      let index = dealerFrom;
      index < currentDealer.length;
      index += 1
    ) {
      nextKeys.add(
        `dealer:${index}`,
      );
    }

    previousDealerCountRef.current =
      currentDealer.length;

    if (nextKeys.size > 0) {
      setNewCards(nextKeys);

      const timeout = window.setTimeout(
        () => setNewCards(new Set()),
        900,
      );

      return () =>
        window.clearTimeout(timeout);
    }
  }, [state.players, state.dealer]);

  useEffect(() => {
    const previous =
      previousPhaseRef.current;

    const reveal =
      state.phase === "dealer" ||
      state.phase === "finished";

    if (
      reveal &&
      previous === "playing"
    ) {
      const timeout = window.setTimeout(
        () => setDealerReveal(true),
        220,
      );

      previousPhaseRef.current =
        state.phase;

      return () =>
        window.clearTimeout(timeout);
    }

    setDealerReveal(reveal);

    previousPhaseRef.current =
      state.phase;
  }, [state.phase]);

  const gamePlayers =
    Array.isArray(state.players)
      ? state.players
      : [];

  const dealer =
    Array.isArray(state.dealer)
      ? state.dealer
      : [];

  const winners =
    state.winners ?? [];

  const result =
    state.result ?? {};

  const finished =
    matchStatus === "finished" ||
    state.phase === "finished";

  const myTurn =
    !finished &&
    state.phase === "playing" &&
    state.turn === myUserId;

  const bet = Math.max(
    0,
    Math.floor(
      Number(state.bet ?? 0),
    ),
  );

  const pot =
    bet * gamePlayers.length;

  const dealerValue =
    handValue(dealer);

  function runAction(
    action:
      | typeof blackjackHitAction
      | typeof blackjackStandAction,
  ) {
    if (
      pending ||
      finished ||
      !myTurn
    ) {
      return;
    }

    setError("");

    const formData =
      new FormData();

    formData.set("code", code);

    startTransition(async () => {
      const response =
        await action(formData);

      if (!response.ok) {
        setError(
          response.message,
        );
      }
    });
  }

  return (
    <section className="relative overflow-hidden rounded-[28px] border border-white/[0.065] bg-[#080a0c] shadow-2xl shadow-black/25">
      <div className="pointer-events-none absolute left-1/2 top-[-220px] h-[420px] w-[680px] -translate-x-1/2 rounded-full bg-emerald-300/[0.035] blur-[130px]" />

      <div className="relative flex flex-col gap-4 border-b border-white/[0.055] px-5 py-4 md:flex-row md:items-center md:justify-between md:px-7">
        <div>
          <div className="flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[0.22em] text-emerald-100/40">
            <CircleDollarSign className="h-3.5 w-3.5" />
            Live Table
          </div>

          <h2 className="mt-1.5 text-[17px] font-semibold tracking-[-0.025em] text-white/90">
            Party Blackjack
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] px-3 py-2">
            <div className="text-[8px] font-semibold uppercase tracking-[0.16em] text-white/25">
              Bet
            </div>

            <div className="mt-0.5 text-[12px] font-semibold text-white/70">
              {bet.toLocaleString(
                "en-US",
              )}{" "}
              Aura
            </div>
          </div>

          <div className="rounded-xl border border-emerald-200/[0.08] bg-emerald-300/[0.035] px-3 py-2">
            <div className="text-[8px] font-semibold uppercase tracking-[0.16em] text-emerald-100/30">
              Pot
            </div>

            <div className="mt-0.5 text-[12px] font-semibold text-emerald-100/70">
              {pot.toLocaleString(
                "en-US",
              )}{" "}
              Aura
            </div>
          </div>
        </div>
      </div>

      <div className="relative min-h-[520px] px-4 py-7 md:px-8">
        <div className="mx-auto max-w-5xl">
          <div className="text-center">
            <div className="text-[9px] font-semibold uppercase tracking-[0.22em] text-white/25">
              Dealer
            </div>

            <div className="mt-1 text-[12px] text-white/45">
              {finished ||
              state.phase ===
                "dealer"
                ? dealerValue
                : dealer.length > 0
                  ? handValue([
                      dealer[0],
                    ])
                  : 0}
            </div>
          </div>

          <div className="mt-4 flex min-h-[115px] justify-center gap-2">
            {dealer.map(
              (card, index) => (
                <CardView
                  key={`dealer-${index}-${card.rank}-${card.suit}`}
                  card={card}
                  hidden={
                    index === 1 &&
                    !dealerReveal
                  }
                  animate={newCards.has(
                    `dealer:${index}`,
                  )}
                  delay={index * 105}
                />
              ),
            )}
          </div>

          <div className="mx-auto my-8 h-px max-w-3xl bg-gradient-to-r from-transparent via-white/[0.07] to-transparent" />

          <div
            className={`grid gap-3 ${
              gamePlayers.length <= 2
                ? "mx-auto max-w-3xl md:grid-cols-2"
                : gamePlayers.length ===
                    3
                  ? "md:grid-cols-3"
                  : "md:grid-cols-2 xl:grid-cols-4"
            }`}
          >
            {gamePlayers.map(
              (gamePlayer) => {
                const profile =
                  players.find(
                    (player) =>
                      player.user_id ===
                      gamePlayer.user_id,
                  );

                const value =
                  handValue(
                    gamePlayer.hand,
                  );

                const isMe =
                  gamePlayer.user_id ===
                  myUserId;

                const isTurn =
                  !finished &&
                  state.turn ===
                    gamePlayer.user_id;

                const playerResult =
                  result[
                    gamePlayer.user_id
                  ];

                return (
                  <div
                    key={
                      gamePlayer.user_id
                    }
                    className={`relative overflow-hidden rounded-[20px] border p-4 transition-all duration-500 ${
                      finished && playerResult === "win"
                        ? "octo-result-win border-emerald-300/15 bg-emerald-300/[0.035]"
                        : finished && playerResult === "lose"
                          ? "octo-result-loss border-red-300/[0.09] bg-red-300/[0.02]"
                          : isTurn
                            ? "octo-active-player border-cyan-200/20 bg-cyan-200/[0.045]"
                            : "border-white/[0.055] bg-white/[0.018]"
                    }`}
                  >
                    {isTurn && (
                      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/40 to-transparent" />
                    )}

                    <div className="flex items-center gap-3">
                      {profile?.image ? (
                        <img
                          src={
                            profile.image
                          }
                          alt=""
                          className="h-8 w-8 rounded-full object-cover"
                        />
                      ) : (
                        <div className="flex h-8 w-8 items-center justify-center rounded-full border border-white/[0.07] bg-white/[0.035] text-[10px] font-semibold text-white/40">
                          {(
                            profile?.name ??
                            "P"
                          )
                            .slice(0, 1)
                            .toUpperCase()}
                        </div>
                      )}

                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[12px] font-semibold text-white/75">
                          {profile?.name ??
                            playerName(
                              players,
                              gamePlayer.user_id,
                            )}

                          {isMe && (
                            <span className="ml-1.5 text-[8px] font-medium uppercase tracking-wider text-cyan-100/30">
                              You
                            </span>
                          )}
                        </div>

                        <div className="mt-0.5 text-[9px] text-white/25">
                          {profile?.balance.toLocaleString(
                            "en-US",
                          ) ??
                            "0"}{" "}
                          Aura
                        </div>
                      </div>

                      <div className="rounded-lg border border-white/[0.055] bg-black/20 px-2.5 py-1.5 text-[12px] font-bold text-white/70">
                        {value}
                      </div>
                    </div>

                    <div className="octo-blackjack-hand mt-5 flex min-h-[112px] items-center justify-center">
                      {gamePlayer.hand.map(
                        (
                          card,
                          index,
                        ) => (
                          <CardView
                            key={`${gamePlayer.user_id}-${index}-${card.rank}-${card.suit}`}
                            card={card}
                            animate={newCards.has(
                              `player:${gamePlayer.user_id}:${index}`,
                            )}
                            delay={index < 2 ? index * 110 : 0}
                          />
                        ),
                      )}
                    </div>

                    <div className="mt-4 flex min-h-[25px] items-center justify-center">
                      {finished ? (
                        playerResult ===
                        "win" ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/10 bg-emerald-300/[0.05] px-2.5 py-1 text-[8px] font-semibold uppercase tracking-[0.12em] text-emerald-200/65">
                            <Crown className="h-3 w-3" />
                            Win
                          </span>
                        ) : playerResult ===
                          "push" ? (
                          <span className="rounded-full border border-white/[0.07] bg-white/[0.03] px-2.5 py-1 text-[8px] font-semibold uppercase tracking-[0.12em] text-white/40">
                            Push
                          </span>
                        ) : (
                          <span className="rounded-full border border-red-300/[0.08] bg-red-300/[0.035] px-2.5 py-1 text-[8px] font-semibold uppercase tracking-[0.12em] text-red-200/45">
                            Lose
                          </span>
                        )
                      ) : gamePlayer.status ===
                        "blackjack" ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-amber-200/10 bg-amber-200/[0.04] px-2.5 py-1 text-[8px] font-semibold uppercase tracking-[0.12em] text-amber-100/60">
                          <Sparkles className="h-3 w-3" />
                          Blackjack
                        </span>
                      ) : gamePlayer.status ===
                        "bust" ? (
                        <span className="rounded-full border border-red-300/[0.08] bg-red-300/[0.035] px-2.5 py-1 text-[8px] font-semibold uppercase tracking-[0.12em] text-red-200/45">
                          Bust
                        </span>
                      ) : gamePlayer.status ===
                        "stand" ? (
                        <span className="rounded-full border border-white/[0.07] bg-white/[0.025] px-2.5 py-1 text-[8px] font-semibold uppercase tracking-[0.12em] text-white/35">
                          Stand
                        </span>
                      ) : isTurn ? (
                        <span className="text-[8px] font-semibold uppercase tracking-[0.14em] text-cyan-100/50">
                          Playing
                        </span>
                      ) : (
                        <span className="text-[8px] uppercase tracking-[0.14em] text-white/20">
                          Waiting
                        </span>
                      )}
                    </div>
                  </div>
                );
              },
            )}
          </div>

          <div className="mt-7 flex min-h-[92px] flex-col items-center justify-center">
            {error && (
              <div className="mb-3 rounded-xl border border-red-300/[0.08] bg-red-300/[0.035] px-4 py-2 text-[10px] text-red-100/60">
                {error}
              </div>
            )}

            {finished ? (
              <div className="text-center">
                <ShieldCheck className="mx-auto h-5 w-5 text-emerald-100/40" />

                <div className="mt-2 text-[13px] font-semibold text-white/70">
                  Raund bitdi
                </div>

                <div className="mt-1 text-[10px] text-white/25">
                  {winners.length === 1
                    ? `${playerName(
                        players,
                        winners[0],
                      )} qalib gəldi.`
                    : winners.length >
                        1
                      ? "Bərabərlik."
                      : "Dealer qazandı."}
                </div>
              </div>
            ) : myTurn ? (
              <>
                <div className="mb-3 text-[10px] font-medium text-cyan-100/50">
                  Sənin növbəndir
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      runAction(
                        blackjackHitAction,
                      )
                    }
                    className="inline-flex h-11 items-center gap-2 rounded-xl border border-cyan-200/10 bg-cyan-200/[0.06] px-6 text-[10px] font-semibold text-cyan-50/75 transition hover:bg-cyan-200/[0.1] disabled:opacity-40"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    Hit
                  </button>

                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      runAction(
                        blackjackStandAction,
                      )
                    }
                    className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.035] px-6 text-[10px] font-semibold text-white/60 transition hover:bg-white/[0.06] disabled:opacity-40"
                  >
                    <Hand className="h-3.5 w-3.5" />
                    Stand
                  </button>
                </div>
              </>
            ) : (
              <div className="text-center">
                <div className="text-[10px] text-white/30">
                  {state.phase ===
                  "dealer"
                    ? "Dealer oynayır..."
                    : `${playerName(
                        players,
                        state.turn,
                      )} oynayır`}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <style jsx global>{`
        /*
         * Blackjack card rendering
         *
         * No Unicode playing-card glyphs are used. Only ordinary
         * rank text and the four basic suit symbols are rendered.
         * This avoids Safari's playing-card font fallback issue.
         */
        .octo-card-shell {
          --octo-card-delay: 0ms;
          position: relative;
          width: 66px;
          height: 94px;
          flex: 0 0 auto;
          perspective: 900px;
          -webkit-perspective: 900px;
          isolation: isolate;
        }

        .octo-card-inner {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          transform-style: preserve-3d;
          -webkit-transform-style: preserve-3d;
          transition:
            transform 520ms
            cubic-bezier(0.2, 0.75, 0.2, 1);
          transform: rotateY(0deg);
          will-change: transform;
        }

        .octo-card-inner.octo-card-hidden {
          transform: rotateY(180deg);
        }

        .octo-card-face {
          position: absolute;
          inset: 0;
          overflow: hidden;
          border-radius: 11px;
          -webkit-backface-visibility: hidden;
          backface-visibility: hidden;
          transform: translateZ(0);
          -webkit-transform: translateZ(0);
        }

        .octo-card-front {
          border: 1px solid rgba(0, 0, 0, 0.14);
          background: #f5f3ee;
          box-shadow:
            0 13px 28px rgba(0, 0, 0, 0.34),
            inset 0 1px 0 rgba(255, 255, 255, 0.85);
          font-family:
            Arial,
            Helvetica,
            "Helvetica Neue",
            sans-serif;
          font-variant-numeric: tabular-nums;
          text-rendering: geometricPrecision;
          -webkit-font-smoothing: antialiased;
        }

        .octo-card-back {
          transform: rotateY(180deg) translateZ(0);
          -webkit-transform: rotateY(180deg) translateZ(0);
          border: 1px solid rgba(165, 243, 252, 0.11);
          background: #0c1217;
          box-shadow:
            0 13px 28px rgba(0, 0, 0, 0.38),
            inset 0 1px 0 rgba(255, 255, 255, 0.035);
        }

        .octo-card-back-frame {
          position: absolute;
          inset: 5px;
          overflow: hidden;
          border: 1px solid rgba(165, 243, 252, 0.09);
          border-radius: 7px;
          background: #0f171d;
        }

        .octo-card-back-pattern {
          position: absolute;
          inset: -20px;
          opacity: 0.42;
          background-image:
            linear-gradient(
              45deg,
              rgba(103, 232, 249, 0.045) 25%,
              transparent 25%,
              transparent 75%,
              rgba(103, 232, 249, 0.045) 75%
            ),
            linear-gradient(
              -45deg,
              rgba(103, 232, 249, 0.025) 25%,
              transparent 25%,
              transparent 75%,
              rgba(103, 232, 249, 0.025) 75%
            );
          background-size: 13px 13px;
        }

        .octo-card-back-mark {
          position: absolute;
          left: 50%;
          top: 50%;
          display: flex;
          width: 31px;
          height: 31px;
          align-items: center;
          justify-content: center;
          border: 1px solid rgba(165, 243, 252, 0.1);
          border-radius: 999px;
          background: rgba(165, 243, 252, 0.035);
          color: rgba(207, 250, 254, 0.32);
          transform: translate(-50%, -50%);
        }

        .octo-card-corner {
          position: absolute;
          z-index: 2;
          display: flex;
          flex-direction: column;
          align-items: center;
          width: 20px;
          font-family:
            Arial,
            Helvetica,
            "Helvetica Neue",
            sans-serif;
          font-weight: 800;
          line-height: 1;
          white-space: nowrap;
          writing-mode: horizontal-tb !important;
          text-orientation: mixed !important;
        }

        .octo-card-corner-top {
          left: 6px;
          top: 6px;
        }

        .octo-card-corner-bottom {
          right: 6px;
          bottom: 6px;
          transform: rotate(180deg);
        }

        .octo-card-rank {
          display: block;
          font-size: 15px;
          line-height: 15px;
          letter-spacing: -0.04em;
        }

        .octo-card-suit-small {
          display: block;
          margin-top: 2px;
          font-family:
            Arial,
            Helvetica,
            "Helvetica Neue",
            sans-serif;
          font-size: 13px;
          font-weight: 700;
          line-height: 13px;
        }

        .octo-card-center {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family:
            Arial,
            Helvetica,
            "Helvetica Neue",
            sans-serif;
          font-size: 31px;
          font-weight: 500;
          line-height: 1;
        }

        .octo-card-red {
          color: #ef3038;
        }

        .octo-card-black {
          color: #14171b;
        }

        /*
         * New cards are dealt from above/centre of the table.
         * Existing realtime cards do not receive this class again.
         */
        .octo-card-deal {
          animation:
            octo-card-deal 480ms
            cubic-bezier(0.18, 0.82, 0.2, 1)
            both;
          animation-delay: var(--octo-card-delay);
          will-change: transform, opacity;
        }

        @keyframes octo-card-deal {
          0% {
            opacity: 0;
            transform:
              translate3d(0, -72px, 0)
              scale(0.86)
              rotate(-5deg);
          }

          62% {
            opacity: 1;
            transform:
              translate3d(0, 5px, 0)
              scale(1.015)
              rotate(0.8deg);
          }

          100% {
            opacity: 1;
            transform:
              translate3d(0, 0, 0)
              scale(1)
              rotate(0deg);
          }
        }

        /*
         * Cards overlap naturally as hands become larger rather
         * than wrapping into an ugly second row.
         */
        .octo-blackjack-hand
          > .octo-card-shell
          + .octo-card-shell {
          margin-left: -12px;
        }

        .octo-blackjack-hand
          > .octo-card-shell {
          transition:
            margin 320ms ease,
            transform 320ms ease;
        }

        .octo-blackjack-hand
          > .octo-card-shell:hover {
          z-index: 20;
          transform: translateY(-4px);
        }

        .octo-active-player {
          box-shadow:
            0 0 0 1px rgba(165, 243, 252, 0.025),
            0 0 32px rgba(103, 232, 249, 0.035);
        }

        .octo-result-win {
          animation:
            octo-result-win 620ms
            cubic-bezier(0.2, 0.8, 0.2, 1)
            both;
        }

        .octo-result-loss {
          animation:
            octo-result-loss 500ms ease both;
        }

        @keyframes octo-result-win {
          0% {
            box-shadow:
              0 0 0 rgba(52, 211, 153, 0);
          }

          50% {
            box-shadow:
              0 0 42px rgba(52, 211, 153, 0.1);
          }

          100% {
            box-shadow:
              0 0 24px rgba(52, 211, 153, 0.045);
          }
        }

        @keyframes octo-result-loss {
          from {
            opacity: 0.78;
          }

          to {
            opacity: 1;
          }
        }

        @media (min-width: 768px) {
          .octo-card-shell {
            width: 78px;
            height: 112px;
          }

          .octo-card-rank {
            font-size: 17px;
            line-height: 17px;
          }

          .octo-card-suit-small {
            font-size: 14px;
            line-height: 14px;
          }

          .octo-card-center {
            font-size: 37px;
          }

          .octo-blackjack-hand
            > .octo-card-shell
            + .octo-card-shell {
            margin-left: -14px;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .octo-card-deal,
          .octo-result-win,
          .octo-result-loss {
            animation: none !important;
          }

          .octo-card-inner,
          .octo-blackjack-hand
            > .octo-card-shell {
            transition-duration: 1ms !important;
          }
        }
      `}</style>
    </section>
  );
}
