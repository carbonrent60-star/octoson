import type { Metadata } from "next";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";

type Props = {
  params: Promise<{
    code: string;
  }>;
};

function normalizeCode(value: unknown) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 6);
}

const gameNames: Record<string, string> = {
  lobby: "Lobby",
  reaction: "Reaction",
  connect4: "Connect 4",
  blackjack: "Party Blackjack",
};

async function getRoom(code: string) {
  const supabase = getSupabaseServerClient();

  const { data: room } = await supabase
    .from("game_rooms")
    .select("id,code,game,host_id,status,max_players")
    .eq("code", code)
    .maybeSingle();

  if (!room) return null;

  const { data: players } = await supabase
    .from("game_room_players")
    .select("user_id,player_data")
    .eq("room_id", room.id);

  const rows = players ?? [];

  const host =
    rows.find(
      (player: any) =>
        String(player.user_id) === String(room.host_id),
    ) ??
    rows.find(
      (player: any) => player.player_data?.host === true,
    );

  return {
    ...room,
    playerCount: rows.length,
    hostName:
      host?.player_data?.name ??
      "Octoson oyunçusu",
  };
}

export async function generateMetadata({
  params,
}: Props): Promise<Metadata> {
  const { code: rawCode } = await params;
  const code = normalizeCode(rawCode);

  if (code.length !== 6) {
    return {
      title: "Otaq tapılmadı",
      description: "Bu Octoson oyun dəvəti etibarlı deyil.",
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const room = await getRoom(code);

  if (!room || room.status === "closed") {
    return {
      title: "Otaq artıq aktiv deyil",
      description:
        "Bu Octoson oyun dəvətinin müddəti bitib və ya otaq bağlanıb.",
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const gameName =
    gameNames[String(room.game)] ?? "Octoson Game";

  const title =
    `${room.hostName} səni ${gameName} oyununa dəvət edir`;

  const description =
    `${room.playerCount}/${room.max_players} oyunçu • Otaq ${room.code} • Octoson Games`;

  const image =
    `/join/${room.code}/opengraph-image`;

  return {
    title,
    description,

    alternates: {
      canonical: `/join/${room.code}`,
    },

    openGraph: {
      type: "website",
      siteName: "Octoson",
      locale: "az_AZ",
      title,
      description,
      url: `/join/${room.code}`,
      images: [
        {
          url: image,
          width: 1200,
          height: 630,
          alt: `${gameName} • ${room.code}`,
        },
      ],
    },

    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },

    robots: {
      index: false,
      follow: true,
    },
  };
}

export default async function PublicJoinPage({
  params,
}: Props) {
  const { code: rawCode } = await params;
  const code = normalizeCode(rawCode);

  if (code.length !== 6) {
    redirect("/dashboard/games");
  }

  redirect(`/dashboard/games/join/${code}`);
}
