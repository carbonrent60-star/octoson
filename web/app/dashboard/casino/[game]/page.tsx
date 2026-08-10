import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { getOctosonUser } from "@/lib/octoson";

import type { CasinoGame } from "../actions";
import GameClient from "./game-client";

const supportedGames = new Set<CasinoGame>([
  "coinflip",
  "dice",
  "roulette",
  "crash",
  "wheel",
  "rps",
  "baccarat",
  "poker",
  "horse",
  "penalty",
  "lottery",
  "jackpot",
]);

export default async function GamePage({
  params,
}: {
  params: Promise<{ game: string }>;
}) {
  const { game } = await params;

  if (!supportedGames.has(game as CasinoGame)) {
    notFound();
  }

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
      <GameClient
        game={game as CasinoGame}
        initialBalance={Number(
          economy.profile.balance ?? 0
        )}
      />
    </div>
  );
}
