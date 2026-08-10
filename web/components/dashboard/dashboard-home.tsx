"use client";

import Link from "next/link";
import { motion } from "motion/react";
import {
  ArrowUpRight,
  Banknote,
  Boxes,
  ChevronRight,
  CircleUserRound,
  Crown,
  Gamepad2,
  Gem,
  Globe2,
  Landmark,
  ShoppingBag,
  Sparkles,
  Trophy,
  WalletCards,
  Zap,
} from "lucide-react";

type Props = {
  name?: string | null;
  image?: string | null;
  wallet: number;
  bank: number;
  level: number;
  xp: number;
  prestige: number;
  rank: string;
};

const systems = [
  {
    href: "/dashboard/casino",
    title: "Casino",
    subtitle: "Mines, Crash və daha çox",
    icon: Gamepad2,
    tag: "PLAY",
  },
  {
    href: "/dashboard/bank",
    title: "Bank",
    subtitle: "Aura balansını idarə et",
    icon: Landmark,
    tag: "MONEY",
  },
  {
    href: "/dashboard/market",
    title: "Market",
    subtitle: "Əşyalar və kolleksiyalar",
    icon: ShoppingBag,
    tag: "TRADE",
  },
  {
    href: "/dashboard/world",
    title: "World",
    subtitle: "Biznes, əmlak və missiyalar",
    icon: Globe2,
    tag: "EXPLORE",
  },
];

const secondarySystems = [
  {
    href: "/dashboard/inventory",
    title: "İnventar",
    icon: Boxes,
  },
  {
    href: "/dashboard/leaderboard",
    title: "Leaderboard",
    icon: Trophy,
  },
  {
    href: "/dashboard/profile",
    title: "Profil",
    icon: CircleUserRound,
  },
];

function number(value: number) {
  return Math.max(0, Math.floor(value)).toLocaleString("en-US");
}

