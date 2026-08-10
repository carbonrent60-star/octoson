"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type SoundName =
  | "hover"
  | "click"
  | "navigate"
  | "bet"
  | "coin"
  | "dice"
  | "roulette"
  | "wheel"
  | "card"
  | "tick"
  | "gem"
  | "mine"
  | "cashout"
  | "win"
  | "bigwin"
  | "lose"
  | "error";

type AudioContextValue = {
  muted: boolean;
  volume: number;
  setMuted: (value: boolean) => void;
  toggleMuted: () => void;
  setVolume: (value: number) => void;
  play: (sound: SoundName) => void;
};

const AudioContext = createContext<AudioContextValue | null>(
  null
);

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function OctosonAudioProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [muted, setMutedState] = useState(false);
  const [volume, setVolumeState] = useState(0.34);

  const contextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    try {
      setMutedState(
        localStorage.getItem("octoson-muted") === "1"
      );

      const saved = Number(
        localStorage.getItem("octoson-volume")
      );

      if (Number.isFinite(saved)) {
        setVolumeState(clamp(saved, 0, 1));
      }
    } catch {}
  }, []);

  const getContext = useCallback(() => {
    if (typeof window === "undefined") {
      return null;
    }

    if (!contextRef.current) {
      const AudioCtor =
        window.AudioContext ||
        (
          window as typeof window & {
            webkitAudioContext?: typeof AudioContext;
          }
        ).webkitAudioContext;

      if (!AudioCtor) {
        return null;
      }

      contextRef.current = new AudioCtor();
    }

    const context = contextRef.current;

    if (context.state === "suspended") {
      void context.resume();
    }

    return context;
  }, []);

  /*
   * Browsers can suspend WebAudio after navigation, tab changes,
   * sleep/wake or before the first real user gesture.
   *
   * pointerdown fires BEFORE click handlers, so the context has
   * time to resume before casino sounds are scheduled.
   */
  useEffect(() => {
    const unlockAudio = () => {
      const context =
        getContext();

      if (
        context &&
        context.state ===
          "suspended"
      ) {
        void context
          .resume()
          .catch(() => {});
      }
    };

    const resumeWhenVisible = () => {
      if (
        document.visibilityState ===
        "visible"
      ) {
        unlockAudio();
      }
    };

    window.addEventListener(
      "pointerdown",
      unlockAudio,
      { passive: true }
    );

    window.addEventListener(
      "touchstart",
      unlockAudio,
      { passive: true }
    );

    window.addEventListener(
      "keydown",
      unlockAudio
    );

    window.addEventListener(
      "focus",
      unlockAudio
    );

    document.addEventListener(
      "visibilitychange",
      resumeWhenVisible
    );

    return () => {
      window.removeEventListener(
        "pointerdown",
        unlockAudio
      );

      window.removeEventListener(
        "touchstart",
        unlockAudio
      );

      window.removeEventListener(
        "keydown",
        unlockAudio
      );

      window.removeEventListener(
        "focus",
        unlockAudio
      );

      document.removeEventListener(
        "visibilitychange",
        resumeWhenVisible
      );
    };
  }, [getContext]);

  const tone = useCallback(
    (
      context: AudioContext,
      frequency: number,
      duration: number,
      gainAmount: number,
      type: OscillatorType = "sine",
      delay = 0,
      endFrequency?: number
    ) => {
      const start = context.currentTime + delay;

      const oscillator = context.createOscillator();
      const gain = context.createGain();

      oscillator.type = type;
      oscillator.frequency.setValueAtTime(
        frequency,
        start
      );

      if (endFrequency) {
        oscillator.frequency.exponentialRampToValueAtTime(
          Math.max(20, endFrequency),
          start + duration
        );
      }

      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(
        Math.max(
          0.0001,
          gainAmount * Math.min(2.35, 0.12 + volume * 2.15)
        ),
        start + 0.008
      );
      gain.gain.exponentialRampToValueAtTime(
        0.0001,
        start + duration
      );

      oscillator.connect(gain);
      gain.connect(context.destination);

      oscillator.start(start);
      oscillator.stop(start + duration + 0.02);
    },
    [volume]
  );

  const noise = useCallback(
    (
      context: AudioContext,
      duration: number,
      gainAmount: number,
      delay = 0
    ) => {
      const sampleRate = context.sampleRate;
      const buffer = context.createBuffer(
        1,
        Math.max(
          1,
          Math.floor(sampleRate * duration)
        ),
        sampleRate
      );

      const data = buffer.getChannelData(0);

      for (let i = 0; i < data.length; i += 1) {
        data[i] =
          (Math.random() * 2 - 1) *
          (1 - i / data.length);
      }

      const source = context.createBufferSource();
      const filter = context.createBiquadFilter();
      const gain = context.createGain();

      source.buffer = buffer;

      filter.type = "highpass";
      filter.frequency.value = 700;

      const start = context.currentTime + delay;

      gain.gain.setValueAtTime(
        Math.max(
          0.0001,
          gainAmount * Math.min(2.35, 0.12 + volume * 2.15)
        ),
        start
      );

      gain.gain.exponentialRampToValueAtTime(
        0.0001,
        start + duration
      );

      source.connect(filter);
      filter.connect(gain);
      gain.connect(context.destination);

      source.start(start);
    },
    [volume]
  );

  const play = useCallback(
    (sound: SoundName) => {
      if (muted || volume <= 0) {
        return;
      }

      const context = getContext();

      if (!context) {
        return;
      }

      switch (sound) {
        case "hover":
          tone(context, 720, 0.035, 0.014, "sine");
          break;

        case "click":
          tone(context, 430, 0.055, 0.038, "sine");
          tone(
            context,
            680,
            0.04,
            0.025,
            "sine",
            0.012
          );
          break;

        case "navigate":
          tone(context, 330, 0.07, 0.035, "sine");
          tone(
            context,
            520,
            0.09,
            0.03,
            "sine",
            0.035
          );
          break;

        case "bet":
          tone(
            context,
            190,
            0.08,
            0.085,
            "triangle",
            0,
            280
          );
          break;

        case "coin":
          tone(context, 1450, 0.06, 0.095, "sine");
          tone(
            context,
            1900,
            0.08,
            0.045,
            "sine",
            0.045
          );
          break;

        case "dice":
          noise(context, 0.05, 0.07);
          noise(context, 0.05, 0.055, 0.065);
          noise(context, 0.04, 0.045, 0.13);
          break;

        case "roulette":
          for (let i = 0; i < 7; i += 1) {
            tone(
              context,
              620 + i * 25,
              0.025,
              0.025,
              "square",
              i * 0.055
            );
          }
          break;

        case "wheel":
          for (let i = 0; i < 8; i += 1) {
            tone(
              context,
              480 + i * 18,
              0.025,
              0.022,
              "square",
              i * 0.045
            );
          }
          break;

        case "card":
          noise(context, 0.09, 0.045);
          tone(
            context,
            260,
            0.07,
            0.025,
            "triangle"
          );
          break;

        case "tick":
          tone(context, 900, 0.025, 0.042, "sine");
          break;

        case "gem":
          tone(context, 880, 0.08, 0.085, "sine");
          tone(
            context,
            1320,
            0.12,
            0.04,
            "sine",
            0.04
          );
          break;

        case "mine":
          noise(context, 0.32, 0.18);
          tone(
            context,
            120,
            0.38,
            0.19,
            "sawtooth",
            0,
            45
          );
          break;

        case "cashout":
          tone(
            context,
            440,
            0.09,
            0.09,
            "sine"
          );
          tone(
            context,
            660,
            0.11,
            0.09,
            "sine",
            0.055
          );
          tone(
            context,
            880,
            0.18,
            0.10,
            "sine",
            0.11
          );
          break;

        case "win":
          tone(context, 523, 0.13, 0.10, "sine");
          tone(
            context,
            659,
            0.15,
            0.10,
            "sine",
            0.07
          );
          tone(
            context,
            784,
            0.22,
            0.11,
            "sine",
            0.14
          );
          break;

        case "bigwin":
          tone(context, 392, 0.14, 0.11, "sine");
          tone(
            context,
            523,
            0.16,
            0.11,
            "sine",
            0.07
          );
          tone(
            context,
            659,
            0.20,
            0.12,
            "sine",
            0.14
          );
          tone(
            context,
            1047,
            0.38,
            0.12,
            "sine",
            0.22
          );
          break;

        case "lose":
          // Heavy low loss impact. Intentionally louder than UI sounds.
          noise(context, 0.12, 0.085);

          tone(
            context,
            310,
            0.18,
            0.12,
            "triangle",
            0,
            190
          );

          tone(
            context,
            190,
            0.26,
            0.14,
            "sawtooth",
            0.055,
            78
          );

          tone(
            context,
            105,
            0.32,
            0.13,
            "sine",
            0.09,
            52
          );
          break;

        case "error":
          tone(
            context,
            180,
            0.11,
            0.10,
            "square"
          );
          tone(
            context,
            145,
            0.14,
            0.08,
            "square",
            0.08
          );
          break;
      }
    },
    [getContext, muted, tone, noise, volume]
  );

  const setMuted = useCallback((value: boolean) => {
    setMutedState(value);

    try {
      localStorage.setItem(
        "octoson-muted",
        value ? "1" : "0"
      );
    } catch {}
  }, []);

  const toggleMuted = useCallback(() => {
    setMutedState((current) => {
      const next = !current;

      try {
        localStorage.setItem(
          "octoson-muted",
          next ? "1" : "0"
        );
      } catch {}

      return next;
    });
  }, []);

  const setVolume = useCallback((value: number) => {
    const next = clamp(value, 0, 1);

    setVolumeState(next);

    try {
      localStorage.setItem(
        "octoson-volume",
        String(next)
      );
    } catch {}
  }, []);

  const value = useMemo(
    () => ({
      muted,
      volume,
      setMuted,
      toggleMuted,
      setVolume,
      play,
    }),
    [
      muted,
      volume,
      setMuted,
      toggleMuted,
      setVolume,
      play,
    ]
  );

  return (
    <AudioContext.Provider value={value}>
      {children}
    </AudioContext.Provider>
  );
}

export function useOctosonAudio() {
  const value = useContext(AudioContext);

  if (!value) {
    throw new Error(
      "useOctosonAudio must be used inside OctosonAudioProvider"
    );
  }

  return value;
}
