"use client";

import {
  useRouter,
} from "next/navigation";

import {
  ArrowRight,
  PartyPopper,
  Users,
} from "lucide-react";

export default function PartyEntry() {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() =>
        router.push(
          "/dashboard/games/party"
        )
      }
      className="group mt-6 w-full overflow-hidden rounded-[22px] border border-cyan-100/[0.12] bg-cyan-100/[0.04] p-5 text-left transition hover:border-cyan-100/[0.22] hover:bg-cyan-100/[0.065]"
    >
      <div className="flex items-center justify-between gap-5">
        <div>
          <div className="flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[0.16em] text-cyan-100/55">
            <PartyPopper className="h-3.5 w-3.5" />
            YENİ MULTIPLAYER
          </div>

          <h2 className="mt-2 text-[19px] font-semibold text-white">
            Octoson Party Games
          </h2>

          <p className="mt-1 text-[10px] text-white/35">
            Last Button, Undercover, Pixel Wars, Vault, King of the Hill və OCTO Party.
          </p>

          <span className="mt-3 inline-flex items-center gap-1.5 text-[9px] text-white/28">
            <Users className="h-3.5 w-3.5" />
            2–10 oyunçu
          </span>
        </div>

        <ArrowRight className="h-5 w-5 shrink-0 text-white/25 transition group-hover:translate-x-1 group-hover:text-cyan-100/60" />
      </div>
    </button>
  );
}
