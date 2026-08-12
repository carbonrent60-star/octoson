"use client";

import Link from "next/link";
import {
  useRouter,
} from "next/navigation";
import {
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";

import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
} from "motion/react";

import {
  ArrowRight,
  CalendarDays,
  Check,
  ChevronRight,
  CircleDollarSign,
  Coins,
  Crown,
  Gamepad2,
  Gem,
  Globe2,
  LoaderCircle,
  LockKeyhole,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  Star,
  Trophy,
  WalletCards,
  Zap,
} from "lucide-react";

import {
  buyPrimeAction,
  claimPrimeMissionAction,
  refundPrimeLossAction,
} from "./actions";

import styles from "./prime.module.css";

type PrimeLoss = {
  id: string;
  game: string;
  bet: number;
  lossAmount: number;
  net: number;
  createdAt: number;
  expiresAt: number;
  refunded: boolean;
  refundedAt: number | null;
};

export type PrimeView = {
  active: boolean;
  price: number;
  activeUntil: number | null;
  purchasedAt: number | null;
  refundsRemaining: number;
  refundLimit: number;
  losses: PrimeLoss[];
  allLosses: PrimeLoss[];
};

export type PrimeMissionView = {
  id: string;
  periodType:
    | "daily"
    | "weekly";
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

type SeasonView = {
  level: number;
  xp: number;
  nextLevelXp: number;
  progress: number;
};

const MONTHS = [
  "yan",
  "fev",
  "mar",
  "apr",
  "may",
  "iyn",
  "iyl",
  "avq",
  "sen",
  "okt",
  "noy",
  "dek",
];

function aura(value: number) {
  return Math.max(
    0,
    Math.floor(
      Number(value) || 0
    )
  ).toLocaleString("en-US");
}

function date(value: number | null) {
  if (!value) return "—";

  const d =
    new Date(value);

  if (
    Number.isNaN(
      d.getTime()
    )
  ) {
    return "—";
  }

  return [
    String(
      d.getDate()
    ).padStart(2, "0"),
    MONTHS[
      d.getMonth()
    ],
    d.getFullYear(),
  ].join(" ");
}

function daysRemaining(
  value: number | null
) {
  if (!value) return 0;

  return Math.max(
    0,
    Math.ceil(
      (value - Date.now()) /
        86_400_000
    )
  );
}

function gameName(game: string) {
  const names:
    Record<string, string> = {
      slots: "Slots",
      mines: "Mines",
      crash: "Crash",
      roulette: "Rulet",
      blackjack:
        "Blackjack",
      baccarat: "Baccarat",
      higherlower:
        "Higher / Lower",
      risk: "Risk",
      coinflip: "Coinflip",
      dice: "Dice",
      wheel: "Wheel",
    };

  return names[game] ?? game;
}

function MissionMetricIcon({
  metric,
}: {
  metric: string;
}) {
  const className =
    "h-4 w-4 text-amber-100/48";

  switch (metric) {
    case "game_played":
      return (
        <Gamepad2
          className={className}
        />
      );

    case "casino_bet":
      return (
        <CircleDollarSign
          className={className}
        />
      );

    case "aura_earned":
      return (
        <Coins
          className={className}
        />
      );

    case "activity":
      return (
        <Zap
          className={className}
        />
      );

    default:
      return (
        <Star
          className={className}
        />
      );
  }
}

export default function PrimeClient({
  prime,
  balance,
  missions,
  season,
}: {
  prime: PrimeView;
  balance: number;
  missions: PrimeMissionView[];
  season: SeasonView;
}) {
  const router = useRouter();

  const [primeView, setPrimeView] =
    useState<"landing" | "details">(
      prime.active ? "details" : "landing"
    );

  const reduceMotion =
    useReducedMotion();

  const [
    pending,
    startTransition,
  ] =
    useTransition();

  const [
    activeAction,
    setActiveAction,
  ] =
    useState<
      string | null
    >(null);

  const [
    message,
    setMessage,
  ] =
    useState<
      string | null
    >(null);

  const [
    messageOk,
    setMessageOk,
  ] =
    useState(false);

  const usedRefunds =
    Math.max(
      0,
      prime.refundLimit -
        prime.refundsRemaining
    );

  const refundPercent =
    prime.refundLimit > 0
      ? Math.max(
          0,
          Math.min(
            100,
            (
              prime.refundsRemaining /
              prime.refundLimit
            ) * 100
          )
        )
      : 0;

  const remainingDays =
    daysRemaining(
      prime.activeUntil
    );

  const missionStats =
    useMemo(() => {
      const completed =
        missions.filter(
          (mission) =>
            mission.progress >=
            mission.target
        ).length;

      const claimed =
        missions.filter(
          (mission) =>
            Boolean(
              mission.claimedAt
            )
        ).length;

      return {
        completed,
        claimed,
        total:
          missions.length,
      };
    }, [missions]);

  const featuredMissions =
    useMemo(() => {
      return [...missions]
        .sort((a, b) => {
          const aClaimed =
            a.claimedAt
              ? 1
              : 0;

          const bClaimed =
            b.claimedAt
              ? 1
              : 0;

          if (
            aClaimed !==
            bClaimed
          ) {
  return (
              aClaimed -
              bClaimed
            );
          }

          const aComplete =
            a.progress >=
            a.target
              ? 1
              : 0;

          const bComplete =
            b.progress >=
            b.target
              ? 1
              : 0;

          return (
            bComplete -
            aComplete
          );
        })
        .slice(0, 4);
    }, [missions]);

  function runBuy() {
    setActiveAction("buy");

    startTransition(
      async () => {
        const result =
          await buyPrimeAction();

        setMessage(
          result.message
        );

        setMessageOk(
          result.ok
        );

        setActiveAction(
          null
        );

        if (result.ok) {
          router.refresh();
        }
      }
    );
  }

  function runRefund(
    lossId: string
  ) {
    setActiveAction(
      `refund:${lossId}`
    );

    startTransition(
      async () => {
        const result =
          await refundPrimeLossAction(
            lossId
          );

        setMessage(
          result.message
        );

        setMessageOk(
          result.ok
        );

        setActiveAction(
          null
        );

        if (result.ok) {
          router.refresh();
        }
      }
    );
  }

  function runMissionClaim(
    missionId: string
  ) {
    setActiveAction(
      `mission:${missionId}`
    );

    startTransition(
      async () => {
        const result =
          await claimPrimeMissionAction(
            missionId
          );

        setMessage(
          result.message
        );

        setMessageOk(
          result.ok
        );

        setActiveAction(
          null
        );

        if (result.ok) {
          router.refresh();
        }
      }
    );
  }

  const enter =
    reduceMotion
      ? {}
      : {
          initial: {
            opacity: 0,
            y: 14,
          },
          animate: {
            opacity: 1,
            y: 0,
          },
        };

  // PRIME_LANDING_VIEW_V3
  if (!prime.active && primeView === "landing") {
    return (
      <div
        className={`${styles.page} mx-auto max-w-[1280px] pb-24`}
      >
        <PrimeNonMemberStory
          price={prime.price}
          balance={balance}
          pending={pending}
          buying={activeAction === "buy"}
          onBuy={runBuy}
          onLearnMore={() => {
            setPrimeView("details");

            window.scrollTo({
              top: 0,
              behavior: reduceMotion
                ? "auto"
                : "smooth",
            });
          }}
        />
      </div>
    );
  }

  return (
    <div
      className={`${styles.page} mx-auto max-w-[1280px] pb-24`}
    >
      <motion.section
        {...enter}
        transition={{
          duration: 0.5,
          ease: [
            0.22,
            1,
            0.36,
            1,
          ],
        }}
        className={`${styles.hero} rounded-[30px] border border-amber-100/[0.11] px-6 py-7 sm:px-8 sm:py-9 lg:px-10 lg:py-10`}
      >
        <div
          aria-hidden="true"
          className={
            styles.ambientGlow
          }
        />

        <div
          aria-hidden="true"
          className={
            styles.lightSweep
          }
        />

        <div className="relative z-[3] grid min-h-[340px] gap-10 lg:grid-cols-[1fr_420px] lg:items-center">
          <div className="max-w-[650px]">
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-full border border-amber-100/[0.12] bg-amber-100/[0.045]">
                <Crown className="h-3.5 w-3.5 text-amber-100/75" />
              </div>

              <span className="text-[9px] font-bold uppercase tracking-[0.25em] text-amber-100/55">
                OCTOSON PRIME
              </span>

              {prime.active ? (
                <span className="rounded-full border border-emerald-200/[0.14] bg-emerald-200/[0.05] px-2.5 py-1 text-[8px] font-bold uppercase tracking-[0.14em] text-emerald-100/70">
                  Prime active
                </span>
              ) : (
                <span className="rounded-full border border-white/[0.07] bg-white/[0.025] px-2.5 py-1 text-[8px] font-bold uppercase tracking-[0.14em] text-white/30">
                  Members access
                </span>
              )}
            </div>

            <h1 className="mt-6 max-w-[600px] text-[40px] font-semibold leading-[0.98] tracking-[-0.06em] text-white sm:text-[54px] lg:text-[64px]">
              Daha az risk.
              <br />
              <span className="text-amber-50/88">
                Daha çox imkan.
              </span>
            </h1>

            <p className="mt-6 max-w-[560px] text-[13px] leading-6 text-white/36 sm:text-[14px]">
              Octoson Prime sadəcə
              badge deyil. Loss
              Protection, eksklüziv
              daily və weekly
              missiyalar, Season
              progression və premium
              identity bir üzvlükdə
              birləşir.
            </p>

            <div className="mt-7 flex flex-wrap gap-2">
              <HeroChip
                icon={
                  ShieldCheck
                }
                text="6 loss refund"
              />

              <HeroChip
                icon={Star}
                text="Prime missions"
              />

              <HeroChip
                icon={Trophy}
                text="Season XP"
              />

              <HeroChip
                icon={Gem}
                text="Prime identity"
              />
            </div>

            {!prime.active ? (
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                <button
                  type="button"
                  onClick={runBuy}
                  disabled={
                    pending ||
                    balance <
                      prime.price
                  }
                  className={`${styles.focusable} inline-flex h-12 items-center justify-center gap-2 rounded-[13px] border border-amber-100/[0.16] bg-amber-100/[0.11] px-5 text-[11px] font-semibold text-amber-50 transition hover:bg-amber-100/[0.16] disabled:cursor-not-allowed disabled:opacity-35`}
                >
                  {activeAction ===
                  "buy" ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  ) : (
                    <Crown className="h-4 w-4" />
                  )}

                  Prime aktivləşdir
                </button>

                <div>
                  <p className="text-[18px] font-semibold tracking-[-0.035em] text-white/72">
                    {aura(
                      prime.price
                    )}{" "}
                    <span className="text-[10px] font-medium text-amber-100/40">
                      Aura
                    </span>
                  </p>

                  <p className="text-[8px] uppercase tracking-[0.13em] text-white/20">
                    30 günlük üzvlük
                  </p>
                </div>
              </div>
            ) : null}

            {!prime.active &&
            balance <
              prime.price ? (
              <p className="mt-3 text-[10px] text-rose-200/50">
                Balansında Prime üçün
                kifayət qədər Aura
                yoxdur. Hazırda{" "}
                <b className="font-semibold text-white/50">
                  {aura(balance)}
                </b>{" "}
                Aura var.
              </p>
            ) : null}
          </div>

          <div className="flex flex-col items-center lg:items-end">
            <div
              aria-hidden="true"
              className={
                styles.sealStage
              }
            >
              <div
                className={
                  styles.orbit
                }
              />

              <div
                className={`${styles.orbit} ${styles.orbitTwo}`}
              />

              <div
                className={`${styles.orbit} ${styles.orbitThree}`}
              />

              <span
                className={`${styles.particle} ${styles.particle1}`}
              />

              <span
                className={`${styles.particle} ${styles.particle2}`}
              />

              <span
                className={`${styles.particle} ${styles.particle3}`}
              />

              <div
                className={
                  styles.seal
                }
              >
                <Crown className="h-9 w-9 text-amber-100/75" />
              </div>
            </div>

            {prime.active ? (
              <div
                className={`${styles.membershipCard} mt-[-20px] w-full max-w-[390px] rounded-[22px] border border-amber-100/[0.12] p-5`}
              >
                <div className="relative z-[2]">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[8px] font-bold uppercase tracking-[0.2em] text-amber-100/42">
                        PRIME ACTIVE
                      </p>

                      <p className="mt-2 text-[22px] font-semibold tracking-[-0.04em] text-white/82">
                        {date(
                          prime.activeUntil
                        )}
                      </p>

                      <p className="mt-1 text-[10px] text-white/28">
                        {remainingDays} gün
                        qalıb
                      </p>
                    </div>

                    <div className="flex h-10 w-10 items-center justify-center rounded-full border border-emerald-200/[0.11] bg-emerald-200/[0.045]">
                      <ShieldCheck className="h-4 w-4 text-emerald-100/60" />
                    </div>
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-2.5">
                    <MiniStatus
                      label="Refund"
                      value={`${prime.refundsRemaining}/${prime.refundLimit}`}
                    />

                    <MiniStatus
                      label="Missiyalar"
                      value={`${missionStats.completed}/${missionStats.total}`}
                    />
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-white/[0.055] pt-3">
                    <span className="text-[8px] uppercase tracking-[0.12em] text-white/18">
                      Season
                    </span>

                    <span className="text-[9px] font-semibold text-white/42">
                      Lv. {season.level}
                    </span>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </motion.section>

      {message ? (
        <motion.div
          initial={
            reduceMotion
              ? false
              : {
                  opacity: 0,
                  y: -5,
                }
          }
          animate={{
            opacity: 1,
            y: 0,
          }}
          className={`mt-4 rounded-[14px] border px-4 py-3 text-[10px] ${
            messageOk
              ? "border-emerald-200/[0.11] bg-emerald-200/[0.035] text-emerald-100/70"
              : "border-rose-200/[0.11] bg-rose-200/[0.035] text-rose-100/65"
          }`}
        >
          {message}
        </motion.div>
      ) : null}

      <motion.section
        {...enter}
        transition={{
          duration: 0.45,
          delay:
            reduceMotion
              ? 0
              : 0.08,
        }}
        className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
      >
        <PrimeStat
          icon={RefreshCcw}
          label="Refund haqqı"
          value={`${prime.refundsRemaining}/${prime.refundLimit}`}
          sub={
            prime.active
              ? `${usedRefunds} istifadə olunub`
              : "Prime ilə açılır"
          }
          accent
        />

        <PrimeStat
          icon={Star}
          label="Prime missiyalar"
          value={`${missionStats.completed}/${missionStats.total}`}
          sub={`${missionStats.claimed} mükafat götürülüb`}
          accent
        />

        <PrimeStat
          icon={Gamepad2}
          label="Refund edilə bilən"
          value={String(
            prime.losses.length
          )}
          sub="uyğun casino itkisi"
        />

        <PrimeStat
          icon={CalendarDays}
          label="Üzvlük"
          value={
            prime.active
              ? `${remainingDays} gün`
              : "Bağlı"
          }
          sub={
            prime.active
              ? date(
                  prime.activeUntil
                )
              : "30 günlük Prime"
          }
        />
      </motion.section>

      <motion.section
        {...enter}
        transition={{
          duration: 0.45,
          delay:
            reduceMotion
              ? 0
              : 0.14,
        }}
        className="mt-4 rounded-[24px] border border-white/[0.065] bg-white/[0.018] p-5 sm:p-6"
      >
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Crown className="h-3.5 w-3.5 text-amber-100/55" />

              <p className="text-[8px] font-bold uppercase tracking-[0.2em] text-amber-100/38">
                PRIME MISSIONS
              </p>
            </div>

            <h2 className="mt-2 text-[21px] font-semibold tracking-[-0.035em] text-white/78">
              Prime missiyalar
            </h2>

            <p className="mt-1 max-w-[570px] text-[10px] leading-5 text-white/26">
              Normal missiyalardan
              bir qədər daha dəyərli
              daily və weekly
              məqsədlər. Progress
              real Octoson gameplay
              sistemindən gəlir.
            </p>
          </div>

          <Link
            href="/dashboard/earn"
            className={`${styles.focusable} inline-flex items-center gap-1.5 text-[9px] font-semibold text-amber-100/52 transition hover:text-amber-100/80`}
          >
            Bütün missiyalara bax
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {featuredMissions.length >
        0 ? (
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {featuredMissions.map(
              (
                mission,
                index
              ) => (
                <MissionCard
                  key={
                    mission.id
                  }
                  mission={
                    mission
                  }
                  active={
                    prime.active
                  }
                  pending={
                    pending
                  }
                  actionActive={
                    activeAction ===
                    `mission:${mission.id}`
                  }
                  reduceMotion={
                    Boolean(
                      reduceMotion
                    )
                  }
                  index={index}
                  onClaim={() =>
                    runMissionClaim(
                      mission.id
                    )
                  }
                />
              )
            )}
          </div>
        ) : (
          <div className="mt-5 rounded-[18px] border border-dashed border-white/[0.06] bg-black/15 px-5 py-10 text-center">
            <Star className="mx-auto h-5 w-5 text-amber-100/24" />

            <p className="mt-3 text-[11px] font-semibold text-white/42">
              Prime missiya
              tapılmadı
            </p>

            <p className="mt-1 text-[9px] text-white/20">
              Mission engine yeni
              period üçün onları
              avtomatik yaradacaq.
            </p>
          </div>
        )}
      </motion.section>

      {prime.active ? (
        <motion.section
          {...enter}
          transition={{
            duration: 0.45,
            delay:
              reduceMotion
                ? 0
                : 0.2,
          }}
          className="mt-4 rounded-[24px] border border-white/[0.065] bg-white/[0.018] p-5 sm:p-6"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[8px] font-bold uppercase tracking-[0.19em] text-amber-100/34">
                LOSS PROTECTION
              </p>

              <h2 className="mt-2 text-[19px] font-semibold tracking-[-0.03em] text-white/72">
                Prime qoruması
              </h2>

              <p className="mt-1 text-[10px] leading-5 text-white/24">
                Hər uyğun casino
                itkisini maksimum bir
                dəfə geri qaytara
                bilərsən.
              </p>
            </div>

            <div className="sm:text-right">
              <p className="text-[28px] font-semibold tracking-[-0.045em] text-white/78">
                {prime.refundsRemaining}
                <span className="text-white/18">
                  /
                  {
                    prime.refundLimit
                  }
                </span>
              </p>

              <p className="text-[8px] uppercase tracking-[0.13em] text-white/18">
                qalan refund
              </p>
            </div>
          </div>

          <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-white/[0.045]">
            <motion.div
              initial={
                reduceMotion
                  ? false
                  : {
                      width: 0,
                    }
              }
              animate={{
                width: `${refundPercent}%`,
              }}
              transition={{
                duration: 0.7,
                ease: [
                  0.22,
                  1,
                  0.36,
                  1,
                ],
              }}
              className="h-full rounded-full bg-gradient-to-r from-amber-200/70 via-amber-100/55 to-amber-50/30"
            />
          </div>

          {prime.refundsRemaining ===
            0 &&
          prime.losses.length >
            0 ? (
            <div className="mt-4 rounded-[13px] border border-amber-100/[0.09] bg-amber-100/[0.025] px-4 py-3 text-[9px] leading-5 text-amber-50/48">
              Bu Prime dövründə
              bütün{" "}
              {prime.refundLimit}{" "}
              refund haqqından
              istifadə etmisən.
              Uyğun itkilər
              görünməyə davam edir,
              amma yeni refund bu
              dövrdə mümkün deyil.
            </div>
          ) : null}
        </motion.section>
      ) : null}

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.4fr_.82fr]">
        <motion.section
          {...enter}
          transition={{
            duration: 0.45,
            delay:
              reduceMotion
                ? 0
                : 0.24,
          }}
          className="rounded-[24px] border border-white/[0.065] bg-white/[0.018] p-5 sm:p-6"
        >
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <p className="text-[8px] font-bold uppercase tracking-[0.18em] text-white/22">
                REFUND CENTER
              </p>

              <h2 className="mt-1.5 text-[18px] font-semibold tracking-[-0.025em] text-white/70">
                Uyğun casino
                nəticələri
              </h2>
            </div>

            <div className="flex h-9 w-9 items-center justify-center rounded-[11px] border border-amber-100/[0.07] bg-amber-100/[0.025]">
              <RefreshCcw className="h-4 w-4 text-amber-100/38" />
            </div>
          </div>

          {!prime.active ? (
            <Empty
              icon={Crown}
              title="Prime tələb olunur"
              text="Loss Protection və Refund Center aktiv Prime üzvlüyü ilə açılır."
            />
          ) : prime.losses
              .length === 0 ? (
            <Empty
              icon={
                ShieldCheck
              }
              title="Refund gözləmir"
              text="Prime aktiv olduqdan sonra uyğun casino itkiləri burada avtomatik görünür."
            />
          ) : (
            <div className="space-y-2.5">
              {prime.losses.map(
                (loss) => (
                  <div
                    key={loss.id}
                    className={`${styles.refundRow} flex flex-col gap-4 rounded-[16px] border border-white/[0.055] bg-black/20 px-4 py-4 sm:flex-row sm:items-center`}
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] border border-amber-100/[0.075] bg-amber-100/[0.028]">
                      <Gamepad2 className="h-4 w-4 text-amber-100/46" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-[11px] font-semibold text-white/64">
                          {gameName(
                            loss.game
                          )}
                        </p>

                        <span className="rounded-md border border-emerald-200/[0.08] bg-emerald-200/[0.025] px-2 py-1 text-[7px] font-semibold uppercase tracking-[0.1em] text-emerald-100/40">
                          Refund hazırdır
                        </span>
                      </div>

                      <div className="mt-2.5 grid gap-2 text-[9px] text-white/24 sm:grid-cols-3">
                        <div>
                          <span>
                            Mərc
                          </span>

                          <p className="mt-0.5 font-semibold text-white/48">
                            {aura(
                              loss.bet
                            )}{" "}
                            Aura
                          </p>
                        </div>

                        <div>
                          <span>
                            Qaytarılacaq
                          </span>

                          <p className="mt-0.5 font-semibold text-emerald-100/65">
                            +
                            {aura(
                              loss.lossAmount
                            )}{" "}
                            Aura
                          </p>
                        </div>

                        <div>
                          <span>
                            Bitir
                          </span>

                          <p className="mt-0.5 font-semibold text-white/42">
                            {date(
                              loss.expiresAt
                            )}
                          </p>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={
                        pending ||
                        prime.refundsRemaining <=
                          0
                      }
                      onClick={() =>
                        runRefund(
                          loss.id
                        )
                      }
                      className={`${styles.focusable} inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-[11px] border border-emerald-200/[0.11] bg-emerald-200/[0.05] px-4 text-[9px] font-semibold text-emerald-100/68 transition hover:bg-emerald-200/[0.085] disabled:cursor-not-allowed disabled:opacity-30`}
                    >
                      {activeAction ===
                      `refund:${loss.id}` ? (
                        <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <RefreshCcw className="h-3.5 w-3.5" />
                      )}

                      Refund et
                    </button>
                  </div>
                )
              )}
            </div>
          )}
        </motion.section>

        <motion.section
          {...enter}
          transition={{
            duration: 0.45,
            delay:
              reduceMotion
                ? 0
                : 0.29,
          }}
          className="rounded-[24px] border border-white/[0.065] bg-white/[0.018] p-5 sm:p-6"
        >
          <p className="text-[8px] font-bold uppercase tracking-[0.19em] text-amber-100/34">
            PRIME PROGRESSION
          </p>

          <h2 className="mt-2 text-[18px] font-semibold tracking-[-0.025em] text-white/70">
            Season statusu
          </h2>

          <p className="mt-1 text-[9px] leading-5 text-white/22">
            Prime ayrıca saxta level
            sistemi yaratmır. Mövcud
            Octoson Season
            progression-u istifadə
            olunur.
          </p>

          <div className="mt-6 rounded-[16px] border border-amber-100/[0.07] bg-amber-100/[0.022] p-4">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-[8px] uppercase tracking-[0.12em] text-white/20">
                  Season level
                </p>

                <p className="mt-1 text-[27px] font-semibold tracking-[-0.045em] text-white/76">
                  {season.level}
                </p>
              </div>

              <p className="text-[9px] font-medium text-amber-100/42">
                {aura(
                  season.xp
                )}
                /
                {aura(
                  season.nextLevelXp
                )}{" "}
                XP
              </p>
            </div>

            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-black/35">
              <motion.div
                initial={
                  reduceMotion
                    ? false
                    : {
                        width: 0,
                      }
                }
                animate={{
                  width: `${Math.max(
                    0,
                    Math.min(
                      100,
                      season.progress
                    )
                  )}%`,
                }}
                transition={{
                  duration: 0.8,
                }}
                className="h-full rounded-full bg-gradient-to-r from-amber-200/65 to-amber-50/30"
              />
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2 text-[8px] text-white/18">
            <WalletCards className="h-3.5 w-3.5" />
            Balans:{" "}
            <span className="font-semibold text-white/36">
              {aura(
                balance
              )}{" "}
              Aura
            </span>
          </div>
        </motion.section>
      </div>

      <motion.section
        {...enter}
        transition={{
          duration: 0.45,
          delay:
            reduceMotion
              ? 0
              : 0.34,
        }}
        className="mt-4 rounded-[24px] border border-white/[0.065] bg-white/[0.018] p-5 sm:p-6"
      >
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-amber-100/48" />

          <p className="text-[8px] font-bold uppercase tracking-[0.19em] text-amber-100/32">
            PRIME BENEFITS
          </p>
        </div>

        <h2 className="mt-2 text-[20px] font-semibold tracking-[-0.03em] text-white/72">
          Prime nə açır?
        </h2>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <Benefit
            icon={
              ShieldCheck
            }
            title="Loss Protection"
            text="Prime dövründə 6 uyğun casino itkisini real balansına geri qaytar."
            large
          />

          <Benefit
            icon={Star}
            title="Prime Missions"
            text="Daily və weekly xüsusi missiyalar, daha yüksək amma balanslı reward-lar."
            large
          />

          <Benefit
            icon={Trophy}
            title="Prime Progression"
            text="Mövcud Season progression ilə əlavə XP və Prime activity dəyəri."
          />

          <Benefit
            icon={Gem}
            title="Premium Identity"
            text="Profil, leaderboard və uyğun Discord kartlarında Prime statusu."
          />

          <Benefit
            icon={Globe2}
            title="Website Control"
            text="Prime üzvlüyü, missiyalar və refund mərkəzi birbaşa saytdan."
          />

          <Benefit
            icon={Zap}
            title="Priority Experience"
            text="Prime xüsusiyyətləri ayrıca görünür, amma əsas Octoson economy-ni pozmur."
          />
        </div>
      </motion.section>
    </div>
  );
}

