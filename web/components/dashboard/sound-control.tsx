"use client";

import {
  AnimatePresence,
  motion,
} from "motion/react";
import {
  Volume1,
  Volume2,
  VolumeX,
} from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
} from "react";

export default function SoundControl() {
  const [open, setOpen] =
    useState(false);

  const [volume, setVolume] =
    useState(65);

  const [muted, setMuted] =
    useState(false);

  const rootRef =
    useRef<HTMLDivElement>(null);

  useEffect(() => {
    function close(
      event: MouseEvent
    ) {
      if (
        rootRef.current &&
        !rootRef.current.contains(
          event.target as Node
        )
      ) {
        setOpen(false);
      }
    }

    document.addEventListener(
      "mousedown",
      close
    );

    return () =>
      document.removeEventListener(
        "mousedown",
        close
      );
  }, []);

  const effectiveVolume =
    muted ? 0 : volume;

  const Icon =
    effectiveVolume === 0
      ? VolumeX
      : effectiveVolume < 45
        ? Volume1
        : Volume2;

  return (
    <div
      ref={rootRef}
      className="relative"
    >
      <motion.button
        type="button"
        aria-label="Səs"
        whileTap={{ scale: 0.94 }}
        onClick={() =>
          setOpen((value) => !value)
        }
        className={`group relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-[12px] border transition ${
          open
            ? "border-cyan-100/[0.12] bg-cyan-100/[0.055] text-cyan-100/70"
            : "border-white/[0.07] bg-white/[0.025] text-white/30 hover:border-white/[0.1] hover:bg-white/[0.05] hover:text-white/55"
        }`}
      >
        <motion.div
          animate={{
            scale: open
              ? [1, 1.08, 1]
              : 1,
          }}
          transition={{
            duration: 0.3,
          }}
        >
          <Icon className="h-[15px] w-[15px]" />
        </motion.div>

        {effectiveVolume > 0 && (
          <motion.span
            layout
            className="absolute bottom-[5px] h-[2px] rounded-full bg-cyan-200/55"
            style={{
              width: `${Math.max(
                5,
                effectiveVolume * 0.22
              )}px`,
            }}
          />
        )}
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{
              opacity: 0,
              y: -6,
              scale: 0.96,
            }}
            animate={{
              opacity: 1,
              y: 0,
              scale: 1,
            }}
            exit={{
              opacity: 0,
              y: -5,
              scale: 0.97,
            }}
            transition={{
              type: "spring",
              stiffness: 340,
              damping: 27,
            }}
            className="absolute right-0 top-[48px] z-[80] w-[230px] overflow-hidden rounded-[17px] border border-white/[0.09] bg-[#0a0b0d]/95 p-3.5 shadow-[0_25px_70px_rgba(0,0,0,.6)] backdrop-blur-2xl"
          >
            <div className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-cyan-200/[0.055] blur-[35px]" />

            <div className="relative flex items-center justify-between">
              <div>
                <p className="text-[9px] font-semibold text-white/62">
                  Səs
                </p>
                <p className="mt-0.5 text-[7px] text-white/20">
                  Interface audio
                </p>
              </div>

              <span className="text-[8px] font-semibold tabular-nums text-cyan-100/40">
                {effectiveVolume}%
              </span>
            </div>

            <div className="relative mt-4 flex items-center gap-3">
              <button
                type="button"
                onClick={() =>
                  setMuted(
                    (value) =>
                      !value
                  )
                }
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] border border-white/[0.055] bg-black/20 text-white/30 transition hover:bg-white/[0.05] hover:text-white/55"
              >
                <Icon className="h-3.5 w-3.5" />
              </button>

              <div className="relative flex h-6 flex-1 items-center">
                <div className="absolute inset-x-0 h-[4px] rounded-full bg-white/[0.055]" />

                <motion.div
                  className="absolute left-0 h-[4px] rounded-full bg-gradient-to-r from-cyan-300/45 to-cyan-100/80"
                  animate={{
                    width: `${effectiveVolume}%`,
                  }}
                  transition={{
                    type: "spring",
                    stiffness: 240,
                    damping: 28,
                  }}
                />

                <input
                  aria-label="Səs səviyyəsi"
                  type="range"
                  min="0"
                  max="100"
                  value={
                    muted
                      ? 0
                      : volume
                  }
                  onChange={(event) => {
                    const next =
                      Number(
                        event.target
                          .value
                      );

                    setVolume(next);
                    setMuted(
                      next === 0
                    );
                  }}
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                />

                <motion.div
                  animate={{
                    left: `calc(${effectiveVolume}% - 6px)`,
                  }}
                  transition={{
                    type: "spring",
                    stiffness: 250,
                    damping: 28,
                  }}
                  className="pointer-events-none absolute h-3 w-3 rounded-full border border-cyan-50/50 bg-cyan-100 shadow-[0_0_14px_rgba(165,243,252,.3)]"
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
