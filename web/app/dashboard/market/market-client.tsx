"use client";

import {
  useState,
  useTransition,
} from "react";
import {
  Box,
  Check,
  ChevronRight,
  Gem,
  KeyRound,
  PackageOpen,
  ShoppingBag,
  Sparkles,
  Wallet,
  Zap,
} from "lucide-react";

import {
  buyMarketItemAction,
  type MarketActionResult,
} from "./actions";

export type MarketItem = {
  key: string;
  name: string;
  price: number;
  type: string;
  amount: number;
};

function formatAura(value: number) {
  return Math.floor(value).toLocaleString("en-US");
}

function itemMeta(type: string) {
  switch (type) {
    case "keys":
      return {
        icon: KeyRound,
        label: "Açar",
        description:
          "Sandıq olmadıqda Bronze Key cache açmaq üçün istifadə olunur.",
      };

    case "boosters":
      return {
        icon: Zap,
        label: "Booster",
        description:
          "Casino oyunlarında növbəti uyğun mərcə Lucky Booster effekti verir.",
      };

    case "chests":
      return {
        icon: PackageOpen,
        label: "Sandıq",
        description:
          "Açaraq Aura və collectible mükafatları əldə et.",
      };

    default:
      return {
        icon: Box,
        label: "Item",
        description:
          "Octoson inventarına əlavə olunan economy item.",
      };
  }
}

export default function MarketClient({
  wallet,
  items,
}: {
  wallet: number;
  items: MarketItem[];
}) {
  const [pending, startTransition] =
    useTransition();

  const [busyKey, setBusyKey] =
    useState<string | null>(null);

  const [result, setResult] =
    useState<MarketActionResult | null>(null);

  const [localWallet, setLocalWallet] =
    useState(wallet);

  function buy(item: MarketItem) {
    if (pending) return;

    setBusyKey(item.key);
    setResult(null);

    startTransition(async () => {
      const response =
        await buyMarketItemAction(item.key);

      setResult(response);

      if (response.ok) {
        setLocalWallet((current) =>
          Math.max(0, current - item.price)
        );
      }

      setBusyKey(null);
    });
  }

  return (
    <>
      <div className="mb-5 flex items-center justify-between rounded-[15px] border border-white/[0.055] bg-white/[0.018] px-4 py-3">
        <div className="flex items-center gap-2.5">
          <Wallet className="h-3.5 w-3.5 text-white/25" />

          <span className="text-[9px] text-white/20">
            Alış üçün mövcud
          </span>
        </div>

        <div className="flex items-baseline gap-1.5">
          <span className="text-[13px] font-semibold text-white/65">
            {formatAura(localWallet)}
          </span>

          <span className="text-[8px] font-semibold uppercase tracking-[0.1em] text-cyan-100/35">
            Aura
          </span>
        </div>
      </div>

      {result && (
        <div
          className={`mb-5 rounded-[14px] border px-4 py-3 text-[10px] ${
            result.ok
              ? "border-emerald-300/[0.09] bg-emerald-300/[0.025] text-emerald-200/60"
              : "border-rose-300/[0.09] bg-rose-300/[0.025] text-rose-200/60"
          }`}
        >
          <div className="flex items-center gap-2">
            {result.ok ? (
              <Check className="h-3.5 w-3.5" />
            ) : (
              <Gem className="h-3.5 w-3.5" />
            )}

            {result.message}
          </div>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {items.map((item) => {
          const meta = itemMeta(item.type);
          const Icon = meta.icon;
          const affordable =
            localWallet >= item.price;
          const buying =
            pending && busyKey === item.key;

          return (
            <div
              key={item.key}
              className="group relative overflow-hidden rounded-[20px] border border-white/[0.06] bg-white/[0.018] p-5 transition duration-300 hover:border-cyan-100/[0.09] hover:bg-white/[0.024]"
            >
              <div className="pointer-events-none absolute -right-20 -top-20 h-44 w-44 rounded-full bg-cyan-200/[0.025] blur-[55px]" />

              <div className="relative">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-[13px] border border-cyan-100/[0.07] bg-cyan-100/[0.025]">
                    <Icon className="h-[18px] w-[18px] text-cyan-100/45" />
                  </div>

                  <span className="rounded-full border border-white/[0.055] bg-black/20 px-2.5 py-1 text-[8px] font-medium uppercase tracking-[0.11em] text-white/20">
                    {meta.label}
                  </span>
                </div>

                <p className="mt-5 text-[14px] font-semibold tracking-[-0.02em] text-white/65">
                  {item.name}
                </p>

                <p className="mt-2 min-h-[36px] max-w-sm text-[9px] leading-[18px] text-white/18">
                  {meta.description}
                </p>

                <div className="mt-5 flex items-end justify-between gap-4 border-t border-white/[0.045] pt-4">
                  <div>
                    <p className="text-[8px] uppercase tracking-[0.12em] text-white/15">
                      Qiymət
                    </p>

                    <div className="mt-1 flex items-baseline gap-1.5">
                      <span className="text-[18px] font-semibold tracking-[-0.03em] text-white/65">
                        {formatAura(item.price)}
                      </span>

                      <span className="text-[8px] font-semibold text-cyan-100/30">
                        AURA
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={
                      pending || !affordable
                    }
                    onClick={() => buy(item)}
                    className="flex h-9 items-center gap-2 rounded-[11px] border border-cyan-100/[0.08] bg-cyan-100/[0.035] px-4 text-[9px] font-semibold text-cyan-50/55 transition hover:bg-cyan-100/[0.065] disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    {buying
                      ? "Alınır..."
                      : affordable
                        ? "Al"
                        : "Aura çatmır"}

                    {!buying && affordable && (
                      <ChevronRight className="h-3 w-3" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex items-start gap-3 rounded-[14px] border border-white/[0.045] bg-black/15 px-4 py-3">
        <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-100/25" />

        <p className="text-[9px] leading-5 text-white/16">
          Market alışları birbaşa Discord botundakı eyni
          economy profilinə yazılır. Sandıq və açarlara
          mövcud gündəlik limitlər tətbiq olunur.
        </p>
      </div>
    </>
  );
}
