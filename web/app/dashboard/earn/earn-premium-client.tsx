"use client";

import { useMemo, useState } from "react";

import type { LucideIcon } from "lucide-react";

import {
  Activity,
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Coins,
  Crosshair,
  Crown,
  Dices,
  Gamepad2,
  Gift,
  HelpCircle,
  Orbit,
  ShieldCheck,
  Sparkles,
  Star,
  Target,
  TimerReset,
  Trophy,
  Zap,
} from "lucide-react";

import EarnClaimButton from "./claim-button";
import ContractClaimButton from "./contract-claim-button";

import {
  claimMissionAction,
  claimContractAction,
} from "./actions";

import styles from "./earn-premium.module.css";

type Mission = {
  id: string;
  periodType: "daily" | "weekly";
  periodKey: string;
  missionKey: string;
  title: string;
  description: string;
  metric: string;
  target: number;
  progress: number;
  auraReward: number;
  xpReward: number;
  seasonXpReward: number;
  completedAt: number | null;
  claimedAt: number | null;
};

type ActiveContract = {
  id: string;
  title: string;
  metric: string;
  target: number;
  progress: number;
  auraReward: number;
  xpReward: number;
  seasonXpReward: number;
  expiresAt: number | null;
  status: string;
} | null;

type Bounty = {
  id: string;
  title: string;
  description: string;
  metric: string;
  target: number;
  progress: number;
  auraReward: number;
  xpReward: number;
  seasonXpReward: number;
  endsAt: number;
  claimed: boolean;
};

type EarnData = {
  accountLevel: number;
  accountXp: number;

  missions: Mission[];

  season: {
    key: string;
    level: number;
    xp: number;
    totalXp: number;
    nextLevelXp: number;
    progress: number;
  };

  activeContract: ActiveContract;

  activeBounties: Bounty[];
};

type TabKey =
  | "daily"
  | "weekly"
  | "contract"
  | "bounty";

function formatNumber(value: number) {
  return Math.max(
    0,
    Math.floor(Number(value) || 0)
  ).toLocaleString("en-US");
}

function percent(
  value: number,
  target: number
) {
  return Math.min(
    100,
    Math.max(
      0,
      (Number(value || 0) /
        Math.max(1, Number(target || 1))) *
        100
    )
  );
}

function timeLeft(timestamp: number | null) {
  if (!timestamp) return "Limitsiz";

  const remaining =
    timestamp - Date.now();

  if (remaining <= 0) {
    return "Vaxt bitib";
  }

  const hours =
    Math.floor(
      remaining / 3_600_000
    );

  const minutes =
    Math.floor(
      (remaining % 3_600_000) /
        60_000
    );

  if (hours >= 24) {
    const days =
      Math.floor(hours / 24);

    return `${days}g ${hours % 24}s`;
  }

  if (hours > 0) {
    return `${hours}s ${minutes}d`;
  }

  return `${Math.max(1, minutes)} dəq`;
}

function metricLabel(metric: string) {
  switch (metric) {
    case "game_played":
      return "Oyun";
    case "casino_bet":
      return "Casino";
    case "aura_earned":
      return "Aura";
    case "activity":
      return "Aktivlik";
    default:
      return "Tapşırıq";
  }
}


function missionGuide(
  mission: Mission
) {
  const remaining = Math.max(
    0,
    Number(mission.target || 0) -
      Number(mission.progress || 0)
  );

  const period =
    mission.periodType === "weekly"
      ? "həftəlik"
      : "günlük";

  switch (mission.metric) {
    case "game_played":
      return {
        title: "Oyun oynayaraq tamamla",
        description:
          `Bu ${period} missiya oynadığın uyğun oyunların sayını izləyir.`,
        steps: [
          "Casino və ya serverdəki uyğun oyunlardan birini başlat.",
          "Oyunu normal şəkildə sona qədər tamamla.",
          "Hər qeydə alınan oyun missiya irəliləyişinə əlavə olunur.",
        ],
        remaining:
          remaining > 0
            ? `Daha ${formatNumber(remaining)} oyun lazımdır.`
            : "Tələb olunan oyun sayı tamamlanıb.",
      };

    case "casino_bet":
      return {
        title: "Casino oynayaraq tamamla",
        description:
          `Bu ${period} missiya uyğun casino oyunlarında qeydə alınan mərcləri izləyir.`,
        steps: [
          "Casino bölməsindən mövcud oyunlardan birini seç.",
          "Mərc et və raundu tamamla.",
          "Qeydə alınan uyğun mərclər irəliləyişə əlavə olunur.",
        ],
        remaining:
          remaining > 0
            ? `Daha ${formatNumber(remaining)} irəliləyiş lazımdır.`
            : "Casino tələbi tamamlanıb.",
      };

    case "aura_earned":
      return {
        title: "Aura qazanaraq tamamla",
        description:
          `Bu ${period} missiya uyğun fəaliyyətlərdən qazandığın Aura miqdarını izləyir.`,
        steps: [
          "Earn və digər uyğun fəaliyyətlərdən Aura qazan.",
          "World missiyaları və uyğun mükafat mənbələrindən istifadə et.",
          "Yalnız sistem tərəfindən uyğun qazanc kimi qeydə alınan Aura sayılır.",
        ],
        remaining:
          remaining > 0
            ? `Daha ${formatNumber(remaining)} Aura qazanmalısan.`
            : "Aura hədəfi tamamlanıb.",
      };

    case "activity":
      return {
        title: "Aktivlik edərək tamamla",
        description:
          `Bu ${period} missiya uyğun economy fəaliyyətlərinin sayını izləyir.`,
        steps: [
          "Earn bölməsində mövcud fəaliyyətlərdən istifadə et.",
          "Uyğun activity əməliyyatını tamamla.",
          "Hər qeydə alınan fəaliyyət irəliləyişə əlavə olunur.",
        ],
        remaining:
          remaining > 0
            ? `Daha ${formatNumber(remaining)} fəaliyyət lazımdır.`
            : "Aktivlik hədəfi tamamlanıb.",
      };

    default:
      return {
        title: "Missiyanı tamamla",
        description:
          "Missiyanın təsvirində göstərilən hədəfi yerinə yetir.",
        steps: [
          "Missiyanın tələbini yoxla.",
          "Uyğun fəaliyyəti tamamla.",
          "İrəliləyiş avtomatik olaraq burada görünəcək.",
        ],
        remaining:
          remaining > 0
            ? `Daha ${formatNumber(remaining)} irəliləyiş lazımdır.`
            : "Missiya tamamlanıb.",
      };
  }
}

