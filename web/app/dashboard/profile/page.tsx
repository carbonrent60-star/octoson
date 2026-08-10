import { redirect } from "next/navigation";
import {
  Activity,
  Award,
  BadgeCheck,
  Banknote,
  CalendarDays,
  CircleUserRound,
  Crown,
  Dices,
  Flame,
  Gem,
  Landmark,
  Medal,
  ShieldCheck,
  Sparkles,
  Star,
  Target,
  Trophy,
  WalletCards,
  Zap,
} from "lucide-react";

import { auth } from "@/auth";
import { getOctosonUser } from "@/lib/octoson";
import { getOctosonGuildMember } from "@/lib/discord-server";

type AnyRecord = Record<string, unknown>;

type Transaction = {
  id?: string;
  at?: string;
  type?: string;
  amount?: number;
  note?: string;
  balanceAfter?: number;
};

function record(value: unknown): AnyRecord {
  if (
    value &&
    typeof value === "object" &&
    !Array.isArray(value)
  ) {
    return value as AnyRecord;
  }

  return {};
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function num(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function text(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim()
    ? value
    : fallback;
}

function formatAura(value: unknown) {
  return Math.floor(num(value)).toLocaleString("en-US");
}

function formatNumber(value: unknown) {
  return Math.floor(num(value)).toLocaleString("en-US");
}

function cleanRank(value: unknown) {
  return text(value, "Yeni başlayan")
    .replace(
      /^[\p{Extended_Pictographic}\uFE0F\u200D]+\s*/u,
      ""
    )
    .trim();
}

function formatDate(value: unknown) {
  if (!value || typeof value !== "string") {
    return "Məlum deyil";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Məlum deyil";
  }

  return new Intl.DateTimeFormat("az-AZ", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function transactionLabel(type: string) {
  const labels: Record<string, string> = {
    bank_deposit: "Banka yatırıldı",
    bank_withdraw: "Bankdan çıxarıldı",
    bank_interest: "Bank faizi",
    admin_give: "Aura əlavə edildi",
    transfer: "Transfer",
    gift: "Hədiyyə",
    rob: "Uğurlu soyğun",
    rob_failed: "Uğursuz soyğun",
    daily: "Gündəlik mükafat",
    weekly: "Həftəlik mükafat",
    monthly: "Aylıq mükafat",
    work: "İş",
    hunt: "Ov",
    fish: "Balıqçılıq",
    crime: "Cinayət",
    spend: "Xərc",
    slots: "Slots",
    mines: "Mines",
    crash: "Crash",
    wheel: "Lucky Wheel",
    roulette: "Roulette",
    coinflip: "Coinflip",
    dice: "Dice",
    duel: "Duel",
    poker: "Poker",
    blackjack: "Blackjack",
    baccarat: "Baccarat",
  };

  return labels[type] ?? type;
}

function transactionIcon(type: string) {
  if (
    [
      "slots",
      "mines",
      "crash",
      "wheel",
      "roulette",
      "coinflip",
      "dice",
      "duel",
      "poker",
      "blackjack",
      "baccarat",
    ].includes(type)
  ) {
    return Dices;
  }

  if (type.startsWith("bank")) {
    return Landmark;
  }

  if (
    type === "daily" ||
    type === "weekly" ||
    type === "monthly"
  ) {
    return Award;
  }

  return Activity;
}

export default async function ProfilePage() {
  const session = await auth();

  if (!session?.user?.discordId) {
    redirect("/");
  }

  const [economy, member] = await Promise.all([
    getOctosonUser(session.user.discordId),
    getOctosonGuildMember(session.user.discordId),
  ]);

  if (!economy || !member) {
    redirect("/not-member");
  }

  const profile = economy.profile ?? {};

  const stats = record(profile.stats);
  const world = record(profile.world);
  const season = record(profile.season);
  const prime = record(profile.prime);

  const wallet = num(profile.balance);
  const bank = num(profile.bank);

  const storedNetWorth = num(world.netWorth);
  const netWorth =
    storedNetWorth > 0
      ? storedNetWorth
      : wallet + bank;

  const level = Math.max(1, num(profile.level, 1));
  const xp = Math.max(0, num(profile.xp));
  const prestige = Math.max(0, num(profile.prestige));

  const reputation = num(profile.reputation);
  const luck = num(profile.luck, 50);

  const rank = cleanRank(profile.rank);
  const title = text(profile.title, "Yeni üzv");

  const achievements = array(profile.achievements).map(String);
  const badges = array(profile.badges).map(String);

  const gamesPlayed = num(stats.gamesPlayed);
  const gamesWon = num(stats.gamesWon);
  const gamesLost = num(stats.gamesLost);

  const winRate =
    gamesPlayed > 0
      ? Math.round((gamesWon / gamesPlayed) * 100)
      : 0;

  const biggestWin = num(stats.biggestWin);
  const biggestLoss = num(stats.biggestLoss);
  const currentStreak = num(stats.currentStreak);
  const longestStreak = num(stats.longestStreak);
  const auraEarned = num(stats.auraEarned);
  const auraLost = num(stats.auraLost);

  const favoriteGames = record(stats.favoriteGames);

  const favoriteGame =
    Object.entries(favoriteGames).sort(
      (a, b) => num(b[1]) - num(a[1])
    )[0]?.[0] ?? "Yoxdur";

  const seasonLevel = Math.max(1, num(season.level, 1));
  const seasonXp = Math.max(0, num(season.xp));
  const seasonTotalXp = Math.max(0, num(season.totalXp));

  const primeActiveUntil = text(prime.activeUntil);

  const primeActive =
    !!primeActiveUntil &&
    new Date(primeActiveUntil).getTime() > Date.now();

  const transactions = array(profile.transactions)
    .filter(
      (item): item is Transaction =>
        !!item &&
        typeof item === "object" &&
        !Array.isArray(item)
    )
    .slice(0, 6);

  const discordUser = member.user;

  const displayName =
    member.nick ||
    discordUser?.global_name ||
    session.user.name ||
    discordUser?.username ||
    "Octoson User";

  const username =
    discordUser?.username || session.user.name || "user";

  const image = session.user.image;

  /*
   * Keep this visual progress calculation consistent
   * with the current dashboard until the exact bot XP
   * progression formula is exposed to the web app.
   */
  const xpTarget = Math.max(100, level * 100);
  const xpProgress = Math.min(
    100,
    Math.max(0, (xp / xpTarget) * 100)
  );

  return (
    <div className="mx-auto max-w-[1240px] pb-12">
      {/* PAGE INTRO */}
      <div className="mb-7 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-200" />

            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-200/55">
              Octoson Identity
            </p>
          </div>

          <h1 className="mt-3 text-[34px] font-semibold tracking-[-0.045em] text-white sm:text-[40px]">
            Profil
          </h1>

          <p className="mt-2 max-w-xl text-[13px] leading-6 text-white/25">
            Economy statusun, nailiyyətlərin və Octoson
            fəaliyyətin.
          </p>
        </div>

        <div className="flex items-center gap-2 text-[10px] text-white/25">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-300/60" />
          Discord ilə sinxron
        </div>
      </div>

      {/* PROFILE HERO */}
      <section className="relative overflow-hidden rounded-[26px] border border-white/[0.07] bg-[#09090c]">
        <div className="pointer-events-none absolute -right-32 -top-40 h-[440px] w-[440px] rounded-full bg-cyan-200/[0.065] blur-[110px]" />

        <div className="pointer-events-none absolute -bottom-44 left-[18%] h-[340px] w-[340px] rounded-full bg-blue-500/[0.035] blur-[100px]" />

        <div
          className="pointer-events-none absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 80% 20%, rgba(255,255,255,.8) 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        />

        <div className="relative p-6 sm:p-8">
          <div className="flex flex-col justify-between gap-8 lg:flex-row lg:items-center">
            <div className="flex min-w-0 items-center gap-5">
              <div className="relative shrink-0">
                {image ? (
                  <img
                    src={image}
                    alt=""
                    className="h-[78px] w-[78px] rounded-[22px] border border-white/[0.1] object-cover shadow-2xl sm:h-[92px] sm:w-[92px]"
                  />
                ) : (
                  <div className="flex h-[78px] w-[78px] items-center justify-center rounded-[22px] border border-white/[0.08] bg-white/[0.03] sm:h-[92px] sm:w-[92px]">
                    <CircleUserRound className="h-8 w-8 text-white/20" />
                  </div>
                )}

                <div className="absolute -bottom-2 -right-2 flex h-8 min-w-8 items-center justify-center rounded-[10px] border-[3px] border-[#09090c] bg-cyan-100 px-2 text-[10px] font-bold text-black">
                  {level}
                </div>
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="truncate text-[25px] font-semibold tracking-[-0.04em] text-white sm:text-[30px]">
                    {displayName}
                  </h2>

                  <BadgeCheck className="h-4 w-4 shrink-0 text-cyan-200/55" />
                </div>

                <p className="mt-1 text-[11px] text-white/25">
                  @{username}
                </p>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <StatusPill>{rank}</StatusPill>

                  <StatusPill accent>
                    {title}
                  </StatusPill>

                  {prestige > 0 && (
                    <StatusPill>
                      Prestige {prestige}
                    </StatusPill>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:min-w-[430px]">
              <HeroStat
                label="Net Worth"
                value={formatAura(netWorth)}
                suffix="Aura"
                icon={Gem}
                accent
              />

              <HeroStat
                label="Wallet"
                value={formatAura(wallet)}
                icon={WalletCards}
              />

              <HeroStat
                label="Bank"
                value={formatAura(bank)}
                icon={Banknote}
              />

              <HeroStat
                label="Prestige"
                value={formatNumber(prestige)}
                icon={Crown}
              />
            </div>
          </div>

          <div className="mt-8 border-t border-white/[0.055] pt-6">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-[9px] font-medium uppercase tracking-[0.14em] text-white/20">
                  Level progress
                </p>

                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-[20px] font-semibold tracking-[-0.035em] text-white/80">
                    Lv. {level}
                  </span>

                  <span className="text-[9px] text-white/20">
                    {formatNumber(xp)} XP
                  </span>
                </div>
              </div>

              <span className="text-[9px] font-medium text-cyan-100/35">
                {xpProgress.toFixed(0)}%
              </span>
            </div>

            <div className="mt-3 h-[5px] overflow-hidden rounded-full bg-white/[0.045]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan-200/50 to-cyan-100 transition-all duration-700"
                style={{
                  width: `${xpProgress}%`,
                }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* CORE STATS */}
      <section className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={Trophy}
          label="Qələbələr"
          value={formatNumber(gamesWon)}
          description={`${winRate}% win rate`}
          accent
        />

        <MetricCard
          icon={Dices}
          label="Oyunlar"
          value={formatNumber(gamesPlayed)}
          description={`${formatNumber(gamesLost)} məğlubiyyət`}
        />

        <MetricCard
          icon={Flame}
          label="Seriya"
          value={formatNumber(currentStreak)}
          description={`Rekord ${formatNumber(longestStreak)}`}
        />

        <MetricCard
          icon={Star}
          label="Reputasiya"
          value={formatNumber(reputation)}
          description={`${formatNumber(luck)} luck`}
        />
      </section>

      {/* MAIN GRID */}
      <section className="mt-4 grid gap-4 xl:grid-cols-[1.35fr_.65fr]">
        {/* CASINO PERFORMANCE */}
        <Panel
          eyebrow="PERFORMANCE"
          title="Casino statistikası"
          icon={Dices}
        >
          <div className="grid gap-px overflow-hidden rounded-[16px] border border-white/[0.055] bg-white/[0.055] sm:grid-cols-2">
            <DataCell
              label="Ən böyük qələbə"
              value={`+${formatAura(biggestWin)} Aura`}
              accent
            />

            <DataCell
              label="Ən böyük məğlubiyyət"
              value={`-${formatAura(biggestLoss)} Aura`}
            />

            <DataCell
              label="Qazanılan Aura"
              value={formatAura(auraEarned)}
            />

            <DataCell
              label="İtirilən Aura"
              value={formatAura(auraLost)}
            />

            <DataCell
              label="Sevimli oyun"
              value={favoriteGame}
            />

            <DataCell
              label="Win rate"
              value={`${winRate}%`}
              accent
            />
          </div>
        </Panel>

        {/* ACCOUNT */}
        <Panel
          eyebrow="ACCOUNT"
          title="Hesab məlumatları"
          icon={CircleUserRound}
        >
          <div className="space-y-1">
            <InfoRow
              label="Discord ID"
              value={session.user.discordId}
            />

            <InfoRow
              label="Serverə qoşulub"
              value={formatDate(member.joined_at)}
            />

            <InfoRow
              label="Rank"
              value={rank}
            />

            <InfoRow
              label="Title"
              value={title}
            />

            <InfoRow
              label="Prime"
              value={primeActive ? "Aktiv" : "Aktiv deyil"}
              accent={primeActive}
            />
          </div>
        </Panel>
      </section>

      {/* ACHIEVEMENTS + SEASON */}
      <section className="mt-4 grid gap-4 xl:grid-cols-[1.1fr_.9fr]">
        <Panel
          eyebrow="COLLECTION"
          title="Nailiyyətlər"
          icon={Medal}
        >
          {achievements.length > 0 ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {achievements.map((achievement) => (
                <div
                  key={achievement}
                  className="flex items-center gap-3 rounded-[13px] border border-white/[0.055] bg-black/20 px-4 py-3"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] border border-cyan-100/[0.07] bg-cyan-100/[0.025]">
                    <Trophy className="h-3.5 w-3.5 text-cyan-100/45" />
                  </div>

                  <span className="text-[10px] font-medium text-white/45">
                    {achievement}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Trophy}
              title="Hələ nailiyyət yoxdur"
              description="Octoson istifadə etdikcə nailiyyətlər burada görünəcək."
            />
          )}

          {badges.length > 0 && (
            <div className="mt-5 border-t border-white/[0.05] pt-5">
              <p className="text-[8px] font-semibold uppercase tracking-[0.15em] text-white/15">
                Badges
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                {badges.map((badge, index) => (
                  <div
                    key={`${badge}-${index}`}
                    className="flex h-10 min-w-10 items-center justify-center rounded-[11px] border border-white/[0.06] bg-white/[0.025] px-3 text-[17px]"
                  >
                    {badge}
                  </div>
                ))}
              </div>
            </div>
          )}
        </Panel>

        <Panel
          eyebrow="SEASON"
          title="Mövsüm statusu"
          icon={Sparkles}
        >
          <div className="rounded-[16px] border border-cyan-100/[0.075] bg-cyan-100/[0.018] p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[9px] text-white/20">
                  Mövsüm səviyyəsi
                </p>

                <p className="mt-2 text-[32px] font-semibold tracking-[-0.045em] text-white/85">
                  {seasonLevel}
                </p>
              </div>

              <div className="flex h-10 w-10 items-center justify-center rounded-[12px] border border-cyan-100/[0.08] bg-cyan-100/[0.03]">
                <Sparkles className="h-4 w-4 text-cyan-100/55" />
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2">
              <MiniValue
                label="Season XP"
                value={formatNumber(seasonXp)}
              />

              <MiniValue
                label="Total XP"
                value={formatNumber(seasonTotalXp)}
              />
            </div>
          </div>
        </Panel>
      </section>

      {/* RECENT ACTIVITY */}
      <section className="mt-4">
        <Panel
          eyebrow="LIVE ECONOMY"
          title="Son fəaliyyət"
          icon={Activity}
        >
          {transactions.length > 0 ? (
            <div className="divide-y divide-white/[0.045]">
              {transactions.map((transaction, index) => {
                const type = text(
                  transaction.type,
                  "activity"
                );

                const Icon = transactionIcon(type);
                const amount = num(transaction.amount);
                const positive = amount > 0;

                return (
                  <div
                    key={transaction.id ?? `${type}-${index}`}
                    className="flex items-center gap-3 py-3.5 first:pt-0 last:pb-0"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] border border-white/[0.055] bg-black/25">
                      <Icon className="h-3.5 w-3.5 text-white/25" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[11px] font-medium text-white/50">
                        {transactionLabel(type)}
                      </p>

                      <div className="mt-1 flex items-center gap-2 text-[8px] text-white/15">
                        <CalendarDays className="h-2.5 w-2.5" />
                        {formatDate(transaction.at)}
                      </div>
                    </div>

                    <div className="text-right">
                      <p
                        className={`text-[11px] font-semibold ${
                          positive
                            ? "text-emerald-300/70"
                            : amount < 0
                              ? "text-rose-300/60"
                              : "text-white/35"
                        }`}
                      >
                        {positive ? "+" : ""}
                        {formatAura(amount)}
                      </p>

                      <p className="mt-1 text-[8px] text-white/15">
                        Aura
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState
              icon={Activity}
              title="Fəaliyyət yoxdur"
              description="Yeni economy əməliyyatları burada görünəcək."
            />
          )}
        </Panel>
      </section>
    </div>
  );
}

function StatusPill({
  children,
  accent = false,
}: {
  children: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <span
      className={`rounded-full border px-2.5 py-1 text-[8px] font-medium ${
        accent
          ? "border-cyan-100/[0.09] bg-cyan-100/[0.03] text-cyan-100/55"
          : "border-white/[0.065] bg-white/[0.025] text-white/30"
      }`}
    >
      {children}
    </span>
  );
}

function HeroStat({
  label,
  value,
  suffix,
  icon: Icon,
  accent = false,
}: {
  label: string;
  value: string;
  suffix?: string;
  icon: React.ElementType;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-[15px] border p-3.5 ${
        accent
          ? "border-cyan-100/[0.085] bg-cyan-100/[0.025]"
          : "border-white/[0.055] bg-black/20"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[8px] font-medium text-white/20">
          {label}
        </p>

        <Icon
          className={`h-3 w-3 ${
            accent
              ? "text-cyan-100/45"
              : "text-white/18"
          }`}
        />
      </div>

      <div className="mt-2 flex items-baseline gap-1">
        <span className="truncate text-[14px] font-semibold tracking-[-0.025em] text-white/65">
          {value}
        </span>

        {suffix && (
          <span className="text-[7px] font-semibold uppercase text-white/15">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  description,
  accent = false,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  description: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-[18px] border border-white/[0.06] bg-white/[0.018] p-5">
      <div className="flex items-center justify-between">
        <div
          className={`flex h-9 w-9 items-center justify-center rounded-[11px] border ${
            accent
              ? "border-cyan-100/[0.08] bg-cyan-100/[0.025]"
              : "border-white/[0.055] bg-black/20"
          }`}
        >
          <Icon
            className={`h-4 w-4 ${
              accent
                ? "text-cyan-100/50"
                : "text-white/22"
            }`}
          />
        </div>

        <span className="text-[8px] text-white/15">
          {description}
        </span>
      </div>

      <p className="mt-5 text-[9px] font-medium uppercase tracking-[0.12em] text-white/18">
        {label}
      </p>

      <p className="mt-1 text-[23px] font-semibold tracking-[-0.035em] text-white/75">
        {value}
      </p>
    </div>
  );
}

function Panel({
  eyebrow,
  title,
  icon: Icon,
  children,
}: {
  eyebrow: string;
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[20px] border border-white/[0.06] bg-white/[0.018] p-5 sm:p-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <p className="text-[8px] font-semibold uppercase tracking-[0.17em] text-white/15">
            {eyebrow}
          </p>

          <h3 className="mt-1.5 text-[14px] font-semibold tracking-[-0.02em] text-white/60">
            {title}
          </h3>
        </div>

        <div className="flex h-8 w-8 items-center justify-center rounded-[10px] border border-white/[0.055] bg-black/20">
          <Icon className="h-3.5 w-3.5 text-white/22" />
        </div>
      </div>

      {children}
    </div>
  );
}

function DataCell({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="bg-[#09090c] p-4">
      <p className="text-[8px] font-medium uppercase tracking-[0.11em] text-white/15">
        {label}
      </p>

      <p
        className={`mt-2 text-[13px] font-semibold ${
          accent
            ? "text-cyan-100/65"
            : "text-white/55"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function InfoRow({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-[11px] px-2 py-2.5 transition hover:bg-white/[0.018]">
      <span className="text-[9px] text-white/20">
        {label}
      </span>

      <span
        className={`max-w-[65%] truncate text-right text-[10px] font-medium ${
          accent
            ? "text-emerald-300/60"
            : "text-white/45"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function MiniValue({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[11px] border border-white/[0.05] bg-black/20 p-3">
      <p className="text-[8px] text-white/16">
        {label}
      </p>

      <p className="mt-1.5 text-[12px] font-semibold text-white/50">
        {value}
      </p>
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
}) {
  return (
    <div className="flex min-h-[150px] flex-col items-center justify-center rounded-[15px] border border-dashed border-white/[0.065] bg-black/15 px-5 text-center">
      <div className="flex h-9 w-9 items-center justify-center rounded-[11px] border border-white/[0.055] bg-white/[0.02]">
        <Icon className="h-4 w-4 text-white/18" />
      </div>

      <p className="mt-3 text-[11px] font-medium text-white/40">
        {title}
      </p>

      <p className="mt-1 max-w-[300px] text-[9px] leading-4 text-white/17">
        {description}
      </p>
    </div>
  );
}
