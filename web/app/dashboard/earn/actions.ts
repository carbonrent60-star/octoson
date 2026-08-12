"use server";

import { auth } from "@/auth";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";

export type EarnActionResult = {
  ok: boolean;
  message: string;
  claimed?: boolean;
  balance?: number;
  xp?: number;
  seasonXp?: number;
};

const SEASON_KEY = "s1_dark_city";

async function getUserId() {
  const session = await auth();

  return session?.user?.discordId
    ? String(session.user.discordId)
    : null;
}

export async function claimMissionAction(
  _previousState: EarnActionResult,
  formData: FormData
): Promise<EarnActionResult> {
  const userId = await getUserId();

  if (!userId) {
    return {
      ok: false,
      message: "Discord sessiyası tapılmadı.",
    };
  }

  const missionId = String(formData.get("missionId") ?? "").trim();

  if (!missionId) {
    return {
      ok: false,
      message: "Missiya tapılmadı.",
    };
  }

  const supabase = getSupabaseServerClient();

  /*
   * Never trust reward values coming from the browser.
   * Fetch the authoritative mission directly from Supabase.
   */
  const { data: mission, error: missionError } = await supabase
    .from("earning_missions")
    .select(
      "id,user_id,period_type,period_key,mission_key,title,metric,target,progress,aura_reward,xp_reward,season_xp_reward,completed_at,claimed_at"
    )
    .eq("id", missionId)
    .eq("user_id", userId)
    .maybeSingle();

  if (missionError) {
    console.error("[OCTOSON EARN] Mission load failed:", missionError);

    return {
      ok: false,
      message: "Missiya yüklənmədi.",
    };
  }

  if (!mission) {
    return {
      ok: false,
      message: "Missiya tapılmadı.",
    };
  }

  if (mission.claimed_at) {
    return {
      ok: false,
      claimed: false,
      message: "Bu mükafat artıq götürülüb.",
    };
  }

  /*
   * Prime mission access is always checked server-side.
   * The browser is never trusted for Prime state.
   */
  const isPrimeMission =
    String(mission.mission_key ?? "").startsWith("prime_");

  if (isPrimeMission) {
    try {
      const economy =
        await import("../../../../src/economy.js");

      const prime =
        await economy.getPrimeProfile(userId);

      if (!prime?.active) {
        return {
          ok: false,
          claimed: false,
          message:
            "Bu mükafatı götürmək üçün aktiv Prime lazımdır.",
        };
      }
    } catch (error) {
      console.error(
        "[OCTOSON EARN] Prime access check failed:",
        error
      );

      return {
        ok: false,
        claimed: false,
        message:
          "Prime statusu yoxlanılmadı.",
      };
    }
  }

  const target = Math.max(1, Number(mission.target ?? 1));
  const progress = Math.max(0, Number(mission.progress ?? 0));

  if (progress < target) {
    return {
      ok: false,
      claimed: false,
      message: `Missiya hələ tamamlanmayıb. ${progress}/${target}`,
    };
  }

  const claimKey =
    `mission:${userId}:${mission.period_type}:${mission.period_key}:${mission.mission_key}`;

  const { data, error } = await supabase.rpc("claim_earning_reward", {
    p_user_id: userId,
    p_claim_key: claimKey,
    p_source_type: "mission",
    p_source_id: String(mission.id),
    p_aura_reward: Math.max(0, Number(mission.aura_reward ?? 0)),
    p_xp_reward: Math.max(0, Number(mission.xp_reward ?? 0)),
    p_season_xp_reward: Math.max(
      0,
      Number(mission.season_xp_reward ?? 0)
    ),
    p_metadata: {
      missionKey: mission.mission_key,
      periodType: mission.period_type,
      periodKey: mission.period_key,
      title: mission.title,
      primeOnly:
        String(mission.mission_key ?? "").startsWith("prime_"),
    },
    p_season_key: SEASON_KEY,
  });

  if (error) {
    console.error("[OCTOSON EARN] Reward claim failed:", error);

    return {
      ok: false,
      message: "Mükafat götürülmədi.",
    };
  }

  const row = Array.isArray(data) ? data[0] : data;

  if (!row?.claimed) {
    /*
     * RPC idempotency protects the economy even if the browser sends
     * the same request twice.
     */
    await supabase
      .from("earning_missions")
      .update({
        claimed_at: Date.now(),
      })
      .eq("id", mission.id)
      .eq("user_id", userId)
      .is("claimed_at", null);

    revalidateEarn();

    return {
      ok: false,
      claimed: false,
      message: "Bu mükafat artıq götürülüb.",
    };
  }

  const now = Date.now();

  const { error: markError } = await supabase
    .from("earning_missions")
    .update({
      completed_at: mission.completed_at ?? now,
      claimed_at: now,
    })
    .eq("id", mission.id)
    .eq("user_id", userId)
    .is("claimed_at", null);

  if (markError) {
    /*
     * Reward itself is already safe because earning_claims is
     * idempotent. Log this rather than attempting another reward.
     */
    console.error(
      "[OCTOSON EARN] Mission claimed_at update failed:",
      markError
    );
  }

  revalidateEarn();

  return {
    ok: true,
    claimed: true,
    balance: Number(row.balance ?? 0),
    xp: Number(row.xp ?? 0),
    seasonXp: Number(row.season_xp ?? 0),
    message: `+${Number(mission.aura_reward ?? 0).toLocaleString(
      "en-US"
    )} Aura qazandın.`,
  };
}


