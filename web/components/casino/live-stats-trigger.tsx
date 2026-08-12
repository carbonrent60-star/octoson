"use client";

import { Activity } from "lucide-react";
import { motion } from "motion/react";
import { usePathname } from "next/navigation";

const CASINO_ROOT = "/dashboard/casino";

export default function LiveStatsTrigger() {
  const pathname = usePathname();

  /*
   * Do not show Stats on the casino lobby.
   * It should only be accessible while inside a game.
   */
  if (
    !pathname.startsWith(`${CASINO_ROOT}/`) ||
    pathname === CASINO_ROOT
  ) {
    return null;
  }

  function openStats() {
    window.dispatchEvent(
      new CustomEvent("octoson-live-stats-open")
    );
  }

  return (
    <div className="mx-auto mb-3 flex w-full max-w-[1380px] justify-end px-0">
      <motion.button
        type="button"
        onClick={openStats}
        whileHover={{ y: -1 }}
        whileTap={{ scale: 0.96 }}
        className="
          group flex h-9 items-center gap-2
          rounded-[11px]
          border border-white/[0.07]
          bg-white/[0.025]
          px-3
          text-[9px] font-medium
          text-white/35
          shadow-[0_10px_30px_rgba(0,0,0,.16)]
          backdrop-blur-xl
          transition-colors
          hover:border-cyan-100/[0.12]
          hover:bg-cyan-100/[0.035]
          hover:text-white/65
        "
        aria-label="Live Stats aç"
      >
        <span
          className="
            flex h-5 w-5 items-center justify-center
            rounded-[6px]
            border border-white/[0.06]
            bg-white/[0.025]
            text-cyan-100/45
            transition
            group-hover:text-cyan-100/70
          "
        >
          <Activity className="h-3 w-3" />
        </span>

        <span>Stats</span>
      </motion.button>
    </div>
  );
}
