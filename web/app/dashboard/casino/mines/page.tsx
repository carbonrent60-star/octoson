import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { getOctosonUser } from "@/lib/octoson";

import MinesClient from "./mines-client";

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