export default function DashboardHome({
  name,
  image,
  wallet,
  bank,
  level,
  xp,
  prestige,
  rank,
}: Props) {
  const total = wallet + bank;

  /*
   * The bot's exact XP progression can be connected later.
   * For now this only provides a visual level-progress indicator.
   */
  const xpTarget = Math.max(100, level * 100);
  const xpProgress = Math.min(100, Math.max(3, (xp / xpTarget) * 100));

  return (
    <div className="pb-10">
      {/* TOP INTRO */}
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"
      >
        <div>
          <div className="flex items-center gap-2">
            <span className="h-1 w-1 rounded-full bg-cyan-200/80" />

            <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-cyan-100/45">
              Dashboard
            </p>
          </div>

          <h1 className="mt-3 text-[27px] font-semibold tracking-[-0.035em] text-white sm:text-[32px]">
            Xoş gəldin, {name || "Octoson user"}
          </h1>

          <p className="mt-2 max-w-xl text-[12px] leading-5 text-white/25">
            Aura economy, status və bütün Octoson sistemlərin bir yerdə.
          </p>
        </div>

        <Link
          href="/dashboard/profile"
          className="group flex w-fit items-center gap-2 rounded-xl border border-white/[0.065] bg-white/[0.022] px-3.5 py-2.5 text-[10px] font-medium text-white/35 transition hover:border-white/[0.11] hover:bg-white/[0.045] hover:text-white/65"
        >
          Profilə bax
          <ArrowUpRight className="h-3 w-3 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
        </Link>
      </motion.section>

      {/* HERO GRID */}
      <section className="mt-7 grid gap-4 xl:grid-cols-[1.55fr_.8fr]">
        {/* WEALTH */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.04, duration: 0.4 }}
          className="group relative min-h-[335px] overflow-hidden rounded-[24px] border border-white/[0.07] bg-[#09090c]"
        >
          {/* glow */}
          <div className="pointer-events-none absolute -right-32 -top-44 h-[440px] w-[440px] rounded-full bg-cyan-200/[0.075] blur-[100px]" />
          <div className="pointer-events-none absolute -bottom-48 left-[25%] h-[340px] w-[340px] rounded-full bg-blue-500/[0.035] blur-[100px]" />

          {/* subtle radial lines */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.035]"
            style={{
              backgroundImage:
                "radial-gradient(circle at 80% 20%, rgba(255,255,255,.8) 1px, transparent 1px)",
              backgroundSize: "22px 22px",
            }}
          />

          <div className="relative flex h-full flex-col p-6 sm:p-8">
            <div className="flex items-start justify-between gap-5">
              <div>
                <div className="flex items-center gap-2 text-white/28">
                  <WalletCards className="h-3.5 w-3.5" />

                  <p className="text-[10px] font-medium">
                    Ümumi sərvət
                  </p>
                </div>

                <div className="mt-5 flex flex-wrap items-end gap-x-3 gap-y-1">
                  <motion.p
                    initial={{ opacity: 0, scale: 0.97 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.12, duration: 0.35 }}
                    className="text-[43px] font-semibold leading-none tracking-[-0.055em] text-white sm:text-[56px]"
                  >
                    {number(total)}
                  </motion.p>

                  <span className="pb-1 text-[13px] font-semibold tracking-[-0.02em] text-cyan-100/75">
                    AURA
                  </span>
                </div>

                <p className="mt-4 text-[10px] text-white/18">
                  Wallet və bank hesabının ümumi dəyəri
                </p>
              </div>

              <div className="hidden h-[48px] w-[48px] items-center justify-center rounded-[15px] border border-cyan-100/[0.09] bg-cyan-100/[0.035] sm:flex">
                <Gem
                  className="h-[19px] w-[19px] text-cyan-100/60"
                  strokeWidth={1.6}
                />
              </div>
            </div>

            <div className="mt-auto grid gap-3 pt-9 sm:grid-cols-2">
              <BalanceCard
                label="Wallet"
                value={wallet}
                icon={WalletCards}
              />

              <BalanceCard
                label="Bank"
                value={bank}
                icon={Banknote}
                accent
              />
            </div>
          </div>
        </motion.div>

        {/* IDENTITY / LEVEL */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08, duration: 0.4 }}
          className="relative overflow-hidden rounded-[24px] border border-white/[0.07] bg-[#09090c] p-6"
        >
          <div className="pointer-events-none absolute right-[-70px] top-[-70px] h-[180px] w-[180px] rounded-full bg-cyan-200/[0.045] blur-[65px]" />

          <div className="relative flex items-center gap-3">
            <div className="relative">
              {image ? (
                <img
                  src={image}
                  alt=""
                  className="h-12 w-12 rounded-[14px] border border-white/[0.09] object-cover"
                />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-[14px] border border-white/[0.08] bg-white/[0.03]">
                  <CircleUserRound className="h-5 w-5 text-white/25" />
                </div>
              )}

              <div className="absolute -bottom-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-[7px] border-2 border-[#09090c] bg-cyan-100 px-1 text-[8px] font-bold text-black">
                {level}
              </div>
            </div>

            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold tracking-[-0.02em] text-white/80">
                {name || "Octoson User"}
              </p>

              <p className="mt-1 truncate text-[9px] font-medium text-white/25">
                {rank}
              </p>
            </div>
          </div>

          <div className="relative mt-7">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-[9px] font-medium uppercase tracking-[0.14em] text-white/20">
                  Səviyyə
                </p>

                <p className="mt-2 text-[30px] font-semibold tracking-[-0.045em] text-white/90">
                  {level}
                </p>
              </div>

              <div className="text-right">
                <p className="text-[9px] text-white/20">
                  XP
                </p>

                <p className="mt-1 text-[11px] font-medium text-white/45">
                  {number(xp)}
                </p>
              </div>
            </div>

            <div className="mt-4 h-[5px] overflow-hidden rounded-full bg-white/[0.045]">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${xpProgress}%` }}
                transition={{
                  delay: 0.35,
                  duration: 0.8,
                  ease: [0.22, 1, 0.36, 1],
                }}
                className="h-full rounded-full bg-gradient-to-r from-cyan-200/55 to-cyan-100"
              />
            </div>
          </div>

          <div className="relative mt-7 grid grid-cols-2 gap-2">
            <SmallStat
              icon={Crown}
              label="Prestige"
              value={String(prestige)}
            />

            <SmallStat
              icon={Zap}
              label="Status"
              value="Aktiv"
              accent
            />
          </div>
        </motion.div>
      </section>

      {/* SYSTEMS */}
      <section className="mt-9">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-white/18">
              Sistemlər
            </p>

            <h2 className="mt-2 text-[17px] font-semibold tracking-[-0.025em] text-white/80">
              Octoson-u idarə et
            </h2>
          </div>

          <div className="hidden items-center gap-1.5 text-[9px] text-white/15 sm:flex">
            <Sparkles className="h-3 w-3" />
            Discord ilə sinxron
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {systems.map((system, index) => (
            <SystemCard
              key={system.href}
              {...system}
              index={index}
            />
          ))}
        </div>
      </section>

      {/* LOWER GRID */}
      <section className="mt-4 grid gap-4 xl:grid-cols-[1.35fr_.65fr]">
        {/* ACCOUNT OVERVIEW */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18 }}
          className="rounded-[20px] border border-white/[0.06] bg-white/[0.018] p-5"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-white/18">
                Hesab
              </p>

              <p className="mt-1.5 text-[13px] font-medium text-white/60">
                Economy xülasəsi
              </p>
            </div>

            <div className="flex h-8 w-8 items-center justify-center rounded-[10px] border border-white/[0.06] bg-white/[0.025]">
              <Sparkles className="h-3.5 w-3.5 text-white/25" />
            </div>
          </div>

          <div className="mt-5 grid gap-px overflow-hidden rounded-[14px] border border-white/[0.055] bg-white/[0.055] sm:grid-cols-3">
            <OverviewItem
              label="Net Worth"
              value={`${number(total)} Aura`}
            />

            <OverviewItem
              label="Level"
              value={`Lv. ${level}`}
            />

            <OverviewItem
              label="Prestige"
              value={String(prestige)}
            />
          </div>
        </motion.div>

        {/* MORE */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.22 }}
          className="rounded-[20px] border border-white/[0.06] bg-white/[0.018] p-5"
        >
          <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-white/18">
            Daha çox
          </p>

          <div className="mt-3 space-y-1">
            {secondarySystems.map((item) => {
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="group flex items-center gap-3 rounded-[11px] px-2 py-2.5 transition hover:bg-white/[0.025]"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-[9px] border border-white/[0.055] bg-black/20">
                    <Icon className="h-3.5 w-3.5 text-white/25 transition group-hover:text-cyan-100/55" />
                  </div>

                  <span className="flex-1 text-[11px] font-medium text-white/35 transition group-hover:text-white/65">
                    {item.title}
                  </span>

                  <ChevronRight className="h-3 w-3 text-white/10 transition group-hover:translate-x-0.5 group-hover:text-white/25" />
                </Link>
              );
            })}
          </div>
        </motion.div>
      </section>
    </div>
  );
}

function BalanceCard({
  label,
  value,
  icon: Icon,
  accent = false,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-[15px] border p-4 ${
        accent
          ? "border-cyan-100/[0.085] bg-cyan-100/[0.025]"
          : "border-white/[0.06] bg-black/25"
      }`}
    >
      <div className="flex items-center gap-2">
        <Icon
          className={`h-3.5 w-3.5 ${
            accent ? "text-cyan-100/45" : "text-white/22"
          }`}
        />

        <span className="text-[9px] font-medium text-white/22">
          {label}
        </span>
      </div>

      <p className="mt-2.5 text-[16px] font-semibold tracking-[-0.025em] text-white/65">
        {number(value)}

        <span className="ml-1.5 text-[8px] font-semibold text-white/15">
          AURA
        </span>
      </p>
    </div>
  );
}

