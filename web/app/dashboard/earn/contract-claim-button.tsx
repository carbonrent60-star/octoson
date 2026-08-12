"use client";

import {
  useActionState,
  useEffect,
} from "react";

import {
  useRouter,
} from "next/navigation";

import {
  BadgeCheck,
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

export default function ContractClaimButton({
  contractId,
  complete,
  action,
}: {
  contractId: string;
  complete: boolean;
  action: (
    state: EarnActionResult,
    formData: FormData
  ) => Promise<EarnActionResult>;
}) {
  const router =
    useRouter();

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
        }, 600);

      return () =>
        window.clearTimeout(timer);
    }
  }, [
    state.claimed,
    router,
  ]);

  if (state.claimed) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-[11px] border border-emerald-200/[0.1] bg-emerald-200/[0.04] px-4 py-2.5 text-[8px] font-semibold text-emerald-100/55">
        <BadgeCheck className="h-3.5 w-3.5" />
        Mükafat götürüldü
      </span>
    );
  }

  return (
    <div className="flex flex-col items-end gap-2">
      {state.message ? (
        <span
          className={`max-w-52 text-right text-[8px] leading-4 ${
            state.ok
              ? "text-emerald-100/45"
              : "text-red-200/45"
          }`}
        >
          {state.message}
        </span>
      ) : null}

      <form
        action={formAction}
      >
        <input
          type="hidden"
          name="contractId"
          value={contractId}
        />

        <button
          type="submit"
          disabled={
            !complete ||
            pending
          }
          className="group inline-flex min-w-[140px] items-center justify-center gap-2 rounded-[11px] border border-violet-200/[0.12] bg-gradient-to-b from-violet-200/[0.085] to-violet-200/[0.025] px-4 py-2.5 text-[8px] font-semibold text-violet-100/65 shadow-[0_10px_32px_rgba(150,100,255,0.045)] transition duration-200 hover:-translate-y-px hover:border-violet-200/[0.2] hover:bg-violet-200/[0.09] hover:text-violet-50/85 disabled:translate-y-0 disabled:cursor-not-allowed disabled:border-white/[0.04] disabled:bg-white/[0.015] disabled:text-white/15 disabled:shadow-none"
        >
          {pending ? (
            <>
              <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
              Gözlə...
            </>
          ) : complete ? (
            <>
              <Gift className="h-3.5 w-3.5 transition group-hover:scale-110" />
              Müqaviləni götür
            </>
          ) : (
            "Davam et"
          )}
        </button>
      </form>
    </div>
  );
}
