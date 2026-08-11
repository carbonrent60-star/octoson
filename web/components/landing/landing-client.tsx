"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowRight,
  BadgeCheck,
  Banknote,
  Boxes,
  ChevronRight,
  Crown,
  Dices,
  ExternalLink,
  Gamepad2,
  Gem,
  Radio,
  ShieldCheck,
  Sparkles,
  Trophy,
  Users,
  WalletCards,
  Zap,
} from "lucide-react";

type Props = {
  loggedIn: boolean;
  userName: string | null;
  userImage: string | null;
};

const features = [
  {
    number: "01",
    title: "Casino",
    eyebrow: "PLAY",
    text: "Slots, Mines, Blackjack və digər oyunlarda Aura-nı sına.",
    href: "/dashboard/casino",
    icon: Dices,
  },
  {
    number: "02",
    title: "World",
    eyebrow: "BUILD",
    text: "İş seç, missiyalar tamamla, biznes və əmlak alaraq öz dünyanı qur.",
    href: "/dashboard/world",
    icon: Gem,
  },
  {
    number: "03",
    title: "Bank",
    eyebrow: "MANAGE",
    text: "Aura balansını, bankını və economy resurslarını idarə et.",
    href: "/dashboard/bank",
    icon: Banknote,
  },
  {
    number: "04",
    title: "Market",
    eyebrow: "TRADE",
    text: "Economy daxilində əşyaları və xüsusi imkanları kəşf et.",
    href: "/dashboard/market",
    icon: Boxes,
  },
  {
    number: "05",
    title: "Inventory",
    eyebrow: "COLLECT",
    text: "Topladığın əşyaları, mükafatları və profil aktivlərini saxla.",
    href: "/dashboard/inventory",
    icon: Gamepad2,
  },
  {
    number: "06",
    title: "Leaderboard",
    eyebrow: "COMPETE",
    text: "October community-də Aura və status yarışının zirvəsinə qalx.",
    href: "/dashboard/leaderboard",
    icon: Trophy,
  },
];

function DiscordIcon({
  className = "h-4 w-4",
}: {
  className?: string;
}) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M19.5 5.34A17.1 17.1 0 0 0 15.27 4l-.52 1.06a15.6 15.6 0 0 0-5.5 0L8.73 4A17.2 17.2 0 0 0 4.5 5.35C1.82 9.3 1.1 13.16 1.46 16.97a17.4 17.4 0 0 0 5.2 2.63l1.28-1.76a10.6 10.6 0 0 1-2.02-.97l.5-.38c3.9 1.8 8.13 1.8 11.98 0l.5.38c-.65.38-1.33.7-2.02.97l1.28 1.76a17.3 17.3 0 0 0 5.2-2.63c.43-4.42-.73-8.24-3.86-11.63ZM8.75 14.65c-1.17 0-2.13-1.08-2.13-2.4s.94-2.4 2.13-2.4c1.2 0 2.15 1.1 2.13 2.4 0 1.32-.94 2.4-2.13 2.4Zm6.5 0c-1.17 0-2.13-1.08-2.13-2.4s.94-2.4 2.13-2.4c1.2 0 2.15 1.1 2.13 2.4 0 1.32-.93 2.4-2.13 2.4Z" />
    </svg>
  );
}

function TikTokIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
      <path d="M19.32 6.18a5.2 5.2 0 0 1-3.03-.97 5.2 5.2 0 0 1-2.05-3.14h-3.31v13.46a2.8 2.8 0 1 1-2.8-2.8c.28 0 .55.04.8.12V9.48a6.15 6.15 0 1 0 5.31 6.09V8.74a8.48 8.48 0 0 0 5.08 1.69V6.18Z" />
    </svg>
  );
}

