import { redirect } from "next/navigation";

import { auth } from "@/auth";

import PartyHub from "./party-hub";

export default async function PartyGamesPage() {
  const session =
    await auth();

  if (
    !session?.user?.discordId
  ) {
    redirect("/");
  }

  return <PartyHub />;
}
