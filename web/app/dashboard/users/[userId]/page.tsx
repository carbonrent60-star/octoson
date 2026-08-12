import type { CSSProperties } from "react";
import Link from "next/link";
import AvatarAmbient from "@/components/profile/avatar-ambient";
import VerifiedBadge from "@/components/profile/verified-badge";
import PrimeBadge from "@/components/profile/prime-badge";
import { auth } from "@/auth";
import { notFound, redirect } from "next/navigation";
import {
  Activity,
  ArrowLeft,
  Banknote,
  Coins,
  Crown,
  Gamepad2,
  Shield,
  Sparkles,
  Trophy,
  UserRound,
} from "lucide-react";

import {
  getOctosonPublicActivity,
  getOctosonPublicProfile,
  getOctosonUser,
  getOctosonAppearance,
} from "@/lib/octoson";

import {
  getOctosonGuildMembers,
} from "@/lib/discord-server";

export const dynamic = "force-dynamic";

function formatNumber(value: number) {
  return Math.floor(value).toLocaleString("en-US");
}

function formatSigned(value: number) {
  const rounded = Math.floor(value);

  return `${rounded > 0 ? "+" : ""}${rounded.toLocaleString(
    "en-US"
  )}`;
}

function cleanRank(rank: string) {
  return rank.replace(
    /^[\p{Extended_Pictographic}\uFE0F\s]+/u,
    ""
  );
}

