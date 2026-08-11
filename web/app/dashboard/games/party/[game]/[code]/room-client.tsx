"use client";

import {
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";

import {
  useRouter,
} from "next/navigation";

import {
  ArrowLeft,
  Check,
  Copy,
  Crown,
  LoaderCircle,
  Play,
  Send,
  Users,
  X,
} from "lucide-react";

import {
  PARTY_GAMES,
  type PartyGameKey,
  type PartyRoomState,
} from "@/lib/octoson-party-games";

import {
  getPartyRoomAction,
  joinPartyRoomAction,
  partyGameAction,
  startPartyRoomAction,
} from "../../actions";

type Props = {
  game: string;
  code: string;
  userId: string;
};

export default function RoomClient({
  game,
  code,
  userId,
}: Props) {
  const router = useRouter();

  const [
    pending,
    startTransition,
  ] = useTransition();

  const [
    room,
    setRoom,
  ] =
    useState<PartyRoomState | null>(
      null
    );

  const [
    message,
    setMessage,
  ] =
    useState<string | null>(
      null
    );

  const [copied, setCopied] =
    useState(false);

  const config =
    PARTY_GAMES[
      game as PartyGameKey
    ];

  useEffect(() => {
    let alive = true;

    async function load() {
      let result =
        await getPartyRoomAction(
          code
        );

      if (
        !result.ok &&
        config
      ) {
        const joined =
          await joinPartyRoomAction(
            code
          );

        if (
          joined.ok &&
          joined.room
        ) {
          result = {
            ok: true,
            room: joined.room,
            me: userId,
          };
        }
      }

      if (!alive) return;

      if (
        result.ok &&
        result.room
      ) {
        setRoom(
          result.room as PartyRoomState
        );
      } else {
        setMessage(
          result.message ??
            "Room tapılmadı."
        );
      }
    }

    load();

    const timer =
      setInterval(
        load,
        1000
      );

    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [
    code,
    config,
    userId,
  ]);

  if (!config) {
    return (
      <div className="p-8 text-white">
        Oyun tapılmadı.
      </div>
    );
  }

  async function copyCode() {
    await navigator.clipboard.writeText(
      code
    );

    setCopied(true);

    setTimeout(
      () => setCopied(false),
      1200
    );
  }

  function start() {
    startTransition(
      async () => {
        const result =
          await startPartyRoomAction(
            code
          );

        if (
          result.ok &&
          "room" in result
        ) {
          setRoom(
            result.room as PartyRoomState
          );
        } else {
          setMessage(
            "message" in result
              ? result.message ?? "Başlatmaq mümkün olmadı."
              : "Başlatmaq mümkün olmadı."
          );
        }
      }
    );
  }

  function act(
    action: string,
    value?: unknown
  ) {
    startTransition(
      async () => {
        const result =
          await partyGameAction(
            code,
            action,
            value
          );

        if (
          result.ok &&
          result.room
        ) {
          setRoom(
            result.room as PartyRoomState
          );
        } else if (
          result.message
        ) {
          setMessage(
            result.message
          );
        }
      }
    );
  }

  if (!room) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="text-center">
          <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-cyan-100/60" />
          <p className="mt-3 text-[10px] text-white/35">
            {message ??
              "Room yüklənir..."}
          </p>
        </div>
      </div>
    );
  }

  const me =
    room.players.find(
      (player) =>
        player.id === userId
    );

  const isHost =
    room.hostId === userId;

  return (
    <div className="mx-auto max-w-[1180px] pb-24">
      <div className="mb-5 flex items-center justify-between gap-4">
        <button
          onClick={() =>
            router.push(
              "/dashboard/games/party"
            )
          }
          className="flex items-center gap-2 text-[10px] text-white/35 hover:text-white/70"
        >
          <ArrowLeft className="h-4 w-4" />
          Multiplayer
        </button>

        <button
          onClick={copyCode}
          className="flex items-center gap-2 rounded-[10px] border border-white/[0.08] bg-white/[0.03] px-3 py-2 font-mono text-[10px] font-semibold tracking-[0.12em] text-white/55"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-emerald-200" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}

          {code}
        </button>
      </div>

      <header className="mb-5 rounded-[24px] border border-white/[0.08] bg-[#0b0c10] p-5 sm:p-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-cyan-100/50">
              OCTOSON PARTY
            </p>

            <h1 className="mt-2 flex items-center gap-3 text-[29px] font-semibold tracking-[-0.04em] text-white">
              <span>
                {config.icon}
              </span>
              {config.title}
            </h1>

            <p className="mt-2 text-[10px] text-white/32">
              {config.description}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-white/30" />

            <span className="text-[11px] font-semibold text-white/65">
              {room.players.length}
              /
              {config.maxPlayers}
            </span>
          </div>
        </div>
      </header>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_290px]">
        <main className="min-w-0">
          {room.status ===
          "waiting" ? (
            <Lobby
              room={room}
              isHost={isHost}
              pending={pending}
              onStart={start}
              minimum={
                config.minPlayers
              }
            />
          ) : (
            <GameRenderer
              room={room}
              me={userId}
              pending={pending}
              act={act}
            />
          )}
        </main>

        <PlayersPanel
          room={room}
          userId={userId}
        />
      </div>

      {message && (
        <div className="mt-4 rounded-[13px] border border-white/[0.07] bg-white/[0.025] p-3 text-[10px] text-white/45">
          {message}
        </div>
      )}

      {!me && (
        <p className="mt-4 text-[10px] text-rose-100/60">
          Bu room-un üzvü deyilsən.
        </p>
      )}
    </div>
  );
}

