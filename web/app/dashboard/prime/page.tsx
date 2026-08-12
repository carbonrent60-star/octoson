import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { createPageMetadata } from "@/lib/metadata";
import {
  getEarningOverview,
} from "@/lib/octoson-earn";

import PrimeClient, {
  type PrimeMissionView,
  type PrimeView,
} from "./prime-client";

async function getEconomyModule() {
  return import("../../../../src/economy.js");
}

export const metadata =
  createPageMetadata({
    title: "Prime",
    description:
      "Octoson Prime üzvlüyünü, refund haqlarını və premium üstünlüklərini idarə et.",
    path: "/dashboard/prime",
  });

export default async function PrimePage() {
  const session = await auth();

  if (!session?.user?.discordId) {
    redirect("/");
  }

  const userId =
    String(session.user.discordId);

  const economy =
    await getEconomyModule();

  const [
    prime,
    profile,
    earning,
  ] =
    await Promise.all([
      economy.getPrimeProfile(userId),
      economy.getProfile(userId),
      getEarningOverview(userId),
    ]);

  const primeMissions:
    PrimeMissionView[] =
    earning.missions
      .filter(
        (mission) =>
          mission.primeOnly ||
          mission.missionKey.startsWith(
            "prime_"
          )
      )
      .map((mission) => ({
        id: mission.id,
        periodType:
          mission.periodType,
        title: mission.title,
        description:
          mission.description,
        metric: mission.metric,
        target: mission.target,
        progress: mission.progress,
        auraReward:
          mission.auraReward,
        xpReward:
          mission.xpReward,
        seasonXpReward:
          mission.seasonXpReward,
        completedAt:
          mission.completedAt,
        claimedAt:
          mission.claimedAt,
      }));

  return (
    <PrimeClient
      prime={prime as PrimeView}
      balance={Number(
        profile?.balance ?? 0
      )}
      missions={primeMissions}
      season={{
        level:
          Number(
            earning.season.level ?? 1
          ),
        xp:
          Number(
            earning.season.xp ?? 0
          ),
        nextLevelXp:
          Number(
            earning.season.nextLevelXp ??
              1
          ),
        progress:
          Number(
            earning.season.progress ?? 0
          ),
      }}
    />
  );
}