function PrimeNonMemberStory({
  price,
  balance,
  pending,
  buying,
  onBuy,
  onLearnMore,
}: {
  price: number;
  balance: number;
  pending: boolean;
  buying: boolean;
  onBuy: () => void;
  onLearnMore: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const canBuy = balance >= price;

  const heroRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end end"],
  });

  const heroScale = useTransform(
    scrollYProgress,
    [0, 0.22],
    [1, 0.94]
  );

  const heroOpacity = useTransform(
    scrollYProgress,
    [0, 0.22],
    [1, 0.18]
  );

  const heroY = useTransform(
    scrollYProgress,
    [0, 0.22],
    [0, -70]
  );

  const crownY = useTransform(
    scrollYProgress,
    [0, 0.22],
    [0, -35]
  );

  const crownRotate = useTransform(
    scrollYProgress,
    [0, 0.22],
    [-4, 6]
  );

  const reveal = reduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 36 },
        whileInView: { opacity: 1, y: 0 },
        viewport: { amount: 0.28, once: true },
        transition: {
          duration: 0.75,
          ease: [0.22, 1, 0.36, 1] as const,
        },
      };

  return (
    <div className={styles.primeNew}>
      <motion.div
        className={styles.primeNewProgress}
        style={{ scaleX: scrollYProgress }}
      />

      {/* HERO */}

      <section
        ref={heroRef}
        className={styles.primeNewHeroTrack}
      >
        <div className={styles.primeNewHeroSticky}>
          <div className={styles.primeNewNoise} />
          <div className={styles.primeNewGrid} />
          <div className={styles.primeNewGlowA} />
          <div className={styles.primeNewGlowB} />

          <motion.div
            className={styles.primeNewHero}
            style={
              reduceMotion
                ? undefined
                : {
                    scale: heroScale,
                    opacity: heroOpacity,
                    y: heroY,
                  }
            }
          >
            <div className={styles.primeNewHeroCopy}>
              <div className={styles.primeNewKicker}>
                <i />
                OCTOSON PRIME
              </div>

              <h1>
                Octoson.
                <span>Amma daha güclü.</span>
              </h1>

              <p>
                Casino qoruması, xüsusi missiyalar,
                Season progression və premium status.
                Prime əsas Octoson təcrübəsinin üzərinə
                qurulan premium qatdır.
              </p>

              <div className={styles.primeNewHeroActions}>
                <a href="#prime-benefits">
                  Prime nə verir?
                  <ArrowRight />
                </a>

                <span>
                  30 günlük üzvlük
                </span>
              </div>
            </div>

            <motion.div
              className={styles.primeNewObject}
              style={
                reduceMotion
                  ? undefined
                  : {
                      y: crownY,
                      rotate: crownRotate,
                    }
              }
            >
              <div className={styles.primeNewObjectGlow} />

              <div className={styles.primeNewOrbitA}>
                <i />
              </div>

              <div className={styles.primeNewOrbitB} />

              <div className={styles.primeNewOrbitC} />

              <div className={styles.primeNewBadge}>
                <div>
                  <Crown />
                </div>

                <small>OCTOSON</small>
                <strong>PRIME</strong>
                <span>MEMBERSHIP</span>
              </div>
            </motion.div>
          </motion.div>

          <div className={styles.primeNewScroll}>
            SCROLL TO EXPLORE
            <span />
          </div>
        </div>
      </section>

      {/* INTRO */}

      <section
        id="prime-benefits"
        className={styles.primeNewIntro}
      >
        <motion.div
          {...reveal}
          className={styles.primeNewIntroInner}
        >
          <p className={styles.primeNewSectionLabel}>
            PRIME EXPERIENCE
          </p>

          <h2>
            Sadəcə badge deyil.
            <span>
              Sistem sənə işləyir.
            </span>
          </h2>

          <p className={styles.primeNewIntroText}>
            Prime daha çox Aura göstərmək üçün deyil.
            O, riskini azaldır, əlavə progression açır
            və hesabına görünən premium identity verir.
          </p>
        </motion.div>
      </section>

      {/* LOSS PROTECTION */}

      <section className={styles.primeNewFeature}>
        <motion.div
          {...reveal}
          className={styles.primeNewFeatureInner}
        >
          <div className={styles.primeNewFeatureCopy}>
            <div className={styles.primeNewNumber}>
              01
            </div>

            <p className={styles.primeNewSectionLabel}>
              LOSS PROTECTION
            </p>

            <h2>
              Risk var.
              <span>
                Amma çıxış yolu da var.
              </span>
            </h2>

            <p>
              Prime üzvlüyü zamanı uyğun casino
              itkiləri refund üçün saxlanılır.
              Refund hüququndan istifadə edərək
              seçilmiş itkini Aura balansına
              geri qaytara bilərsən.
            </p>

            <div className={styles.primeNewMiniFact}>
              <ShieldCheck />
              <span>
                Prime dövrü üçün limitli refund hüquqları
              </span>
            </div>
          </div>

          <div className={styles.primeNewRefundDemo}>
            <div className={styles.primeNewLoss}>
              <small>CASINO RESULT</small>
              <span>Crash</span>
              <strong>−12,500</strong>
              <em>Aura</em>
            </div>

            <div className={styles.primeNewRefundLine}>
              <span />
              <div>
                <ShieldCheck />
              </div>
              <span />
            </div>

            <div className={styles.primeNewRefund}>
              <small>PRIME PROTECTION</small>
              <span>Refund approved</span>
              <strong>+12,500</strong>
              <em>Aura returned</em>
            </div>
          </div>
        </motion.div>
      </section>

      {/* MISSIONS */}

      <section className={styles.primeNewFeature}>
        <motion.div
          {...reveal}
          className={`${styles.primeNewFeatureInner} ${styles.primeNewFeatureReverse}`}
        >
          <div className={styles.primeNewMissionWorld}>
            <div className={styles.primeNewMissionGlow} />

            <div className={styles.primeNewMission}>
              <div className={styles.primeNewMissionTop}>
                <span>
                  <Star />
                  PRIME MISSION
                </span>

                <small>DAILY</small>
              </div>

              <p>CASINO USTALIĞI</p>
              <h3>5 oyun qazan</h3>

              <div className={styles.primeNewMissionMeta}>
                <span>Progress</span>
                <strong>4 / 5</strong>
              </div>

              <div className={styles.primeNewMissionBar}>
                <span />
              </div>

              <div className={styles.primeNewRewards}>
                <span>+2,500 Aura</span>
                <span>+150 XP</span>
                <span>+Season XP</span>
              </div>
            </div>

            <div className={styles.primeNewFloatA}>
              +150 XP
            </div>

            <div className={styles.primeNewFloatB}>
              +2,500 Aura
            </div>
          </div>

          <div className={styles.primeNewFeatureCopy}>
            <div className={styles.primeNewNumber}>
              02
            </div>

            <p className={styles.primeNewSectionLabel}>
              PRIME MISSIONS
            </p>

            <h2>
              Oyna.
              <span>
                Progression-u sürətləndir.
              </span>
            </h2>

            <p>
              Prime üzvləri daily və weekly xüsusi
              missiyalar açır. Məqsədləri tamamla,
              Aura, XP və Season XP reward-ları əldə et.
            </p>

            <div className={styles.primeNewMiniFact}>
              <Star />
              <span>
                Prime-a xüsusi daily və weekly objectives
              </span>
            </div>
          </div>
        </motion.div>
      </section>

      {/* IDENTITY */}

      <section className={styles.primeNewFeature}>
        <motion.div
          {...reveal}
          className={styles.primeNewFeatureInner}
        >
          <div className={styles.primeNewFeatureCopy}>
            <div className={styles.primeNewNumber}>
              03
            </div>

            <p className={styles.primeNewSectionLabel}>
              PRIME IDENTITY
            </p>

            <h2>
              Prime olursansa,
              <span>
                görünür.
              </span>
            </h2>

            <p>
              Premium status profilində,
              leaderboard-da və uyğun Octoson
              kartlarında görünür. Prime hesabının
              identity-sinin bir hissəsinə çevrilir.
            </p>

            <div className={styles.primeNewMiniFact}>
              <Gem />
              <span>
                Profil və leaderboard Prime statusu
              </span>
            </div>
          </div>

          <div className={styles.primeNewProfileWorld}>
            <div className={styles.primeNewProfileRingA} />
            <div className={styles.primeNewProfileRingB} />

            <div className={styles.primeNewProfile}>
              <div className={styles.primeNewProfileTop}>
                <div className={styles.primeNewProfileIcon}>
                  <Crown />
                </div>

                <div>
                  <small>OCTOSON</small>
                  <strong>PRIME MEMBER</strong>
                </div>

                <span>PRIME</span>
              </div>

              <div className={styles.primeNewProfileStats}>
                <div>
                  <small>STATUS</small>
                  <strong>Active</strong>
                </div>

                <div>
                  <small>ACCESS</small>
                  <strong>Full</strong>
                </div>

                <div>
                  <small>SEASON</small>
                  <strong>Prime</strong>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* BENEFIT GRID */}

      <section className={styles.primeNewBenefits}>
        <motion.div
          {...reveal}
          className={styles.primeNewBenefitsInner}
        >
          <p className={styles.primeNewSectionLabel}>
            EVERYTHING INCLUDED
          </p>

          <h2>
            Bir üzvlük.
            <span>
              Bütün Prime sistemi.
            </span>
          </h2>

          <div className={styles.primeNewGridCards}>
            <PrimeNewBenefit
              icon={ShieldCheck}
              title="Loss Protection"
              text="Uyğun casino itkilərini refund üçün saxla."
            />

            <PrimeNewBenefit
              icon={Star}
              title="Prime Missions"
              text="Daily və weekly xüsusi missiyalar aç."
            />

            <PrimeNewBenefit
              icon={Trophy}
              title="Season Progression"
              text="Season XP ilə progression-u davam etdir."
            />

            <PrimeNewBenefit
              icon={Gem}
              title="Prime Identity"
              text="Premium statusunu hesabında göstər."
            />

            <PrimeNewBenefit
              icon={Globe2}
              title="Web Control"
              text="Prime funksiyalarını dashboard-dan idarə et."
            />

            <PrimeNewBenefit
              icon={Zap}
              title="Premium Layer"
              text="Əsas economy üzərində əlavə üstünlüklər əldə et."
            />
          </div>
        </motion.div>
      </section>

      {/* CTA */}

      <section className={styles.primeNewCTA}>
        <motion.div
          {...reveal}
          className={styles.primeNewCTACard}
        >
          <div className={styles.primeNewCTAGlow} />

          <div className={styles.primeNewCTAContent}>
            <div className={styles.primeNewCTAIcon}>
              <Crown />
            </div>

            <p className={styles.primeNewSectionLabel}>
              OCTOSON PRIME
            </p>

            <h2>
              Prime-ı aktivləşdir.
              <span>
                30 gün sənindir.
              </span>
            </h2>

            <p>
              Loss Protection, Prime Missions,
              progression və premium identity-ni
              bir üzvlüklə aç.
            </p>

            <div className={styles.primeNewPrice}>
              <strong>{aura(price)}</strong>
              <span>Aura / 30 gün</span>
            </div>

            <div className={styles.primeNewCTAActions}>
              <button
                type="button"
                onClick={onBuy}
                disabled={pending || !canBuy}
                className={`${styles.focusable} ${styles.primeNewBuy}`}
              >
                {buying ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <Crown className="h-4 w-4" />
                )}

                Prime aktivləşdir
              </button>

              <button
                type="button"
                onClick={onLearnMore}
                disabled={pending}
                className={`${styles.focusable} ${styles.primeNewDetails}`}
              >
                Prime paneli
                <ArrowRight />
              </button>
            </div>

            <div
              className={
                canBuy
                  ? styles.primeNewBalanceGood
                  : styles.primeNewBalanceBad
              }
            >
              {canBuy
                ? `Balans: ${aura(balance)} Aura`
                : `${aura(
                    Math.max(0, price - balance)
                  )} Aura çatmır`}
            </div>

            {!canBuy ? (
              <Link
                href="/dashboard/earn"
                className={styles.primeNewEarn}
              >
                Aura qazan
                <ArrowRight />
              </Link>
            ) : null}
          </div>
        </motion.div>
      </section>
    </div>
  );
}