const METRIC_ICONS: Record<string, LucideIcon> = {
  game_played: Gamepad2,
  casino_bet: Dices,
  aura_earned: Coins,
  activity: Activity,
};

function metricTone(metric: string) {
  switch (metric) {
    case "game_played":
      return "violet";
    case "casino_bet":
      return "rose";
    case "aura_earned":
      return "amber";
    case "activity":
      return "cyan";
    default:
      return "cyan";
  }
}

function difficulty(
  mission: Mission
) {
  const ratio =
    mission.metric === "aura_earned"
      ? mission.target / 2500
      : mission.target;

  if (
    mission.target >= 75_000 ||
    ratio >= 100
  ) {
    return {
      name: "Elite",
      tone: "rose",
    };
  }

  if (
    mission.target >= 25_000 ||
    ratio >= 40
  ) {
    return {
      name: "Çətin",
      tone: "amber",
    };
  }

  if (ratio >= 8) {
    return {
      name: "Orta",
      tone: "violet",
    };
  }

  return {
    name: "Asan",
    tone: "cyan",
  };
}

function totalRewards(
  missions: Mission[]
) {
  return missions.reduce(
    (sum, mission) =>
      sum +
      Number(
        mission.auraReward || 0
      ),
    0
  );
}

export default function EarnPremiumClient({
  data,
}: {
  data: EarnData;
}) {
  const [activeTab, setActiveTab] =
    useState<TabKey>("daily");

  const daily = useMemo(
    () =>
      data.missions.filter(
        (mission) =>
          mission.periodType ===
          "daily"
      ),
    [data.missions]
  );

  const weekly = useMemo(
    () =>
      data.missions.filter(
        (mission) =>
          mission.periodType ===
          "weekly"
      ),
    [data.missions]
  );

  const completedDaily =
    daily.filter(
      (mission) =>
        mission.progress >=
        mission.target
    ).length;

  const completedWeekly =
    weekly.filter(
      (mission) =>
        mission.progress >=
        mission.target
    ).length;

  const claimedDaily =
    daily.filter(
      (mission) =>
        Boolean(mission.claimedAt)
    ).length;

  const claimedWeekly =
    weekly.filter(
      (mission) =>
        Boolean(mission.claimedAt)
    ).length;

  const claimableMissions =
    data.missions.filter(
      (mission) =>
        mission.progress >=
          mission.target &&
        !mission.claimedAt
    );

  const contractComplete =
    Boolean(
      data.activeContract &&
        data.activeContract.progress >=
          data.activeContract.target
    );

  const totalClaimable =
    claimableMissions.reduce(
      (sum, mission) =>
        sum +
        mission.auraReward,
      0
    ) +
    (data.activeContract &&
    contractComplete
      ? data.activeContract
          .auraReward
      : 0);

  const overallCompleted =
    completedDaily +
    completedWeekly;

  const overallTotal =
    daily.length +
    weekly.length;

  const overallProgress =
    overallTotal > 0
      ? (overallCompleted /
          overallTotal) *
        100
      : 0;

  const tabs = [
    {
      key: "daily" as const,
      label: "Gündəlik",
      count: `${completedDaily}/${daily.length}`,
      icon: CalendarDays,
    },
    {
      key: "weekly" as const,
      label: "Həftəlik",
      count: `${completedWeekly}/${weekly.length}`,
      icon: Target,
    },
    {
      key: "contract" as const,
      label: "Müqavilə",
      count: data.activeContract
        ? contractComplete
          ? "Hazır"
          : "Aktiv"
        : "—",
      icon: ShieldCheck,
    },
    {
      key: "bounty" as const,
      label: "Bounty",
      count: String(
        data.activeBounties.length
      ),
      icon: Crosshair,
    },
  ];

  return (
    <div
      className={`${styles.page} pb-20`}
    >
      <div
        className={
          styles.ambientOne
        }
      />

      <div
        className={
          styles.ambientTwo
        }
      />

      {/* HERO */}
      <section
        className={`${styles.hero} ${styles.reveal}`}
      >
        <div
          className={
            styles.heroGlow
          }
        />

        <div className="relative">
          <div className="flex flex-col gap-8 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-2xl">
              <div className="flex items-center gap-2.5">
                <span
                  className={
                    styles.liveDot
                  }
                />

                <span className="text-[9px] font-semibold uppercase tracking-[0.24em] text-cyan-100/50">
                  Octoson Earn
                </span>

                <span className="rounded-full border border-white/[0.06] bg-white/[0.025] px-2.5 py-1 text-[8px] font-semibold text-white/25">
                  Mövsüm{" "}
                  {data.season.level}
                </span>
              </div>

              <h1 className="mt-5 max-w-xl text-[34px] font-semibold tracking-[-0.055em] text-white sm:text-[46px]">
                Oyna.
                <span className="text-white/25">
                  {" "}
                  Tamamla.
                </span>
                <br />
                <span className="bg-gradient-to-r from-cyan-100 via-violet-200 to-amber-100 bg-clip-text text-transparent">
                  Mükafatını götür.
                </span>
              </h1>

              <p className="mt-4 max-w-lg text-[11px] leading-6 text-white/30 sm:text-[12px]">
                Octoson-da etdiyin
                fəaliyyətlər avtomatik
                olaraq tapşırıqlara
                yazılır. Hədəfi tamamla,
                Aura, XP və Season XP-ni
                götür.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:min-w-[510px]">
              <HeroStat
                icon={CheckCircle2}
                label="Tamamlandı"
                value={`${overallCompleted}/${overallTotal}`}
                tone="emerald"
              />

              <HeroStat
                icon={CircleDollarSign}
                label="Götürüləcək"
                value={formatNumber(
                  totalClaimable
                )}
                suffix="A"
                tone="amber"
              />

              <HeroStat
                icon={Star}
                label="Account"
                value={`Lv.${data.accountLevel}`}
                tone="violet"
              />

              <HeroStat
                icon={Crown}
                label="Season"
                value={`Lv.${data.season.level}`}
                tone="cyan"
              />
            </div>
          </div>

          <div className="mt-9 grid gap-3 xl:grid-cols-[1fr_340px]">
            <div className={styles.progressPanel}>
              <div className="flex items-center justify-between gap-5">
                <div>
                  <p className="text-[8px] font-semibold uppercase tracking-[0.18em] text-white/20">
                    Ümumi missiya irəliləyişi
                  </p>

                  <p className="mt-2 text-[13px] font-medium text-white/65">
                    {overallCompleted} /{" "}
                    {overallTotal} tapşırıq
                  </p>
                </div>

                <span className="font-mono text-[12px] font-semibold text-cyan-100/55">
                  {Math.round(
                    overallProgress
                  )}
                  %
                </span>
              </div>

              <div className="mt-4 h-2 overflow-hidden rounded-full border border-white/[0.035] bg-white/[0.035] p-[1px]">
                <div
                  className={`${styles.progressFill} ${styles.progressCyan}`}
                  style={{
                    width: `${overallProgress}%`,
                  }}
                />
              </div>
            </div>

            <div className={styles.claimSummary}>
              <div className="flex items-center gap-3">
                <div className={`${styles.iconBox} ${styles.toneAmber}`}>
                  <Gift className="h-4 w-4" />
                </div>

                <div>
                  <p className="text-[8px] font-semibold uppercase tracking-[0.16em] text-white/20">
                    Hazır mükafat
                  </p>

                  <p className="mt-1 text-[15px] font-semibold tracking-[-0.02em] text-white/75">
                    {totalClaimable > 0
                      ? `${formatNumber(totalClaimable)} Aura`
                      : "Hələ yoxdur"}
                  </p>
                </div>
              </div>

              <ChevronRight className="h-4 w-4 text-white/15" />
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section
        className={`${styles.howItWorks} ${styles.revealDelayOne}`}
      >
        <div className="flex items-center gap-3">
          <Sparkles className="h-4 w-4 text-violet-200/50" />

          <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-white/25">
            Necə işləyir?
          </p>
        </div>

        <div className="mt-5 grid gap-2 md:grid-cols-3">
          <HowStep
            number="01"
            icon={Target}
            title="Tapşırığı gör"
            text="Gündəlik, həftəlik və müqavilə hədəflərini seç."
            tone="cyan"
          />

          <HowStep
            number="02"
            icon={Gamepad2}
            title="Octoson-da oyna"
            text="Uyğun fəaliyyət etdikcə progress avtomatik artır."
            tone="violet"
          />

          <HowStep
            number="03"
            icon={Gift}
            title="Mükafatı götür"
            text="100%-ə çatanda Aura və XP-ni bir kliklə hesabına əlavə et."
            tone="amber"
          />
        </div>
      </section>

      {/* SEASON */}
      <section
        className={`${styles.seasonCard} ${styles.revealDelayTwo}`}
      >
        <div className="relative flex flex-col justify-between gap-6 md:flex-row md:items-center">
          <div className="flex items-center gap-4">
            <div className={`${styles.bigIconBox} ${styles.toneViolet}`}>
              <Orbit className="h-5 w-5" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <p className="text-[8px] font-semibold uppercase tracking-[0.2em] text-violet-100/35">
                  Season progression
                </p>

                <span className="rounded-full border border-violet-200/[0.1] bg-violet-200/[0.035] px-2 py-0.5 text-[7px] font-semibold text-violet-100/40">
                  S1
                </span>
              </div>

              <h2 className="mt-1.5 text-[18px] font-semibold tracking-[-0.035em] text-white/80">
                Səviyyə{" "}
                {data.season.level}
              </h2>
            </div>
          </div>

          <div className="w-full md:max-w-[430px]">
            <div className="flex items-end justify-between gap-4">
              <span className="text-[9px] text-white/25">
                {formatNumber(
                  data.season.xp
                )}{" "}
                /{" "}
                {formatNumber(
                  data.season.nextLevelXp
                )}{" "}
                XP
              </span>

              <span className="font-mono text-[10px] font-semibold text-violet-100/50">
                {Math.round(
                  data.season.progress
                )}
                %
              </span>
            </div>

            <div className="mt-3 h-2 overflow-hidden rounded-full border border-white/[0.035] bg-white/[0.035] p-[1px]">
              <div
                className={`${styles.progressFill} ${styles.progressViolet}`}
                style={{
                  width: `${data.season.progress}%`,
                }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* TABS */}
      <section
        className={`${styles.tabsShell} ${styles.revealDelayThree}`}
      >
        <div className={styles.tabs}>
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active =
              activeTab === tab.key;

            return (
              <button
                key={tab.key}
                type="button"
                onClick={() =>
                  setActiveTab(tab.key)
                }
                className={`${styles.tab} ${
                  active
                    ? styles.tabActive
                    : ""
                }`}
              >
                <Icon className="h-3.5 w-3.5" />

                <span>
                  {tab.label}
                </span>

                <span
                  className={
                    styles.tabCount
                  }
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        <div className={styles.tabContent}>
          {activeTab === "daily" && (
            <MissionGrid
              key="daily"
              title="Gündəlik missiyalar"
              subtitle="Hər UTC günü yenilənir"
              missions={daily}
              completed={completedDaily}
              claimed={claimedDaily}
              accent="cyan"
            />
          )}

          {activeTab === "weekly" && (
            <MissionGrid
              key="weekly"
              title="Həftəlik missiyalar"
              subtitle="Daha böyük hədəflər, daha yüksək mükafatlar"
              missions={weekly}
              completed={completedWeekly}
              claimed={claimedWeekly}
              accent="violet"
            />
          )}

          {activeTab ===
            "contract" && (
            <ContractView
              contract={
                data.activeContract
              }
            />
          )}

          {activeTab ===
            "bounty" && (
            <BountyView
              bounties={
                data.activeBounties
              }
            />
          )}
        </div>
      </section>
    </div>
  );
}

function HeroStat({
  icon: Icon,
  label,
  value,
  suffix,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  suffix?: string;
  tone:
    | "cyan"
    | "violet"
    | "amber"
    | "emerald";
}) {
  return (
    <div className={`${styles.heroStat} ${styles[`tone${tone[0].toUpperCase()}${tone.slice(1)}`]}`}>
      <div className="flex items-center justify-between">
        <Icon className="h-3.5 w-3.5 opacity-65" />

        <ArrowRight className="h-3 w-3 text-white/10" />
      </div>

      <div className="mt-5">
        <p className="text-[19px] font-semibold tracking-[-0.04em] text-white/85">
          {value}
          {suffix ? (
            <span className="ml-1 text-[9px] text-white/25">
              {suffix}
            </span>
          ) : null}
        </p>

        <p className="mt-1 text-[7px] font-semibold uppercase tracking-[0.16em] text-white/20">
          {label}
        </p>
      </div>
    </div>
  );
}

function HowStep({
  number,
  icon: Icon,
  title,
  text,
  tone,
}: {
  number: string;
  icon: LucideIcon;
  title: string;
  text: string;
  tone:
    | "cyan"
    | "violet"
    | "amber";
}) {
  return (
    <div className={styles.howStep}>
      <div className="flex items-center justify-between">
        <div className={`${styles.iconBox} ${styles[`tone${tone[0].toUpperCase()}${tone.slice(1)}`]}`}>
          <Icon className="h-4 w-4" />
        </div>

        <span className="font-mono text-[8px] text-white/10">
          {number}
        </span>
      </div>

      <h3 className="mt-5 text-[13px] font-semibold tracking-[-0.02em] text-white/70">
        {title}
      </h3>

      <p className="mt-2 max-w-xs text-[9px] leading-5 text-white/24">
        {text}
      </p>
    </div>
  );
}

function MissionGrid({
  title,
  subtitle,
  missions,
  completed,
  claimed,
  accent,
}: {
  title: string;
  subtitle: string;
  missions: Mission[];
  completed: number;
  claimed: number;
  accent: "cyan" | "violet";
}) {
  return (
    <div className={styles.panelEnter}>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <div className="flex items-center gap-2">
            {accent === "cyan" ? (
              <CalendarDays className="h-4 w-4 text-cyan-100/45" />
            ) : (
              <Trophy className="h-4 w-4 text-violet-100/45" />
            )}

            <span className="text-[8px] font-semibold uppercase tracking-[0.18em] text-white/20">
              Missiyalar
            </span>
          </div>

          <h2 className="mt-2 text-[23px] font-semibold tracking-[-0.04em] text-white/80">
            {title}
          </h2>

          <p className="mt-1.5 text-[9px] text-white/22">
            {subtitle}
          </p>
        </div>

        <div className="flex gap-2">
          <MiniStat
            label="Tamam"
            value={`${completed}/${missions.length}`}
          />

          <MiniStat
            label="Götürülüb"
            value={String(claimed)}
          />

          <MiniStat
            label="Cəmi Aura"
            value={formatNumber(
              totalRewards(missions)
            )}
          />
        </div>
      </div>

      <div className="mt-7 grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
        {missions.length ? (
          missions.map(
            (mission, index) => (
              <MissionCard
                key={mission.id}
                mission={mission}
                index={index}
              />
            )
          )
        ) : (
          <EmptyState
            icon={Target}
            title="Missiya yoxdur"
            description="Yeni missiyalar yaradıldıqda burada görünəcək."
          />
        )}
      </div>
    </div>
  );
}

function MissionCard({
  mission,
  index,
}: {
  mission: Mission;
  index: number;
}) {
  const [guideOpen, setGuideOpen] =
    useState(false);

  const guide =
    missionGuide(mission);

  const Icon =
    METRIC_ICONS[mission.metric] ??
    Target;

  const tone =
    metricTone(mission.metric);

  const pct = percent(
    mission.progress,
    mission.target
  );

  const complete =
    mission.progress >=
    mission.target;

  const claimed =
    Boolean(mission.claimedAt);

  const diff =
    difficulty(mission);

  const toneClass =
    styles[
      `tone${tone[0].toUpperCase()}${tone.slice(1)}`
    ];

  return (
    <article
      className={`${styles.missionCard} ${
        complete
          ? styles.missionComplete
          : ""
      }`}
      style={{
        animationDelay: `${Math.min(index, 8) * 45}ms`,
      }}
    >
      <div
        className={
          styles.cardShine
        }
      />

      <div className="relative">
        <div className="flex items-start justify-between gap-4">
          <div
            className={`${styles.bigIconBox} ${toneClass}`}
          >
            {complete ? (
              <Check className="h-4.5 w-4.5" />
            ) : (
              <Icon className="h-4.5 w-4.5" />
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              className={styles.missionHelpButton}
              onClick={() =>
                setGuideOpen(true)
              }
              aria-label={`${mission.title} üçün kömək`}
              title="Necə tamamlanır?"
            >
              <HelpCircle className="h-3.5 w-3.5" />
            </button>

            <span
              className={`${styles.badge} ${
                styles[
                  `tone${diff.tone[0].toUpperCase()}${diff.tone.slice(1)}`
                ]
              }`}
            >
              {diff.name}
            </span>

            {claimed ? (
              <span
                className={`${styles.badge} ${styles.toneEmerald}`}
              >
                <BadgeCheck className="h-2.5 w-2.5" />
                Götürülüb
              </span>
            ) : complete ? (
              <span
                className={`${styles.badge} ${styles.toneEmerald}`}
              >
                Hazırdır
              </span>
            ) : null}
          </div>
        </div>

        <div className="mt-6">
          <p className="text-[7px] font-semibold uppercase tracking-[0.19em] text-white/18">
            {metricLabel(
              mission.metric
            )}
          </p>

          <h3 className="mt-2 text-[16px] font-semibold tracking-[-0.03em] text-white/80">
            {mission.title}
          </h3>

          <p className="mt-2 min-h-10 text-[9px] leading-5 text-white/24">
            {mission.description}
          </p>
        </div>

        <div className="mt-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <span className="font-mono text-[13px] font-semibold text-white/65">
                {formatNumber(
                  mission.progress
                )}
              </span>

              <span className="mx-1.5 text-white/12">
                /
              </span>

              <span className="font-mono text-[9px] text-white/25">
                {formatNumber(
                  mission.target
                )}
              </span>
            </div>

            <span className="font-mono text-[9px] text-white/24">
              {Math.round(pct)}%
            </span>
          </div>

          <div className="mt-3 h-[7px] overflow-hidden rounded-full bg-white/[0.04]">
            <div
              className={`${styles.progressFill} ${
                complete
                  ? styles.progressEmerald
                  : tone === "violet"
                    ? styles.progressViolet
                    : tone === "amber"
                      ? styles.progressAmber
                      : tone === "rose"
                        ? styles.progressRose
                        : styles.progressCyan
              }`}
              style={{
                width: `${pct}%`,
              }}
            />
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-1.5">
          <Reward
            icon={CircleDollarSign}
            value={`+${formatNumber(
              mission.auraReward
            )}`}
            label="Aura"
            tone="amber"
          />

          <Reward
            icon={Star}
            value={`+${formatNumber(
              mission.xpReward
            )}`}
            label="XP"
            tone="violet"
          />

          <Reward
            icon={Zap}
            value={`+${formatNumber(
              mission.seasonXpReward
            )}`}
            label="Season"
            tone="cyan"
          />
        </div>

        <div className="mt-6 flex items-center justify-between gap-3 border-t border-white/[0.045] pt-4">
          <div className="flex items-center gap-2">
            {complete ? (
              <>
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-200/45" />

                <span className="text-[8px] font-medium text-emerald-100/40">
                  Tamamlandı
                </span>
              </>
            ) : (
              <>
                <TimerReset className="h-3.5 w-3.5 text-white/18" />

                <span className="text-[8px] text-white/20">
                  Davam edir
                </span>
              </>
            )}
          </div>

          <EarnClaimButton
            missionId={mission.id}
            complete={complete}
            claimed={claimed}
            action={
              claimMissionAction
            }
          />
        </div>
      </div>

      {guideOpen ? (
        <div
          className={styles.missionGuideBackdrop}
          role="presentation"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              setGuideOpen(false);
            }
          }}
        >
          <div
            className={styles.missionGuideModal}
            role="dialog"
            aria-modal="true"
            aria-label={`${mission.title} missiya köməyi`}
          >
            <div
              className={
                styles.missionGuideGlow
              }
            />

            <div className="relative">
              <div className={styles.missionGuideTop}>
                <div
                  className={`${styles.missionGuideIcon} ${toneClass}`}
                >
                  <Icon className="h-4 w-4" />
                </div>

                <div className="min-w-0 flex-1">
                  <p className={styles.missionGuideEyebrow}>
                    {mission.periodType ===
                    "weekly"
                      ? "HƏFTƏLİK MİSSİYA"
                      : "GÜNLÜK MİSSİYA"}
                  </p>

                  <h4 className={styles.missionGuideTitle}>
                    {mission.title}
                  </h4>
                </div>

                <button
                  type="button"
                  className={styles.missionGuideClose}
                  onClick={() =>
                    setGuideOpen(false)
                  }
                  aria-label="Bağla"
                >
                  ×
                </button>
              </div>

              <div className={styles.missionGuideBody}>
                <div>
                  <p className={styles.missionGuideSectionLabel}>
                    NECƏ TAMAMLANIR?
                  </p>

                  <h5 className={styles.missionGuideHeading}>
                    {guide.title}
                  </h5>

                  <p className={styles.missionGuideDescription}>
                    {guide.description}
                  </p>
                </div>

                <div className={styles.missionGuideSteps}>
                  {guide.steps.map(
                    (step, stepIndex) => (
                      <div
                        key={step}
                        className={styles.missionGuideStep}
                      >
                        <span
                          className={
                            styles.missionGuideStepNumber
                          }
                        >
                          {stepIndex + 1}
                        </span>

                        <span>{step}</span>
                      </div>
                    )
                  )}
                </div>

                <div className={styles.missionGuideProgress}>
                  <div className={styles.missionGuideProgressTop}>
                    <span>İrəliləyiş</span>

                    <strong>
                      {formatNumber(
                        mission.progress
                      )}{" "}
                      /{" "}
                      {formatNumber(
                        mission.target
                      )}
                    </strong>
                  </div>

                  <div
                    className={
                      styles.missionGuideProgressTrack
                    }
                  >
                    <div
                      className={`${styles.missionGuideProgressFill} ${
                        complete
                          ? styles.progressEmerald
                          : tone === "violet"
                            ? styles.progressViolet
                            : tone === "amber"
                              ? styles.progressAmber
                              : tone === "rose"
                                ? styles.progressRose
                                : styles.progressCyan
                      }`}
                      style={{
                        width: `${pct}%`,
                      }}
                    />
                  </div>

                  <div className={styles.missionGuideProgressBottom}>
                    <span>
                      {guide.remaining}
                    </span>

                    <strong>
                      {Math.round(pct)}%
                    </strong>
                  </div>
                </div>

                <div className={styles.missionGuideRewards}>
                  <Reward
                    icon={CircleDollarSign}
                    value={`+${formatNumber(
                      mission.auraReward
                    )}`}
                    label="Aura"
                    tone="amber"
                  />

                  <Reward
                    icon={Star}
                    value={`+${formatNumber(
                      mission.xpReward
                    )}`}
                    label="XP"
                    tone="violet"
                  />

                  <Reward
                    icon={Zap}
                    value={`+${formatNumber(
                      mission.seasonXpReward
                    )}`}
                    label="Season"
                    tone="cyan"
                  />
                </div>

                <button
                  type="button"
                  className={styles.missionGuideDone}
                  onClick={() =>
                    setGuideOpen(false)
                  }
                >
                  Başa düşdüm
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </article>
  );
}

function ContractView({
  contract,
}: {
  contract: ActiveContract;
}) {
  if (!contract) {
    return (
      <div className={styles.panelEnter}>
        <EmptyState
          icon={ShieldCheck}
          title="Aktiv müqavilə yoxdur"
          description="Yeni şəxsi müqavilə yaradıldıqda burada görünəcək."
        />
      </div>
    );
  }

  const complete =
    contract.progress >=
    contract.target;

  const pct =
    percent(
      contract.progress,
      contract.target
    );

  const Icon =
    METRIC_ICONS[contract.metric] ??
    Target;

  return (
    <div className={styles.panelEnter}>
      <div className="grid gap-3 xl:grid-cols-[1.4fr_.6fr]">
        <div className={styles.contractHero}>
          <div
            className={
              styles.contractGlow
            }
          />

          <div className="relative">
            <div className="flex items-start justify-between gap-5">
              <div
                className={`${styles.bigIconBox} ${
                  complete
                    ? styles.toneEmerald
                    : styles.toneViolet
                }`}
              >
                {complete ? (
                  <BadgeCheck className="h-5 w-5" />
                ) : (
                  <Icon className="h-5 w-5" />
                )}
              </div>

              <span
                className={`${styles.badge} ${
                  complete
                    ? styles.toneEmerald
                    : styles.toneViolet
                }`}
              >
                {complete
                  ? "Tamamlandı"
                  : "Aktiv müqavilə"}
              </span>
            </div>

            <div className="mt-10">
              <p className="text-[8px] font-semibold uppercase tracking-[0.2em] text-violet-100/30">
                Şəxsi müqavilə
              </p>

              <h2 className="mt-2 text-[28px] font-semibold tracking-[-0.045em] text-white/85">
                {contract.title}
              </h2>

              <p className="mt-3 max-w-xl text-[10px] leading-5 text-white/25">
                Bu müqavilə yalnız sənə
                aiddir. Hədəfi vaxt
                bitmədən tamamla və daha
                yüksək mükafatı götür.
              </p>
            </div>

            <div className="mt-9">
              <div className="flex items-end justify-between">
                <div>
                  <span className="font-mono text-[18px] font-semibold text-white/75">
                    {formatNumber(
                      contract.progress
                    )}
                  </span>

                  <span className="mx-2 text-white/15">
                    /
                  </span>

                  <span className="font-mono text-[11px] text-white/25">
                    {formatNumber(
                      contract.target
                    )}
                  </span>
                </div>

                <span className="font-mono text-[10px] text-violet-100/40">
                  {Math.round(pct)}%
                </span>
              </div>

              <div className="mt-3 h-2.5 overflow-hidden rounded-full border border-white/[0.035] bg-white/[0.035] p-[1px]">
                <div
                  className={`${styles.progressFill} ${
                    complete
                      ? styles.progressEmerald
                      : styles.progressViolet
                  }`}
                  style={{
                    width: `${pct}%`,
                  }}
                />
              </div>
            </div>

            <div className="mt-8 flex flex-wrap gap-2">
              <Reward
                icon={
                  CircleDollarSign
                }
                value={`+${formatNumber(
                  contract.auraReward
                )}`}
                label="Aura"
                tone="amber"
                large
              />

              <Reward
                icon={Star}
                value={`+${formatNumber(
                  contract.xpReward
                )}`}
                label="XP"
                tone="violet"
                large
              />

              <Reward
                icon={Zap}
                value={`+${formatNumber(
                  contract.seasonXpReward
                )}`}
                label="Season XP"
                tone="cyan"
                large
              />
            </div>

            <div className="mt-8 flex flex-col gap-4 border-t border-white/[0.05] pt-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <Clock3 className="h-3.5 w-3.5 text-white/22" />

                <span className="text-[8px] text-white/25">
                  Qalan vaxt:
                </span>

                <span className="font-mono text-[8px] font-semibold text-white/45">
                  {timeLeft(
                    contract.expiresAt
                  )}
                </span>
              </div>

              <ContractClaimButton
                contractId={
                  contract.id
                }
                complete={complete}
                action={
                  claimContractAction
                }
              />
            </div>
          </div>
        </div>

        <div className="grid gap-3">
          <ContractInfoCard
            icon={ShieldCheck}
            label="Status"
            value={
              complete
                ? "Mükafat hazırdır"
                : "İrəliləyiş aktivdir"
            }
            tone={
              complete
                ? "emerald"
                : "violet"
            }
          />

          <ContractInfoCard
            icon={Target}
            label="Hədəf tipi"
            value={metricLabel(
              contract.metric
            )}
            tone="cyan"
          />

          <ContractInfoCard
            icon={Clock3}
            label="Vaxt"
            value={timeLeft(
              contract.expiresAt
            )}
            tone="amber"
          />
        </div>
      </div>
    </div>
  );
}

function ContractInfoCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  tone:
    | "cyan"
    | "violet"
    | "amber"
    | "emerald";
}) {
  return (
    <div className={styles.infoCard}>
      <div
        className={`${styles.iconBox} ${
          styles[
            `tone${tone[0].toUpperCase()}${tone.slice(1)}`
          ]
        }`}
      >
        <Icon className="h-4 w-4" />
      </div>

      <div className="mt-8">
        <p className="text-[7px] font-semibold uppercase tracking-[0.17em] text-white/18">
          {label}
        </p>

        <p className="mt-2 text-[13px] font-semibold text-white/65">
          {value}
        </p>
      </div>
    </div>
  );
}

