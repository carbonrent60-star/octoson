"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import GlobalSearch from "@/components/dashboard/global-search";
import {
  Activity,
  Banknote,
  Boxes,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  CircleUserRound,
  Crown,
  Dices,
  Gamepad2,
  Globe2,
  Home,
  Layers3,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Trophy,
} from "lucide-react";

/* =========================================================
   DESKTOP NAVIGATION
   Keep the full desktop sidebar exactly as a power-user menu.
   ========================================================= */

const navigationGroups = [
  {
    label: "Əsas",
    items: [
      { href: "/dashboard", label: "Ana səhifə", icon: Home },
      { href: "/dashboard/profile", label: "Profil", icon: CircleUserRound },
    ],
  },
  {
    label: "Aura",
    items: [
      { href: "/dashboard/earn", label: "Qazan", icon: CircleDollarSign },
      { href: "/dashboard/bank", label: "Bank", icon: Banknote },
      { href: "/dashboard/market", label: "Bazar", icon: ShoppingBag },
      { href: "/dashboard/inventory", label: "İnventar", icon: Boxes },
      { href: "/dashboard/prime", label: "Prime", icon: Crown },
    ],
  },
  {
    label: "Oyna",
    items: [
      { href: "/dashboard/casino", label: "Kazino", icon: Gamepad2 },
      { href: "/dashboard/games", label: "Oyunlar", icon: Dices },
    ],
  },
  {
    label: "İcma",
    items: [
      { href: "/dashboard/leaderboard", label: "Reytinq", icon: Trophy },
      { href: "/dashboard/activity", label: "Fəaliyyət", icon: Activity },
      { href: "/dashboard/world", label: "Dünya", icon: Globe2 },
    ],
  },
];

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{
    className?: string;
    strokeWidth?: number;
  }>;
};

function isPathActive(pathname: string, href: string) {
  return href === "/dashboard"
    ? pathname === "/dashboard"
    : pathname.startsWith(href);
}

/* =========================================================
   COMPONENT
   ========================================================= */

