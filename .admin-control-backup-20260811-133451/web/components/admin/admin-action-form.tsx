"use client";

import {
  useActionState,
} from "react";

type Result = {
  ok: boolean;
  message: string;
};

type Action = (
  formData: FormData
) => Promise<Result>;

export default function AdminActionForm({
  action,
  children,
  className = "",
}: {
  action: Action;
  children:
    React.ReactNode;
  className?: string;
}) {
  const [
    state,
    formAction,
    pending,
  ] = useActionState(
    async (
      _previous: Result | null,
      data: FormData
    ) => {
      return action(data);
    },
    null
  );

  return (
    <form
      action={formAction}
      className={className}
    >
      {children}

      <button
        type="submit"
        disabled={pending}
        className="mt-4 inline-flex h-10 items-center justify-center rounded-xl border border-cyan-100/15 bg-cyan-100/[0.07] px-4 text-[11px] font-semibold text-cyan-50 transition hover:bg-cyan-100/[0.12] disabled:cursor-wait disabled:opacity-40"
      >
        {pending
          ? "Yenilənir..."
          : "Təsdiqlə"}
      </button>

      {state?.message ? (
        <p
          className={`mt-3 text-[11px] ${
            state.ok
              ? "text-emerald-300/80"
              : "text-rose-300/80"
          }`}
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
