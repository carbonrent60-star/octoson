import { auth, signOut } from "@/auth";
import DashboardShell from "@/components/dashboard/dashboard-shell";
import { isOctosonAdmin } from "@/lib/admin";
import { getOctosonGuildMember } from "@/lib/discord-server";
import { redirect } from "next/navigation";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user?.discordId) {
    redirect("/");
  }

  /*
   * Discord membership is an access check, but Discord API
   * availability must never be allowed to crash the entire dashboard.
   *
   * getOctosonGuildMember():
   * - returns null when Discord explicitly says the user is not a member
   * - throws for transient failures / rate limits
   *
   * A transient Discord failure therefore keeps an already-authenticated
   * dashboard session alive instead of producing the Next.js red overlay.
   */
  let membership:
    | Awaited<ReturnType<typeof getOctosonGuildMember>>
    | undefined;

  try {
    membership = await getOctosonGuildMember(
      session.user.discordId
    );
  } catch (error) {
    console.warn(
      "[OCTOSON WEB] Discord membership temporarily unavailable; using authenticated session.",
      error instanceof Error ? error.message : error
    );

    membership = undefined;
  }

  /*
   * Only redirect when Discord successfully answered and explicitly
   * confirmed that the member does not exist.
   *
   * undefined = Discord unavailable / rate limited
   * null      = confirmed non-member
   * object    = member
   */
  if (membership === null) {
    redirect("/not-member");
  }

  async function logout() {
    "use server";

    await signOut({
      redirectTo: "/",
    });
  }

  return (
    <DashboardShell
      userName={session.user.name}
      userImage={session.user.image}
      logout={logout}
      isAdmin={isOctosonAdmin(session.user.discordId)}
    >
      {children}
    </DashboardShell>
  );
}
