import { auth } from "@/auth";
import { redirect } from "next/navigation";
import {
  Crown,
  Medal,
  ShieldCheck,
  Sparkles,
  Trophy,
  Wallet,
  Swords,
  TrendingUp,
} from "lucide-react";

import {
  getOctosonLeaderboard,
  getOctosonUser,
  type OctosonLeaderboardEntry,
} from "@/lib/octoson";

import {
  getOctosonGuildMembers,
  type OctosonPublicMember,
} from "@/lib/discord-server";

function formatNumber(value: number) {
  return Math.floor(value).toLocaleString("en-US");
}

function cleanRank(rank: string) {
  return rank.replace(
    /^[\p{Extended_Pictographic}\uFE0F\s]+/u,
    ""
  );
}

export default async function LeaderboardPage() {
  const session = await auth();

  if (!session?.user?.discordId) {
    redirect("/");
  }

  const [rows, currentUser] = await Promise.all([
    getOctosonLeaderboard(1000),
    getOctosonUser(session.user.discordId),
  ]);

  if (!currentUser) {
    redirect("/not-member");
  }

  const top = rows.slice(0, 25);

  const discordMembers =
    await getOctosonGuildMembers(
      top.map((entry) => entry.userId)
    );

  const ownIndex = rows.findIndex(
    (entry) =>
      entry.userId === session.user.discordId
  );

  const ownPosition =
    ownIndex >= 0 ? ownIndex + 1 : null;

  const ownEntry =
    ownIndex >= 0 ? rows[ownIndex] : null;

  const totalAura = rows.reduce(
    (sum, entry) => sum + entry.balance,
    0
  );

  const totalWins = rows.reduce(
    (sum, entry) => sum + entry.wins,
    0
  );

  const primeUsers = rows.filter(
    (entry) => entry.primeActive
  ).length;

  const podium = top.slice(0, 3);
  const rest = top.slice(3);

  return (
    <div className="mx-auto max-w-[1240px]">
      <header className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-200" />

            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-200/55">
              Octoson Rankings
            </p>
          </div>

          <h1 className="mt-3 text-[34px] font-semibold tracking-[-0.045em] text-white sm:text-[40px]">
            Leaderboard
          </h1>

          <p className="mt-2 max-w-xl text-[13px] leading-6 text-white/25">
            Octoson economy-də ən yüksək Aura balansına
            sahib oyunçular.
          </p>
        </div>

        <div className="flex items-center gap-2 text-[10px] text-white/25">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-300/60" />
          Discord economy ilə sinxron
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          icon={Trophy}
          label="Oyunçular"
          value={formatNumber(rows.length)}
        />

        <SummaryCard
          icon={Wallet}
          label="Ümumi Aura"
          value={formatNumber(totalAura)}
        />

        <SummaryCard
          icon={Swords}
          label="Qələbələr"
          value={formatNumber(totalWins)}
        />

        <SummaryCard
          icon={Sparkles}
          label="Prime"
          value={formatNumber(primeUsers)}
          accent
        />
      </section>

      <section className="relative mt-4 overflow-hidden rounded-[20px] border border-cyan-100/[0.08] bg-cyan-100/[0.018] p-5 sm:p-6">
        <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-cyan-200/[0.04] blur-[80px]" />

        <div className="relative flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-[14px] border border-cyan-100/[0.09] bg-cyan-100/[0.035]">
              <TrendingUp className="h-5 w-5 text-cyan-100/55" />
            </div>

            <div>
              <p className="text-[8px] font-semibold uppercase tracking-[0.16em] text-cyan-100/35">
                Sənin mövqeyin
              </p>

              <p className="mt-1 text-[22px] font-semibold tracking-[-0.035em] text-white/80">
                {ownPosition
                  ? `#${ownPosition}`
                  : "Sıralanmamısan"}
              </p>
            </div>
          </div>

          {ownEntry && (
            <div className="flex flex-wrap gap-2">
              <OwnMetric
                label="Aura"
                value={formatNumber(ownEntry.balance)}
              />

              <OwnMetric
                label="Level"
                value={String(ownEntry.level)}
              />

              <OwnMetric
                label="Qələbə"
                value={formatNumber(ownEntry.wins)}
              />

              <OwnMetric
                label="Prestij"
                value={String(ownEntry.prestige)}
              />
            </div>
          )}
        </div>
      </section>

      {podium.length > 0 && (
        <section className="mt-5 grid gap-3 md:grid-cols-3">
          {podium.map((entry, index) => (
            <PodiumCard
              key={entry.userId}
              entry={entry}
              position={index + 1}
              current={
                entry.userId ===
                session.user.discordId
              }
              currentName={
                entry.userId ===
                session.user.discordId
                  ? session.user.name ?? "Sən"
                  : undefined
              }
              currentImage={
                entry.userId ===
                session.user.discordId
                  ? session.user.image ?? undefined
                  : undefined
              }
              member={discordMembers[entry.userId]}
            />
          ))}
        </section>
      )}

      <section className="mt-5 overflow-hidden rounded-[20px] border border-white/[0.06] bg-white/[0.018]">
        <div className="flex items-center justify-between border-b border-white/[0.05] px-5 py-4 sm:px-6">
          <div>
            <p className="text-[8px] font-semibold uppercase tracking-[0.17em] text-white/15">
              GLOBAL RANKING
            </p>

            <h2 className="mt-1.5 text-[14px] font-semibold tracking-[-0.02em] text-white/60">
              Top 25
            </h2>
          </div>

          <Trophy className="h-4 w-4 text-white/20" />
        </div>

        {rest.length > 0 ? (
          <div>
            {rest.map((entry, index) => {
              const position = index + 4;

              const current =
                entry.userId ===
                session.user.discordId;

              const member =
                discordMembers[entry.userId];

              const displayName =
                member?.name ??
                (current
                  ? session.user.name ?? "Sən"
                  : `İstifadəçi ${entry.userId.slice(-4)}`);

              const avatar =
                member?.avatar ??
                (current
                  ? session.user.image ?? undefined
                  : undefined);

              return (
                <div
                  key={entry.userId}
                  className={`grid grid-cols-[45px_minmax(0,1fr)_auto] items-center gap-3 border-b border-white/[0.04] px-4 py-3.5 last:border-0 sm:grid-cols-[55px_minmax(0,1fr)_100px_100px_130px] sm:px-6 ${
                    current
                      ? "bg-cyan-100/[0.025]"
                      : "transition hover:bg-white/[0.018]"
                  }`}
                >
                  <span className="text-[11px] font-semibold text-white/22">
                    #{position}
                  </span>

                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar
                      image={avatar}
                      name={displayName}
                    />

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-[11px] font-medium text-white/55">
                          {displayName}
                        </p>

                        {current && (
                          <span className="rounded-full border border-cyan-100/[0.08] bg-cyan-100/[0.025] px-1.5 py-0.5 text-[7px] font-semibold text-cyan-100/50">
                            SƏN
                          </span>
                        )}

                        {entry.primeActive && (
                          <Crown className="h-3 w-3 shrink-0 text-amber-200/55" />
                        )}
                      </div>

                      <p className="mt-0.5 truncate text-[8px] text-white/15">
                        {cleanRank(entry.rank)}
                      </p>
                    </div>
                  </div>

                  <span className="hidden text-[10px] text-white/30 sm:block">
                    Lv. {entry.level}
                  </span>

                  <span className="hidden text-[10px] text-white/30 sm:block">
                    {formatNumber(entry.wins)} W
                  </span>

                  <div className="text-right">
                    <p className="text-[11px] font-semibold text-white/65">
                      {formatNumber(entry.balance)}
                    </p>

                    <p className="mt-0.5 text-[7px] font-semibold uppercase tracking-[0.1em] text-cyan-100/25">
                      Aura
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="px-6 py-12 text-center text-[11px] text-white/25">
            Əlavə sıralama yoxdur.
          </div>
        )}
      </section>
    </div>
  );
}

function SummaryCard({
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
    <div className="rounded-[17px] border border-white/[0.06] bg-white/[0.018] p-4">
      <div className="flex items-center justify-between">
        <p className="text-[8px] font-medium uppercase tracking-[0.12em] text-white/17">
          {label}
        </p>

        <Icon
          className={`h-3.5 w-3.5 ${
            accent
              ? "text-cyan-100/45"
              : "text-white/18"
          }`}
        />
      </div>

      <p className="mt-3 truncate text-[20px] font-semibold tracking-[-0.035em] text-white/70">
        {value}
      </p>
    </div>
  );
}

function OwnMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-[78px] rounded-[11px] border border-white/[0.055] bg-black/20 px-3 py-2.5">
      <p className="text-[7px] uppercase tracking-[0.11em] text-white/15">
        {label}
      </p>

      <p className="mt-1 text-[11px] font-semibold text-white/55">
        {value}
      </p>
    </div>
  );
}

function PodiumCard({
  entry,
  position,
  current,
  currentName,
  currentImage,
  member,
}: {
  entry: OctosonLeaderboardEntry;
  position: number;
  current: boolean;
  currentName?: string;
  currentImage?: string;
  member?: OctosonPublicMember;
}) {
  const Icon = position === 1 ? Crown : Medal;

  const name =
    member?.name ??
    currentName ??
    `İstifadəçi ${entry.userId.slice(-4)}`;

  const image =
    member?.avatar ??
    currentImage;

  return (
    <article
      className={`relative overflow-hidden rounded-[20px] border p-5 ${
        position === 1
          ? "border-amber-200/[0.09] bg-amber-200/[0.018]"
          : "border-white/[0.06] bg-white/[0.018]"
      }`}
    >
      {position === 1 && (
        <div className="pointer-events-none absolute -right-12 -top-14 h-40 w-40 rounded-full bg-amber-200/[0.035] blur-[55px]" />
      )}

      <div className="relative flex items-start justify-between">
        <Avatar
          image={image ?? undefined}
          name={name}
          large
        />

        <div
          className={`flex h-9 w-9 items-center justify-center rounded-[11px] border ${
            position === 1
              ? "border-amber-200/[0.1] bg-amber-200/[0.03]"
              : "border-white/[0.06] bg-black/20"
          }`}
        >
          <Icon
            className={`h-4 w-4 ${
              position === 1
                ? "text-amber-200/60"
                : "text-white/25"
            }`}
          />
        </div>
      </div>

      <div className="relative mt-4">
        <div className="flex items-center gap-2">
          <p className="truncate text-[13px] font-semibold text-white/65">
            {name}
          </p>

          {current && (
            <span className="rounded-full border border-cyan-100/[0.08] bg-cyan-100/[0.025] px-1.5 py-0.5 text-[7px] font-semibold text-cyan-100/50">
              SƏN
            </span>
          )}

          {entry.primeActive && (
            <Crown className="h-3 w-3 text-amber-200/50" />
          )}
        </div>

        <p className="mt-1 text-[9px] text-white/18">
          #{position} · {cleanRank(entry.rank)}
        </p>
      </div>

      <div className="relative mt-5">
        <p className="text-[8px] font-medium uppercase tracking-[0.12em] text-white/15">
          Aura balansı
        </p>

        <div className="mt-1 flex items-baseline gap-1.5">
          <p className="text-[25px] font-semibold tracking-[-0.04em] text-white/80">
            {formatNumber(entry.balance)}
          </p>

          <span className="text-[8px] font-semibold text-cyan-100/30">
            AURA
          </span>
        </div>
      </div>

      <div className="relative mt-5 grid grid-cols-3 gap-2 border-t border-white/[0.05] pt-4">
        <PodiumMetric
          label="LVL"
          value={String(entry.level)}
        />

        <PodiumMetric
          label="WINS"
          value={formatNumber(entry.wins)}
        />

        <PodiumMetric
          label="PRESTIGE"
          value={String(entry.prestige)}
        />
      </div>
    </article>
  );
}

function PodiumMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <p className="text-[7px] font-medium tracking-[0.1em] text-white/13">
        {label}
      </p>

      <p className="mt-1 text-[10px] font-semibold text-white/40">
        {value}
      </p>
    </div>
  );
}

function Avatar({
  image,
  name,
  large = false,
}: {
  image?: string;
  name: string;
  large?: boolean;
}) {
  const size = large
    ? "h-11 w-11"
    : "h-9 w-9";

  if (image) {
    return (
      <img
        src={image}
        alt=""
        className={`${size} shrink-0 rounded-[11px] border border-white/[0.07] object-cover`}
      />
    );
  }

  return (
    <div
      className={`${size} flex shrink-0 items-center justify-center rounded-[11px] border border-white/[0.06] bg-white/[0.025] text-[10px] font-semibold text-white/30`}
    >
      {name.slice(-1).toUpperCase()}
    </div>
  );
}
