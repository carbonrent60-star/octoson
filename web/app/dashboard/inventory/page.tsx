import { redirect } from "next/navigation";
import {
  Backpack,
  Badge,
  Box,
  KeyRound,
  PackageOpen,
  Sparkles,
  Ticket,
  Trophy,
  Zap,
} from "lucide-react";

import { auth } from "@/auth";
import { getOctosonUser } from "@/lib/octoson";
import InventoryControls from "./inventory-controls";

function number(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed)
    ? Math.max(0, Math.floor(parsed))
    : 0;
}

function strings(value: unknown) {
  return Array.isArray(value)
    ? value
        .filter(
          (item): item is string =>
            typeof item === "string"
        )
        .filter(Boolean)
    : [];
}

function chestEntries(value: unknown) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return [];
  }

  return Object.entries(value)
    .map(([name, count]) => ({
      name,
      count: number(count),
    }))
    .filter((item) => item.count > 0);
}

export default async function InventoryPage() {
  const session = await auth();

  if (!session?.user?.discordId) {
    redirect("/");
  }

  const economy = await getOctosonUser(
    session.user.discordId
  );

  if (!economy) {
    redirect("/not-member");
  }

  const inventory =
    economy.profile.inventory &&
    typeof economy.profile.inventory ===
      "object"
      ? (economy.profile.inventory as Record<
          string,
          unknown
        >)
      : {};

  const keys = number(inventory.keys);
  const tickets = number(inventory.tickets);
  const boosterCharges = number(
    inventory.boosterCharges
  );

  const boosters = strings(
    inventory.boosters
  );
  const collectibles = strings(
    inventory.collectibles
  );
  const badges = strings(inventory.badges);
  const titles = strings(inventory.titles);
  const borders = strings(inventory.borders);
  const effects = strings(inventory.effects);
  const chests = chestEntries(
    inventory.chests
  );

  const totalChests = chests.reduce(
    (sum, item) => sum + item.count,
    0
  );

  return (
    <div className="mx-auto max-w-[1240px]">
      <div className="mb-8">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-cyan-200" />

          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-200/55">
            Octoson Inventory
          </p>
        </div>

        <h1 className="mt-3 text-[34px] font-semibold tracking-[-0.045em] text-white sm:text-[40px]">
          İnventar
        </h1>

        <p className="mt-2 max-w-xl text-[13px] leading-6 text-white/25">
          Sandıqlarını, açarlarını,
          collectible-lərini və kosmetik
          mükafatlarını idarə et.
        </p>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          icon={PackageOpen}
          label="Sandıq"
          value={totalChests}
        />

        <Metric
          icon={KeyRound}
          label="Açar"
          value={keys}
        />

        <Metric
          icon={Ticket}
          label="Ticket"
          value={tickets}
        />

        <Metric
          icon={Zap}
          label="Booster charge"
          value={boosterCharges}
          accent
        />
      </section>

      <section className="mt-4 rounded-[20px] border border-white/[0.06] bg-white/[0.018] p-5 sm:p-6">
        <div className="mb-5">
          <p className="text-[8px] font-semibold uppercase tracking-[0.17em] text-white/15">
            ACTIONS
          </p>

          <h2 className="mt-1.5 text-[14px] font-semibold text-white/60">
            İnventarı istifadə et
          </h2>
        </div>

        <InventoryControls
          canOpen={totalChests > 0 || keys > 0}
          collectibles={collectibles.length}
        />
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel
          icon={PackageOpen}
          eyebrow="CHESTS"
          title="Sandıqlar"
        >
          {chests.length ? (
            <div className="space-y-2">
              {chests.map((chest) => (
                <InventoryRow
                  key={chest.name}
                  icon={Box}
                  name={chest.name}
                  value={`×${chest.count}`}
                />
              ))}
            </div>
          ) : (
            <Empty text="Sandıq yoxdur." />
          )}
        </Panel>

        <Panel
          icon={Sparkles}
          eyebrow="COLLECTION"
          title="Collectibles"
        >
          {collectibles.length ? (
            <div className="flex flex-wrap gap-2">
              {collectibles.map(
                (item, index) => (
                  <Tag
                    key={`${item}-${index}`}
                    text={item}
                  />
                )
              )}
            </div>
          ) : (
            <Empty text="Collectible yoxdur." />
          )}
        </Panel>

        <Panel
          icon={Zap}
          eyebrow="BOOSTERS"
          title="Booster-lər"
        >
          {boosters.length ? (
            <div className="space-y-2">
              {boosters.map(
                (item, index) => (
                  <InventoryRow
                    key={`${item}-${index}`}
                    icon={Zap}
                    name={item}
                    value={
                      item === "Lucky Booster"
                        ? `${boosterCharges} charge`
                        : "Aktiv"
                    }
                  />
                )
              )}
            </div>
          ) : (
            <Empty text="Booster yoxdur." />
          )}
        </Panel>

        <Panel
          icon={Trophy}
          eyebrow="COSMETICS"
          title="Titullar və nişanlar"
        >
          {titles.length ||
          badges.length ||
          borders.length ||
          effects.length ? (
            <div className="space-y-4">
              <Collection
                label="Titullar"
                values={titles}
              />

              <Collection
                label="Badges"
                values={badges}
              />

              <Collection
                label="Borders"
                values={borders}
              />

              <Collection
                label="Effects"
                values={effects}
              />
            </div>
          ) : (
            <Empty text="Kosmetik item yoxdur." />
          )}
        </Panel>
      </div>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  accent = false,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div className="rounded-[18px] border border-white/[0.06] bg-white/[0.018] p-5">
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

      <p className="mt-5 text-[8px] font-medium uppercase tracking-[0.12em] text-white/18">
        {label}
      </p>

      <p className="mt-1 text-[23px] font-semibold tracking-[-0.035em] text-white/75">
        {value.toLocaleString("en-US")}
      </p>
    </div>
  );
}

