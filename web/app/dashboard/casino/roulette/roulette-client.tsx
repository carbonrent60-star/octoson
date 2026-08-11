"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ChevronLeft,
  CircleDollarSign,
  RotateCcw,
  Trash2,
  Undo2,
  Wallet,
} from "lucide-react";

import { playCasinoAction } from "../actions";
import { useOctosonAudio } from "@/components/audio/octoson-audio";
import { haptic } from "@/lib/haptics";

type Bet = {
  id: string;
  kind: "number" | "color" | "parity" | "half" | "dozen" | "column";
  value: string;
  label: string;
  amount: number;
};

type Phase = "idle" | "spinning" | "settling" | "result";

type RouletteColor = "red" | "black" | "green";

type RouletteResult = {
  n: number;
  color: RouletteColor;
  colorLabel: string;
  message: string;
  wager: number;
  payout: number;
  net: number;
  balanceBefore: number;
  balanceAfter: number;
};

const WHEEL_ORDER = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24,
  16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
];

const RED = new Set([
  1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36,
]);

const TABLE_NUMBERS = [
  [3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36],
  [2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35],
  [1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34],
];

const CHIPS = [
  { value: 100, label: "100" },
  { value: 500, label: "500" },
  { value: 1000, label: "1K" },
  { value: 5000, label: "5K" },
  { value: 10000, label: "10K" },
];

