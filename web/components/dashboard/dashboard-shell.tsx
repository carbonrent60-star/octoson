"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Menu, X } from "lucide-react";
import AppSidebar from "@/components/app-sidebar";
import { OctosonAudioProvider } from "@/components/audio/octoson-audio";
import SoundControl from "@/components/audio/sound-control";

type DashboardShellProps = {
  children: React.ReactNode;
  userName?: string | null;
  userImage?: string | null;
  logout: () => Promise<void>;
};

export default function DashboardShell({
  children,
  userName,
  userImage,
  logout,
}: DashboardShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <OctosonAudioProvider>
    <div className="relative min-h-screen bg-[#050507] text-white">
      {/* ambient background */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-[18%] top-[-300px] h-[620px] w-[620px] rounded-full bg-cyan-300/[0.035] blur-[140px]" />
        <div className="absolute bottom-[-350px] right-[-100px] h-[700px] w-[700px] rounded-full bg-blue-500/[0.025] blur-[150px]" />

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
        <AppSidebar />
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
              className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm lg:hidden"
            />

            <motion.div
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{
                type: "spring",
                stiffness: 360,
                damping: 34,
              }}
              className="fixed inset-y-0 left-0 z-[80] w-[270px] lg:hidden"
            >
              <AppSidebar mobile />

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
        <header className="fixed left-0 right-0 top-0 z-40 h-[72px] border-b border-white/[0.055] bg-[#050507]/75 backdrop-blur-2xl lg:left-[260px]">
          <div className="flex h-full items-center justify-between px-4 sm:px-7 lg:px-9">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileOpen(true)}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.025] text-white/45 transition hover:bg-white/[0.06] hover:text-white lg:hidden"
              >
                <Menu className="h-[17px] w-[17px]" />
              </button>

              <div className="hidden items-center gap-2.5 sm:flex">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-20" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-300/80" />
                </span>

                <span className="text-[10px] font-semibold uppercase tracking-[0.17em] text-white/25">
                  Live economy
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <SoundControl />

              <div className="mr-2 hidden text-right sm:block">
                <p className="max-w-[180px] truncate text-[12px] font-medium text-white/75">
                  {userName || "Octoson User"}
                </p>

                <p className="mt-0.5 text-[9px] font-medium uppercase tracking-[0.13em] text-white/20">
                  Server üzvü
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
                  className="ml-1 rounded-xl border border-white/[0.07] bg-white/[0.02] px-3 py-2 text-[10px] font-medium text-white/30 transition duration-200 hover:border-white/[0.12] hover:bg-white/[0.05] hover:text-white/70"
                >
                  Çıxış
                </button>
              </form>
            </div>
          </div>
        </header>

        <main className="min-h-screen pt-[72px]">
          <motion.div
            initial={{ opacity: 0, y: 7 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.35,
              ease: [0.22, 1, 0.36, 1],
            }}
            className="mx-auto w-full max-w-[1560px] px-4 py-7 sm:px-7 sm:py-9 lg:px-9 lg:py-10"
          >
            {children}
          </motion.div>
        </main>
      </div>
    </div>
    </OctosonAudioProvider>
  );
}
