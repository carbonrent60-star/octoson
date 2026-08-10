import { auth } from "@/auth";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request
) {
  const session = await auth();
  const userId =
    session?.user?.discordId;

  if (!userId) {
    return Response.json(
      { ok: false },
      { status: 401 }
    );
  }

  let path = "/dashboard";

  try {
    const body =
      await request.json();

    if (
      typeof body?.path === "string" &&
      body.path.startsWith("/")
    ) {
      path = body.path.slice(0, 300);
    }
  } catch {}

  const supabase =
    getSupabaseServerClient();

  const now = Date.now();

  const { error } =
    await supabase
      .from("web_presence")
      .upsert(
        {
          user_id: String(userId),
          path,
          last_seen: now,
        },
        {
          onConflict: "user_id",
        }
      );

  if (error) {
    console.error(
      "[WEB PRESENCE]",
      error
    );

    return Response.json(
      { ok: false },
      { status: 500 }
    );
  }

  return Response.json({
    ok: true,
    lastSeen: now,
  });
}
