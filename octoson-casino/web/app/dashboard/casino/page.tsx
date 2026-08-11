import { createPageMetadata } from "@/lib/metadata";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { getOctosonUser } from "@/lib/octoson";

import CasinoClient from "./casino-client";


export const metadata = createPageMetadata({
  title: 'Casino',
  description: 'Octoson Aura casino oyunlarını kəşf et.',
  path: '/dashboard/casino',
});

export default async function CasinoPage() {
  const session = await auth();

  if (!session?.user?.discordId) {
    redirect("/");
  }

  const economy = await getOctosonUser(
    session.user.discordId
  );

  if (!economy) {
    redirect("/not-member");
  }

  return (
    <div className="mx-auto max-w-[1320px]">
      <CasinoClient
        initialBalance={Number(
          economy.profile.balance ?? 0
        )}
      />
    </div>
  );
}