function Lobby({
  room,
  isHost,
  pending,
  onStart,
  minimum,
}: {
  room: PartyRoomState;
  isHost: boolean;
  pending: boolean;
  onStart: () => void;
  minimum: number;
}) {
  return (
    <section className="rounded-[24px] border border-white/[0.08] bg-[#0b0c10] p-5 sm:p-7">
      <div className="mx-auto max-w-[500px] py-9 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[19px] border border-cyan-100/[0.12] bg-cyan-100/[0.045]">
          <Users className="h-6 w-6 text-cyan-100/70" />
        </div>

        <h2 className="mt-5 text-[23px] font-semibold text-white">
          Oyunçular gözlənilir
        </h2>

        <p className="mt-2 text-[10px] leading-5 text-white/32">
          Room kodunu Discord-da göndər və dostlarının qoşulmasını gözlə.
        </p>

        {isHost ? (
          <button
            disabled={
              pending ||
              room.players.length <
                minimum
            }
            onClick={onStart}
            className="mx-auto mt-7 flex h-12 min-w-[190px] items-center justify-center gap-2 rounded-[13px] bg-cyan-100 px-6 text-[11px] font-semibold text-[#061014] transition hover:bg-white disabled:opacity-25"
          >
            {pending ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4 fill-current" />
            )}

            Oyunu başlat
          </button>
        ) : (
          <p className="mt-7 text-[10px] text-white/30">
            Host oyunu başladacaq.
          </p>
        )}

        <p className="mt-3 text-[8px] text-white/20">
          Minimum {minimum} oyunçu
        </p>
      </div>
    </section>
  );
}

function PlayersPanel({
  room,
  userId,
}: {
  room: PartyRoomState;
  userId: string;
}) {
  const sorted =
    [...room.players].sort(
      (a, b) =>
        b.score - a.score
    );

  return (
    <aside className="h-fit rounded-[22px] border border-white/[0.08] bg-[#0b0c10] p-4 lg:sticky lg:top-[88px]">
      <p className="px-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-white/30">
        Oyunçular
      </p>

      <div className="mt-3 space-y-2">
        {sorted.map(
          (player, index) => (
            <div
              key={player.id}
              className="flex items-center gap-3 rounded-[12px] border border-white/[0.06] bg-white/[0.025] px-3 py-3"
            >
              <span className="w-5 text-center text-[9px] text-white/25">
                {index + 1}
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="truncate text-[10px] font-medium text-white/70">
                    {player.name}
                  </p>

                  {room.hostId ===
                    player.id && (
                    <Crown className="h-3 w-3 text-amber-200/60" />
                  )}

                  {player.id ===
                    userId && (
                    <span className="text-[7px] text-cyan-100/45">
                      SƏN
                    </span>
                  )}
                </div>

                <p className="mt-1 text-[8px] text-white/25">
                  {player.alive
                    ? "Oyunda"
                    : "Eliminasiya"}
                </p>
              </div>

              <span className="text-[11px] font-semibold text-cyan-50/65">
                {player.score}
              </span>
            </div>
          )
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
    value?: unknown
  ) => void;
}) {
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

function GameShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <section className="relative overflow-hidden rounded-[24px] border border-white/[0.08] bg-[#0b0c10] p-5 sm:p-7">
      <div className="pointer-events-none absolute left-1/2 top-[-200px] h-[400px] w-[600px] -translate-x-1/2 rounded-full bg-cyan-200/[0.055] blur-[110px]" />

      <div className="relative">
        {children}
      </div>
    </section>
  );
}

