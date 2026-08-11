"use client";

import {
  useEffect,
  useState,
  useTransition,
} from "react";

import {
  Check,
  Crown,
  LoaderCircle,
  Send,
  Shield,
  Sparkles,
  Target,
  Trophy,
  Users,
  Zap,
} from "lucide-react";

import {
  partyMatchAction,
} from "@/app/dashboard/games/actions";

import type {
  PartyRoomState,
} from "@/lib/octoson-party-games";

type Props = {
  code: string;
  myUserId: string;
  initialState: PartyRoomState;
};

export default function PartyMatchGame({
  code,
  myUserId,
  initialState,
}: Props) {
  const [
    state,
    setState,
  ] =
    useState<PartyRoomState>(
      initialState,
    );

  const [
    pending,
    startTransition,
  ] = useTransition();

  const [
    message,
    setMessage,
  ] =
    useState<string | null>(
      null,
    );

  useEffect(() => {
    setState(initialState);
  }, [initialState]);

  function act(
    action: string,
    value?: unknown,
  ) {
    setMessage(null);

    startTransition(
      async () => {
        const result =
          await partyMatchAction(
            code,
            action,
            value,
          );

        if (
          result.ok &&
          result.state
        ) {
          setState(
            result.state,
          );
        }

        if (
          !result.ok
        ) {
          setMessage(
            result.message,
          );
        }
      },
    );
  }

  return (
    <section className="relative overflow-hidden rounded-[26px] border border-white/[0.075] bg-[#090c0f] shadow-[0_25px_90px_rgba(0,0,0,0.28)]">
      <div className="pointer-events-none absolute left-1/2 top-[-260px] h-[520px] w-[760px] -translate-x-1/2 rounded-full bg-cyan-300/[0.055] blur-[130px]" />

      <div className="relative border-b border-white/[0.055] px-5 py-4 sm:px-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-[10px] border border-cyan-100/[0.11] bg-cyan-100/[0.04]">
              <Sparkles className="h-3.5 w-3.5 text-cyan-100/60" />
            </span>

            <div>
              <p className="text-[8px] font-semibold uppercase tracking-[0.18em] text-cyan-100/45">
                OCTOSON LIVE
              </p>

              <p className="mt-0.5 text-[10px] text-white/35">
                Multiplayer match
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-full border border-white/[0.07] bg-white/[0.025] px-3 py-1.5">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-300" />

            <span className="text-[8px] font-medium uppercase tracking-[0.12em] text-emerald-100/50">
              Live
            </span>
          </div>
        </div>
      </div>

      <div className="relative grid gap-0 xl:grid-cols-[minmax(0,1fr)_250px]">
        <main className="min-w-0 p-4 sm:p-6">
          <GameRenderer
            room={state}
            me={myUserId}
            pending={pending}
            act={act}
          />

          {message && (
            <div className="mt-4 rounded-[12px] border border-rose-300/[0.1] bg-rose-300/[0.035] px-4 py-3 text-[10px] text-rose-100/65">
              {message}
            </div>
          )}
        </main>

        <Scoreboard
          room={state}
          myUserId={
            myUserId
          }
        />
      </div>
    </section>
  );
}

function Scoreboard({
  room,
  myUserId,
}: {
  room: PartyRoomState;
  myUserId: string;
}) {
  const players =
    [...room.players].sort(
      (a, b) =>
        b.score - a.score,
    );

  return (
    <aside className="border-t border-white/[0.055] bg-black/15 p-4 xl:border-l xl:border-t-0">
      <div className="flex items-center justify-between">
        <p className="text-[8px] font-semibold uppercase tracking-[0.17em] text-white/28">
          Scoreboard
        </p>

        <div className="flex items-center gap-1.5 text-[8px] text-white/25">
          <Users className="h-3 w-3" />

          {
            room.players
              .length
          }
        </div>
      </div>

      <div className="mt-3 space-y-2">
        {players.map(
          (
            player,
            index,
          ) => (
            <div
              key={player.id}
              className={`flex items-center gap-3 rounded-[12px] border px-3 py-3 ${
                player.id ===
                myUserId
                  ? "border-cyan-100/[0.13] bg-cyan-100/[0.045]"
                  : "border-white/[0.055] bg-white/[0.02]"
              }`}
            >
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[9px] bg-black/25 text-[9px] font-semibold text-white/35">
                {index + 1}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="truncate text-[10px] font-medium text-white/70">
                    {
                      player.name
                    }
                  </p>

                  {room.hostId ===
                    player.id && (
                    <Crown className="h-3 w-3 text-amber-200/55" />
                  )}
                </div>

                <p className="mt-0.5 text-[7px] uppercase tracking-[0.1em] text-white/20">
                  {player.alive
                    ? "Aktiv"
                    : "Eliminasiya"}
                </p>
              </div>

              <span className="font-mono text-[11px] font-semibold text-cyan-50/70">
                {
                  player.score
                }
              </span>
            </div>
          ),
        )}
      </div>
    </aside>
  );
}

