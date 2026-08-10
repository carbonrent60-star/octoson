"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";

export default function DiscordLogin() {
  const [loading, setLoading] = useState(false);

  async function login() {
    if (loading) return;

    setLoading(true);

    await signIn("discord", {
      callbackUrl: "/dashboard",
    });

    setLoading(false);
  }

  return (
    <button
      type="button"
      onClick={login}
      disabled={loading}
      className="rounded-xl bg-white px-6 py-3 font-medium text-black transition hover:bg-white/90 disabled:cursor-wait disabled:opacity-60"
    >
      {loading ? "Discord açılır..." : "Discord ilə daxil ol"}
    </button>
  );
}
