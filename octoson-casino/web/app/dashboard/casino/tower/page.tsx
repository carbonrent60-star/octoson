import { createPageMetadata } from "@/lib/metadata";
import { auth } from "@/auth";
import { redirect } from "next/navigation";

import SpecialGameClient from "../special-game-client";

async function getEconomyModule() {
  return import("../../../../../src/economy.js");
}


export const metadata = createPageMetadata({
  title: 'Tower',
  description: 'Tower-da yüksəl, riski artır və Aura mükafatını böyüt.',
  path: '/dashboard/casino/tower',
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
      game="tower"
      initialBalance={Number(
        profile?.balance ?? 0
      )}
    />
  );
}
