import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export async function POST(
  request: Request
) {
  const session = await auth();

  if (!session?.user?.discordId) {
    return NextResponse.json(
      {
        ok: false,
        error: "unauthorized",
      },
      {
        status: 401,
      }
    );
  }

  let body: {
    roomId?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: "invalid_body",
      },
      {
        status: 400,
      }
    );
  }

  const roomId = String(
    body.roomId ?? ""
  ).trim();

  if (!roomId) {
    return NextResponse.json(
      {
        ok: false,
        error: "room_required",
      },
      {
        status: 400,
      }
    );
  }

  const supabase =
    getSupabaseServerClient();

  const { data, error } =
    await supabase
      .from("game_room_players")
      .update({
        last_seen:
          new Date().toISOString(),
      })
      .eq("room_id", roomId)
      .eq(
        "user_id",
        session.user.discordId
      )
      .select("id")
      .maybeSingle();

  if (error) {
    console.error(
      "[ROOM HEARTBEAT]",
      error
    );

    return NextResponse.json(
      {
        ok: false,
        error: "heartbeat_failed",
      },
      {
        status: 500,
      }
    );
  }

  if (!data) {
    return NextResponse.json(
      {
        ok: false,
        error: "not_in_room",
      },
      {
        status: 404,
      }
    );
  }

  return NextResponse.json({
    ok: true,
  });
}
