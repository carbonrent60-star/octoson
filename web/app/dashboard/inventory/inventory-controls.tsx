"use client";

import {
  useState,
  useTransition,
} from "react";
import {
  Hammer,
  PackageOpen,
  Recycle,
  Wrench,
} from "lucide-react";

import {
  craftAction,
  openChestAction,
  recycleAction,
  salvageAction,
  type InventoryActionResult,
} from "./actions";

type ActionName =
  | "open"
  | "craft"
  | "recycle"
  | "salvage";

export default function InventoryControls({
  canOpen,
  collectibles,
}: {
  canOpen: boolean;
  collectibles: number;
}) {
  const [pending, startTransition] =
    useTransition();

  const [busy, setBusy] =
    useState<ActionName | null>(null);

  const [result, setResult] =
    useState<InventoryActionResult | null>(
      null
    );

  function run(
    name: ActionName,
    action: () => Promise<InventoryActionResult>
  ) {
    if (pending) return;

    setBusy(name);
    setResult(null);

    startTransition(async () => {
      const response = await action();

      setResult(response);
      setBusy(null);
    });
  }

  return (
    <div>
      {result && (
        <div
          className={`mb-4 rounded-[13px] border px-4 py-3 text-[9px] ${
            result.ok
              ? "border-emerald-300/[0.09] bg-emerald-300/[0.025] text-emerald-200/60"
              : "border-rose-300/[0.09] bg-rose-300/[0.025] text-rose-200/60"
          }`}
        >
          {result.message}
        </div>
      )}

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <ActionButton
          icon={PackageOpen}
          title="Sandıq aç"
          description="Ən uyğun sandığı aç"
          disabled={!canOpen}
          loading={busy === "open"}
          onClick={() =>
            run("open", openChestAction)
          }
        />

        <ActionButton
          icon={Hammer}
          title="Craft"
          description="3 collectible → titul"
          disabled={collectibles < 3}
          loading={busy === "craft"}
          onClick={() =>
            run("craft", craftAction)
          }
        />

        <ActionButton
          icon={Recycle}
          title="Recycle"
          description="Collectible → Aura"
          disabled={collectibles < 1}
          loading={busy === "recycle"}
          onClick={() =>
            run("recycle", recycleAction)
          }
        />

        <ActionButton
          icon={Wrench}
          title="Salvage"
          description="Collectible → açar"
          disabled={collectibles < 1}
          loading={busy === "salvage"}
          onClick={() =>
            run("salvage", salvageAction)
          }
        />
      </div>
    </div>
  );
}

function ActionButton({
  icon: Icon,
  title,
  description,
  disabled,
  loading,
  onClick,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  disabled: boolean;
  loading: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      onClick={onClick}
      className="group rounded-[15px] border border-white/[0.055] bg-black/20 p-4 text-left transition hover:border-cyan-100/[0.09] hover:bg-cyan-100/[0.02] disabled:cursor-not-allowed disabled:opacity-30"
    >
      <div className="flex h-8 w-8 items-center justify-center rounded-[10px] border border-white/[0.055] bg-white/[0.02]">
        <Icon className="h-3.5 w-3.5 text-cyan-100/40" />
      </div>

      <p className="mt-3 text-[10px] font-semibold text-white/50">
        {loading ? "İcra olunur..." : title}
      </p>

      <p className="mt-1 text-[8px] text-white/15">
        {description}
      </p>
    </button>
  );
}
