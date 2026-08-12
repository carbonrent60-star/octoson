import {
  Activity,
  BadgeCheck,
  Banknote,
  CircleDollarSign,
  Gauge,
  Power,
  Search,
  ShieldCheck,
  Users,
} from "lucide-react";

import AdminActionForm from "@/components/admin/admin-action-form";
import VerifiedBadge from "@/components/profile/verified-badge";
import PrimeBadge from "@/components/profile/prime-badge";
import { requireOctosonAdmin } from "@/lib/admin";
import { getSupabaseServerClient } from "@/lib/supabase-server";

import {
  editUserAction,
  giveAuraAction,
  removeUserCasinoMaxBetAction,
  setGlobalCasinoAction,
  setGlobalCasinoMaxBetAction,
  setUserCasinoMaxBetAction,
  setUserVerificationAction,
} from "./actions";

import { getOctosonGuildMembers } from "@/lib/discord-server";

export const dynamic =
  "force-dynamic";

type PageProps = {
  searchParams?: Promise<{
    q?: string;
  }>;
};

type EconomyUserRow = {
  user_id: string;
  version: number;
  profile: Record<string, unknown> | null;
  balance: number;
  bank: number;
  xp: number;
  level: number;
  prestige: number;
  daily_streak: number;
  reputation: number;
  rank: string;
  title: string;
  created_at: number;
  updated_at: number;
};

type WebPresenceRow = {
  user_id: string;
  path: string;
  last_seen: number;
};

type EconomySettingsRow = {
  id: number;
  casino_enabled: boolean;
  global_casino_max_bet: number;
  casino_updated_at: number | null;
  casino_updated_by: string | null;
  safe_mode_enabled: boolean;
  chests_enabled: boolean;
};

type UserRestrictionRow = {
  id: string;
  user_id: string;
  type: string;
  reason: string | null;
  meta: Record<string, unknown> | null;
  created_at: number;
  expires_at: number | null;
};

function num(
  value: unknown
) {
  const number =
    Number(value ?? 0);

  return Number.isFinite(
    number
  )
    ? number
    : 0;
}

function format(
  value: unknown
) {
  return num(
    value
  ).toLocaleString(
    "en-US"
  );
}

function inputClass() {
  return "h-10 w-full rounded-xl border border-white/[0.075] bg-black/25 px-3 text-[12px] text-white/80 outline-none transition placeholder:text-white/15 focus:border-cyan-100/25";
}

