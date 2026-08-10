import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { getOctosonUser } from "@/lib/octoson";

import BaccaratClient from "./baccarat-client";

export default async function BaccaratPage() {
  const session =
    await auth();

  if (
    !session?.user?.discordId
  ) {
    redirect("/");
  }

  const economy =
    await getOctosonUser(
      session.user.discordId
    );

  if (!economy) {
    redirect(
      "/not-member"
    );
  }

  return (
    <div className="mx-auto max-w-[1200px]">
      <BaccaratClient
        initialBalance={Number(
          economy.profile.balance ??
            0
        )}
      />
    </div>
  );
}
