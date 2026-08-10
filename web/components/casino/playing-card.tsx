"use client";

import { motion } from "motion/react";

export type CardSuit = "spades" | "hearts" | "diamonds" | "clubs";
export type CardRank =
  | "A"
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "10"
  | "J"
  | "Q"
  | "K";

export type PlayingCardData = {
  rank: CardRank;
  suit: CardSuit;
};

const suitMap: Record<
  CardSuit,
  {
    symbol: string;
    red: boolean;
  }
> = {
  spades: {
    symbol: "♠",
    red: false,
  },
  hearts: {
    symbol: "♥",
    red: true,
  },
  diamonds: {
    symbol: "♦",
    red: true,
  },
  clubs: {
    symbol: "♣",
    red: false,
  },
};

export default function PlayingCard({
  card,
  hidden = false,
  delay = 0,
  compact = false,
}: {
  card?: PlayingCardData;
  hidden?: boolean;
  delay?: number;
  compact?: boolean;
}) {
  const suit = card
    ? suitMap[card.suit]
    : suitMap.spades;

  return (
    <motion.div
      initial={{
        opacity: 0,
        y: -28,
        rotateY: -75,
        scale: 0.88,
      }}
      animate={{
        opacity: 1,
        y: 0,
        rotateY: 0,
        scale: 1,
      }}
      transition={{
        delay,
        type: "spring",
        stiffness: 250,
        damping: 22,
      }}
      className={`relative shrink-0 overflow-hidden rounded-[16px] border shadow-[0_18px_50px_rgba(0,0,0,.35)] ${
        compact
          ? "h-[132px] w-[92px]"
          : "h-[176px] w-[122px]"
      } ${
        hidden
          ? "border-cyan-100/15 bg-[#091115]"
          : "border-black/10 bg-[#f3f3f0]"
      }`}
      style={{
        transformStyle: "preserve-3d",
      }}
    >
      {hidden ? (
        <>
          <div className="absolute inset-[7px] rounded-[11px] border border-cyan-100/10 bg-[#071014]" />

          <div
            className="absolute inset-[13px] rounded-[8px] opacity-80"
            style={{
              backgroundImage:
                "linear-gradient(45deg, rgba(165,243,252,.08) 25%, transparent 25%, transparent 75%, rgba(165,243,252,.08) 75%), linear-gradient(45deg, rgba(165,243,252,.08) 25%, transparent 25%, transparent 75%, rgba(165,243,252,.08) 75%)",
              backgroundPosition: "0 0, 7px 7px",
              backgroundSize: "14px 14px",
            }}
          />

          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex h-11 w-11 items-center justify-center rounded-full border border-cyan-100/15 bg-cyan-100/[0.04] text-[13px] font-bold tracking-[-0.06em] text-cyan-100/60">
              O
            </div>
          </div>
        </>
      ) : (
        <>
          <div
            className={`absolute left-3 top-2.5 font-bold leading-none ${
              compact ? "text-[19px]" : "text-[23px]"
            } ${
              suit.red
                ? "text-[#b4262d]"
                : "text-[#17191c]"
            }`}
          >
            <div>{card?.rank}</div>
            <div className="mt-1 text-[15px]">
              {suit.symbol}
            </div>
          </div>

          <div
            className={`absolute inset-0 flex items-center justify-center ${
              suit.red
                ? "text-[#b4262d]"
                : "text-[#17191c]"
            }`}
          >
            <span
              className={
                compact
                  ? "text-[45px]"
                  : "text-[60px]"
              }
            >
              {suit.symbol}
            </span>
          </div>

          <div
            className={`absolute bottom-2.5 right-3 rotate-180 font-bold leading-none ${
              compact ? "text-[19px]" : "text-[23px]"
            } ${
              suit.red
                ? "text-[#b4262d]"
                : "text-[#17191c]"
            }`}
          >
            <div>{card?.rank}</div>
            <div className="mt-1 text-[15px]">
              {suit.symbol}
            </div>
          </div>
        </>
      )}
    </motion.div>
  );
}
