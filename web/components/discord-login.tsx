"use client";

import { signIn } from "next-auth/react";

export default function DiscordLogin() {
  return (
    <button
      type="button"
      onClick={() =>
        signIn("discord", {
          callbackUrl: "/dashboard",
        })
      }
      className="rounded-xl bg-white px-6 py-3 font-medium text-black transition hover:bg-white/90"
    >
      Discord ilə daxil ol
    </button>
  );
}
