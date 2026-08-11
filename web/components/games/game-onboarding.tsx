"use client";

import {
  ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  ArrowLeft,
  ArrowRight,
  CircleDot,
  Gamepad2,
  MousePointer2,
  Timer,
  Trophy,
  Zap,
} from "lucide-react";

type Game =
  | "reaction"
  | "connect4"
  | "blackjack";

type Props = {
  game: Game;
  matchId: string;
  matchCreatedAt: string;
  children: ReactNode;
};

type Step = {
  eyebrow: string;
  title: string;
  description: string;
  visual: ReactNode;
  duration?: number;
};

function MiniConnectBoard({
  stage,
}: {
  stage: number;
}) {
  const cells = Array.from(
    { length: 42 },
    (_, index) => index
  );

  const cyan =
    stage >= 1
      ? [38, 31, 24, 17]
      : [];

  const violet =
    stage >= 2
      ? [39, 32, 25]
      : [];

  return (
    <div
      className="mx-auto flex w-full items-center justify-center"
      style={{
        minHeight: "276px",
      }}
    >
      <div
        className="rounded-[22px] border border-cyan-100/[0.1] bg-cyan-100/[0.04] p-3 shadow-[0_30px_100px_rgba(0,0,0,0.35)]"
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(7, 34px)",
          gridAutoRows: "34px",
          gap: "6px",
          width: "fit-content",
          maxWidth: "100%",
          flexShrink: 0,
        }}
      >
        {cells.map((index) => {
          const isCyan =
            cyan.includes(index);

          const isViolet =
            violet.includes(index);

          return (
            <div
              key={index}
              className="relative shrink-0 overflow-hidden rounded-full border border-white/[0.07] bg-black/40 p-[4px]"
              style={{
                width: "34px",
                height: "34px",
                minWidth: "34px",
                minHeight: "34px",
                maxWidth: "34px",
                maxHeight: "34px",
              }}
            >
              <div
                className={`h-full w-full rounded-full transition-all duration-500 ${
                  isCyan
                    ? "scale-100 bg-cyan-200 shadow-[0_0_22px_rgba(165,243,252,0.22)]"
                    : isViolet
                      ? "scale-100 bg-violet-300 shadow-[0_0_22px_rgba(196,181,253,0.18)]"
                      : "scale-75 bg-white/[0.035]"
                }`}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ReactionVisual({
  stage,
}: {
  stage: number;
}) {
  const go = stage >= 1;

  return (
    <div className="relative mx-auto flex h-[220px] w-full max-w-[360px] items-center justify-center">
      <div
        className={`absolute h-44 w-44 rounded-full blur-[70px] transition-all duration-500 ${
          go
            ? "bg-emerald-300/10"
            : "bg-red-300/[0.06]"
        }`}
      />

      <div
        className={`relative flex h-32 w-32 items-center justify-center rounded-[38px] border transition-all duration-500 ${
          go
            ? "scale-105 border-emerald-200/20 bg-emerald-200/[0.08]"
            : "border-red-200/10 bg-red-200/[0.035]"
        }`}
      >
        {go ? (
          <Zap className="h-12 w-12 text-emerald-100" />
        ) : (
          <div className="relative">
            <div className="absolute inset-0 animate-ping rounded-full bg-red-200/15" />
            <div className="relative h-5 w-5 rounded-full bg-red-200/70" />
          </div>
        )}
      </div>

      <p
        className={`absolute bottom-0 text-xl font-bold tracking-[-0.04em] transition ${
          go
            ? "text-emerald-100"
            : "text-white/60"
        }`}
      >
        {go ? "İNDİ BAS" : "GÖZLƏ"}
      </p>
    </div>
  );
}

function BlackjackVisual() {
  return (
    <div className="relative mx-auto h-[220px] w-full max-w-[360px]">
      <div className="absolute left-1/2 top-1/2 h-[155px] w-[105px] -translate-x-[72%] -translate-y-1/2 -rotate-6 rounded-[18px] border border-white/10 bg-white/[0.07] p-4 shadow-2xl">
        <p className="text-2xl font-bold text-white/80">
          A
        </p>
        <p className="mt-12 text-center text-4xl">
          ♠
        </p>
      </div>

      <div className="absolute left-1/2 top-1/2 h-[155px] w-[105px] -translate-x-[25%] -translate-y-[46%] rotate-6 rounded-[18px] border border-cyan-100/10 bg-[#11151a] p-4 shadow-2xl">
        <p className="text-2xl font-bold text-cyan-100/80">
          K
        </p>
        <p className="mt-12 text-center text-4xl text-cyan-100/70">
          ♣
        </p>
      </div>
    </div>
  );
}

export default function GameOnboarding({
  game,
  matchId,
  matchCreatedAt,
  children,
}: Props) {
  const [visible, setVisible] =
    useState(true);

  const [step, setStep] =
    useState(0);

  const steps = useMemo<Step[]>(() => {
    if (game === "connect4") {
      return [
        {
          eyebrow: "CONNECT 4 · 01",
          title: "Sütunu seç",
          description:
            "Növbən gələndə istədiyin sütuna bas. Daş həmin sütundakı ən aşağı boş xanaya düşəcək.",
          visual: (
            <MiniConnectBoard
              stage={0}
            />
          ),
          duration: 3300,
        },
        {
          eyebrow: "CONNECT 4 · 02",
          title: "Daşları birləşdir",
          description:
            "Sən və rəqib növbə ilə oynayırsınız. Rəqibin xəttini blokla və öz kombinasiyanı qur.",
          visual: (
            <MiniConnectBoard
              stage={1}
            />
          ),
          duration: 3500,
        },
        {
          eyebrow: "CONNECT 4 · 03",
          title: "Dörd daş = qələbə",
          description:
            "Üfüqi, şaquli və ya diaqonal formada 4 daşını ardıcıl birləşdirən ilk oyunçu qalibdir.",
          visual: (
            <MiniConnectBoard
              stage={2}
            />
          ),
          duration: 3900,
        },
      ];
    }

    if (game === "reaction") {
      return [
        {
          eyebrow: "REACTION · 01",
          title: "Siqnalı gözlə",
          description:
            "Ekran hazır vəziyyətdə olarkən basma. Erkən bassan false start sayılır.",
          visual: (
            <ReactionVisual
              stage={0}
            />
          ),
          duration: 3000,
        },
        {
          eyebrow: "REACTION · 02",
          title: "Yaşıl olan kimi bas",
          description:
            "Siqnal dəyişən kimi mümkün qədər tez bas. Vaxtın millisaniyə ilə ölçülür.",
          visual: (
            <ReactionVisual
              stage={1}
            />
          ),
          duration: 3200,
        },
        {
          eyebrow: "REACTION · 03",
          title: "Ən sürətli qalibdir",
          description:
            "False start etməyən oyunçular arasında ən aşağı reaction time raundu qazanır.",
          visual: (
            <div className="mx-auto flex h-[220px] max-w-[360px] items-center justify-center">
              <div className="text-center">
                <Trophy className="mx-auto h-12 w-12 text-amber-200/70" />
                <p className="mt-5 font-mono text-4xl font-bold tracking-[-0.06em] text-cyan-100">
                  184 ms
                </p>
                <p className="mt-2 text-[10px] uppercase tracking-[0.2em] text-white/25">
                  fastest reaction
                </p>
              </div>
            </div>
          ),
          duration: 3400,
        },
      ];
    }

    return [
      {
        eyebrow: "BLACKJACK · 01",
        title: "21-ə yaxınlaş",
        description:
          "Məqsəd 21-i keçmədən dealer-dən daha güclü əl toplamaqdır.",
        visual: <BlackjackVisual />,
        duration: 3500,
      },
      {
        eyebrow: "BLACKJACK · 02",
        title: "Hit və ya Stand",
        description:
          "Hit yeni kart götürür. Stand isə mövcud əlinlə qalır və növbəni tamamlayır.",
        visual: (
          <div className="mx-auto flex h-[220px] max-w-[360px] items-center justify-center gap-3">
            <div className="rounded-[18px] border border-cyan-100/10 bg-cyan-100/[0.04] px-8 py-6 text-center">
              <MousePointer2 className="mx-auto h-7 w-7 text-cyan-100/60" />
              <p className="mt-3 text-sm font-semibold">
                HIT
              </p>
            </div>

            <div className="rounded-[18px] border border-white/[0.07] bg-white/[0.025] px-8 py-6 text-center">
              <Timer className="mx-auto h-7 w-7 text-white/40" />
              <p className="mt-3 text-sm font-semibold">
                STAND
              </p>
            </div>
          </div>
        ),
        duration: 3500,
      },
      {
        eyebrow: "BLACKJACK · 03",
        title: "21-i keçmə",
        description:
          "21-dən yuxarı çıxmaq bust deməkdir. Əlini düzgün zamanda saxla.",
        visual: (
          <div className="mx-auto flex h-[220px] max-w-[360px] items-center justify-center">
            <div className="text-center">
              <p className="font-mono text-6xl font-bold tracking-[-0.08em] text-cyan-100">
                21
              </p>
              <p className="mt-3 text-[10px] uppercase tracking-[0.2em] text-white/25">
                perfect hand
              </p>
            </div>
          </div>
        ),
        duration: 3700,
      },
    ];
  }, [game]);

  const tutorialDuration = useMemo(
    () =>
      steps.reduce(
        (total, item) =>
          total +
          Number(
            item.duration ?? 3500
          ),
        0
      ),
    [steps]
  );

  useEffect(() => {
    const started = Date.parse(matchCreatedAt);

    if (!Number.isFinite(started)) {
      console.error(
        "[GAME ONBOARDING] Invalid matchCreatedAt:",
        matchCreatedAt
      );
      setVisible(false);
      return;
    }

    const finishAt = started + tutorialDuration;

    const syncFromMatchClock = () => {
      const now = Date.now();
      const elapsed = Math.max(0, now - started);

      if (now >= finishAt) {
        setStep(steps.length - 1);
        setVisible(false);
        return;
      }

      setVisible(true);

      let accumulated = 0;
      let nextStep = 0;

      for (let index = 0; index < steps.length; index += 1) {
        accumulated += Number(
          steps[index]?.duration ?? 3500
        );

        if (elapsed < accumulated) {
          nextStep = index;
          break;
        }

        nextStep = Math.min(
          index + 1,
          steps.length - 1
        );
      }

      setStep(nextStep);
    };

    syncFromMatchClock();

    const timer = window.setInterval(
      syncFromMatchClock,
      100
    );

    return () => {
      window.clearInterval(timer);
    };
  }, [
    matchCreatedAt,
    tutorialDuration,
    steps,
    matchId,
  ]);

  function next() {
    if (step >= steps.length - 1) {
      setVisible(false);
      return;
    }

    setStep((current) =>
      Math.min(
        steps.length - 1,
        current + 1
      )
    );
  }

  function previous() {
    setStep((current) =>
      Math.max(
        0,
        current - 1
      )
    );
  }

  if (!visible) {
    return <>{children}</>;
  }

  const current =
    steps[step];

  return (
    <section className="relative isolate min-h-[560px] overflow-hidden rounded-[28px] border border-white/[0.07] bg-[#09090c] shadow-2xl shadow-black/25">
      <div className="pointer-events-none absolute left-1/2 top-[-220px] h-[430px] w-[650px] -translate-x-1/2 rounded-full bg-cyan-300/[0.055] blur-[130px]" />

      <div className="relative flex min-h-[560px] flex-col">
        <div className="flex items-center justify-between border-b border-white/[0.055] px-5 py-4 md:px-7">
          <div className="flex items-center gap-2">
            <Gamepad2 className="h-3.5 w-3.5 text-cyan-100/45" />

            <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-cyan-100/40">
              Necə oynanır
            </span>
          </div>

          <button
            type="button"
            onClick={() => {
                          setVisible(false);
              }}
            className="text-[9px] font-medium text-white/25 transition hover:text-white/60"
          >
            Keç
          </button>
        </div>

        <div className="flex flex-1 flex-col items-center justify-center px-6 py-9 text-center md:px-10">
          <div
            key={`${game}-${step}`}
            className="w-full animate-[fadeIn_.35s_ease]"
          >
            {current.visual}

            <p className="mt-8 text-[9px] font-semibold uppercase tracking-[0.22em] text-cyan-100/35">
              {current.eyebrow}
            </p>

            <h2 className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-white/90">
              {current.title}
            </h2>

            <p className="mx-auto mt-3 max-w-md text-[11px] leading-6 text-white/30">
              {current.description}
            </p>
          </div>
        </div>

        <div className="border-t border-white/[0.055] px-5 py-4 md:px-7">
          <div className="mb-4 flex justify-center gap-1.5">
            {steps.map(
              (_, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => {
                      setStep(index);
                  }}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    index === step
                      ? "w-7 bg-cyan-100/70"
                      : index < step
                        ? "w-3 bg-cyan-100/25"
                        : "w-3 bg-white/10"
                  }`}
                  aria-label={`Addım ${
                    index + 1
                  }`}
                />
              )
            )}
          </div>

          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              disabled={step === 0}
              onClick={previous}
              className="flex h-10 items-center gap-2 rounded-[11px] border border-white/[0.065] bg-white/[0.025] px-4 text-[9px] font-semibold text-white/45 transition hover:bg-white/[0.05] disabled:pointer-events-none disabled:opacity-20"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Əvvəlki
            </button>

            <div className="hidden items-center gap-2 text-[8px] uppercase tracking-[0.15em] text-white/15 sm:flex">
              <CircleDot className="h-3 w-3" />
              {step + 1} / {steps.length}
            </div>

            <button
              type="button"
              onClick={next}
              className="flex h-10 items-center gap-2 rounded-[11px] bg-cyan-100 px-5 text-[9px] font-semibold text-black transition hover:bg-white"
            >
              {step ===
              steps.length - 1
                ? "Oyuna başla"
                : "Növbəti"}

              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
