import { ImageResponse } from "next/og";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export const runtime = "nodejs";

type Props = {
  params: Promise<{
    code: string;
  }>;
};

const gameNames: Record<string, string> = {
  lobby: "LOBBY",
  reaction: "REACTION",
  connect4: "CONNECT 4",
  blackjack: "PARTY BLACKJACK",
};

function normalizeCode(value: unknown) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 6);
}

export async function GET(
  _request: Request,
  { params }: Props,
) {
  const { code: rawCode } = await params;
  const code = normalizeCode(rawCode);

  const supabase = getSupabaseServerClient();

  const { data: room } = await supabase
    .from("game_rooms")
    .select("id,code,game,host_id,status,max_players")
    .eq("code", code)
    .maybeSingle();

  let hostName = "OCTOSON PLAYER";
  let playerCount = 0;

  if (room) {
    const { data: players } = await supabase
      .from("game_room_players")
      .select("user_id,player_data")
      .eq("room_id", room.id);

    const rows = players ?? [];

    playerCount = rows.length;

    const host =
      rows.find(
        (player: any) =>
          String(player.user_id) === String(room.host_id),
      ) ??
      rows.find(
        (player: any) =>
          player.player_data?.host === true,
      );

    hostName =
      String(
        host?.player_data?.name ??
          "OCTOSON PLAYER",
      ).toUpperCase();
  }

  const gameName =
    gameNames[String(room?.game)] ??
    "OCTOSON GAME";

  const active =
    Boolean(room) &&
    room.status !== "closed";

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          position: "relative",
          overflow: "hidden",
          background:
            "linear-gradient(135deg, #050708 0%, #090d10 48%, #071115 100%)",
          color: "white",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            position: "absolute",
            width: "520px",
            height: "520px",
            borderRadius: "999px",
            right: "-100px",
            top: "-180px",
            background:
              "rgba(103,232,249,0.10)",
            filter: "blur(80px)",
          }}
        />

        <div
          style={{
            position: "absolute",
            width: "380px",
            height: "380px",
            borderRadius: "999px",
            left: "-120px",
            bottom: "-180px",
            background:
              "rgba(34,211,238,0.06)",
            filter: "blur(70px)",
          }}
        />

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: "100%",
            padding: "64px 72px",
            position: "relative",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "16px",
              }}
            >
              <div
                style={{
                  width: "54px",
                  height: "54px",
                  borderRadius: "16px",
                  border:
                    "1px solid rgba(207,250,254,.18)",
                  background:
                    "rgba(207,250,254,.06)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "25px",
                  fontWeight: 900,
                  color: "#cffafe",
                }}
              >
                O
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <div
                  style={{
                    fontSize: "23px",
                    fontWeight: 800,
                    letterSpacing: "3px",
                  }}
                >
                  OCTOSON
                </div>

                <div
                  style={{
                    marginTop: "5px",
                    fontSize: "13px",
                    color:
                      "rgba(255,255,255,.35)",
                    letterSpacing: "3px",
                  }}
                >
                  GAMES
                </div>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                padding: "11px 18px",
                borderRadius: "999px",
                border:
                  "1px solid rgba(103,232,249,.16)",
                background:
                  "rgba(103,232,249,.055)",
                color: active
                  ? "#a5f3fc"
                  : "rgba(255,255,255,.35)",
                fontSize: "13px",
                fontWeight: 700,
                letterSpacing: "2px",
              }}
            >
              {active ? "● LIVE LOBBY" : "LOBBY CLOSED"}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              marginTop: "92px",
            }}
          >
            <div
              style={{
                display: "flex",
                fontSize: "15px",
                color: "#67e8f9",
                letterSpacing: "5px",
                fontWeight: 700,
              }}
            >
              {gameName}
            </div>

            <div
              style={{
                display: "flex",
                marginTop: "18px",
                fontSize: "54px",
                lineHeight: 1.05,
                fontWeight: 800,
                letterSpacing: "-2px",
                maxWidth: "880px",
              }}
            >
              {hostName}
            </div>

            <div
              style={{
                display: "flex",
                marginTop: "12px",
                fontSize: "28px",
                color:
                  "rgba(255,255,255,.48)",
              }}
            >
              səni oyuna dəvət edir
            </div>
          </div>

          <div
            style={{
              marginTop: "auto",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              borderTop:
                "1px solid rgba(255,255,255,.08)",
              paddingTop: "28px",
            }}
          >
            <div
              style={{
                display: "flex",
                gap: "38px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <span
                  style={{
                    fontSize: "12px",
                    color:
                      "rgba(255,255,255,.28)",
                    letterSpacing: "2px",
                  }}
                >
                  PLAYERS
                </span>

                <span
                  style={{
                    marginTop: "7px",
                    fontSize: "23px",
                    fontWeight: 700,
                  }}
                >
                  {playerCount}/{room?.max_players ?? "—"}
                </span>
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <span
                  style={{
                    fontSize: "12px",
                    color:
                      "rgba(255,255,255,.28)",
                    letterSpacing: "2px",
                  }}
                >
                  ROOM CODE
                </span>

                <span
                  style={{
                    marginTop: "7px",
                    fontSize: "23px",
                    fontWeight: 700,
                    letterSpacing: "4px",
                    color: "#cffafe",
                  }}
                >
                  {code || "------"}
                </span>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                padding: "16px 25px",
                borderRadius: "14px",
                background: "#ecfeff",
                color: "#071014",
                fontSize: "15px",
                fontWeight: 800,
                letterSpacing: "1px",
              }}
            >
              JOIN LOBBY →
            </div>
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    },
  );
}
