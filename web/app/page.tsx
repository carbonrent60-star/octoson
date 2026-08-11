import { createPageMetadata } from "@/lib/metadata";
import { auth } from "@/auth";
import LandingClient from "@/components/landing/landing-client";


export const metadata = createPageMetadata({
  title: 'Octoson',
  description: 'October community üçün canlı Aura economy, oyunlar, casino və progression platforması.',
  path: '/',
});

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
