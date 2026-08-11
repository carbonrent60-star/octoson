"use client";

import { useEffect, useState, useTransition } from "react";

import { CircleDot, Trophy } from "lucide-react";

import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

import { connect4MoveAction } from "@/app/dashboard/games/actions";

type Cell = string | null;

type Connect4State = {
  phase?: "playing" | "finished";
  board?: Cell[][];
  players?: string[];
  turn?: string | null;
  moves?: number;
  draw?: boolean;
  bet?: number;

  last_move?: {
    user_id: string;
    row: number;
    column: number;
  } | null;
};

type Props = {
  code: string;
  matchId: string;
  matchStatus: string;
  state: Connect4State | null;
  winnerId: string | null;
  myUserId: string;

  players: {
    user_id: string;
    name: string;
    image?: string | null;
    balance: number;
  }[];
};

function emptyBoard(): Cell[][] {
  return Array.from({ length: 6 }, () => Array.from({ length: 7 }, () => null));
}

export default function Connect4Game({
  code,
  matchId,
  matchStatus: initialStatus,
  state: initialState,
  winnerId: initialWinnerId,
  myUserId,
  players,
}: Props) {
  const [state, setState] = useState<Connect4State>(initialState ?? {});

  const [matchStatus, setMatchStatus] = useState(initialStatus);

  const [winnerId, setWinnerId] = useState<string | null>(initialWinnerId);

  const [pending, startTransition] = useTransition();

  const [error, setError] = useState("");

  useEffect(() => {
    setState(initialState ?? {});
    setMatchStatus(initialStatus);
    setWinnerId(initialWinnerId);
  }, [initialState, initialStatus, initialWinnerId, matchId]);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();

    const channel = supabase
      .channel(`connect4-match:${matchId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "game_matches",
          filter: `id=eq.${matchId}`,
        },
        (payload) => {
          const next = payload.new as {
            state?: Connect4State;
            status?: string;
            winner_id?: string | null;
          };

          if (next.state) {
            setState(next.state);
          }

          if (next.status) {
            setMatchStatus(next.status);
          }

          if ("winner_id" in next) {
            setWinnerId(next.winner_id ?? null);
          }
        },
      )
      .subscribe((status) => {
        console.log("[CONNECT4 REALTIME]", matchId, status);
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [matchId]);

  const board =
    Array.isArray(state.board) && state.board.length === 6
      ? state.board
      : emptyBoard();

  const gamePlayers = state.players ?? [];

  const playerOne = gamePlayers[0];

  const playerTwo = gamePlayers[1];

  const finished = matchStatus === "finished" || state.phase === "finished";

  const isMyTurn = !finished && state.turn === myUserId;

  const draw = Boolean(state.draw);

  function playerName(userId: string | null | undefined) {
    if (!userId) {
      return "Player";
    }

    return (
      players.find((player) => player.user_id === userId)?.name ?? "Player"
    );
  }

  function playColumn(column: number) {
    if (pending || finished || !isMyTurn) {
      return;
    }

    setError("");

    const formData = new FormData();

    formData.set("code", code);

    formData.set("column", String(column));

    startTransition(async () => {
      const result = await connect4MoveAction(formData);

      if (!result.ok) {
        setError(result.message);
      }
    });
  }

  const bet = Math.max(0, Math.floor(Number(state.bet ?? 0)));

  const pot = bet * players.length;

  return (
    <section className="relative overflow-hidden rounded-[28px] border border-white/[0.065] bg-[#09090c] shadow-2xl shadow-black/20">
      <div className="pointer-events-none absolute left-1/2 top-[-180px] h-[320px] w-[520px] -translate-x-1/2 rounded-full bg-cyan-300/[0.04] blur-[120px]" />

      <div className="relative flex items-center justify-between border-b border-white/[0.055] px-5 py-4 md:px-7">
        <div>
          <div className="flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[0.22em] text-cyan-100/40">
            <CircleDot className="h-3.5 w-3.5" />
            Live Arena
          </div>

          <h2 className="mt-1.5 text-[17px] font-semibold tracking-[-0.025em] text-white/90">
            Connect 4
          </h2>
        </div>

        {bet > 0 && (
          <div className="text-right">
            <p className="text-[8px] font-semibold uppercase tracking-[0.16em] text-white/20">
              Pot
            </p>

            <p className="mt-1 font-mono text-[11px] font-semibold text-cyan-100/65">
              {pot.toLocaleString("en-US")} AURA
            </p>
          </div>
        )}
      </div>

      <div className="relative p-3 sm:p-5 md:p-7">
        {!finished ? (
          <div className="mb-5 text-center">
            <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-white/20">
              Növbə
            </p>

            <h3
              className={`mt-1 text-[16px] font-semibold ${
                isMyTurn ? "text-cyan-100/85" : "text-white/65"
              }`}
            >
              {isMyTurn
                ? "Sənin növbəndir"
                : `${playerName(state.turn)} oynayır`}
            </h3>
          </div>
        ) : (
          <div className="mb-5 rounded-[20px] border border-amber-200/10 bg-amber-200/[0.032] p-5 text-center">
            <Trophy className="mx-auto h-6 w-6 text-amber-200/60" />

            <p className="mt-3 text-[9px] font-semibold uppercase tracking-[0.2em] text-amber-100/30">
              {draw ? "Nəticə" : "Qalib"}
            </p>

            <h3 className="mt-1 text-xl font-semibold">
              {draw ? "Heç-heçə" : playerName(winnerId)}
            </h3>

            {bet > 0 && (
              <p className="mt-2 font-mono text-[10px] text-white/30">
                {draw
                  ? `${bet.toLocaleString("en-US")} Aura geri qaytarıldı`
                  : `${pot.toLocaleString("en-US")} Aura pot`}
              </p>
            )}
          </div>
        )}

        <div className="mx-auto w-full max-w-[620px]">
          <div
            className="mx-auto rounded-[20px] border border-cyan-100/[0.09] bg-cyan-100/[0.035] p-2 sm:rounded-[24px] sm:p-3"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
              gap: "clamp(4px, 1vw, 8px)",
              width: "100%",
              maxWidth: "620px",
            }}
          >
            {board.map((row, rowIndex) =>
              row.map((cell, columnIndex) => {
                const isOne = cell === playerOne;

                const isTwo = cell === playerTwo;

                const isLast =
                  state.last_move?.row === rowIndex &&
                  state.last_move?.column === columnIndex;

                return (
                  <button
                    key={`${rowIndex}-${columnIndex}`}
                    type="button"
                    disabled={pending || finished || !isMyTurn}
                    onClick={() => playColumn(columnIndex)}
                    aria-label={`Sütun ${columnIndex + 1}`}
                    className="group relative w-full rounded-full border border-white/[0.07] bg-black/45 p-[12%] transition disabled:cursor-default"
                    style={{
                      aspectRatio: "1 / 1",
                      minWidth: 0,
                      minHeight: 0,
                    }}
                  >
                    <span
                      className={`block h-full w-full rounded-full transition ${
                        isOne
                          ? "bg-cyan-200 shadow-[0_0_24px_rgba(165,243,252,0.18)]"
                          : isTwo
                            ? "bg-violet-300 shadow-[0_0_24px_rgba(196,181,253,0.18)]"
                            : "bg-white/[0.035] group-hover:bg-white/[0.065]"
                      } ${
                        isLast
                          ? "ring-2 ring-white/25 ring-offset-2 ring-offset-[#0c0c10]"
                          : ""
                      }`}
                    />
                  </button>
                );
              }),
            )}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <div
              className={`rounded-[15px] border p-3 ${
                state.turn === playerOne
                  ? "border-cyan-200/[0.14] bg-cyan-200/[0.04]"
                  : "border-white/[0.055] bg-black/20"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-cyan-200" />

                <p className="truncate text-[10px] font-semibold text-white/60">
                  {playerName(playerOne)}
                </p>
              </div>
            </div>

            <div
              className={`rounded-[15px] border p-3 ${
                state.turn === playerTwo
                  ? "border-violet-200/[0.14] bg-violet-200/[0.04]"
                  : "border-white/[0.055] bg-black/20"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-violet-300" />

                <p className="truncate text-[10px] font-semibold text-white/60">
                  {playerName(playerTwo)}
                </p>
              </div>
            </div>
          </div>

          {error && (
            <p className="mt-3 text-center text-[10px] text-red-200/60">
              {error}
            </p>
          )}

          {!finished && (
            <p className="mt-4 text-center text-[9px] leading-4 text-white/20">
              {pending
                ? "Gediş qeydə alınır..."
                : isMyTurn
                  ? "Daşı salmaq üçün istədiyin sütuna bas."
                  : "Rəqibin gedişi gözlənilir."}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
