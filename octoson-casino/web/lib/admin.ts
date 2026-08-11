import "server-only";

import { auth } from "@/auth";
import { redirect } from "next/navigation";

export const OCTOSON_ADMIN_IDS = new Set([
  "1220194387867205743",
]);

export function isOctosonAdmin(
  userId?: string | null
) {
  return Boolean(
    userId &&
      OCTOSON_ADMIN_IDS.has(
        String(userId)
      )
  );
}

export async function requireOctosonAdmin() {
  const session = await auth();

  const userId =
    session?.user?.discordId ?? null;

  if (!isOctosonAdmin(userId)) {
    redirect("/dashboard");
  }

  return {
    session,
    userId: String(userId),
  };
}