export async function claimContractAction(
  _previousState: EarnActionResult,
  formData: FormData
): Promise<EarnActionResult> {
  const userId = await getUserId();

  if (!userId) {
    return {
      ok: false,
      message: "Discord sessiyası tapılmadı.",
    };
  }

  const contractId = String(
    formData.get("contractId") ?? ""
  ).trim();

  if (!contractId) {
    return {
      ok: false,
      message: "Müqavilə tapılmadı.",
    };
  }

  const supabase =
    getSupabaseServerClient();

  const {
    data: contract,
    error: contractError,
  } = await supabase
    .from("user_contracts")
    .select(
      "id,user_id,contract_key,title,metric,target,progress,aura_reward,xp_reward,season_xp_reward,status,completed_at,claimed_at"
    )
    .eq("id", contractId)
    .eq("user_id", userId)
    .maybeSingle();

  if (contractError) {
    console.error(
      "[OCTOSON EARN] Contract load failed:",
      contractError
    );

    return {
      ok: false,
      message: "Müqavilə yüklənmədi.",
    };
  }

  if (!contract) {
    return {
      ok: false,
      message: "Müqavilə tapılmadı.",
    };
  }

  if (
    contract.status === "claimed" ||
    contract.claimed_at
  ) {
    return {
      ok: false,
      claimed: false,
      message:
        "Bu müqavilənin mükafatı artıq götürülüb.",
    };
  }

  const target = Math.max(
    1,
    Number(contract.target ?? 1)
  );

  const progress = Math.max(
    0,
    Number(contract.progress ?? 0)
  );

  if (
    progress < target ||
    contract.status !== "completed"
  ) {
    return {
      ok: false,
      claimed: false,
      message:
        `Müqavilə hələ tamamlanmayıb. ${progress}/${target}`,
    };
  }

  const claimKey =
    `contract:${userId}:${contract.id}`;

  const { data, error } =
    await supabase.rpc(
      "claim_earning_reward",
      {
        p_user_id: userId,
        p_claim_key: claimKey,
        p_source_type: "contract",
        p_source_id: String(contract.id),
        p_aura_reward: Math.max(
          0,
          Number(contract.aura_reward ?? 0)
        ),
        p_xp_reward: Math.max(
          0,
          Number(contract.xp_reward ?? 0)
        ),
        p_season_xp_reward: Math.max(
          0,
          Number(
            contract.season_xp_reward ?? 0
          )
        ),
        p_metadata: {
          contractKey:
            contract.contract_key,
          title:
            contract.title,
          metric:
            contract.metric,
          target:
            contract.target,
        },
        p_season_key:
          SEASON_KEY,
      }
    );

  if (error) {
    console.error(
      "[OCTOSON EARN] Contract reward claim failed:",
      error
    );

    return {
      ok: false,
      message:
        "Müqavilə mükafatı götürülmədi.",
    };
  }

  const row =
    Array.isArray(data)
      ? data[0]
      : data;

  /*
   * claim_earning_reward is the authority.
   * If this claim key already exists, do not treat it
   * as a new successful reward.
   */
  if (!row?.claimed) {
    await supabase
      .from("user_contracts")
      .update({
        status: "claimed",
        claimed_at: Date.now(),
      })
      .eq("id", contract.id)
      .eq("user_id", userId)
      .is("claimed_at", null);

    revalidateEarn();

    return {
      ok: false,
      claimed: false,
      message:
        "Bu müqavilənin mükafatı artıq götürülüb.",
    };
  }

  const now = Date.now();

  const { error: markError } =
    await supabase
      .from("user_contracts")
      .update({
        status: "claimed",
        completed_at:
          contract.completed_at ?? now,
        claimed_at: now,
      })
      .eq("id", contract.id)
      .eq("user_id", userId)
      .is("claimed_at", null);

  if (markError) {
    console.error(
      "[OCTOSON EARN] Contract claimed state update failed:",
      markError
    );
  }

  revalidateEarn();

  return {
    ok: true,
    claimed: true,
    balance:
      Number(row.balance ?? 0),
    xp:
      Number(row.xp ?? 0),
    seasonXp:
      Number(row.season_xp ?? 0),
    message:
      `Müqavilə tamamlandı: +${Number(
        contract.aura_reward ?? 0
      ).toLocaleString("en-US")} Aura.`,
  };
}

function revalidateEarn() {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/earn");
  revalidatePath("/dashboard/profile");
  revalidatePath("/dashboard/activity");
  revalidatePath("/dashboard/leaderboard");
}
