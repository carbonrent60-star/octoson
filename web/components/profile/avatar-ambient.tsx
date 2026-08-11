"use client";

import { useEffect, useState } from "react";

type RGB = {
  r: number;
  g: number;
  b: number;
};

type Props = {
  avatar: string;
};

const FALLBACK: RGB[] = [
  { r: 70, g: 120, b: 130 },
  { r: 45, g: 75, b: 90 },
  { r: 110, g: 120, b: 125 },
];

function rgb(color: RGB, alpha: number) {
  return `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`;
}

function distance(a: RGB, b: RGB) {
  return Math.sqrt(
    (a.r - b.r) ** 2 +
      (a.g - b.g) ** 2 +
      (a.b - b.b) ** 2
  );
}

function saturation(color: RGB) {
  const max = Math.max(color.r, color.g, color.b);
  const min = Math.min(color.r, color.g, color.b);

  if (max === 0) return 0;

  return (max - min) / max;
}

function brightness(color: RGB) {
  return (
    color.r * 0.299 +
    color.g * 0.587 +
    color.b * 0.114
  );
}

function prepareColor(color: RGB): RGB {
  /*
   * Keep avatar identity while preventing nearly-black
   * colors from disappearing into Octoson's background.
   */
  const floor = 32;

  return {
    r: Math.max(floor, color.r),
    g: Math.max(floor, color.g),
    b: Math.max(floor, color.b),
  };
}

