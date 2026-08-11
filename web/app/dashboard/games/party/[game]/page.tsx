import {
  redirect,
} from "next/navigation";

export default async function GameLanding({
  params,
}: {
  params: Promise<{
    game: string;
  }>;
}) {
  await params;

  redirect(
    "/dashboard/games/party"
  );
}