function GameRenderer({
  room,
  me,
  pending,
  act,
}: {
  room: PartyRoomState;
  me: string;
  pending: boolean;
  act: (
    action: string,
    value?: unknown,
  ) => void;
}) {
  if (
    room.status ===
    "finished"
  ) {
    return (
      <Finished
        room={room}
      />
    );
  }

  switch (room.game) {
    case "last-button":
      return (
        <LastButton
          room={room}
          me={me}
          pending={pending}
          act={act}
        />
      );

    case "undercover":
      return (
        <Undercover
          room={room}
          me={me}
          pending={pending}
          act={act}
        />
      );

    case "pixel-wars":
      return (
        <PixelWars
          room={room}
          me={me}
          pending={pending}
          act={act}
        />
      );

    case "vault":
      return (
        <Vault
          room={room}
          pending={pending}
          act={act}
        />
      );

    case "king-hill":
      return (
        <SpeedGame
          room={room}
          pending={pending}
          act={act}
          octo={false}
        />
      );

    case "octo-party":
      return (
        <SpeedGame
          room={room}
          pending={pending}
          act={act}
          octo
        />
      );
  }
}

function Shell({
  children,
}: {
  children:
    React.ReactNode;
}) {
  return (
    <div className="relative min-h-[430px] overflow-hidden rounded-[20px] border border-white/[0.06] bg-white/[0.018] p-5 sm:p-7">
      <div className="pointer-events-none absolute left-1/2 top-[-180px] h-[360px] w-[600px] -translate-x-1/2 rounded-full bg-cyan-200/[0.045] blur-[100px]" />

      <div className="relative">
        {children}
      </div>
    </div>
  );
}

function Finished({
  room,
}: {
  room: PartyRoomState;
}) {
  const ranking =
    [...room.players].sort(
      (a, b) =>
        b.score - a.score,
    );

  const winner =
    ranking[0];

  return (
    <Shell>
      <div className="mx-auto max-w-[520px] py-10 text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[24px] border border-amber-200/[0.13] bg-amber-200/[0.045]">
          <Trophy className="h-8 w-8 text-amber-100/75" />
        </div>

        <p className="mt-6 text-[8px] font-semibold uppercase tracking-[0.2em] text-white/25">
          Match bitdi
        </p>

        <h2 className="mt-2 text-[30px] font-semibold tracking-[-0.035em] text-white">
          {winner?.name ??
            "Qalib yoxdur"}
        </h2>

        <p className="mt-2 font-mono text-[13px] font-semibold text-cyan-100/60">
          {winner?.score ??
            0} XAL
        </p>

        <div className="mt-8 space-y-2 text-left">
          {ranking
            .slice(0, 5)
            .map(
              (
                player,
                index,
              ) => (
                <div
                  key={
                    player.id
                  }
                  className="flex items-center justify-between rounded-[12px] border border-white/[0.055] bg-black/20 px-4 py-3"
                >
                  <span className="text-[10px] text-white/50">
                    #{index + 1}{" "}
                    {
                      player.name
                    }
                  </span>

                  <span className="font-mono text-[10px] text-cyan-100/60">
                    {
                      player.score
                    }
                  </span>
                </div>
              ),
            )}
        </div>
      </div>
    </Shell>
  );
}