export default function AvatarAmbient({
  avatar,
}: Props) {
  const [colors, setColors] =
    useState<RGB[]>(FALLBACK);

  useEffect(() => {
    let cancelled = false;

    const image = new Image();

    /*
     * Discord CDN supports CORS. If another avatar provider
     * doesn't, the component simply keeps its fallback.
     */
    image.crossOrigin = "anonymous";
    image.referrerPolicy = "no-referrer";

    image.onload = () => {
      try {
        const canvas =
          document.createElement("canvas");

        const size = 48;

        canvas.width = size;
        canvas.height = size;

        const context =
          canvas.getContext("2d", {
            willReadFrequently: true,
          });

        if (!context) return;

        context.drawImage(
          image,
          0,
          0,
          size,
          size
        );

        const data = context.getImageData(
          0,
          0,
          size,
          size
        ).data;

        /*
         * Quantize pixels into color buckets.
         * This is much more stable than simply averaging
         * the whole avatar into one muddy color.
         */
        const buckets = new Map<
          string,
          {
            color: RGB;
            count: number;
            score: number;
          }
        >();

        for (
          let index = 0;
          index < data.length;
          index += 4
        ) {
          const alpha = data[index + 3];

          if (alpha < 100) continue;

          const raw: RGB = {
            r: data[index],
            g: data[index + 1],
            b: data[index + 2],
          };

          const light = brightness(raw);

          /*
           * Ignore extreme pixels. Pure black/white often
           * comes from backgrounds, borders or highlights.
           */
          if (light < 12 || light > 248) {
            continue;
          }

          const step = 32;

          const quantized: RGB = {
            r:
              Math.round(raw.r / step) *
              step,
            g:
              Math.round(raw.g / step) *
              step,
            b:
              Math.round(raw.b / step) *
              step,
          };

          const key =
            `${quantized.r},${quantized.g},${quantized.b}`;

          const existing =
            buckets.get(key);

          const sat = saturation(raw);

          /*
           * Slightly prefer colored pixels while still
           * allowing monochrome avatars to produce
           * graphite/silver ambience.
           */
          const pixelScore =
            1 + sat * 1.8;

          if (existing) {
            existing.count += 1;
            existing.score += pixelScore;
          } else {
            buckets.set(key, {
              color: quantized,
              count: 1,
              score: pixelScore,
            });
          }
        }

        const candidates = [
          ...buckets.values(),
        ].sort(
          (a, b) =>
            b.score - a.score
        );

        const selected: RGB[] = [];

        for (const candidate of candidates) {
          const color =
            prepareColor(candidate.color);

          /*
           * Don't choose three almost identical shades.
           */
          if (
            selected.every(
              (existing) =>
                distance(
                  existing,
                  color
                ) > 48
            )
          ) {
            selected.push(color);
          }

          if (selected.length === 3) {
            break;
          }
        }

        /*
         * Monochrome avatars may naturally only have one
         * or two useful buckets. Build neighboring tones
         * instead of inserting random colors.
         */
        if (selected.length === 1) {
          const base = selected[0];

          selected.push({
            r: Math.min(
              255,
              base.r + 38
            ),
            g: Math.min(
              255,
              base.g + 38
            ),
            b: Math.min(
              255,
              base.b + 38
            ),
          });

          selected.push({
            r: Math.max(
              25,
              base.r - 24
            ),
            g: Math.max(
              25,
              base.g - 24
            ),
            b: Math.max(
              25,
              base.b - 24
            ),
          });
        }

        if (selected.length === 2) {
          const a = selected[0];
          const b = selected[1];

          selected.push({
            r: Math.round(
              (a.r + b.r) / 2
            ),
            g: Math.round(
              (a.g + b.g) / 2
            ),
            b: Math.round(
              (a.b + b.b) / 2
            ),
          });
        }

        if (
          !cancelled &&
          selected.length >= 3
        ) {
          setColors(
            selected.slice(0, 3)
          );
        }
      } catch {
        // CORS/Canvas failure -> keep fallback.
      }
    };

    image.onerror = () => {
      // Keep fallback.
    };

    image.src = avatar;

    return () => {
      cancelled = true;
    };
  }, [avatar]);

  const [a, b, c] = colors;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      {/*
       * BASE COLOR FIELD
       *
       * Actual avatar-derived colors. This stays relatively
       * stable while the light layers above it move slowly.
       */}
      <div
        className="absolute -inset-[12%] octoson-ambient-base"
        style={{
          background: `
            radial-gradient(
              ellipse 75% 150% at 5% 30%,
              ${rgb(a, 0.23)} 0%,
              ${rgb(a, 0.10)} 32%,
              transparent 68%
            ),
            radial-gradient(
              ellipse 70% 145% at 52% 0%,
              ${rgb(b, 0.16)} 0%,
              transparent 67%
            ),
            radial-gradient(
              ellipse 65% 145% at 100% 72%,
              ${rgb(c, 0.16)} 0%,
              transparent 72%
            )
          `,
        }}
      />

      {/*
       * LARGE AMBIENT BLOBS
       *
       * Very large + very blurred so they look like moving
       * environmental lighting rather than visible circles.
       */}
      <div
        className="octoson-ambient-one absolute -left-[18%] -top-[170%] h-[420%] w-[72%] rounded-[50%] blur-[105px]"
        style={{
          background: `radial-gradient(
            circle,
            ${rgb(a, 0.27)} 0%,
            ${rgb(a, 0.12)} 38%,
            transparent 72%
          )`,
        }}
      />

      <div
        className="octoson-ambient-two absolute left-[25%] -top-[190%] h-[440%] w-[68%] rounded-[50%] blur-[115px]"
        style={{
          background: `radial-gradient(
            circle,
            ${rgb(b, 0.21)} 0%,
            ${rgb(b, 0.09)} 42%,
            transparent 74%
          )`,
        }}
      />

      <div
        className="octoson-ambient-three absolute -right-[20%] -top-[150%] h-[400%] w-[70%] rounded-[50%] blur-[120px]"
        style={{
          background: `radial-gradient(
            circle,
            ${rgb(c, 0.20)} 0%,
            ${rgb(c, 0.08)} 40%,
            transparent 73%
          )`,
        }}
      />

      {/*
       * SECONDARY LIGHT
       *
       * Gives the banner a very slow "breathing" highlight
       * instead of only translating colored blobs.
       */}
      <div
        className="octoson-ambient-breathe absolute -inset-[30%]"
        style={{
          background: `
            radial-gradient(
              ellipse 42% 80% at 24% 42%,
              ${rgb(a, 0.12)},
              transparent 72%
            ),
            radial-gradient(
              ellipse 45% 90% at 78% 50%,
              ${rgb(c, 0.09)},
              transparent 75%
            )
          `,
        }}
      />

      {/*
       * PREMIUM SHEEN
       *
       * Extremely subtle diagonal illumination crossing the
       * card. It should be felt more than visibly noticed.
       */}
      <div
        className="octoson-ambient-sheen absolute -inset-y-[80%] -left-[45%] w-[38%] rotate-[12deg] blur-[34px]"
        style={{
          background: `linear-gradient(
            90deg,
            transparent 0%,
            rgba(255,255,255,0.018) 25%,
            rgba(255,255,255,0.055) 50%,
            ${rgb(a, 0.035)} 67%,
            transparent 100%
          )`,
        }}
      />

      {/*
       * EDGE VIGNETTE
       *
       * Keeps text readable and stops bright avatars from
       * turning the banner into a glowing rectangle.
       */}
      <div
        className="absolute inset-0"
        style={{
          background: `
            linear-gradient(
              90deg,
              rgba(4,6,8,0.08) 0%,
              rgba(5,7,9,0.18) 42%,
              rgba(4,6,8,0.35) 100%
            ),
            linear-gradient(
              180deg,
              rgba(255,255,255,0.018) 0%,
              transparent 30%,
              rgba(0,0,0,0.14) 100%
            )
          `,
        }}
      />

      {/* Soft glass highlight along top edge */}
      <div
        className="octoson-edge-light absolute inset-x-[4%] top-0 h-px"
        style={{
          background: `linear-gradient(
            90deg,
            transparent 0%,
            ${rgb(a, 0.20)} 20%,
            rgba(255,255,255,0.11) 48%,
            ${rgb(b, 0.16)} 70%,
            transparent 100%
          )`,
        }}
      />

      {/* Fine grain prevents gradients looking digitally flat */}
      <div
        className="octoson-ambient-grain absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage: `
            url("data:image/svg+xml,%3Csvg viewBox='0 0 180 180' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.7'/%3E%3C/svg%3E")
          `,
        }}
      />

      <style jsx>{`
        @keyframes ambientBase {
          0%,
          100% {
            transform: scale(1.02) translate3d(0, 0, 0);
            opacity: 0.82;
          }

          35% {
            transform: scale(1.07)
              translate3d(1.5%, -1%, 0);
            opacity: 1;
          }

          70% {
            transform: scale(1.04)
              translate3d(-1%, 1.5%, 0);
            opacity: 0.9;
          }
        }

        @keyframes ambientOne {
          0%,
          100% {
            transform: translate3d(-8%, -2%, 0)
              scale(1);
          }

          25% {
            transform: translate3d(10%, 4%, 0)
              scale(1.13);
          }

          52% {
            transform: translate3d(19%, -3%, 0)
              scale(1.05);
          }

          76% {
            transform: translate3d(3%, 5%, 0)
              scale(1.16);
          }
        }

        @keyframes ambientTwo {
          0%,
          100% {
            transform: translate3d(8%, 3%, 0)
              scale(1.08);
          }

          31% {
            transform: translate3d(-13%, -4%, 0)
              scale(0.96);
          }

          61% {
            transform: translate3d(-4%, 5%, 0)
              scale(1.16);
          }

          82% {
            transform: translate3d(10%, -2%, 0)
              scale(1.04);
          }
        }

        @keyframes ambientThree {
          0%,
          100% {
            transform: translate3d(5%, -3%, 0)
              scale(1);
          }

          38% {
            transform: translate3d(-17%, 5%, 0)
              scale(1.15);
          }

          68% {
            transform: translate3d(-7%, -5%, 0)
              scale(1.06);
          }
        }

        @keyframes ambientBreathe {
          0%,
          100% {
            transform: scale(0.96);
            opacity: 0.48;
          }

          50% {
            transform: scale(1.12);
            opacity: 0.9;
          }
        }

        @keyframes ambientSheen {
          0% {
            transform: translate3d(-35%, 0, 0)
              rotate(12deg);
            opacity: 0;
          }

          15% {
            opacity: 0;
          }

          38% {
            opacity: 0.65;
          }

          58% {
            opacity: 0.32;
          }

          75%,
          100% {
            transform: translate3d(430%, 0, 0)
              rotate(12deg);
            opacity: 0;
          }
        }

        @keyframes edgeLight {
          0%,
          100% {
            opacity: 0.35;
            transform: scaleX(0.94);
          }

          50% {
            opacity: 0.72;
            transform: scaleX(1);
          }
        }

        @keyframes grainShift {
          0% {
            transform: translate3d(0, 0, 0);
          }

          25% {
            transform: translate3d(-1%, 1%, 0);
          }

          50% {
            transform: translate3d(1%, -1%, 0);
          }

          75% {
            transform: translate3d(1%, 1%, 0);
          }

          100% {
            transform: translate3d(0, 0, 0);
          }
        }

        .octoson-ambient-base {
          animation:
            ambientBase 18s
            cubic-bezier(0.45, 0, 0.55, 1)
            infinite;
          will-change: transform, opacity;
        }

        .octoson-ambient-one {
          animation:
            ambientOne 25s
            cubic-bezier(0.45, 0, 0.55, 1)
            infinite;
          will-change: transform;
        }

        .octoson-ambient-two {
          animation:
            ambientTwo 31s
            cubic-bezier(0.45, 0, 0.55, 1)
            infinite;
          will-change: transform;
        }

        .octoson-ambient-three {
          animation:
            ambientThree 37s
            cubic-bezier(0.45, 0, 0.55, 1)
            infinite;
          will-change: transform;
        }

        .octoson-ambient-breathe {
          animation:
            ambientBreathe 14s
            cubic-bezier(0.45, 0, 0.55, 1)
            infinite;
          will-change: transform, opacity;
        }

        .octoson-ambient-sheen {
          animation:
            ambientSheen 19s
            cubic-bezier(0.4, 0, 0.2, 1)
            infinite;
          will-change: transform, opacity;
        }

        .octoson-edge-light {
          animation:
            edgeLight 11s
            ease-in-out infinite;
          transform-origin: center;
        }

        .octoson-ambient-grain {
          animation:
            grainShift 8s
            steps(2, end) infinite;
        }

        @media (prefers-reduced-motion: reduce) {
          .octoson-ambient-base,
          .octoson-ambient-one,
          .octoson-ambient-two,
          .octoson-ambient-three,
          .octoson-ambient-breathe,
          .octoson-ambient-sheen,
          .octoson-edge-light,
          .octoson-ambient-grain {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}
