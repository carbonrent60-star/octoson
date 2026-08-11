"use client";

import {
  useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";

import {
  Bomb,
  CircleDollarSign,
  CircleGauge,
  Coins,
  Crown,
  Dice5,
  Dices,
  Goal,
  Grid3X3,
  Layers3,
  LockKeyhole,
  RotateCcw,
  Search,
  ShieldQuestion,
  Sparkles,
  Spade,
  Swords,
  Trophy,
  WalletCards,
} from "lucide-react";

import { useOctosonAudio } from "@/components/audio/octoson-audio";

type CasinoUiGame = {
  id: string;
  name: string;
  description: string;
  tag: string;
  icon: React.ElementType;
  category: "instant" | "cards" | "interactive";
  live: boolean;
  route?: string;
};

const games: CasinoUiGame[] = [
  {
    id: "coinflip",
    name: "Coinflip",
    description: "Üz və ya arxa seç.",
    tag: "1.95X",
    icon: Coins,
    category: "instant",
    live: true,
  },
  {
    id: "dice",
    name: "Dice",
    description: "Sistemə qarşı zər at.",
    tag: "1.80X",
    icon: Dice5,
    category: "instant",
    live: true,
  },
  {
    id: "mines",
    name: "Mines",
    description: "Xanaları aç, minadan qaç.",
    tag: "3×3",
    icon: Bomb,
    category: "interactive",
    live: true,
    route: "/dashboard/casino/mines",
  },
  {
    id: "roulette",
    name: "Roulette",
    description: "Qırmızı və ya qara.",
    tag: "1.95X",
    icon: CircleDollarSign,
    category: "instant",
    live: true,
  },
  {
    id: "crash",
    name: "Crash",
    description: "Crash-dan əvvəl çıx.",
    tag: "10X",
    icon: CircleGauge,
    category: "interactive",
    live: true,
  },
  {
    id: "wheel",
    name: "Lucky Wheel",
    description: "Yeddi sektordan birini vur.",
    tag: "2.40X",
    icon: RotateCcw,
    category: "interactive",
    live: true,
  },
  {
    id: "rps",
    name: "RPS",
    description: "Daş, kağız, qayçı.",
    tag: "1.80X",
    icon: Dices,
    category: "instant",
    live: true,
  },
  {
    id: "baccarat",
    name: "Baccarat",
    description: "Player, Banker və Tie.",
    tag: "8.00X",
    icon: Spade,
    category: "cards",
    live: true,
  },
  {
    id: "poker",
    name: "Poker",
    description: "Virtual poker əli aç.",
    tag: "5.00X",
    icon: Crown,
    category: "cards",
    live: true,
  },
  {
    id: "horse",
    name: "Horse Racing",
    description: "Altı atdan birini seç.",
    tag: "5.00X",
    icon: Trophy,
    category: "interactive",
    live: true,
  },
  {
    id: "penalty",
    name: "Penalty",
    description: "Qapıçını aldat.",
    tag: "1.35X",
    icon: Goal,
    category: "interactive",
    live: true,
  },
  {
    id: "lottery",
    name: "Lottery",
    description: "Bileti aç və nəticəni gör.",
    tag: "8.00X",
    icon: Sparkles,
    category: "instant",
    live: true,
  },
  {
    id: "jackpot",
    name: "Jackpot",
    description: "Ən yüksək riskli raund.",
    tag: "25X",
    icon: Crown,
    category: "instant",
    live: true,
  },
  {
    id: "blackjack",
    name: "Blackjack",
    description: "Kart çək, dayan və 21-ə yaxınlaş.",
    tag: "21",
    icon: Layers3,
    category: "cards",
    live: true,
    route: "/dashboard/casino/blackjack",
  },
  {
    id: "slots",
    name: "Slots",
    description: "Üç simvolu uyğunlaşdır.",
    tag: "5X",
    icon: Grid3X3,
    category: "instant",
    live: true,
    route: "/dashboard/casino/slots",
  },
  {
    id: "risk",
    name: "Risk",
    description: "Riski artır, çıxış vaxtını seç.",
    tag: "RISK",
    icon: Swords,
    category: "interactive",
    live: true,
    route: "/dashboard/casino/risk",
  },
  {
    id: "tower",
    name: "Tower",
    description: "Mərtəbələri keç, vaxtında çıx.",
    tag: "4X",
    icon: ShieldQuestion,
    category: "interactive",
    live: true,
    route: "/dashboard/casino/tower",
  },
  {
    id: "higherlower",
    name: "Higher / Lower",
    description: "Növbəti kartı təxmin et.",
    tag: "1.85X",
    icon: Layers3,
    category: "cards",
    live: true,
    route: "/dashboard/casino/higherlower",
  },
];

function formatAura(value: number) {
  return Math.max(
    0,
    Math.floor(value)
  ).toLocaleString("en-US");
}

export default function CasinoClient({
  initialBalance,
}: {
  initialBalance: number;
}) {

  const [animateCards, setAnimateCards] =
    useState(false);

  useEffect(() => {
    const key = "octoson-casino-selector-seen";

    try {
      const seen = sessionStorage.getItem(key);

      if (!seen) {
        setAnimateCards(true);
        sessionStorage.setItem(key, "1");
      }
    } catch {
      setAnimateCards(true);
    }
  }, []);

  const router = useRouter();
  const audio = useOctosonAudio();

  const [filter, setFilter] = useState<
    "all" | "instant" | "cards" | "interactive"
  >("all");

  const [search, setSearch] = useState("");

  const visibleGames = useMemo(() => {
    const query = search.trim().toLowerCase();

    return games.filter((game) => {
      const categoryMatches =
        filter === "all" ||
        game.category === filter;

      const searchMatches =
        !query ||
        game.name.toLowerCase().includes(query) ||
        game.description
          .toLowerCase()
          .includes(query);

      return categoryMatches && searchMatches;
    });
  }, [filter, search]);

  function openGame(game: CasinoUiGame) {
    if (!game.live) {
      audio.play("error");
      return;
    }

    audio.play("navigate");

    router.push(
      game.route ??
        `/dashboard/casino/${game.id}`
    );
  }

  return (
    <div>
      <div className="mb-8 flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-200" />
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-100/50">
              Octoson Casino
            </p>
          </div>

          <h1 className="mt-3 text-[38px] font-semibold tracking-[-0.05em] text-white sm:text-[44px]">
            Casino
          </h1>

          <p className="mt-2 max-w-[560px] text-[12px] leading-6 text-white/25">
            Discord ilə eyni Aura wallet-i və eyni economy
            sistemi. Oyunu seç və onun xüsusi səhifəsində oyna.
          </p>
        </div>

        <motion.div
          key={initialBalance}
          initial={{
            opacity: 0,
            y: 5,
          }}
          animate={{
            opacity: 1,
            y: 0,
          }}
          className="w-fit rounded-[15px] border border-white/[0.07] bg-white/[0.025] px-5 py-3.5"
        >
          <div className="flex items-center gap-2 text-[9px] text-white/25">
            <WalletCards className="h-3.5 w-3.5" />
            Wallet
          </div>

          <p className="mt-1.5 text-[18px] font-semibold tracking-[-0.03em] text-white/80">
            {formatAura(initialBalance)}

            <span className="ml-1.5 text-[8px] text-cyan-100/40">
              AURA
            </span>
          </p>
        </motion.div>
      </div>

      <div className="mb-5 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-wrap gap-2">
          {[
            ["all", "Hamısı"],
            ["instant", "Instant"],
            ["cards", "Kart"],
            ["interactive", "Interactive"],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              onMouseEnter={() =>
                audio.play("hover")
              }
              onClick={() => {
                audio.play("click");
                setFilter(
                  id as
                    | "all"
                    | "instant"
                    | "cards"
                    | "interactive"
                );
              }}
              className={`rounded-[10px] border px-3.5 py-2 text-[9px] font-medium transition ${
                filter === id
                  ? "border-cyan-100/[0.14] bg-cyan-100/[0.055] text-cyan-50/80"
                  : "border-white/[0.06] bg-white/[0.02] text-white/25 hover:bg-white/[0.04] hover:text-white/55"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex w-full items-center gap-2 rounded-[12px] border border-white/[0.065] bg-white/[0.02] px-3.5 xl:w-[270px]">
          <Search className="h-3.5 w-3.5 text-white/20" />

          <input
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            placeholder="Oyun axtar"
            className="min-w-0 flex-1 bg-transparent py-3 text-[10px] text-white/65 outline-none placeholder:text-white/15"
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {visibleGames.map((game, index) => {
          const Icon = game.icon;

          return (
            <motion.button
              key={game.id}
              type="button"
              initial={{
                opacity: 0,
                y: 8,
              }}
              animate={{
                opacity: 1,
                y: 0,
              }}
              transition={{
                delay: Math.min(
                  index * 0.025,
                  0.3
                ),
              }}
              whileTap={
                game.live
                  ? {
                      scale: 0.985,
                    }
                  : undefined
              }
              onMouseEnter={() =>
                game.live &&
                audio.play("hover")
              }
              onClick={() =>
                openGame(game)
              }
              className={`group relative min-h-[165px] overflow-hidden rounded-[20px] border p-5 text-left transition duration-300 ${
                game.live
                  ? "border-white/[0.065] bg-white/[0.018] hover:-translate-y-0.5 hover:border-cyan-100/[0.12] hover:bg-cyan-100/[0.025]"
                  : "cursor-default border-white/[0.045] bg-white/[0.01] opacity-55"
              }`}
            >
              <div className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-cyan-100/[0.025] blur-3xl transition duration-500 group-hover:bg-cyan-100/[0.055]" />

              <div className="relative flex items-start justify-between">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-[12px] border ${
                    game.live
                      ? "border-white/[0.07] bg-black/20 text-white/35 group-hover:border-cyan-100/[0.12] group-hover:text-cyan-100/60"
                      : "border-white/[0.05] bg-black/15 text-white/20"
                  }`}
                >
                  <Icon className="h-[16px] w-[16px]" />
                </div>

                <div className="flex items-center gap-2">
                  {!game.live && (
                    <span className="flex items-center gap-1 rounded-full border border-white/[0.12] bg-white/[0.055] px-2 py-1 text-[7px] font-semibold uppercase tracking-[0.1em] text-white/52">
                      <LockKeyhole className="h-2.5 w-2.5" />
                      Hazırlanır
                    </span>
                  )}

                  <span className="text-[8px] font-semibold tracking-[0.12em] text-cyan-50/65">
                    {game.tag}
                  </span>
                </div>
              </div>

              <div className="relative mt-7">
                <p className="text-[15px] font-semibold tracking-[-0.02em] text-white">
                  {game.name}
                </p>

                <p className="mt-1.5 text-[10px] leading-[1.55] text-white/58">
                  {game.description}
                </p>
              </div>

              {game.live && (
                <motion.div
                  className="absolute inset-x-5 bottom-0 h-px origin-left bg-cyan-100/50"
                  initial={{
                    scaleX: 0,
                  }}
                  whileHover={{
                    scaleX: 1,
                  }}
                />
              )}
            </motion.button>
          );
        })}
      </div>

      <div className="mt-6 flex items-start gap-2 rounded-[14px] border border-white/[0.07] bg-white/[0.025] px-4 py-3">
        <div className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-100/35" />

        <p className="text-[9px] leading-5 text-white/30">
          Aura yalnız Octoson daxilində istifadə olunan virtual
          oyun valyutasıdır. Real pul dəyəri yoxdur və pula
          çevrilə bilməz.
        </p>
      </div>
    </div>
  );
}
