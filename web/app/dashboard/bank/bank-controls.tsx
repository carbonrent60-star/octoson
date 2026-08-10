"use client";

import { useState, useTransition } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  LoaderCircle,
  Wallet,
  Landmark,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

import {
  depositAction,
  withdrawAction,
} from "./actions";

type Mode = "deposit" | "withdraw";

export function BankControls({
  wallet,
  bank,
}: {
  wallet: number;
  bank: number;
}) {
  const [mode, setMode] = useState<Mode>("deposit");
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pending, startTransition] = useTransition();

  const available = mode === "deposit" ? wallet : bank;
  const destination = mode === "deposit" ? bank : wallet;

  function changeMode(nextMode: Mode) {
    setMode(nextMode);
    setAmount("");
    setMessage(null);
  }

  function setQuickAmount(percentage: number) {
    const next = Math.floor(available * percentage);
    setAmount(Math.max(1, next).toString());
    setMessage(null);
  }

  function setMax() {
    setAmount(Math.max(0, Math.floor(available)).toString());
    setMessage(null);
  }

  function submit() {
    const numericAmount = Number(amount.replace(/,/g, ""));

    if (!Number.isSafeInteger(numericAmount) || numericAmount <= 0) {
      setSuccess(false);
      setMessage("Düzgün Aura məbləği daxil et.");
      return;
    }

    if (numericAmount > available) {
      setSuccess(false);
      setMessage(
        mode === "deposit"
          ? "Wallet-də kifayət qədər Aura yoxdur."
          : "Bankda kifayət qədər Aura yoxdur."
      );
      return;
    }

    const formData = new FormData();
    formData.set("amount", numericAmount.toString());

    setMessage(null);

    startTransition(async () => {
      try {
        const result =
          mode === "deposit"
            ? await depositAction(formData)
            : await withdrawAction(formData);

        setSuccess(result.ok);
        setMessage(result.message);

        if (result.ok) {
          setAmount("");
        }
      } catch (error) {
        console.error(error);
        setSuccess(false);
        setMessage("Bank əməliyyatı zamanı xəta baş verdi.");
      }
    });
  }

  const parsed = Number(amount || 0);

  return (
    <div className="overflow-hidden rounded-[24px] border border-white/[0.07] bg-[#0a0a0d]">
      <div className="flex flex-col gap-5 border-b border-white/[0.055] px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-[16px] font-semibold tracking-[-0.01em] text-white">
            Bank əməliyyatı
          </h2>

          <p className="mt-1 text-[12px] text-white/25">
            Aura-nı wallet və bank arasında köçür.
          </p>
        </div>

        <div className="relative flex w-fit rounded-[11px] border border-white/[0.07] bg-black/30 p-1">
          {(["deposit", "withdraw"] as const).map((item) => {
            const active = mode === item;

            return (
              <button
                key={item}
                type="button"
                onClick={() => changeMode(item)}
                className={`relative z-10 min-w-[105px] rounded-[8px] px-4 py-2 text-[12px] font-medium transition-colors ${
                  active ? "text-black" : "text-white/35 hover:text-white/70"
                }`}
              >
                {active && (
                  <motion.div
                    layoutId="bank-mode"
                    className="absolute inset-0 -z-10 rounded-[8px] bg-white"
                    transition={{
                      type: "spring",
                      stiffness: 450,
                      damping: 35,
                    }}
                  />
                )}

                {item === "deposit" ? "Deposit" : "Withdraw"}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-0 lg:grid-cols-[1fr_310px]">
        <div className="p-6 sm:p-7">
          <div className="flex items-center justify-between">
            <label
              htmlFor="bank-amount"
              className="text-[11px] font-medium uppercase tracking-[0.12em] text-white/25"
            >
              Məbləğ
            </label>

            <span className="text-[11px] text-white/25">
              Maksimum{" "}
              <strong className="font-medium text-white/50">
                {Math.floor(available).toLocaleString("en-US")} Aura
              </strong>
            </span>
          </div>

          <div className="mt-3 flex items-center rounded-[16px] border border-white/[0.08] bg-black/25 px-5 transition-all focus-within:border-cyan-200/25 focus-within:bg-cyan-300/[0.015]">
            <input
              id="bank-amount"
              type="text"
              inputMode="numeric"
              placeholder="0"
              value={amount}
              disabled={pending}
              onChange={(event) => {
                const value = event.target.value.replace(/[^\d]/g, "");
                setAmount(value);
                setMessage(null);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") submit();
              }}
              className="min-w-0 flex-1 bg-transparent py-5 text-[28px] font-semibold tracking-[-0.03em] text-white outline-none placeholder:text-white/10"
            />

            <span className="ml-3 text-[12px] font-semibold text-cyan-200/70">
              AURA
            </span>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <QuickButton onClick={() => setQuickAmount(0.25)}>
              25%
            </QuickButton>

            <QuickButton onClick={() => setQuickAmount(0.5)}>
              50%
            </QuickButton>

            <QuickButton onClick={() => setQuickAmount(0.75)}>
              75%
            </QuickButton>

            <QuickButton onClick={setMax}>MAX</QuickButton>
          </div>

          <AnimatePresence mode="wait">
            {message && (
              <motion.div
                key={message}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className={`mt-5 flex items-center gap-2.5 rounded-[12px] border px-4 py-3 text-[12px] ${
                  success
                    ? "border-emerald-300/10 bg-emerald-300/[0.04] text-emerald-200/70"
                    : "border-red-300/10 bg-red-300/[0.04] text-red-200/70"
                }`}
              >
                {success ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                ) : (
                  <AlertCircle className="h-4 w-4 shrink-0" />
                )}

                {message}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="border-t border-white/[0.055] bg-white/[0.012] p-6 lg:border-l lg:border-t-0">
          <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-white/15">
            Əməliyyatdan sonra
          </p>

          <div className="mt-5 space-y-4">
            <MiniBalance
              icon={mode === "deposit" ? Wallet : Landmark}
              label={mode === "deposit" ? "Wallet" : "Bank"}
              value={Math.max(0, available - parsed)}
            />

            <div className="flex justify-center">
              {mode === "deposit" ? (
                <ArrowDownToLine className="h-4 w-4 text-white/15" />
              ) : (
                <ArrowUpFromLine className="h-4 w-4 text-white/15" />
              )}
            </div>

            <MiniBalance
              icon={mode === "deposit" ? Landmark : Wallet}
              label={mode === "deposit" ? "Bank" : "Wallet"}
              value={destination + parsed}
              highlighted
            />
          </div>

          <motion.button
            whileTap={{ scale: 0.985 }}
            type="button"
            disabled={pending || !amount || available <= 0}
            onClick={submit}
            className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-[12px] bg-cyan-200 px-5 text-[12px] font-semibold text-[#061014] transition hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-25"
          >
            {pending ? (
              <>
                <LoaderCircle className="h-4 w-4 animate-spin" />
                İşlənir...
              </>
            ) : mode === "deposit" ? (
              <>
                <ArrowDownToLine className="h-4 w-4" />
                Banka yatır
              </>
            ) : (
              <>
                <ArrowUpFromLine className="h-4 w-4" />
                Wallet-ə çıxar
              </>
            )}
          </motion.button>
        </div>
      </div>
    </div>
  );
}

function MiniBalance({
  icon: Icon,
  label,
  value,
  highlighted = false,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  highlighted?: boolean;
}) {
  return (
    <div
      className={`rounded-[13px] border p-4 ${
        highlighted
          ? "border-cyan-200/10 bg-cyan-200/[0.025]"
          : "border-white/[0.055] bg-black/20"
      }`}
    >
      <div className="flex items-center gap-2 text-white/25">
        <Icon className="h-3.5 w-3.5" />
        <span className="text-[10px]">{label}</span>
      </div>

      <p className="mt-2 text-[15px] font-semibold tracking-[-0.02em] text-white/70">
        {Math.max(0, Math.floor(value)).toLocaleString("en-US")}
        <span className="ml-1 text-[9px] font-medium text-white/20">
          AURA
        </span>
      </p>
    </div>
  );
}

function QuickButton({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-[9px] border border-white/[0.07] bg-white/[0.025] px-3 py-1.5 text-[10px] font-medium text-white/30 transition hover:border-white/[0.12] hover:bg-white/[0.05] hover:text-white/65"
    >
      {children}
    </button>
  );
}