function SmallStat({
  icon: Icon,
  label,
  value,
  accent = false,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-[13px] border border-white/[0.055] bg-black/20 p-3.5">
      <div className="flex items-center gap-2">
        <Icon
          className={`h-3 w-3 ${
            accent ? "text-emerald-300/55" : "text-white/20"
          }`}
        />

        <span className="text-[8px] text-white/18">
          {label}
        </span>
      </div>

      <p className="mt-2 text-[12px] font-medium text-white/55">
        {value}
      </p>
    </div>
  );
}

function SystemCard({
  href,
  title,
  subtitle,
  icon: Icon,
  tag,
  index,
}: {
  href: string;
  title: string;
  subtitle: string;
  icon: React.ElementType;
  tag: string;
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 9 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        delay: 0.12 + index * 0.035,
        duration: 0.3,
      }}
    >
      <Link
        href={href}
        className="group relative block min-h-[150px] overflow-hidden rounded-[18px] border border-white/[0.06] bg-white/[0.018] p-5 transition duration-300 hover:-translate-y-0.5 hover:border-cyan-100/[0.11] hover:bg-white/[0.03]"
      >
        <div className="pointer-events-none absolute -right-16 -top-16 h-32 w-32 rounded-full bg-cyan-200/0 blur-[45px] transition duration-500 group-hover:bg-cyan-200/[0.04]" />

        <div className="relative flex items-start justify-between">
          <div className="flex h-9 w-9 items-center justify-center rounded-[11px] border border-white/[0.065] bg-black/20">
            <Icon className="h-[15px] w-[15px] text-white/30 transition duration-300 group-hover:text-cyan-100/65" />
          </div>

          <span className="text-[7px] font-bold tracking-[0.16em] text-white/12">
            {tag}
          </span>
        </div>

        <div className="relative mt-6">
          <p className="text-[13px] font-semibold tracking-[-0.015em] text-white/65 transition group-hover:text-white/90">
            {title}
          </p>

          <div className="mt-1.5 flex items-center justify-between gap-3">
            <p className="truncate text-[9px] text-white/18">
              {subtitle}
            </p>

            <ArrowUpRight className="h-3 w-3 shrink-0 text-white/10 transition duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-cyan-100/40" />
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

function OverviewItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="bg-[#08080a] px-4 py-4">
      <p className="text-[8px] font-medium uppercase tracking-[0.11em] text-white/15">
        {label}
      </p>

      <p className="mt-2 truncate text-[11px] font-medium text-white/48">
        {value}
      </p>
    </div>
  );
}