function LastButton({
  room,
  me,
  pending,
  act,
}: any) {
  const state =
    room.gameState as any;

  const alive =
    room.players.filter(
      (player: any) =>
        player.alive,
    );

  const current =
    alive[
      Number(
        state.turn ?? 0,
      ) %
        Math.max(
          1,
          alive.length,
        )
    ];

  const myTurn =
    current?.id === me;

  const pressure =
    Number(
      state.pressure ?? 0,
    );

  return (
    <Shell>
      <div className="text-center">
        <div className="flex items-center justify-center gap-2 text-[8px] font-semibold uppercase tracking-[0.18em] text-white/28">
          <Zap className="h-3 w-3" />
          LAST BUTTON
        </div>

        <h2 className="mt-3 text-[25px] font-semibold text-white">
          {myTurn
            ? "Sənin növbəndir"
            : `${current?.name ?? "—"} oynayır`}
        </h2>

        <p className="mt-2 text-[10px] text-white/30">
          Basdıqca risk artır. Bomba partlayan oyunçu eliminasiya olunur.
        </p>

        <button
          disabled={
            pending ||
            !myTurn
          }
          onClick={() =>
            act("press")
          }
          className="relative mx-auto mt-9 flex h-[190px] w-[190px] items-center justify-center rounded-full border-[8px] border-rose-200/[0.09] bg-gradient-to-b from-rose-400/90 to-rose-600/90 text-[58px] shadow-[0_28px_90px_rgba(244,63,94,0.18),inset_0_-16px_30px_rgba(0,0,0,0.25)] transition hover:scale-[1.02] active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-25 sm:h-[225px] sm:w-[225px]"
        >
          💣
        </button>

        <div className="mx-auto mt-6 max-w-[400px]">
          <div className="flex items-center justify-between text-[8px] uppercase tracking-[0.1em] text-white/25">
            <span>
              Təzyiq
            </span>

            <span>
              {pressure}
            </span>
          </div>

          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="h-full rounded-full bg-rose-300/70 transition-all"
              style={{
                width: `${Math.min(
                  100,
                  pressure * 9,
                )}%`,
              }}
            />
          </div>
        </div>

        <button
          disabled={
            pending ||
            !myTurn
          }
          onClick={() =>
            act("pass")
          }
          className="mt-6 rounded-[11px] border border-white/[0.08] bg-white/[0.025] px-7 py-3 text-[9px] font-semibold uppercase tracking-[0.12em] text-white/40 transition hover:bg-white/[0.05] disabled:opacity-25"
        >
          Pass
        </button>

        <div className="mx-auto mt-7 max-w-[460px] space-y-1.5">
          {(
            state.history ?? []
          )
            .slice(-5)
            .reverse()
            .map(
              (
                item: string,
                index: number,
              ) => (
                <p
                  key={
                    index
                  }
                  className="text-[9px] text-white/25"
                >
                  {item}
                </p>
              ),
            )}
        </div>
      </div>
    </Shell>
  );
}

