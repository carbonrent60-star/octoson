import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { getOctosonPublicActivity } from "@/lib/octoson";

const CASINO_TYPES = new Set([
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
  "slots",
  "risk",
  "tower",
  "higherlower",
  "blackjack",
  "mines",
]);

export async function GET() {
  const session = await auth();

  if (!session?.user?.discordId) {
    return NextResponse.json(
      { error: "unauthorized" },
      { status: 401 }
    );
  }

  try {
    const transactions = await getOctosonPublicActivity(
      500,
      session.user.discordId
    );

    const casino = transactions
      .filter((transaction) =>
        CASINO_TYPES.has(transaction.type)
      )
      .map((transaction) => {
        const balanceBefore =
          transaction.balanceBefore == null
            ? null
            : Number(transaction.balanceBefore);

        const balanceAfter =
          transaction.balanceAfter == null
            ? null
            : Number(transaction.balanceAfter);

        const amount = Math.abs(
          Number(transaction.amount ?? 0)
        );

        const net =
          balanceBefore != null &&
          balanceAfter != null
            ? balanceAfter - balanceBefore
            : 0;

        return {
          id: transaction.id,

          // LiveStats expects `game`.
          game: transaction.type,
          type: transaction.type,

          amount,
          net,
          won: net > 0,

          balanceBefore,
          balanceAfter,

          createdAt: transaction.createdAt,
          metadata: transaction.metadata ?? {},
        };
      });

    return NextResponse.json(
      { transactions: casino },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("[CASINO STATS]", error);

    return NextResponse.json(
      { error: "stats_failed" },
      { status: 500 }
    );
  }
}
