"use server";

import { auth } from "@/auth";
import { revalidatePath } from "next/cache";

export type MarketActionResult = {
  ok: boolean;
  message: string;
};

type ShopItem = {
  name: string;
  price: number;
  type: string;
  amount?: number;
};

type ShopResult = {
  ok: boolean;
  reason?: string;
  item?: ShopItem;
  profile?: {
    balance?: number;
  };
  limit?: number;
  remaining?: number;
};

type SellResult = {
  ok: boolean;
  reason?: string;
  item?: string;
  reward?: number;
  profile?: {
    balance?: number;
  };
};

type EconomyMarketModule = {
  shopItems: Record<string, ShopItem>;

  buyShopItem(
    userId: string,
    itemKey: string
  ): Promise<ShopResult>;

  sellInventoryItem(
    userId: string,
    itemName: string
  ): Promise<SellResult>;
};

async function getEconomyModule(): Promise<EconomyMarketModule> {
  return import(
    "../../../../src/economy.js"
  ) as unknown as Promise<EconomyMarketModule>;
}

function refreshEconomyPages() {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/market");
  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard/profile");
}

export async function buyMarketItemAction(
  itemKey: string
): Promise<MarketActionResult> {
  const session = await auth();

  if (!session?.user?.discordId) {
    return {
      ok: false,
      message: "Discord sessiyası tapılmadı.",
    };
  }

  if (
    typeof itemKey !== "string" ||
    itemKey.length < 1 ||
    itemKey.length > 80
  ) {
    return {
      ok: false,
      message: "Məhsul tanınmadı.",
    };
  }

  const economy = await getEconomyModule();

  if (!economy.shopItems[itemKey]) {
    return {
      ok: false,
      message: "Bu məhsul marketdə yoxdur.",
    };
  }

  const result = await economy.buyShopItem(
    session.user.discordId,
    itemKey
  );

  if (!result.ok) {
    switch (result.reason) {
      case "insufficient":
        return {
          ok: false,
          message:
            "Wallet-də bu alış üçün kifayət qədər Aura yoxdur.",
        };

      case "chests_disabled":
        return {
          ok: false,
          message:
            "Sandıq və açar alışları hazırda deaktivdir.",
        };

      case "daily_chest_limit":
        return {
          ok: false,
          message:
            typeof result.remaining === "number"
              ? `Gündəlik sandıq limitinə çatmısan. Qalan alış: ${result.remaining}.`
              : "Gündəlik sandıq alış limitinə çatmısan.",
        };

      case "missing":
      case "not_found":
        return {
          ok: false,
          message: "Bu məhsul artıq mövcud deyil.",
        };

      default:
        return {
          ok: false,
          message: "Alışı tamamlamaq mümkün olmadı.",
        };
    }
  }

  refreshEconomyPages();

  return {
    ok: true,
    message: `${result.item?.name ?? economy.shopItems[itemKey].name} inventara əlavə edildi.`,
  };
}

export async function sellCollectibleAction(
  itemName: string
): Promise<MarketActionResult> {
  const session = await auth();

  if (!session?.user?.discordId) {
    return {
      ok: false,
      message: "Discord sessiyası tapılmadı.",
    };
  }

  const cleanName =
    typeof itemName === "string"
      ? itemName.trim().slice(0, 160)
      : "";

  if (!cleanName) {
    return {
      ok: false,
      message: "Satılacaq collectible seçilmədi.",
    };
  }

  const economy = await getEconomyModule();

  const result = await economy.sellInventoryItem(
    session.user.discordId,
    cleanName
  );

  if (!result.ok) {
    return {
      ok: false,
      message:
        result.reason === "missing" ||
        result.reason === "not_found"
          ? "Bu collectible inventarında tapılmadı."
          : "Collectible satmaq mümkün olmadı.",
    };
  }

  refreshEconomyPages();

  return {
    ok: true,
    message: `${cleanName} satıldı${
      typeof result.reward === "number"
        ? ` • +${result.reward.toLocaleString("en-US")} Aura`
        : ""
    }.`,
  };
}