function Undercover({
  room,
  me,
  pending,
  act,
}: any) {
  const state =
    room.gameState as any;

  const [clue, setClue] =
    useState("");

  const myWord =
    me ===
    state.undercoverId
      ? state.undercoverWord
      : state.mainWord;

  const alreadyClued =
    Boolean(
      state.clues?.[me],
    );

  const alreadyVoted =
    Boolean(
      state.votes?.[me],
    );

  return (
    <Shell>
      <div className="mx-auto max-w-[620px]">
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-[17px] border border-violet-200/[0.11] bg-violet-200/[0.045]">
            <Shield className="h-5 w-5 text-violet-100/70" />
          </div>

          <p className="mt-4 text-[8px] font-semibold uppercase tracking-[0.18em] text-white/25">
            Sənin gizli sözün
          </p>

          <h2 className="mt-2 text-[32px] font-semibold tracking-[-0.035em] text-white">
            {myWord ??
              "Hazırlanır..."}
          </h2>

          <p className="mt-2 text-[9px] text-white/25">
            Sözü birbaşa demədən ipucu ver.
          </p>
        </div>

        {state.phase ===
        "clues" ? (
          <>
            <div className="mt-7 flex gap-2">
              <input
                value={
                  clue
                }
                disabled={
                  pending ||
                  alreadyClued
                }
                maxLength={
                  80
                }
                onChange={(
                  event,
                ) =>
                  setClue(
                    event
                      .target
                      .value,
                  )
                }
                placeholder="İpucunu yaz..."
                className="h-12 min-w-0 flex-1 rounded-[12px] border border-white/[0.08] bg-black/25 px-4 text-[11px] text-white outline-none transition focus:border-cyan-100/[0.18]"
              />

              <button
                disabled={
                  pending ||
                  alreadyClued ||
                  !clue.trim()
                }
                onClick={() => {
                  act(
                    "clue",
                    clue,
                  );
                  setClue(
                    "",
                  );
                }}
                className="flex h-12 items-center gap-2 rounded-[12px] bg-cyan-100 px-5 text-[9px] font-semibold text-[#061014] disabled:opacity-30"
              >
                <Send className="h-3.5 w-3.5" />
                Göndər
              </button>
            </div>

            <div className="mt-6 space-y-2">
              {room.players.map(
                (
                  player: any,
                ) => (
                  <div
                    key={
                      player.id
                    }
                    className="flex items-center justify-between gap-4 rounded-[11px] border border-white/[0.055] bg-white/[0.02] px-4 py-3"
                  >
                    <span className="truncate text-[10px] text-white/40">
                      {
                        player.name
                      }
                    </span>

                    <span className="truncate text-[10px] font-medium text-white/65">
                      {state
                        .clues?.[
                        player
                          .id
                      ] ??
                        "Gözlənilir..."}
                    </span>
                  </div>
                ),
              )}
            </div>
          </>
        ) : (
          <div className="mt-8">
            <p className="mb-4 text-center text-[10px] text-white/35">
              Undercover olduğunu düşündüyün oyunçunu seç.
            </p>

            <div className="grid gap-2 sm:grid-cols-2">
              {room.players.map(
                (
                  player: any,
                ) => (
                  <button
                    key={
                      player.id
                    }
                    disabled={
                      pending ||
                      alreadyVoted
                    }
                    onClick={() =>
                      act(
                        "vote",
                        player.id,
                      )
                    }
                    className="rounded-[13px] border border-white/[0.075] bg-white/[0.025] px-4 py-4 text-left transition hover:border-violet-200/[0.2] hover:bg-violet-200/[0.04] disabled:opacity-30"
                  >
                    <p className="text-[11px] font-medium text-white/65">
                      {
                        player.name
                      }
                    </p>

                    <p className="mt-1 text-[8px] text-white/20">
                      Səs ver
                    </p>
                  </button>
                ),
              )}
            </div>
          </div>
        )}
      </div>
    </Shell>
  );
}

function PixelWars({
  room,
  me,
  pending,
  act,
}: any) {
  const state =
    room.gameState as any;

  if (
    state.phase ===
    "vote"
  ) {
    return (
      <PixelVoting
        room={room}
        me={me}
        pending={pending}
        act={act}
      />
    );
  }

  return (
    <PixelCanvas
      room={room}
      me={me}
      pending={pending}
      act={act}
    />
  );
}