function PrimeNewBenefit({
  icon: Icon,
  title,
  text,
}: {
  icon: typeof Crown;
  title: string;
  text: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ amount: 0.3, once: true }}
      transition={{
        duration: 0.55,
        ease: [0.22, 1, 0.36, 1],
      }}
      className={styles.primeNewBenefit}
    >
      <div>
        <Icon />
      </div>

      <h3>{title}</h3>
      <p>{text}</p>
    </motion.div>
  );
}

function HeroChip({
  icon: Icon,
  text,
}: {
  icon: typeof Crown;
  text: string;
}) {
  return (
    <div className="flex items-center gap-1.5 rounded-full border border-white/[0.06] bg-black/20 px-3 py-1.5">
      <Icon className="h-3 w-3 text-amber-100/42" />

      <span className="text-[8px] font-medium text-white/32">
        {text}
      </span>
    </div>
  );
}

function MiniStatus({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[12px] border border-white/[0.055] bg-black/20 px-3 py-2.5">
      <p className="text-[7px] font-semibold uppercase tracking-[0.12em] text-white/18">
        {label}
      </p>

      <p className="mt-1 text-[14px] font-semibold tracking-[-0.03em] text-white/64">
        {value}
      </p>
    </div>
  );
}

function PrimeStat({
  icon: Icon,
  label,
  value,
  sub,
  accent = false,
}: {
  icon: typeof Crown;
  label: string;
  value: string;
  sub: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`${styles.hoverCard} rounded-[19px] border border-white/[0.06] bg-white/[0.018] p-5`}
    >
      <div
        className={`flex h-9 w-9 items-center justify-center rounded-[11px] border ${
          accent
            ? "border-amber-100/[0.09] bg-amber-100/[0.03]"
            : "border-white/[0.055] bg-black/20"
        }`}
      >
        <Icon
          className={`h-4 w-4 ${
            accent
              ? "text-amber-100/52"
              : "text-white/25"
          }`}
        />
      </div>

      <p className="mt-5 text-[8px] font-medium uppercase tracking-[0.12em] text-white/20">
        {label}
      </p>

      <p className="mt-1 text-[24px] font-semibold tracking-[-0.04em] text-white/78">
        {value}
      </p>

      <p className="mt-1 text-[9px] text-white/22">
        {sub}
      </p>
    </div>
  );
}