function Panel({
  icon: Icon,
  eyebrow,
  title,
  children,
}: {
  icon: React.ElementType;
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[20px] border border-white/[0.06] bg-white/[0.018] p-5 sm:p-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <p className="text-[8px] font-semibold uppercase tracking-[0.17em] text-white/15">
            {eyebrow}
          </p>

          <h2 className="mt-1.5 text-[14px] font-semibold text-white/60">
            {title}
          </h2>
        </div>

        <div className="flex h-8 w-8 items-center justify-center rounded-[10px] border border-white/[0.055] bg-black/20">
          <Icon className="h-3.5 w-3.5 text-white/22" />
        </div>
      </div>

      {children}
    </section>
  );
}

function InventoryRow({
  icon: Icon,
  name,
  value,
}: {
  icon: React.ElementType;
  name: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-[13px] border border-white/[0.05] bg-black/20 px-4 py-3">
      <div className="flex h-8 w-8 items-center justify-center rounded-[9px] border border-white/[0.05] bg-white/[0.018]">
        <Icon className="h-3.5 w-3.5 text-cyan-100/35" />
      </div>

      <p className="min-w-0 flex-1 truncate text-[10px] font-medium text-white/40">
        {name}
      </p>

      <span className="text-[9px] font-semibold text-white/22">
        {value}
      </span>
    </div>
  );
}

function Collection({
  label,
  values,
}: {
  label: string;
  values: string[];
}) {
  if (!values.length) return null;

  return (
    <div>
      <p className="mb-2 text-[8px] uppercase tracking-[0.12em] text-white/15">
        {label}
      </p>

      <div className="flex flex-wrap gap-2">
        {values.map((value, index) => (
          <Tag
            key={`${value}-${index}`}
            text={value}
          />
        ))}
      </div>
    </div>
  );
}

function Tag({ text }: { text: string }) {
  return (
    <span className="rounded-[9px] border border-white/[0.055] bg-black/20 px-3 py-2 text-[9px] text-white/35">
      {text}
    </span>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="flex min-h-[100px] items-center justify-center rounded-[13px] border border-dashed border-white/[0.055] bg-black/15">
      <div className="flex items-center gap-2 text-[9px] text-white/16">
        <Backpack className="h-3.5 w-3.5" />
        {text}
      </div>
    </div>
  );
}
