"use client";

import {
  useActionState,
  useEffect,
} from "react";

import { useRouter } from "next/navigation";

import {
  Check,
  Gift,
  LoaderCircle,
} from "lucide-react";

import type {
  EarnActionResult,
} from "./actions";

const initialState: EarnActionResult = {
  ok: false,
  message: "",
};

export default function EarnClaimButton({
  missionId,
  complete,
  claimed,
  action,
}: {
  missionId: string;
  complete: boolean;
  claimed: boolean;
  action: (
    state: EarnActionResult,
    formData: FormData
  ) => Promise<EarnActionResult>;
}) {
  const router = useRouter();

  const [
    state,
    formAction,
    pending,
  ] = useActionState(
    action,
    initialState
  );

  useEffect(() => {
    if (state.claimed) {
      const timer =
        window.setTimeout(() => {
          router.refresh();
        }, 550);

      return () =>
        window.clearTimeout(timer);
    }
  }, [
    state.claimed,
    router,
  ]);

  if (
    claimed ||
    state.claimed
  ) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-[10px] border border-emerald-200/[0.09] bg-emerald-200/[0.035] px-3 py-2 text-[8px] font-semibold text-emerald-100/50">
        <Check className="h-3 w-3" />
        Götürülüb
      </span>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      {state.message &&
      !state.ok ? (
        <span className="max-w-44 text-right text-[7px] leading-3 text-red-200/45">
          {state.message}
        </span>
      ) : null}

      <form
        action={formAction}
      >
        <input
          type="hidden"
          name="missionId"
          value={missionId}
        />

        <button
          type="submit"
          disabled={
            !complete ||
            pending
          }
          className="group inline-flex min-w-[112px] items-center justify-center gap-1.5 rounded-[10px] border border-cyan-100/[0.11] bg-gradient-to-b from-cyan-100/[0.07] to-cyan-100/[0.025] px-3 py-2 text-[8px] font-semibold text-cyan-50/65 shadow-[0_8px_28px_rgba(100,220,255,0.035)] transition duration-200 hover:-translate-y-px hover:border-cyan-100/[0.18] hover:bg-cyan-100/[0.08] hover:text-cyan-50/85 disabled:translate-y-0 disabled:cursor-not-allowed disabled:border-white/[0.04] disabled:bg-white/[0.015] disabled:text-white/15 disabled:shadow-none"
        >
          {pending ? (
            <>
              <LoaderCircle className="h-3 w-3 animate-spin" />
              Gözlə...
            </>
          ) : complete ? (
            <>
              <Gift className="h-3 w-3 transition group-hover:scale-110" />
              Mükafatı götür
            </>
          ) : (
            "Davam et"
          )}
        </button>
      </form>
    </div>
  );
}
