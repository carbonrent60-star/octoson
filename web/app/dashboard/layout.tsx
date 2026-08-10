import { auth, signOut } from "@/auth";
import DashboardShell from "@/components/dashboard/dashboard-shell";
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

  const member = await getOctosonGuildMember(
    session.user.discordId
  );

  if (!member) {
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
    >
      {children}
    </DashboardShell>
  );
}