function PixelCanvas({
  room,
  me,
  pending,
  act,
}: any) {
  const state =
    room.gameState as any;

  const [
    pixels,
    setPixels,
  ] =
    useState<boolean[]>(
      Array(100).fill(
        false,
      ),
    );

  const submitted =
    Boolean(
      state.canvases?.[
        me
      ],
    );

  function toggle(
    index: number,
  ) {
    if (
      submitted ||
      pending
    ) {
      return;
    }

    setPixels(
      (
        previous,
      ) => {
        const next =
          [...previous];

        next[index] =
          !next[index];

        return next;
      },
    );
  }

  return (
    <Shell>
      <div className="text-center">
        <div className="flex items-center justify-center gap-2 text-[8px] font-semibold uppercase tracking-[0.17em] text-white/25">
          <Target className="h-3 w-3" />
          PIXEL WARS
        </div>

        <h2 className="mt-3 text-[27px] font-semibold text-white">
          {state.prompt ??
            "Çək"}
        </h2>

        <p className="mt-2 text-[9px] text-white/25">
          10×10 canvas-da mövzunu çək. Sonra hamı ən yaxşı işi seçəcək.
        </p>
      </div>

      <div className="mx-auto mt-7 grid max-w-[420px] grid-cols-10 gap-1 rounded-[18px] border border-white/[0.065] bg-black/25 p-3">
        {pixels.map(
          (
            active,
            index,
          ) => (
            <button
              key={
                index
              }
              disabled={
                pending ||
                submitted
              }
              onClick={() =>
                toggle(
                  index,
                )
              }
              className={`aspect-square rounded-[3px] border transition ${
                active
                  ? "border-cyan-100/55 bg-cyan-100"
                  : "border-white/[0.045] bg-white/[0.025] hover:bg-white/[0.07]"
              }`}
            />
          ),
        )}
      </div>

      <div className="mx-auto mt-3 flex max-w-[420px] gap-2">
        <button
          disabled={
            submitted ||
            pending
          }
          onClick={() =>
            setPixels(
              Array(
                100,
              ).fill(
                false,
              ),
            )
          }
          className="h-10 flex-1 rounded-[11px] border border-white/[0.075] bg-white/[0.02] text-[9px] text-white/35 disabled:opacity-30"
        >
          Təmizlə
        </button>

        <button
          disabled={
            submitted ||
            pending
          }
          onClick={() =>
            act(
              "submit",
              pixels,
            )
          }
          className="flex h-10 flex-[2] items-center justify-center gap-2 rounded-[11px] bg-cyan-100 text-[9px] font-semibold text-[#061014] disabled:opacity-30"
        >
          {pending ? (
            <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
          ) : submitted ? (
            <Check className="h-3.5 w-3.5" />
          ) : null}

          {submitted
            ? "Göndərildi"
            : "Rəsmi göndər"}
        </button>
      </div>
    </Shell>
  );
}

function PixelVoting({
  room,
  me,
  pending,
  act,
}: any) {
  const state =
    room.gameState as any;

  const voted =
    Boolean(
      state.votes?.[me],
    );

  return (
    <Shell>
      <div className="text-center">
        <p className="text-[8px] font-semibold uppercase tracking-[0.18em] text-white/25">
          Final mərhələ
        </p>

        <h2 className="mt-2 text-[25px] font-semibold text-white">
          Ən yaxşı pixel art-a səs ver
        </h2>
      </div>

      <div className="mt-7 grid gap-3 sm:grid-cols-2">
        {room.players
          .filter(
            (
              player: any,
            ) =>
              Boolean(
                state
                  .canvases?.[
                  player.id
                ],
              ),
          )
          .map(
            (
              player: any,
            ) => (
              <button
                key={
                  player.id
                }
                disabled={
                  pending ||
                  voted ||
                  player.id ===
                    me
                }
                onClick={() =>
                  act(
                    "vote",
                    player.id,
                  )
                }
                className="rounded-[16px] border border-white/[0.065] bg-black/20 p-4 transition hover:border-cyan-100/[0.16] disabled:opacity-35"
              >
                <MiniPixels
                  pixels={
                    state
                      .canvases[
                      player.id
                    ]
                  }
                />

                <p className="mt-3 text-[10px] font-medium text-white/45">
                  {
                    player.name
                  }
                </p>
              </button>
            ),
          )}
      </div>
    </Shell>
  );
}

function MiniPixels({
  pixels,
}: {
  pixels: boolean[];
}) {
  return (
    <div className="mx-auto grid max-w-[220px] grid-cols-10 gap-[2px] rounded-[10px] bg-black/20 p-2">
      {pixels.map(
        (
          active,
          index,
        ) => (
          <span
            key={
              index
            }
            className={`aspect-square rounded-[1px] ${
              active
                ? "bg-cyan-100"
                : "bg-white/[0.035]"
            }`}
          />
        ),
      )}
    </div>
  );
}

