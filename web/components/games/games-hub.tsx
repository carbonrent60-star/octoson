"use client";

import {
  useActionState,
  useEffect,
  useState,
  useTransition,
} from "react";
import {
  ArrowRight,
  Gamepad2,
  Hash,
  Plus,
  Radio,
  RefreshCw,
  Sparkles,
  Users,
  Zap,
} from "lucide-react";

import { useRouter } from "next/navigation";

import {
  createRoomAction,
  joinRoomAction,
  type GameActionResult,
} from "@/app/dashboard/games/actions";

const initialState: GameActionResult = {
  ok: false,
  message: "",
};

const games = [
  {
    id: "reaction",
    name: "Reaction",
    description:
      "Kim daha sürətlidir? Siqnal gələn kimi vur.",
    icon: Zap,
    players: "2–8",
    status: "Hazırdır",
  },
  {
    id: "connect4",
    name: "Connect 4",
    description:
      "Klassik 1v1 strategiya oyunu.",
    icon: Gamepad2,
    players: "2",
    status: "Hazırdır",
  },
  {
    id: "blackjack",
    name: "Party Blackjack",
    description:
      "Dostlarınla eyni masada blackjack.",
    icon: Sparkles,
    players: "2–8",
    status: "Hazırdır",
  },
];

type OpenRoomMember = {
  userId: string;
  name: string;
  image: string | null;
  isHost: boolean;
};

type OpenRoom = {
  code: string;
  game: string;
  hostName: string;
  hostImage: string | null;
  players: number;
  maxPlayers: number;
  members: OpenRoomMember[];
};

type Props = {
  openRooms: OpenRoom[];
};

