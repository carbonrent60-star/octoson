"use client";

import Link from "next/link";

import {
  ArrowDownLeft,
  ArrowUpRight,
  Bomb,
  ChevronDown,
  CircleDollarSign,
  Clock3,
  Coins,
  Crown,
  Dice5,
  Gamepad2,
  Gem,
  Layers3,
  Spade,
  Target,
  TrendingUp,
  UserRound,
} from "lucide-react";

import {
  useMemo,
  useState,
  type ComponentType,
} from "react";

type ActivityTransaction = {
  id: string;
  userId: string;
  amount: number;
  type: string;
  note?: string;
  metadata?: Record<string, unknown>;
  balanceBefore?: number | null;
  balanceAfter?: number | null;
  createdAt: string;
};

type Member = {
  name?: string;
  avatar?: string | null;
};

type ActivityFeedProps = {
  transactions: ActivityTransaction[];
  members: Record<string, Member>;
};

type ActivityItem =
  | {
      kind: "transaction";
      key: string;
      transaction: ActivityTransaction;
    }
  | {
      kind: "casino-session";
      key: string;
      userId: string;
      game: string;
      transactions: ActivityTransaction[];
      startedAt: string;
      endedAt: string;
      net: number;
      volume: number;
    };

const SESSION_GAP_MS = 10 * 60 * 1000;

