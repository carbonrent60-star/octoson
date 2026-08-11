import { createPageMetadata } from "@/lib/metadata";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { getOctosonUser } from "@/lib/octoson";

import MinesClient from "./mines-client";


export const metadata = createPageMetadata({
  title: 'Mines',
  description: 'Minalardan yayın, multiplier-i artır və Aura qazan.',
  path: '/dashboard/casino/mines',
});

export default async function MinesPage() {
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
    <div className="mx-auto max-w-[900px]">
      <MinesClient
        initialBalance={Number(
          economy.profile.balance ?? 0
        )}
      />
    </div>
  );
}
