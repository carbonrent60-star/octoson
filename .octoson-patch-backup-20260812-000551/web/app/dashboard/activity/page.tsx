import { auth } from "@/auth";
import { redirect } from "next/navigation";
import {
  Activity,
  Coins,
  Gamepad2,
  History,
} from "lucide-react";

import ActivityFeed from "@/components/activity/activity-feed";

import { createPageMetadata } from "@/lib/metadata";

import {
  getOctosonPublicActivity,
  getOctosonUser,
} from "@/lib/octoson";

import {
  getOctosonGuildMembers,
} from "@/lib/discord-server";

export const dynamic = "force-dynamic";

export const metadata = createPageMetadata({
  title: "Fəaliyyət",
  description:
    "Octoson economy-də baş verən açıq əməliyyat və oyun tarixçəsi.",
  path: "/dashboard/activity",
});

function formatNumber(value: number) {
  return Math.abs(Math.floor(value)).toLocaleString("en-US");
}

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

function relativeTime(date: string) {
  const ms = Date.now() - new Date(date).getTime();

  const seconds = Math.max(0, Math.floor(ms / 1000));

  if (seconds < 10) return "indi";
  if (seconds < 60) return `${seconds} san əvvəl`;

  const minutes = Math.floor(seconds / 60);

  if (minutes < 60) return `${minutes} dəq əvvəl`;

  const hours = Math.floor(minutes / 60);

  if (hours < 24) return `${hours} saat əvvəl`;

  const days = Math.floor(hours / 24);

  if (days < 30) return `${days} gün əvvəl`;

  return new Date(date).toLocaleDateString("az-AZ");
}

export default async function ActivityPage() {
  const session = await auth();

  if (!session?.user?.discordId) {
    redirect("/");
  }

  const [currentUser, transactions] = await Promise.all([
    getOctosonUser(session.user.discordId),
    getOctosonPublicActivity(150),
  ]);

  if (!currentUser) {
    redirect("/not-member");
  }

  const userIds = [
    ...new Set(
      transactions.map((transaction) => transaction.userId)
    ),
  ];

  const members = await getOctosonGuildMembers(userIds);

  const casinoCount = transactions.filter((transaction) =>
    casinoTypes.has(transaction.type)
  ).length;

  const totalVolume = transactions.reduce(
    (sum, transaction) =>
      sum + Math.abs(transaction.amount),
    0
  );

  return (
    <div className="mx-auto max-w-[1240px]">
      <header className="mb-7">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-cyan-200" />

          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-200/55">
            Public Ledger
          </p>
        </div>

        <h1 className="mt-3 text-[34px] font-semibold tracking-[-0.045em] text-white sm:text-[40px]">
          Fəaliyyət
        </h1>

        <p className="mt-2 max-w-2xl text-[13px] leading-6 text-white/25">
          Octoson economy-də qeydə alınmış oyunlar,
          mərclər və Aura hərəkətləri.
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        <Summary
          icon={Activity}
          label="Son əməliyyatlar"
          value={transactions.length.toLocaleString("en-US")}
        />

        <Summary
          icon={Gamepad2}
          label="Kazino"
          value={casinoCount.toLocaleString("en-US")}
        />

        <Summary
          icon={Coins}
          label="Aura həcmi"
          value={formatNumber(totalVolume)}
        />
      </section>

      <section className="mt-5 overflow-hidden rounded-[20px] border border-white/[0.06] bg-white/[0.018]">
        <div className="flex items-center justify-between border-b border-white/[0.05] px-5 py-4 sm:px-6">
          <div>
            <p className="text-[8px] font-semibold uppercase tracking-[0.17em] text-white/15">
              LIVE ECONOMY
            </p>

            <h2 className="mt-1.5 text-[14px] font-semibold text-white/60">
              Son hərəkətlər
            </h2>
          </div>

          <History className="h-4 w-4 text-white/20" />
        </div>

        {transactions.length ? (
          <ActivityFeed
            transactions={transactions}
            members={members}
          />
        ) : (
          <div className="px-6 py-16 text-center text-[12px] text-white/25">
            Hələ qeydə alınmış fəaliyyət yoxdur.
          </div>
        )}
      </section>
    </div>
  );
}

function Summary({
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

      <p className="mt-5 text-[9px] font-medium uppercase tracking-[0.14em] text-white/20">
        {label}
      </p>

      <p className="mt-1.5 text-[20px] font-semibold tracking-[-0.035em] text-white/75">
        {value}
      </p>
    </div>
  );
}
