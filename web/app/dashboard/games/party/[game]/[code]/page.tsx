import {
  redirect,
} from "next/navigation";

import { auth } from "@/auth";

import RoomClient from "./room-client";

export default async function PartyRoomPage({
  params,
}: {
  params: Promise<{
    game: string;
    code: string;
  }>;
}) {
  const session =
    await auth();

  if (
    !session?.user?.discordId
  ) {
    redirect("/");
  }

  const {
    game,
    code,
  } = await params;

  return (
    <RoomClient
      game={game}
      code={code.toUpperCase()}
      userId={
        session.user.discordId
      }
    />
  );
}
