"use client";

import { useState, useTransition } from "react";
import {
  BriefcaseBusiness,
  Building2,
  Car,
  ChevronRight,
  Coins,
  Compass,
  Crown,
  Gauge,
  House,
  Landmark,
  Map,
  Sparkles,
  TrendingUp,
  Zap,
} from "lucide-react";

import {
  buyBusinessAction,
  buyPropertyAction,
  buyVehicleAction,
  chooseJobAction,
  collectIncomeAction,
  exploreAction,
  missionAction,
  upgradeBusinessAction,
  type WorldActionResult,
} from "./actions";

type CatalogItem = {
  key: string;
  name: string;
  emoji?: string;
  price?: number;
  income?: number;
  salary?: number;
  xp?: number;
  influence?: number;
  bonus?: number;
  description?: string;
};

type Props = {
  wallet: number;
  bank: number;
  world: {
    job: string | null;
    jobXp: number;
    jobLevel: number;
    businesses: Record<string, number>;
    businessLevels: Record<string, number>;
    properties: Record<string, number>;
    vehicles: string[];
    influence: number;
    seasonPoints: number;
    netWorth: number;
    exploration: Record<string, { visits?: number }>;
  };
  jobs: CatalogItem[];
  businesses: CatalogItem[];
  properties: CatalogItem[];
  vehicles: CatalogItem[];
  maps: CatalogItem[];
};

function n(value: number | undefined) {
  return Number(value ?? 0).toLocaleString("en-US");
}

