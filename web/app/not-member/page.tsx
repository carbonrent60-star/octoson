import { auth, signOut } from "@/auth";
import {
  ArrowLeft,
  ShieldX,
} from "lucide-react";
import { redirect } from "next/navigation";

export default async function NotMemberPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#050507] p-6 text-white">
      <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-white/[0.025] p-8">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-red-400/20 bg-red-400/[0.06]">
          <ShieldX className="h-6 w-6 text-red-300" />
        </div>

        <h1 className="mt-6 text-2xl font-semibold tracking-tight">
          Octoson Web girişi bağlıdır
        </h1>

        <p className="mt-3 leading-7 text-white/45">
          Bu Discord hesabı Octoson serverinin aktiv üzvü
          kimi təsdiqlənmədi.
        </p>

        <p className="mt-2 text-sm text-white/30">
          Serverə qoşul və varsa üzvlük yoxlamasını tamamla,
          sonra yenidən daxil ol.
        </p>

        <form
          className="mt-8"
          action={async () => {
            "use server";

            await signOut({
              redirectTo: "/",
            });
          }}
        >
          <button
            type="submit"
            className="flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-medium text-black transition hover:bg-white/90"
          >
            <ArrowLeft className="h-4 w-4" />
            Geri qayıt
          </button>
        </form>
      </div>
    </main>
  );
}
