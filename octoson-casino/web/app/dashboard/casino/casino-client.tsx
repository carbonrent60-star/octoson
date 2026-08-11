"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";

import {
  ArrowRight,
  Bomb,
  ChevronDown,
  CircleDollarSign,
  CircleGauge,
  Coins,
  Crown,
  Dice5,
  Dices,
  Goal,
  Grid3X3,
  Layers3,
  RotateCcw,
  Search,
  ShieldQuestion,
  Sparkles,
  Spade,
  Swords,
  Trophy,
  WalletCards,
  X,
  Zap,
} from "lucide-react";

import { useOctosonAudio } from "@/components/audio/octoson-audio";

type Category =
  | "instant"
  | "cards"
  | "interactive";

type CasinoUiGame = {
  id: string;
  name: string;
  description: string;
  tag: string;
  icon: React.ElementType;
  category: Category;
  live: boolean;
  route?: string;

  /* Per-game visual identity */
  accent: string;
  accentSoft: string;
  accentBorder: string;
  accentText: string;
  glow: string;
  gradient: string;
  symbol: string;
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

    accent: "#f6c768",
    accentSoft: "rgba(246,199,104,.09)",
    accentBorder: "rgba(246,199,104,.22)",
    accentText: "#f9d98e",
    glow: "rgba(246,199,104,.16)",
    gradient:
      "linear-gradient(145deg, rgba(255,255,255,.022) 0%, rgba(255,255,255,.008) 38%, transparent 72%)",
    symbol: "◐",
  },
  {
    id: "dice",
    name: "Dice",
    description: "Sistemə qarşı zər at.",
    tag: "1.80X",
    icon: Dice5,
    category: "instant",
    live: true,

    accent: "#a78bfa",
    accentSoft: "rgba(167,139,250,.09)",
    accentBorder: "rgba(167,139,250,.22)",
    accentText: "#c4b5fd",
    glow: "rgba(139,92,246,.16)",
    gradient:
      "linear-gradient(145deg, rgba(255,255,255,.022) 0%, rgba(255,255,255,.008) 38%, transparent 72%)",
    symbol: "⚄",
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

    accent: "#67e8f9",
    accentSoft: "rgba(103,232,249,.085)",
    accentBorder: "rgba(103,232,249,.21)",
    accentText: "#a5f3fc",
    glow: "rgba(34,211,238,.17)",
    gradient:
      "linear-gradient(145deg, rgba(255,255,255,.022) 0%, rgba(255,255,255,.008) 38%, transparent 72%)",
    symbol: "✦",
  },
  {
    id: "roulette",
    name: "Roulette",
    description: "Qırmızı və ya qara.",
    tag: "1.95X",
    icon: CircleDollarSign,
    category: "instant",
    live: true,

    accent: "#fb7185",
    accentSoft: "rgba(251,113,133,.085)",
    accentBorder: "rgba(251,113,133,.21)",
    accentText: "#fda4af",
    glow: "rgba(244,63,94,.16)",
    gradient:
      "linear-gradient(145deg, rgba(255,255,255,.022) 0%, rgba(255,255,255,.008) 38%, transparent 72%)",
    symbol: "◆",
  },
  {
    id: "crash",
    name: "Crash",
    description: "Crash-dan əvvəl çıx.",
    tag: "10X",
    icon: CircleGauge,
    category: "interactive",
    live: true,

    accent: "#fb923c",
    accentSoft: "rgba(251,146,60,.085)",
    accentBorder: "rgba(251,146,60,.21)",
    accentText: "#fdba74",
    glow: "rgba(249,115,22,.17)",
    gradient:
      "linear-gradient(145deg, rgba(255,255,255,.022) 0%, rgba(255,255,255,.008) 38%, transparent 72%)",
    symbol: "↗",
  },
  {
    id: "wheel",
    name: "Lucky Wheel",
    description: "Yeddi sektordan birini vur.",
    tag: "2.40X",
    icon: RotateCcw,
    category: "interactive",
    live: true,

    accent: "#2dd4bf",
    accentSoft: "rgba(45,212,191,.085)",
    accentBorder: "rgba(45,212,191,.21)",
    accentText: "#5eead4",
    glow: "rgba(20,184,166,.17)",
    gradient:
      "linear-gradient(145deg, rgba(255,255,255,.022) 0%, rgba(255,255,255,.008) 38%, transparent 72%)",
    symbol: "✺",
  },
  {
    id: "rps",
    name: "RPS",
    description: "Daş, kağız, qayçı.",
    tag: "1.80X",
    icon: Dices,
    category: "instant",
    live: true,

    accent: "#60a5fa",
    accentSoft: "rgba(96,165,250,.085)",
    accentBorder: "rgba(96,165,250,.21)",
    accentText: "#93c5fd",
    glow: "rgba(59,130,246,.16)",
    gradient:
      "linear-gradient(145deg, rgba(255,255,255,.022) 0%, rgba(255,255,255,.008) 38%, transparent 72%)",
    symbol: "✂",
  },
  {
    id: "baccarat",
    name: "Baccarat",
    description: "Player, Banker və Tie.",
    tag: "8.00X",
    icon: Spade,
    category: "cards",
    live: true,
    route: "/dashboard/casino/baccarat",

    accent: "#e879f9",
    accentSoft: "rgba(232,121,249,.085)",
    accentBorder: "rgba(232,121,249,.21)",
    accentText: "#f0abfc",
    glow: "rgba(217,70,239,.16)",
    gradient:
      "linear-gradient(145deg, rgba(255,255,255,.022) 0%, rgba(255,255,255,.008) 38%, transparent 72%)",
    symbol: "♠",
  },
  {
    id: "poker",
    name: "Poker",
    description: "Virtual poker əli aç.",
    tag: "5.00X",
    icon: Crown,
    category: "cards",
    live: true,

    accent: "#f43f5e",
    accentSoft: "rgba(244,63,94,.085)",
    accentBorder: "rgba(244,63,94,.21)",
    accentText: "#fb7185",
    glow: "rgba(225,29,72,.16)",
    gradient:
      "linear-gradient(145deg, rgba(255,255,255,.022) 0%, rgba(255,255,255,.008) 38%, transparent 72%)",
    symbol: "♥",
  },
  {
    id: "horse",
    name: "Horse Racing",
    description: "Altı atdan birini seç.",
    tag: "5.00X",
    icon: Trophy,
    category: "interactive",
    live: true,

    accent: "#fbbf24",
    accentSoft: "rgba(251,191,36,.085)",
    accentBorder: "rgba(251,191,36,.21)",
    accentText: "#fde68a",
    glow: "rgba(245,158,11,.16)",
    gradient:
      "linear-gradient(145deg, rgba(255,255,255,.022) 0%, rgba(255,255,255,.008) 38%, transparent 72%)",
    symbol: "★",
  },
  {
    id: "penalty",
    name: "Penalty",
    description: "Qapıçını aldat.",
    tag: "1.35X",
    icon: Goal,
    category: "interactive",
    live: true,

    accent: "#4ade80",
    accentSoft: "rgba(74,222,128,.085)",
    accentBorder: "rgba(74,222,128,.21)",
    accentText: "#86efac",
    glow: "rgba(34,197,94,.16)",
    gradient:
      "linear-gradient(145deg, rgba(255,255,255,.022) 0%, rgba(255,255,255,.008) 38%, transparent 72%)",
    symbol: "◎",
  },
  {
    id: "lottery",
    name: "Lottery",
    description: "Bileti aç və nəticəni gör.",
    tag: "8.00X",
    icon: Sparkles,
    category: "instant",
    live: true,

    accent: "#f472b6",
    accentSoft: "rgba(244,114,182,.085)",
    accentBorder: "rgba(244,114,182,.21)",
    accentText: "#f9a8d4",
    glow: "rgba(236,72,153,.16)",
    gradient:
      "linear-gradient(145deg, rgba(255,255,255,.022) 0%, rgba(255,255,255,.008) 38%, transparent 72%)",
    symbol: "✧",
  },
  {
    id: "jackpot",
    name: "Jackpot",
    description: "Ən yüksək riskli raund.",
    tag: "25X",
    icon: Crown,
    category: "instant",
    live: true,

    accent: "#facc15",
    accentSoft: "rgba(250,204,21,.09)",
    accentBorder: "rgba(250,204,21,.23)",
    accentText: "#fde047",
    glow: "rgba(234,179,8,.18)",
    gradient:
      "linear-gradient(145deg, rgba(255,255,255,.022) 0%, rgba(255,255,255,.008) 38%, transparent 72%)",
    symbol: "♛",
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

    accent: "#34d399",
    accentSoft: "rgba(52,211,153,.085)",
    accentBorder: "rgba(52,211,153,.21)",
    accentText: "#6ee7b7",
    glow: "rgba(16,185,129,.17)",
    gradient:
      "linear-gradient(145deg, rgba(255,255,255,.022) 0%, rgba(255,255,255,.008) 38%, transparent 72%)",
    symbol: "21",
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

    accent: "#f59e0b",
    accentSoft: "rgba(245,158,11,.085)",
    accentBorder: "rgba(245,158,11,.21)",
    accentText: "#fbbf24",
    glow: "rgba(217,119,6,.17)",
    gradient:
      "linear-gradient(145deg, rgba(255,255,255,.022) 0%, rgba(255,255,255,.008) 38%, transparent 72%)",
    symbol: "777",
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

    accent: "#ef4444",
    accentSoft: "rgba(239,68,68,.085)",
    accentBorder: "rgba(239,68,68,.22)",
    accentText: "#f87171",
    glow: "rgba(220,38,38,.18)",
    gradient:
      "linear-gradient(145deg, rgba(255,255,255,.022) 0%, rgba(255,255,255,.008) 38%, transparent 72%)",
    symbol: "×",
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

    accent: "#38bdf8",
    accentSoft: "rgba(56,189,248,.085)",
    accentBorder: "rgba(56,189,248,.21)",
    accentText: "#7dd3fc",
    glow: "rgba(14,165,233,.17)",
    gradient:
      "linear-gradient(145deg, rgba(255,255,255,.022) 0%, rgba(255,255,255,.008) 38%, transparent 72%)",
    symbol: "▥",
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

    accent: "#fb923c",
    accentSoft: "rgba(251,146,60,.085)",
    accentBorder: "rgba(251,146,60,.21)",
    accentText: "#fdba74",
    glow: "rgba(249,115,22,.17)",
    gradient:
      "linear-gradient(145deg, rgba(255,255,255,.022) 0%, rgba(255,255,255,.008) 38%, transparent 72%)",
    symbol: "↕",
  },
];