function Finished({
  room,
}: {
  room: PartyRoomState;
}) {
  const winner =
    [...room.players].sort(
      (a, b) =>
        b.score - a.score
    )[0];

  return (
    <GameShell>
      <div className="py-14 text-center">
        <div className="text-[56px]">
          🏆
        </div>

        <p className="mt-4 text-[9px] uppercase tracking-[0.18em] text-white/30">
          Qalib
        </p>

        <h2 className="mt-2 text-[29px] font-semibold text-white">
          {winner?.name ??
            "—"}
        </h2>

        <p className="mt-2 text-[12px] text-cyan-100/55">
          {winner?.score ?? 0} xal
        </p>
      </div>
    </GameShell>
  );
}

function LastButton({
  room,
  me,
  pending,
  act,
}: any) {
  if (
    room.status ===
    "finished"
  ) {
    return (
      <Finished room={room} />
    );
  }

  const state =
    room.gameState as any;

  const alive =
    room.players.filter(
      (player: any) =>
        player.alive
    );

  const current =
    alive[
      Number(state.turn ?? 0) %
        Math.max(
          1,
          alive.length
        )
    ];

  const myTurn =
    current?.id === me;

  return (
    <GameShell>
      <div className="py-6 text-center">
        <p className="text-[9px] uppercase tracking-[0.16em] text-white/30">
          Növbə
        </p>

        <h2 className="mt-2 text-[20px] font-semibold text-white/85">
          {current?.name ??
            "—"}
        </h2>

        <button
          disabled={
            pending ||
            !myTurn
          }
          onClick={() =>
            act("press")
          }
          className="mx-auto mt-9 flex h-[190px] w-[190px] items-center justify-center rounded-full border-[8px] border-rose-300/10 bg-rose-500/85 text-[65px] shadow-[0_0_90px_rgba(244,63,94,0.18),inset_0_-15px_30px_rgba(0,0,0,0.25)] transition hover:scale-[1.025] hover:bg-rose-400 disabled:opacity-30 sm:h-[230px] sm:w-[230px]"
        >
          💣
        </button>

        <p className="mt-5 text-[10px] text-white/35">
          Təzyiq:{" "}
          <strong className="text-white/65">
            {state.pressure ?? 0}
          </strong>
        </p>

        <button
          disabled={
            pending ||
            !myTurn
          }
          onClick={() =>
            act("pass")
          }
          className="mt-5 rounded-[11px] border border-white/[0.09] bg-white/[0.035] px-6 py-3 text-[10px] text-white/55 disabled:opacity-25"
        >
          PASS
        </button>

        <div className="mx-auto mt-7 max-w-[440px] space-y-1 text-[9px] text-white/25">
          {(
            state.history ?? []
          )
            .slice(-5)
            .reverse()
            .map(
              (
                entry: string,
                index: number
              ) => (
                <p key={index}>
                  {entry}
                </p>
              )
            )}
        </div>
      </div>
    </GameShell>
  );
}

function Undercover({
  room,
  me,
  pending,
  act,
}: any) {
  if (
    room.status ===
    "finished"
  ) {
    const state =
      room.gameState as any;

    const undercover =
      room.players.find(
        (player: any) =>
          player.id ===
          state.undercoverId
      );

    return (
      <GameShell>
        <div className="py-12 text-center">
          <div className="text-[48px]">
            🕵️
          </div>

          <h2 className="mt-4 text-[24px] font-semibold text-white">
            {state.found
              ? "Undercover tapıldı"
              : "Undercover qaçdı"}
          </h2>

          <p className="mt-3 text-[12px] text-white/45">
            Undercover:{" "}
            <strong className="text-white/80">
              {undercover?.name}
            </strong>
          </p>

          <p className="mt-1 text-[10px] text-white/30">
            {state.mainWord} /{" "}
            {state.undercoverWord}
          </p>
        </div>
      </GameShell>
    );
  }

  return (
    <UndercoverActive
      room={room}
      me={me}
      pending={pending}
      act={act}
    />
  );
}