function MissionCard({
  mission,
  active,
  pending,
  actionActive,
  reduceMotion,
  index,
  onClaim,
}: {
  mission: PrimeMissionView;
  active: boolean;
  pending: boolean;
  actionActive: boolean;
  reduceMotion: boolean;
  index: number;
  onClaim: () => void;
}) {
  const progress =
    Math.max(
      0,
      Math.min(
        mission.target,
        mission.progress
      )
    );

  const percent =
    Math.min(
      100,
      (
        progress /
        Math.max(
          1,
          mission.target
        )
      ) * 100
    );

  const complete =
    progress >=
    mission.target;

  const claimed =
    Boolean(
      mission.claimedAt
    );

  return (
    <motion.article
      initial={
        reduceMotion
          ? false
          : {
              opacity: 0,
              y: 8,
            }
      }
      animate={{
        opacity: 1,
        y: 0,
      }}
      transition={{
        duration: 0.35,
        delay:
          reduceMotion
            ? 0
            : index *
              0.055,
      }}
      className={`${styles.hoverCard} relative overflow-hidden rounded-[18px] border ${
        complete &&
        !claimed
          ? "border-emerald-200/[0.1]"
          : "border-amber-100/[0.075]"
      } bg-[#090806] p-4 sm:p-5`}
    >
      {!active ? (
        <div className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full border border-white/[0.06] bg-black/45">
          <LockKeyhole className="h-3 w-3 text-white/26" />
        </div>
      ) : null}

      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border border-amber-100/[0.075] bg-amber-100/[0.028]">
          <MissionMetricIcon
            metric={mission.metric}
          />
        </div>

        <div className="min-w-0 pr-8">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded-full border border-amber-100/[0.1] bg-amber-100/[0.035] px-2 py-0.5 text-[7px] font-bold uppercase tracking-[0.12em] text-amber-100/55">
              PRIME
            </span>

            <span className="text-[7px] font-semibold uppercase tracking-[0.12em] text-white/20">
              {mission.periodType ===
              "weekly"
                ? "WEEKLY"
                : "DAILY"}
            </span>
          </div>

          <h3 className="mt-2 text-[13px] font-semibold tracking-[-0.02em] text-white/68">
            {mission.title}
          </h3>

          <p className="mt-1 text-[9px] leading-4 text-white/22">
            {mission.description}
          </p>
        </div>
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between text-[8px]">
          <span className="text-white/18">
            Progress
          </span>

          <span className="font-semibold text-white/40">
            {aura(progress)} /{" "}
            {aura(
              mission.target
            )}
          </span>
        </div>

        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.045]">
          <motion.div
            initial={
              reduceMotion
                ? false
                : {
                    width: 0,
                  }
            }
            animate={{
              width: `${percent}%`,
            }}
            transition={{
              duration: 0.7,
              ease: [
                0.22,
                1,
                0.36,
                1,
              ],
            }}
            className={`h-full rounded-full ${
              complete
                ? "bg-gradient-to-r from-emerald-300/55 to-emerald-100/28"
                : "bg-gradient-to-r from-amber-200/65 to-amber-50/25"
            }`}
          />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <RewardChip
          icon={Coins}
          value={`+${aura(
            mission.auraReward
          )}`}
          label="Aura"
        />

        <RewardChip
          icon={Star}
          value={`+${aura(
            mission.xpReward
          )}`}
          label="XP"
        />

        <RewardChip
          icon={Zap}
          value={`+${aura(
            mission.seasonXpReward
          )}`}
          label="Season"
        />
      </div>

      <div className="mt-4 border-t border-white/[0.05] pt-3">
        {!active ? (
          <Link
            href="/dashboard/prime"
            className={`${styles.focusable} inline-flex h-9 w-full items-center justify-center gap-2 rounded-[10px] border border-amber-100/[0.09] bg-amber-100/[0.035] text-[8px] font-semibold text-amber-100/48`}
          >
            <LockKeyhole className="h-3.5 w-3.5" />
            Prime tələb olunur
          </Link>
        ) : claimed ? (
          <div className="flex h-9 items-center justify-center gap-1.5 rounded-[10px] border border-white/[0.05] bg-white/[0.018] text-[8px] font-semibold text-white/25">
            <Check className="h-3.5 w-3.5 text-emerald-100/42" />
            Götürülüb
          </div>
        ) : complete ? (
          <button
            type="button"
            disabled={
              pending
            }
            onClick={
              onClaim
            }
            className={`${styles.focusable} inline-flex h-9 w-full items-center justify-center gap-2 rounded-[10px] border border-emerald-200/[0.11] bg-emerald-200/[0.05] text-[8px] font-semibold text-emerald-100/70 transition hover:bg-emerald-200/[0.08] disabled:opacity-35`}
          >
            {actionActive ? (
              <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}

            Mükafatı götür
          </button>
        ) : (
          <Link
            href="/dashboard/earn"
            className={`${styles.focusable} inline-flex h-9 w-full items-center justify-center gap-2 rounded-[10px] border border-white/[0.055] bg-white/[0.022] text-[8px] font-semibold text-white/34 transition hover:text-white/55`}
          >
            Davam et
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>
    </motion.article>
  );
}

function RewardChip({
  icon: Icon,
  value,
  label,
}: {
  icon: typeof Crown;
  value: string;
  label: string;
}) {
  return (
    <div className="flex items-center gap-1.5 rounded-[8px] border border-white/[0.05] bg-black/25 px-2 py-1.5">
      <Icon className="h-3 w-3 text-amber-100/35" />

      <span className="text-[8px] font-semibold text-white/42">
        {value}
      </span>

      <span className="text-[7px] text-white/16">
        {label}
      </span>
    </div>
  );
}

function Benefit({
  icon: Icon,
  title,
  text,
  large = false,
}: {
  icon: typeof Crown;
  title: string;
  text: string;
  large?: boolean;
}) {
  return (
    <div
      className={`${styles.hoverCard} ${
        large
          ? "md:col-span-1 xl:min-h-[155px]"
          : ""
      } rounded-[17px] border border-white/[0.055] bg-black/20 p-4`}
    >
      <div className="flex h-9 w-9 items-center justify-center rounded-[11px] border border-amber-100/[0.07] bg-amber-100/[0.025]">
        <Icon className="h-4 w-4 text-amber-100/42" />
      </div>

      <div className="mt-4 flex items-center gap-1.5">
        <Check className="h-3 w-3 text-emerald-100/40" />

        <p className="text-[11px] font-semibold text-white/54">
          {title}
        </p>
      </div>

      <p className="mt-1.5 max-w-[390px] text-[9px] leading-[1.7] text-white/22">
        {text}
      </p>
    </div>
  );
}

function Empty({
  icon: Icon,
  title,
  text,
}: {
  icon: typeof Crown;
  title: string;
  text: string;
}) {
  return (
    <div className="flex min-h-[235px] flex-col items-center justify-center rounded-[17px] border border-dashed border-white/[0.055] bg-black/15 px-5 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/[0.05] bg-white/[0.018]">
        <Icon className="h-4 w-4 text-white/20" />
      </div>

      <p className="mt-3 text-[11px] font-semibold text-white/42">
        {title}
      </p>

      <p className="mt-1 max-w-[340px] text-[9px] leading-5 text-white/19">
        {text}
      </p>
    </div>
  );
}
