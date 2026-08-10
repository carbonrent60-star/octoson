import { auth } from "@/auth";
import { redirect } from "next/navigation";

import SpecialGameClient from "../special-game-client";

async function getEconomyModule() {
  return import("../../../../../src/economy.js");
}

export default async function Page() {
  const session = await auth();

  if (!session?.user?.discordId) {
    redirect("/");
  }

  const economy = await getEconomyModule();

  const profile = await economy.getProfile(
    session.user.discordId
  );

  return (
    <SpecialGameClient
      game="slots"
      initialBalance={Number(
        profile?.balance ?? 0
      )}
    />
  );
}
