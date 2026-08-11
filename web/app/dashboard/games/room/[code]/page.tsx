import { auth } from "@/auth";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import RoomRealtime from "@/components/games/room-realtime";
import RoomShare from "@/components/games/room-share";
import ReactionGame from "@/components/games/reaction-game";
import WagerPanel from "@/components/games/wager-panel";
import {
  ArrowLeft,
  Check,
  Copy,
  Crown,
  Gamepad2,
  Radio,
  Users,
} from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import Connect4Game from "@/components/games/connect4-game";
import BlackjackGame from "@/components/games/blackjack-game";
import GameOnboarding from "@/components/games/game-onboarding";

import {
  kickRoomPlayerAction,
  leaveRoomAction,
  setRoomPrivacyAction,
  toggleReadyAction,
} from "../../actions";

type Props = {
  params: Promise<{
    code: string;
  }>;
};

type Player = {
  id: string;
  user_id: string;
  ready: boolean;
  score: number;
  last_seen: string;
  player_data: {
    name?: string;
    image?: string | null;
    host?: boolean;
  } | null;
};

export const dynamic = "force-dynamic";

export default async function RoomPage({ params }: Props) {
  const session = await auth();

  if (!session?.user?.discordId) {
    redirect("/");
  }

  const { code: rawCode } = await params;
  const code = rawCode.toUpperCase();

  const supabase = getSupabaseServerClient();

  const { data: room } = await supabase
    .from("game_rooms")
    .select("id,code,game,host_id,status,max_players,created_at,is_public")
    .eq("code", code)
    .maybeSingle();

  if (!room) {
    notFound();
  }

  const { data } = await supabase
    .from("game_room_players")
    .select("id,user_id,ready,score,player_data,joined_at,last_seen")
    .eq("room_id", room.id)
    .order("joined_at", {
      ascending: true,
    });

  const players = (data ?? []) as Player[];

  const playerIds = players.map((player) => player.user_id);

  const { data: economyRows } =
    playerIds.length > 0
      ? await supabase
          .from("economy_users")
          .select("user_id,balance")
          .in("user_id", playerIds)
      : {
          data: [],
        };

  const balanceByUser = new Map<string, number>(
    (economyRows ?? []).map((row: any) => [
      String(row.user_id),
      Number(row.balance ?? 0),
    ]),
  );

  const activeCutoff = Date.now() - 45_000;

  const isPlayerOnline = (player: Player) =>
    new Date(player.last_seen).getTime() >= activeCutoff;

  const activePlayers = players.filter(isPlayerOnline);

  const { data: currentMatch } = await supabase
    .from("game_matches")
    .select("id,status,state,winner_id,created_at")
    .eq("room_id", room.id)
    .eq("game", room.game)
    .order("created_at", {
      ascending: false,
    })
    .limit(1)
    .maybeSingle();

  const { data: wagerProposalData } = await supabase
    .from("game_wager_proposals")
    .select("id,amount,status")
    .eq("room_id", room.id)
    .in("status", ["pending", "declined"])
    .order("created_at", {
      ascending: false,
    })
    .limit(1)
    .maybeSingle();

  const initialProposal = wagerProposalData
    ? {
        id: String(wagerProposalData.id),
        amount: Number(wagerProposalData.amount),
        status: String(wagerProposalData.status),
      }
    : null;

  const { data: wagerAcceptancesData } = initialProposal
    ? await supabase
        .from("game_wager_acceptances")
        .select("user_id,accepted,can_afford")
        .eq("proposal_id", initialProposal.id)
    : {
        data: [],
      };

  const initialAcceptances = (wagerAcceptancesData ?? []).map(
    (item: {
      user_id: string;
      accepted: boolean | null;
      can_afford: boolean;
    }) => ({
      user_id: String(item.user_id),
      accepted: item.accepted === null ? null : Boolean(item.accepted),
      can_afford: Boolean(item.can_afford),
    }),
  );

  const me = players.find(
    (player) => player.user_id === session.user.discordId,
  );

  if (!me) {
    redirect("/dashboard/games");
  }

  const isHost = room.host_id === session.user.discordId;

  const enoughPlayers = players.length >= 2;

  const everyoneReady =
    enoughPlayers && players.every((player) => player.ready);

  const gameNames: Record<string, string> = {
    lobby: "Lobby",
    reaction: "Reaction",
    connect4: "Connect 4",
    blackjack: "Party Blackjack",
  };

  return (
    <div className="space-y-6">
      <RoomRealtime roomId={room.id} />

      {room.game === "reaction" &&
        room.status !== "waiting" &&
        currentMatch && (
          <GameOnboarding
            game="reaction"
            matchId={currentMatch.id}
            matchCreatedAt={currentMatch.created_at}
          >
            <ReactionGame
              code={room.code}
              roomId={room.id}
              matchId={currentMatch.id}
              matchStatus={currentMatch.status}
              state={
                currentMatch.state as {
                  phase?: "waiting" | "go" | "finished";
                  go_at?: string;
                  results?: {
                    user_id: string;
                    reaction_ms: number;
                    false_start?: boolean;
                  }[];
                }
              }
              isHost={isHost}
              myUserId={session.user.discordId}
              players={players.map((player) => ({
                user_id: player.user_id,
                name: player.player_data?.name ?? player.user_id,
                balance: balanceByUser.get(player.user_id) ?? 0,
              }))}
            />
          </GameOnboarding>
        )}

      {room.game === "connect4" &&
        room.status !== "waiting" &&
        currentMatch && (
          <GameOnboarding
            game="connect4"
            matchId={currentMatch.id}
            matchCreatedAt={currentMatch.created_at}
          >
            <Connect4Game
              code={room.code}
              matchId={currentMatch.id}
              matchStatus={currentMatch.status}
              state={
                currentMatch.state as {
                  phase?: "playing" | "finished";
                  board?: (string | null)[][];
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
                }
              }
              winnerId={currentMatch.winner_id ?? null}
              myUserId={session.user.discordId}
              players={players.map((player) => ({
                user_id: player.user_id,
                name: player.player_data?.name ?? player.user_id,
                image: player.player_data?.image ?? null,
                balance: balanceByUser.get(player.user_id) ?? 0,
              }))}
            />
          </GameOnboarding>
        )}

      {room.game === "blackjack" &&
        room.status !== "waiting" &&
        currentMatch && (
          <GameOnboarding
            game="blackjack"
            matchId={currentMatch.id}
            matchCreatedAt={currentMatch.created_at}
          >
            <BlackjackGame
              code={room.code}
              matchId={currentMatch.id}
              matchStatus={currentMatch.status}
              state={
                currentMatch.state as {
                  phase?: "playing" | "dealer" | "finished";
                  bet?: number;
                  deck?: {
                    suit: "spades" | "hearts" | "diamonds" | "clubs";
                    rank:
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
                  }[];
                  dealer?: {
                    suit: "spades" | "hearts" | "diamonds" | "clubs";
                    rank:
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
                  }[];
                  players?: {
                    user_id: string;
                    hand: {
                      suit: "spades" | "hearts" | "diamonds" | "clubs";
                      rank:
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
                    }[];
                    status:
                      | "playing"
                      | "stand"
                      | "bust"
                      | "blackjack"
                      | "finished";
                  }[];
                  turn_index?: number;
                  turn?: string | null;
                  winners?: string[];
                  result?: Record<
                    string,
                    "win" | "lose" | "push"
                  >;
                }
              }
              myUserId={session.user.discordId}
              players={players.map((player) => ({
                user_id: player.user_id,
                name: player.player_data?.name ?? player.user_id,
                image: player.player_data?.image ?? null,
                balance: balanceByUser.get(player.user_id) ?? 0,
              }))}
            />
          </GameOnboarding>
        )}

      <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
        <div>
          <Link
            href="/dashboard/games"
            className="mb-5 inline-flex items-center gap-2 text-[10px] text-white/25 transition hover:text-white/60"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Games
          </Link>

          <div className="flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[0.2em] text-cyan-100/40">
            <Radio className="h-3.5 w-3.5" />
            {room.status === "waiting" ? "Lobby" : "Live Match"}
          </div>

          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em]">
            {gameNames[room.game] ?? room.game}
          </h1>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <span className="rounded-lg border border-white/[0.06] bg-white/[0.025] px-3 py-1.5 font-mono text-[12px] font-semibold tracking-[0.18em] text-white/65">
              {room.code}
            </span>

            <span className="flex items-center gap-1.5 text-[10px] text-white/25">
              <Users className="h-3.5 w-3.5" />
              {players.length}/{room.max_players}
            </span>

            <span
              className={`rounded-full border px-2.5 py-1 text-[8px] font-semibold uppercase tracking-[0.1em] ${
                room.is_public
                  ? "border-emerald-300/10 bg-emerald-300/[0.04] text-emerald-100/50"
                  : "border-white/[0.06] bg-white/[0.025] text-white/30"
              }`}
            >
              {room.is_public ? "Public" : "Private"}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <form
            action={async (formData) => {
              "use server";
              await toggleReadyAction(formData);
            }}
          >
            <input type="hidden" name="code" value={code} />

            <button
              className={`h-10 rounded-xl border px-4 text-[10px] font-semibold transition ${
                me.ready
                  ? "border-emerald-300/15 bg-emerald-300/[0.06] text-emerald-200/70"
                  : "border-white/[0.07] bg-white/[0.03] text-white/55 hover:bg-white/[0.055]"
              }`}
            >
              {me.ready ? "Hazıram ✓" : "Hazıram"}
            </button>
          </form>

          {isHost && (
            <form
              action={async (formData) => {
                "use server";
                await setRoomPrivacyAction(formData);
              }}
            >
              <input type="hidden" name="code" value={code} />

              <input
                type="hidden"
                name="isPublic"
                value={room.is_public ? "false" : "true"}
              />

              <button className="h-10 rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 text-[10px] font-semibold text-white/50 transition hover:bg-white/[0.055]">
                {room.is_public ? "Private et" : "Public et"}
              </button>
            </form>
          )}

          <form
            action={async (formData) => {
              "use server";
              await leaveRoomAction(formData);
            }}
          >
            <input type="hidden" name="code" value={code} />

            <button className="h-10 rounded-xl border border-red-300/10 bg-red-300/[0.025] px-4 text-[10px] text-red-200/50 transition hover:bg-red-300/[0.05]">
              Çıx
            </button>
          </form>
        </div>
      </div>

      {room.status === "waiting" && (
        <WagerPanel
          roomId={room.id}
          code={room.code}
          game={room.game}
          isHost={isHost}
          everyoneReady={everyoneReady}
          myUserId={session.user.discordId}
          players={players.map((player) => ({
            user_id: player.user_id,
            name: player.player_data?.name ?? player.user_id,
            image: player.player_data?.image ?? null,
            balance: balanceByUser.get(player.user_id) ?? 0,
          }))}
          initialProposal={initialProposal}
          initialAcceptances={initialAcceptances}
        />
      )}

      <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
        <section className="rounded-[24px] border border-white/[0.055] bg-white/[0.018] p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-white/20">
                Players
              </p>

              <h2 className="mt-1 text-[16px] font-semibold">
                Otaqdakı oyunçular
              </h2>
            </div>

            <span className="text-[10px] text-white/20">
              {activePlayers.length} online
            </span>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {players.map((player) => {
              const host = player.user_id === room.host_id;

              const name = player.player_data?.name ?? player.user_id;

              return (
                <div
                  key={player.id}
                  className="flex items-center gap-3 rounded-[17px] border border-white/[0.055] bg-black/20 p-3.5"
                >
                  <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-[13px] border border-white/[0.07] bg-white/[0.035]">
                    {player.player_data?.image ? (
                      <img
                        src={player.player_data.image}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[13px] font-semibold text-white/35">
                        {name.slice(0, 1).toUpperCase()}
                      </div>
                    )}

                    <span className="absolute bottom-0.5 right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#0b0b0e] bg-emerald-300" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="truncate text-[12px] font-medium text-white/75">
                        {name}
                      </p>

                      {host && (
                        <Crown className="h-3 w-3 shrink-0 text-amber-200/55" />
                      )}
                    </div>

                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                      <p className="font-mono text-[9px] font-semibold text-cyan-100/55">
                        {(
                          balanceByUser.get(player.user_id) ?? 0
                        ).toLocaleString("en-US")}{" "}
                        AURA
                      </p>

                      <span className="text-[8px] text-white/15">·</span>

                      <p
                        className={`text-[8px] ${
                          isPlayerOnline(player)
                            ? "text-emerald-200/40"
                            : "text-red-200/40"
                        }`}
                      >
                        {isPlayerOnline(player)
                          ? host
                            ? "Host · Online"
                            : "Online"
                          : "Offline"}
                      </p>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <div
                      className={`flex h-7 items-center gap-1 rounded-lg border px-2 text-[8px] font-semibold uppercase tracking-[0.08em] ${
                        player.ready
                          ? "border-emerald-300/10 bg-emerald-300/[0.04] text-emerald-200/55"
                          : "border-white/[0.05] bg-white/[0.02] text-white/20"
                      }`}
                    >
                      {player.ready && <Check className="h-2.5 w-2.5" />}

                      {player.ready ? "Ready" : "Waiting"}
                    </div>

                    {isHost && !host && room.status !== "playing" && (
                      <form
                        action={async (formData) => {
                          "use server";
                          await kickRoomPlayerAction(formData);
                        }}
                      >
                        <input type="hidden" name="code" value={code} />

                        <input
                          type="hidden"
                          name="userId"
                          value={player.user_id}
                        />

                        <button className="h-7 rounded-lg border border-red-300/10 bg-red-300/[0.025] px-2.5 text-[8px] font-semibold uppercase tracking-[0.08em] text-red-200/45 transition hover:bg-red-300/[0.06] hover:text-red-100/70">
                          Kick
                        </button>
                      </form>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <aside className="space-y-4">
          <div className="rounded-[22px] border border-white/[0.06] bg-white/[0.02] p-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-[13px] border border-cyan-200/[0.12] bg-cyan-200/[0.05] text-cyan-100/70">
              <Copy className="h-4 w-4" />
            </div>

            <h3 className="mt-4 text-[14px] font-semibold">Dostunu çağır</h3>

            <p className="mt-2 text-[10px] leading-5 text-white/25">
              Bu otağın kodunu dostuna göndər. O, Games səhifəsindən qoşula
              bilər.
            </p>

            <div className="mt-4 rounded-[13px] border border-white/[0.06] bg-black/25 p-4 text-center font-mono text-lg font-semibold tracking-[0.25em] text-cyan-100/70">
              {room.code}
            </div>

            <RoomShare code={room.code} />
          </div>

          <div className="rounded-[22px] border border-white/[0.055] bg-white/[0.018] p-5">
            <Gamepad2 className="h-4 w-4 text-white/30" />

            <h3 className="mt-3 text-[12px] font-semibold text-white/65">
              Match status
            </h3>

            <p className="mt-2 text-[10px] leading-5 text-white/25">
              {room.status === "waiting"
                ? "Oyunçuları gözləyir. Hamı hazır olduqda host oyunu başlada bilər."
                : "Match aktivdir."}
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