function UndercoverActive({
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
    me === state.undercoverId
      ? state.undercoverWord
      : state.mainWord;

  return (
    <GameShell>
      <div className="text-center">
        <p className="text-[9px] uppercase tracking-[0.16em] text-white/30">
          Sənin sözün
        </p>

        <h2 className="mt-3 text-[34px] font-semibold text-cyan-50">
          {myWord}
        </h2>
      </div>

      {state.phase ===
      "clues" ? (
        <div className="mx-auto mt-8 max-w-[520px]">
          <input
            value={clue}
            disabled={
              pending ||
              Boolean(
                state.clues?.[me]
              )
            }
            onChange={(event) =>
              setClue(
                event.target.value
              )
            }
            placeholder="Sözünü birbaşa demədən clue yaz..."
            className="h-12 w-full rounded-[13px] border border-white/[0.09] bg-black/25 px-4 text-[11px] text-white outline-none"
          />

          <button
            disabled={
              pending ||
              !clue.trim() ||
              Boolean(
                state.clues?.[me]
              )
            }
            onClick={() =>
              act(
                "clue",
                clue
              )
            }
            className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-[12px] bg-cyan-100 text-[10px] font-semibold text-[#061014] disabled:opacity-25"
          >
            <Send className="h-3.5 w-3.5" />
            Clue göndər
          </button>

          <div className="mt-7 space-y-2">
            {room.players.map(
              (player: any) => (
                <div
                  key={
                    player.id
                  }
                  className="flex items-center justify-between rounded-[11px] border border-white/[0.06] bg-white/[0.025] px-3 py-3"
                >
                  <span className="text-[10px] text-white/45">
                    {
                      player.name
                    }
                  </span>

                  <span className="text-[10px] text-white/65">
                    {state.clues?.[
                      player.id
                    ] ??
                      "…"}
                  </span>
                </div>
              )
            )}
          </div>
        </div>
      ) : (
        <div className="mx-auto mt-8 max-w-[520px]">
          <p className="mb-3 text-center text-[10px] text-white/35">
            Səncə undercover kimdir?
          </p>

          <div className="grid gap-2 sm:grid-cols-2">
            {room.players.map(
              (player: any) => (
                <button
                  key={
                    player.id
                  }
                  disabled={
                    pending ||
                    Boolean(
                      state.votes?.[
                        me
                      ]
                    )
                  }
                  onClick={() =>
                    act(
                      "vote",
                      player.id
                    )
                  }
                  className="rounded-[12px] border border-white/[0.08] bg-white/[0.03] p-4 text-[10px] text-white/55 hover:border-cyan-100/20 disabled:opacity-30"
                >
                  {player.name}
                </button>
              )
            )}
          </div>
        </div>
      )}
    </GameShell>
  );
}

function PixelWars({
  room,
  me,
  pending,
  act,
}: any) {
  if (
    room.status ===
    "finished"
  ) {
    return (
      <Finished room={room} />
    );
  }

  const state =
    room.gameState as any;

  if (
    state.phase === "vote"
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
  ] = useState<boolean[]>(
    Array(100).fill(false)
  );

  const submitted =
    Boolean(
      state.canvases?.[me]
    );

  function toggle(index: number) {
    if (submitted) return;

    setPixels((previous) => {
      const next =
        [...previous];

      next[index] =
        !next[index];

      return next;
    });
  }

  return (
    <GameShell>
      <div className="text-center">
        <p className="text-[9px] uppercase tracking-[0.16em] text-white/30">
          Çək
        </p>

        <h2 className="mt-2 text-[27px] font-semibold text-white">
          {state.prompt}
        </h2>
      </div>

      <div className="mx-auto mt-6 grid max-w-[430px] grid-cols-10 gap-1 rounded-[16px] border border-white/[0.07] bg-black/25 p-2">
        {pixels.map(
          (
            on,
            index
          ) => (
            <button
              key={index}
              disabled={
                pending ||
                submitted
              }
              onClick={() =>
                toggle(index)
              }
              className={`aspect-square rounded-[3px] border ${
                on
                  ? "border-cyan-100/60 bg-cyan-100"
                  : "border-white/[0.05] bg-white/[0.035]"
              }`}
            />
          )
        )}
      </div>

      <div className="mx-auto mt-3 flex max-w-[430px] gap-2">
        <button
          disabled={
            pending ||
            submitted
          }
          onClick={() =>
            setPixels(
              Array(100).fill(
                false
              )
            )
          }
          className="h-10 flex-1 rounded-[11px] border border-white/[0.08] text-[9px] text-white/40"
        >
          Təmizlə
        </button>

        <button
          disabled={
            pending ||
            submitted
          }
          onClick={() =>
            act(
              "submit",
              pixels
            )
          }
          className="h-10 flex-[2] rounded-[11px] bg-cyan-100 text-[10px] font-semibold text-[#061014] disabled:opacity-25"
        >
          {submitted
            ? "Göndərildi"
            : "Rəsmi göndər"}
        </button>
      </div>
    </GameShell>
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

  return (
    <GameShell>
      <h2 className="text-center text-[23px] font-semibold text-white">
        Səs ver
      </h2>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {room.players
          .filter(
            (player: any) =>
              state.canvases?.[
                player.id
              ]
          )
          .map(
            (player: any) => (
              <button
                key={
                  player.id
                }
                disabled={
                  pending ||
                  player.id ===
                    me ||
                  Boolean(
                    state.votes?.[
                      me
                    ]
                  )
                }
                onClick={() =>
                  act(
                    "vote",
                    player.id
                  )
                }
                className="rounded-[16px] border border-white/[0.07] bg-white/[0.025] p-3 disabled:opacity-35"
              >
                <MiniPixels
                  pixels={
                    state.canvases[
                      player.id
                    ]
                  }
                />

                <p className="mt-3 text-[9px] text-white/35">
                  Namizəd
                </p>
              </button>
            )
          )}
      </div>
    </GameShell>
  );
}

function MiniPixels({
  pixels,
}: {
  pixels: boolean[];
}) {
  return (
    <div className="mx-auto grid max-w-[230px] grid-cols-10 gap-[2px]">
      {pixels.map(
        (on, index) => (
          <span
            key={index}
            className={`aspect-square rounded-[1px] ${
              on
                ? "bg-cyan-100"
                : "bg-white/[0.04]"
            }`}
          />
        )
      )}
    </div>
  );
}

function Vault({
  room,
  pending,
  act,
}: any) {
  if (
    room.status ===
    "finished"
  ) {
    return (
      <Finished room={room} />
    );
  }

  const state =
    room.gameState as any;

  const [answer, setAnswer] =
    useState("");

  const puzzle =
    state.puzzles?.[
      state.stage
    ];

  return (
    <GameShell>
      <div className="mx-auto max-w-[560px] py-8">
        <div className="text-center">
          <div className="text-[50px]">
            🔐
          </div>

          <p className="mt-4 text-[9px] uppercase tracking-[0.16em] text-white/30">
            Vault mərhələsi
          </p>

          <h2 className="mt-2 text-[22px] font-semibold text-white">
            {Number(
              state.stage
            ) + 1}
            /
            {state.puzzles?.length ??
              4}
          </h2>

          <p className="mt-8 rounded-[17px] border border-white/[0.08] bg-white/[0.03] p-6 text-[16px] font-medium leading-7 text-white/80">
            {puzzle?.question}
          </p>
        </div>

        <div className="mt-4 flex gap-2">
          <input
            value={answer}
            onChange={(event) =>
              setAnswer(
                event.target.value
              )
            }
            onKeyDown={(event) => {
              if (
                event.key ===
                  "Enter" &&
                answer.trim()
              ) {
                act(
                  "answer",
                  answer
                );
                setAnswer("");
              }
            }}
            className="h-12 min-w-0 flex-1 rounded-[12px] border border-white/[0.09] bg-black/25 px-4 text-[12px] text-white outline-none"
            placeholder="Cavab..."
          />

          <button
            disabled={
              pending ||
              !answer.trim()
            }
            onClick={() => {
              act(
                "answer",
                answer
              );
              setAnswer("");
            }}
            className="h-12 rounded-[12px] bg-cyan-100 px-5 text-[10px] font-semibold text-[#061014] disabled:opacity-25"
          >
            Yoxla
          </button>
        </div>

        <div className="mt-4 flex items-center justify-between text-[9px]">
          <span className="text-white/28">
            Həll:{" "}
            {state.solved?.length ??
              0}
          </span>

          <span className="text-rose-100/50">
            Səhv:{" "}
            {state.strikes ?? 0}/5
          </span>
        </div>
      </div>
    </GameShell>
  );
}

function SpeedGame({
  room,
  pending,
  act,
  octo,
}: any) {
  if (
    room.status ===
    "finished"
  ) {
    return (
      <Finished room={room} />
    );
  }

  const state =
    room.gameState as any;

  const challenge =
    octo
      ? state.miniGame
      : state.challenge;

  return (
    <GameShell>
      <div className="mx-auto max-w-[650px] py-8 text-center">
        <p className="text-[9px] uppercase tracking-[0.18em] text-white/30">
          {octo
            ? `Microgame ${state.miniRound ?? 1}/${state.totalRounds ?? 8}`
            : `Round ${state.round ?? 1}/8`}
        </p>

        <div className="mt-4 text-[45px]">
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

        <h2 className="mt-4 text-[27px] font-semibold text-white">
          {challenge ===
          "reaction"
            ? "Siqnalı gözlə"
            : challenge ===
                "odd"
              ? "Fərqli olanı tap"
              : challenge ===
                  "number"
                ? `Bu rəqəmi daxil et: ${state.target}`
                : challenge ===
                    "memory"
                  ? "OCTO sözünü yadda saxla"
                  : challenge ===
                      "timing"
                    ? "Təxminən 2–3 saniyədə vur"
                    : "CYAN rəngini seç"}
        </h2>

        <MicroControls
          challenge={
            challenge
          }
          target={
            state.target
          }
          pending={
            pending
          }
          act={act}
        />
      </div>
    </GameShell>
  );
}

function MicroControls({
  challenge,
  target,
  pending,
  act,
}: {
  challenge: string;
  target?: number;
  pending: boolean;
  act: (
    action: string,
    value?: unknown
  ) => void;
}) {
  const [number, setNumber] =
    useState("");

  if (
    challenge === "number"
  ) {
    return (
      <div className="mx-auto mt-7 flex max-w-[340px] gap-2">
        <input
          value={number}
          inputMode="numeric"
          onChange={(event) =>
            setNumber(
              event.target.value.replace(
                /\D/g,
                ""
              )
            )
          }
          className="h-12 min-w-0 flex-1 rounded-[12px] border border-white/[0.09] bg-black/25 px-4 text-center text-[16px] text-white outline-none"
        />

        <button
          disabled={
            pending ||
            !number
          }
          onClick={() =>
            act(
              "answer",
              number
            )
          }
          className="rounded-[12px] bg-cyan-100 px-5 text-[10px] font-semibold text-[#061014]"
        >
          OK
        </button>
      </div>
    );
  }

  if (challenge === "odd") {
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
          (symbol, index) => (
            <button
              key={index}
              disabled={pending}
              onClick={() =>
                act(
                  "answer",
                  symbol ===
                    "◇"
                    ? "odd"
                    : "wrong"
                )
              }
              className="aspect-square rounded-[14px] border border-white/[0.08] bg-white/[0.03] text-[25px] text-white/60 hover:border-cyan-100/20"
            >
              {symbol}
            </button>
          )
        )}
      </div>
    );
  }

  if (
    challenge === "color"
  ) {
    return (
      <div className="mx-auto mt-7 grid max-w-[380px] grid-cols-3 gap-2">
        <button
          onClick={() =>
            act(
              "answer",
              "red"
            )
          }
          className="h-20 rounded-[14px] bg-rose-400/70"
        />

        <button
          onClick={() =>
            act(
              "answer",
              "cyan"
            )
          }
          className="h-20 rounded-[14px] bg-cyan-200/80"
        />

        <button
          onClick={() =>
            act(
              "answer",
              "yellow"
            )
          }
          className="h-20 rounded-[14px] bg-amber-200/70"
        />
      </div>
    );
  }

  return (
    <button
      disabled={pending}
      onClick={() =>
        act(
          "answer",
          challenge ===
          "memory"
            ? "octo"
            : "go"
        )
      }
      className="mx-auto mt-8 flex h-28 w-28 items-center justify-center rounded-full bg-cyan-100 text-[13px] font-bold text-[#061014] shadow-[0_0_70px_rgba(165,243,252,0.12)] transition active:scale-95 sm:h-36 sm:w-36"
    >
      VUR
    </button>
  );
}
