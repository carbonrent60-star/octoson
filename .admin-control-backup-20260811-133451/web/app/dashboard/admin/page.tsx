import {
  Activity,
  Banknote,
  CircleDollarSign,
  Search,
  ShieldCheck,
  Users,
} from "lucide-react";

import AdminActionForm from "@/components/admin/admin-action-form";
import { requireOctosonAdmin } from "@/lib/admin";
import { getSupabaseServerClient } from "@/lib/supabase-server";

import {
  editUserAction,
  giveAuraAction,
} from "./actions";

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
    ]);

  if (
    usersResult.error
  ) {
    throw usersResult.error;
  }

  const users: EconomyUserRow[] =
    (usersResult.data ?? []) as EconomyUserRow[];

  const presence: WebPresenceRow[] =
    (presenceResult.data ?? []) as WebPresenceRow[];

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

      <section className="overflow-hidden rounded-[22px] border border-white/[0.065] bg-white/[0.018]">
        <div className="flex items-center justify-between border-b border-white/[0.055] px-5 py-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/25">
              Economy users
            </p>

            <p className="mt-1 text-[12px] text-white/35">
              {filtered.length} nəticə
            </p>
          </div>
        </div>

        <div className="divide-y divide-white/[0.045]">
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

              const name =
                String(
                  profile.globalName ??
                    profile.displayName ??
                    profile.username ??
                    profile.name ??
                    ""
                );

              return (
                <details
                  key={
                    user.user_id
                  }
                  className="group"
                >
                  <summary className="flex cursor-pointer list-none flex-col gap-4 px-5 py-5 transition hover:bg-white/[0.018] lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={`h-2 w-2 shrink-0 rounded-full ${
                            online
                              ? "bg-emerald-300"
                              : "bg-white/15"
                          }`}
                        />

                        <p className="truncate text-[13px] font-medium text-white/80">
                          {name ||
                            user.user_id}
                        </p>
                      </div>

                      <p className="mt-1 font-mono text-[10px] text-white/20">
                        {user.user_id}
                      </p>

                      {online ? (
                        <p className="mt-1 text-[9px] text-emerald-200/40">
                          Aktiv • {currentPresence?.path}
                        </p>
                      ) : null}
                    </div>

                    <div className="grid grid-cols-3 gap-5 lg:min-w-[390px]">
                      <Mini
                        label="Aura"
                        value={format(
                          user.balance
                        )}
                      />

                      <Mini
                        label="Level"
                        value={`Lv.${user.level}`}
                      />

                      <Mini
                        label="XP"
                        value={format(
                          user.xp
                        )}
                      />
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
