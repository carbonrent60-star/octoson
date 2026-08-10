"use server";

import { auth } from "@/auth";
import { revalidatePath } from "next/cache";

export type InventoryActionResult = {
  ok: boolean;
  message: string;
};

type InventoryEngineResult = {
  ok: boolean;
  reason?: string;
  chestName?: string;
  reward?: number;
  baseReward?: number;
  cacheMultiplier?: number;
  collectible?: string;
  title?: string;
  item?: string;
  profile?: unknown;
};

type InventoryEconomyModule = {
  openBestChest(
    userId: string
  ): Promise<InventoryEngineResult>;

  craftCollectible(
    userId: string
  ): Promise<InventoryEngineResult>;

  recycleCollectible(
    userId: string
  ): Promise<InventoryEngineResult>;

  salvageCollectible(
    userId: string
  ): Promise<InventoryEngineResult>;
};

async function getEconomyModule(): Promise<InventoryEconomyModule> {
  return import(
    "../../../../src/economy.js"
  ) as unknown as Promise<InventoryEconomyModule>;
}

function refresh() {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard/market");
  revalidatePath("/dashboard/profile");
}

export async function openChestAction(): Promise<InventoryActionResult> {
  const session = await auth();

  if (!session?.user?.discordId) {
    return {
      ok: false,
      message: "Discord sessiyası tapılmadı.",
    };
  }

  const economy = await getEconomyModule();

  const result = await economy.openBestChest(
    session.user.discordId
  );

  if (!result.ok) {
    switch (result.reason) {
      case "chests_disabled":
        return {
          ok: false,
          message:
            "Sandıq açma sistemi hazırda deaktivdir.",
        };

      case "missing":
      case "empty":
      case "no_chest":
        return {
          ok: false,
          message:
            "Açmaq üçün sandığın və ya açarın yoxdur.",
        };

      default:
        return {
          ok: false,
          message:
            "Sandığı açmaq mümkün olmadı.",
        };
    }
  }

  refresh();

  const reward =
    typeof result.reward === "number"
      ? ` +${result.reward.toLocaleString(
          "en-US"
        )} Aura`
      : "";

  const collectible = result.collectible
    ? ` • ${result.collectible}`
    : "";

  return {
    ok: true,
    message: `${
      result.chestName ?? "Sandıq"
    } açıldı.${reward}${collectible}`,
  };
}

export async function craftAction(): Promise<InventoryActionResult> {
  const session = await auth();

  if (!session?.user?.discordId) {
    return {
      ok: false,
      message: "Discord sessiyası tapılmadı.",
    };
  }

  const economy = await getEconomyModule();

  const result = await economy.craftCollectible(
    session.user.discordId
  );

  if (!result.ok) {
    return {
      ok: false,
      message:
        "Craft üçün ən azı 3 collectible lazımdır.",
    };
  }

  refresh();

  return {
    ok: true,
    message: result.title
      ? `Yeni titul yaradıldı: ${result.title}`
      : "Craft tamamlandı.",
  };
}

export async function recycleAction(): Promise<InventoryActionResult> {
  const session = await auth();

  if (!session?.user?.discordId) {
    return {
      ok: false,
      message: "Discord sessiyası tapılmadı.",
    };
  }

  const economy = await getEconomyModule();

  const result =
    await economy.recycleCollectible(
      session.user.discordId
    );

  if (!result.ok) {
    return {
      ok: false,
      message:
        "Recycle etmək üçün collectible yoxdur.",
    };
  }

  refresh();

  return {
    ok: true,
    message: `${result.item ?? "Collectible"} recycle edildi${
      typeof result.reward === "number"
        ? ` • +${result.reward.toLocaleString(
            "en-US"
          )} Aura`
        : ""
    }.`,
  };
}

export async function salvageAction(): Promise<InventoryActionResult> {
  const session = await auth();

  if (!session?.user?.discordId) {
    return {
      ok: false,
      message: "Discord sessiyası tapılmadı.",
    };
  }

  const economy = await getEconomyModule();

  const result =
    await economy.salvageCollectible(
      session.user.discordId
    );

  if (!result.ok) {
    return {
      ok: false,
      message:
        "Salvage etmək üçün collectible yoxdur.",
    };
  }

  refresh();

  return {
    ok: true,
    message: `${result.item ?? "Collectible"} salvage edildi • +1 açar.`,
  };
}
