import { auth } from "@/auth";
import DashboardHome from "@/components/dashboard/dashboard-home";
import { getOctosonUser } from "@/lib/octoson";
import { redirect } from "next/navigation";

export default async function Dashboard() {
  const session = await auth();

  if (!session?.user?.discordId) {
    redirect("/");
  }

  const octosonUser = await getOctosonUser(
    session.user.discordId
  );

  if (!octosonUser) {
    return (
      <div className="rounded-[20px] border border-amber-300/10 bg-amber-300/[0.025] p-7">
        <p className="text-[13px] font-medium text-amber-200/70">
          Octoson economy profili tapılmadı.
        </p>

        <p className="mt-2 text-[11px] text-white/25">
          Discord-da Octoson istifadə etdikdən sonra yenidən yoxla.
        </p>
      </div>
    );
  }

  const profile = octosonUser.profile;

  return (
    <DashboardHome
      name={session.user.name}
      image={session.user.image}
      wallet={Number(profile.balance ?? 0)}
      bank={Number(profile.bank ?? 0)}
      level={Number(profile.level ?? 1)}
      xp={Number(profile.xp ?? 0)}
      prestige={Number(profile.prestige ?? 0)}
      rank={String(
        profile.rank ?? "🌱 Yeni başlayan"
      )}
    />
  );
}