export default function GamesHub({
  openRooms,
}: Props) {
  const router = useRouter();

  const [selectedGame, setSelectedGame] =
    useState("reaction");

  const [refreshPending, startRefresh] =
    useTransition();

  const [lastRefresh, setLastRefresh] =
    useState(() => Date.now());

  const [secondsUntilRefresh, setSecondsUntilRefresh] =
    useState(10);

  function refreshRooms() {
    startRefresh(() => {
      router.refresh();
      setLastRefresh(Date.now());
      setSecondsUntilRefresh(10);
    });
  }

  useEffect(() => {
    const refreshTimer =
      window.setInterval(() => {
        startRefresh(() => {
          router.refresh();
          setLastRefresh(Date.now());
          setSecondsUntilRefresh(10);
        });
      }, 10_000);

    const countdownTimer =
      window.setInterval(() => {
        setSecondsUntilRefresh(
          Math.max(
            0,
            10 -
              Math.floor(
                (Date.now() -
                  lastRefresh) /
                  1000
              )
          )
        );
      }, 1_000);

    return () => {
      window.clearInterval(
        refreshTimer
      );
      window.clearInterval(
        countdownTimer
      );
    };
  }, [router, lastRefresh]);

  const [createState, createAction, createPending] =
    useActionState(
      createRoomAction,
      initialState
    );

  const [joinState, joinAction, joinPending] =
    useActionState(
      joinRoomAction,
      initialState
    );

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-[28px] border border-white/[0.06] bg-white/[0.018] p-7 md:p-9">
        <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-cyan-300/[0.06] blur-[90px]" />

        <div className="relative max-w-3xl">
          <div className="flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[0.22em] text-cyan-100/40">
            <Radio className="h-3.5 w-3.5" />
            Multiplayer
          </div>

          <h1 className="mt-4 text-3xl font-semibold tracking-[-0.045em] text-white md:text-4xl">
            Dostlarını çağır.
            <br />
            Eyni otaqda oyna.
          </h1>

          <p className="mt-4 max-w-xl text-[12px] leading-6 text-white/30">
            Otaq yarat, linki və ya kodu paylaş və
            Octoson oyunlarını real-time birlikdə oyna.
          </p>
        </div>
      </section>

      <section>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-30" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-300/70" />
              </span>

              <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-emerald-100/35">
                Open Games
              </p>
            </div>

            <h2 className="mt-1.5 text-lg font-semibold tracking-[-0.03em]">
              Açıq lobby-lər
            </h2>

            <p className="mt-1 text-[9px] text-white/38">
              Aktiv public otaqlar avtomatik yenilənir.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex h-9 items-center gap-2 rounded-[11px] border border-white/[0.055] bg-white/[0.018] px-3">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-300/60" />

              <span className="text-[9px] font-medium text-white/30">
                {openRooms.length} açıq
              </span>

              <span className="h-3 w-px bg-white/[0.07]" />

              <span className="min-w-[22px] font-mono text-[8px] text-white/20">
                {secondsUntilRefresh}s
              </span>
            </div>

            <button
              type="button"
              onClick={refreshRooms}
              disabled={refreshPending}
              title="Lobby-ləri yenilə"
              className="group flex h-9 items-center gap-2 rounded-[11px] border border-white/[0.07] bg-white/[0.025] px-3 text-[9px] font-medium text-white/40 transition hover:border-cyan-100/[0.12] hover:bg-cyan-100/[0.04] hover:text-cyan-50/70 disabled:opacity-40"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 transition ${
                  refreshPending
                    ? "animate-spin text-cyan-100/70"
                    : "group-hover:rotate-45"
                }`}
              />

              <span className="hidden sm:inline">
                {refreshPending
                  ? "Yenilənir..."
                  : "Yenilə"}
              </span>
            </button>
          </div>
        </div>

        {openRooms.length === 0 ? (
          <div className="relative overflow-hidden rounded-[22px] border border-white/[0.055] bg-white/[0.018] px-5 py-10 text-center">
            <div className="pointer-events-none absolute left-1/2 top-[-80px] h-40 w-60 -translate-x-1/2 rounded-full bg-cyan-300/[0.035] blur-[70px]" />

            <div className="relative">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-[13px] border border-white/[0.06] bg-white/[0.025]">
                <Radio className="h-4 w-4 text-white/25" />
              </div>

              <p className="mt-3 text-[11px] font-medium text-white/45">
                Hazırda açıq lobby yoxdur
              </p>

              <p className="mt-1 text-[9px] text-white/38">
                Yeni otaq yaratdıqda burada avtomatik görünəcək.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {openRooms.map((room) => {
              const gameName =
                room.game === "reaction"
                  ? "Reaction"
                  : room.game === "connect4"
                    ? "Connect 4"
                    : room.game === "blackjack"
                      ? "Party Blackjack"
                      : room.game;

              const visibleMembers =
                room.members.slice(0, 4);

              const remaining =
                Math.max(
                  0,
                  room.players -
                    visibleMembers.length
                );

              const fill =
                Math.min(
                  100,
                  Math.max(
                    0,
                    (room.players /
                      Math.max(
                        1,
                        room.maxPlayers
                      )) *
                      100
                  )
                );

              return (
                <a
                  key={room.code}
                  href={`/dashboard/games/join/${room.code}`}
                  className="group relative block overflow-hidden rounded-[22px] border border-white/[0.09] bg-[#0d1114] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.18)] transition-all duration-200 hover:-translate-y-0.5 hover:border-cyan-100/[0.18] hover:bg-[#10161a]"
                >
                  <div className="pointer-events-none absolute -right-20 -top-20 h-48 w-48 rounded-full bg-cyan-300/[0.045] blur-[75px] transition-all duration-300 group-hover:bg-cyan-300/[0.075]" />

                  <div className="relative">
                    {/* TOP */}
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="relative shrink-0">
                          {room.hostImage ? (
                            <img
                              src={room.hostImage}
                              alt=""
                              className="h-11 w-11 rounded-full border border-white/[0.14] object-cover shadow-lg shadow-black/30"
                            />
                          ) : (
                            <div className="flex h-11 w-11 items-center justify-center rounded-full border border-white/[0.12] bg-white/[0.06] text-[12px] font-semibold uppercase text-white/70">
                              {room.hostName
                                .slice(0, 1)
                                .toUpperCase()}
                            </div>
                          )}

                          <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-[2.5px] border-[#0d1114] bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.35)]" />
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />

                            <span className="text-[8px] font-semibold uppercase tracking-[0.16em] text-emerald-200/65">
                              Public Lobby
                            </span>
                          </div>

                          <h3 className="mt-1 text-[15px] font-semibold tracking-[-0.025em] text-white">
                            {gameName}
                          </h3>
                        </div>
                      </div>

                      <span className="shrink-0 rounded-full border border-emerald-300/[0.16] bg-emerald-300/[0.08] px-2.5 py-1.5 text-[7px] font-bold uppercase tracking-[0.15em] text-emerald-200/75">
                        Open
                      </span>
                    </div>

                    {/* HOST */}
                    <div className="mt-5 flex items-end justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-[8px] font-semibold uppercase tracking-[0.15em] text-white/35">
                          Host
                        </p>

                        <p className="mt-1 truncate text-[11px] font-medium text-white/75">
                          {room.hostName}
                        </p>
                      </div>

                      {/* PLAYER AVATARS */}
                      <div className="flex shrink-0 items-center">
                        {visibleMembers.map(
                          (member, index) => (
                            <div
                              key={member.userId}
                              title={member.name}
                              className={`relative h-8 w-8 overflow-hidden rounded-full border-2 border-[#0d1114] bg-[#1a2025] shadow-md shadow-black/20 ${
                                index > 0
                                  ? "-ml-2.5"
                                  : ""
                              }`}
                              style={{
                                zIndex:
                                  visibleMembers.length -
                                  index,
                              }}
                            >
                              {member.image ? (
                                <img
                                  src={member.image}
                                  alt=""
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-[9px] font-semibold uppercase text-white/60">
                                  {member.name
                                    .slice(0, 1)
                                    .toUpperCase()}
                                </div>
                              )}
                            </div>
                          )
                        )}

                        {remaining > 0 && (
                          <div className="-ml-2.5 flex h-8 w-8 items-center justify-center rounded-full border-2 border-[#0d1114] bg-[#1a2025] text-[8px] font-semibold text-white/60">
                            +{remaining}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* PLAYER COUNT / CODE */}
                    <div className="mt-5 rounded-[14px] border border-white/[0.07] bg-black/20 px-3.5 py-3">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                          <Users className="h-3.5 w-3.5 text-cyan-100/55" />

                          <span className="text-[10px] font-medium text-white/60">
                            {room.players}/{room.maxPlayers}
                            <span className="ml-1 text-white/35">
                              oyunçu
                            </span>
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-[7px] font-semibold uppercase tracking-[0.14em] text-white/30">
                            Kod
                          </span>

                          <span className="font-mono text-[10px] font-semibold tracking-[0.14em] text-white/75">
                            {room.code}
                          </span>
                        </div>
                      </div>

                      <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/[0.07]">
                        <div
                          className="h-full rounded-full bg-cyan-200/55 transition-[width] duration-500"
                          style={{
                            width: `${fill}%`,
                          }}
                        />
                      </div>
                    </div>

                    {/* JOIN */}
                    <div className="mt-4 flex h-11 w-full items-center justify-between rounded-[13px] border border-cyan-100/[0.13] bg-cyan-100/[0.08] px-4 transition-all duration-200 group-hover:border-cyan-100/[0.22] group-hover:bg-cyan-100/[0.13]">
                      <div>
                        <div className="text-[10px] font-semibold text-cyan-50/90">
                          Lobby-yə qoşul
                        </div>

                        <div className="mt-0.5 text-[8px] text-cyan-100/40">
                          Oyunçular səni gözləyir
                        </div>
                      </div>

                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-cyan-100 text-black shadow-lg shadow-cyan-200/10 transition-transform duration-200 group-hover:translate-x-0.5">
                        <ArrowRight className="h-3.5 w-3.5" />
                      </div>
                    </div>
                  </div>
                </a>
              );
            })}
          </div>
        )}
      </section>

      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <section>
          <div className="mb-4 flex items-end justify-between">
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-white/20">
                Game Library
              </p>

              <h2 className="mt-1 text-lg font-semibold tracking-[-0.03em]">
                Oyun seç
              </h2>
            </div>

            <span className="text-[10px] text-white/20">
              {games.length} oyun
            </span>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {games.map((game) => {
              const Icon = game.icon;
              const selected =
                selectedGame === game.id;

              return (
                <button
                  key={game.id}
                  type="button"
                  onClick={() =>
                    setSelectedGame(game.id)
                  }
                  className={`group relative min-h-[205px] overflow-hidden rounded-[22px] border p-5 text-left shadow-[0_14px_45px_rgba(0,0,0,0.12)] transition-all duration-200 hover:-translate-y-0.5 ${
                    selected
                      ? "border-cyan-200/[0.16] bg-cyan-200/[0.055]"
                      : "border-white/[0.08] bg-[#0d1012] hover:border-white/[0.14] hover:bg-[#111518]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div
                      className={`flex h-11 w-11 items-center justify-center rounded-[14px] border ${
                        selected
                          ? "border-cyan-200/[0.14] bg-cyan-200/[0.07] text-cyan-100/80"
                          : "border-white/[0.06] bg-black/20 text-white/35"
                      }`}
                    >
                      <Icon className="h-[18px] w-[18px]" />
                    </div>

                    <span className="rounded-full border border-emerald-300/[0.11] bg-emerald-300/[0.045] px-2.5 py-1 text-[7px] font-semibold uppercase tracking-[0.13em] text-emerald-100/55">
                      {game.status}
                    </span>
                  </div>

                  <h3 className="mt-5 text-[16px] font-semibold tracking-[-0.025em] text-white/95">
                    {game.name}
                  </h3>

                  <p className="mt-2 min-h-10 text-[10px] leading-5 text-white/45">
                    {game.description}
                  </p>

                  <div className="mt-4 flex items-center gap-1.5 text-[9px] text-white/38">
                    <Users className="h-3 w-3" />
                    {game.players} oyunçu
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <aside className="space-y-4">
          <div className="rounded-[22px] border border-white/[0.06] bg-white/[0.02] p-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-[13px] border border-cyan-200/[0.12] bg-cyan-200/[0.05] text-cyan-100/75">
              <Plus className="h-4 w-4" />
            </div>

            <h2 className="mt-4 text-[15px] font-semibold">
              Yeni otaq
            </h2>

            <p className="mt-2 text-[10px] leading-5 text-white/45">
              Seçilmiş oyun üçün lobby yarat. Yeni lobby-lər default olaraq public olur.
            </p>

            <form
              action={createAction}
              className="mt-5"
            >
              <input
                type="hidden"
                name="game"
                value={selectedGame}
              />

              <button
                disabled={createPending}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-[13px] bg-cyan-100 text-[11px] font-semibold text-black transition hover:bg-white disabled:opacity-40"
              >
                {createPending
                  ? "Yaradılır..."
                  : "Otaq yarat"}

                {!createPending && (
                  <ArrowRight className="h-3.5 w-3.5" />
                )}
              </button>
            </form>

            {createState.message && (
              <p className="mt-3 text-[10px] text-red-200/60">
                {createState.message}
              </p>
            )}
          </div>

          <div className="rounded-[22px] border border-white/[0.06] bg-white/[0.02] p-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-[13px] border border-white/[0.07] bg-white/[0.025] text-white/45">
              <Hash className="h-4 w-4" />
            </div>

            <h2 className="mt-4 text-[15px] font-semibold">
              Otağa qoşul
            </h2>

            <p className="mt-2 text-[10px] leading-5 text-white/45">
              Dostunun göndərdiyi 6 simvolluq kodu daxil et.
            </p>

            <form
              action={joinAction}
              className="mt-5 space-y-3"
            >
              <input
                name="code"
                maxLength={6}
                autoComplete="off"
                placeholder="ABC123"
                className="h-12 w-full rounded-[13px] border border-white/[0.07] bg-black/25 px-4 text-center font-mono text-[15px] font-semibold uppercase tracking-[0.22em] text-white outline-none placeholder:text-white/10 focus:border-cyan-100/25"
              />

              <button
                disabled={joinPending}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-[13px] border border-white/[0.07] bg-white/[0.035] text-[11px] font-medium text-white/65 transition hover:bg-white/[0.06] hover:text-white disabled:opacity-40"
              >
                {joinPending
                  ? "Qoşulur..."
                  : "Qoşul"}
              </button>
            </form>

            {joinState.message && (
              <p className="mt-3 text-[10px] text-red-200/60">
                {joinState.message}
              </p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