function Vault({
  room,
  pending,
  act,
}: any) {
  const state =
    room.gameState as any;

  const [
    answer,
    setAnswer,
  ] = useState("");

  const puzzle =
    state.puzzles?.[
      state.stage
    ];

  return (
    <Shell>
      <div className="mx-auto max-w-[580px] py-4">
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[20px] border border-amber-100/[0.1] bg-amber-100/[0.04] text-[28px]">
            🔐
          </div>

          <p className="mt-5 text-[8px] font-semibold uppercase tracking-[0.18em] text-white/25">
            VAULT SECURITY
          </p>

          <h2 className="mt-2 text-[25px] font-semibold text-white">
            Mərhələ{" "}
            {Number(
              state.stage ??
                0,
            ) + 1}
            /
            {state
              .puzzles
              ?.length ??
              4}
          </h2>
        </div>

        <div className="mt-7 rounded-[17px] border border-white/[0.07] bg-black/25 p-6 text-center">
          <p className="text-[16px] font-medium leading-7 text-white/75">
            {puzzle?.question ??
              "Vault açılır..."}
          </p>
        </div>

        <div className="mt-4 flex gap-2">
          <input
            value={
              answer
            }
            disabled={
              pending
            }
            onChange={(
              event,
            ) =>
              setAnswer(
                event
                  .target
                  .value,
              )
            }
            onKeyDown={(
              event,
            ) => {
              if (
                event.key ===
                  "Enter" &&
                answer.trim()
              ) {
                act(
                  "answer",
                  answer,
                );

                setAnswer(
                  "",
                );
              }
            }}
            placeholder="Cavab..."
            className="h-12 min-w-0 flex-1 rounded-[12px] border border-white/[0.08] bg-black/25 px-4 text-[12px] text-white outline-none focus:border-amber-100/[0.18]"
          />

          <button
            disabled={
              pending ||
              !answer.trim()
            }
            onClick={() => {
              act(
                "answer",
                answer,
              );

              setAnswer(
                "",
              );
            }}
            className="h-12 rounded-[12px] bg-amber-100 px-6 text-[9px] font-semibold text-[#161005] disabled:opacity-30"
          >
            Yoxla
          </button>
        </div>

        <div className="mt-5 flex items-center justify-between rounded-[12px] border border-white/[0.055] bg-white/[0.018] px-4 py-3 text-[8px]">
          <span className="text-emerald-100/45">
            Həll edildi:{" "}
            {state.solved
              ?.length ??
              0}
          </span>

          <span className="text-rose-100/45">
            Səhv:{" "}
            {state.strikes ??
              0}/5
          </span>
        </div>
      </div>
    </Shell>
  );
}

function SpeedGame({
  room,
  pending,
  act,
  octo,
}: any) {
  const state =
    room.gameState as any;

  const challenge =
    octo
      ? state.miniGame
      : state.challenge;

  const round =
    octo
      ? state.miniRound
      : state.round;

  const total =
    octo
      ? state.totalRounds ??
        8
      : 8;

  return (
    <Shell>
      <div className="mx-auto max-w-[620px] py-6 text-center">
        <div className="flex items-center justify-center gap-2">
          <span className="rounded-full border border-white/[0.07] bg-white/[0.025] px-3 py-1 text-[8px] font-semibold uppercase tracking-[0.13em] text-white/30">
            {octo
              ? "OCTO PARTY"
              : "KING OF THE HILL"}
          </span>

          <span className="rounded-full border border-cyan-100/[0.08] bg-cyan-100/[0.025] px-3 py-1 font-mono text-[8px] text-cyan-100/45">
            {round ?? 1}/
            {total}
          </span>
        </div>

        <div className="mt-7 text-[52px]">
          {challenge ===
          "reaction"
            ? "⚡"
            : challenge ===
                "odd"
              ? "👁️"
              : challenge ===
                  "number"
                ? "🔢"
                : challenge ===
                    "memory"
                  ? "🧠"
                  : challenge ===
                      "timing"
                    ? "⏱️"
                    : "🎨"}
        </div>

        <h2 className="mt-4 text-[27px] font-semibold tracking-[-0.03em] text-white">
          {challenge ===
          "reaction"
            ? "Sürətli ol"
            : challenge ===
                "odd"
              ? "Fərqli simvolu tap"
              : challenge ===
                  "number"
                ? `Rəqəmi daxil et: ${state.target}`
                : challenge ===
                    "memory"
                  ? "OCTO sözünü yadda saxla"
                  : challenge ===
                      "timing"
                    ? "2–3 saniyə arasında vur"
                    : "CYAN rəngini seç"}
        </h2>

        <p className="mx-auto mt-2 max-w-[420px] text-[9px] leading-5 text-white/25">
          Düzgün və sürətli cavab daha çox xal qazandırır.
        </p>

        <MicroControls
          challenge={
            challenge
          }
          pending={
            pending
          }
          act={act}
        />
      </div>
    </Shell>
  );
}