const CASINO_TYPES = new Set([
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

const GAME_LABELS: Record<string, string> = {
  slots: "Slots",
  risk: "Risk",
  coinflip: "Coinflip",
  dice: "Dice",
  roulette: "Ruletka",
  blackjack: "Blackjack",
  crash: "Crash",
  mines: "Mines",
  tower: "Tower",
  higherlower: "Higher / Lower",
  wheel: "Wheel",
  lottery: "Lottery",
  jackpot: "Jackpot",
  rps: "RPS",
  baccarat: "Baccarat",
  poker: "Poker",
  horse: "Horse",
  penalty: "Penalty",
};

const GAME_ICONS: Record<
  string,
  ComponentType<{ className?: string }>
> = {
  mines: Bomb,
  roulette: Target,
  blackjack: Spade,
  baccarat: Layers3,
  slots: Gem,
  risk: TrendingUp,
  tower: Crown,
  dice: Dice5,
  coinflip: CircleDollarSign,
  higherlower: TrendingUp,
  crash: TrendingUp,
  wheel: Target,
  lottery: Coins,
  jackpot: Gem,
  poker: Spade,
  rps: Gamepad2,
  horse: Gamepad2,
  penalty: Target,
};

function cleanType(type: string) {
  const labels: Record<string, string> = {
    daily: "Daily",
    weekly: "Weekly",
    monthly: "Monthly",
    beginner_bonus: "Başlanğıc bonusu",
    bank_interest: "Bank faizi",
    taxes: "Vergi",
    transfer: "Transfer",
    social_gift: "Hədiyyə",
    admin_give: "Admin əlavə etdi",
    admin_take: "Admin çıxardı",
    admin_setbalance: "Balans dəyişdirildi",
    admin_drop: "Drop",
    loan_octobank: "OctoBank krediti",
    loan_blackmarket: "Black Market krediti",
    loan_business: "Biznes krediti",
    loan_vip: "VIP kredit",
    loan_casino: "Kazino krediti",
    payloan: "Kredit ödənişi",
    loan_penalty: "Kredit cəriməsi",
    slots: "Slots",
    risk: "Risk",
    coinflip: "Coinflip",
    dice: "Dice",
    roulette: "Ruletka",
    blackjack: "Blackjack",
    crash: "Crash",
    mines: "Mines",
    tower: "Tower",
    higherlower: "Higher / Lower",
    wheel: "Wheel",
    lottery: "Lottery",
    jackpot: "Jackpot",
    rps: "RPS",
    baccarat: "Baccarat",
    poker: "Poker",
    horse: "Horse",
    penalty: "Penalty",
    prime_refund: "Prime refund",
    casino_timeout_refund: "Kazino refund",
    ticket_used: "Reward Ticket",
    shop_buy: "Market alış",
    open_chest: "Sandıq açıldı",
    sell: "Satış",
    craft: "Craft",
    recycle: "Recycle",
    salvage: "Salvage",
    rob: "Soyğun",
    robbed: "Soyuldu",
    rob_failed: "Uğursuz soyğun",
    duel: "Duel",
    dicebattle: "Dice Battle",
    quickdraw: "Quick Draw",
    heist: "Heist",
    world_job: "İş",
    world_mission: "Missiya",
    world_income: "Gəlir",
    world_adventure: "Macəra",
    world_explore: "Kəşf",
    world_business_buy: "Biznes alışı",
    world_property_buy: "Əmlak alışı",
    world_vehicle_buy: "Nəqliyyat alışı",
    world_business_upgrade: "Biznes upgrade",
  };

  return (
    labels[type] ??
    type
      .replaceAll("_", " ")
      .replace(/\b\w/g, (char) => char.toUpperCase())
  );
}

function formatNumber(value: number) {
  return Math.abs(Math.floor(value)).toLocaleString("en-US");
}

function relativeTime(date: string) {
  const ms =
    Date.now() -
    new Date(date).getTime();

  const seconds = Math.max(
    0,
    Math.floor(ms / 1000),
  );

  if (seconds < 10) return "indi";
  if (seconds < 60) {
    return `${seconds} san əvvəl`;
  }

  const minutes =
    Math.floor(seconds / 60);

  if (minutes < 60) {
    return `${minutes} dəq əvvəl`;
  }

  const hours =
    Math.floor(minutes / 60);

  if (hours < 24) {
    return `${hours} saat əvvəl`;
  }

  const days =
    Math.floor(hours / 24);

  if (days < 30) {
    return `${days} gün əvvəl`;
  }

  return new Date(
    date,
  ).toLocaleDateString("az-AZ");
}

function sessionLabel(count: number) {
  return `${count} əməliyyat`;
}

function buildActivityItems(
  transactions: ActivityTransaction[],
): ActivityItem[] {
  const ordered = [...transactions].sort(
    (a, b) =>
      new Date(b.createdAt).getTime() -
      new Date(a.createdAt).getTime(),
  );

  const sessions = new Map<
    string,
    {
      userId: string;
      game: string;
      transactions: ActivityTransaction[];
      newest: number;
      oldest: number;
    }[]
  >();

  const standalone: ActivityItem[] = [];

  /*
   * Build sessions independently for every user + game.
   *
   * A new session begins whenever there is more than
   * SESSION_GAP_MS between two rounds of the same game.
   */
  const chronological = [...ordered].reverse();

  for (const transaction of chronological) {
    if (!CASINO_TYPES.has(transaction.type)) {
      standalone.push({
        kind: "transaction",
        key: `tx:${transaction.id}`,
        transaction,
      });

      continue;
    }

    const bucketKey =
      `${transaction.userId}:${transaction.type}`;

    const bucket =
      sessions.get(bucketKey) ?? [];

    const timestamp =
      new Date(
        transaction.createdAt,
      ).getTime();

    const current =
      bucket[bucket.length - 1];

    if (
      !current ||
      timestamp - current.newest >
        SESSION_GAP_MS
    ) {
      bucket.push({
        userId: transaction.userId,
        game: transaction.type,
        transactions: [transaction],
        newest: timestamp,
        oldest: timestamp,
      });
    } else {
      current.transactions.push(
        transaction,
      );

      current.newest = Math.max(
        current.newest,
        timestamp,
      );

      current.oldest = Math.min(
        current.oldest,
        timestamp,
      );
    }

    sessions.set(
      bucketKey,
      bucket,
    );
  }

  const grouped: ActivityItem[] = [];

  for (const groups of sessions.values()) {
    for (const group of groups) {
      const groupTransactions =
        [...group.transactions].sort(
          (a, b) =>
            new Date(
              b.createdAt,
            ).getTime() -
            new Date(
              a.createdAt,
            ).getTime(),
        );

      grouped.push({
        kind: "casino-session",
        key:
          `session:${group.userId}:${group.game}:${group.newest}`,
        userId: group.userId,
        game: group.game,
        transactions:
          groupTransactions,
        startedAt: new Date(
          group.oldest,
        ).toISOString(),
        endedAt: new Date(
          group.newest,
        ).toISOString(),
        net: groupTransactions.reduce(
          (sum, item) =>
            sum +
            Number(
              item.amount ?? 0,
            ),
          0,
        ),
        volume:
          groupTransactions.reduce(
            (sum, item) =>
              sum +
              Math.abs(
                Number(
                  item.amount ?? 0,
                ),
              ),
            0,
          ),
      });
    }
  }

  return [
    ...standalone,
    ...grouped,
  ].sort((a, b) => {
    const aDate =
      a.kind ===
      "casino-session"
        ? a.endedAt
        : a.transaction.createdAt;

    const bDate =
      b.kind ===
      "casino-session"
        ? b.endedAt
        : b.transaction.createdAt;

    return (
      new Date(
        bDate,
      ).getTime() -
      new Date(
        aDate,
      ).getTime()
    );
  });
}

function Amount({
  value,
  compact = false,
}: {
  value: number;
  compact?: boolean;
}) {
  const positive = value > 0;
  const zero = value === 0;

  return (
    <div className="flex shrink-0 items-center justify-end gap-2">
      {!zero &&
        (positive ? (
          <ArrowUpRight className="h-3.5 w-3.5 text-emerald-300/50" />
        ) : (
          <ArrowDownLeft className="h-3.5 w-3.5 text-rose-300/45" />
        ))}

      <span
        className={`font-semibold tabular-nums ${
          compact
            ? "text-[10px]"
            : "text-[11px]"
        } ${
          zero
            ? "text-white/35"
            : positive
              ? "text-emerald-200/65"
              : "text-rose-200/60"
        }`}
      >
        {positive
          ? "+"
          : value < 0
            ? "-"
            : ""}
        {formatNumber(value)} Aura
      </span>
    </div>
  );
}

function Avatar({
  member,
  name,
  game,
}: {
  member?: Member;
  name: string;
  game?: string;
}) {
  if (member?.avatar) {
    return (
      <div className="relative h-10 w-10 shrink-0">
        <img
          src={member.avatar}
          alt=""
          className="h-10 w-10 rounded-[12px] border border-white/[0.07] object-cover"
        />

        {game && (
          <div className="absolute -bottom-1 -right-1 flex h-[18px] w-[18px] items-center justify-center rounded-[6px] border border-[#101116] bg-[#15171d]">
            {(() => {
              const Icon =
                GAME_ICONS[game] ??
                Gamepad2;

              return (
                <Icon className="h-2.5 w-2.5 text-cyan-100/65" />
              );
            })()}
          </div>
        )}
      </div>
    );
  }

  const Icon =
    game
      ? GAME_ICONS[game] ??
        Gamepad2
      : UserRound;

  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] border border-white/[0.07] bg-white/[0.025]">
      <Icon className="h-4 w-4 text-cyan-100/40" />
    </div>
  );
}

