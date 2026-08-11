"use client";

import {
  useState,
  useTransition,
} from "react";

import {
  Coins,
  Play,
} from "lucide-react";

import {
  startRoomAction,
} from "@/app/dashboard/games/actions";

type Props = {
  code: string;
  playerCount: number;
};

export default function ReactionStart({
  code,
  playerCount,
}: Props) {
  const [bet, setBet] =
    useState(0);

  const [pending, startTransition] =
    useTransition();

  const [message, setMessage] =
    useState("");

  const pot =
    bet * playerCount;

  function startGame() {
    if (pending) {
      return;
    }

    setMessage("");

    const formData =
      new FormData();

    formData.set(
      "code",
      code
    );

    formData.set(
      "bet",
      String(bet)
    );

    startTransition(
      async () => {
        const result =
          await startRoomAction(
            formData
          );

        if (!result.ok) {
          setMessage(
            result.message
          );
        }
      }
    );
  }

  return (
    <div className="w-full rounded-[18px] border border-cyan-200/[0.09] bg-cyan-200/[0.025] p-3.5 lg:w-[300px]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[8px] font-semibold uppercase tracking-[0.18em] text-white/20">
            İlk raund
          </p>

          <p className="mt-1 text-[11px] font-semibold text-white/65">
            Aura mərci
          </p>
        </div>

        <div className="flex h-8 w-8 items-center justify-center rounded-[10px] border border-cyan-200/[0.1] bg-cyan-200/[0.04] text-cyan-100/55">
          <Coins className="h-3.5 w-3.5" />
        </div>
      </div>

      <div className="mt-3 grid grid-cols-4 gap-1.5">
        {[0, 100, 500, 1000].map(
          (amount) => (
            <button
              key={amount}
              type="button"
              disabled={pending}
              onClick={() =>
                setBet(amount)
              }
              className={`h-8 rounded-[9px] border text-[8px] font-semibold transition ${
                bet === amount
                  ? "border-cyan-200/[0.16] bg-cyan-200/[0.07] text-cyan-100/75"
                  : "border-white/[0.055] bg-black/20 text-white/30 hover:bg-white/[0.035]"
              }`}
            >
              {amount === 0
                ? "Pulsuz"
                : amount.toLocaleString(
                    "en-US"
                  )}
            </button>
          )
        )}
      </div>

      <div className="mt-2 flex items-center gap-2">
        <input
          type="number"
          min={0}
          max={1000000}
          step={1}
          disabled={pending}
          value={bet}
          onChange={(event) =>
            setBet(
              Math.max(
                0,
                Math.min(
                  1000000,
                  Math.floor(
                    Number(
                      event.target.value
                    ) || 0
                  )
                )
              )
            )
          }
          className="h-10 min-w-0 flex-1 rounded-[10px] border border-white/[0.06] bg-black/25 px-3 text-center font-mono text-[10px] text-white/60 outline-none transition focus:border-cyan-100/20 disabled:opacity-40"
        />

        <div className="flex h-10 shrink-0 items-center rounded-[10px] border border-white/[0.055] bg-black/20 px-3">
          <span className="font-mono text-[9px] font-semibold text-cyan-100/45">
            AURA
          </span>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between rounded-[10px] border border-white/[0.05] bg-black/20 px-3 py-2">
        <span className="text-[8px] uppercase tracking-[0.12em] text-white/20">
          Pot
        </span>

        <span className="font-mono text-[9px] font-semibold text-white/45">
          {pot.toLocaleString(
            "en-US"
          )} AURA
        </span>
      </div>

      <button
        type="button"
        disabled={pending}
        onClick={startGame}
        className="mt-2.5 flex h-10 w-full items-center justify-center gap-2 rounded-[11px] bg-cyan-100 text-[10px] font-semibold text-black transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Play className="h-3 w-3 fill-current" />

        {pending
          ? "Başladılır..."
          : bet > 0
            ? `${bet.toLocaleString(
                "en-US"
              )} Aura ilə başlat`
            : "Pulsuz başlat"}
      </button>

      <p className="mt-2 text-[8px] leading-4 text-white/18">
        Mərc hər oyunçudan ayrıca tutulur.
        Qalib bütün potu götürür.
      </p>

      {message && (
        <p className="mt-2 text-[9px] leading-4 text-red-200/60">
          {message}
        </p>
      )}
    </div>
  );
}
