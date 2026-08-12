"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Menu, X } from "lucide-react";
import AppSidebar from "@/components/app-sidebar";
import { OctosonAudioProvider } from "@/components/audio/octoson-audio";
import SoundControl from "@/components/audio/sound-control";
import PresenceHeartbeat from "@/components/presence-heartbeat";
import MobileNav from "@/components/dashboard/mobile-nav";
import GlobalSearch from "@/components/dashboard/global-search";

type DashboardShellProps = {
  children: React.ReactNode;
  userName?: string | null;
  userImage?: string | null;
  logout: () => Promise<void>;
  isAdmin?: boolean;
};

export default function DashboardShell({
  children,
  userName,
  userImage,
  logout,
  isAdmin = false,
}: DashboardShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <OctosonAudioProvider>
      <div className="relative min-h-screen bg-[#050507] text-white">
        <PresenceHeartbeat />
        {/* ambient background */}
        <div className="pointer-events-none fixed inset-0 overflow-hidden">
          <div className="octo-mobile-heavy-decoration absolute left-[18%] top-[-300px] h-[620px] w-[620px] rounded-full bg-cyan-300/[0.035] blur-[140px]" />
          <div className="absolute bottom-[-350px] right-[-100px] hidden h-[700px] w-[700px] rounded-full bg-blue-500/[0.025] blur-[150px] sm:block" />

          <div
            className="absolute inset-0 opacity-[0.025]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.08) 1px, transparent 1px)",
              backgroundSize: "64px 64px",
            }}
          />
        </div>

        {/* DESKTOP SIDEBAR */}
        <div className="fixed inset-y-0 left-0 z-50 hidden w-[260px] lg:block">
          <AppSidebar isAdmin={isAdmin} />
        </div>

        {/* MOBILE OVERLAY */}
        <AnimatePresence>
          {mobileOpen && (
            <>
              <motion.button
                type="button"
                aria-label="Close menu"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setMobileOpen(false)}
                className="octo-mobile-fixed fixed inset-0 z-[70] bg-black/80 lg:hidden"
              />

              <motion.div
                initial={{ x: -340 }}
                animate={{ x: 0 }}
                exit={{ x: -340 }}
                transition={{
                  type: "spring",
                  stiffness: 360,
                  damping: 34,
                }}
                className="fixed inset-y-0 left-0 z-[80] w-[min(320px,calc(100vw-28px))] lg:hidden"
              >
                <AppSidebar
                  mobile
                  isAdmin={isAdmin}
                  onNavigate={() => setMobileOpen(false)}
                />

                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  className="absolute right-3 top-4 flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] bg-black/30 text-white/50"
                >
                  <X className="h-4 w-4" />
                </button>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* APP AREA */}
        <div className="relative min-h-screen lg:pl-[260px]">
          <header className="octo-mobile-fixed fixed left-0 right-0 top-0 z-40 h-[62px] border-b border-white/[0.055] bg-[#050507]/95 sm:h-[72px] sm:bg-[#050507]/80 sm:backdrop-blur-xl lg:left-[260px]">
            <div className="flex h-full items-center justify-between px-3.5 sm:px-7 lg:px-9">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setMobileOpen(true)}
                  className="flex h-9 w-9 items-center justify-center rounded-[12px] border border-white/[0.08] bg-white/[0.035] text-white/55 shadow-[inset_0_1px_0_rgba(255,255,255,.035)] transition active:scale-95 hover:bg-white/[0.06] hover:text-white lg:hidden"
                >
                  <Menu className="h-[17px] w-[17px]" />
                </button>

                <div className="hidden w-[min(42vw,620px)] sm:block">
                  <GlobalSearch />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <SoundControl />

                <div className="mr-2 hidden text-right sm:block">
                  <p className="max-w-[180px] truncate text-[12px] font-medium text-white/75">
                    {userName || "Octoson User"}
                  </p>
                </div>

                {userImage ? (
                  <div className="relative">
                    <img
                      src={userImage}
                      alt=""
                      className="h-9 w-9 rounded-xl border border-white/[0.09] object-cover"
                    />

                    <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#050507] bg-emerald-300" />
                  </div>
                ) : (
                  <div className="h-9 w-9 rounded-xl border border-white/[0.08] bg-white/[0.04]" />
                )}

                <form action={logout}>
                  <button
                    type="submit"
                    className="ml-1 hidden rounded-xl border border-white/[0.07] bg-white/[0.02] px-3 py-2 text-[10px] font-medium text-white/30 transition duration-200 hover:border-white/[0.12] hover:bg-white/[0.05] hover:text-white/70 sm:block"
                  >
                    Çıxış
                  </button>
                </form>
              </div>
            </div>
          </header>

          <main className="min-h-screen pt-[62px] sm:pt-[72px]">
            <motion.div
              initial={{ opacity: 0, y: 7 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.35,
                ease: [0.22, 1, 0.36, 1],
              }}
              className="mx-auto w-full min-w-0 max-w-[1560px] overflow-x-hidden px-3.5 pb-[calc(108px+env(safe-area-inset-bottom))] pt-5 sm:px-7 sm:pb-[110px] sm:pt-9 lg:px-9 lg:pb-10 lg:pt-10"
            >
              {children}
            </motion.div>
          </main>

          <MobileNav />
        </div>
      </div>
    </OctosonAudioProvider>
  );
}
