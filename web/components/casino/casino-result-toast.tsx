"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
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

function aura(value: number) {
  return Math.abs(
    Math.trunc(value)
  ).toLocaleString("en-US");
}


function AnimatedResultIcon({
  type,
}: {
  type: CasinoToastData["type"];
}) {
  const win = type === "win";
  const lose = type === "lose";
  const push = type === "push";

  return (
    <div className="relative flex h-[76px] w-[76px] items-center justify-center">
      {/* Expanding impact ring */}
      <motion.div
        key={`ring-${type}`}
        className={`pointer-events-none absolute inset-[5px] rounded-full border ${
          win
            ? "border-emerald-200/45"
            : lose
              ? "border-rose-200/40"
              : push
                ? "border-white/25"
                : "border-amber-200/40"
        }`}
        initial={{
          opacity: 0,
          scale: 0.45,
        }}
        animate={{
          opacity: [0, 0.8, 0],
          scale: [0.45, 1, 1.34],
        }}
        transition={{
          duration: 0.72,
          times: [0, 0.35, 1],
          ease: "easeOut",
        }}
      />

      {/* Second delayed ring */}
      <motion.div
        key={`ring2-${type}`}
        className={`pointer-events-none absolute inset-[9px] rounded-full border ${
          win
            ? "border-emerald-100/20"
            : lose
              ? "border-rose-100/18"
              : push
                ? "border-white/15"
                : "border-amber-100/18"
        }`}
        initial={{
          opacity: 0,
          scale: 0.55,
        }}
        animate={{
          opacity: [0, 0.55, 0],
          scale: [0.55, 1, 1.22],
        }}
        transition={{
          duration: 0.65,
          delay: 0.1,
          times: [0, 0.35, 1],
          ease: "easeOut",
        }}
      />

      {/* Main circle */}
      <motion.div
        key={`icon-${type}`}
        className={`relative flex h-[52px] w-[52px] items-center justify-center rounded-full border ${
          win
            ? "border-emerald-200/55 bg-emerald-300/[0.08]"
            : lose
              ? "border-rose-200/45 bg-rose-300/[0.07]"
              : push
                ? "border-white/25 bg-white/[0.04]"
                : "border-amber-200/45 bg-amber-300/[0.07]"
        }`}
        initial={
          lose
            ? {
                opacity: 0,
                scale: 0.35,
                rotate: -14,
              }
            : {
                opacity: 0,
                scale: 0.3,
                rotate: -18,
              }
        }
        animate={
          lose
            ? {
                opacity: 1,
                scale: [0.35, 1.18, 0.92, 1],
                rotate: [-14, 7, -3, 0],
                x: [0, -3, 3, -2, 1, 0],
              }
            : {
                opacity: 1,
                scale: [0.3, 1.22, 0.94, 1],
                rotate: [-18, 5, -2, 0],
                y: [5, -3, 1, 0],
              }
        }
        transition={{
          duration: lose ? 0.52 : 0.58,
          ease: "easeOut",
        }}
        style={{
          willChange: "transform, opacity",
          transform: "translateZ(0)",
          WebkitBackfaceVisibility: "hidden",
          backfaceVisibility: "hidden",
        }}
      >
        {/* Tiny inner pulse */}
        <motion.div
          className={`absolute inset-[6px] rounded-full ${
            win
              ? "bg-emerald-200/[0.06]"
              : lose
                ? "bg-rose-200/[0.05]"
                : push
                  ? "bg-white/[0.035]"
                  : "bg-amber-200/[0.05]"
          }`}
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{
            opacity: [0, 1, 0.35],
            scale: [0.6, 1.05, 1],
          }}
          transition={{
            duration: 0.5,
            delay: 0.08,
          }}
        />

        <motion.div
          initial={{
            opacity: 0,
            scale: 0.45,
          }}
          animate={{
            opacity: 1,
            scale: [0.45, 1.2, 1],
          }}
          transition={{
            duration: 0.38,
            delay: 0.1,
            ease: "easeOut",
          }}
          className="relative z-10"
        >
          {win ? (
            <Check
              className="h-[25px] w-[25px] text-emerald-100"
              strokeWidth={1.8}
            />
          ) : lose ? (
            <X
              className="h-[25px] w-[25px] text-rose-100"
              strokeWidth={1.8}
            />
          ) : push ? (
            <Minus
              className="h-[24px] w-[24px] text-white/70"
              strokeWidth={1.8}
            />
          ) : (
            <AlertTriangle
              className="h-[23px] w-[23px] text-amber-100"
              strokeWidth={1.7}
            />
          )}
        </motion.div>
      </motion.div>

      {/* Win sparkle accents */}
      {win && (
        <>
          <motion.span
            className="absolute right-[4px] top-[8px] h-[3px] w-[3px] rounded-full bg-emerald-100"
            initial={{ opacity: 0, scale: 0 }}
            animate={{
              opacity: [0, 1, 0],
              scale: [0, 1.5, 0],
              y: [3, -3, -7],
            }}
            transition={{
              duration: 0.55,
              delay: 0.18,
            }}
          />

          <motion.span
            className="absolute bottom-[9px] left-[5px] h-[2px] w-[2px] rounded-full bg-emerald-100"
            initial={{ opacity: 0, scale: 0 }}
            animate={{
              opacity: [0, 0.8, 0],
              scale: [0, 1.4, 0],
              x: [2, -3, -6],
            }}
            transition={{
              duration: 0.5,
              delay: 0.27,
            }}
          />
        </>
      )}
    </div>
  );
}

