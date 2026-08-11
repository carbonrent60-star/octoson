import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getOctosonUser } from "@/lib/octoson";
import RouletteClient from "./roulette-client";

export default async function RoulettePage() {
  const session = await auth();
  if (!session?.user?.discordId) redirect("/");
  const economy = await getOctosonUser(session.user.discordId);
  if (!economy) redirect("/not-member");
  return <RouletteClient initialBalance={Number(economy.profile.balance ?? 0)} />;
}