function prettyType(type: string) {
  return type
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

const casinoTypes = new Set([
  "slots",
  "risk",
  "coinflip",
  "dice",
  "roulette",
  "blackjack",
  "crash",
  "mines",
  "tower",
  "higherlower",
  "wheel",
  "lottery",
  "jackpot",
  "rps",
  "baccarat",
  "poker",
  "horse",
  "penalty",
]);

export default async function PublicUserPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const session = await auth();

  if (!session?.user?.discordId) {
    redirect("/");
  }

  const { userId } = await params;

  const [currentUser, profile, transactions, members] =
    await Promise.all([
      getOctosonUser(session.user.discordId),
      getOctosonPublicProfile(userId),
      getOctosonPublicActivity(300, userId),
      getOctosonGuildMembers([userId]),
    ]);

  if (!currentUser) {
    redirect("/not-member");
  }

  if (!profile) {
    notFound();
  }

  const member = members[userId];

  const displayName =
    member?.name ?? `İstifadəçi ${userId.slice(-4)}`;

  const {
    gradient: profileGradient,
    bannerAnimation,
    primaryColor,
    secondaryColor,
    glowIntensity,
  } = getOctosonAppearance(
    profile.rawProfile
  );

  const casinoTransactions = transactions.filter(
    (transaction) => casinoTypes.has(transaction.type)
  );

  const casinoNet = casinoTransactions.reduce(
    (sum, transaction) => sum + transaction.amount,
    0
  );

  const casinoVolume = casinoTransactions.reduce(
    (sum, transaction) =>
      sum + Math.abs(transaction.amount),
    0
  );

  const biggestPositive = transactions.reduce(
    (biggest, transaction) =>
      transaction.amount > biggest
        ? transaction.amount
        : biggest,
    0
  );

  const winRate =
    profile.gamesPlayed > 0
      ? Math.round(
          (profile.gamesWon / profile.gamesPlayed) * 100
        )
      : 0;

  return (
    <div className="mx-auto max-w-[1240px]">
      <Link
        href="/dashboard/activity"
        className="mb-5 inline-flex items-center gap-2 text-[10px] font-medium text-white/25 transition hover:text-white/60"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Fəaliyyətə qayıt
      </Link>

      <section
        data-verified={profile.verified ? "true" : "false"}
        data-profile-gradient={profileGradient}
        data-banner-animation={bannerAnimation}
        className={`relative overflow-hidden rounded-[26px] bg-[#09090c] p-5 sm:p-7 ${
          profile.verified
            ? "border border-cyan-100/[0.14] shadow-[0_30px_100px_rgba(34,211,238,.055)]"
            : "border border-white/[0.07]"
        }`}
        style={
          {
            "--profile-primary": primaryColor,
            "--profile-secondary": secondaryColor,
            "--profile-glow": String(glowIntensity / 100),
          } as CSSProperties
        }
      >
        {profile.verified ? (
          <>
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background: `
                  radial-gradient(
                    circle at 78% 15%,
                    color-mix(
                      in srgb,
                      var(--profile-primary)
                      calc(var(--profile-glow) * 18%),
                      transparent
                    ),
                    transparent 35%
                  ),
                  radial-gradient(
                    circle at 18% 90%,
                    color-mix(
                      in srgb,
                      var(--profile-secondary)
                      calc(var(--profile-glow) * 12%),
                      transparent
                    ),
                    transparent 34%
                  ),
                  linear-gradient(
                    135deg,
                    color-mix(
                      in srgb,
                      var(--profile-primary) 4%,
                      transparent
                    ),
                    transparent 46%,
                    color-mix(
                      in srgb,
                      var(--profile-secondary) 3%,
                      transparent
                    )
                  )
                `,
              }}
            />

            {bannerAnimation !== "none" ? (
              <div
                className="pointer-events-none absolute -right-20 -top-32 h-[390px] w-[390px] rounded-full blur-[110px]"
                style={{
                  background:
                    "color-mix(in srgb, var(--profile-primary) calc(var(--profile-glow) * 13%), transparent)",
                  animation:
                    bannerAnimation === "glow"
                      ? "pulse 3.8s ease-in-out infinite"
                      : bannerAnimation === "float"
                        ? "pulse 5.5s ease-in-out infinite"
                        : "pulse 7s ease-in-out infinite",
                }}
              />
            ) : null}

            <div
              className="pointer-events-none absolute -bottom-44 left-[18%] h-[340px] w-[340px] rounded-full blur-[100px]"
              style={{
                background:
                  "color-mix(in srgb, var(--profile-secondary) calc(var(--profile-glow) * 10%), transparent)",
              }}
            />

            <div
              className="pointer-events-none absolute inset-x-0 top-0 h-px"
              style={{
                background:
                  "linear-gradient(90deg, transparent, color-mix(in srgb, var(--profile-primary) 42%, transparent), transparent)",
              }}
            />

            <div
              className="pointer-events-none absolute inset-0 opacity-[0.025]"
              style={{
                backgroundImage:
                  "radial-gradient(circle at 80% 20%, rgba(255,255,255,.8) 1px, transparent 1px)",
                backgroundSize: "24px 24px",
              }}
            />
          </>
        ) : null}

        {!profile.verified ? (
          member?.avatar ? (
            <AvatarAmbient avatar={member.avatar} />
          ) : (
            <div className="pointer-events-none absolute -right-24 -top-28 h-72 w-72 rounded-full bg-cyan-200/[0.045] blur-[90px]" />
          )
        ) : null}

        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            {member?.avatar ? (
              <img
                src={member.avatar}
                alt=""
                className="h-16 w-16 shrink-0 rounded-[18px] border border-white/[0.1] object-cover sm:h-20 sm:w-20"
              />
            ) : (
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[18px] border border-white/[0.08] bg-white/[0.025] sm:h-20 sm:w-20">
                <UserRound className="h-7 w-7 text-white/25" />
              </div>
            )}

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-[26px] font-semibold tracking-[-0.04em] text-white sm:text-[32px]">
                  {displayName}
                </h1>

                {profile.verified ? (
                  <VerifiedBadge size="lg" />
                ) : null}

                {profile.primeActive ? (
                  <PrimeBadge size="lg" />
                ) : null}
              </div>

              <p className="mt-1 text-[11px] text-white/25">
                {cleanRank(profile.rank)} · Level{" "}
                {profile.level}
              </p>

              {member?.username && (
                <p className="mt-1 text-[9px] text-white/15">
                  @{member.username}
                </p>
              )}
            </div>
          </div>

          <div className="flex gap-2">
            <MiniMetric
              label="Prestij"
              value={String(profile.prestige)}
            />

            <MiniMetric
              label="Reputasiya"
              value={formatNumber(profile.reputation)}
            />
          </div>
        </div>
      </section>

      <section className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          icon={Coins}
          label="Aura"
          value={formatNumber(profile.balance)}
        />

        <Stat
          icon={Banknote}
          label="Bank"
          value={formatNumber(profile.bank)}
        />

        <Stat
          icon={Trophy}
          label="Qələbə"
          value={formatNumber(profile.gamesWon)}
        />

        <Stat
          icon={Gamepad2}
          label="Win rate"
          value={`${winRate}%`}
        />
      </section>

      <section className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          icon={Activity}
          label="Qeydə alınmış hərəkət"
          value={formatNumber(transactions.length)}
        />

        <Stat
          icon={Shield}
          label="Kazino hərəkəti"
          value={formatNumber(casinoTransactions.length)}
        />

        <Stat
          icon={Sparkles}
          label="Kazino net"
          value={`${formatSigned(casinoNet)} Aura`}
        />

        <Stat
          icon={Crown}
          label="Ən böyük müsbət əməliyyat"
          value={`${formatNumber(biggestPositive)} Aura`}
        />
      </section>

      <section className="mt-4 rounded-[18px] border border-white/[0.06] bg-white/[0.018] p-5">
        <div className="flex flex-wrap gap-x-8 gap-y-4">
          <InlineMetric
            label="Kazino həcmi"
            value={`${formatNumber(casinoVolume)} Aura`}
          />

          <InlineMetric
            label="Oyun"
            value={formatNumber(profile.gamesPlayed)}
          />

          <InlineMetric
            label="Məğlubiyyət"
            value={formatNumber(profile.gamesLost)}
          />

          <InlineMetric
            label="XP"
            value={formatNumber(profile.xp)}
          />

          <InlineMetric
            label="Luck"
            value={formatNumber(profile.luck)}
          />
        </div>
      </section>

      <section className="mt-5 overflow-hidden rounded-[20px] border border-white/[0.06] bg-white/[0.018]">
        <div className="border-b border-white/[0.05] px-5 py-4 sm:px-6">
          <p className="text-[8px] font-semibold uppercase tracking-[0.17em] text-white/15">
            PUBLIC HISTORY
          </p>

          <h2 className="mt-1.5 text-[14px] font-semibold text-white/60">
            Əməliyyat tarixçəsi
          </h2>
        </div>

        {transactions.length ? (
          transactions.map((transaction) => (
            <div
              key={transaction.id}
              className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 border-b border-white/[0.04] px-5 py-4 last:border-0 sm:px-6"
            >
              <div className="min-w-0">
                <p className="truncate text-[11px] font-medium text-white/55">
                  {prettyType(transaction.type)}
                </p>

                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="text-[9px] text-white/18">
                    {new Date(
                      transaction.createdAt
                    ).toLocaleString("az-AZ")}
                  </span>

                  {transaction.note && (
                    <span className="max-w-[500px] truncate text-[9px] text-white/18">
                      {transaction.note}
                    </span>
                  )}
                </div>
              </div>

              <div className="text-right">
                <p
                  className={`text-[11px] font-semibold tabular-nums ${
                    transaction.amount >= 0
                      ? "text-emerald-200/60"
                      : "text-rose-200/60"
                  }`}
                >
                  {formatSigned(transaction.amount)} Aura
                </p>

                {transaction.balanceAfter !== null && (
                  <p className="mt-1 text-[8px] text-white/15">
                    Balans{" "}
                    {formatNumber(
                      transaction.balanceAfter
                    )}
                  </p>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="px-6 py-14 text-center text-[11px] text-white/20">
            Bu istifadəçi üçün qeydə alınmış əməliyyat yoxdur.
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[18px] border border-white/[0.06] bg-white/[0.018] p-5">
      <Icon className="h-4 w-4 text-cyan-100/40" />

      <p className="mt-5 text-[8px] font-semibold uppercase tracking-[0.15em] text-white/18">
        {label}
      </p>

      <p className="mt-1.5 truncate text-[18px] font-semibold tracking-[-0.03em] text-white/70">
        {value}
      </p>
    </div>
  );
}

function MiniMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[13px] border border-white/[0.06] bg-black/10 px-4 py-3">
      <p className="text-[7px] font-semibold uppercase tracking-[0.14em] text-white/15">
        {label}
      </p>

      <p className="mt-1 text-[12px] font-semibold text-white/55">
        {value}
      </p>
    </div>
  );
}

function InlineMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <p className="text-[8px] font-semibold uppercase tracking-[0.14em] text-white/15">
        {label}
      </p>

      <p className="mt-1 text-[12px] font-medium text-white/50">
        {value}
      </p>
    </div>
  );
}