function Panel({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-[24px] border border-white/[0.07] bg-[#0a0a0d] ${className}`}
    >
      {children}
    </div>
  );
}

function ActionButton({
  label,
  action,
  fields = {},
  disabled = false,
}: {
  label: string;
  action: (data: FormData) => Promise<WorldActionResult>;
  fields?: Record<string, string>;
  disabled?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<WorldActionResult | null>(null);

  function run() {
    const data = new FormData();

    Object.entries(fields).forEach(([key, value]) => {
      data.set(key, value);
    });

    startTransition(async () => {
      const response = await action(data);
      setResult(response);
    });
  }

  return (
    <div>
      <button
        type="button"
        disabled={disabled || pending}
        onClick={run}
        className="inline-flex min-h-9 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.035] px-3 text-[10px] font-medium text-white/55 transition hover:border-cyan-200/20 hover:bg-cyan-200/[0.05] hover:text-cyan-100 disabled:cursor-not-allowed disabled:opacity-30"
      >
        {pending ? "Gözlə..." : label}
      </button>

      {result && (
        <p
          className={`mt-2 max-w-[240px] text-[9px] leading-4 ${
            result.ok ? "text-emerald-300/60" : "text-rose-300/60"
          }`}
        >
          {result.message}
        </p>
      )}
    </div>
  );
}

function AssetCard({
  item,
  meta,
  children,
}: {
  item: CatalogItem;
  meta: string;
  children: React.ReactNode;
}) {
  return (
    <div className="group rounded-[18px] border border-white/[0.055] bg-white/[0.018] p-4 transition hover:border-white/[0.09] hover:bg-white/[0.028]">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[18px]">{item.emoji ?? "◆"}</span>
            <p className="truncate text-[12px] font-medium text-white/70">
              {item.name}
            </p>
          </div>

          <p className="mt-2 text-[9px] text-white/25">{meta}</p>

          {item.description && (
            <p className="mt-2 line-clamp-2 text-[9px] leading-4 text-white/18">
              {item.description}
            </p>
          )}
        </div>

        <ChevronRight className="mt-1 h-3.5 w-3.5 shrink-0 text-white/10 transition group-hover:text-white/25" />
      </div>

      <div className="mt-4">{children}</div>
    </div>
  );
}

export default function WorldClient({
  wallet,
  bank,
  world,
  jobs,
  businesses,
  properties,
  vehicles,
  maps,
}: Props) {
  const activeJob = jobs.find((item) => item.key === world.job);

  const ownedBusinesses = Object.values(world.businesses).reduce(
    (sum, count) => sum + Number(count ?? 0),
    0
  );

  const ownedProperties = Object.values(world.properties).reduce(
    (sum, count) => sum + Number(count ?? 0),
    0
  );

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Net worth",
            value: `${n(world.netWorth)} Aura`,
            icon: Crown,
          },
          {
            label: "Influence",
            value: n(world.influence),
            icon: TrendingUp,
          },
          {
            label: "Season points",
            value: n(world.seasonPoints),
            icon: Zap,
          },
          {
            label: "Assets",
            value: n(
              ownedBusinesses + ownedProperties + world.vehicles.length
            ),
            icon: Landmark,
          },
        ].map((item) => {
          const Icon = item.icon;

          return (
            <Panel key={item.label} className="p-5">
              <div className="flex items-center justify-between">
                <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/18">
                  {item.label}
                </p>

                <Icon className="h-3.5 w-3.5 text-cyan-200/30" />
              </div>

              <p className="mt-3 text-[19px] font-semibold tracking-[-0.04em] text-white/75">
                {item.value}
              </p>
            </Panel>
          );
        })}
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
        <Panel className="relative overflow-hidden p-6 sm:p-7">
          <div className="pointer-events-none absolute -right-28 -top-32 h-[330px] w-[330px] rounded-full bg-cyan-300/[0.045] blur-[90px]" />

          <div className="relative">
            <div className="flex flex-wrap items-start justify-between gap-5">
              <div>
                <div className="flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[0.15em] text-cyan-100/35">
                  <BriefcaseBusiness className="h-3.5 w-3.5" />
                  Karyera
                </div>

                <h2 className="mt-3 text-[22px] font-semibold tracking-[-0.04em] text-white/75">
                  {activeJob
                    ? `${activeJob.emoji ?? "💼"} ${activeJob.name}`
                    : "İş seçilməyib"}
                </h2>

                <p className="mt-2 text-[10px] text-white/25">
                  Lv.{world.jobLevel} · {n(world.jobXp)} XP
                </p>
              </div>

              <div className="rounded-2xl border border-white/[0.055] bg-black/20 px-4 py-3">
                <p className="text-[8px] uppercase tracking-[0.13em] text-white/15">
                  Likvid balans
                </p>
                <p className="mt-1 text-[12px] font-medium text-white/55">
                  {n(wallet + bank)} Aura
                </p>
              </div>
            </div>

            <div className="mt-6 grid gap-2 sm:grid-cols-3">
              {["safe", "smart", "risky"].map((choice) => (
                <ActionButton
                  key={choice}
                  label={
                    choice === "safe"
                      ? "Təhlükəsiz missiya"
                      : choice === "smart"
                      ? "Ağıllı missiya"
                      : "Riskli missiya"
                  }
                  action={missionAction}
                  fields={{ choice }}
                  disabled={!world.job}
                />
              ))}
            </div>
          </div>
        </Panel>

        <Panel className="p-6 sm:p-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[0.15em] text-emerald-200/35">
                <Coins className="h-3.5 w-3.5" />
                Passive income
              </div>

              <h2 className="mt-3 text-[20px] font-semibold tracking-[-0.035em] text-white/70">
                Gəliri topla
              </h2>

              <p className="mt-2 max-w-sm text-[10px] leading-5 text-white/22">
                Biznes və əmlaklarının yaratdığı World gəlirini Aura balansına
                keçir.
              </p>
            </div>

            <Gauge className="h-5 w-5 text-white/10" />
          </div>

          <div className="mt-6">
            <ActionButton
              label="Gəliri topla"
              action={async () => collectIncomeAction()}
            />
          </div>
        </Panel>
      </div>

      <Panel className="p-6 sm:p-7">
        <div className="mb-5 flex items-center gap-2">
          <BriefcaseBusiness className="h-4 w-4 text-white/20" />
          <h2 className="text-[16px] font-semibold tracking-[-0.03em] text-white/65">
            İşlər
          </h2>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {jobs.map((item) => (
            <AssetCard
              key={item.key}
              item={item}
              meta={`${n(item.salary)} Aura baza maaşı · ${n(item.xp)} XP`}
            >
              <ActionButton
                label={world.job === item.key ? "Aktiv iş" : "İşi seç"}
                action={chooseJobAction}
                fields={{ key: item.key }}
                disabled={world.job === item.key}
              />
            </AssetCard>
          ))}
        </div>
      </Panel>

      <Panel className="p-6 sm:p-7">
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-white/20" />
            <h2 className="text-[16px] font-semibold tracking-[-0.03em] text-white/65">
              Bizneslər
            </h2>
          </div>

          <span className="text-[9px] text-white/18">
            {ownedBusinesses} sahiblik
          </span>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {businesses.map((item) => {
            const count = Number(world.businesses[item.key] ?? 0);
            const level = Number(world.businessLevels[item.key] ?? 1);

            return (
              <AssetCard
                key={item.key}
                item={item}
                meta={`${n(item.price)} Aura · ${n(
                  item.income
                )} gəlir · ${count} ədəd · Lv.${level}`}
              >
                <div className="flex flex-wrap gap-2">
                  <ActionButton
                    label="Al"
                    action={buyBusinessAction}
                    fields={{ key: item.key }}
                  />

                  <ActionButton
                    label={level >= 10 ? "MAX" : "Upgrade"}
                    action={upgradeBusinessAction}
                    fields={{ key: item.key }}
                    disabled={count <= 0 || level >= 10}
                  />
                </div>
              </AssetCard>
            );
          })}
        </div>
      </Panel>

      <div className="grid gap-5 xl:grid-cols-2">
        <Panel className="p-6 sm:p-7">
          <div className="mb-5 flex items-center gap-2">
            <House className="h-4 w-4 text-white/20" />
            <h2 className="text-[16px] font-semibold tracking-[-0.03em] text-white/65">
              Əmlak
            </h2>
          </div>

          <div className="space-y-3">
            {properties.map((item) => {
              const count = Number(world.properties[item.key] ?? 0);

              return (
                <AssetCard
                  key={item.key}
                  item={item}
                  meta={`${n(item.price)} Aura · ${n(
                    item.income
                  )} gəlir · ${count} ədəd`}
                >
                  <ActionButton
                    label="Əmlakı al"
                    action={buyPropertyAction}
                    fields={{ key: item.key }}
                  />
                </AssetCard>
              );
            })}
          </div>
        </Panel>

        <Panel className="p-6 sm:p-7">
          <div className="mb-5 flex items-center gap-2">
            <Car className="h-4 w-4 text-white/20" />
            <h2 className="text-[16px] font-semibold tracking-[-0.03em] text-white/65">
              Nəqliyyat
            </h2>
          </div>

          <div className="space-y-3">
            {vehicles.map((item) => {
              const owned = world.vehicles.includes(item.key);

              return (
                <AssetCard
                  key={item.key}
                  item={item}
                  meta={`${n(item.price)} Aura · bonus ${
                    typeof item.bonus === "number"
                      ? `+${Math.round(item.bonus * 100)}%`
                      : "—"
                  }`}
                >
                  <ActionButton
                    label={owned ? "Sahibsən" : "Nəqliyyatı al"}
                    action={buyVehicleAction}
                    fields={{ key: item.key }}
                    disabled={owned}
                  />
                </AssetCard>
              );
            })}
          </div>
        </Panel>
      </div>

      <Panel className="relative overflow-hidden p-6 sm:p-7">
        <div className="pointer-events-none absolute -bottom-32 left-1/3 h-[320px] w-[320px] rounded-full bg-violet-300/[0.035] blur-[90px]" />

        <div className="relative">
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Compass className="h-4 w-4 text-white/20" />
              <h2 className="text-[16px] font-semibold tracking-[-0.03em] text-white/65">
                Kəşfiyyat
              </h2>
            </div>

            <Map className="h-4 w-4 text-white/10" />
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {maps.map((item) => {
              const visits = Number(
                world.exploration[item.key]?.visits ?? 0
              );

              return (
                <AssetCard
                  key={item.key}
                  item={item}
                  meta={`${visits} ziyarət`}
                >
                  <ActionButton
                    label="Kəşf et"
                    action={exploreAction}
                    fields={{ key: item.key }}
                  />
                </AssetCard>
              );
            })}
          </div>
        </div>
      </Panel>

      <div className="flex items-center justify-center gap-2 py-3 text-[9px] text-white/15">
        <Sparkles className="h-3 w-3" />
        World əməliyyatları Discord economy ilə eyni profilə yazılır.
      </div>
    </div>
  );
}