export default function ActivityFeed({
  transactions,
  members,
}: ActivityFeedProps) {
  const items = useMemo(
    () =>
      buildActivityItems(
        transactions,
      ),
    [transactions],
  );

  const [openSessions, setOpenSessions] =
    useState<Set<string>>(
      () => new Set(),
    );

  function toggle(
    key: string,
  ) {
    setOpenSessions(
      (current) => {
        const next =
          new Set(current);

        if (next.has(key)) {
          next.delete(key);
        } else {
          next.add(key);
        }

        return next;
      },
    );
  }

  return (
    <div>
      {items.map((item) => {
        if (
          item.kind ===
          "transaction"
        ) {
          const transaction =
            item.transaction;

          const member =
            members[
              transaction.userId
            ];

          const name =
            member?.name ??
            `İstifadəçi ${transaction.userId.slice(-4)}`;

          return (
            <div
              key={item.key}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-white/[0.04] px-4 py-4 transition hover:bg-white/[0.025] last:border-0 sm:grid-cols-[minmax(220px,1fr)_minmax(150px,0.7fr)_150px]"
            >
              <div className="flex min-w-0 items-center gap-3">
                <Avatar
                  member={member}
                  name={name}
                />

                <div className="min-w-0">
                  <p className="truncate text-[12px] font-medium text-white/65">
                    {name}
                  </p>

                  <div className="mt-1 flex items-center gap-1.5 text-[9px] text-white/20">
                    <Clock3 className="h-3 w-3" />
                    {relativeTime(
                      transaction.createdAt,
                    )}
                  </div>
                </div>
              </div>

              <div className="hidden min-w-0 sm:block">
                <p className="truncate text-[11px] font-medium text-white/45">
                  {cleanType(
                    transaction.type,
                  )}
                </p>

                {transaction.note && (
                  <p className="mt-1 truncate text-[9px] text-white/18">
                    {transaction.note}
                  </p>
                )}
              </div>

              <Amount
                value={
                  transaction.amount
                }
              />
            </div>
          );
        }

        const member =
          members[item.userId];

        const name =
          member?.name ??
          `İstifadəçi ${item.userId.slice(-4)}`;

        const open =
          openSessions.has(
            item.key,
          );

        const Icon =
          GAME_ICONS[
            item.game
          ] ?? Gamepad2;

        const wins =
          item.transactions.filter(
            (transaction) =>
              transaction.amount >
              0,
          ).length;

        const losses =
          item.transactions.filter(
            (transaction) =>
              transaction.amount <
              0,
          ).length;

        return (
          <div
            key={item.key}
            className="border-b border-white/[0.04] last:border-0"
          >
            <div
              role="button"
              tabIndex={0}
              onClick={() =>
                toggle(
                  item.key,
                )
              }
              onKeyDown={(event) => {
                if (
                  event.key === "Enter" ||
                  event.key === " "
                ) {
                  event.preventDefault();
                  toggle(item.key);
                }
              }}
              className="group grid w-full cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-4 text-left transition hover:bg-white/[0.028] sm:grid-cols-[minmax(220px,1fr)_minmax(190px,0.7fr)_150px]"
            >
              <div className="flex min-w-0 items-center gap-3">
                <Link
                  href={`/dashboard/users/${item.userId}`}
                  onClick={(event) =>
                    event.stopPropagation()
                  }
                  className="relative z-10 shrink-0 transition hover:scale-[1.04]"
                  aria-label={`${name} profilini aç`}
                >
                  <Avatar
                    member={member}
                    name={name}
                    game={
                      item.game
                    }
                  />
                </Link>

                <div className="min-w-0">
                  <div className="flex min-w-0 items-center gap-2">
                    <Link
                      href={`/dashboard/users/${item.userId}`}
                      onClick={(event) =>
                        event.stopPropagation()
                      }
                      className="relative z-10 truncate text-[12px] font-medium text-white/72 transition hover:text-white"
                    >
                      {name}
                    </Link>

                    <span className="shrink-0 rounded-full border border-cyan-200/[0.08] bg-cyan-200/[0.035] px-2 py-0.5 text-[7px] font-semibold uppercase tracking-[0.12em] text-cyan-100/45">
                      SESSION
                    </span>
                  </div>

                  <div className="mt-1 flex items-center gap-1.5 text-[9px] text-white/20">
                    <Clock3 className="h-3 w-3" />
                    {relativeTime(
                      item.endedAt,
                    )}
                  </div>
                </div>
              </div>

              <div className="hidden min-w-0 sm:block">
                <div className="flex items-center gap-2">
                  <Icon className="h-3.5 w-3.5 text-cyan-100/45" />

                  <p className="truncate text-[11px] font-medium text-white/55">
                    {GAME_LABELS[
                      item.game
                    ] ??
                      cleanType(
                        item.game,
                      )}
                  </p>
                </div>

                <p className="mt-1 text-[9px] text-white/20">
                  {sessionLabel(
                    item.transactions
                      .length,
                  )}
                  {" · "}
                  {formatNumber(
                    item.volume,
                  )} Aura həcm
                </p>
              </div>

              <div className="flex items-center justify-end gap-3">
                <Amount
                  value={
                    item.net
                  }
                />

                <ChevronDown
                  className={`h-3.5 w-3.5 text-white/25 transition-transform duration-300 ${
                    open
                      ? "rotate-180"
                      : ""
                  }`}
                />
              </div>
            </div>

            <div
              className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${
                open
                  ? "grid-rows-[1fr] opacity-100"
                  : "grid-rows-[0fr] opacity-0"
              }`}
            >
              <div className="overflow-hidden">
                <div className="mx-4 mb-4 overflow-hidden rounded-[15px] border border-white/[0.055] bg-black/25">
                  <div className="grid grid-cols-3 gap-2 border-b border-white/[0.05] px-4 py-3">
                    <div>
                      <p className="text-[7px] font-semibold uppercase tracking-[0.13em] text-white/15">
                        Əməliyyat
                      </p>

                      <p className="mt-1 text-[10px] font-semibold text-white/55">
                        {
                          item
                            .transactions
                            .length
                        }
                      </p>
                    </div>

                    <div>
                      <p className="text-[7px] font-semibold uppercase tracking-[0.13em] text-white/15">
                        Qazanc
                      </p>

                      <p className="mt-1 text-[10px] font-semibold text-emerald-100/55">
                        {wins}
                      </p>
                    </div>

                    <div>
                      <p className="text-[7px] font-semibold uppercase tracking-[0.13em] text-white/15">
                        İtki
                      </p>

                      <p className="mt-1 text-[10px] font-semibold text-rose-100/50">
                        {losses}
                      </p>
                    </div>
                  </div>

                  {item.transactions.map(
                    (
                      transaction,
                      index,
                    ) => {
                      const positive =
                        transaction.amount >
                        0;

                      const negative =
                        transaction.amount <
                        0;

                      return (
                        <div
                          key={
                            transaction.id
                          }
                          className="flex items-center gap-3 border-b border-white/[0.035] px-4 py-3 last:border-0"
                        >
                          <div
                            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] border ${
                              positive
                                ? "border-emerald-300/10 bg-emerald-300/[0.04]"
                                : negative
                                  ? "border-rose-300/10 bg-rose-300/[0.035]"
                                  : "border-white/[0.05] bg-white/[0.025]"
                            }`}
                          >
                            {positive ? (
                              <ArrowUpRight className="h-3 w-3 text-emerald-200/55" />
                            ) : negative ? (
                              <ArrowDownLeft className="h-3 w-3 text-rose-200/50" />
                            ) : (
                              <Icon className="h-3 w-3 text-white/30" />
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="text-[10px] font-medium text-white/55">
                                {GAME_LABELS[
                                  item.game
                                ] ??
                                  cleanType(
                                    item.game,
                                  )}
                              </p>

                              <span className="text-[8px] text-white/15">
                                #
                                {item
                                  .transactions
                                  .length -
                                  index}
                              </span>
                            </div>

                            <p className="mt-0.5 truncate text-[8px] text-white/20">
                              {transaction.note ||
                                (positive
                                  ? "Qazanc"
                                  : negative
                                    ? "Mərc / itki"
                                    : "Balans dəyişmədi")}
                              {" · "}
                              {relativeTime(
                                transaction.createdAt,
                              )}
                            </p>
                          </div>

                          <Amount
                            value={
                              transaction.amount
                            }
                            compact
                          />
                        </div>
                      );
                    },
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