export default async function AdminPage({
  searchParams,
}: PageProps) {
  await requireOctosonAdmin();

  const params =
    (await searchParams) ??
    {};

  const q =
    String(
      params.q ?? ""
    )
      .trim()
      .toLowerCase();

  const supabase =
    getSupabaseServerClient();

  const [
    usersResult,
    presenceResult,
    settingsResult,
    restrictionsResult,
  ] =
    await Promise.all([
      supabase
        .from(
          "economy_users"
        )
        .select(
          "user_id,version,profile,balance,bank,xp,level,prestige,daily_streak,reputation,rank,title,created_at,updated_at"
        )
        .order(
          "updated_at",
          {
            ascending: false,
          }
        )
        .limit(500),

      supabase
        .from(
          "web_presence"
        )
        .select(
          "user_id,path,last_seen"
        )
        .order(
          "last_seen",
          {
            ascending: false,
          }
        )
        .limit(500),

      supabase
        .from(
          "economy_settings"
        )
        .select(
          "id,casino_enabled,global_casino_max_bet,casino_updated_at,casino_updated_by,safe_mode_enabled,chests_enabled"
        )
        .eq(
          "id",
          1
        )
        .maybeSingle(),

      supabase
        .from(
          "user_restrictions"
        )
        .select(
          "id,user_id,type,reason,meta,created_at,expires_at"
        )
        .eq(
          "type",
          "casino_max_bet"
        ),
    ]);

  if (
    usersResult.error
  ) {
    throw usersResult.error;
  }

  if (
    presenceResult.error
  ) {
    throw presenceResult.error;
  }

  if (
    settingsResult.error
  ) {
    throw settingsResult.error;
  }

  if (
    restrictionsResult.error
  ) {
    throw restrictionsResult.error;
  }

  const users: EconomyUserRow[] =
    (usersResult.data ?? []) as EconomyUserRow[];

  const presence: WebPresenceRow[] =
    (presenceResult.data ?? []) as WebPresenceRow[];

  // Discord data is visual enrichment only.
  // The admin panel must still render when Discord is
  // unavailable, rate-limited, or temporarily failing.
  let discordMemberMap: Awaited<
    ReturnType<typeof getOctosonGuildMembers>
  > = {};

  try {
    discordMemberMap =
      await getOctosonGuildMembers(
        users.map((user) =>
          String(user.user_id)
        )
      );
  } catch (error) {
    console.warn(
      "[OCTOSON ADMIN] Discord member enrichment unavailable:",
      error
    );
  }

  const economySettings =
    (settingsResult.data ??
      {
        id: 1,
        casino_enabled: true,
        global_casino_max_bet: 100000,
        casino_updated_at: null,
        casino_updated_by: null,
        safe_mode_enabled: false,
        chests_enabled: true,
      }) as EconomySettingsRow;

  const restrictions =
    (restrictionsResult.data ??
      []) as UserRestrictionRow[];

  const casinoRestrictionMap =
    new Map(
      restrictions.map(
        (restriction) => [
          String(
            restriction.user_id
          ),
          restriction,
        ]
      )
    );

  const presenceMap =
    new Map(
      presence.map(
        (entry) => [
          String(
            entry.user_id
          ),
          entry,
        ]
      )
    );

  const now =
    Date.now();

  const onlineWindow =
    2 * 60 * 1000;

  const active =
    presence.filter(
      (entry) =>
        now -
          Number(
            entry.last_seen ??
              0
          ) <=
        onlineWindow
    );

  const filtered =
    users.filter(
      (user) => {
        if (!q) {
          return true;
        }

        const profile =
          user.profile &&
          typeof user.profile ===
            "object"
            ? user.profile as Record<string, unknown>
            : {};

        const searchable =
          [
            user.user_id,
            user.rank,
            user.title,
            profile.username,
            profile.name,
            profile.globalName,
            profile.displayName,
          ]
            .filter(
              Boolean
            )
            .join(" ")
            .toLowerCase();

        return searchable.includes(
          q
        );
      }
    );

  const totalWallet =
    users.reduce(
      (
        total,
        user
      ) =>
        total +
        num(
          user.balance
        ),
      0
    );

  return (
    <div className="space-y-7">
      <div className="flex flex-col justify-between gap-5 xl:flex-row xl:items-end">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.19em] text-cyan-100/40">
            <ShieldCheck className="h-4 w-4" />
            Restricted
          </div>

          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-white">
            Admin Panel
          </h1>

          <p className="mt-2 max-w-2xl text-[12px] leading-6 text-white/30">
            Octoson economy istifadəçiləri, canlı web sessiyaları və əsas profil dəyərləri.
          </p>
        </div>

        <form
          method="get"
          className="flex w-full max-w-sm items-center gap-2"
        >
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/20" />

            <input
              name="q"
              defaultValue={
                params.q ?? ""
              }
              placeholder="ID, ad, rank..."
              className="h-11 w-full rounded-xl border border-white/[0.07] bg-white/[0.025] pl-10 pr-3 text-[12px] text-white outline-none placeholder:text-white/15 focus:border-cyan-100/20"
            />
          </div>

          <button className="h-11 rounded-xl border border-white/[0.07] bg-white/[0.04] px-4 text-[11px] text-white/60">
            Axtar
          </button>
        </form>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          icon={Users}
          label="İstifadəçilər"
          value={format(
            users.length
          )}
        />

        <Stat
          icon={Activity}
          label="Saytda aktiv"
          value={format(
            active.length
          )}
          detail="son 2 dəqiqə"
        />

        <Stat
          icon={
            CircleDollarSign
          }
          label="Wallet Aura"
          value={format(
            totalWallet
          )}
        />

        <Stat
          icon={Banknote}
          label="Bank Aura"
          value={format(
            users.reduce(
              (
                sum,
                user
              ) =>
                sum +
                num(
                  user.bank
                ),
              0
            )
          )}
        />
      </div>

      <section className="overflow-hidden rounded-[22px] border border-cyan-100/[0.09] bg-gradient-to-b from-cyan-100/[0.035] to-white/[0.015]">
        <div className="flex flex-col gap-4 border-b border-white/[0.055] px-5 py-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-100/40">
              <Gauge className="h-4 w-4" />
              Casino Control Center
            </div>

            <h2 className="mt-2 text-[19px] font-semibold tracking-[-0.025em] text-white/90">
              Global casino idarəsi
            </h2>

            <p className="mt-1 max-w-2xl text-[11px] leading-5 text-white/30">
              Bu dəyişikliklər Discord və web casino üçün eyni Supabase economy settings-dən istifadə edir.
            </p>
          </div>

          <div
            className={`inline-flex h-9 items-center gap-2 self-start rounded-full border px-3 text-[10px] font-semibold ${
              economySettings.casino_enabled
                ? "border-emerald-300/15 bg-emerald-300/[0.06] text-emerald-200/70"
                : "border-red-300/15 bg-red-300/[0.06] text-red-200/70"
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                economySettings.casino_enabled
                  ? "bg-emerald-300"
                  : "bg-red-300"
              }`}
            />

            {economySettings.casino_enabled
              ? "CASINO AKTİV"
              : "CASINO BAĞLI"}
          </div>
        </div>

        <div className="grid gap-4 p-5 xl:grid-cols-2">
          <div className="rounded-[18px] border border-white/[0.055] bg-black/15 p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.025] text-white/35">
                <Power className="h-4 w-4" />
              </div>

              <div>
                <p className="text-[12px] font-medium text-white/75">
                  Casino status
                </p>

                <p className="mt-1 text-[10px] leading-5 text-white/25">
                  Bütün casino oyunlarını dərhal aç və ya bağla.
                </p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <AdminActionForm
                action={
                  setGlobalCasinoAction
                }
              >
                <input
                  type="hidden"
                  name="enabled"
                  value="true"
                />

                <button
                  type="submit"
                  className="h-10 w-full rounded-xl border border-emerald-300/10 bg-emerald-300/[0.055] text-[11px] font-medium text-emerald-100/70 transition hover:bg-emerald-300/[0.09]"
                >
                  Casino aç
                </button>
              </AdminActionForm>

              <AdminActionForm
                action={
                  setGlobalCasinoAction
                }
              >
                <input
                  type="hidden"
                  name="enabled"
                  value="false"
                />

                <button
                  type="submit"
                  className="h-10 w-full rounded-xl border border-red-300/10 bg-red-300/[0.045] text-[11px] font-medium text-red-100/65 transition hover:bg-red-300/[0.08]"
                >
                  Casino bağla
                </button>
              </AdminActionForm>
            </div>
          </div>

          <div className="rounded-[18px] border border-white/[0.055] bg-black/15 p-4">
            <div>
              <p className="text-[12px] font-medium text-white/75">
                Global maximum bet
              </p>

              <p className="mt-1 text-[10px] leading-5 text-white/25">
                Hazırda:{" "}
                <span className="text-white/55">
                  {num(
                    economySettings.global_casino_max_bet
                  ) > 0
                    ? `${format(
                        economySettings.global_casino_max_bet
                      )} Aura`
                    : "Limitsiz"}
                </span>
              </p>
            </div>

            <AdminActionForm
              action={
                setGlobalCasinoMaxBetAction
              }
              className="mt-4"
            >
              <div className="flex gap-2">
                <input
                  type="number"
                  min={0}
                  max={1000000}
                  required
                  name="maxBet"
                  defaultValue={
                    num(
                      economySettings.global_casino_max_bet
                    )
                  }
                  placeholder="100000"
                  className={inputClass()}
                />

                <button
                  type="submit"
                  className="h-10 shrink-0 rounded-xl border border-cyan-100/10 bg-cyan-100/[0.055] px-4 text-[11px] font-medium text-cyan-50/65 transition hover:bg-cyan-100/[0.09]"
                >
                  Yadda saxla
                </button>
              </div>

              <p className="mt-2 text-[9px] text-white/18">
                0 = global limit yoxdur.
              </p>
            </AdminActionForm>
          </div>
        </div>
      </section>

      <section className="rounded-[22px] border border-white/[0.065] bg-white/[0.022] p-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/25">
          Sürətli Aura
        </p>

        <h2 className="mt-2 text-[18px] font-semibold text-white/90">
          Aura ver / çıx
        </h2>

        <AdminActionForm
          action={
            giveAuraAction
          }
          className="mt-5"
        >
          <div className="grid gap-3 md:grid-cols-[1fr_220px]">
            <input
              name="userId"
              required
              inputMode="numeric"
              placeholder="Discord User ID"
              className={inputClass()}
            />

            <input
              name="amount"
              required
              type="number"
              placeholder="məs: 5000 və ya -500"
              className={inputClass()}
            />
          </div>
        </AdminActionForm>
      </section>

      <section className="relative overflow-hidden rounded-[26px] border border-white/[0.075] bg-[#0d0e10]/80 shadow-[0_24px_80px_rgba(0,0,0,0.28)] backdrop-blur-xl">
        <div className="relative flex items-center justify-between border-b border-white/[0.055] bg-white/[0.012] px-5 py-5">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/25">
              Economy users
            </p>

            <p className="mt-1 text-[12px] text-white/35">
              {filtered.length} nəticə
            </p>
          </div>
        </div>

        <div className="divide-y divide-white/[0.04]">
          {filtered.map(
            (user) => {
              const currentPresence =
                presenceMap.get(
                  String(
                    user.user_id
                  )
                );

              const online =
                currentPresence &&
                now -
                  Number(
                    currentPresence.last_seen ??
                      0
                  ) <=
                  onlineWindow;

              const profile =
                user.profile &&
                typeof user.profile ===
                  "object"
                  ? user.profile as Record<string, unknown>
                  : {};

              const discordMember =
                discordMemberMap[String(user.user_id)];

              const fallbackName =
                String(
                  profile.globalName ??
                    profile.displayName ??
                    profile.username ??
                    profile.name ??
                    ""
                );

              const name =
                discordMember?.name ||
                fallbackName ||
                String(user.user_id);

              const username =
                discordMember?.username ||
                String(
                  profile.username ??
                    ""
                );

              const avatar =
                discordMember?.avatar ??
                null;

              const identity =
                profile.identity &&
                typeof profile.identity === "object" &&
                !Array.isArray(profile.identity)
                  ? profile.identity as Record<string, unknown>
                  : {};

              const verified =
                identity.verified === true ||
                profile.verified === true;

              const prime =
                profile.prime &&
                typeof profile.prime === "object" &&
                !Array.isArray(profile.prime)
                  ? profile.prime as Record<string, unknown>
                  : {};

              const primeActiveUntil = Number(
                prime.activeUntil ??
                  prime.until ??
                  prime.expiresAt ??
                  profile.primeUntil ??
                  0
              );

              const primeActive =
                prime.active === true ||
                profile.primeActive === true ||
                (
                  Number.isFinite(primeActiveUntil) &&
                  primeActiveUntil > Date.now()
                );

              return (
                <details
                  key={
                    user.user_id
                  }
                  className="group"
                >
                  <summary className="group/row relative cursor-pointer list-none px-4 py-3.5 outline-none transition duration-300 hover:bg-white/[0.022] sm:px-5 sm:py-4 [&::-webkit-details-marker]:hidden">
                    <div className="pointer-events-none absolute inset-y-3 left-0 w-[2px] scale-y-0 rounded-full bg-cyan-200/60 opacity-0 transition duration-300 group-hover/row:scale-y-100 group-hover/row:opacity-100 group-open:scale-y-100 group-open:opacity-100" />

                    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                      <div
                        data-admin-discord-user="true"
                        className="flex min-w-0 items-center gap-4"
                      >
                        <div className="relative shrink-0">
                          <div className="relative h-[52px] w-[52px] overflow-hidden rounded-[17px] border border-white/[0.10] bg-white/[0.035] shadow-[0_10px_30px_rgba(0,0,0,0.28)] transition duration-300 group-hover/row:border-white/[0.16] group-hover/row:shadow-[0_12px_34px_rgba(0,0,0,0.36)]">
                            {avatar ? (
                              <img
                                src={avatar}
                                alt={name}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-white/[0.07] to-white/[0.015] text-[15px] font-semibold text-white/55">
                                {name
                                  .trim()
                                  .charAt(0)
                                  .toUpperCase() ||
                                  "?"}
                              </div>
                            )}

                            <div className="pointer-events-none absolute inset-0 rounded-[17px] ring-1 ring-inset ring-white/[0.035]" />
                          </div>

                          <span
                            className={`absolute -bottom-0.5 -right-0.5 flex h-[14px] w-[14px] items-center justify-center rounded-full border-[3px] border-[#101113] ${
                              online
                                ? "bg-emerald-400"
                                : "bg-[#55585d]"
                            }`}
                          >
                            {online ? (
                              <span className="absolute h-full w-full animate-ping rounded-full bg-emerald-400/30" />
                            ) : null}
                          </span>
                        </div>

                        <div className="min-w-0">
                          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                            <p className="max-w-[300px] truncate text-[14px] font-semibold tracking-[-0.015em] text-white/[0.92]">
                              {name}
                            </p>

                            {verified ? (
                              <VerifiedBadge size="sm" />
                            ) : null}

                            {primeActive ? (
                              <PrimeBadge
                                size="sm"
                                activeUntil={
                                  primeActiveUntil || null
                                }
                              />
                            ) : null}

                            {online ? (
                              <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-300/[0.10] bg-emerald-300/[0.055] px-2 py-[3px] text-[8px] font-semibold uppercase tracking-[0.10em] text-emerald-200/65">
                                <span className="h-1 w-1 rounded-full bg-emerald-300" />
                                Saytda
                              </span>
                            ) : (
                              <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/[0.055] bg-white/[0.025] px-2 py-[3px] text-[8px] font-semibold uppercase tracking-[0.10em] text-white/25">
                                Offline
                              </span>
                            )}
                          </div>

                          <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 text-[10px]">
                            {username ? (
                              <span className="truncate font-medium text-white/38">
                                @{username}
                              </span>
                            ) : null}

                            {username ? (
                              <span className="text-white/12">
                                •
                              </span>
                            ) : null}

                            <span className="truncate font-mono text-[9px] tracking-[-0.01em] text-white/20">
                              {user.user_id}
                            </span>
                          </div>

                          <div className="mt-1.5 flex min-w-0 items-center gap-2">
                            {online && currentPresence?.path ? (
                              <div className="flex min-w-0 items-center gap-2">
                                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-emerald-300/[0.08] bg-emerald-300/[0.045] px-2 py-1 text-[8px] font-semibold uppercase tracking-[0.12em] text-emerald-200/55">
                                  <span className="h-1 w-1 rounded-full bg-emerald-300" />
                                  Saytda
                                </span>

                                <span className="max-w-[300px] truncate font-mono text-[9px] text-white/25">
                                  {currentPresence.path}
                                </span>
                              </div>
                            ) : (
                              <span className="text-[9px] text-white/18">
                                Hazırda saytda deyil
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-stretch gap-1.5 sm:gap-2 lg:justify-end">
                        <div className="min-w-[112px] rounded-[14px] border border-white/[0.055] bg-black/20 px-3.5 py-2.5 transition duration-300 group-hover/row:border-white/[0.08] group-hover/row:bg-white/[0.025]">
                          <p className="text-[8px] font-semibold uppercase tracking-[0.14em] text-white/22">
                            Aura
                          </p>

                          <div className="mt-1 flex items-baseline gap-1.5">
                            <p className="text-[14px] font-semibold tabular-nums tracking-[-0.025em] text-white/[0.86]">
                              {format(user.balance)}
                            </p>

                            <span className="text-[8px] font-medium uppercase tracking-[0.08em] text-cyan-100/25">
                              A
                            </span>
                          </div>
                        </div>

                        <div className="min-w-[84px] rounded-[14px] border border-white/[0.045] bg-white/[0.018] px-3 py-2.5">
                          <p className="text-[8px] font-semibold uppercase tracking-[0.14em] text-white/20">
                            Level
                          </p>

                          <p className="mt-1 text-[13px] font-semibold tabular-nums text-white/65">
                            Lv.{user.level}
                          </p>
                        </div>

                        <div className="min-w-[84px] rounded-[14px] border border-white/[0.045] bg-white/[0.018] px-3 py-2.5">
                          <p className="text-[8px] font-semibold uppercase tracking-[0.14em] text-white/20">
                            XP
                          </p>

                          <p className="mt-1 text-[13px] font-semibold tabular-nums text-white/65">
                            {format(user.xp)}
                          </p>
                        </div>

                        <div className="flex w-9 shrink-0 items-center justify-center rounded-[14px] border border-white/[0.045] bg-white/[0.015] text-white/20 transition duration-300 group-hover/row:border-white/[0.08] group-hover/row:text-white/45 group-open:bg-white/[0.035] group-open:text-white/55">
                          <svg
                            viewBox="0 0 20 20"
                            fill="none"
                            className="h-3.5 w-3.5 transition-transform duration-300 group-open:rotate-180"
                          >
                            <path
                              d="M5.75 7.75 10 12l4.25-4.25"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </div>
                      </div>
                    </div>
                  </summary>

                  <div className="border-t border-white/[0.04] bg-black/10 px-5 py-5">
                    <AdminActionForm
                      action={
                        editUserAction
                      }
                    >
                      <input
                        type="hidden"
                        name="userId"
                        value={
                          user.user_id
                        }
                      />

                      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        <Field
                          label="Wallet Aura"
                          name="balance"
                          value={
                            user.balance
                          }
                        />

                        <Field
                          label="Bank"
                          name="bank"
                          value={
                            user.bank
                          }
                        />

                        <Field
                          label="Level"
                          name="level"
                          value={
                            user.level
                          }
                        />

                        <Field
                          label="XP"
                          name="xp"
                          value={
                            user.xp
                          }
                        />

                        <Field
                          label="Prestige"
                          name="prestige"
                          value={
                            user.prestige
                          }
                        />

                        <Field
                          label="Daily streak"
                          name="dailyStreak"
                          value={
                            user.daily_streak
                          }
                        />

                        <Field
                          label="Reputation"
                          name="reputation"
                          value={
                            user.reputation
                          }
                        />

                        <TextField
                          label="Rank"
                          name="rank"
                          value={
                            user.rank
                          }
                        />

                        <TextField
                          label="Title"
                          name="title"
                          value={
                            user.title
                          }
                        />
                      </div>
                    </AdminActionForm>

                    <div className="mt-5 rounded-[16px] border border-white/[0.055] bg-white/[0.018] p-4">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <BadgeCheck
                              className={`h-4 w-4 ${
                                verified
                                  ? "fill-cyan-200/10 text-cyan-200"
                                  : "text-white/20"
                              }`}
                            />

                            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">
                              Octoson Verified
                            </p>
                          </div>

                          <p className="mt-1.5 text-[10px] leading-5 text-white/25">
                            {verified
                              ? "Bu istifadəçi platformada Verified badge və premium profil imkanlarına sahibdir."
                              : "Verified statusu profil, leaderboard, activity və digər identity sahələrində görünəcək."}
                          </p>
                        </div>

                        <AdminActionForm
                          action={
                            setUserVerificationAction
                          }
                          className="shrink-0"
                        >
                          <input
                            type="hidden"
                            name="userId"
                            value={user.user_id}
                          />

                          <input
                            type="hidden"
                            name="verified"
                            value={
                              verified
                                ? "false"
                                : "true"
                            }
                          />

                          <button
                            type="submit"
                            className={`mt-0 inline-flex h-9 items-center justify-center rounded-[11px] border px-3.5 text-[9px] font-semibold transition ${
                              verified
                                ? "border-rose-300/10 bg-rose-300/[0.04] text-rose-100/60 hover:bg-rose-300/[0.08]"
                                : "border-cyan-200/15 bg-cyan-200/[0.06] text-cyan-50/75 hover:bg-cyan-200/[0.11]"
                            }`}
                          >
                            {verified
                              ? "Verified sil"
                              : "Verify et"}
                          </button>
                        </AdminActionForm>
                      </div>
                    </div>

                    <div className="mt-5 border-t border-white/[0.045] pt-5">
                      {(() => {
                        const casinoRestriction =
                          casinoRestrictionMap.get(
                            String(
                              user.user_id
                            )
                          );

                        const casinoMaxBet =
                          casinoRestriction?.meta &&
                          Number.isFinite(
                            Number(
                              casinoRestriction.meta.maxBet
                            )
                          )
                            ? Number(
                                casinoRestriction.meta.maxBet
                              )
                            : null;

                        return (
                          <>
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                              <div>
                                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/25">
                                  Casino moderation
                                </p>

                                <p className="mt-1 text-[11px] text-white/35">
                                  {casinoMaxBet !== null
                                    ? `Aktiv max bet: ${format(
                                        casinoMaxBet
                                      )} Aura`
                                    : "Fərdi casino limiti yoxdur"}
                                </p>

                                {casinoRestriction?.reason ? (
                                  <p className="mt-1 text-[9px] text-white/20">
                                    {casinoRestriction.reason}
                                  </p>
                                ) : null}
                              </div>
                            </div>

                            <div className="mt-3 grid gap-3 xl:grid-cols-[1fr_1fr_auto]">
                              <AdminActionForm
                                action={
                                  setUserCasinoMaxBetAction
                                }
                              >
                                <input
                                  type="hidden"
                                  name="userId"
                                  value={
                                    user.user_id
                                  }
                                />

                                <input
                                  type="number"
                                  min={0}
                                  max={1000000}
                                  required
                                  name="maxBet"
                                  defaultValue={
                                    casinoMaxBet ??
                                    100000
                                  }
                                  placeholder="Max bet"
                                  className={inputClass()}
                                />

                                <input
                                  name="reason"
                                  maxLength={500}
                                  placeholder="Səbəb"
                                  defaultValue={
                                    casinoRestriction?.reason ??
                                    ""
                                  }
                                  className={`${inputClass()} mt-2`}
                                />

                                <button
                                  type="submit"
                                  className="mt-2 h-10 w-full rounded-xl border border-cyan-100/10 bg-cyan-100/[0.05] px-4 text-[11px] text-cyan-50/65"
                                >
                                  Casino limitini saxla
                                </button>
                              </AdminActionForm>

                              <div className="rounded-xl border border-white/[0.055] bg-black/15 p-3">
                                <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-white/20">
                                  Effective limits
                                </p>

                                <p className="mt-2 text-[10px] leading-5 text-white/35">
                                  User:{" "}
                                  <span className="text-white/60">
                                    {casinoMaxBet !== null
                                      ? `${format(
                                          casinoMaxBet
                                        )} Aura`
                                      : "yoxdur"}
                                  </span>
                                  <br />
                                  Global:{" "}
                                  <span className="text-white/60">
                                    {num(
                                      economySettings.global_casino_max_bet
                                    ) > 0
                                      ? `${format(
                                          economySettings.global_casino_max_bet
                                        )} Aura`
                                      : "limitsiz"}
                                  </span>
                                </p>
                              </div>

                              {casinoRestriction ? (
                                <AdminActionForm
                                  action={
                                    removeUserCasinoMaxBetAction
                                  }
                                >
                                  <input
                                    type="hidden"
                                    name="userId"
                                    value={
                                      user.user_id
                                    }
                                  />

                                  <button
                                    type="submit"
                                    className="h-10 rounded-xl border border-red-300/10 bg-red-300/[0.04] px-4 text-[10px] text-red-100/60"
                                  >
                                    Limiti sil
                                  </button>
                                </AdminActionForm>
                              ) : (
                                <div />
                              )}
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                </details>
              );
            }
          )}
        </div>
      </section>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="rounded-[19px] border border-white/[0.06] bg-white/[0.022] p-5">
      <div className="flex items-center gap-2 text-white/25">
        <Icon className="h-4 w-4" />

        <span className="text-[9px] font-semibold uppercase tracking-[0.15em]">
          {label}
        </span>
      </div>

      <p className="mt-4 text-[23px] font-semibold tracking-[-0.04em] text-white/90">
        {value}
      </p>

      {detail ? (
        <p className="mt-1 text-[9px] text-white/20">
          {detail}
        </p>
      ) : null}
    </div>
  );
}

function Mini({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <p className="text-[8px] font-semibold uppercase tracking-[0.13em] text-white/18">
        {label}
      </p>

      <p className="mt-1 truncate text-[12px] font-medium text-white/60">
        {value}
      </p>
    </div>
  );
}

function Field({
  label,
  name,
  value,
}: {
  label: string;
  name: string;
  value: unknown;
}) {
  return (
    <label>
      <span className="mb-2 block text-[9px] font-medium uppercase tracking-[0.12em] text-white/20">
        {label}
      </span>

      <input
        type="number"
        name={name}
        defaultValue={num(
          value
        )}
        className={inputClass()}
      />
    </label>
  );
}

function TextField({
  label,
  name,
  value,
}: {
  label: string;
  name: string;
  value: unknown;
}) {
  return (
    <label>
      <span className="mb-2 block text-[9px] font-medium uppercase tracking-[0.12em] text-white/20">
        {label}
      </span>

      <input
        name={name}
        defaultValue={String(
          value ?? ""
        )}
        className={inputClass()}
      />
    </label>
  );
}