export default function AppSidebar({
  mobile = false,
  isAdmin = false,
  onNavigate,
}: {
  mobile?: boolean;
  isAdmin?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  const [moneyOpen, setMoneyOpen] = useState(
    pathname.startsWith("/dashboard/bank") ||
      pathname.startsWith("/dashboard/market") ||
      pathname.startsWith("/dashboard/inventory") ||
      pathname.startsWith("/dashboard/prime")
  );

  const [playOpen, setPlayOpen] = useState(
    pathname.startsWith("/dashboard/casino") ||
      pathname.startsWith("/dashboard/games")
  );

  const [communityOpen, setCommunityOpen] = useState(
    pathname.startsWith("/dashboard/activity") ||
      pathname.startsWith("/dashboard/world")
  );

  function MobileLink({ item }: { item: NavItem }) {
    const Icon = item.icon;
    const active = isPathActive(pathname, item.href);

    return (
      <Link
        href={item.href}
        onClick={onNavigate}
        data-no-hover-sound="true"
        className={`group relative flex h-[44px] items-center gap-3 overflow-hidden rounded-[13px] px-3 transition ${
          active
            ? "border border-white/[0.07] bg-white/[0.055] text-white"
            : "border border-transparent text-white/42 active:bg-white/[0.045]"
        }`}
      >
        {active && (
          <motion.div
            layoutId="mobile-drawer-line"
            className="absolute left-0 top-1/2 h-[19px] w-[2px] -translate-y-1/2 rounded-full bg-cyan-200/90 shadow-[0_0_12px_rgba(165,243,252,.38)]"
          />
        )}

        <Icon
          className={`relative z-10 h-[16px] w-[16px] shrink-0 ${
            active ? "text-cyan-100/90" : "text-white/30"
          }`}
          strokeWidth={1.8}
        />

        <span className="relative z-10 min-w-0 flex-1 truncate text-[12px] font-medium">
          {item.label}
        </span>

        <ChevronRight className="relative z-10 h-3 w-3 text-white/15" />
      </Link>
    );
  }

  function MobileGroup({
    label,
    description,
    icon: Icon,
    open,
    setOpen,
    active,
    children,
  }: {
    label: string;
    description: string;
    icon: React.ComponentType<{
      className?: string;
      strokeWidth?: number;
    }>;
    open: boolean;
    setOpen: (value: boolean) => void;
    active: boolean;
    children: React.ReactNode;
  }) {
    return (
      <div>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          data-no-hover-sound="true"
          className={`flex min-h-[50px] w-full items-center gap-3 rounded-[14px] border px-3 text-left transition ${
            active
              ? "border-cyan-200/[0.09] bg-cyan-200/[0.035]"
              : "border-white/[0.045] bg-white/[0.018] active:bg-white/[0.045]"
          }`}
        >
          <div
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] border ${
              active
                ? "border-cyan-200/[0.10] bg-cyan-200/[0.055]"
                : "border-white/[0.055] bg-white/[0.025]"
            }`}
          >
            <Icon
              className={`h-[15px] w-[15px] ${
                active ? "text-cyan-100/80" : "text-white/32"
              }`}
              strokeWidth={1.8}
            />
          </div>

          <div className="min-w-0 flex-1">
            <p
              className={`text-[12px] font-medium ${
                active ? "text-white/85" : "text-white/55"
              }`}
            >
              {label}
            </p>

            <p className="mt-0.5 truncate text-[8px] text-white/20">
              {description}
            </p>
          </div>

          <motion.div
            animate={{ rotate: open ? 180 : 0 }}
            transition={{ duration: 0.16 }}
          >
            <ChevronDown className="h-3.5 w-3.5 text-white/20" />
          </motion.div>
        </button>

        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.16, ease: "easeOut" }}
              className="overflow-hidden"
            >
              <div className="ml-4 mt-1.5 space-y-1 border-l border-white/[0.055] pl-2">
                {children}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  /* =========================================================
     MOBILE DRAWER
     Compact navigation hub instead of the giant desktop list.
     ========================================================= */

  if (mobile) {
    const moneyActive =
      pathname.startsWith("/dashboard/bank") ||
      pathname.startsWith("/dashboard/market") ||
      pathname.startsWith("/dashboard/inventory") ||
      pathname.startsWith("/dashboard/prime");

    const playActive =
      pathname.startsWith("/dashboard/casino") ||
      pathname.startsWith("/dashboard/games");

    const communityActive =
      pathname.startsWith("/dashboard/activity") ||
      pathname.startsWith("/dashboard/world");

    return (
      <aside className="flex h-full w-full flex-col border-r border-white/[0.06] bg-[#070709]/98 backdrop-blur-2xl">
        {/* BRAND */}
        <div className="flex h-[68px] shrink-0 items-center px-4">
          <Link
            href="/dashboard"
            onClick={onNavigate}
            className="group flex min-w-0 items-center gap-3"
          >
            <div className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-[12px] border border-cyan-200/[0.13] bg-cyan-200/[0.055]">
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-200/[0.12] via-transparent to-transparent" />

              <Sparkles
                className="relative h-[16px] w-[16px] text-cyan-100/85"
                strokeWidth={1.8}
              />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="truncate text-[14px] font-semibold tracking-[-0.025em] text-white">
                  Octoson
                </p>

                <span className="rounded-md border border-white/[0.07] bg-white/[0.03] px-1.5 py-0.5 text-[7px] font-bold uppercase tracking-[0.15em] text-white/25">
                  Web
                </span>
              </div>

              <p className="mt-0.5 text-[8px] font-medium uppercase tracking-[0.17em] text-white/18">
                Aura Economy
              </p>
            </div>
          </Link>
        </div>

        <div className="mx-4 h-px bg-white/[0.055]" />

        {/* SEARCH */}
        <div className="shrink-0 px-3 pb-2 pt-3">
          <GlobalSearch />
        </div>

        {/* COMPACT NAV */}
        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4 pt-2">
          <nav className="space-y-4">
            <div>
              <p className="mb-1.5 px-2 text-[8px] font-semibold uppercase tracking-[0.22em] text-white/15">
                Sürətli giriş
              </p>

              <div className="space-y-1">
                <MobileLink
                  item={{
                    href: "/dashboard",
                    label: "Ana səhifə",
                    icon: Home,
                  }}
                />

                <MobileLink
                  item={{
                    href: "/dashboard/profile",
                    label: "Profil",
                    icon: CircleUserRound,
                  }}
                />

                <MobileLink
                  item={{
                    href: "/dashboard/earn",
                    label: "Qazan",
                    icon: CircleDollarSign,
                  }}
                />

                <MobileLink
                  item={{
                    href: "/dashboard/leaderboard",
                    label: "Reytinq",
                    icon: Trophy,
                  }}
                />
              </div>
            </div>

            <div>
              <p className="mb-1.5 px-2 text-[8px] font-semibold uppercase tracking-[0.22em] text-white/15">
                Kəşf et
              </p>

              <div className="space-y-2">
                <MobileGroup
                  label="Pul & Əşyalar"
                  description="Bank · Bazar · İnventar · Prime"
                  icon={Layers3}
                  open={moneyOpen}
                  setOpen={setMoneyOpen}
                  active={moneyActive}
                >
                  <MobileLink
                    item={{
                      href: "/dashboard/bank",
                      label: "Bank",
                      icon: Banknote,
                    }}
                  />

                  <MobileLink
                    item={{
                      href: "/dashboard/market",
                      label: "Bazar",
                      icon: ShoppingBag,
                    }}
                  />

                  <MobileLink
                    item={{
                      href: "/dashboard/inventory",
                      label: "İnventar",
                      icon: Boxes,
                    }}
                  />

                  <MobileLink
                    item={{
                      href: "/dashboard/prime",
                      label: "Prime",
                      icon: Crown,
                    }}
                  />
                </MobileGroup>

                <MobileGroup
                  label="Oyun Mərkəzi"
                  description="Kazino · Oyunlar"
                  icon={Gamepad2}
                  open={playOpen}
                  setOpen={setPlayOpen}
                  active={playActive}
                >
                  <MobileLink
                    item={{
                      href: "/dashboard/casino",
                      label: "Kazino",
                      icon: Gamepad2,
                    }}
                  />

                  <MobileLink
                    item={{
                      href: "/dashboard/games",
                      label: "Oyunlar",
                      icon: Dices,
                    }}
                  />
                </MobileGroup>

                <MobileGroup
                  label="İcma"
                  description="Fəaliyyət · Dünya"
                  icon={Globe2}
                  open={communityOpen}
                  setOpen={setCommunityOpen}
                  active={communityActive}
                >
                  <MobileLink
                    item={{
                      href: "/dashboard/activity",
                      label: "Fəaliyyət",
                      icon: Activity,
                    }}
                  />

                  <MobileLink
                    item={{
                      href: "/dashboard/world",
                      label: "Dünya",
                      icon: Globe2,
                    }}
                  />
                </MobileGroup>
              </div>
            </div>

            {isAdmin && (
              <div>
                <p className="mb-1.5 px-2 text-[8px] font-semibold uppercase tracking-[0.22em] text-white/15">
                  Sistem
                </p>

                <MobileLink
                  item={{
                    href: "/dashboard/admin",
                    label: "Admin paneli",
                    icon: ShieldCheck,
                  }}
                />
              </div>
            )}
          </nav>
        </div>

        {/* STATUS */}
        <div className="shrink-0 border-t border-white/[0.045] p-3">
          <div className="flex items-center gap-2 rounded-[12px] border border-white/[0.045] bg-white/[0.018] px-3 py-2.5">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-20" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-300/80" />
            </span>

            <span className="text-[9px] font-medium text-white/32">
              Economy aktivdir
            </span>
          </div>
        </div>
      </aside>
    );
  }

  /* =========================================================
     DESKTOP SIDEBAR
     ========================================================= */

  return (
    <aside className="flex h-full w-full flex-col border-r border-white/[0.055] bg-[#070709]/95 backdrop-blur-2xl">
      {/* BRAND */}
      <div className="flex h-[72px] shrink-0 items-center px-5">
        <Link
          href="/dashboard"
          onClick={onNavigate}
          className="group flex min-w-0 items-center gap-3"
        >
          <motion.div
            whileHover={{ scale: 1.04 }}
            transition={{
              type: "spring",
              stiffness: 400,
              damping: 25,
            }}
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

      {/* DESKTOP NAV */}
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-5">
        <nav className="space-y-5">
          {navigationGroups.map((group) => (
            <div key={group.label}>
              <p className="mb-2 px-3 text-[8px] font-semibold uppercase tracking-[0.22em] text-white/15">
                {group.label}
              </p>

              <div className="space-y-1">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = isPathActive(pathname, item.href);

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onNavigate}
                      data-no-hover-sound="true"
                      className={`group relative flex h-[42px] items-center gap-3 overflow-hidden rounded-[12px] px-3 text-[12px] font-medium transition-colors duration-100 ${
                        active
                          ? "text-white"
                          : "text-white/32 hover:text-white/70"
                      }`}
                    >
                      {active && (
                        <motion.div
                          layoutId="desktop-nav-active"
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
                          layoutId="desktop-nav-line"
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
              </div>
            </div>
          ))}

          {isAdmin && (
            <div>
              <p className="mb-2 px-3 text-[8px] font-semibold uppercase tracking-[0.22em] text-white/15">
                Sistem
              </p>

              <Link
                href="/dashboard/admin"
                onClick={onNavigate}
                data-no-hover-sound="true"
                className={`group relative flex h-[42px] items-center gap-3 overflow-hidden rounded-[12px] px-3 text-[12px] font-medium transition-colors duration-100 ${
                  pathname.startsWith("/dashboard/admin")
                    ? "text-white"
                    : "text-white/32 hover:text-white/70"
                }`}
              >
                {pathname.startsWith("/dashboard/admin") && (
                  <>
                    <motion.div
                      layoutId="desktop-nav-active"
                      className="absolute inset-0 rounded-[12px] border border-white/[0.065] bg-white/[0.05]"
                    />

                    <motion.div
                      layoutId="desktop-nav-line"
                      className="absolute left-0 top-1/2 h-[18px] w-[2px] -translate-y-1/2 rounded-full bg-cyan-200/90"
                    />
                  </>
                )}

                <ShieldCheck
                  className={`relative z-10 h-4 w-4 ${
                    pathname.startsWith("/dashboard/admin")
                      ? "text-cyan-100/90"
                      : "text-white/28"
                  }`}
                  strokeWidth={1.8}
                />

                <span className="relative z-10 flex-1">
                  Admin paneli
                </span>

                <ChevronRight className="relative z-10 h-3 w-3 text-white/15" />
              </Link>
            </div>
          )}
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
