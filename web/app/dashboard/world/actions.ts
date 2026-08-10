"use server";

import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { sendOctosonWorldActivity } from "@/lib/discord-server";

export type WorldActionResult = {
  ok: boolean;
  message: string;
};

async function getEconomyModule() {
  return import("../../../../src/economy.js");
}

async function discordId() {
  const session = await auth();
  return session?.user?.discordId ?? null;
}

function refresh() {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/world");
  revalidatePath("/dashboard/profile");
}

function remaining(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;

  if (minutes > 0) return `${minutes} dəq ${seconds} san`;
  return `${seconds} san`;
}

export async function chooseJobAction(
  formData: FormData
): Promise<WorldActionResult> {
  const id = await discordId();

  if (!id) {
    return { ok: false, message: "Discord sessiyası tapılmadı." };
  }

  const key = String(formData.get("key") ?? "");

  const { chooseWorldJob } = await getEconomyModule();
  const result = await chooseWorldJob(id, key);

  if (!result.ok) {
    return { ok: false, message: "Bu iş tapılmadı." };
  }

  refresh();

  await sendOctosonWorldActivity({
    userId: id,
    kind: "job",
    emoji: result.job.emoji ?? "💼",
    title: "Yeni iş seçildi",
    description: `**${result.job.name}** artıq aktiv işdir.`,
  });

  return {
    ok: true,
    message: `${result.job.emoji ?? "💼"} ${result.job.name} aktiv edildi.`,
  };
}

export async function missionAction(
  formData: FormData
): Promise<WorldActionResult> {
  const id = await discordId();

  if (!id) {
    return { ok: false, message: "Discord sessiyası tapılmadı." };
  }

  const choice = String(formData.get("choice") ?? "smart");

  const { runWorldMission } = await getEconomyModule();
  const result = await runWorldMission(id, choice);

  if (!result.ok) {
    if (result.reason === "no_job") {
      return {
        ok: false,
        message: "Missiyaya başlamaq üçün əvvəlcə iş seç.",
      };
    }

    if (result.reason === "cooldown") {
      return {
        ok: false,
        message: `Növbəti missiya ${remaining(
          Number(result.remainingMs ?? 0)
        )} sonra hazır olacaq.`,
      };
    }

    return {
      ok: false,
      message: "Missiyanı başlatmaq mümkün olmadı.",
    };
  }

  refresh();

  const amount = Number(result.amount ?? 0);

  await sendOctosonWorldActivity({
    userId: id,
    kind: "mission",
    emoji: amount >= 0 ? "⚡" : "💥",
    title:
      amount >= 0
        ? "Missiya tamamlandı"
        : "Missiya uğursuz oldu",
    description:
      amount >= 0
        ? `World missiyasından **${amount.toLocaleString("en-US")} Aura** qazandı.`
        : `World missiyasında **${Math.abs(amount).toLocaleString("en-US")} Aura** itirdi.`,
    amount,
  });

  return {
    ok: true,
    message:
      amount >= 0
        ? `Missiya tamamlandı. +${amount.toLocaleString("en-US")} Aura`
        : `Missiya uğursuz oldu. ${amount.toLocaleString("en-US")} Aura`,
  };
}

export async function buyBusinessAction(
  formData: FormData
): Promise<WorldActionResult> {
  const id = await discordId();

  if (!id) {
    return { ok: false, message: "Discord sessiyası tapılmadı." };
  }

  const key = String(formData.get("key") ?? "");

  const { buyWorldBusiness } = await getEconomyModule();
  const result = await buyWorldBusiness(id, key);

  if (!result.ok) {
    if (result.reason === "insufficient") {
      return { ok: false, message: "Kifayət qədər Aura yoxdur." };
    }

    return { ok: false, message: "Biznesi almaq mümkün olmadı." };
  }

  refresh();

  await sendOctosonWorldActivity({
    userId: id,
    kind: "business",
    emoji: result.item.emoji ?? "🏢",
    title: "Yeni biznes alındı",
    description: `**${result.item.name}** artıq World portfelinə əlavə edildi.`,
    amount:
      typeof result.item.price === "number"
        ? -result.item.price
        : undefined,
  });

  return {
    ok: true,
    message: `${result.item.name} alındı.`,
  };
}

export async function upgradeBusinessAction(
  formData: FormData
): Promise<WorldActionResult> {
  const id = await discordId();

  if (!id) {
    return { ok: false, message: "Discord sessiyası tapılmadı." };
  }

  const key = String(formData.get("key") ?? "");

  const { upgradeWorldBusiness } = await getEconomyModule();
  const result = await upgradeWorldBusiness(id, key);

  if (!result.ok) {
    if (result.reason === "not_owned") {
      return { ok: false, message: "Əvvəlcə bu biznesi almalısan." };
    }

    if (result.reason === "insufficient") {
      return { ok: false, message: "Upgrade üçün kifayət qədər Aura yoxdur." };
    }

    if (result.reason === "max_level") {
      return { ok: false, message: "Biznes artıq maksimum səviyyədədir." };
    }

    return { ok: false, message: "Biznes upgrade edilə bilmədi." };
  }

  refresh();

  await sendOctosonWorldActivity({
    userId: id,
    kind: "upgrade",
    emoji: result.item.emoji ?? "📈",
    title: "Biznes yüksəldildi",
    description: `**${result.item.name}** → **Lv.${result.level}**`,
  });

  return {
    ok: true,
    message: `${result.item.name} Lv.${result.level} oldu.`,
  };
}

