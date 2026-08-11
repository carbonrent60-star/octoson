"use client";

import {
  useEffect,
  useRef,
  useState,
} from "react";
import {
  AnimatePresence,
  motion,
} from "motion/react";
import {
  Volume2,
  Volume1,
  VolumeX,
} from "lucide-react";
import { useOctosonAudio } from "./octoson-audio";

export default function SoundControl() {
  const {
    muted,
    setMuted,
    volume,
    setVolume,
  } = useOctosonAudio();

  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const effectiveVolume = muted
    ? 0
    : Math.round(volume * 100);

  const Icon =
    muted || effectiveVolume === 0
      ? VolumeX
      : effectiveVolume < 50
        ? Volume1
        : Volume2;

  useEffect(() => {
    function handleOutside(event: MouseEvent) {
      if (
        rootRef.current &&
        !rootRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    window.addEventListener("mousedown", handleOutside);
    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("mousedown", handleOutside);
      window.removeEventListener("keydown", handleEscape);
    };
  }, []);

  function setPreset(amount: number) {
    setVolume(amount / 100);
    setMuted(false);
  }

  return (
    <div
      ref={rootRef}
      className="relative shrink-0"
    >
      {/* SOUND BUTTON */}
      <motion.button
        type="button"
        aria-label="Səs"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        whileTap={{ scale: 0.92 }}
        whileHover={{ scale: 1.035 }}
        transition={{
          type: "spring",
          stiffness: 420,
          damping: 28,
        }}
        className={`
          relative flex h-10 w-10 shrink-0
          items-center justify-center
          overflow-hidden rounded-[13px]
          border
          shadow-[inset_0_1px_0_rgba(255,255,255,.055)]
          transition-[border-color,background-color,color,box-shadow]
          duration-200
          ${
            open
              ? "border-cyan-100/[0.18] bg-[#101719] text-cyan-50/80 shadow-[0_0_24px_rgba(103,232,249,.08),inset_0_1px_0_rgba(255,255,255,.06)]"
              : "border-white/[0.09] bg-[#0c0d0f] text-white/42 hover:border-white/[0.14] hover:bg-[#111315] hover:text-white/80"
          }
        `}
      >
        <motion.span
          className="pointer-events-none absolute inset-0"
          animate={{
            opacity: open ? 1 : 0,
          }}
          style={{
            background:
              "radial-gradient(circle at 50% 50%, rgba(103,232,249,.13), rgba(103,232,249,0) 72%)",
          }}
        />

        <AnimatePresence mode="wait">
          <motion.span
            key={`${muted}-${Icon.displayName ?? effectiveVolume}`}
            initial={{
              opacity: 0,
              scale: 0.72,
              y: 2,
            }}
            animate={{
              opacity: 1,
              scale: 1,
              y: 0,
            }}
            exit={{
              opacity: 0,
              scale: 0.72,
              y: -2,
            }}
            transition={{
              duration: 0.14,
            }}
            className="relative flex"
          >
            <Icon className="h-[16px] w-[16px]" />
          </motion.span>
        </AnimatePresence>

        {!muted && effectiveVolume > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute bottom-[6px] right-[6px] h-[3px] w-[3px] rounded-full bg-cyan-200 shadow-[0_0_7px_rgba(165,243,252,.8)]"
          />
        )}
      </motion.button>

      {/* FLOATING PANEL */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{
              opacity: 0,
              y: -8,
              scale: 0.96,
            }}
            animate={{
              opacity: 1,
              y: 0,
              scale: 1,
            }}
            exit={{
              opacity: 0,
              y: -6,
              scale: 0.97,
            }}
            transition={{
              duration: 0.19,
              ease: [0.22, 1, 0.36, 1],
            }}
            className="
              absolute right-0 top-[50px] z-[150]
              box-border
              w-[286px] min-w-[286px] max-w-[286px]
              overflow-hidden
              rounded-[20px]
              border border-white/[0.10]
              bg-[#090b0d]
              shadow-[0_28px_80px_rgba(0,0,0,.72),0_8px_30px_rgba(0,0,0,.5),inset_0_1px_0_rgba(255,255,255,.045)]
            "
            style={{
              width: 286,
              minWidth: 286,
              maxWidth: 286,
              WebkitBackdropFilter: "none",
              backdropFilter: "none",
              WebkitTransform: "translateZ(0)",
              transform: "translateZ(0)",
              isolation: "isolate",
            }}
          >
            {/* subtle top lighting */}
            <div
              className="pointer-events-none absolute inset-x-0 top-0 h-[100px]"
              style={{
                background:
                  "radial-gradient(ellipse at 72% -10%, rgba(103,232,249,.085), transparent 60%)",
              }}
            />

            <div className="relative p-[18px]">
              {/* HEADER */}
              <div className="flex min-w-0 items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="whitespace-nowrap text-[12px] font-semibold tracking-[-0.01em] text-white/88">
                    Səs
                  </div>

                  <div className="mt-[3px] whitespace-nowrap text-[10px] text-white/28">
                    Octoson audio
                  </div>
                </div>

                <motion.button
                  type="button"
                  aria-label={
                    muted
                      ? "Səsi aktiv et"
                      : "Səsi söndür"
                  }
                  onClick={() => setMuted(!muted)}
                  whileTap={{ scale: 0.88 }}
                  whileHover={{ scale: 1.04 }}
                  className={`
                    flex h-9 w-9 shrink-0
                    items-center justify-center
                    rounded-[11px] border
                    transition duration-200
                    ${
                      muted
                        ? "border-white/[0.08] bg-[#101214] text-white/30 hover:text-white/60"
                        : "border-cyan-100/[0.14] bg-cyan-100/[0.055] text-cyan-50/75 shadow-[0_0_18px_rgba(103,232,249,.06)]"
                    }
                  `}
                >
                  <AnimatePresence mode="wait">
                    <motion.span
                      key={muted ? "muted" : "active"}
                      initial={{
                        opacity: 0,
                        scale: 0.65,
                      }}
                      animate={{
                        opacity: 1,
                        scale: 1,
                      }}
                      exit={{
                        opacity: 0,
                        scale: 0.65,
                      }}
                      className="flex"
                    >
                      <Icon className="h-[15px] w-[15px]" />
                    </motion.span>
                  </AnimatePresence>
                </motion.button>
              </div>

              {/* DIVIDER */}
              <div className="my-4 h-px w-full bg-white/[0.055]" />

              {/* VOLUME INFO */}
              <div className="flex items-center justify-between">
                <span className="whitespace-nowrap text-[9px] font-semibold uppercase tracking-[0.16em] text-white/25">
                  Səviyyə
                </span>

                <AnimatePresence mode="wait">
                  <motion.span
                    key={effectiveVolume}
                    initial={{
                      opacity: 0,
                      y: 3,
                    }}
                    animate={{
                      opacity: 1,
                      y: 0,
                    }}
                    exit={{
                      opacity: 0,
                      y: -3,
                    }}
                    transition={{
                      duration: 0.1,
                    }}
                    className="whitespace-nowrap text-[11px] font-semibold tabular-nums text-white/60"
                  >
                    {effectiveVolume}%
                  </motion.span>
                </AnimatePresence>
              </div>

              {/* SLIDER */}
              <div className="relative mt-[14px] flex h-8 w-full items-center">
                <div className="absolute left-0 right-0 h-[6px] overflow-hidden rounded-full bg-[#1a1d20] shadow-[inset_0_1px_2px_rgba(0,0,0,.55)]">
                  <motion.div
                    animate={{
                      width: `${effectiveVolume}%`,
                    }}
                    transition={{
                      type: "spring",
                      stiffness: 300,
                      damping: 30,
                    }}
                    className="h-full rounded-full"
                    style={{
                      background:
                        "linear-gradient(90deg, rgba(103,232,249,.58), rgba(207,250,254,.9))",
                      boxShadow:
                        "0 0 12px rgba(103,232,249,.18)",
                    }}
                  />
                </div>

                <motion.div
                  animate={{
                    left: `calc(${effectiveVolume}% - 7px)`,
                  }}
                  transition={{
                    type: "spring",
                    stiffness: 300,
                    damping: 30,
                  }}
                  className="
                    pointer-events-none absolute
                    h-[14px] w-[14px]
                    rounded-full
                    border border-white/60
                    bg-[#e8fdff]
                    shadow-[0_0_0_3px_rgba(103,232,249,.055),0_0_16px_rgba(103,232,249,.28)]
                  "
                />

                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={effectiveVolume}
                  aria-label="Səs səviyyəsi"
                  onChange={(event) => {
                    const next =
                      Number(event.target.value) / 100;

                    setVolume(next);

                    if (next > 0 && muted) {
                      setMuted(false);
                    }
                  }}
                  className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
                  style={{
                    WebkitAppearance: "none",
                    appearance: "none",
                  }}
                />
              </div>

              {/* PRESETS */}
              <div className="mt-3 grid grid-cols-3 gap-2">
                {[25, 50, 100].map((amount) => {
                  const active =
                    !muted &&
                    effectiveVolume === amount;

                  return (
                    <motion.button
                      key={amount}
                      type="button"
                      onClick={() => setPreset(amount)}
                      whileTap={{ scale: 0.94 }}
                      className={`
                        relative h-9 overflow-hidden
                        rounded-[11px] border
                        text-[10px] font-medium
                        tabular-nums
                        transition duration-200
                        ${
                          active
                            ? "border-cyan-100/[0.14] bg-[#10191b] text-cyan-50/75 shadow-[inset_0_1px_0_rgba(255,255,255,.035)]"
                            : "border-white/[0.065] bg-[#0d0f11] text-white/30 hover:border-white/[0.11] hover:bg-[#121416] hover:text-white/60"
                        }
                      `}
                    >
                      {active && (
                        <motion.span
                          layoutId="volume-preset-active"
                          className="absolute inset-0 bg-cyan-100/[0.025]"
                          transition={{
                            type: "spring",
                            stiffness: 350,
                            damping: 30,
                          }}
                        />
                      )}

                      <span className="relative">
                        {amount}%
                      </span>
                    </motion.button>
                  );
                })}
              </div>

              {/* STATUS */}
              <div className="mt-4 flex items-center gap-2 border-t border-white/[0.05] pt-3">
                <motion.span
                  animate={{
                    opacity:
                      !muted &&
                      effectiveVolume > 0
                        ? 1
                        : 0.25,
                    scale:
                      !muted &&
                      effectiveVolume > 0
                        ? 1
                        : 0.8,
                  }}
                  className="h-[5px] w-[5px] shrink-0 rounded-full bg-cyan-200 shadow-[0_0_8px_rgba(165,243,252,.55)]"
                />

                <span className="whitespace-nowrap text-[9px] text-white/22">
                  {muted || effectiveVolume === 0
                    ? "Audio söndürülüb"
                    : "Audio aktivdir"}
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
