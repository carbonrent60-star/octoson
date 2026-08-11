"use client";

import { useEffect, useRef, useState } from "react";
import {
  Volume2,
  VolumeX,
} from "lucide-react";

import { useOctosonAudio } from "./octoson-audio";

export default function SoundControl() {
  const {
    muted,
    volume,
    toggleMuted,
    setVolume,
  } = useOctosonAudio();

  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (
        rootRef.current &&
        !rootRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };

    document.addEventListener("pointerdown", close);

    return () => {
      document.removeEventListener("pointerdown", close);
    };
  }, []);

  return (
    <div
      ref={rootRef}
      className="relative"
    >
      <button
        type="button"
        aria-label="Səs ayarları"
        aria-expanded={open}
        onClick={() => {
          setOpen((value) => !value);
        }}
        className="flex h-10 w-10 touch-manipulation items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.025] text-white/40 transition active:scale-95 hover:border-white/[0.12] hover:bg-white/[0.055] hover:text-white/70"
      >
        {muted || volume === 0 ? (
          <VolumeX className="h-4 w-4" />
        ) : (
          <Volume2 className="h-4 w-4" />
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-[100] pt-2">
          <div className="w-48 rounded-[16px] border border-white/[0.09] bg-[#0b0b0e]/95 p-3.5 shadow-2xl backdrop-blur-xl">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-white/30">
                Səs
              </span>

              <span className="text-[9px] tabular-nums text-white/30">
                {Math.round(volume * 100)}%
              </span>
            </div>

            <input
              aria-label="Səs səviyyəsi"
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={volume}
              onChange={(event) => {
                setVolume(Number(event.target.value));
              }}
              className="mt-3 h-6 w-full cursor-pointer touch-manipulation accent-cyan-100"
            />

            <button
              type="button"
              onClick={() => {
                toggleMuted();
              }}
              className="mt-2 flex h-9 w-full touch-manipulation items-center justify-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.035] text-[10px] font-medium text-white/50 transition active:scale-[0.98] hover:bg-white/[0.06] hover:text-white/80"
            >
              {muted ? (
                <>
                  <Volume2 className="h-3.5 w-3.5" />
                  Səsi aç
                </>
              ) : (
                <>
                  <VolumeX className="h-3.5 w-3.5" />
                  Səsi söndür
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
