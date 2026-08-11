import { createPageMetadata } from "@/lib/metadata";
import { redirect } from "next/navigation";
import {
  ShoppingBag,
  ShieldCheck,
} from "lucide-react";

import { auth } from "@/auth";
import { getOctosonUser } from "@/lib/octoson";
import MarketClient, {
  type MarketItem,
} from "./market-client";

type ShopItem = {
  name: string;
  price: number;
  type: string;
  amount?: number;
};

async function getShopItems() {
  const economy = (await import(
    "../../../../src/economy.js"
  )) as unknown as {
    shopItems: Record<string, ShopItem>;
  };

  return Object.entries(economy.shopItems).map(
    ([key, item]) => ({
      key,
      name: item.name,
      price: Number(item.price ?? 0),
      type: item.type,
      amount: Number(item.amount ?? 1),
    })
  ) satisfies MarketItem[];
}


export const metadata = createPageMetadata({
  title: 'Market',
  description: 'Aura ilə Octoson market əşyalarını kəşf et və al.',
  path: '/dashboard/market',
});

export default async function MarketPage() {
  const session = await auth();

  if (!session?.user?.discordId) {
    redirect("/");
  }

  const [economy, items] = await Promise.all([
    getOctosonUser(session.user.discordId),
    getShopItems(),
  ]);

  if (!economy) {
    redirect("/not-member");
  }

  const wallet = Number(
    economy.profile.balance ?? 0
  );

  return (
    <div className="mx-auto max-w-[1240px]">
      <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-200" />

            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-200/55">
              Octoson Market
            </p>
          </div>

          <h1 className="mt-3 text-[34px] font-semibold tracking-[-0.045em] text-white sm:text-[40px]">
            Market
          </h1>

          <p className="mt-2 max-w-xl text-[13px] leading-6 text-white/25">
            Aura ilə item al və birbaşa Octoson
            inventarına əlavə et.
          </p>
        </div>

        <div className="flex items-center gap-2 text-[10px] text-white/25">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-300/60" />
          Discord economy ilə sinxron
        </div>
      </div>

      <section className="relative overflow-hidden rounded-[26px] border border-white/[0.07] bg-[#0a0a0d]">
        <div className="pointer-events-none absolute -right-32 -top-40 h-[420px] w-[420px] rounded-full bg-cyan-300/[0.04] blur-[100px]" />

        <div className="relative p-6 sm:p-8">
          <div className="mb-7 flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[0.15em] text-white/15">
                <ShoppingBag className="h-3.5 w-3.5" />
                Store
              </div>

              <h2 className="mt-2 text-[20px] font-semibold tracking-[-0.035em] text-white/70">
                Economy items
              </h2>
            </div>

            <span className="rounded-full border border-white/[0.055] bg-white/[0.02] px-3 py-1.5 text-[8px] text-white/20">
              {items.length} məhsul
            </span>
          </div>

          <MarketClient
            wallet={wallet}
            items={items}
          />
        </div>
      </section>
    </div>
  );
}
