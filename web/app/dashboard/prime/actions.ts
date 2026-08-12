"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import {
  claimMissionAction,
} from "../earn/actions";

async function getEconomyModule() {
  return import("../../../../src/economy.js");
}

function refreshPrimePages() {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/prime");
  revalidatePath("/dashboard/profile");
  revalidatePath("/dashboard/activity");
  revalidatePath("/dashboard/earn");
  revalidatePath("/dashboard/casino");
}

export type PrimeActionResult = {
  ok: boolean;
  message: string;
};

export async function buyPrimeAction(): Promise<PrimeActionResult> {
  const session = await auth();

  if (!session?.user?.discordId) {
    return {
      ok: false,
      message: "Sessiya tapılmadı.",
    };
  }

  try {
    const economy = await getEconomyModule();

    const result = await economy.buyPrime(
      session.user.discordId
    );

    if (!result?.ok) {
      if (result?.reason === "active") {
        return {
          ok: false,
          message: "Prime artıq aktivdir.",
        };
      }

      if (result?.reason === "insufficient") {
        return {
          ok: false,
          message: `Prime almaq üçün ${Number(
            result?.price ?? 10000
          ).toLocaleString("en-US")} Aura lazımdır.`,
        };
      }

      return {
        ok: false,
        message: "Prime aktivləşdirilmədi.",
      };
    }

    refreshPrimePages();

    return {
      ok: true,
      message:
        "Prime aktivləşdirildi. 30 günlük qoruma və 6 refund haqqın açıldı.",
    };
  } catch (error) {
    console.error("[OCTOSON PRIME BUY]", error);

    return {
      ok: false,
      message: "Prime aktivləşdirilərkən xəta baş verdi.",
    };
  }
}

export async function refundPrimeLossAction(
  lossId: string
): Promise<PrimeActionResult> {
  const session = await auth();

  if (!session?.user?.discordId) {
    return {
      ok: false,
      message: "Sessiya tapılmadı.",
    };
  }

  const cleanLossId = String(lossId ?? "").trim();

  if (!cleanLossId) {
    return {
      ok: false,
      message: "Refund üçün oyun seçilməyib.",
    };
  }

  try {
    const economy = await getEconomyModule();

    const result = await economy.refundPrimeLoss(
      session.user.discordId,
      cleanLossId
    );

    if (!result?.ok) {
      const messages: Record<string, string> = {
        inactive:
          "Refund üçün aktiv Prime lazımdır.",
        limit:
          "Bu Prime dövrü üçün refund haqqın qalmayıb.",
        missing:
          "Bu oyun artıq refund siyahısında deyil.",
        refunded:
          "Bu oyun artıq refund edilib.",
        expired:
          "Bu oyunun refund müddəti bitib.",
      };

      return {
        ok: false,
        message:
          messages[String(result?.reason ?? "")] ??
          "Refund həyata keçirilmədi.",
      };
    }

    refreshPrimePages();

    return {
      ok: true,
      message: `${Number(
        result.refunded ?? 0
      ).toLocaleString("en-US")} Aura balansına qaytarıldı.`,
    };
  } catch (error) {
    console.error("[OCTOSON PRIME REFUND]", error);

    return {
      ok: false,
      message: "Refund zamanı xəta baş verdi.",
    };
  }
}


export async function claimPrimeMissionAction(
  missionId: string
): Promise<PrimeActionResult> {
  const cleanMissionId =
    String(missionId ?? "").trim();

  if (!cleanMissionId) {
    return {
      ok: false,
      message: "Missiya tapılmadı.",
    };
  }

  const formData = new FormData();
  formData.set("missionId", cleanMissionId);

  const result =
    await claimMissionAction(
      {
        ok: false,
        message: "",
      },
      formData
    );

  refreshPrimePages();

  return {
    ok: Boolean(result.ok),
    message: String(
      result.message ??
      "Missiya yeniləndi."
    ),
  };
}
