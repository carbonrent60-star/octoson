"use server";

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getEarningOverview } from "@/lib/octoson-earn";
import EarnPremiumClient from "./earn-premium-client";

export default async function EarnPage() {
  const session = await auth();

  if (!session?.user?.discordId) {
    redirect("/");
  }

  const data = await getEarningOverview(
    String(session.user.discordId)
  );

  return <EarnPremiumClient data={data} />;
}