const filters: {
  id: "all" | Category;
  label: string;
}[] = [
  { id: "all", label: "Hamısı" },
  { id: "instant", label: "Instant" },
  { id: "cards", label: "Kart" },
  { id: "interactive", label: "Interactive" },
];

function formatAura(value: number) {
  return Math.max(
    0,
    Math.floor(value)
  ).toLocaleString("en-US");
}

function categoryLabel(category: Category) {
  switch (category) {
    case "cards":
      return "Kart";
    case "interactive":
      return "Interactive";
    default:
      return "Instant";
  }
}

export default function CasinoClient({
  initialBalance,
}: {
  initialBalance: number;
}) {
  const router = useRouter();
  const audio = useOctosonAudio();

  const [filter, setFilter] = useState<
    "all" | Category
  >("all");

  const [search, setSearch] = useState("");
  const [animateCards, setAnimateCards] =
    useState(false);

  useEffect(() => {
    const key = "octoson-casino-selector-seen-v2";

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

  const visibleGames = useMemo(() => {
    const query = search
      .trim()
      .toLocaleLowerCase();

    return games.filter((game) => {
      const categoryMatches =
        filter === "all" ||
        game.category === filter;

      if (!categoryMatches) return false;

      if (!query) return true;

      return (
        game.name
          .toLocaleLowerCase()
          .includes(query) ||
        game.description
          .toLocaleLowerCase()
          .includes(query) ||
        categoryLabel(game.category)
          .toLocaleLowerCase()
          .includes(query)
      );
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
    <div className="relative pb-8">
      {/* Header */}
      <div className="mb-8 flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-200 opacity-20" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-cyan-100/80" />
            </span>

            <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-cyan-100/45">
              Octoson Casino
            </p>
          </div>

          <h1 className="mt-3 text-[38px] font-semibold tracking-[-0.055em] text-white sm:text-[44px]">
            Casino
          </h1>

          <p className="mt-2 max-w-[540px] text-[11px] leading-[1.8] text-white/25">
            Aura ilə oyna. Hər oyunun öz ritmi,
            riski və mükafatı var.
          </p>
        </div>

        <motion.div
          key={initialBalance}
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative w-fit overflow-hidden rounded-[16px] border border-white/[0.075] bg-[#0b0d0f] px-5 py-3.5 shadow-[0_16px_45px_rgba(0,0,0,.25)]"
        >
          <div className="pointer-events-none absolute -right-8 -top-10 h-24 w-24 rounded-full bg-cyan-300/[0.055] blur-2xl" />

          <div className="relative flex items-center gap-2 text-[9px] text-white/28">
            <WalletCards className="h-3.5 w-3.5 text-cyan-100/35" />
            Wallet
          </div>

          <p className="relative mt-1.5 text-[18px] font-semibold tracking-[-0.035em] text-white/85">
            {formatAura(initialBalance)}
            <span className="ml-1.5 text-[8px] font-medium text-cyan-100/40">
              AURA
            </span>
          </p>
        </motion.div>
      </div>

      {/* Controls */}
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-1.5 rounded-[13px] border border-white/[0.055] bg-[#090a0c] p-1">
          {filters.map((item) => {
            const selected =
              filter === item.id;

            return (
              <button
                key={item.id}
                type="button"
                onMouseEnter={() =>
                  audio.play("hover")
                }
                onClick={() => {
                  audio.play("click");
                  setFilter(item.id);
                }}
                className={`relative rounded-[9px] px-3.5 py-2 text-[9px] font-medium transition duration-200 ${
                  selected
                    ? "text-white/80"
                    : "text-white/25 hover:text-white/55"
                }`}
              >
                {selected && (
                  <motion.span
                    layoutId="casino-filter"
                    className="absolute inset-0 rounded-[9px] border border-white/[0.075] bg-white/[0.055] shadow-[inset_0_1px_0_rgba(255,255,255,.035)]"
                    transition={{
                      type: "spring",
                      stiffness: 420,
                      damping: 34,
                    }}
                  />
                )}

                <span className="relative">
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>

        <motion.div
          animate={{
            borderColor: search
              ? "rgba(165,243,252,.16)"
              : "rgba(255,255,255,.065)",
          }}
          className="group flex w-full items-center gap-2.5 rounded-[13px] border bg-[#0a0b0d] px-3.5 shadow-[0_10px_30px_rgba(0,0,0,.15)] lg:w-[290px]"
        >
          <Search
            className={`h-3.5 w-3.5 transition ${
              search
                ? "text-cyan-100/60"
                : "text-white/20 group-focus-within:text-cyan-100/45"
            }`}
          />

          <input
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            placeholder="Oyun axtar..."
            spellCheck={false}
            className="min-w-0 flex-1 appearance-none bg-transparent py-3 text-[10px] text-white/70 outline-none placeholder:text-white/15"
          />

          <AnimatePresence>
            {search && (
              <motion.button
                type="button"
                initial={{
                  opacity: 0,
                  scale: 0.8,
                }}
                animate={{
                  opacity: 1,
                  scale: 1,
                }}
                exit={{
                  opacity: 0,
                  scale: 0.8,
                }}
                onClick={() => setSearch("")}
                className="flex h-5 w-5 items-center justify-center rounded-md text-white/20 transition hover:bg-white/[0.05] hover:text-white/55"
              >
                <X className="h-3 w-3" />
              </motion.button>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* Results info while searching */}
      <AnimatePresence initial={false}>
        {search && (
          <motion.div
            initial={{
              height: 0,
              opacity: 0,
            }}
            animate={{
              height: 27,
              opacity: 1,
            }}
            exit={{
              height: 0,
              opacity: 0,
            }}
            className="overflow-hidden"
          >
            <p className="text-[9px] text-white/20">
              {visibleGames.length} oyun tapıldı
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Game grid */}
      <motion.div
        layout
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
      >
        <AnimatePresence mode="popLayout">
          {visibleGames.map(
            (game, index) => {
              const Icon = game.icon;

              return (
                <motion.button
                  layout
                  key={game.id}
                  type="button"
                  initial={
                    animateCards
                      ? {
                          opacity: 0,
                          y: 10,
                          scale: 0.985,
                        }
                      : {
                          opacity: 0,
                          scale: 0.985,
                        }
                  }
                  animate={{
                    opacity: 1,
                    y: 0,
                    scale: 1,
                  }}
                  exit={{
                    opacity: 0,
                    scale: 0.97,
                    transition: {
                      duration: 0.12,
                    },
                  }}
                  transition={{
                    delay: animateCards
                      ? Math.min(
                          index * 0.025,
                          0.22
                        )
                      : 0,
                    duration: 0.32,
                    ease: [
                      0.22,
                      1,
                      0.36,
                      1,
                    ],
                  }}
                  whileTap={{
                    scale: 0.985,
                  }}
                  onMouseEnter={() =>
                    audio.play("hover")
                  }
                  onClick={() =>
                    openGame(game)
                  }
                  className="group relative min-h-[190px] overflow-hidden rounded-[21px] border border-white/[0.075] bg-[linear-gradient(145deg,#101214_0%,#0b0d0f_55%,#090a0c_100%)] p-5 text-left shadow-[inset_0_1px_0_rgba(255,255,255,.025),0_18px_45px_rgba(0,0,0,.20)] transition-[border-color,box-shadow,transform] duration-300 hover:-translate-y-[2px] hover:border-white/[0.14] hover:shadow-[inset_0_1px_0_rgba(255,255,255,.04),0_24px_60px_rgba(0,0,0,.32)]"
                  style={
                    {
                      "--game-accent":
                        game.accent,
                    } as React.CSSProperties
                  }
                >
                  {/* Per-game color wash */}
                  <div
                    className="pointer-events-none absolute inset-0 opacity-25 transition-opacity duration-500 group-hover:opacity-45"
                    style={{
                      background:
                        game.gradient,
                    }}
                  />

                  {/* Moving hover light */}
                  <div
                    className="pointer-events-none absolute -right-12 -top-14 h-[130px] w-[130px] rounded-full opacity-[0.10] blur-[48px] transition-all duration-500 group-hover:-right-8 group-hover:-top-10 group-hover:opacity-[0.20]"
                    style={{
                      background:
                        game.glow,
                    }}
                  />

                  {/* Fine grid */}
                  <div
                    className="pointer-events-none absolute inset-0 opacity-[0.018] transition-opacity duration-300 group-hover:opacity-[0.032]"
                    style={{
                      backgroundImage:
                        "linear-gradient(rgba(255,255,255,.35) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.35) 1px, transparent 1px)",
                      backgroundSize:
                        "28px 28px",
                      maskImage:
                        "linear-gradient(to left, black, transparent 72%)",
                      WebkitMaskImage:
                        "linear-gradient(to left, black, transparent 72%)",
                    }}
                  />

                  {/* Large decorative symbol */}
                  <div
                    className="pointer-events-none absolute -bottom-7 right-3 select-none text-[100px] font-black leading-none opacity-[0.012] transition-all duration-500 group-hover:-translate-y-1 group-hover:scale-[1.03] group-hover:opacity-[0.028]"
                    style={{
                      color: game.accent,
                    }}
                  >
                    {game.symbol}
                  </div>

                  {/* top */}
                  <div className="relative flex items-start justify-between">
                    <motion.div
                      className="relative flex h-[43px] w-[43px] items-center justify-center overflow-hidden rounded-[13px] border"
                      style={{
                        borderColor:
                          game.accentBorder,
                        background:
                          game.accentSoft,
                        color:
                          game.accentText,
                      }}
                      whileHover={{
                        rotate: -3,
                        scale: 1.05,
                      }}
                      transition={{
                        type: "spring",
                        stiffness: 350,
                        damping: 20,
                      }}
                    >
                      <div
                        className="pointer-events-none absolute inset-x-1 top-0 h-px"
                        style={{
                          background: `linear-gradient(90deg, transparent, ${game.accent}, transparent)`,
                          opacity: 0.45,
                        }}
                      />

                      <Icon className="relative h-[18px] w-[18px]" />
                    </motion.div>

                    <div
                      className="rounded-full border px-2.5 py-1 text-[8px] font-semibold tracking-[0.08em]"
                      style={{
                        borderColor:
                          game.accentBorder,
                        background:
                          game.accentSoft,
                        color:
                          game.accentText,
                      }}
                    >
                      {game.tag}
                    </div>
                  </div>

                  {/* content */}
                  <div className="relative mt-8">
                    <div className="flex items-center gap-2">
                      <h2 className="text-[15px] font-semibold tracking-[-0.025em] text-white/90 transition-colors group-hover:text-white">
                        {game.name}
                      </h2>

                      <ArrowRight
                        className="h-3.5 w-3.5 -translate-x-1 text-white/0 transition-all duration-300 group-hover:translate-x-0"
                        style={{
                          color: game.accent,
                        }}
                      />
                    </div>

                    <p className="mt-1.5 text-[10px] leading-5 text-white/30 transition-colors group-hover:text-white/42">
                      {game.description}
                    </p>
                  </div>

                  {/* bottom detail */}
                  <div className="absolute bottom-4 left-5 right-5 flex items-center justify-between">
                    <span className="text-[8px] font-medium uppercase tracking-[0.14em] text-white/15">
                      {categoryLabel(
                        game.category
                      )}
                    </span>

                    <div className="flex items-center gap-1.5">
                      <span
                        className="h-1 w-1 rounded-full"
                        style={{
                          background:
                            game.accent,
                          boxShadow: `0 0 8px ${game.accent}`,
                        }}
                      />

                      <span className="text-[8px] font-medium text-white/18">
                        Hazır
                      </span>
                    </div>
                  </div>

                  {/* Bottom accent */}
                  <div
                    className="pointer-events-none absolute bottom-0 left-[12%] h-px w-0 opacity-0 transition-all duration-500 group-hover:w-[76%] group-hover:opacity-30"
                    style={{
                      background: `linear-gradient(90deg, transparent, ${game.accent}, transparent)`,
                    }}
                  />
                </motion.button>
              );
            }
          )}
        </AnimatePresence>
      </motion.div>

      {/* Empty search */}
      <AnimatePresence>
        {visibleGames.length === 0 && (
          <motion.div
            initial={{
              opacity: 0,
              y: 5,
            }}
            animate={{
              opacity: 1,
              y: 0,
            }}
            exit={{
              opacity: 0,
            }}
            className="flex min-h-[260px] flex-col items-center justify-center rounded-[21px] border border-white/[0.055] bg-[#090a0c]"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-[14px] border border-white/[0.06] bg-white/[0.025]">
              <Search className="h-4 w-4 text-white/20" />
            </div>

            <p className="mt-4 text-[12px] font-medium text-white/55">
              Oyun tapılmadı
            </p>

            <p className="mt-1 text-[9px] text-white/20">
              Axtarışı və ya filtri dəyiş.
            </p>

            <button
              type="button"
              onClick={() => {
                setSearch("");
                setFilter("all");
              }}
              className="mt-4 rounded-[9px] border border-white/[0.065] bg-white/[0.025] px-3 py-2 text-[9px] text-white/35 transition hover:bg-white/[0.05] hover:text-white/65"
            >
              Hamısını göstər
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