function BountyView({
  bounties,
}: {
  bounties: Bounty[];
}) {
  return (
    <div className={styles.panelEnter}>
      <div>
        <div className="flex items-center gap-2">
          <Crosshair className="h-4 w-4 text-rose-200/45" />

          <span className="text-[8px] font-semibold uppercase tracking-[0.18em] text-white/20">
            Limited objectives
          </span>
        </div>

        <h2 className="mt-2 text-[23px] font-semibold tracking-[-0.04em] text-white/80">
          Aktiv bounty-lər
        </h2>

        <p className="mt-1.5 text-[9px] text-white/22">
          Vaxt bitmədən hədəfi
          tamamla.
        </p>
      </div>

      <div className="mt-7 grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
        {bounties.length ? (
          bounties.map(
            (bounty, index) => (
              <BountyCard
                key={bounty.id}
                bounty={bounty}
                index={index}
              />
            )
          )
        ) : (
          <EmptyState
            icon={Crosshair}
            title="Aktiv bounty yoxdur"
            description="Yeni bounty aktivləşəndə burada görünəcək."
          />
        )}
      </div>
    </div>
  );
}

function BountyCard({
  bounty,
  index,
}: {
  bounty: Bounty;
  index: number;
}) {
  const complete =
    bounty.progress >=
    bounty.target;

  const pct = percent(
    bounty.progress,
    bounty.target
  );

  return (
    <article
      className={`${styles.missionCard} ${
        complete
          ? styles.missionComplete
          : ""
      }`}
      style={{
        animationDelay: `${index * 55}ms`,
      }}
    >
      <div className="relative">
        <div className="flex items-start justify-between">
          <div className={`${styles.bigIconBox} ${styles.toneRose}`}>
            <Crosshair className="h-4.5 w-4.5" />
          </div>

          <span
            className={`${styles.badge} ${
              complete
                ? styles.toneEmerald
                : styles.toneRose
            }`}
          >
            {complete
              ? "Tamamlandı"
              : timeLeft(
                  bounty.endsAt
                )}
          </span>
        </div>

        <h3 className="mt-6 text-[16px] font-semibold tracking-[-0.03em] text-white/80">
          {bounty.title}
        </h3>

        <p className="mt-2 min-h-10 text-[9px] leading-5 text-white/24">
          {bounty.description}
        </p>

        <div className="mt-6 flex items-end justify-between">
          <span className="font-mono text-[12px] font-semibold text-white/60">
            {formatNumber(
              bounty.progress
            )}
            <span className="mx-1.5 text-white/12">
              /
            </span>
            <span className="text-[9px] text-white/25">
              {formatNumber(
                bounty.target
              )}
            </span>
          </span>

          <span className="font-mono text-[9px] text-rose-100/35">
            {Math.round(pct)}%
          </span>
        </div>

        <div className="mt-3 h-[7px] overflow-hidden rounded-full bg-white/[0.04]">
          <div
            className={`${styles.progressFill} ${
              complete
                ? styles.progressEmerald
                : styles.progressRose
            }`}
            style={{
              width: `${pct}%`,
            }}
          />
        </div>

        <div className="mt-6 flex flex-wrap gap-1.5">
          <Reward
            icon={CircleDollarSign}
            value={`+${formatNumber(
              bounty.auraReward
            )}`}
            label="Aura"
            tone="amber"
          />

          <Reward
            icon={Star}
            value={`+${formatNumber(
              bounty.xpReward
            )}`}
            label="XP"
            tone="violet"
          />

          <Reward
            icon={Zap}
            value={`+${formatNumber(
              bounty.seasonXpReward
            )}`}
            label="Season"
            tone="cyan"
          />
        </div>
      </div>
    </article>
  );
}