function fmt(value: number) {
  return Math.floor(value).toLocaleString("en-US");
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function colorOf(number: number): RouletteColor {
  if (number === 0) return "green";
  return RED.has(number) ? "red" : "black";
}

function colorLabel(color: RouletteColor) {
  if (color === "red") return "QIRMIZI";
  if (color === "green") return "YAŞIL";
  return "QARA";
}

export default function RouletteClient({
  initialBalance,
}: {
  initialBalance: number;
}) {
  const audio = useOctosonAudio();

  const [balance, setBalance] = useState(initialBalance);

  const [chip, setChip] = useState(500);
  const [bets, setBets] = useState<Bet[]>([]);
  const [phase, setPhase] = useState<Phase>("idle");

  const [result, setResult] = useState<RouletteResult | null>(null);

  const [history, setHistory] = useState<number[]>([]);

  const [pending, startTransition] = useTransition();

  const wheelRef = useRef<HTMLDivElement>(null);

  const ballRef = useRef<HTMLDivElement>(null);

  const wheelRotation = useRef(0);
  const ballRotation = useRef(0);

  const total = useMemo(
    () => bets.reduce((sum, bet) => sum + bet.amount, 0),
    [bets],
  );

  const amountAt = (kind: Bet["kind"], value: string) =>
    bets
      .filter((bet) => bet.kind === kind && bet.value === value)
      .reduce((sum, bet) => sum + bet.amount, 0);

  function addBet(kind: Bet["kind"], value: string, label: string) {
    if (phase !== "idle") return;
    if (total + chip > balance) {
      audio.play("error");
      haptic("error");
      return;
    }

    audio.play("softClick");
    haptic("light");

    setBets((current) => [
      ...current,
      {
        id: crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
        kind,
        value,
        label,
        amount: chip,
      },
    ]);
  }

  function undo() {
    if (phase !== "idle") return;

    setBets((current) => current.slice(0, -1));

    audio.play("softClick");
    haptic("light");
  }

  function clear() {
    if (phase !== "idle") return;

    setBets([]);
    audio.play("softClick");
    haptic("light");
  }

  async function animateToNumber(number: number) {
    const wheel = wheelRef.current;
    const ballTrack = ballRef.current;

    if (!wheel || !ballTrack) {
      return;
    }

    const ball = ballTrack.querySelector<HTMLElement>(".octo-roulette-ball");

    if (!ball) {
      return;
    }

    const index = WHEEL_ORDER.indexOf(number);

    if (index < 0) {
      return;
    }

    const segment = 360 / WHEEL_ORDER.length;

    /*
     * Wheel pocket angle is measured from 12 o'clock.
     *
     * The ball element itself starts on the right side
     * of its rotational arm, so subtract 90 degrees to
     * convert wheel-space to ball-space.
     */
    const pocketLocalAngle = index * segment + segment / 2;

    const targetRelativeBase = pocketLocalAngle - 90;

    /*
     * Measure the actual rendered wheel so the ball
     * track scales correctly on desktop and mobile.
     */
    const wheelContainer = ballTrack.parentElement;

    const containerSize = wheelContainer?.getBoundingClientRect().width ?? 340;

    const outerRadius = Math.min(120, Math.max(86, containerSize * 0.348));

    /*
     * Final ball radius.
     *
     * Keep the ball visually centered inside the colored
     * numbered pocket band instead of pulling it onto the
     * inner wooden bowl.
     */
    const pocketRadius = outerRadius * 0.91;

    /*
     * Continuous physics state.
     *
     * wheelAngle:
     *   absolute wheel rotation
     *
     * relativeAngle:
     *   ball angle relative to the rotating wheel
     *
     * This is important because once the ball enters a
     * pocket, it should naturally travel WITH the wheel
     * rather than appearing detached from it.
     */
    let wheelAngle = wheelRotation.current;

    let relativeAngle = ballRotation.current - wheelAngle;

    /*
     * Initial angular velocities in degrees / second.
     *
     * The ball moves against the wheel and much faster
     * than the wheel, like a real roulette launch.
     */
    let wheelVelocity = 172 + Math.random() * 22;

    let relativeVelocity = -(820 + Math.random() * 105);

    let radius = outerRadius;

    let targetRelative: number | null = null;

    let settlingStarted = false;
    let pocketCaptureStarted = false;

    let lastFrame = performance.now();

    const startedAt = lastFrame;

    let lastTickAt = 0;
    let previousPocket = -1;

    audio.play("roulette");

    /*
     * We control every rendered frame ourselves.
     * No CSS transform transitions are allowed to fight
     * against the physics loop.
     */
    wheel.style.transition = "none";
    ballTrack.style.transition = "none";
    ball.style.transition = "none";

    ball.style.willChange = "right, transform";

    wheel.style.willChange = "transform";

    ballTrack.style.willChange = "transform";

    /*
     * Smoothstep gives a natural radial fall without a
     * visible step between "orbit" and "pocket".
     */
    const smoothstep = (edge0: number, edge1: number, value: number) => {
      const x = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)));

      return x * x * (3 - 2 * x);
    };

    /*
     * Returns the equivalent copy of the target angle
     * that lies ahead of the ball in its current
     * counter-clockwise direction.
     *
     * Angles can exceed +/-360 intentionally. That keeps
     * motion continuous between rounds.
     */
    const targetBelow = (current: number, targetBase: number) => {
      let target = targetBase + 360 * Math.floor((current - targetBase) / 360);

      /*
       * Always leave some real travel before capture,
       * otherwise a result near the current position
       * could appear to lock immediately.
       */
      if (target > current - 38) {
        target -= 360;
      }

      return target;
    };

    await new Promise<void>((resolve) => {
      const frame = (now: number) => {
        /*
         * Clamp dt so a temporary browser stall does
         * not create a huge physics jump.
         */
        const dt = Math.min(0.032, Math.max(0.001, (now - lastFrame) / 1000));

        lastFrame = now;

        const elapsed = now - startedAt;

        /*
         * -----------------------------
         * WHEEL PHYSICS
         * -----------------------------
         *
         * Early:
         * wheel coasts smoothly.
         *
         * Late:
         * bearing/friction drag becomes stronger.
         */
        const wheelDrag = elapsed < 3600 ? 0.145 : elapsed < 5100 ? 0.34 : 1.18;

        wheelVelocity *= Math.exp(-wheelDrag * dt);

        wheelAngle += wheelVelocity * dt;

        /*
         * -----------------------------
         * BALL ORBIT PHYSICS
         * -----------------------------
         */
        if (elapsed < 3150) {
          /*
           * Fast outer-race orbit.
           *
           * Very light drag lets it retain energy
           * instead of visibly slowing immediately.
           */
          relativeVelocity *= Math.exp(-0.17 * dt);
        } else if (elapsed < 4700) {
          /*
           * Ball begins losing enough energy to move
           * from the outer race toward the deflectors.
           */
          relativeVelocity *= Math.exp(-0.76 * dt);

          /*
           * Tiny continuous perturbations mimic contact
           * with diamond deflectors without producing a
           * fake left/right animation.
           */
          relativeVelocity += Math.sin(elapsed * 0.019) * 14 * dt;

          relativeVelocity += Math.sin(elapsed * 0.033 + 1.7) * 7 * dt;

          if (!settlingStarted) {
            settlingStarted = true;

            setPhase("settling");

            haptic("light");
          }
        } else {
          /*
           * -----------------------------
           * POCKET CAPTURE
           * -----------------------------
           *
           * Instead of forcing 2-3 separate rotations,
           * we use a damped angular spring.
           *
           * The ball therefore curves naturally into
           * the server-selected pocket and loses its
           * relative velocity continuously.
           */
          if (targetRelative === null) {
            targetRelative = targetBelow(relativeAngle, targetRelativeBase);

            pocketCaptureStarted = true;

            audio.play("tick");
            haptic("light");
          }

          const error = targetRelative - relativeAngle;

          /*
           * Near-critical spring.
           *
           * High enough stiffness to capture the
           * correct pocket, strong damping to prevent
           * the ugly multiple bounce / teleport effect.
           */
          const stiffness = 13.8;

          const damping = 7.45;

          const acceleration = stiffness * error - damping * relativeVelocity;

          relativeVelocity += acceleration * dt;

          /*
           * Once nearly seated, reduce any microscopic
           * residual movement even further.
           */
          if (Math.abs(error) < segment * 0.42) {
            relativeVelocity *= Math.exp(-2.2 * dt);
          }
        }

        relativeAngle += relativeVelocity * dt;

        /*
         * -----------------------------
         * RADIAL BALL PHYSICS
         * -----------------------------
         *
         * The radius changes continuously on EVERY
         * frame. There is no .classList "drop" jump.
         */
        const radialProgress = smoothstep(3000, 5350, elapsed);

        radius = outerRadius + (pocketRadius - outerRadius) * radialProgress;

        /*
         * Extremely subtle vertical/radial vibration
         * while crossing deflectors.
         *
         * It fades before final capture.
         */
        const deflectorEnergy =
          elapsed >= 3200 && elapsed < 5000
            ? 1 - smoothstep(3200, 5000, elapsed)
            : 0;

        const radialJitter = Math.sin(elapsed * 0.028) * 1.45 * deflectorEnergy;

        const ballWorldAngle = wheelAngle + relativeAngle;

        /*
         * -----------------------------
         * AUDIO TICKS
         * -----------------------------
         *
         * During the slower part of the orbit, make a
         * tick when the ball crosses a pocket boundary.
         *
         * Rate-limited so it sounds mechanical rather
         * than like a machine gun.
         */
        if (elapsed > 3000 && elapsed < 5600) {
          const normalized = (((relativeAngle + 90) % 360) + 360) % 360;

          const pocket = Math.floor(normalized / segment);

          if (pocket !== previousPocket && now - lastTickAt > 72) {
            previousPocket = pocket;

            lastTickAt = now;

            audio.play("tick");
          }
        }

        /*
         * Render.
         */
        wheel.style.transform = `rotate(${wheelAngle}deg)`;

        ballTrack.style.transform = `rotate(${ballWorldAngle}deg)`;

        ball.style.right = `${-radius}px`;

        ball.style.transform = `translateY(${radialJitter}px)`;

        /*
         * -----------------------------
         * NATURAL END CONDITION
         * -----------------------------
         *
         * End only once the ball is genuinely nearly
         * stationary relative to its winning pocket.
         */
        if (targetRelative !== null && elapsed > 5600) {
          const finalError = targetRelative - relativeAngle;

          const settled =
            Math.abs(finalError) < 0.16 &&
            Math.abs(relativeVelocity) < 0.85 &&
            radialProgress > 0.995;

          const hardLimit = elapsed > 7600;

          if (settled || hardLimit) {
            /*
             * This final correction is sub-pixel /
             * sub-degree by normal completion, so the
             * user never sees a snap.
             */
            relativeAngle = targetRelative;

            radius = pocketRadius;

            const finalBallAngle = wheelAngle + relativeAngle;

            wheel.style.transform = `rotate(${wheelAngle}deg)`;

            ballTrack.style.transform = `rotate(${finalBallAngle}deg)`;

            ball.style.right = `${-radius}px`;

            ball.style.transform = "translateY(0px)";

            wheelRotation.current = wheelAngle;

            ballRotation.current = finalBallAngle;

            /*
             * Store the final rendered transforms.
             */
            wheel.style.willChange = "auto";

            ballTrack.style.willChange = "auto";

            ball.style.willChange = "auto";

            if (pocketCaptureStarted) {
              audio.play("tick");
            }

            resolve();
            return;
          }
        }

        requestAnimationFrame(frame);
      };

      requestAnimationFrame(frame);
    });
  }

  function spin() {
    if (pending || phase !== "idle" || total <= 0) {
      return;
    }

    if (total > balance) {
      audio.play("error");
      haptic("error");
      return;
    }

    const balanceBefore = balance;
    const wager = total;

    startTransition(async () => {
      setResult(null);
      setPhase("spinning");

      audio.play("bet");
      haptic("medium");

      /*
       * Visually reserve the wager immediately.
       */
      setBalance((current) => Math.max(0, current - wager));

      ballRef.current?.classList.remove("octo-roulette-ball-drop");

      /*
       * IMPORTANT:
       *
       * We do NOT animate here.
       *
       * Previously this section rotated the wheel
       * +520deg and the ball -900deg while waiting
       * for the server. Then animateToNumber()
       * started another full spin.
       *
       * That was the double-spin bug.
       */
      const response = await playCasinoAction({
        game: "roulette",
        bet: wager,
        rouletteBets: bets.map(({ kind, value, amount }) => ({
          kind,
          value,
          amount,
        })),
      });

      if (!response.ok) {
        setBalance(balanceBefore);
        setPhase("idle");

        audio.play("error");
        haptic("error");

        return;
      }

      const serverBalance = Number(response.balance);

      if (response.balance == null || !Number.isFinite(serverBalance)) {
        setBalance(balanceBefore);
        setPhase("idle");

        audio.play("error");
        haptic("error");

        return;
      }

      const match = response.description?.match(
        /Düşdü:\s*(Qırmızı|Qara|Yaşıl)\s+(\d+)/,
      );

      const number = Number(match?.[2]);

      if (!Number.isInteger(number) || number < 0 || number > 36) {
        setBalance(serverBalance);
        setPhase("idle");

        audio.play("error");
        haptic("error");

        return;
      }

      /*
       * Server has decided the result.
       * Now perform exactly ONE cinematic spin
       * that lands on that result.
       */
      await animateToNumber(number);

      const color = colorOf(number);

      const payout = Math.max(0, Number(response.payout ?? 0));

      /*
       * Prefer the authoritative server net.
       * Fallback is payout - wager.
       */
      const serverNet = Number(response.net);

      const net = Number.isFinite(serverNet) ? serverNet : payout - wager;

      setBalance(serverBalance);

      setResult({
        n: number,
        color,
        colorLabel: colorLabel(color),
        message: response.message,
        wager,
        payout,
        net,
        balanceBefore,
        balanceAfter: serverBalance,
      });

      setHistory((current) => [number, ...current].slice(0, 8));

      setBets([]);
      setPhase("result");

      if (net > 0) {
        audio.play("win");
        haptic("success");
      } else if (net < 0) {
        audio.play("lose");
        haptic("heavy");
      } else {
        audio.play("softClick");
        haptic("light");
      }

      /*
       * Keep the result visible long enough to
       * understand the financial outcome.
       */
      await sleep(3200);

      setPhase("idle");
    });
  }

  return (
    <div className="mx-auto w-full max-w-[1380px] pb-4 text-white">
      <style>{`
        .octo-roulette-ball-track {
          left: 50%;
          top: 50%;
          width: 14px;
          height: 14px;
          margin-left: -7px;
          margin-top: -7px;
          transform-origin: 7px 7px;
        }

        .octo-roulette-ball-track::before {
          content: "";
          position: absolute;
          left: 50%;
          top: 50%;
          width: min(12vw, 118px);
          height: 1px;
          transform: translateY(-50%);
          transform-origin: left center;
        }

        .octo-roulette-ball {
          position: absolute;
          right: calc(min(12vw, 118px) * -1);
          top: -7px;
          transition:
            right .52s cubic-bezier(.2,.8,.2,1),
            transform .22s ease;
        }

        .octo-roulette-ball-drop
          .octo-roulette-ball {
          right: calc(min(9.6vw, 94px) * -1);
        }

        @media (max-width: 767px) {
          .octo-roulette-ball {
            right: -103px;
          }

          .octo-roulette-ball-drop
            .octo-roulette-ball {
            right: -82px;
          }
        }
      `}</style>

      <div className="mb-5 flex items-center justify-between gap-4">
        <a
          href="/dashboard/casino"
          data-sound="none"
          className="flex items-center gap-2 text-[11px] text-white/30 transition hover:text-white/65"
        >
          <ChevronLeft className="h-4 w-4" />
          Casino
        </a>

        <div className="flex items-center gap-2 rounded-full border border-white/[0.07] bg-white/[0.025] px-3.5 py-2.5">
          <Wallet className="h-3.5 w-3.5 text-cyan-100/45" />

          <span className="text-[9px] text-white/25">Wallet</span>

          <b className="text-[11px] text-white/80">{fmt(balance)} Aura</b>
        </div>
      </div>

      <div className="mb-6">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-cyan-200 shadow-[0_0_12px_rgba(165,243,252,.55)]" />

          <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-cyan-100/45">
            Octoson Roulette
          </p>
        </div>

        <h1 className="mt-2 text-[32px] font-semibold tracking-[-0.05em] text-white sm:text-[40px]">
          European Roulette
        </h1>

        <p className="mt-2 max-w-xl text-[12px] leading-6 text-white/28">
          Chip seç, istədiyin sahələrə mərc yerləşdir və çarxı fırlat.
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-[390px_minmax(0,1fr)]">
        {/* WHEEL PANEL */}
        <section
          className={`
            relative overflow-hidden rounded-[28px]
            border border-white/[0.07]
            bg-[#090b0e]
            p-4 sm:p-5
            ${phase === "idle" ? "order-2 xl:order-1" : "order-1"}
          `}
        >
          <div className="pointer-events-none absolute left-1/2 top-[-130px] h-[300px] w-[300px] -translate-x-1/2 rounded-full bg-cyan-200/[0.045] blur-[100px]" />

          <div className="relative flex items-center justify-between">
            <div>
              <p className="text-[8px] font-semibold uppercase tracking-[0.2em] text-white/20">
                Live wheel
              </p>

              <p className="mt-1 text-[15px] font-semibold text-white/70">
                European 0–36
              </p>
            </div>

            <div className="flex items-center gap-1.5">
              {history.map((number, index) => (
                <div
                  key={`${number}-${index}`}
                  className={`
                      flex h-7 w-7 items-center justify-center rounded-full
                      border text-[9px] font-bold
                      ${
                        number === 0
                          ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-100/75"
                          : RED.has(number)
                            ? "border-rose-300/15 bg-rose-500/10 text-rose-100/70"
                            : "border-white/[0.07] bg-black/40 text-white/55"
                      }
                    `}
                >
                  {number}
                </div>
              ))}
            </div>
          </div>

          <div className="relative mx-auto mt-5 aspect-square w-full max-w-[340px]">
            <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_50%_42%,rgba(255,255,255,.035),transparent_45%)] shadow-[0_35px_90px_rgba(0,0,0,.65)]" />

            <div className="absolute inset-[2%] rounded-full border border-white/[0.09] bg-[#07090b] shadow-[inset_0_0_0_9px_#12171b,inset_0_0_45px_rgba(0,0,0,.9)]" />

            <div className="absolute inset-[8%] rounded-full border border-[#d2d6d4]/10 bg-[radial-gradient(circle_at_50%_35%,#3a2b21,#241812_38%,#0a0a0a_72%)] shadow-[inset_0_15px_35px_rgba(255,255,255,.025),inset_0_-24px_40px_rgba(0,0,0,.8)]" />

            <div
              ref={wheelRef}
              className="absolute inset-[13%] rounded-full will-change-transform"
            >
              <div
                className="absolute inset-0 rounded-full"
                style={{
                  background: `conic-gradient(${WHEEL_ORDER.map(
                    (number, index) => {
                      const start = index * (360 / WHEEL_ORDER.length);

                      const end = (index + 1) * (360 / WHEEL_ORDER.length);

                      const color =
                        number === 0
                          ? "#1e7c5b"
                          : RED.has(number)
                            ? "#b51f35"
                            : "#171b1e";

                      return `${color} ${start}deg ${end}deg`;
                    },
                  ).join(",")})`,
                }}
              />

              <div className="absolute inset-[13%] rounded-full border border-[#c8a87f]/20 bg-[radial-gradient(circle_at_50%_35%,#3b2a1e,#1b120e_50%,#08090a_76%)] shadow-[inset_0_15px_26px_rgba(255,255,255,.025),inset_0_-22px_35px_rgba(0,0,0,.8)]" />

              <div className="absolute inset-[31%] rounded-full border border-[#ceb089]/20 bg-[radial-gradient(circle_at_50%_35%,#4b3726,#1d150f_62%,#08090a)] shadow-[0_8px_30px_rgba(0,0,0,.75)]" />

              <div className="absolute inset-[43%] rounded-full border border-white/[0.08] bg-[#0c1012] shadow-[inset_0_5px_10px_rgba(255,255,255,.025)]" />

              {WHEEL_ORDER.map((number, index) => {
                const angle = index * (360 / WHEEL_ORDER.length);

                return (
                  <div
                    key={`wheel-${number}`}
                    className="absolute left-1/2 top-1/2 z-10 h-[48%] w-px origin-top"
                    style={{
                      transform: `rotate(${angle}deg)`,
                    }}
                  >
                    <span
                      className="absolute -left-[8px] top-[5px] flex w-4 justify-center text-[7px] font-bold text-white/85"
                      style={{
                        transform: `rotate(${-angle}deg)`,
                      }}
                    >
                      {number}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="absolute left-1/2 top-[2%] z-40 -translate-x-1/2">
              <div className="h-0 w-0 border-x-[8px] border-t-[13px] border-x-transparent border-t-cyan-100/90 drop-shadow-[0_0_7px_rgba(207,250,254,.5)]" />
            </div>

            <div
              ref={ballRef}
              className="octo-roulette-ball-track absolute left-1/2 top-1/2 z-50"
            >
              <div className="octo-roulette-ball h-[13px] w-[13px] rounded-full border border-white/90 bg-[radial-gradient(circle_at_30%_25%,white,#dfe6e4_38%,#7a8584_78%,#202525)] shadow-[0_0_7px_rgba(255,255,255,.75),0_5px_10px_rgba(0,0,0,.7)]" />
            </div>

            <div className="pointer-events-none absolute left-1/2 top-1/2 z-50 flex h-[84px] w-[84px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/[0.07] bg-[#0a0d0f]/95 shadow-[0_14px_30px_rgba(0,0,0,.6)]">
              <div className="text-center">
                <p className="text-[7px] font-semibold uppercase tracking-[0.18em] text-white/18">
                  {phase === "spinning"
                    ? "Spinning"
                    : phase === "settling"
                      ? "Landing"
                      : "Result"}
                </p>

                <p className="mt-1 text-[27px] font-semibold tracking-[-0.06em] text-white">
                  {result?.n != null && result.n >= 0 ? result.n : "—"}
                </p>
              </div>
            </div>

            <AnimatePresence>
              {phase === "result" && result && (
                <motion.div
                  initial={{
                    opacity: 0,
                    scale: 0.7,
                    y: 10,
                  }}
                  animate={{
                    opacity: 1,
                    scale: 1,
                    y: 0,
                  }}
                  exit={{
                    opacity: 0,
                    scale: 0.9,
                  }}
                  transition={{
                    type: "spring",
                    stiffness: 420,
                    damping: 26,
                  }}
                  className={`
                      absolute left-1/2 top-1/2 z-[70]
                      -translate-x-1/2 -translate-y-1/2
                      rounded-[22px] border px-6 py-4 text-center
                      backdrop-blur-xl
                      ${
                        result.color === "red"
                          ? "border-rose-300/30 bg-rose-500/80"
                          : result.color === "green"
                            ? "border-emerald-300/30 bg-emerald-500/75"
                            : "border-white/15 bg-[#101214]/90"
                      }
                    `}
                >
                  <p className="text-[8px] font-bold uppercase tracking-[0.18em] text-white/65">
                    {result.colorLabel}
                  </p>

                  <p className="text-[52px] font-black leading-none text-white">
                    {result.n}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <AnimatePresence mode="wait">
            {result && (
              <motion.div
                key={`${result.n}-${result.balanceAfter}`}
                initial={{
                  opacity: 0,
                  y: 8,
                  scale: 0.985,
                }}
                animate={{
                  opacity: 1,
                  y: 0,
                  scale: 1,
                }}
                exit={{
                  opacity: 0,
                  y: -5,
                }}
                className={`
                  relative mt-5 overflow-hidden
                  rounded-[20px] border p-4
                  ${
                    result.net > 0
                      ? "border-emerald-300/15 bg-emerald-300/[0.045]"
                      : result.net < 0
                        ? "border-rose-300/15 bg-rose-300/[0.04]"
                        : "border-white/[0.07] bg-white/[0.02]"
                  }
                `}
              >
                <div
                  className={`
                    pointer-events-none absolute
                    -right-12 -top-16 h-36 w-36
                    rounded-full blur-[55px]
                    ${
                      result.net > 0
                        ? "bg-emerald-300/10"
                        : result.net < 0
                          ? "bg-rose-300/10"
                          : "bg-white/[0.03]"
                    }
                  `}
                />

                <div className="relative flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[8px] font-semibold uppercase tracking-[0.18em] text-white/25">
                      Round result
                    </p>

                    <div className="mt-1.5 flex items-baseline gap-2">
                      <p
                        className={`
                          text-[26px] font-semibold
                          tracking-[-0.05em]
                          ${
                            result.net > 0
                              ? "text-emerald-200"
                              : result.net < 0
                                ? "text-rose-200"
                                : "text-white/75"
                          }
                        `}
                      >
                        {result.net > 0 ? "+" : result.net < 0 ? "−" : ""}
                        {fmt(Math.abs(result.net))}
                      </p>

                      <span className="text-[9px] font-semibold text-white/25">
                        AURA
                      </span>
                    </div>

                    <p
                      className={`
                        mt-1 text-[10px] font-medium
                        ${
                          result.net > 0
                            ? "text-emerald-200/55"
                            : result.net < 0
                              ? "text-rose-200/55"
                              : "text-white/35"
                        }
                      `}
                    >
                      {result.net > 0
                        ? "Xalis qazanc"
                        : result.net < 0
                          ? "Xalis itki"
                          : "Bərabər nəticə"}
                    </p>
                  </div>

                  <div className="rounded-[13px] border border-white/[0.06] bg-black/20 px-3 py-2 text-right">
                    <p className="text-[7px] uppercase tracking-[0.14em] text-white/20">
                      Landed
                    </p>

                    <p className="mt-0.5 text-[13px] font-bold text-white/70">
                      {result.colorLabel} {result.n}
                    </p>
                  </div>
                </div>

                <div className="relative mt-4 grid grid-cols-3 gap-2">
                  <div className="rounded-[13px] border border-white/[0.05] bg-black/15 p-2.5">
                    <p className="text-[7px] uppercase tracking-[0.12em] text-white/18">
                      Mərc
                    </p>

                    <p className="mt-1 text-[11px] font-semibold text-white/60">
                      −{fmt(result.wager)}
                    </p>
                  </div>

                  <div className="rounded-[13px] border border-white/[0.05] bg-black/15 p-2.5">
                    <p className="text-[7px] uppercase tracking-[0.12em] text-white/18">
                      Ödəniş
                    </p>

                    <p className="mt-1 text-[11px] font-semibold text-white/60">
                      +{fmt(result.payout)}
                    </p>
                  </div>

                  <div className="rounded-[13px] border border-white/[0.05] bg-black/15 p-2.5">
                    <p className="text-[7px] uppercase tracking-[0.12em] text-white/18">
                      Balans
                    </p>

                    <p className="mt-1 text-[11px] font-semibold text-cyan-100/65">
                      {fmt(result.balanceAfter)}
                    </p>
                  </div>
                </div>

                <div className="relative mt-3 flex items-center justify-between border-t border-white/[0.05] pt-3">
                  <span className="text-[8px] text-white/20">
                    {fmt(result.balanceBefore)} → {fmt(result.balanceAfter)}{" "}
                    Aura
                  </span>

                  <span
                    className={`
                      rounded-full border px-2.5 py-1
                      text-[7px] font-bold uppercase
                      tracking-[0.12em]
                      ${
                        result.net > 0
                          ? "border-emerald-300/15 bg-emerald-300/[0.06] text-emerald-200/70"
                          : result.net < 0
                            ? "border-rose-300/15 bg-rose-300/[0.06] text-rose-200/70"
                            : "border-white/[0.07] bg-white/[0.025] text-white/35"
                      }
                    `}
                  >
                    {result.net > 0 ? "WIN" : result.net < 0 ? "LOSS" : "PUSH"}
                  </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="relative mt-3 rounded-[17px] border border-white/[0.055] bg-white/[0.018] p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[8px] uppercase tracking-[0.15em] text-white/18">
                  Status
                </p>

                <p className="mt-1 text-[11px] font-medium text-white/55">
                  {phase === "spinning"
                    ? "Çarx fırlanır"
                    : phase === "settling"
                      ? "Top ciblərə düşür"
                      : result
                        ? `${result.colorLabel} ${result.n}`
                        : "Mərc gözlənilir"}
                </p>
              </div>

              <span className="rounded-full border border-white/[0.06] bg-black/20 px-3 py-1.5 text-[8px] font-medium text-white/25">
                36:1 max
              </span>
            </div>
          </div>
        </section>

        {/* TABLE */}
        <section className="order-1 overflow-hidden rounded-[28px] border border-white/[0.07] bg-[#090b0e] xl:order-2">
          <div className="flex items-center justify-between border-b border-white/[0.055] px-4 py-4 sm:px-5">
            <div>
              <p className="text-[8px] font-semibold uppercase tracking-[0.19em] text-cyan-100/35">
                Betting table
              </p>

              <h2 className="mt-1 text-[15px] font-semibold text-white/70">
                Mərc masası
              </h2>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                data-sound="none"
                disabled={phase !== "idle" || bets.length === 0}
                onClick={undo}
                className="flex h-9 w-9 items-center justify-center rounded-[11px] border border-white/[0.06] bg-white/[0.025] text-white/30 transition active:scale-95 disabled:opacity-20"
              >
                <Undo2 className="h-4 w-4" />
              </button>

              <button
                type="button"
                data-sound="none"
                disabled={phase !== "idle" || bets.length === 0}
                onClick={clear}
                className="flex h-9 w-9 items-center justify-center rounded-[11px] border border-white/[0.06] bg-white/[0.025] text-white/30 transition active:scale-95 disabled:opacity-20"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="p-3 sm:p-5">
            <div className="overflow-x-auto pb-2">
              <div className="min-w-[760px]">
                <div className="grid grid-cols-[64px_repeat(12,minmax(48px,1fr))_64px] gap-[3px] rounded-[20px] border border-white/[0.055] bg-[#06100d] p-[4px] shadow-[inset_0_0_45px_rgba(0,0,0,.35)]">
                  <BetCell
                    amount={amountAt("number", "0")}
                    disabled={phase !== "idle"}
                    onClick={() => addBet("number", "0", "0")}
                    className="row-span-3 h-full bg-emerald-700/65 text-[22px]"
                  >
                    0
                  </BetCell>

                  {TABLE_NUMBERS[0].map((number) => (
                    <NumberCell
                      key={number}
                      number={number}
                      amount={amountAt("number", String(number))}
                      disabled={phase !== "idle"}
                      onClick={() =>
                        addBet("number", String(number), String(number))
                      }
                    />
                  ))}

                  <BetCell
                    amount={amountAt("column", "3")}
                    disabled={phase !== "idle"}
                    onClick={() => addBet("column", "3", "2:1")}
                    className="text-[10px]"
                  >
                    2:1
                  </BetCell>

                  {TABLE_NUMBERS[1].map((number) => (
                    <NumberCell
                      key={number}
                      number={number}
                      amount={amountAt("number", String(number))}
                      disabled={phase !== "idle"}
                      onClick={() =>
                        addBet("number", String(number), String(number))
                      }
                    />
                  ))}

                  <BetCell
                    amount={amountAt("column", "2")}
                    disabled={phase !== "idle"}
                    onClick={() => addBet("column", "2", "2:1")}
                    className="text-[10px]"
                  >
                    2:1
                  </BetCell>

                  {TABLE_NUMBERS[2].map((number) => (
                    <NumberCell
                      key={number}
                      number={number}
                      amount={amountAt("number", String(number))}
                      disabled={phase !== "idle"}
                      onClick={() =>
                        addBet("number", String(number), String(number))
                      }
                    />
                  ))}

                  <BetCell
                    amount={amountAt("column", "1")}
                    disabled={phase !== "idle"}
                    onClick={() => addBet("column", "1", "2:1")}
                    className="text-[10px]"
                  >
                    2:1
                  </BetCell>

                  <div />

                  <BetCell
                    amount={amountAt("dozen", "1")}
                    disabled={phase !== "idle"}
                    onClick={() => addBet("dozen", "1", "1st 12")}
                    className="col-span-4"
                  >
                    1st 12
                  </BetCell>

                  <BetCell
                    amount={amountAt("dozen", "2")}
                    disabled={phase !== "idle"}
                    onClick={() => addBet("dozen", "2", "2nd 12")}
                    className="col-span-4"
                  >
                    2nd 12
                  </BetCell>

                  <BetCell
                    amount={amountAt("dozen", "3")}
                    disabled={phase !== "idle"}
                    onClick={() => addBet("dozen", "3", "3rd 12")}
                    className="col-span-4"
                  >
                    3rd 12
                  </BetCell>

                  <div />

                  <div />

                  <BetCell
                    amount={amountAt("half", "low")}
                    disabled={phase !== "idle"}
                    onClick={() => addBet("half", "low", "1–18")}
                    className="col-span-2"
                  >
                    1–18
                  </BetCell>

                  <BetCell
                    amount={amountAt("parity", "even")}
                    disabled={phase !== "idle"}
                    onClick={() => addBet("parity", "even", "EVEN")}
                    className="col-span-2"
                  >
                    EVEN
                  </BetCell>

                  <BetCell
                    amount={amountAt("color", "red")}
                    disabled={phase !== "idle"}
                    onClick={() => addBet("color", "red", "RED")}
                    className="col-span-2 bg-rose-700/65"
                  >
                    <span className="inline-block h-4 w-4 rotate-45 rounded-[3px] bg-rose-400/90" />
                  </BetCell>

                  <BetCell
                    amount={amountAt("color", "black")}
                    disabled={phase !== "idle"}
                    onClick={() => addBet("color", "black", "BLACK")}
                    className="col-span-2 bg-[#111416]"
                  >
                    <span className="inline-block h-4 w-4 rotate-45 rounded-[3px] border border-white/20 bg-black" />
                  </BetCell>

                  <BetCell
                    amount={amountAt("parity", "odd")}
                    disabled={phase !== "idle"}
                    onClick={() => addBet("parity", "odd", "ODD")}
                    className="col-span-2"
                  >
                    ODD
                  </BetCell>

                  <BetCell
                    amount={amountAt("half", "high")}
                    disabled={phase !== "idle"}
                    onClick={() => addBet("half", "high", "19–36")}
                    className="col-span-2"
                  >
                    19–36
                  </BetCell>
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-[20px] border border-white/[0.055] bg-white/[0.015] p-3 sm:p-4">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  {CHIPS.map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      data-sound="none"
                      disabled={phase !== "idle"}
                      onClick={() => {
                        setChip(item.value);
                        audio.play("softClick");
                        haptic("light");
                      }}
                      className={`
                        relative flex h-[52px] w-[52px] shrink-0
                        items-center justify-center rounded-full
                        border text-[10px] font-bold
                        transition duration-150 active:scale-95
                        ${
                          chip === item.value
                            ? "scale-[1.06] border-cyan-100/50 bg-cyan-100 text-[#071014] shadow-[0_0_28px_rgba(165,243,252,.18)]"
                            : "border-white/[0.09] bg-[#111417] text-white/45 hover:border-white/20 hover:text-white/70"
                        }
                      `}
                    >
                      <span
                        className={`
                          absolute inset-[5px] rounded-full border border-dashed
                          ${
                            chip === item.value
                              ? "border-black/20"
                              : "border-white/10"
                          }
                        `}
                      />

                      <span className="relative">{item.label}</span>
                    </button>
                  ))}
                </div>

                <div className="flex min-w-0 flex-1 items-center justify-between gap-4 border-t border-white/[0.05] pt-4 xl:border-l xl:border-t-0 xl:pl-5 xl:pt-0">
                  <div>
                    <p className="text-[8px] font-semibold uppercase tracking-[0.16em] text-white/18">
                      Total bet
                    </p>

                    <div className="mt-1 flex items-baseline gap-1.5">
                      <p className="text-[23px] font-semibold tracking-[-0.04em] text-white/80">
                        {fmt(total)}
                      </p>

                      <span className="text-[8px] font-semibold text-cyan-100/30">
                        AURA
                      </span>
                    </div>
                  </div>

                  <motion.button
                    whileTap={{
                      scale: 0.98,
                    }}
                    type="button"
                    data-sound="none"
                    disabled={!total || pending || phase !== "idle"}
                    onClick={spin}
                    className="flex h-[50px] min-w-[150px] items-center justify-center gap-2 rounded-[14px] bg-cyan-100 px-5 text-[11px] font-bold text-[#071014] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-20"
                  >
                    <RotateCcw
                      className={`h-4 w-4 ${
                        phase === "spinning" ? "animate-spin" : ""
                      }`}
                    />

                    {phase === "spinning"
                      ? "Fırlanır"
                      : phase === "settling"
                        ? "Dayanır"
                        : "Spin"}
                  </motion.button>
                </div>
              </div>
            </div>

            <div className="mt-3 flex items-center gap-2 px-1 text-[8px] text-white/15">
              <CircleDollarSign className="h-3.5 w-3.5" />
              Straight 36× · Outside bets 2× · Dozen / column 3×
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function NumberCell({
  number,
  amount,
  onClick,
  disabled,
}: {
  number: number;
  amount: number;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <BetCell
      amount={amount}
      onClick={onClick}
      disabled={disabled}
      className={RED.has(number) ? "bg-rose-700/75" : "bg-[#111416]"}
    >
      {number}
    </BetCell>
  );
}

function BetCell({
  children,
  amount,
  onClick,
  disabled,
  className = "",
}: {
  children: React.ReactNode;
  amount: number;
  onClick: () => void;
  disabled: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      data-sound="none"
      disabled={disabled}
      onClick={onClick}
      className={`
        group relative min-h-[48px] overflow-visible
        rounded-[7px] border border-white/[0.075]
        px-1.5 text-[11px] font-bold text-white/80
        transition duration-100
        hover:z-20 hover:border-cyan-100/30
        hover:brightness-110
        active:scale-[0.97]
        disabled:pointer-events-none
        ${className}
      `}
    >
      <span className="relative z-10">{children}</span>

      {amount > 0 && <ChipStack amount={amount} />}
    </button>
  );
}

function ChipStack({ amount }: { amount: number }) {
  return (
    <motion.div
      initial={{
        scale: 0.5,
        opacity: 0,
        y: 5,
      }}
      animate={{
        scale: 1,
        opacity: 1,
        y: 0,
      }}
      className="pointer-events-none absolute left-1/2 top-1/2 z-30 -translate-x-1/2 -translate-y-1/2"
    >
      <span className="absolute left-1/2 top-[5px] h-[25px] w-[25px] -translate-x-1/2 rounded-full border border-cyan-100/20 bg-cyan-950/90" />

      <span className="absolute left-1/2 top-[2px] h-[25px] w-[25px] -translate-x-1/2 rounded-full border border-cyan-100/20 bg-cyan-900/90" />

      <span className="relative flex h-[25px] min-w-[25px] items-center justify-center rounded-full border border-cyan-50/60 bg-cyan-100 px-1.5 text-[7px] font-black text-[#071014] shadow-[0_8px_16px_rgba(0,0,0,.45),0_0_14px_rgba(165,243,252,.16)]">
        {amount >= 1000 ? `${Math.floor(amount / 1000)}K` : amount}
      </span>
    </motion.div>
  );
}
