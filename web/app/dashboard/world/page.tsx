import { auth } from "@/auth";
import { redirect } from "next/navigation";
import {
  Globe2,
  ShieldCheck,
} from "lucide-react";

import WorldClient from "./world-client";

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

function catalog(
  value: Record<string, Record<string, unknown>>
): CatalogItem[] {
  return Object.entries(value).map(([key, item]) => ({
    key,
    name: String(item.name ?? key),
    emoji:
      typeof item.emoji === "string"
        ? item.emoji
        : undefined,
    price: Number(item.price ?? 0),
    income: Number(item.income ?? 0),
    salary: Number(item.salary ?? 0),
    xp: Number(item.xp ?? 0),
    influence: Number(item.influence ?? 0),
    bonus:
      typeof item.bonus === "number"
        ? item.bonus
        : undefined,
    description:
      typeof item.description === "string"
        ? item.description
        : undefined,
  }));
}

export default async function WorldPage() {
  const session = await auth();

  if (!session?.user?.discordId) {
    redirect("/");
  }

  const economy = await import("../../../../src/economy.js");

  const result = await economy.getWorldProfile(
    session.user.discordId
  );

  if (!result?.profile) {
    redirect("/not-member");
  }

  const profile = result.profile;
  const world = result.world;

  return (
    <div className="mx-auto max-w-[1240px]">
      <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-200" />

            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-200/55">
              Octoson World
            </p>
          </div>

          <h1 className="mt-3 text-[34px] font-semibold tracking-[-0.045em] text-white sm:text-[40px]">
            World
          </h1>

          <p className="mt-2 max-w-xl text-[13px] leading-6 text-white/25">
            İş qur, missiyalar tamamla, biznes və əmlak al,
            gəlir yarat və Octoson dünyasında influence qazan.
          </p>
        </div>

        <div className="flex items-center gap-2 text-[10px] text-white/25">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-300/60" />
          Discord economy ilə canlı sinxron
        </div>
      </div>

      <div className="mb-5 flex items-center gap-3 rounded-[20px] border border-white/[0.055] bg-white/[0.018] px-5 py-3.5">
        <Globe2 className="h-4 w-4 text-cyan-200/35" />

        <p className="text-[10px] leading-5 text-white/25">
          Buradakı bütün alışlar, missiyalar və gəlirlər botdakı
          eyni Aura profilinə tətbiq olunur.
        </p>
      </div>

      <WorldClient
        wallet={Number(profile.balance ?? 0)}
        bank={Number(profile.bank ?? 0)}
        world={{
          job: world.job ?? null,
          jobXp: Number(world.jobXp ?? 0),
          jobLevel: Number(world.jobLevel ?? 1),
          businesses: world.businesses ?? {},
          businessLevels: world.businessLevels ?? {},
          properties: world.properties ?? {},
          vehicles: Array.isArray(world.vehicles)
            ? world.vehicles
            : [],
          influence: Number(world.influence ?? 0),
          seasonPoints: Number(world.seasonPoints ?? 0),
          netWorth: Number(world.netWorth ?? 0),
          exploration: world.exploration ?? {},
        }}
        jobs={catalog(economy.worldJobs)}
        businesses={catalog(economy.worldBusinesses)}
        properties={catalog(economy.worldProperties)}
        vehicles={catalog(economy.worldVehicles)}
        maps={catalog(economy.worldMaps)}
      />
    </div>
  );
}
