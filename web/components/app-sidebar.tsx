"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import {
  Activity,
  Banknote,
  Boxes,
  ChevronRight,
  CircleDollarSign,
  CircleUserRound,
  Crown,
  Dices,
  Gamepad2,
  Globe2,
  Home,
  ShoppingBag,
  Sparkles,
  Trophy,
  ShieldCheck,
} from "lucide-react";

const navigation = [
  { href: "/dashboard", label: "Ana səhifə", icon: Home },
  { href: "/dashboard/casino", label: "Kazino", icon: Gamepad2 },
  { href: "/dashboard/games", label: "Oyunlar", icon: Dices },
  { href: "/dashboard/bank", label: "Bank", icon: Banknote },
  { href: "/dashboard/earn", label: "Qazan", icon: CircleDollarSign },
  { href: "/dashboard/prime", label: "Prime", icon: Crown },
  { href: "/dashboard/market", label: "Bazar", icon: ShoppingBag },
  { href: "/dashboard/inventory", label: "İnventar", icon: Boxes },
  { href: "/dashboard/world", label: "Dünya", icon: Globe2 },
  { href: "/dashboard/leaderboard", label: "Reytinq", icon: Trophy },
  { href: "/dashboard/activity", label: "Fəaliyyət", icon: Activity },
  { href: "/dashboard/profile", label: "Profil", icon: CircleUserRound },
];

export default function AppSidebar({
  mobile = false,
  isAdmin = false,
}: {
  mobile?: boolean;
  isAdmin?: boolean;
}) {
  const pathname = usePathname();

  return (
    <aside
      className={`flex h-full w-full flex-col border-r border-white/[0.055] bg-[#070709]/95 backdrop-blur-2xl ${
        mobile ? "" : ""
      }`}
    >
      {/* BRAND */}
      <div className="flex h-[72px] shrink-0 items-center px-5">
        <Link
          href="/dashboard"
          className="group flex min-w-0 items-center gap-3"
        >
          <motion.div
            whileHover={{ scale: 1.04 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-[13px] border border-cyan-200/[0.13] bg-cyan-200/[0.055]"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-200/[0.12] via-transparent to-transparent" />

            <div className="absolute -right-4 -top-4 h-10 w-10 rounded-full bg-cyan-200/10 blur-xl" />

            <Sparkles
              className="relative h-[17px] w-[17px] text-cyan-100/85"
              strokeWidth={1.8}
            />
          </motion.div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="truncate text-[15px] font-semibold tracking-[-0.025em] text-white">
                Octoson
              </p>

              <span className="rounded-md border border-white/[0.07] bg-white/[0.03] px-1.5 py-0.5 text-[7px] font-bold uppercase tracking-[0.15em] text-white/25">
                Web
              </span>
            </div>

            <p className="mt-0.5 text-[9px] font-medium uppercase tracking-[0.17em] text-white/18">
              Aura Economy
            </p>
          </div>
        </Link>
      </div>

      <div className="mx-5 h-px shrink-0 bg-white/[0.055]" />

      {/* NAV */}
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-5">
        <p className="mb-2.5 px-3 text-[8px] font-semibold uppercase tracking-[0.22em] text-white/15">
          Platforma
        </p>

        <nav className="space-y-1">
          {[
            ...navigation,
            ...(isAdmin
              ? [
                  {
                    href: "/dashboard/admin",
                    label: "Admin paneli",
                    icon: ShieldCheck,
                  },
                ]
              : []),
          ].map((item) => {
            const Icon = item.icon;

            const active =
              item.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                data-no-hover-sound="true"
                className={`group relative flex h-[44px] items-center gap-3 overflow-hidden rounded-[12px] px-3 text-[12px] font-medium transition-colors duration-100 ${
                  active ? "text-white" : "text-white/32 hover:text-white/70"
                }`}
              >
                {active && (
                  <motion.div
                    layoutId={
                      mobile ? "mobile-nav-active" : "desktop-nav-active"
                    }
                    className="absolute inset-0 rounded-[12px] border border-white/[0.065] bg-white/[0.05]"
                    transition={{
                      type: "tween",
                      duration: 0.12,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                  />
                )}

                {!active && (
                  <div className="absolute inset-0 rounded-[12px] bg-white/0 transition-colors duration-100 group-hover:bg-white/[0.025]" />
                )}

                {active && (
                  <motion.div
                    layoutId={mobile ? "mobile-nav-line" : "desktop-nav-line"}
                    className="absolute left-0 top-1/2 h-[18px] w-[2px] -translate-y-1/2 rounded-full bg-cyan-200/90 shadow-[0_0_14px_rgba(165,243,252,0.45)]"
                  />
                )}

                <Icon
                  className={`relative z-10 h-[16px] w-[16px] shrink-0 transition-colors ${
                    active
                      ? "text-cyan-100/90"
                      : "text-white/28 group-hover:text-white/55"
                  }`}
                  strokeWidth={1.8}
                />

                <span className="relative z-10 min-w-0 flex-1 truncate">
                  {item.label}
                </span>

                <ChevronRight
                  className={`relative z-10 h-3 w-3 transition-all duration-200 ${
                    active
                      ? "translate-x-0 text-white/20"
                      : "-translate-x-1 text-transparent group-hover:translate-x-0 group-hover:text-white/15"
                  }`}
                />
              </Link>
            );
          })}
        </nav>
      </div>

      {/* STATUS */}
      <div className="shrink-0 p-4">
        <div className="relative overflow-hidden rounded-[15px] border border-white/[0.055] bg-white/[0.018] p-4">
          <div className="pointer-events-none absolute -right-8 -top-8 h-20 w-20 rounded-full bg-emerald-300/[0.035] blur-2xl" />

          <div className="relative flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-20" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-300/80" />
            </span>

            <span className="text-[10px] font-medium text-white/45">
              Economy aktivdir
            </span>
          </div>

          <p className="relative mt-2 text-[9px] leading-[1.6] text-white/18">
            Discord economy ilə real-time sinxronizasiya.
          </p>
        </div>
      </div>
    </aside>
  );
}
