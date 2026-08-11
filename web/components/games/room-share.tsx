"use client";

import {
  Check,
  Copy,
  Link2,
} from "lucide-react";

import {
  useState,
} from "react";

type Props = {
  code: string;
};

export default function RoomShare({
  code,
}: Props) {
  const [copied, setCopied] =
    useState(false);

  async function copyLink() {
    const link =
      `${window.location.origin}/dashboard/games/join/${code}`;

    await navigator.clipboard.writeText(
      link
    );

    setCopied(true);

    window.setTimeout(
      () => setCopied(false),
      1600
    );
  }

  return (
    <button
      type="button"
      onClick={copyLink}
      className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-[12px] border border-cyan-100/[0.09] bg-cyan-100/[0.035] text-[9px] font-semibold text-cyan-50/60 transition hover:bg-cyan-100/[0.065]"
    >
      {copied ? (
        <Check className="h-3.5 w-3.5" />
      ) : (
        <Link2 className="h-3.5 w-3.5" />
      )}

      {copied
        ? "Link kopyalandı"
        : "Qoşulma linkini kopyala"}

      {!copied && (
        <Copy className="h-3 w-3 opacity-40" />
      )}
    </button>
  );
}
