import { createPageMetadata } from "@/lib/metadata";
import { auth } from "@/auth";
import { redirect } from "next/navigation";

import SpecialGameClient from "../special-game-client";

async function getEconomyModule() {
  return import("../../../../../src/economy.js");
}


export const metadata = createPageMetadata({
  title: 'Risk',
  description: 'Risk səviyyəni seç və Octoson Aura mükafatını artır.',
  path: '/dashboard/casino/risk',
});

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
      game="risk"
      initialBalance={Number(
        profile?.balance ?? 0
      )}
    />
  );
}