export async function buyPropertyAction(
  formData: FormData
): Promise<WorldActionResult> {
  const id = await discordId();

  if (!id) {
    return { ok: false, message: "Discord sessiyası tapılmadı." };
  }

  const key = String(formData.get("key") ?? "");

  const { buyWorldProperty } = await getEconomyModule();
  const result = await buyWorldProperty(id, key);

  if (!result.ok) {
    if (result.reason === "insufficient") {
      return { ok: false, message: "Kifayət qədər Aura yoxdur." };
    }

    return { ok: false, message: "Əmlakı almaq mümkün olmadı." };
  }

  refresh();

  await sendOctosonWorldActivity({
    userId: id,
    kind: "property",
    emoji: result.item.emoji ?? "🏠",
    title: "Yeni əmlak alındı",
    description: `**${result.item.name}** artıq World aktivlərinə əlavə edildi.`,
    amount:
      typeof result.item.price === "number"
        ? -result.item.price
        : undefined,
  });

  return {
    ok: true,
    message: `${result.item.name} alındı.`,
  };
}

export async function buyVehicleAction(
  formData: FormData
): Promise<WorldActionResult> {
  const id = await discordId();

  if (!id) {
    return { ok: false, message: "Discord sessiyası tapılmadı." };
  }

  const key = String(formData.get("key") ?? "");

  const { buyWorldVehicle } = await getEconomyModule();
  const result = await buyWorldVehicle(id, key);

  if (!result.ok) {
    if (result.reason === "owned") {
      return { ok: false, message: "Bu nəqliyyat artıq səndə var." };
    }

    if (result.reason === "insufficient") {
      return { ok: false, message: "Kifayət qədər Aura yoxdur." };
    }

    return { ok: false, message: "Nəqliyyatı almaq mümkün olmadı." };
  }

  refresh();

  await sendOctosonWorldActivity({
    userId: id,
    kind: "vehicle",
    emoji: result.item.emoji ?? "🚘",
    title: "Yeni nəqliyyat alındı",
    description: `**${result.item.name}** artıq World qarajındadır.`,
    amount:
      typeof result.item.price === "number"
        ? -result.item.price
        : undefined,
  });

  return {
    ok: true,
    message: `${result.item.name} alındı.`,
  };
}

export async function collectIncomeAction(): Promise<WorldActionResult> {
  const id = await discordId();

  if (!id) {
    return { ok: false, message: "Discord sessiyası tapılmadı." };
  }

  const { collectWorldIncome } = await getEconomyModule();
  const result = await collectWorldIncome(id);

  if (!result.ok) {
    if (result.reason === "no_assets") {
      return {
        ok: false,
        message: "Gəlir toplamaq üçün biznes və ya əmlakın olmalıdır.",
      };
    }

    if (result.reason === "cooldown") {
      return {
        ok: false,
        message: `Gəlir ${remaining(
          Number(result.remainingMs ?? 0)
        )} sonra hazır olacaq.`,
      };
    }

    return { ok: false, message: "Gəliri toplamaq mümkün olmadı." };
  }

  refresh();

  const amount = Number(result.amount ?? 0);

  await sendOctosonWorldActivity({
    userId: id,
    kind: "income",
    emoji: "💰",
    title: "World gəliri toplandı",
    description: `Biznes və əmlak gəlirindən **${amount.toLocaleString("en-US")} Aura** toplandı.`,
    amount,
  });

  return {
    ok: true,
    message: `+${amount.toLocaleString("en-US")} Aura toplandı.`,
  };
}

export async function exploreAction(
  formData: FormData
): Promise<WorldActionResult> {
  const id = await discordId();

  if (!id) {
    return { ok: false, message: "Discord sessiyası tapılmadı." };
  }

  const key = String(formData.get("key") ?? "");

  const { exploreWorld } = await getEconomyModule();
  const result = await exploreWorld(id, key);

  if (!result.ok) {
    if (result.reason === "cooldown") {
      return {
        ok: false,
        message: `Bu məkanı ${remaining(
          Number(result.remainingMs ?? 0)
        )} sonra yenidən kəşf edə bilərsən.`,
      };
    }

    return { ok: false, message: "Bu məkanı kəşf etmək mümkün olmadı." };
  }

  refresh();

  await sendOctosonWorldActivity({
    userId: id,
    kind: "explore",
    emoji: result.map.emoji ?? "🧭",
    title: "Yeni məkan kəşf edildi",
    description: `**${result.map.name}**\n${result.loot ?? "Kəşf tamamlandı."}`,
  });

  return {
    ok: true,
    message: `${result.map.name}: ${result.loot ?? "kəşf tamamlandı"}`,
  };
}
