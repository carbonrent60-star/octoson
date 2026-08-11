"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  Check,
  X,
  Minus,
  AlertTriangle,
} from "lucide-react";

export type CasinoToastData = {
  id: number;
  type: "win" | "lose" | "push" | "error";
  amount?: number;
  multiplier?: number;
  message?: string;
};

export default function CasinoResultToast({
  toast,
  onClose,
}: {
  toast: CasinoToastData | null;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!toast) return;

    const timeout = window.setTimeout(() => {
      onClose();
    }, toast.type === "error" ? 2600 : 2200);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [toast, onClose]);

  const win = toast?.type === "win";
  const lose = toast?.type === "lose";
  const push = toast?.type === "push";

  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          key={toast.id}
          initial={{
            opacity: 0,
            y: -18,
            scale: 0.94,
            filter: "blur(8px)",
          }}
          animate={{
            opacity: 1,
            y: 0,
            scale: 1,
            filter: "blur(0px)",
          }}
          exit={{
            opacity: 0,
            y: -12,
            scale: 0.97,
            filter: "blur(5px)",
          }}
          transition={{
            type: "spring",
            stiffness: 430,
            damping: 30,
            mass: 0.7,
          }}
          className="
            pointer-events-none fixed
            left-1/2 top-[calc(env(safe-area-inset-top)+18px)]
            z-[9999]
            w-[calc(100%-28px)]
            max-w-[370px]
            -translate-x-1/2
            sm:top-7
          "
        >
          <div
            className={`
              relative overflow-hidden rounded-[20px]
              border px-4 py-4
              shadow-[0_24px_80px_rgba(0,0,0,.55)]
              backdrop-blur-2xl
              ${
                win
                  ? "border-emerald-300/[0.16] bg-[#09110e]/[0.96]"
                  : lose
                    ? "border-rose-300/[0.14] bg-[#11090b]/[0.96]"
                    : push
                      ? "border-white/[0.11] bg-[#0b0c0e]/[0.96]"
                      : "border-amber-200/[0.14] bg-[#100e09]/[0.96]"
              }
            `}
          >
            <div
              className={`
                pointer-events-none absolute inset-x-[18%] top-0 h-px
                ${
                  win
                    ? "bg-gradient-to-r from-transparent via-emerald-200/70 to-transparent"
                    : lose
                      ? "bg-gradient-to-r from-transparent via-rose-200/55 to-transparent"
                      : "bg-gradient-to-r from-transparent via-white/30 to-transparent"
                }
              `}
            />

            <div className="flex items-center gap-3">
              <motion.div
                initial={{
                  scale: 0.5,
                  rotate: -15,
                }}
                animate={{
                  scale: 1,
                  rotate: 0,
                }}
                transition={{
                  delay: 0.04,
                  type: "spring",
                  stiffness: 500,
                  damping: 24,
                }}
                className={`
                  flex h-10 w-10 shrink-0 items-center justify-center
                  rounded-[13px] border
                  ${
                    win
                      ? "border-emerald-200/[0.16] bg-emerald-300/[0.08] text-emerald-200"
                      : lose
                        ? "border-rose-200/[0.14] bg-rose-300/[0.07] text-rose-200"
                        : push
                          ? "border-white/[0.10] bg-white/[0.04] text-white/65"
                          : "border-amber-200/[0.14] bg-amber-300/[0.06] text-amber-100"
                  }
                `}
              >
                {win ? (
                  <Check className="h-5 w-5" strokeWidth={2.2} />
                ) : lose ? (
                  <X className="h-5 w-5" strokeWidth={2.2} />
                ) : push ? (
                  <Minus className="h-5 w-5" strokeWidth={2.2} />
                ) : (
                  <AlertTriangle
                    className="h-[18px] w-[18px]"
                    strokeWidth={2}
                  />
                )}
              </motion.div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3">
                  <p
                    className={`
                      text-[10px] font-semibold uppercase tracking-[0.16em]
                      ${
                        win
                          ? "text-emerald-100/70"
                          : lose
                            ? "text-rose-100/65"
                            : "text-white/45"
                      }
                    `}
                  >
                    {win
                      ? "Qələbə"
                      : lose
                        ? "Məğlubiyyət"
                        : push
                          ? "Bərabərə"
                          : "Xəta"}
                  </p>

                  {typeof toast.multiplier === "number" &&
                    toast.multiplier > 0 && (
                      <span className="rounded-full border border-white/[0.07] bg-white/[0.035] px-2 py-1 text-[8px] font-semibold text-white/45">
                        {toast.multiplier.toFixed(2)}×
                      </span>
                    )}
                </div>

                {typeof toast.amount === "number" &&
                toast.amount !== 0 ? (
                  <motion.p
                    initial={{
                      opacity: 0,
                      y: 5,
                    }}
                    animate={{
                      opacity: 1,
                      y: 0,
                    }}
                    transition={{
                      delay: 0.08,
                    }}
                    className={`
                      mt-1 text-[21px] font-semibold tracking-[-0.04em]
                      ${
                        win
                          ? "text-emerald-100"
                          : lose
                            ? "text-rose-100"
                            : "text-white/85"
                      }
                    `}
                  >
                    {toast.amount > 0 ? "+" : ""}
                    {Math.trunc(toast.amount).toLocaleString("en-US")}

                    <span className="ml-1.5 text-[8px] font-medium tracking-[0.08em] text-white/30">
                      AURA
                    </span>
                  </motion.p>
                ) : (
                  <p className="mt-1 text-[13px] font-medium text-white/80">
                    {toast.message ??
                      (push
                        ? "Mərc geri qaytarıldı."
                        : "Əməliyyat tamamlandı.")}
                  </p>
                )}
              </div>
            </div>

            {toast.message &&
              typeof toast.amount === "number" &&
              toast.amount !== 0 && (
                <p className="mt-2 truncate pl-[52px] text-[9px] text-white/27">
                  {toast.message}
                </p>
              )}

            <motion.div
              initial={{ scaleX: 1 }}
              animate={{ scaleX: 0 }}
              transition={{
                duration:
                  toast.type === "error" ? 2.6 : 2.2,
                ease: "linear",
              }}
              style={{
                transformOrigin: "left",
              }}
              className={`
                absolute bottom-0 left-0 h-px w-full
                ${
                  win
                    ? "bg-emerald-300/45"
                    : lose
                      ? "bg-rose-300/40"
                      : "bg-white/20"
                }
              `}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
