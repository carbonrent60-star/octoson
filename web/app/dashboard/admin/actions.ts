"use server";

import { revalidatePath } from "next/cache";

import { requireOctosonAdmin } from "@/lib/admin";
import { getSupabaseServerClient } from "@/lib/supabase-server";

type AdminResult = {
  ok: boolean;
  message: string;
};

function integer(
  value: FormDataEntryValue | null,
  fallback?: number
) {
  const raw =
    String(value ?? "").trim();

  if (!raw) {
    return fallback;
  }

  const parsed =
    Number(raw);

  if (
    !Number.isFinite(parsed)
  ) {
    return fallback;
  }

  return Math.trunc(parsed);
}

function text(
  value: FormDataEntryValue | null
) {
  return String(
    value ?? ""
  ).trim();
}

function refreshAdmin() {
  revalidatePath(
    "/dashboard/admin"
  );

  revalidatePath(
    "/dashboard"
  );

  revalidatePath(
    "/dashboard/profile"
  );

  revalidatePath(
    "/dashboard/bank"
  );

  revalidatePath(
    "/dashboard/leaderboard"
  );

  revalidatePath(
    "/dashboard/activity"
  );
}

async function getUser(
  userId: string
) {
  const supabase =
    getSupabaseServerClient();

  const { data, error } =
    await supabase
      .from("economy_users")
      .select(
        "user_id,version,profile,balance,bank,xp,level,prestige,daily_streak,reputation,rank,title"
      )
      .eq(
        "user_id",
        userId
      )
      .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

async function saveProfilePatch(
  targetId: string,
  patch: Record<
    string,
    unknown
  >,
  adminId: string
) {
  const supabase =
    getSupabaseServerClient();

  for (
    let attempt = 0;
    attempt < 3;
    attempt++
  ) {
    const row =
      await getUser(
        targetId
      );

    if (!row) {
      return {
        ok: false,
        message:
          "İstifadəçi economy bazasında tapılmadı.",
      };
    }

    const oldProfile =
      row.profile &&
      typeof row.profile ===
        "object"
        ? row.profile
        : {};

    const nextProfile = {
      ...oldProfile,
      ...patch,
    };

    const {
      data,
      error,
    } = await supabase
      .from(
        "economy_users"
      )
      .update({
        profile:
          nextProfile,
        version:
          Number(
            row.version ?? 0
          ) + 1,
      })
      .eq(
        "user_id",
        targetId
      )
      .eq(
        "version",
        row.version
      )
      .select(
        "user_id,balance,bank,xp,level,prestige,daily_streak,reputation,rank,title,version"
      )
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (data) {
      return {
        ok: true,
        message: "",
        rowBefore: row,
        rowAfter: data,
        adminId,
      };
    }
  }

  return {
    ok: false,
    message:
      "Profil eyni anda dəyişdirildi. Yenidən cəhd et.",
  };
}

export async function giveAuraAction(
  formData: FormData
): Promise<AdminResult> {
  const { userId: adminId } =
    await requireOctosonAdmin();

  const targetId =
    text(
      formData.get(
        "userId"
      )
    );

  const amount =
    integer(
      formData.get(
        "amount"
      )
    );

  if (
    !/^\d{10,25}$/.test(
      targetId
    )
  ) {
    return {
      ok: false,
      message:
        "Düzgün Discord user ID daxil et.",
    };
  }

  if (
    amount === undefined ||
    amount === 0
  ) {
    return {
      ok: false,
      message:
        "Aura miqdarı 0 ola bilməz.",
    };
  }

  const current =
    await getUser(
      targetId
    );

  if (!current) {
    return {
      ok: false,
      message:
        "İstifadəçi tapılmadı.",
    };
  }

  const before =
    Number(
      current.balance ?? 0
    );

  const after =
    before + amount;

  if (after < -50000) {
    return {
      ok: false,
      message:
        "Balans -50,000 Aura limitindən aşağı düşə bilməz.",
    };
  }

  const result =
    await saveProfilePatch(
      targetId,
      {
        balance: after,
      },
      adminId
    );

  if (!result.ok) {
    return result;
  }

  const supabase =
    getSupabaseServerClient();

  const now =
    Date.now();

  await supabase
    .from(
      "economy_transactions"
    )
    .insert({
      transaction_key:
        `web-admin:${adminId}:${targetId}:${now}:${Math.random()
          .toString(36)
          .slice(2, 8)}`,
      user_id:
        targetId,
      amount,
      type:
        "admin_web",
      note:
        amount > 0
          ? `Web admin tərəfindən +${amount} Aura`
          : `Web admin tərəfindən ${amount} Aura`,
      metadata: {
        moderatorId:
          adminId,
        source:
          "octoson_web_admin",
      },
      balance_before:
        before,
      balance_after:
        after,
      created_at:
        now,
    });

  refreshAdmin();

  return {
    ok: true,
    message:
      `${targetId} → ${
        amount > 0
          ? "+"
          : ""
      }${amount.toLocaleString(
        "en-US"
      )} Aura`,
  };
}


export async function setUserVerificationAction(
  formData: FormData
): Promise<AdminResult> {
  const { userId: adminId } =
    await requireOctosonAdmin();

  const targetId =
    text(
      formData.get(
        "userId"
      )
    );

  const verified =
    text(
      formData.get(
        "verified"
      )
    ) === "true";

  if (
    !/^\d{10,25}$/.test(
      targetId
    )
  ) {
    return {
      ok: false,
      message:
        "Düzgün Discord user ID daxil et.",
    };
  }

  const row =
    await getUser(
      targetId
    );

  if (!row) {
    return {
      ok: false,
      message:
        "İstifadəçi tapılmadı.",
    };
  }

  const oldProfile =
    row.profile &&
    typeof row.profile ===
      "object"
      ? row.profile as Record<string, unknown>
      : {};

  const oldIdentity =
    oldProfile.identity &&
    typeof oldProfile.identity === "object" &&
    !Array.isArray(oldProfile.identity)
      ? oldProfile.identity as Record<string, unknown>
      : {};

  const result =
    await saveProfilePatch(
      targetId,
      {
        identity: {
          ...oldIdentity,
          verified,
          verifiedAt:
            verified
              ? Date.now()
              : null,
          verifiedBy:
            verified
              ? adminId
              : null,
        },
      },
      adminId
    );

  if (!result.ok) {
    return result;
  }

  refreshAdmin();

  revalidatePath(
    `/dashboard/users/${targetId}`
  );

  return {
    ok: true,
    message:
      verified
        ? "İstifadəçi Octoson Verified edildi."
        : "Verified statusu silindi.",
  };
}


export async function editUserAction(
  formData: FormData
): Promise<AdminResult> {
  const { userId: adminId } =
    await requireOctosonAdmin();

  const targetId =
    text(
      formData.get(
        "userId"
      )
    );

  if (
    !/^\d{10,25}$/.test(
      targetId
    )
  ) {
    return {
      ok: false,
      message:
        "Düzgün Discord user ID daxil et.",
    };
  }

  const row =
    await getUser(
      targetId
    );

  if (!row) {
    return {
      ok: false,
      message:
        "İstifadəçi tapılmadı.",
    };
  }

  const balance =
    integer(
      formData.get(
        "balance"
      ),
      Number(
        row.balance ?? 0
      )
    )!;

  const bank =
    Math.max(
      0,
      integer(
        formData.get(
          "bank"
        ),
        Number(
          row.bank ?? 0
        )
      )!
    );

  const xp =
    Math.max(
      0,
      integer(
        formData.get(
          "xp"
        ),
        Number(
          row.xp ?? 0
        )
      )!
    );

  const level =
    Math.min(
      50,
      Math.max(
        1,
        integer(
          formData.get(
            "level"
          ),
          Number(
            row.level ?? 1
          )
        )!
      )
    );

  const prestige =
    Math.max(
      0,
      integer(
        formData.get(
          "prestige"
        ),
        Number(
          row.prestige ?? 0
        )
      )!
    );

  const dailyStreak =
    Math.max(
      0,
      integer(
        formData.get(
          "dailyStreak"
        ),
        Number(
          row.daily_streak ??
            0
        )
      )!
    );

  const reputation =
    integer(
      formData.get(
        "reputation"
      ),
      Number(
        row.reputation ??
          0
      )
    )!;

  if (
    balance < -50000
  ) {
    return {
      ok: false,
      message:
        "Balans -50,000 Aura limitindən aşağı ola bilməz.",
    };
  }

  const rank =
    text(
      formData.get(
        "rank"
      )
    ) || String(
      row.rank ?? ""
    );

  const title =
    text(
      formData.get(
        "title"
      )
    ) || String(
      row.title ?? ""
    );

  const oldBalance =
    Number(
      row.balance ?? 0
    );

  const result =
    await saveProfilePatch(
      targetId,
      {
        balance,
        bank,
        xp,
        level,
        prestige,
        dailyStreak,
        reputation,
        rank,
        title,
      },
      adminId
    );

  if (!result.ok) {
    return result;
  }

  if (
    balance !== oldBalance
  ) {
    const supabase =
      getSupabaseServerClient();

    const now =
      Date.now();

    await supabase
      .from(
        "economy_transactions"
      )
      .insert({
        transaction_key:
          `web-admin-set:${adminId}:${targetId}:${now}:${Math.random()
            .toString(36)
            .slice(2, 8)}`,
        user_id:
          targetId,
        amount:
          balance -
          oldBalance,
        type:
          "admin_web_set",
        note:
          `Web admin balans dəyişimi: ${oldBalance} → ${balance}`,
        metadata: {
          moderatorId:
            adminId,
          source:
            "octoson_web_admin",
        },
        balance_before:
          oldBalance,
        balance_after:
          balance,
        created_at:
          now,
      });
  }

  refreshAdmin();

  return {
    ok: true,
    message:
      "İstifadəçi profili yeniləndi.",
  };
}


export async function setGlobalCasinoAction(
  formData: FormData
): Promise<AdminResult> {
  const { userId: adminId } =
    await requireOctosonAdmin();

  const enabledRaw =
    text(
      formData.get(
        "enabled"
      )
    );

  const enabled =
    enabledRaw === "true";

  const supabase =
    getSupabaseServerClient();

  const now =
    Date.now();

  const { error } =
    await supabase
      .from(
        "economy_settings"
      )
      .upsert(
        {
          id: 1,
          casino_enabled:
            enabled,
          casino_updated_at:
            now,
          casino_updated_by:
            adminId,
        },
        {
          onConflict: "id",
        }
      );

  if (error) {
    console.error(
      "[WEB ADMIN] Casino toggle failed:",
      error
    );

    return {
      ok: false,
      message:
        "Casino statusu yenilənmədi.",
    };
  }

  refreshAdmin();

  return {
    ok: true,
    message:
      enabled
        ? "Casino sistemi aktiv edildi."
        : "Casino sistemi bağlandı.",
  };
}

export async function setGlobalCasinoMaxBetAction(
  formData: FormData
): Promise<AdminResult> {
  const { userId: adminId } =
    await requireOctosonAdmin();

  const maxBet =
    integer(
      formData.get(
        "maxBet"
      )
    );

  if (
    maxBet === undefined ||
    maxBet < 0 ||
    maxBet > 1000000
  ) {
    return {
      ok: false,
      message:
        "Global casino limiti 0–1,000,000 arasında olmalıdır.",
    };
  }

  const supabase =
    getSupabaseServerClient();

  const now =
    Date.now();

  const { error } =
    await supabase
      .from(
        "economy_settings"
      )
      .upsert(
        {
          id: 1,
          global_casino_max_bet:
            maxBet,
          casino_updated_at:
            now,
          casino_updated_by:
            adminId,
        },
        {
          onConflict: "id",
        }
      );

  if (error) {
    console.error(
      "[WEB ADMIN] Global casino max failed:",
      error
    );

    return {
      ok: false,
      message:
        "Global casino limiti yenilənmədi.",
    };
  }

  refreshAdmin();

  return {
    ok: true,
    message:
      maxBet === 0
        ? "Global casino limiti söndürüldü."
        : `Global casino limiti ${maxBet.toLocaleString("en-US")} Aura edildi.`,
  };
}

export async function setUserCasinoMaxBetAction(
  formData: FormData
): Promise<AdminResult> {
  const { userId: adminId } =
    await requireOctosonAdmin();

  const targetId =
    text(
      formData.get(
        "userId"
      )
    );

  const maxBet =
    integer(
      formData.get(
        "maxBet"
      )
    );

  const reason =
    text(
      formData.get(
        "reason"
      )
    )
      .slice(
        0,
        500
      ) ||
    "Web admin casino limiti";

  if (
    !/^\d{10,25}$/.test(
      targetId
    )
  ) {
    return {
      ok: false,
      message:
        "Düzgün Discord user ID daxil et.",
    };
  }

  if (
    maxBet === undefined ||
    maxBet < 0 ||
    maxBet > 1000000
  ) {
    return {
      ok: false,
      message:
        "Casino limiti 0–1,000,000 arasında olmalıdır.",
    };
  }

  const user =
    await getUser(
      targetId
    );

  if (!user) {
    return {
      ok: false,
      message:
        "İstifadəçi tapılmadı.",
    };
  }

  const supabase =
    getSupabaseServerClient();

  const now =
    Date.now();

  const deleteResult =
    await supabase
      .from(
        "user_restrictions"
      )
      .delete()
      .eq(
        "user_id",
        targetId
      )
      .eq(
        "type",
        "casino_max_bet"
      );

  if (
    deleteResult.error
  ) {
    console.error(
      "[WEB ADMIN] Old casino restriction removal failed:",
      deleteResult.error
    );

    return {
      ok: false,
      message:
        "Köhnə casino limiti silinmədi.",
    };
  }

  const restrictionId =
    `r_web_${now.toString(36)}_${Math.random()
      .toString(36)
      .slice(2, 8)}`;

  const insertResult =
    await supabase
      .from(
        "user_restrictions"
      )
      .insert({
        id:
          restrictionId,
        user_id:
          targetId,
        type:
          "casino_max_bet",
        moderator_id:
          adminId,
        reason,
        meta: {
          maxBet,
          source:
            "octoson_web_admin",
        },
        created_at:
          now,
        expires_at:
          null,
      });

  if (
    insertResult.error
  ) {
    console.error(
      "[WEB ADMIN] Casino restriction insert failed:",
      insertResult.error
    );

    return {
      ok: false,
      message:
        "İstifadəçi casino limiti yazılmadı.",
    };
  }

  refreshAdmin();

  return {
    ok: true,
    message:
      `${targetId} üçün casino max bet ${maxBet.toLocaleString("en-US")} Aura edildi.`,
  };
}

export async function removeUserCasinoMaxBetAction(
  formData: FormData
): Promise<AdminResult> {
  await requireOctosonAdmin();

  const targetId =
    text(
      formData.get(
        "userId"
      )
    );

  if (
    !/^\d{10,25}$/.test(
      targetId
    )
  ) {
    return {
      ok: false,
      message:
        "Düzgün Discord user ID daxil et.",
    };
  }

  const supabase =
    getSupabaseServerClient();

  const { error } =
    await supabase
      .from(
        "user_restrictions"
      )
      .delete()
      .eq(
        "user_id",
        targetId
      )
      .eq(
        "type",
        "casino_max_bet"
      );

  if (error) {
    console.error(
      "[WEB ADMIN] Casino restriction removal failed:",
      error
    );

    return {
      ok: false,
      message:
        "Casino limiti silinmədi.",
    };
  }

  refreshAdmin();

  return {
    ok: true,
    message:
      "İstifadəçi casino limiti silindi.",
  };
}
