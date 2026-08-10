"use client";

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
    play,
  } = useOctosonAudio();

  return (
    <div className="group relative">
      <button
        type="button"
        aria-label={
          muted ? "Səsi aç" : "Səsi söndür"
        }
        onClick={() => {
          toggleMuted();

          if (muted) {
            setTimeout(() => play("click"), 0);
          }
        }}
        className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.025] text-white/35 transition hover:border-white/[0.12] hover:bg-white/[0.055] hover:text-white/70"
      >
        {muted || volume === 0 ? (
          <VolumeX className="h-4 w-4" />
        ) : (
          <Volume2 className="h-4 w-4" />
        )}
      </button>

      <div className="pointer-events-none absolute right-0 top-full z-[100] pt-2 opacity-0 transition group-hover:pointer-events-auto group-hover:opacity-100">
        <div className="w-44 rounded-[14px] border border-white/[0.08] bg-[#0b0b0e]/95 p-3 shadow-2xl backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-medium uppercase tracking-[0.12em] text-white/25">
              Səs
            </span>

            <span className="text-[9px] text-white/25">
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
              setVolume(
                Number(event.target.value)
              );
            }}
            className="mt-3 w-full accent-cyan-100"
          />
        </div>
      </div>
    </div>
  );
}
