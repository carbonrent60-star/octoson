import { auth } from "@/auth";
import LandingClient from "@/components/landing/landing-client";

export default async function Home() {
  const session = await auth();

  return (
    <LandingClient
      loggedIn={Boolean(session?.user?.discordId)}
      userName={session?.user?.name ?? null}
      userImage={session?.user?.image ?? null}
    />
  );
}
