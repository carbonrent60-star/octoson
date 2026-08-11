import { auth } from "@/auth";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";

type Props = {
  params: Promise<{
    code: string;
  }>;
};

function normalizeCode(
  value: unknown
) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 6);
}

export default async function JoinRoomPage({
  params,
}: Props) {
  const session = await auth();

  if (!session?.user?.discordId) {
    redirect("/");
  }

  const { code: rawCode } =
    await params;

  const code =
    normalizeCode(rawCode);

  if (code.length !== 6) {
    redirect(
      "/dashboard/games"
    );
  }

  const userId =
    session.user.discordId;

  const supabase =
    getSupabaseServerClient();

  const {
    data: room,
    error: roomError,
  } = await supabase
    .from("game_rooms")
    .select(
      "id,code,status,max_players"
    )
    .eq("code", code)
    .maybeSingle();

  if (
    roomError ||
    !room ||
    room.status === "closed"
  ) {
    redirect(
      "/dashboard/games"
    );
  }

  const {
    data: existingPlayer,
  } = await supabase
    .from("game_room_players")
    .select("id")
    .eq("room_id", room.id)
    .eq("user_id", userId)
    .maybeSingle();

  if (existingPlayer) {
    redirect(
      `/dashboard/games/room/${room.code}`
    );
  }

  const {
    data: roomBan,
  } = await supabase
    .from("game_room_bans")
    .select("user_id")
    .eq("room_id", room.id)
    .eq("user_id", userId)
    .maybeSingle();

  if (roomBan) {
    redirect(
      "/dashboard/games?error=banned"
    );
  }

  if (
    room.status !== "waiting"
  ) {
    redirect(
      "/dashboard/games?error=started"
    );
  }

  const {
    count,
  } = await supabase
    .from("game_room_players")
    .select("*", {
      count: "exact",
      head: true,
    })
    .eq("room_id", room.id);

  if (
    Number(count ?? 0) >=
    Number(room.max_players)
  ) {
    redirect(
      "/dashboard/games?error=full"
    );
  }

  const {
    error: playerError,
  } = await supabase
    .from("game_room_players")
    .insert({
      room_id: room.id,
      user_id: userId,
      ready: false,
      score: 0,
      player_data: {
        name:
          session.user.name ??
          "Player",
        image:
          session.user.image ??
          null,
        host: false,
      },
      last_seen:
        new Date().toISOString(),
    });

  if (playerError) {
    console.error(
      "invite join:",
      playerError
    );

    redirect(
      "/dashboard/games?error=join"
    );
  }

  redirect(
    `/dashboard/games/room/${room.code}`
  );
}