export default function CasinoResultToast({
  toast,
  onClose,
}: {
  toast: CasinoToastData | null;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    return () => {
      setMounted(false);
    };
  }, []);

  useEffect(() => {
    if (!toast) return;

    const timeout = window.setTimeout(
      onClose,
      toast.type === "error" ? 2600 : 2200
    );

    return () => {
      window.clearTimeout(timeout);
    };
  }, [toast, onClose]);

  if (!mounted) {
    return null;
  }

  const win = toast?.type === "win";
  const lose = toast?.type === "lose";
  const push = toast?.type === "push";
  const error = toast?.type === "error";

  const amount =
    typeof toast?.amount === "number"
      ? toast.amount
      : undefined;

  const resultTitle = win
    ? "QAZANDIN"
    : lose
      ? "UDUZDUN"
      : push
        ? "BƏRABƏRƏ"
        : "XƏTA";

  return createPortal(
    <AnimatePresence>
      {toast && (
        <motion.div
          key={toast.id}
          className="
            fixed inset-0
            z-[2147483647]
            flex items-center justify-center
            p-4
            sm:p-6
          "
          style={{
            backgroundColor: "rgba(0,0,0,0.68)",
            isolation: "isolate",
          }}
          initial={{
            opacity: 0,
          }}
          animate={{
            opacity: 1,
          }}
          exit={{
            opacity: 0,
          }}
          transition={{
            duration: 0.16,
          }}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              onClose();
            }
          }}
        >
          <motion.div
            role="status"
            aria-live="polite"
            initial={{
              opacity: 0,
              scale: 0.9,
              y: 18,
            }}
            animate={{
              opacity: 1,
              scale: 1,
              y: 0,
            }}
            exit={{
              opacity: 0,
              scale: 0.94,
              y: 10,
            }}
            transition={{
              type: "spring",
              stiffness: 420,
              damping: 30,
              mass: 0.72,
            }}
            className="
              relative
              overflow-hidden
              rounded-[24px]
              border border-white/[0.10]
              px-6 py-7
              text-center
              sm:px-8
              sm:py-8
            "
            style={{
              width: "min(420px, calc(100vw - 32px))",
              maxWidth: "420px",
              minWidth: "0",
              flex: "none",
              backgroundColor: "#0b0e0f",
              backgroundImage:
                "linear-gradient(180deg, #121718 0%, #0b0e0f 55%, #080a0b 100%)",
              boxShadow:
                "0 30px 100px rgba(0,0,0,0.78), 0 0 0 1px rgba(255,255,255,0.08)",
              opacity: 1,
              isolation: "isolate",
            }}
          >
            {/* subtle top highlight */}
            <div
              className="
                pointer-events-none
                absolute inset-x-[18%] top-0
                h-px
              "
              style={{
                background: win
                  ? "linear-gradient(90deg,transparent,rgba(110,231,183,.65),transparent)"
                  : lose
                    ? "linear-gradient(90deg,transparent,rgba(253,164,175,.55),transparent)"
                    : push
                      ? "linear-gradient(90deg,transparent,rgba(255,255,255,.25),transparent)"
                      : "linear-gradient(90deg,transparent,rgba(253,230,138,.50),transparent)",
              }}
            />

            {/* icon */}
            <motion.div
              initial={{
                scale: 0.65,
                opacity: 0,
              }}
              animate={{
                scale: 1,
                opacity: 1,
              }}
              transition={{
                delay: 0.04,
                type: "spring",
                stiffness: 480,
                damping: 25,
              }}
              className={`
                mx-auto
                flex h-14 w-14
                items-center justify-center
                rounded-full border
                ${
                  win
                    ? "border-emerald-300/25 bg-emerald-300/[0.08] text-emerald-200"
                    : lose
                      ? "border-rose-300/25 bg-rose-300/[0.08] text-rose-200"
                      : push
                        ? "border-white/15 bg-white/[0.05] text-white/70"
                        : "border-amber-300/25 bg-amber-300/[0.08] text-amber-200"
                }
              `}
            >
              {win ? (
                <Check
                  className="h-7 w-7"
                  strokeWidth={2.2}
                />
              ) : lose ? (
                <X
                  className="h-7 w-7"
                  strokeWidth={2.2}
                />
              ) : push ? (
                <Minus
                  className="h-7 w-7"
                  strokeWidth={2.2}
                />
              ) : (
                <AlertTriangle
                  className="h-6 w-6"
                  strokeWidth={2}
                />
              )}
            </motion.div>

            {/* status */}
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
                mt-4
                text-[10px]
                font-semibold
                uppercase
                tracking-[0.24em]
                ${
                  win
                    ? "text-emerald-200/65"
                    : lose
                      ? "text-rose-200/65"
                      : push
                        ? "text-white/45"
                        : "text-amber-200/65"
                }
              `}
            >
              {resultTitle}
            </motion.p>

            {/* amount */}
            {typeof amount === "number" && !error && (
              <motion.div
                initial={{
                  opacity: 0,
                  y: 10,
                  scale: 0.96,
                }}
                animate={{
                  opacity: 1,
                  y: 0,
                  scale: 1,
                }}
                transition={{
                  delay: 0.11,
                }}
                className={`
                  mt-1
                  text-[42px]
                  font-bold
                  leading-none
                  tracking-[-0.055em]
                  sm:text-[48px]
                  ${
                    amount > 0
                      ? "text-emerald-200"
                      : amount < 0
                        ? "text-rose-200"
                        : "text-white/80"
                  }
                `}
              >
                {amount > 0 ? "+" : amount < 0 ? "-" : ""}
                {aura(amount)}

                <span
                  className="
                    ml-2
                    text-[11px]
                    font-semibold
                    tracking-[0.12em]
                    text-white/35
                  "
                >
                  AURA
                </span>
              </motion.div>
            )}

            {/* error title if no amount */}
            {error && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.1 }}
                className="
                  mt-2
                  text-[24px]
                  font-semibold
                  tracking-[-0.03em]
                  text-white/90
                "
              >
                Əməliyyat alınmadı
              </motion.p>
            )}

            {/* multiplier */}
            {typeof toast.multiplier === "number" &&
              toast.multiplier > 0 && (
                <motion.div
                  initial={{
                    opacity: 0,
                  }}
                  animate={{
                    opacity: 1,
                  }}
                  transition={{
                    delay: 0.14,
                  }}
                  className="
                    mx-auto mt-4
                    inline-flex
                    rounded-full
                    border border-white/[0.08]
                    bg-white/[0.04]
                    px-3 py-1.5
                    text-[10px]
                    font-semibold
                    text-white/45
                  "
                >
                  {toast.multiplier.toFixed(2)}x
                </motion.div>
              )}

            {/* message */}
            {toast.message && (
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
                  delay: 0.16,
                }}
                className="
                  mx-auto mt-4
                  max-w-[320px]
                  text-[11px]
                  leading-5
                  text-white/40
                "
              >
                {toast.message}
              </motion.p>
            )}

            {/* timer */}
            <div
              className="
                absolute
                bottom-0 left-0
                h-[2px] w-full
                bg-white/[0.04]
              "
            >
              <motion.div
                initial={{
                  scaleX: 1,
                }}
                animate={{
                  scaleX: 0,
                }}
                transition={{
                  duration:
                    toast.type === "error"
                      ? 2.6
                      : 2.2,
                  ease: "linear",
                }}
                style={{
                  transformOrigin: "left",
                }}
                className={`
                  h-full w-full
                  ${
                    win
                      ? "bg-emerald-300/60"
                      : lose
                        ? "bg-rose-300/55"
                        : push
                          ? "bg-white/30"
                          : "bg-amber-300/55"
                  }
                `}
              />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
