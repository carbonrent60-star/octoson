"use server";

import { auth } from "@/auth";
import { revalidatePath } from "next/cache";

type BankActionResult = {
  ok: boolean;
  message: string;
};

type EconomyBankResult = {
  ok: boolean;
  reason?: string;
  requested?: number;
  moved?: number;
  walletBefore?: number;
  walletAfter?: number;
  bankBefore?: number;
  bankAfter?: number;
  profile?: unknown;
  restriction?: unknown;
};

function parseAmount(formData: FormData) {
  const raw = formData.get("amount");

  if (typeof raw !== "string") {
    return 0;
  }

  const amount = Number(raw.replace(/,/g, "").trim());

  if (
    !Number.isSafeInteger(amount) ||
    amount <= 0
  ) {
    return 0;
  }

  return amount;
}

async function getEconomyModule() {
  /*
   * IMPORTANT:
   * This imports Octoson's EXISTING economy engine.
   *
   * The browser never receives these functions.
   * They execute only on the Next.js server.
   */
  return import("../../../../src/economy.js");
}

export async function depositAction(
  formData: FormData
): Promise<BankActionResult> {
  const session = await auth();

  if (!session?.user?.discordId) {
    return {
      ok: false,
      message: "Discord sessiyası tapılmadı.",
    };
  }

  const amount = parseAmount(formData);

  if (!amount) {
    return {
      ok: false,
      message: "Düzgün Aura məbləği daxil et.",
    };
  }

  const { depositAura } =
    await getEconomyModule();

  const result = (await depositAura(
    session.user.discordId,
    amount
  )) as unknown as EconomyBankResult;

  if (!result.ok) {
    switch (result.reason) {
      case "insufficient":
        return {
          ok: false,
          message:
            "Wallet-də kifayət qədər Aura yoxdur.",
        };

      case "bank_restricted":
        return {
          ok: false,
          message:
            "Bank əməliyyatların hazırda məhdudlaşdırılıb.",
        };

      case "invalid_amount":
        return {
          ok: false,
          message:
            "Düzgün Aura məbləği daxil et.",
        };

      default:
        return {
          ok: false,
          message:
            "Əməliyyatı tamamlamaq mümkün olmadı.",
        };
    }
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/bank");

  return {
    ok: true,
    message: `${amount.toLocaleString(
      "en-US"
    )} Aura banka yatırıldı.`,
  };
}

export async function withdrawAction(
  formData: FormData
): Promise<BankActionResult> {
  const session = await auth();

  if (!session?.user?.discordId) {
    return {
      ok: false,
      message: "Discord sessiyası tapılmadı.",
    };
  }

  const amount = parseAmount(formData);

  if (!amount) {
    return {
      ok: false,
      message: "Düzgün Aura məbləği daxil et.",
    };
  }

  const { withdrawAura } =
    await getEconomyModule();

  const result = (await withdrawAura(
    session.user.discordId,
    amount
  )) as unknown as EconomyBankResult;

  if (!result.ok) {
    switch (result.reason) {
      case "insufficient":
        return {
          ok: false,
          message:
            "Bankda kifayət qədər Aura yoxdur.",
        };

      case "loan_frozen":
        return {
          ok: false,
          message:
            "Gecikmiş borca görə bankdan çıxarış dondurulub.",
        };

      case "bank_restricted":
        return {
          ok: false,
          message:
            "Bank əməliyyatların hazırda məhdudlaşdırılıb.",
        };

      case "invalid_amount":
        return {
          ok: false,
          message:
            "Düzgün Aura məbləği daxil et.",
        };

      default:
        return {
          ok: false,
          message:
            "Əməliyyatı tamamlamaq mümkün olmadı.",
        };
    }
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/bank");

  return {
    ok: true,
    message: `${amount.toLocaleString(
      "en-US"
    )} Aura wallet-ə çıxarıldı.`,
  };
}
