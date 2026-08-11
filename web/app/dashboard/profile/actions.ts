"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { getOctosonUser } from "@/lib/octoson";
import { getSupabaseServerClient } from "@/lib/supabase-server";

function asRecord(
  value: unknown
): Record<string, unknown> {
  if (
    value &&
    typeof value === "object" &&
    !Array.isArray(value)
  ) {
    return value as Record<string, unknown>;
  }

  return {};
}

const gradients = new Set([
  "cyan",
  "ocean",
  "violet",
  "rose",
  "emerald",
  "mono",
]);

const animations = new Set([
  "aurora",
  "glow",
  "float",
  "none",
]);

function profileRedirect(
  type: "success" | "error",
  message: string
): never {
  redirect(
    `/dashboard/profile?appearance=${type}&message=${encodeURIComponent(
      message
    )}`
  );
}


function safeHex(
  value: FormDataEntryValue | null,
  fallback: string
) {
  const raw = String(value ?? "").trim();

  return /^#[0-9a-fA-F]{6}$/.test(raw)
    ? raw.toLowerCase()
    : fallback;
}

function safeGlow(
  value: FormDataEntryValue | null
) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return 55;
  }

  return Math.min(
    100,
    Math.max(0, Math.round(parsed))
  );
}

export async function saveVerifiedAppearanceAction(
  formData: FormData
): Promise<void> {
  const session = await auth();

  if (!session?.user?.discordId) {
    profileRedirect(
      "error",
      "Sessiya tapılmadı."
    );
  }

  const userId =
    session.user.discordId;

  const economy =
    await getOctosonUser(
      userId
    );

  if (!economy) {
    profileRedirect(
      "error",
      "Profil tapılmadı."
    );
  }

  const profile =
    asRecord(
      economy.profile
    );

  const identity =
    asRecord(
      profile.identity
    );

  const verified =
    identity.verified === true ||
    profile.verified === true;

  if (!verified) {
    profileRedirect(
      "error",
      "Profil fərdiləşdirməsi yalnız Verified istifadəçilər üçündür."
    );
  }

  const requestedGradient =
    String(
      formData.get("gradient") ??
        ""
    );

  const requestedAnimation =
    String(
      formData.get(
        "bannerAnimation"
      ) ?? ""
    );

  const gradient =
    gradients.has(
      requestedGradient
    )
      ? requestedGradient
      : "cyan";

  const bannerAnimation =
    animations.has(
      requestedAnimation
    )
      ? requestedAnimation
      : "aurora";

  const normalizeHex = (
    value: FormDataEntryValue | null,
    fallback: string
  ) => {
    const raw = String(value ?? "").trim();

    return /^#[0-9a-fA-F]{6}$/.test(raw)
      ? raw.toLowerCase()
      : fallback;
  };

  const primaryColor =
    normalizeHex(
      formData.get("primaryColor"),
      "#67e8f9"
    );

  const secondaryColor =
    normalizeHex(
      formData.get("secondaryColor"),
      "#6366f1"
    );

  const requestedGlow =
    Number(
      formData.get("glowIntensity")
    );

  const glowIntensity =
    Number.isFinite(requestedGlow)
      ? Math.min(
          100,
          Math.max(
            0,
            Math.round(requestedGlow)
          )
        )
      : 55;

  const appearance =
    asRecord(
      profile.appearance
    );

  const nextProfile = {
    ...profile,

    appearance: {
      ...appearance,
      gradient,
      bannerAnimation,
      primaryColor,
      secondaryColor,
      glowIntensity,
    },
  };

  const supabase =
    getSupabaseServerClient();

  const {
    data,
    error,
  } =
    await supabase
      .from("economy_users")
      .update({
        profile:
          nextProfile,

        version:
          economy.version + 1,
      })
      .eq(
        "user_id",
        userId
      )
      .eq(
        "version",
        economy.version
      )
      .select(
        "user_id"
      )
      .maybeSingle();

  if (error) {
    console.error(
      "[OCTOSON PROFILE] Appearance update failed:",
      error
    );

    profileRedirect(
      "error",
      "Profil görünüşü saxlanmadı."
    );
  }

  if (!data) {
    profileRedirect(
      "error",
      "Profil dəyişib. Yenidən cəhd et."
    );
  }

  revalidatePath(
    "/dashboard/profile"
  );

  revalidatePath(
    `/dashboard/users/${userId}`
  );

  revalidatePath(
    "/dashboard/leaderboard"
  );

  revalidatePath(
    "/dashboard/activity"
  );

  profileRedirect(
    "success",
    "Verified profil görünüşü yeniləndi."
  );
}
