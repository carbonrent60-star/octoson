import { createPageMetadata } from "@/lib/metadata";
import GamesHub from "@/components/games/games-hub";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export const dynamic =
  "force-dynamic";

type GameRoomRow = {
  id: string;
  code: string;
  game: string;
  host_id: string;
  status: string;
  max_players: number;
  created_at: string;
};

type GameRoomPlayerRow = {
  room_id: string;
  user_id: string;
  last_seen: string;
  player_data:
    | {
        name?: string;
        image?: string | null;
        host?: boolean;
      }
    | null;
};

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


export const metadata = createPageMetadata({
  title: 'Games',
  description: 'October community üzvləri ilə canlı multiplayer otaqlarına qoşul və oyun oyna.',
  path: '/dashboard/games',
});

export default async function GamesPage() {
  const supabase =
    getSupabaseServerClient();

  const {
    data: roomsData,
    error,
  } = await supabase
    .from("game_rooms")
    .select(
      "id,code,game,host_id,status,max_players,created_at"
    )
    .eq("is_public", true)
    .eq("status", "waiting")
    .order("created_at", {
      ascending: false,
    })
    .limit(20);

  if (error) {
    console.error(
      "open games:",
      error
    );
  }

  const roomRows: GameRoomRow[] =
    (roomsData ?? []) as GameRoomRow[];

  const roomIds: string[] =
    roomRows.map(
      (room: GameRoomRow) =>
        room.id
    );

  const {
    data: playerRowsData,
  } =
    roomIds.length > 0
      ? await supabase
          .from(
            "game_room_players"
          )
          .select(
            "room_id,user_id,last_seen,player_data"
          )
          .in(
            "room_id",
            roomIds
          )
      : {
          data: [],
        };

  const playerRows: GameRoomPlayerRow[] =
    (playerRowsData ??
      []) as GameRoomPlayerRow[];

  // Heartbeat runs every 15s. Give clients a generous 60s grace
  // period so a temporary network hiccup does not kill the lobby.
  const activeCutoff =
    Date.now() - 60_000;

  const activePlayerRows =
    playerRows.filter(
      (player) => {
        const seen =
          new Date(
            player.last_seen
          ).getTime();

        return (
          Number.isFinite(seen) &&
          seen >= activeCutoff
        );
      }
    );

  // Waiting rooms with zero recently-active members are ghosts.
  const staleRoomIds =
    roomRows
      .filter(
        (room) =>
          !activePlayerRows.some(
            (player) =>
              player.room_id ===
              room.id
          )
      )
      .map((room) => room.id);

  if (staleRoomIds.length > 0) {
    const { error: staleCloseError } =
      await supabase
        .from("game_rooms")
        .update({
          status: "closed",
        })
        .in("id", staleRoomIds)
        .eq("status", "waiting");

    if (staleCloseError) {
      console.error(
        "close stale game rooms:",
        staleCloseError
      );
    }
  }

  const liveRoomRows =
    roomRows.filter(
      (room) =>
        !staleRoomIds.includes(
          room.id
        )
    );

  const openRooms: OpenRoom[] =
    liveRoomRows
      .map(
        (
          room: GameRoomRow
        ): OpenRoom => {
          const members =
            activePlayerRows.filter(
              (
                player:
                  GameRoomPlayerRow
              ) =>
                player.room_id ===
                room.id
            );

          const host =
            members.find(
              (
                player:
                  GameRoomPlayerRow
              ) =>
                player.user_id ===
                room.host_id
            );

          const playerCount =
            members.length;

          return {
            code:
              String(room.code),
            game:
              String(room.game),
            hostName:
              String(
                host?.player_data
                  ?.name ??
                  room.host_id
              ),
            hostImage:
              host?.player_data
                ?.image ?? null,
            players:
              playerCount,
            maxPlayers:
              Number(
                room.max_players
              ),
            members:
              members.map(
                (
                  player:
                    GameRoomPlayerRow
                ) => ({
                  userId:
                    String(
                      player.user_id
                    ),
                  name:
                    String(
                      player.player_data
                        ?.name ??
                        "Player"
                    ),
                  image:
                    player.player_data
                      ?.image ?? null,
                  isHost:
                    player.user_id ===
                    room.host_id,
                })
              ),
          };
        }
      )
      .filter(
        (room: OpenRoom) =>
          room.players <
          room.maxPlayers
      );

  return (
    <GamesHub
      openRooms={openRooms}
    />
  );
}