function MicroControls({
  challenge,
  pending,
  act,
}: {
  challenge: string;
  pending: boolean;
  act: (
    action: string,
    value?: unknown,
  ) => void;
}) {
  const [
    number,
    setNumber,
  ] = useState("");

  if (
    challenge ===
    "number"
  ) {
    return (
      <div className="mx-auto mt-7 flex max-w-[340px] gap-2">
        <input
          value={
            number
          }
          disabled={
            pending
          }
          inputMode="numeric"
          onChange={(
            event,
          ) =>
            setNumber(
              event.target.value.replace(
                /\D/g,
                "",
              ),
            )
          }
          className="h-12 min-w-0 flex-1 rounded-[12px] border border-white/[0.08] bg-black/25 px-4 text-center font-mono text-[17px] text-white outline-none"
        />

        <button
          disabled={
            pending ||
            !number
          }
          onClick={() =>
            act(
              "answer",
              number,
            )
          }
          className="rounded-[12px] bg-cyan-100 px-6 text-[9px] font-semibold text-[#061014] disabled:opacity-30"
        >
          OK
        </button>
      </div>
    );
  }

  if (
    challenge ===
    "odd"
  ) {
    return (
      <div className="mx-auto mt-7 grid max-w-[360px] grid-cols-3 gap-2">
        {[
          "○",
          "○",
          "◇",
          "○",
          "○",
          "○",
        ].map(
          (
            symbol,
            index,
          ) => (
            <button
              key={
                index
              }
              disabled={
                pending
              }
              onClick={() =>
                act(
                  "answer",
                  symbol ===
                    "◇"
                    ? "odd"
                    : "wrong",
                )
              }
              className="aspect-square rounded-[14px] border border-white/[0.07] bg-white/[0.025] text-[26px] text-white/55 transition hover:border-cyan-100/[0.18] hover:bg-cyan-100/[0.04] disabled:opacity-30"
            >
              {symbol}
            </button>
          ),
        )}
      </div>
    );
  }

  if (
    challenge ===
    "color"
  ) {
    return (
      <div className="mx-auto mt-7 grid max-w-[390px] grid-cols-3 gap-2">
        <button
          disabled={
            pending
          }
          onClick={() =>
            act(
              "answer",
              "red",
            )
          }
          className="h-24 rounded-[15px] border border-rose-200/10 bg-rose-400/70 transition hover:scale-[1.02]"
        />

        <button
          disabled={
            pending
          }
          onClick={() =>
            act(
              "answer",
              "cyan",
            )
          }
          className="h-24 rounded-[15px] border border-cyan-100/10 bg-cyan-200/85 transition hover:scale-[1.02]"
        />

        <button
          disabled={
            pending
          }
          onClick={() =>
            act(
              "answer",
              "yellow",
            )
          }
          className="h-24 rounded-[15px] border border-amber-100/10 bg-amber-200/75 transition hover:scale-[1.02]"
        />
      </div>
    );
  }

  return (
    <button
      disabled={
        pending
      }
      onClick={() =>
        act(
          "answer",
          challenge ===
          "memory"
            ? "octo"
            : "go",
        )
      }
      className="mx-auto mt-8 flex h-32 w-32 items-center justify-center rounded-full border-[6px] border-cyan-50/[0.09] bg-cyan-100 text-[12px] font-bold uppercase tracking-[0.1em] text-[#061014] shadow-[0_18px_80px_rgba(165,243,252,0.12)] transition hover:scale-[1.02] active:scale-[0.95] disabled:opacity-30 sm:h-36 sm:w-36"
    >
      {pending ? (
        <LoaderCircle className="h-5 w-5 animate-spin" />
      ) : (
        "VUR"
      )}
    </button>
  );
}