function Reward({
  icon: Icon,
  value,
  label,
  tone,
  large = false,
}: {
  icon: LucideIcon;
  value: string;
  label: string;
  tone:
    | "cyan"
    | "violet"
    | "amber";
  large?: boolean;
}) {
  return (
    <div
      className={`${styles.reward} ${
        styles[
          `tone${tone[0].toUpperCase()}${tone.slice(1)}`
        ]
      } ${
        large
          ? styles.rewardLarge
          : ""
      }`}
    >
      <Icon className="h-3 w-3 opacity-55" />

      <span className="font-mono text-[8px] font-semibold">
        {value}
      </span>

      <span className="text-[7px] opacity-45">
        {label}
      </span>
    </div>
  );
}

function MiniStat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className={styles.miniStat}>
      <p className="font-mono text-[10px] font-semibold text-white/55">
        {value}
      </p>

      <p className="mt-1 text-[6px] font-semibold uppercase tracking-[0.14em] text-white/16">
        {label}
      </p>
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className={`${styles.emptyState} md:col-span-2 2xl:col-span-3`}>
      <div
        className={`${styles.bigIconBox} ${styles.toneCyan}`}
      >
        <Icon className="h-5 w-5" />
      </div>

      <h3 className="mt-5 text-[15px] font-semibold text-white/60">
        {title}
      </h3>

      <p className="mt-2 text-[9px] text-white/22">
        {description}
      </p>
    </div>
  );
}
