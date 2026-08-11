"use client";

import {
  Check,
  Link2,
} from "lucide-react";

import {
  useState,
} from "react";

type Props = {
  code: string;
};

export default function CopyRoomLink({
  code,
}: Props) {
  const [copied, setCopied] =
    useState(false);

  async function copy() {
    const url =
      `${window.location.origin}/dashboard/games/room/${code}`;

    await navigator.clipboard.writeText(
      url
    );

    setCopied(true);

    window.setTimeout(
      () =>
        setCopied(false),
      1800
    );
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="flex h-10 items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.025] px-4 text-[10px] font-medium text-white/50 transition hover:bg-white/[0.05] hover:text-white/75"
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-emerald-200/70" />
      ) : (
        <Link2 className="h-3.5 w-3.5" />
      )}

      {copied
        ? "Link kopyalandı"
        : "Dəvət linki"}
    </button>
  );
}
