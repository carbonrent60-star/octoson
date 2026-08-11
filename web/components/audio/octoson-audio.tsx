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

export type SoundName =
  | "hover"
  | "click"
  | "softClick"
  | "navigate"
  | "open"
  | "close"
  | "toggle"
  | "success"
  | "notification"
  | "deposit"
  | "withdraw"
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
  ready: boolean;
  setMuted: (value: boolean) => void;
  toggleMuted: () => void;
  setVolume: (value: number) => void;
  play: (sound: SoundName) => void;
};

const OctosonAudioContext =
  createContext<AudioContextValue | null>(null);

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function volumeScale(volume: number) {
  return Math.min(1.45, 0.16 + volume * 1.5);
}

export function OctosonAudioProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  /*
   * Sound is ON by default.
   *
   * If a user explicitly mutes it, that preference is remembered.
   */
  const [muted, setMutedState] = useState(false);
  const [volume, setVolumeState] = useState(0.42);
  const [ready, setReady] = useState(false);

  const contextRef = useRef<AudioContext | null>(null);

  const mutedRef = useRef(false);
  const volumeRef = useRef(0.42);

  const lastPlayedRef = useRef<
    Partial<Record<SoundName, number>>
  >({});

  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  useEffect(() => {
    volumeRef.current = volume;
  }, [volume]);

  useEffect(() => {
    try {
      const savedMuted =
        localStorage.getItem("octoson-muted");

      if (savedMuted === "1") {
        setMutedState(true);
        mutedRef.current = true;
      } else {
        /*
         * No saved preference = sound enabled.
         */
        setMutedState(false);
        mutedRef.current = false;
      }

      const savedVolume =
        localStorage.getItem("octoson-volume");

      if (savedVolume !== null) {
        const parsed = Number(savedVolume);

        if (Number.isFinite(parsed)) {
          const next = clamp(parsed, 0, 1);

          setVolumeState(next);
          volumeRef.current = next;
        }
      }
    } catch {}
  }, []);

  const getContext = useCallback(() => {
    if (typeof window === "undefined") {
      return null;
    }

    let context = contextRef.current;

    if (!context || context.state === "closed") {
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

      context = new AudioCtor({
        latencyHint: "interactive",
      });

      contextRef.current = context;
    }

    return context;
  }, []);

  const unlock = useCallback(async () => {
    const context = getContext();

    if (!context) {
      return false;
    }

    try {
      if (context.state === "suspended") {
        await context.resume();
      }

      if (context.state === "running") {
        setReady(true);
        return true;
      }
    } catch {}

    return false;
  }, [getContext]);

  /*
   * Safari / Chrome / mobile browsers require a user gesture.
   *
   * We resume on pointer, touch and keyboard interactions and again
   * whenever the page becomes visible or focused.
   */
  useEffect(() => {
    const unlockFromGesture = () => {
      void unlock();
    };

    const resumeVisible = () => {
      if (document.visibilityState === "visible") {
        void unlock();
      }
    };

    window.addEventListener(
      "pointerdown",
      unlockFromGesture,
      { passive: true }
    );

    window.addEventListener(
      "touchstart",
      unlockFromGesture,
      { passive: true }
    );

    window.addEventListener(
      "keydown",
      unlockFromGesture
    );

    window.addEventListener(
      "focus",
      unlockFromGesture
    );

    window.addEventListener(
      "pageshow",
      unlockFromGesture
    );

    document.addEventListener(
      "visibilitychange",
      resumeVisible
    );

    return () => {
      window.removeEventListener(
        "pointerdown",
        unlockFromGesture
      );

      window.removeEventListener(
        "touchstart",
        unlockFromGesture
      );

      window.removeEventListener(
        "keydown",
        unlockFromGesture
      );

      window.removeEventListener(
        "focus",
        unlockFromGesture
      );

      window.removeEventListener(
        "pageshow",
        unlockFromGesture
      );

      document.removeEventListener(
        "visibilitychange",
        resumeVisible
      );
    };
  }, [unlock]);

  const makeGain = useCallback(
    (
      context: AudioContext,
      amount: number,
      start: number,
      duration: number
    ) => {
      const gain = context.createGain();

      const scaled =
        Math.max(
          0.0001,
          amount * volumeScale(volumeRef.current)
        );

      gain.gain.setValueAtTime(0.0001, start);

      gain.gain.exponentialRampToValueAtTime(
        scaled,
        start + Math.min(0.008, duration * 0.2)
      );

      gain.gain.exponentialRampToValueAtTime(
        0.0001,
        start + duration
      );

      gain.connect(context.destination);

      return gain;
    },
    []
  );

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
      const start =
        context.currentTime + delay;

      const oscillator =
        context.createOscillator();

      const gain = makeGain(
        context,
        gainAmount,
        start,
        duration
      );

      oscillator.type = type;

      oscillator.frequency.setValueAtTime(
        Math.max(20, frequency),
        start
      );

      if (endFrequency) {
        oscillator.frequency.exponentialRampToValueAtTime(
          Math.max(20, endFrequency),
          start + duration
        );
      }

      oscillator.connect(gain);

      oscillator.start(start);
      oscillator.stop(start + duration + 0.03);
    },
    [makeGain]
  );

  const noise = useCallback(
    (
      context: AudioContext,
      duration: number,
      gainAmount: number,
      delay = 0,
      highpass = 700
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
        const fade =
          1 - i / Math.max(1, data.length);

        data[i] =
          (Math.random() * 2 - 1) *
          fade *
          fade;
      }

      const source =
        context.createBufferSource();

      const filter =
        context.createBiquadFilter();

      const start =
        context.currentTime + delay;

      const gain = makeGain(
        context,
        gainAmount,
        start,
        duration
      );

      source.buffer = buffer;

      filter.type = "highpass";
      filter.frequency.setValueAtTime(
        highpass,
        start
      );

      source.connect(filter);
      filter.connect(gain);

      source.start(start);
      source.stop(start + duration + 0.02);
    },
    [makeGain]
  );

  const playNow = useCallback(
    (
      context: AudioContext,
      sound: SoundName
    ) => {
      switch (sound) {
        /*
         * UI
         */

        case "hover":
          tone(
            context,
            1050,
            0.026,
            0.012,
            "sine"
          );
          break;

        case "softClick":
          noise(
            context,
            0.025,
            0.018,
            0,
            1800
          );

          tone(
            context,
            520,
            0.035,
            0.022,
            "sine"
          );
          break;

        case "click":
          noise(
            context,
            0.022,
            0.025,
            0,
            1500
          );

          tone(
            context,
            390,
            0.045,
            0.035,
            "triangle"
          );

          tone(
            context,
            760,
            0.035,
            0.021,
            "sine",
            0.012
          );
          break;

        case "toggle":
          tone(
            context,
            480,
            0.045,
            0.03,
            "sine"
          );

          tone(
            context,
            720,
            0.055,
            0.025,
            "sine",
            0.025
          );
          break;

        case "navigate":
          noise(
            context,
            0.035,
            0.012,
            0,
            2200
          );

          tone(
            context,
            310,
            0.055,
            0.03,
            "sine"
          );

          tone(
            context,
            490,
            0.065,
            0.028,
            "sine",
            0.025
          );

          tone(
            context,
            740,
            0.075,
            0.018,
            "sine",
            0.052
          );
          break;

        case "open":
          tone(
            context,
            390,
            0.055,
            0.025,
            "sine"
          );

          tone(
            context,
            610,
            0.075,
            0.025,
            "sine",
            0.025
          );
          break;

        case "close":
          tone(
            context,
            600,
            0.05,
            0.025,
            "sine"
          );

          tone(
            context,
            380,
            0.065,
            0.022,
            "sine",
            0.022
          );
          break;

        case "success":
          tone(
            context,
            620,
            0.08,
            0.05,
            "sine"
          );

          tone(
            context,
            930,
            0.12,
            0.045,
            "sine",
            0.055
          );

          tone(
            context,
            1240,
            0.17,
            0.026,
            "sine",
            0.11
          );
          break;

        case "notification":
          tone(
            context,
            880,
            0.085,
            0.038,
            "sine"
          );

          tone(
            context,
            1320,
            0.16,
            0.03,
            "sine",
            0.065
          );
          break;

        /*
         * Economy
         */

        case "deposit":
          noise(
            context,
            0.035,
            0.025,
            0,
            1700
          );

          tone(
            context,
            420,
            0.07,
            0.045,
            "triangle"
          );

          tone(
            context,
            660,
            0.085,
            0.04,
            "sine",
            0.045
          );

          tone(
            context,
            990,
            0.13,
            0.035,
            "sine",
            0.09
          );
          break;

        case "withdraw":
          tone(
            context,
            920,
            0.055,
            0.035,
            "sine"
          );

          tone(
            context,
            610,
            0.07,
            0.035,
            "sine",
            0.04
          );

          tone(
            context,
            390,
            0.1,
            0.03,
            "triangle",
            0.08
          );
          break;

        case "bet":
          noise(
            context,
            0.035,
            0.025,
            0,
            1100
          );

          tone(
            context,
            180,
            0.075,
            0.07,
            "triangle",
            0,
            285
          );
          break;

        case "coin":
          tone(
            context,
            1420,
            0.05,
            0.065,
            "sine"
          );

          tone(
            context,
            1980,
            0.085,
            0.04,
            "sine",
            0.035
          );

          tone(
            context,
            2450,
            0.07,
            0.02,
            "sine",
            0.07
          );
          break;

        /*
         * Games
         */

        case "dice":
          noise(
            context,
            0.035,
            0.055,
            0,
            850
          );

          noise(
            context,
            0.035,
            0.045,
            0.055,
            900
          );

          noise(
            context,
            0.035,
            0.04,
            0.105,
            950
          );

          noise(
            context,
            0.03,
            0.035,
            0.15,
            1050
          );
          break;

        case "roulette":
          for (let i = 0; i < 9; i += 1) {
            tone(
              context,
              570 + i * 18,
              0.022,
              0.02,
              "square",
              i * 0.048
            );
          }
          break;

        case "wheel":
          for (let i = 0; i < 10; i += 1) {
            tone(
              context,
              470 + i * 14,
              0.022,
              0.018,
              "square",
              i * 0.041
            );
          }
          break;

        case "card":
          noise(
            context,
            0.075,
            0.035,
            0,
            1250
          );

          tone(
            context,
            245,
            0.055,
            0.018,
            "triangle"
          );
          break;

        case "tick":
          tone(
            context,
            980,
            0.018,
            0.032,
            "sine"
          );
          break;

        case "gem":
          tone(
            context,
            900,
            0.07,
            0.06,
            "sine"
          );

          tone(
            context,
            1370,
            0.11,
            0.038,
            "sine",
            0.035
          );

          tone(
            context,
            1840,
            0.14,
            0.022,
            "sine",
            0.075
          );
          break;

        case "mine":
          noise(
            context,
            0.28,
            0.13,
            0,
            80
          );

          tone(
            context,
            135,
            0.34,
            0.15,
            "sawtooth",
            0,
            48
          );

          tone(
            context,
            72,
            0.38,
            0.11,
            "sine",
            0.04,
            35
          );
          break;

        case "cashout":
          tone(
            context,
            410,
            0.075,
            0.065,
            "sine"
          );

          tone(
            context,
            620,
            0.09,
            0.065,
            "sine",
            0.045
          );

          tone(
            context,
            830,
            0.12,
            0.07,
            "sine",
            0.09
          );

          tone(
            context,
            1240,
            0.2,
            0.04,
            "sine",
            0.15
          );
          break;

        case "win":
          tone(
            context,
            523,
            0.11,
            0.075,
            "sine"
          );

          tone(
            context,
            659,
            0.13,
            0.075,
            "sine",
            0.065
          );

          tone(
            context,
            784,
            0.18,
            0.08,
            "sine",
            0.13
          );

          tone(
            context,
            1047,
            0.24,
            0.035,
            "sine",
            0.2
          );
          break;

        case "bigwin":
          noise(
            context,
            0.08,
            0.03,
            0.18,
            1600
          );

          tone(
            context,
            392,
            0.13,
            0.085,
            "sine"
          );

          tone(
            context,
            523,
            0.15,
            0.09,
            "sine",
            0.065
          );

          tone(
            context,
            659,
            0.18,
            0.09,
            "sine",
            0.13
          );

          tone(
            context,
            784,
            0.22,
            0.09,
            "sine",
            0.195
          );

          tone(
            context,
            1047,
            0.36,
            0.07,
            "sine",
            0.27
          );
          break;

        case "lose":
          noise(
            context,
            0.1,
            0.06,
            0,
            180
          );

          tone(
            context,
            300,
            0.16,
            0.09,
            "triangle",
            0,
            185
          );

          tone(
            context,
            180,
            0.24,
            0.1,
            "sawtooth",
            0.05,
            72
          );

          tone(
            context,
            92,
            0.3,
            0.085,
            "sine",
            0.085,
            45
          );
          break;

        case "error":
          noise(
            context,
            0.025,
            0.025,
            0,
            1200
          );

          tone(
            context,
            205,
            0.085,
            0.07,
            "square"
          );

          tone(
            context,
            155,
            0.11,
            0.055,
            "square",
            0.065
          );
          break;
      }
    },
    [noise, tone]
  );

  const play = useCallback(
    (sound: SoundName) => {
      if (
        mutedRef.current ||
        volumeRef.current <= 0
      ) {
        return;
      }

      /*
       * Prevent accidental audio machine-gunning.
       *
       * Tick/roulette/wheel/dice are intentionally exempt because
       * repeated events are part of those effects.
       */
      const cooldown =
        sound === "hover"
          ? 180
          : sound === "click" ||
              sound === "softClick"
            ? 28
            : 0;

      const now = performance.now();
      const last =
        lastPlayedRef.current[sound] ?? -Infinity;

      if (cooldown && now - last < cooldown) {
        return;
      }

      lastPlayedRef.current[sound] = now;

      const context = getContext();

      if (!context) {
        return;
      }

      if (context.state === "running") {
        playNow(context, sound);
        return;
      }

      /*
       * If WebAudio got suspended between interactions, resume it
       * and play immediately afterwards rather than dropping the SFX.
       */
      void context
        .resume()
        .then(() => {
          if (
            context.state === "running" &&
            !mutedRef.current
          ) {
            setReady(true);
            playNow(context, sound);
          }
        })
        .catch(() => {});
    },
    [getContext, playNow]
  );

  /*
   * Global UI sound layer.
   *
   * This gives normal buttons/links satisfying feedback without
   * adding play("click") manually to every component.
   */
  useEffect(() => {
    let lastHoverElement: Element | null = null;

    const onPointerOver = (event: PointerEvent) => {
      if (
        event.pointerType &&
        event.pointerType !== "mouse"
      ) {
        return;
      }

      const target =
        event.target instanceof Element
          ? event.target.closest(
              'button:not(:disabled), a[href], [role="button"]:not([aria-disabled="true"])'
            )
          : null;

      if (!target || target === lastHoverElement) {
        return;
      }

      /*
       * Entire sections can disable hover audio by placing:
       *
       * data-no-hover-sound="true"
       *
       * on themselves or any parent element.
       *
       * This is used by the sidebar/navbar so moving the mouse
       * across navigation items does not machine-gun hover SFX.
       */
      if (
        target.closest('[data-no-hover-sound="true"]')
      ) {
        lastHoverElement = target;
        return;
      }

      lastHoverElement = target;

      play("hover");
    };

    const onPointerOut = (event: PointerEvent) => {
      const target =
        event.target instanceof Element
          ? event.target.closest(
              'button, a[href], [role="button"]'
            )
          : null;

      if (
        target &&
        target === lastHoverElement
      ) {
        lastHoverElement = null;
      }
    };

    const onClick = (event: MouseEvent) => {
      const target =
        event.target instanceof Element
          ? event.target.closest(
              'button:not(:disabled), a[href], [role="button"]:not([aria-disabled="true"])'
            )
          : null;

      if (!target) {
        return;
      }

      /*
       * Components can opt out:
       * data-sound="none"
       *
       * Or choose an explicit sound:
       * data-sound="success"
       */
      const requested =
        target.getAttribute("data-sound");

      if (requested === "none") {
        return;
      }

      if (requested) {
        play(requested as SoundName);
        return;
      }

      if (
        target instanceof HTMLAnchorElement &&
        target.href
      ) {
        play("navigate");
        return;
      }

      play("click");
    };

    document.addEventListener(
      "pointerover",
      onPointerOver,
      true
    );

    document.addEventListener(
      "pointerout",
      onPointerOut,
      true
    );

    document.addEventListener(
      "click",
      onClick,
      true
    );

    return () => {
      document.removeEventListener(
        "pointerover",
        onPointerOver,
        true
      );

      document.removeEventListener(
        "pointerout",
        onPointerOut,
        true
      );

      document.removeEventListener(
        "click",
        onClick,
        true
      );
    };
  }, [play]);

  const setMuted = useCallback(
    (value: boolean) => {
      mutedRef.current = value;
      setMutedState(value);

      try {
        localStorage.setItem(
          "octoson-muted",
          value ? "1" : "0"
        );
      } catch {}

      if (!value) {
        void unlock();
      }
    },
    [unlock]
  );

  const toggleMuted = useCallback(() => {
    const next = !mutedRef.current;

    mutedRef.current = next;
    setMutedState(next);

    try {
      localStorage.setItem(
        "octoson-muted",
        next ? "1" : "0"
      );
    } catch {}

    if (!next) {
      void unlock();
    }
  }, [unlock]);

  const setVolume = useCallback(
    (value: number) => {
      const next = clamp(value, 0, 1);

      volumeRef.current = next;
      setVolumeState(next);

      try {
        localStorage.setItem(
          "octoson-volume",
          String(next)
        );
      } catch {}

      if (next > 0) {
        void unlock();
      }
    },
    [unlock]
  );

  const value = useMemo(
    () => ({
      muted,
      volume,
      ready,
      setMuted,
      toggleMuted,
      setVolume,
      play,
    }),
    [
      muted,
      volume,
      ready,
      setMuted,
      toggleMuted,
      setVolume,
      play,
    ]
  );

  return (
    <OctosonAudioContext.Provider value={value}>
      {children}
    </OctosonAudioContext.Provider>
  );
}

export function useOctosonAudio() {
  const value = useContext(
    OctosonAudioContext
  );

  if (!value) {
    throw new Error(
      "useOctosonAudio must be used inside OctosonAudioProvider"
    );
  }

  return value;
}
