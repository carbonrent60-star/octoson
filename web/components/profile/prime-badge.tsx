"use client";

import { Crown, Gem } from "lucide-react";
import BadgeTooltip from "./badge-tooltip";

type BadgeSize = "xs" | "sm" | "md" | "lg";

type PrimeBadgeProps = {
  size?: BadgeSize;
  activeUntil?: number | string | null;
  className?: string;
};

const sizes: Record<BadgeSize, string> = {
  xs: "12px",
  sm: "15px",
  md: "18px",
  lg: "21px",
};

function formatPrimeDate(
  value?: number | string | null
) {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat("az-AZ", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export default function PrimeBadge({
  size = "md",
  activeUntil,
  className = "",
}: PrimeBadgeProps) {
  const dimension = sizes[size];

  return (
    <span className={`inline-flex shrink-0 ${className}`}>
      <BadgeTooltip
        label="Octoson Prime"
        content={
          <PrimeTooltip
            activeUntil={activeUntil}
          />
        }
      >
        <span
          className="primeIcon"
          style={{
            width: dimension,
            height: dimension,
          }}
        >
          <Gem />
        </span>
      </BadgeTooltip>

      <style jsx>{`
        .primeIcon {
          display: grid;
          place-items: center;

          color: #c084fc;

          cursor: default;

          filter:
            drop-shadow(
              0 0 5px
              rgba(168,85,247,.3)
            );

          animation:
            primeGlow
            3s
            ease-in-out
            infinite;
        }

        .primeIcon :global(svg) {
          width: 100%;
          height: 100%;

          stroke-width: 2.25;

          fill:
            rgba(168,85,247,.12);
        }

        @keyframes primeGlow {
          0%,
          100% {
            filter:
              drop-shadow(
                0 0 4px
                rgba(168,85,247,.2)
              );
          }

          50% {
            filter:
              drop-shadow(
                0 0 8px
                rgba(168,85,247,.42)
              );
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .primeIcon {
            animation: none;
          }
        }
      `}</style>
    </span>
  );
}

function PrimeTooltip({
  activeUntil,
}: {
  activeUntil?: number | string | null;
}) {
  const expiry =
    formatPrimeDate(activeUntil);

  return (
    <div className="card">
      <div className="top">
        <span className="hero">
          <span className="glow" />
          <Gem />
        </span>

        <span className="copy">
          <span className="eyebrow">
            <Crown />
            OCTOSON PRIME
          </span>

          <strong>Prime Member</strong>
          <small>Premium üzvlük aktivdir</small>
        </span>
      </div>

      <span className="divider" />

      <div className="status">
        <span>
          <i />
          STATUS
        </span>

        <strong>ACTIVE</strong>
      </div>

      {expiry ? (
        <div className="expiry">
          <span>Aktivdir</span>
          <strong>{expiry}-dək</strong>
        </div>
      ) : null}

      <div className="features">
        Loss Protection
        <b>•</b>
        Prime Missions
        <b>•</b>
        Premium Identity
      </div>

      <style jsx>{`
        .card {
          width: 232px;
          padding: 12px;

          border:
            1px solid rgba(192,132,252,.14);

          border-radius: 13px;

          background:
            radial-gradient(
              circle at 15% 0%,
              rgba(168,85,247,.15),
              transparent 42%
            ),
            radial-gradient(
              circle at 100% 100%,
              rgba(99,102,241,.08),
              transparent 45%
            ),
            #17171c;

          box-shadow:
            0 24px 60px rgba(0,0,0,.58),
            0 0 35px rgba(126,34,206,.06);
        }

        .top {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .hero {
          position: relative;

          width: 39px;
          height: 39px;

          flex: 0 0 auto;

          display: grid;
          place-items: center;

          overflow: hidden;

          border:
            1px solid rgba(192,132,252,.18);

          border-radius: 13px;

          color: #d8b4fe;

          background:
            linear-gradient(
              145deg,
              rgba(168,85,247,.15),
              rgba(99,102,241,.05)
            );
        }

        .hero :global(svg) {
          position: relative;
          z-index: 2;

          width: 22px;
          height: 22px;

          stroke-width: 2.15;

          fill:
            rgba(168,85,247,.13);
        }

        .glow {
          position: absolute;

          width: 35px;
          height: 35px;

          border-radius: 999px;

          background:
            rgba(168,85,247,.2);

          filter: blur(12px);

          animation:
            tooltipGlow
            2.7s
            ease-in-out
            infinite;
        }

        .copy {
          min-width: 0;

          display: flex;
          flex-direction: column;
          align-items: flex-start;

          text-align: left;
        }

        .eyebrow {
          display: flex;
          align-items: center;
          gap: 5px;

          color:
            rgba(216,180,254,.65);

          font-size: 7px;
          font-weight: 800;

          letter-spacing: .13em;
        }

        .eyebrow :global(svg) {
          width: 9px;
          height: 9px;
        }

        .copy strong {
          margin-top: 5px;

          color:
            rgba(255,255,255,.94);

          font-size: 13px;
          font-weight: 760;
        }

        .copy small {
          margin-top: 3px;

          color:
            rgba(255,255,255,.4);

          font-size: 8px;
        }

        .divider {
          display: block;

          height: 1px;

          margin: 13px 0 11px;

          background:
            linear-gradient(
              90deg,
              rgba(192,132,252,.15),
              rgba(255,255,255,.04),
              transparent
            );
        }

        .status {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .status > span {
          display: inline-flex;
          align-items: center;
          gap: 6px;

          color:
            rgba(255,255,255,.3);

          font-size: 7px;
          font-weight: 750;

          letter-spacing: .12em;
        }

        .status i {
          width: 5px;
          height: 5px;

          border-radius: 999px;

          background: #c084fc;

          box-shadow:
            0 0 8px
            rgba(192,132,252,.7);
        }

        .status > strong {
          color:
            rgba(216,180,254,.8);

          font-size: 8px;
          font-weight: 800;

          letter-spacing: .08em;
        }

        .expiry {
          margin-top: 9px;
          padding: 9px 10px;

          display: flex;
          align-items: center;
          justify-content: space-between;

          border:
            1px solid rgba(255,255,255,.05);

          border-radius: 8px;

          background:
            rgba(255,255,255,.018);
        }

        .expiry span {
          color:
            rgba(255,255,255,.3);

          font-size: 8px;
        }

        .expiry strong {
          color:
            rgba(255,255,255,.68);

          font-size: 8px;
          font-weight: 650;
        }

        .features {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 5px;

          margin-top: 11px;

          color:
            rgba(216,180,254,.35);

          font-size: 7.5px;
          line-height: 1.5;
        }

        .features b {
          color:
            rgba(216,180,254,.18);
        }

        @keyframes tooltipGlow {
          0%,
          100% {
            opacity: .45;
            transform: scale(.85);
          }

          50% {
            opacity: .9;
            transform: scale(1.12);
          }
        }
      `}</style>
    </div>
  );
}