function BotAvatar() {
  return (
    <div className="relative shrink-0">
      <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-cyan-100/[0.15] bg-gradient-to-br from-[#17262a] to-[#07090a] shadow-[0_0_28px_rgba(165,243,252,.08)]">
        <span className="text-[15px] font-black tracking-[-0.08em] text-cyan-100">
          O
        </span>
      </div>

      <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-[3px] border-[#111216] bg-emerald-400" />
    </div>
  );
}

function BotDemo({
  userImage,
}: {
  userImage: string | null;
}) {
  const [view, setView] = useState<"discord" | "web">("discord");
  const [demoIndex, setDemoIndex] = useState(0);
  const [demoPhase, setDemoPhase] = useState<
    "command" | "typing" | "response" | "exit"
  >("command");

  const demoCommands = [
    {
      command: "/profile",
      eyebrow: "OCTOSON PROFILE",
      title: "BAKHISHOV",
      status: "ACTIVE",
      kind: "profile",
    },
    {
      command: "/earn daily",
      eyebrow: "DAILY REWARD",
      title: "Gündəlik Aura hazırdır",
      status: "+2,500",
      kind: "daily",
    },
    {
      command: "/casino slots",
      eyebrow: "OCTOSON CASINO",
      title: "Slots nəticəsi",
      status: "WIN",
      kind: "slots",
    },
    {
      command: "/leaderboard",
      eyebrow: "AURA LEADERBOARD",
      title: "Server sıralaması",
      status: "TOP 3",
      kind: "leaderboard",
    },
    {
      command: "/wallet",
      eyebrow: "AURA WALLET",
      title: "BAKHISHOV",
      status: "LIVE",
      kind: "wallet",
    },
    {
      command: "/inventory",
      eyebrow: "INVENTORY",
      title: "Sənin əşyaların",
      status: "8 ITEMS",
      kind: "inventory",
    },
  ] as const;

  const activeDemo = demoCommands[demoIndex];

  useEffect(() => {
    if (view !== "discord") return;

    let timeout: ReturnType<typeof setTimeout>;

    if (demoPhase === "command") {
      timeout = setTimeout(() => setDemoPhase("typing"), 850);
    } else if (demoPhase === "typing") {
      timeout = setTimeout(() => setDemoPhase("response"), 850);
    } else if (demoPhase === "response") {
      timeout = setTimeout(() => setDemoPhase("exit"), 3000);
    } else {
      timeout = setTimeout(() => {
        setDemoIndex((current) => (current + 1) % demoCommands.length);
        setDemoPhase("command");
      }, 500);
    }

    return () => clearTimeout(timeout);
  }, [demoPhase, view, demoCommands.length]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        delay: 0.35,
        duration: 0.7,
        ease: [0.22, 1, 0.36, 1],
      }}
      className="relative mx-auto w-full max-w-[590px]"
    >
      <div className="pointer-events-none absolute -inset-16 hidden rounded-full bg-cyan-300/[0.055] blur-[110px] sm:block" />

      {/* switcher */}
      <div className="relative z-20 mb-3 flex justify-end">
        <div className="flex rounded-[12px] border border-white/[0.07] bg-[#090a0c]/90 p-1 shadow-xl">
          <button
            type="button"
            onClick={() => setView("discord")}
            className={`relative rounded-[9px] px-3 py-1.5 text-[9px] font-semibold transition ${
              view === "discord"
                ? "bg-white/[0.08] text-white/75"
                : "text-white/25 hover:text-white/50"
            }`}
          >
            Discord
            {view === "discord" && (
              <motion.div
                layoutId="demo-tab"
                className="absolute inset-x-3 -bottom-1 h-px bg-cyan-200/60"
              />
            )}
          </button>

          <button
            type="button"
            onClick={() => setView("web")}
            className={`relative rounded-[9px] px-3 py-1.5 text-[9px] font-semibold transition ${
              view === "web"
                ? "bg-white/[0.08] text-white/75"
                : "text-white/25 hover:text-white/50"
            }`}
          >
            Website
            {view === "web" && (
              <motion.div
                layoutId="demo-tab"
                className="absolute inset-x-3 -bottom-1 h-px bg-cyan-200/60"
              />
            )}
          </button>
        </div>
      </div>

      <motion.div
        layout
        transition={{
          layout: {
            type: "spring",
            stiffness: 180,
            damping: 24,
            mass: 0.8,
          },
        }}
        className="relative"
      >
        <div className="pointer-events-none absolute inset-x-[12%] -bottom-10 h-28 rounded-full bg-cyan-300/[0.04] blur-[55px]" />

        {view === "discord" ? (
          <motion.div
            key="discord"
            initial={{ opacity: 0, x: 14, scale: 0.985 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -14 }}
            layout
            transition={{
              duration: 0.42,
              ease: [0.22, 1, 0.36, 1],
              layout: { type: "spring", stiffness: 180, damping: 24 },
            }}
            className="relative overflow-hidden rounded-[26px] border border-white/[0.085] bg-[#0b0c0f]/95 shadow-[0_35px_100px_rgba(0,0,0,.5)]"
          >
            {/* Discord header */}
            <div className="flex h-12 items-center justify-between border-b border-white/[0.055] bg-white/[0.018] px-4 sm:px-5">
              <div className="flex items-center gap-2">
                <span className="text-white/18">#</span>
                <span className="text-[10px] font-semibold text-white/55">
                  octoson-commands
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-white/15" />
                <span className="h-1.5 w-1.5 rounded-full bg-white/15" />
                <span className="h-1.5 w-1.5 rounded-full bg-white/15" />
              </div>
            </div>

            <div className="p-4 sm:p-5">
              {/* BAKHISHOV */}
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15, duration: 0.4 }}
                className="flex gap-3"
              >
                {userImage ? (
                  <div className="relative h-9 w-9 shrink-0">
                    <img
                      src={userImage}
                      alt="BAKHISHOV"
                      className="h-9 w-9 rounded-full object-cover"
                    />
                    <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-[3px] border-[#0b0c0f] bg-emerald-400" />
                  </div>
                ) : (
                  <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-white/[0.09] to-white/[0.025] text-[9px] font-bold text-white/50">
                    B
                    <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-[3px] border-[#0b0c0f] bg-emerald-400" />
                  </div>
                )}

                <div className="min-w-0 pt-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-semibold text-white/65">
                      BAKHISHOV
                    </span>

                    <span className="rounded-[4px] bg-cyan-100/[0.09] px-1.5 py-0.5 text-[7px] font-bold text-cyan-100/60">
                      OCTO
                    </span>

                    <span className="text-[8px] text-white/15">
                      08:22
                    </span>
                  </div>

                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.35, duration: 0.35 }}
                    className="mt-2 inline-flex items-center gap-1.5 rounded-[7px] bg-[#5865F2]/15 px-2.5 py-1.5 text-[10px] font-medium text-[#b7bcff]"
                  >
                    <AnimatePresence mode="wait" initial={false}>
                      <motion.span
                        key={activeDemo.command}
                        initial={{ opacity: 0, y: 4, filter: "blur(2px)" }}
                        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                        exit={{ opacity: 0, y: -4, filter: "blur(2px)" }}
                        transition={{
                          duration: 0.32,
                          ease: [0.22, 1, 0.36, 1],
                        }}
                      >
                        {activeDemo.command}
                      </motion.span>
                    </AnimatePresence>
                  </motion.div>
                </div>
              </motion.div>

              {/* typing */}
              <motion.div
                layout
                className="ml-12"
                animate={{
                  height: demoPhase === "typing" ? 26 : 8,
                  marginTop: demoPhase === "typing" ? 16 : 8,
                }}
                transition={{
                  duration: 0.38,
                  ease: [0.22, 1, 0.36, 1],
                }}
              >
                <AnimatePresence mode="wait">
                  {demoPhase === "typing" && (
                    <motion.div
                      key={`typing-${demoIndex}`}
                      initial={{ opacity: 0, y: 5, filter: "blur(2px)" }}
                      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                      exit={{ opacity: 0, y: -4, filter: "blur(2px)" }}
                      transition={{
                        duration: 0.28,
                        ease: [0.22, 1, 0.36, 1],
                      }}
                      className="flex items-center gap-1"
                    >
                      {[0, 1, 2].map((dot) => (
                        <motion.span
                          key={dot}
                          animate={{
                            y: [0, -3, 0],
                            opacity: [0.25, 0.8, 0.25],
                          }}
                          transition={{
                            duration: 0.7,
                            repeat: Infinity,
                            ease: "easeInOut",
                            delay: dot * 0.14,
                          }}
                          className="h-1 w-1 rounded-full bg-white/40"
                        />
                      ))}

                      <span className="ml-1 text-[8px] text-white/18">
                        Octoson cavab verir
                      </span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>

              {/* bot */}
              <motion.div
                layout
                initial={false}
                animate={{
                  opacity: demoPhase === "response" ? 1 : 0,
                  y:
                    demoPhase === "response"
                      ? 0
                      : demoPhase === "exit"
                        ? -6
                        : 8,
                  scale: demoPhase === "response" ? 1 : 0.992,
                  height: demoPhase === "response" ? "auto" : 0,
                  marginTop: demoPhase === "response" ? 12 : 0,
                }}
                transition={{
                  opacity: {
                    duration: demoPhase === "exit" ? 0.3 : 0.42,
                    ease: [0.22, 1, 0.36, 1],
                  },
                  y: {
                    duration: 0.42,
                    ease: [0.22, 1, 0.36, 1],
                  },
                  scale: {
                    duration: 0.42,
                    ease: [0.22, 1, 0.36, 1],
                  },
                  height: {
                    duration: 0.48,
                    ease: [0.22, 1, 0.36, 1],
                  },
                  marginTop: {
                    duration: 0.42,
                    ease: [0.22, 1, 0.36, 1],
                  },
                  layout: {
                    type: "spring",
                    stiffness: 170,
                    damping: 24,
                  },
                }}
                className={`flex origin-top gap-3 overflow-hidden ${
                  demoPhase === "response"
                    ? "pointer-events-auto"
                    : "pointer-events-none"
                }`}
              >
                <BotAvatar />

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] font-semibold text-cyan-100/80">
                      Octoson
                    </span>

                    <span className="flex items-center gap-1 rounded-[4px] bg-[#5865F2] px-1.5 py-[2px] text-[6px] font-bold text-white">
                      <span className="text-[7px] leading-none">✓</span>
                      APP
                    </span>

                    <span className="text-[8px] text-white/15">
                      08:22
                    </span>
                  </div>

                  <div className="mt-2 overflow-hidden rounded-[9px] border-l-[3px] border-cyan-300/65 bg-white/[0.025]">
                    <div className="p-3.5 sm:p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-[7px] font-semibold uppercase tracking-[0.18em] text-cyan-100/35">
                            {activeDemo.eyebrow}
                          </p>

                          <div className="mt-1 flex items-center gap-2">
                            <Crown className="h-3.5 w-3.5 text-cyan-100/65" />
                            <span className="text-[11px] font-semibold text-white/75">
                              {activeDemo.title}
                            </span>
                          </div>
                        </div>

                        <span className="rounded-full border border-cyan-100/[0.08] bg-cyan-100/[0.025] px-2 py-1 text-[7px] font-semibold text-cyan-100/45">
                          {activeDemo.status}
                        </span>
                      </div>

                      {activeDemo.kind === "profile" && (
                        <>
                          <div className="mt-4 grid grid-cols-3 gap-2">
                            {[
                              ["Aura", "222,722"],
                              ["Səviyyə", "Lv. 1"],
                              ["Rank", "Yeni başlayan"],
                            ].map(([label, value]) => (
                              <motion.div
                                key={label}
                                whileHover={{ y: -2 }}
                                className="rounded-[9px] border border-white/[0.055] bg-black/20 p-2.5"
                              >
                                <span className="text-[7px] text-white/20">
                                  {label}
                                </span>
                                <p className="mt-1.5 truncate text-[9px] font-semibold text-white/65">
                                  {value}
                                </p>
                              </motion.div>
                            ))}
                          </div>

                          <div className="mt-3">
                            <div className="mb-1.5 flex justify-between text-[7px]">
                              <span className="text-white/20">XP PROGRESS</span>
                              <span className="text-cyan-100/35">5 / 100</span>
                            </div>

                            <div className="h-[3px] overflow-hidden rounded-full bg-white/[0.045]">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: "18%" }}
                                transition={{ duration: 0.9 }}
                                className="h-full rounded-full bg-gradient-to-r from-cyan-300/55 to-cyan-100"
                              />
                            </div>
                          </div>
                        </>
                      )}

                      {activeDemo.kind === "daily" && (
                        <div className="mt-4">
                          <div className="rounded-[10px] border border-emerald-300/[0.08] bg-emerald-300/[0.025] p-3">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-[7px] text-white/20">
                                  GÜNLÜK MÜKAFAT
                                </p>
                                <p className="mt-1.5 text-[15px] font-semibold text-white/75">
                                  +2,500 Aura
                                </p>
                              </div>

                              <Sparkles className="h-5 w-5 text-emerald-200/55" />
                            </div>
                          </div>

                          <div className="mt-2 flex gap-2">
                            <span className="rounded-full bg-white/[0.035] px-2.5 py-1 text-[7px] text-white/25">
                              +15 XP
                            </span>
                            <span className="rounded-full bg-white/[0.035] px-2.5 py-1 text-[7px] text-white/25">
                              Seriya: 4 gün
                            </span>
                          </div>
                        </div>
                      )}

                      {activeDemo.kind === "slots" && (
                        <div className="mt-4">
                          <div className="grid grid-cols-3 gap-2">
                            {["💎", "💎", "💎"].map((symbol, index) => (
                              <motion.div
                                key={index}
                                initial={{ scale: 0.7, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ delay: index * 0.1 }}
                                className="flex h-12 items-center justify-center rounded-[9px] border border-cyan-100/[0.07] bg-black/25 text-lg"
                              >
                                {symbol}
                              </motion.div>
                            ))}
                          </div>

                          <div className="mt-3 flex items-center justify-between">
                            <span className="text-[8px] text-white/22">
                              Mərc: 1,000 Aura
                            </span>
                            <span className="text-[9px] font-semibold text-emerald-200/60">
                              +4,500 Aura
                            </span>
                          </div>
                        </div>
                      )}

                      {activeDemo.kind === "leaderboard" && (
                        <div className="mt-4 space-y-1.5">
                          {[
                            ["01", "İBRA PRIME", "429,091"],
                            ["02", "BAKHISHOV", "222,722"],
                            ["03", "Javexia", "23,146"],
                          ].map(([place, name, aura]) => (
                            <motion.div
                              key={place}
                              whileHover={{ x: 2 }}
                              className="flex items-center justify-between rounded-[8px] border border-white/[0.045] bg-black/15 px-3 py-2"
                            >
                              <div className="flex items-center gap-2.5">
                                <span className="text-[7px] font-bold text-cyan-100/35">
                                  {place}
                                </span>
                                <span className="text-[8px] font-medium text-white/55">
                                  {name}
                                </span>
                              </div>
                              <span className="text-[8px] text-white/25">
                                {aura}
                              </span>
                            </motion.div>
                          ))}
                        </div>
                      )}

                      {activeDemo.kind === "wallet" && (
                        <div className="mt-4 grid grid-cols-2 gap-2">
                          <motion.div
                            whileHover={{ y: -2 }}
                            className="rounded-[10px] border border-cyan-100/[0.07] bg-cyan-100/[0.02] p-3"
                          >
                            <p className="text-[7px] uppercase tracking-[0.12em] text-white/20">
                              Wallet
                            </p>
                            <p className="mt-2 text-[13px] font-semibold text-white/70">
                              222,722
                            </p>
                            <p className="mt-1 text-[7px] text-cyan-100/30">
                              Aura
                            </p>
                          </motion.div>

                          <motion.div
                            whileHover={{ y: -2 }}
                            className="rounded-[10px] border border-white/[0.055] bg-black/20 p-3"
                          >
                            <p className="text-[7px] uppercase tracking-[0.12em] text-white/20">
                              Bank
                            </p>
                            <p className="mt-2 text-[13px] font-semibold text-white/70">
                              28,632
                            </p>
                            <p className="mt-1 text-[7px] text-white/20">
                              Aura
                            </p>
                          </motion.div>
                        </div>
                      )}

                      {activeDemo.kind === "inventory" && (
                        <div className="mt-4 grid grid-cols-4 gap-2">
                          {[
                            ["📦", "Chest"],
                            ["🔑", "Key"],
                            ["💠", "Badge"],
                            ["👑", "Title"],
                          ].map(([icon, label]) => (
                            <motion.div
                              key={label}
                              whileHover={{ y: -2 }}
                              className="rounded-[9px] border border-white/[0.05] bg-black/20 p-2 text-center"
                            >
                              <div className="text-base">{icon}</div>
                              <p className="mt-1 text-[6px] text-white/22">
                                {label}
                              </p>
                            </motion.div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>

            <div className="border-t border-white/[0.05] px-5 py-3">
              <div className="flex items-center justify-between">
                <span className="text-[7px] font-medium uppercase tracking-[0.18em] text-white/12">
                  October Server
                </span>

                <div className="flex items-center gap-1.5">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-25" />
                    <span className="relative h-1.5 w-1.5 rounded-full bg-emerald-300/80" />
                  </span>
                  <span className="text-[7px] text-emerald-300/40">
                    ONLINE
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="web"
            initial={{ opacity: 0, x: -14, scale: 0.985 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            transition={{ duration: 0.32 }}
            className="relative overflow-hidden rounded-[26px] border border-white/[0.085] bg-[#090a0d]/95 shadow-[0_35px_100px_rgba(0,0,0,.5)]"
          >
            {/* fake browser */}
            <div className="flex h-12 items-center gap-3 border-b border-white/[0.055] bg-white/[0.018] px-4">
              <div className="flex gap-1.5">
                <span className="h-2 w-2 rounded-full bg-white/10" />
                <span className="h-2 w-2 rounded-full bg-white/10" />
                <span className="h-2 w-2 rounded-full bg-white/10" />
              </div>

              <div className="flex h-6 flex-1 items-center justify-center rounded-[7px] border border-white/[0.04] bg-black/20 text-[7px] text-white/18">
                october.app/dashboard
              </div>
            </div>

            <div className="flex min-h-[330px]">
              {/* mini sidebar */}
              <div className="hidden w-[108px] shrink-0 border-r border-white/[0.05] p-3 sm:block">
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-[7px] border border-cyan-100/[0.1] bg-cyan-100/[0.025] text-[8px] font-black text-cyan-50/70">
                    O
                  </div>
                  <span className="text-[7px] font-bold tracking-[0.08em] text-white/50">
                    OCTOSON
                  </span>
                </div>

                <div className="mt-6 space-y-1.5">
                  {["Overview", "Casino", "Bank", "World", "Market"].map(
                    (item, index) => (
                      <motion.div
                        key={item}
                        whileHover={{ x: 2 }}
                        className={`rounded-[7px] px-2 py-2 text-[7px] ${
                          index === 0
                            ? "border border-cyan-100/[0.07] bg-cyan-100/[0.025] text-cyan-50/55"
                            : "text-white/18"
                        }`}
                      >
                        {item}
                      </motion.div>
                    )
                  )}
                </div>
              </div>

              {/* dashboard */}
              <div className="min-w-0 flex-1 p-4 sm:p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[7px] font-semibold uppercase tracking-[0.2em] text-cyan-100/30">
                      OVERVIEW
                    </p>
                    <h3 className="mt-1.5 text-[16px] font-semibold tracking-[-0.03em] text-white/80">
                      Xoş gəldin, BAKHISHOV
                    </h3>
                    <p className="mt-1 text-[8px] text-white/20">
                      October economy profilin canlıdır.
                    </p>
                  </div>

                  {userImage ? (
                    <img
                      src={userImage}
                      alt=""
                      className="h-8 w-8 rounded-[9px] object-cover ring-1 ring-white/10"
                    />
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-white/[0.04] text-[8px] text-white/30">
                      B
                    </div>
                  )}
                </div>

                <div className="mt-5 grid grid-cols-3 gap-2">
                  {[
                    ["Aura", "222,722"],
                    ["Bank", "28,632"],
                    ["Level", "Lv. 1"],
                  ].map(([label, value], index) => (
                    <motion.div
                      key={label}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.08 * index }}
                      whileHover={{
                        y: -3,
                        scale: 1.015,
                      }}
                      className="rounded-[10px] border border-white/[0.055] bg-white/[0.018] p-3"
                    >
                      <p className="text-[7px] uppercase tracking-[0.12em] text-white/18">
                        {label}
                      </p>
                      <p className="mt-2 text-[11px] font-semibold text-white/65">
                        {value}
                      </p>
                    </motion.div>
                  ))}
                </div>

                <div className="mt-3 grid grid-cols-[1.35fr_.65fr] gap-2">
                  <motion.div
                    whileHover={{ y: -2 }}
                    className="relative overflow-hidden rounded-[11px] border border-white/[0.055] bg-white/[0.018] p-3"
                  >
                    <div className="absolute -right-10 -top-12 h-24 w-24 rounded-full bg-cyan-200/[0.045] blur-[35px]" />

                    <div className="relative">
                      <div className="flex items-center justify-between">
                        <p className="text-[7px] uppercase tracking-[0.13em] text-white/18">
                          Progression
                        </p>
                        <Zap className="h-3 w-3 text-cyan-100/35" />
                      </div>

                      <p className="mt-2 text-[10px] font-semibold text-white/60">
                        Yeni başlayan
                      </p>

                      <div className="mt-4 h-[4px] overflow-hidden rounded-full bg-white/[0.045]">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: "62%" }}
                          transition={{ duration: 1.1 }}
                          className="h-full rounded-full bg-gradient-to-r from-cyan-300/50 to-cyan-100/80"
                        />
                      </div>

                      <div className="mt-2 flex justify-between text-[6px] text-white/15">
                        <span>LEVEL 1</span>
                        <span>62%</span>
                      </div>
                    </div>
                  </motion.div>

                  <motion.div
                    whileHover={{ y: -2 }}
                    className="rounded-[11px] border border-cyan-100/[0.055] bg-cyan-100/[0.015] p-3"
                  >
                    <p className="text-[7px] uppercase tracking-[0.13em] text-white/18">
                      Server
                    </p>

                    <div className="mt-4 flex items-center gap-2">
                      <span className="relative flex h-2 w-2">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-25" />
                        <span className="relative h-2 w-2 rounded-full bg-emerald-300/75" />
                      </span>

                      <span className="text-[9px] font-semibold text-white/55">
                        Online
                      </span>
                    </div>

                    <p className="mt-3 text-[7px] leading-4 text-white/18">
                      Discord economy real-time sinxronlaşdırılır.
                    </p>
                  </motion.div>
                </div>

                <div className="mt-3 flex items-center justify-between rounded-[10px] border border-white/[0.045] bg-black/15 px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-3 w-3 text-cyan-100/35" />
                    <span className="text-[7px] text-white/25">
                      Son fəaliyyət
                    </span>
                  </div>

                  <span className="text-[7px] font-medium text-cyan-100/40">
                    +2,500 Aura
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </motion.div>

      {/* floating live card */}
      <motion.div
        initial={{ opacity: 0, x: 14 }}
        animate={{ opacity: 1, x: 0, y: [0, -4, 0] }}
        transition={{
          opacity: { delay: 1.7, duration: 0.4 },
          x: { delay: 1.7, duration: 0.4 },
          y: {
            delay: 2.1,
            duration: 4,
            repeat: Infinity,
            ease: "easeInOut",
          },
        }}
        className="absolute -right-2 top-10 hidden rounded-[14px] border border-cyan-100/[0.09] bg-[#0a0b0d]/90 px-3.5 py-2.5 shadow-2xl backdrop-blur-xl sm:block"
      >
        <div className="flex items-center gap-2">
          <Sparkles className="h-3 w-3 text-cyan-100/55" />
          <div>
            <p className="text-[7px] uppercase tracking-[0.15em] text-white/18">
              Live system
            </p>
            <p className="mt-0.5 text-[9px] font-semibold text-white/60">
              Discord ↔ Web
            </p>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function LandingClient({
  loggedIn,
  userName,
  userImage,
}: Props) {
  const [ready, setReady] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setReady(true));
  }, []);

  async function loginWithDiscord() {
    if (loginLoading) return;

    setLoginLoading(true);

    try {
      await signIn("discord", {
        callbackUrl: "/dashboard",
      });
    } catch {
      setLoginLoading(false);
    }
  }

  function discover() {
    document.getElementById("platform")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  function featureClick(
    event: React.MouseEvent<HTMLAnchorElement>
  ) {
    if (!loggedIn) {
      event.preventDefault();
      void loginWithDiscord();
    }
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#050507] text-white selection:bg-cyan-200/20">
      {/* AMBIENT BACKGROUND */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-[12%] top-[-320px] hidden h-[680px] w-[680px] rounded-full bg-cyan-300/[0.045] blur-[150px] sm:block" />
        <div className="absolute right-[-260px] top-[260px] hidden h-[680px] w-[680px] rounded-full bg-blue-500/[0.025] blur-[160px] sm:block" />

        <div
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)",
            backgroundSize: "72px 72px",
          }}
        />

        <div className="absolute inset-x-0 top-0 h-[360px] bg-gradient-to-b from-cyan-200/[0.018] to-transparent" />
      </div>

      {/* NAV */}
      <header className="relative z-30 mx-auto max-w-[1320px] px-4 sm:px-6 lg:px-8">
        <nav className="flex h-[76px] items-center justify-between border-b border-white/[0.06] sm:h-[88px]">
          <Link href="/" className="group flex items-center gap-3">
            <div className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-[13px] border border-cyan-100/[0.12] bg-cyan-100/[0.035] shadow-[inset_0_1px_0_rgba(255,255,255,.04)]">
              <span className="text-sm font-black tracking-[-0.06em] text-cyan-50">
                O
              </span>

              <div className="absolute inset-x-2 bottom-0 h-px bg-cyan-100/45" />
            </div>

            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-[14px] font-semibold tracking-[-0.02em]">
                  OCTOBER
                </span>

                <BadgeCheck className="h-3.5 w-3.5 text-cyan-100/55" />
              </div>

              <div className="mt-0.5 text-[7px] font-semibold uppercase tracking-[0.28em] text-white/22">
                powered by Octoson
              </div>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            <a
              href="https://www.tiktok.com/@umid.bagirovv"
              target="_blank"
              rel="noreferrer"
              className="hidden items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.025] px-3.5 py-2.5 text-[11px] font-medium text-white/40 transition hover:border-cyan-100/[0.1] hover:bg-white/[0.045] hover:text-white sm:flex"
            >
              <TikTokIcon />
              TikTok
              <ExternalLink className="h-3 w-3 opacity-35" />
            </a>

            {loggedIn ? (
              <Link
                href="/dashboard"
                className="flex items-center gap-2.5 rounded-xl border border-white/[0.08] bg-white/[0.04] px-2.5 py-2 transition hover:bg-white/[0.07]"
              >
                {userImage ? (
                  <img
                    src={userImage}
                    alt=""
                    className="h-7 w-7 rounded-lg object-cover"
                  />
                ) : (
                  <div className="h-7 w-7 rounded-lg bg-white/10" />
                )}

                <div className="hidden text-left sm:block">
                  <p className="max-w-[110px] truncate text-[9px] text-white/28">
                    {userName || "Discord"}
                  </p>

                  <p className="text-[11px] font-semibold">
                    Dashboard
                  </p>
                </div>

                <ChevronRight className="h-3.5 w-3.5 text-white/25" />
              </Link>
            ) : (
              <button
                type="button"
                onClick={loginWithDiscord}
                disabled={loginLoading}
                className="flex items-center gap-2 rounded-xl bg-white px-3.5 py-2.5 text-[11px] font-semibold text-black transition hover:bg-cyan-50 disabled:cursor-wait disabled:opacity-60 sm:px-4"
              >
                <DiscordIcon />
                {loginLoading
                  ? "Discord açılır..."
                  : "Discord ilə daxil ol"}
              </button>
            )}
          </div>
        </nav>
      </header>

      {/* HERO */}
      <section className="relative z-10 mx-auto max-w-[1320px] px-4 pb-20 pt-14 sm:px-6 sm:pb-28 sm:pt-20 lg:px-8 lg:pb-36 lg:pt-24">
        <div
          className={`transition-all duration-700 ${
            ready
              ? "translate-y-0 opacity-100"
              : "translate-y-5 opacity-0"
          }`}
        >
          <div className="grid items-center gap-16 lg:grid-cols-[1.02fr_.98fr] lg:gap-14">
            <div className="relative z-10">
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08, duration: 0.45 }}
                className="mb-7 flex flex-wrap items-center gap-2"
              >
                <div className="flex items-center gap-2 rounded-full border border-cyan-100/[0.09] bg-cyan-100/[0.025] px-3 py-1.5">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-25" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-300/80" />
                  </span>

                  <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-cyan-50/45">
                    October Community
                  </span>
                </div>

                <div className="rounded-full border border-white/[0.06] bg-white/[0.02] px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-white/25">
                  TikTok Live
                </div>

                <div className="rounded-full border border-white/[0.06] bg-white/[0.02] px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-white/25">
                  Looksmaxxing
                </div>
              </motion.div>

              <motion.p
                initial={{ opacity: 0, y: 7 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.14, duration: 0.45 }}
                className="mb-3 text-[10px] font-semibold uppercase tracking-[0.36em] text-cyan-100/40"
              >
                STATUS · AURA · COMMUNITY
              </motion.p>

              <motion.h1
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  delay: 0.18,
                  duration: 0.65,
                  ease: [0.22, 1, 0.36, 1],
                }}
                className="max-w-[780px] text-[3.65rem] font-semibold leading-[0.88] tracking-[-0.075em] sm:text-[5.5rem] lg:text-[6.45rem] xl:text-[7.1rem]"
              >
                OCTOBER

                <span className="mt-2 block bg-gradient-to-r from-white via-cyan-50 to-cyan-200/70 bg-clip-text text-transparent">
                  UNIVERSE.
                </span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 9 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.28, duration: 0.5 }}
                className="mt-7 max-w-xl text-[15px] leading-7 text-white/34 sm:text-[17px]"
              >
                October community üçün qurulmuş canlı economy.
                Discord-da Aura qazan, oyunlarda risk et, profilini
                böyüt və serverdə statusunu yüksəlt.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 9 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.34, duration: 0.5 }}
                className="mt-9 flex flex-col gap-3 sm:flex-row"
              >
                {loggedIn ? (
                  <Link
                    href="/dashboard"
                    className="group flex min-h-[50px] min-w-[200px] items-center justify-center gap-2 rounded-[14px] bg-white px-6 text-sm font-semibold text-black transition hover:bg-cyan-50"
                  >
                    Dashboard-a keç
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={loginWithDiscord}
                    disabled={loginLoading}
                    className="flex min-h-[50px] min-w-[215px] items-center justify-center gap-2 rounded-[14px] bg-white px-6 text-sm font-semibold text-black transition hover:bg-cyan-50 disabled:cursor-wait disabled:opacity-60"
                  >
                    <DiscordIcon className="h-[17px] w-[17px]" />

                    {loginLoading
                      ? "Discord açılır..."
                      : "Community-yə daxil ol"}
                  </button>
                )}

                <button
                  type="button"
                  onClick={discover}
                  className="group flex min-h-[50px] min-w-[170px] items-center justify-center gap-2 rounded-[14px] border border-white/[0.08] bg-white/[0.02] px-5 text-sm font-medium text-white/50 transition hover:border-cyan-100/[0.09] hover:bg-white/[0.045] hover:text-white"
                >
                  Kəşf et
                  <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </button>
              </motion.div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5, duration: 0.6 }}
                className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-white/[0.055] pt-6"
              >
                <div className="flex items-center gap-2 text-[10px] text-white/25">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-300/50" />
                  Discord ilə sinxron
                </div>

                <div className="flex items-center gap-2 text-[10px] text-white/25">
                  <Radio className="h-3.5 w-3.5 text-cyan-100/45" />
                  Live economy
                </div>

                <div className="flex items-center gap-2 text-[10px] text-white/25">
                  <Users className="h-3.5 w-3.5 text-white/35" />
                  October community
                </div>
              </motion.div>
            </div>

            <BotDemo userImage={userImage} />
          </div>
        </div>
      </section>

      {/* PLATFORM */}
      <section
        id="platform"
        className="relative z-10 border-t border-white/[0.055] bg-white/[0.006]"
      >
        <div className="mx-auto max-w-[1320px] px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.55 }}
            className="mb-12 flex flex-col justify-between gap-6 sm:flex-row sm:items-end"
          >
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.28em] text-cyan-100/35">
                OCTOSON PLATFORM
              </p>

              <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-[-0.045em] sm:text-4xl">
                Discord serverindən daha çox.
              </h2>
            </div>

            <p className="max-w-sm text-sm leading-6 text-white/28">
              October community üçün oyun, economy, status və progression
              bir platformada.
            </p>
          </motion.div>

          <div className="grid overflow-hidden rounded-[26px] border border-white/[0.065] bg-[#08080a] sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature, index) => {
              const Icon = feature.icon;

              return (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 15 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-40px" }}
                  transition={{
                    duration: 0.4,
                    delay: index * 0.045,
                  }}
                >
                  <Link
                    href={loggedIn ? feature.href : "#"}
                    onClick={featureClick}
                    className="group relative block min-h-[235px] border-b border-white/[0.05] p-6 transition duration-300 hover:bg-white/[0.025] sm:border-l sm:p-7"
                  >
                    <div className="pointer-events-none absolute -right-20 -top-20 h-40 w-40 rounded-full bg-cyan-200/0 blur-[55px] transition duration-500 group-hover:bg-cyan-200/[0.04]" />

                    <div className="relative flex items-start justify-between">
                      <div className="flex h-10 w-10 items-center justify-center rounded-[13px] border border-white/[0.065] bg-white/[0.022] transition duration-300 group-hover:border-cyan-100/[0.1] group-hover:bg-cyan-100/[0.025]">
                        <Icon className="h-[17px] w-[17px] text-white/30 transition duration-300 group-hover:scale-105 group-hover:text-cyan-100/60" />
                      </div>

                      <span className="text-[9px] font-semibold tracking-[0.18em] text-white/12">
                        {feature.number}
                      </span>
                    </div>

                    <div className="relative mt-10">
                      <p className="text-[8px] font-bold uppercase tracking-[0.22em] text-cyan-100/30">
                        {feature.eyebrow}
                      </p>

                      <h3 className="mt-2 text-lg font-semibold tracking-[-0.025em] text-white/80 transition group-hover:text-white">
                        {feature.title}
                      </h3>

                      <p className="mt-3 max-w-[300px] text-[12px] leading-5 text-white/25">
                        {feature.text}
                      </p>
                    </div>

                    <ArrowRight className="absolute bottom-7 right-7 h-4 w-4 -translate-x-1 text-white/10 opacity-0 transition duration-300 group-hover:translate-x-0 group-hover:text-cyan-100/45 group-hover:opacity-100" />
                  </Link>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CREATOR STRIP */}
      <section className="relative z-10 border-t border-white/[0.055]">
        <div className="mx-auto max-w-[1320px] px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="relative overflow-hidden rounded-[24px] border border-white/[0.065] bg-[#09090c] p-6 sm:p-8"
          >
            <div className="pointer-events-none absolute -right-28 -top-28 h-72 w-72 rounded-full bg-cyan-200/[0.045] blur-[90px]" />

            <div className="relative flex flex-col justify-between gap-8 md:flex-row md:items-center">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-[17px] border border-cyan-100/[0.09] bg-cyan-100/[0.025]">
                  <Crown className="h-5 w-5 text-cyan-100/50" />
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-semibold tracking-[-0.035em]">
                      October
                    </h3>

                    <BadgeCheck className="h-4 w-4 text-cyan-100/55" />
                  </div>

                  <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.18em] text-white/22">
                    TikTok Live · Creator · Community
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="rounded-[13px] border border-white/[0.055] bg-black/20 px-4 py-3">
                  <p className="text-[7px] uppercase tracking-[0.16em] text-white/15">
                    Platform
                  </p>
                  <p className="mt-1 text-[10px] font-semibold text-white/55">
                    Powered by Octoson
                  </p>
                </div>

                <a
                  href="https://www.tiktok.com/@umid.bagirovv"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-2 rounded-[13px] border border-white/[0.065] bg-white/[0.025] px-4 py-3 text-[10px] font-semibold text-white/45 transition hover:border-cyan-100/[0.1] hover:bg-white/[0.045] hover:text-white"
                >
                  <TikTokIcon />
                  @umid.bagirovv
                  <ExternalLink className="h-3 w-3 opacity-30" />
                </a>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="relative z-10 border-t border-white/[0.05]">
        <div className="mx-auto max-w-[1320px] px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.55 }}
            className="relative overflow-hidden rounded-[28px] border border-cyan-100/[0.065] bg-[#09090c] px-6 py-14 text-center sm:px-12 sm:py-20"
          >
            <div className="pointer-events-none absolute left-1/2 top-[-250px] hidden h-[470px] w-[680px] -translate-x-1/2 rounded-full bg-cyan-200/[0.055] blur-[120px] sm:block" />

            <div className="relative">
              <Crown className="mx-auto h-5 w-5 text-cyan-100/40" />

              <p className="mt-5 text-[9px] font-bold uppercase tracking-[0.3em] text-cyan-100/30">
                OCTOBER × OCTOSON
              </p>

              <h2 className="mx-auto mt-4 max-w-3xl text-4xl font-semibold leading-[0.98] tracking-[-0.055em] sm:text-5xl lg:text-6xl">
                Aura sadəcə rəqəm deyil.

                <span className="block text-white/25">
                  Serverdə statusundur.
                </span>
              </h2>

              <p className="mx-auto mt-6 max-w-lg text-sm leading-6 text-white/27">
                Discord hesabınla daxil ol və October economy-də
                progression-ını davam etdir.
              </p>

              <div className="mt-8 flex justify-center">
                {loggedIn ? (
                  <Link
                    href="/dashboard"
                    className="flex min-h-[48px] items-center gap-2 rounded-[14px] bg-white px-6 text-sm font-semibold text-black transition hover:bg-cyan-50"
                  >
                    Dashboard
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={loginWithDiscord}
                    disabled={loginLoading}
                    className="flex min-h-[48px] items-center gap-2 rounded-[14px] bg-white px-6 text-sm font-semibold text-black transition hover:bg-cyan-50 disabled:cursor-wait disabled:opacity-60"
                  >
                    <DiscordIcon />
                    {loginLoading
                      ? "Discord açılır..."
                      : "Discord ilə daxil ol"}
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="relative z-10 border-t border-white/[0.05]">
        <div className="mx-auto flex max-w-[1320px] flex-col gap-5 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <div>
            <p className="text-xs font-semibold text-white/50">
              OCTOBER × OCTOSON
            </p>

            <p className="mt-1 text-[9px] text-white/15">
              Community economy platform
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-5 text-[10px] text-white/22">
            <a
              href="https://www.tiktok.com/@umid.bagirovv"
              target="_blank"
              rel="noreferrer"
              className="transition hover:text-white/60"
            >
              TikTok
            </a>

            <Link
              href="/privacy"
              className="transition hover:text-white/60"
            >
              Privacy
            </Link>

            <Link
              href="/legal"
              className="transition hover:text-white/60"
            >
              Legal
            </Link>

            <Link
              href="/impressum"
              className="transition hover:text-white/60"
            >
              Impressum
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
