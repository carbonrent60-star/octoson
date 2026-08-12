"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  Activity,
  Bomb,
  Check,
  ChevronDown,
  CircleDollarSign,
  CircleGauge,
  Coins,
  Crown,
  Dice5,
  Gamepad2,
  Gem,
  Goal,
  Layers3,
  RefreshCcw,
  RotateCcw,
  Spade,
  TrendingUp,
  Trophy,
  X,
} from "lucide-react";

import {
  AnimatePresence,
  motion,
} from "motion/react";

type CasinoStatRow = {
  id?: string;
  game?: string;
  amount?: number;
  net?: number;
  payout?: number;
  won?: boolean;
  createdAt?: string;
  balanceBefore?: number | null;
  balanceAfter?: number | null;
};

type ApiResponse = {
  transactions?: CasinoStatRow[];
  rows?: CasinoStatRow[];
  data?: CasinoStatRow[];
};

type DockSide = "left" | "right";

type DockPosition = {
  side: DockSide;
  y: number;
};

type DragState = {
  pointerId: number;
  startY: number;
  originY: number;
};

const DOCK_GAP = 12;
const DEFAULT_Y = 96;
const PANEL_FALLBACK_HEIGHT = 440;

const GAME_NAMES: Record<string, string> = {
  all: "Bütün oyunlar",
  coinflip: "Coinflip",
  dice: "Dice",
  mines: "Mines",
  roulette: "Roulette",
  crash: "Crash",
  wheel: "Lucky Wheel",
  rps: "RPS",
  baccarat: "Baccarat",
  poker: "Poker",
  horse: "Horse Racing",
  penalty: "Penalty",
  lottery: "Lottery",
  jackpot: "Jackpot",
  blackjack: "Blackjack",
  slots: "Slots",
  risk: "Risk",
  tower: "Tower",
  higherlower: "Higher / Lower",
};

const GAME_ICONS: Record<
  string,
  React.ElementType
> = {
  all: Activity,
  coinflip: Coins,
  dice: Dice5,
  mines: Bomb,
  roulette: CircleDollarSign,
  crash: CircleGauge,
  wheel: RotateCcw,
  rps: Gamepad2,
  baccarat: Layers3,
  poker: Spade,
  horse: Trophy,
  penalty: Goal,
  lottery: Coins,
  jackpot: Gem,
  blackjack: Spade,
  slots: Gem,
  risk: TrendingUp,
  tower: Crown,
  higherlower: TrendingUp,
};

function number(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatAura(value: number) {
  const abs = Math.abs(Math.round(value));

  if (abs >= 1_000_000) {
    return `${(abs / 1_000_000).toFixed(
      abs >= 10_000_000 ? 0 : 1
    )}M`;
  }

  if (abs >= 1000) {
    return `${(abs / 1000).toFixed(
      abs >= 100_000 ? 0 : 1
    )}K`;
  }

  return abs.toLocaleString("en-US");
}

function gameFromRow(row: CasinoStatRow) {
  return String(row.game ?? "")
    .trim()
    .toLowerCase();
}

function getNet(row: CasinoStatRow) {
  if (Number.isFinite(Number(row.net))) {
    return number(row.net);
  }

  if (
    row.balanceBefore != null &&
    row.balanceAfter != null
  ) {
    return (
      number(row.balanceAfter) -
      number(row.balanceBefore)
    );
  }

  return 0;
}

function getBet(row: CasinoStatRow) {
  return Math.abs(number(row.amount));
}

function buildGraph(rows: CasinoStatRow[]) {
  const ordered = [...rows].reverse();

  let running = 0;
  const values = [0];

  for (const row of ordered) {
    running += getNet(row);
    values.push(running);
  }

  if (values.length === 1) {
    values.push(0);
  }

  return values;
}

function Graph({
  values,
}: {
  values: number[];
}) {
  const gradientId = useId().replace(/:/g, "");

  const width = 284;
  const height = 108;
  const padX = 8;
  const padY = 12;

  const min = Math.min(...values, 0);
  const max = Math.max(...values, 0);
  const range = Math.max(max - min, 1);

  const points = values.map((value, index) => {
    const x =
      padX +
      (index / Math.max(values.length - 1, 1)) *
        (width - padX * 2);

    const y =
      padY +
      ((max - value) / range) *
        (height - padY * 2);

    return { x, y };
  });

  const path = points
    .map(
      (point, index) =>
        `${index === 0 ? "M" : "L"} ${point.x.toFixed(
          2
        )} ${point.y.toFixed(2)}`
    )
    .join(" ");

  const zeroY =
    padY +
    ((max - 0) / range) *
      (height - padY * 2);

  const last = points[points.length - 1];

  const positive =
    values[values.length - 1] >= 0;

  const stroke = positive
    ? "rgba(52,211,153,.96)"
    : "rgba(251,113,133,.96)";

  const glow = positive
    ? "rgba(52,211,153,.32)"
    : "rgba(251,113,133,.32)";

  const area =
    `${path} ` +
    `L ${last.x.toFixed(2)} ${(height - padY).toFixed(
      2
    )} ` +
    `L ${points[0].x.toFixed(2)} ${(height - padY).toFixed(
      2
    )} Z`;

  return (
    <motion.div
      key={`${values.length}-${values[values.length - 1]}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.28 }}
      className="relative h-[108px] w-full overflow-hidden"
    >
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-full w-full overflow-visible"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient
            id={gradientId}
            x1="0"
            y1="0"
            x2="0"
            y2="1"
          >
            <stop
              offset="0%"
              stopColor={stroke}
              stopOpacity=".22"
            />
            <stop
              offset="58%"
              stopColor={stroke}
              stopOpacity=".075"
            />
            <stop
              offset="100%"
              stopColor={stroke}
              stopOpacity="0"
            />
          </linearGradient>

          <filter
            id={`${gradientId}-glow`}
            x="-40%"
            y="-40%"
            width="180%"
            height="180%"
          >
            <feGaussianBlur stdDeviation="3" />
          </filter>
        </defs>

        <line
          x1={padX}
          x2={width - padX}
          y1={zeroY}
          y2={zeroY}
          stroke="rgba(255,255,255,.055)"
          strokeWidth="1"
          strokeDasharray="3 5"
        />

        <motion.path
          d={area}
          fill={`url(#${gradientId})`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{
            duration: 0.55,
            delay: 0.08,
          }}
        />

        <motion.path
          d={path}
          fill="none"
          stroke={stroke}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          initial={{
            pathLength: 0,
            opacity: 0,
          }}
          animate={{
            pathLength: 1,
            opacity: 1,
          }}
          transition={{
            pathLength: {
              duration: 0.65,
              ease: [0.22, 1, 0.36, 1],
            },
            opacity: {
              duration: 0.18,
            },
          }}
        />

        <motion.circle
          cx={last.x}
          cy={last.y}
          r="7"
          fill={glow}
          filter={`url(#${gradientId}-glow)`}
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{
            opacity: [0.25, 0.7, 0.25],
            scale: [0.85, 1.15, 0.85],
          }}
          transition={{
            opacity: {
              duration: 2.2,
              repeat: Infinity,
            },
            scale: {
              duration: 2.2,
              repeat: Infinity,
            },
          }}
        />

        <motion.circle
          cx={last.x}
          cy={last.y}
          r="2.6"
          fill={stroke}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{
            type: "spring",
            stiffness: 420,
            damping: 22,
            delay: 0.42,
          }}
        />
      </svg>
    </motion.div>
  );
}

function Metric({
  label,
  value,
  suffix,
  tone = "neutral",
}: {
  label: string;
  value: string | number;
  suffix?: string;
  tone?: "positive" | "negative" | "neutral";
}) {
  const valueClass =
    tone === "positive"
      ? "text-emerald-400 drop-shadow-[0_0_10px_rgba(52,211,153,.13)]"
      : tone === "negative"
        ? "text-rose-400 drop-shadow-[0_0_10px_rgba(251,113,133,.13)]"
        : "text-white/[0.72]";

  return (
    <div className="min-w-0 px-3.5 py-3 sm:py-2.5">
      <p className="text-[7px] font-semibold uppercase tracking-[0.13em] text-white/[0.22]">
        {label}
      </p>

      <AnimatePresence mode="popLayout" initial={false}>
        <motion.p
          key={`${value}`}
          initial={{
            opacity: 0,
            y: 5,
            filter: "blur(3px)",
          }}
          animate={{
            opacity: 1,
            y: 0,
            filter: "blur(0px)",
          }}
          exit={{
            opacity: 0,
            y: -4,
            filter: "blur(2px)",
          }}
          transition={{
            duration: 0.2,
            ease: [0.22, 1, 0.36, 1],
          }}
          className={`mt-1 text-[15px] font-semibold tracking-[-0.035em] ${valueClass}`}
        >
          {value}

          {suffix ? (
            <span className="ml-1 text-[6px] font-medium uppercase tracking-[0.08em] text-white/[0.18]">
              {suffix}
            </span>
          ) : null}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}

export default function LiveStats() {
  const panelRef =
    useRef<HTMLDivElement | null>(null);

  const selectorRef =
    useRef<HTMLDivElement | null>(null);

  const dragRef =
    useRef<DragState | null>(null);

  const [open, setOpen] = useState(false);
  const [selectorOpen, setSelectorOpen] =
    useState(false);

  const [loading, setLoading] = useState(false);

  const [isDragging, setIsDragging] =
    useState(false);

  const [mobile, setMobile] = useState(false);

  const [rows, setRows] =
    useState<CasinoStatRow[]>([]);

  const [game, setGame] = useState("all");

  const [resetAt, setResetAt] =
    useState<number | null>(null);

  const [position, setPosition] =
    useState<DockPosition>({
      side: "right",
      y: DEFAULT_Y,
    });

  const [positionReady, setPositionReady] =
    useState(false);

  const load = useCallback(async () => {
    setLoading(true);

    try {
      const response = await fetch(
        "/api/casino/stats",
        {
          cache: "no-store",
        }
      );

      if (!response.ok) {
        throw new Error("stats_request_failed");
      }

      const json =
        (await response.json()) as ApiResponse;

      const nextRows =
        json.transactions ??
        json.rows ??
        json.data ??
        [];

      setRows(
        Array.isArray(nextRows)
          ? nextRows
          : []
      );
    } catch (error) {
      console.error(
        "[LIVE STATS] Failed to load:",
        error
      );
    } finally {
      setLoading(false);
    }
  }, []);

  function clampY(y: number) {
    const height =
      panelRef.current?.offsetHeight ??
      PANEL_FALLBACK_HEIGHT;

    return Math.min(
      Math.max(DOCK_GAP, y),
      Math.max(
        DOCK_GAP,
        window.innerHeight -
          height -
          DOCK_GAP
      )
    );
  }

  function saveDock(next: DockPosition) {
    window.localStorage.setItem(
      "octoson-live-stats-dock",
      JSON.stringify(next)
    );
  }

  useEffect(() => {
    function handleOpenStats() {
      setOpen(true);
    }

    window.addEventListener(
      "octoson-live-stats-open",
      handleOpenStats
    );

    return () => {
      window.removeEventListener(
        "octoson-live-stats-open",
        handleOpenStats
      );
    };
  }, []);

  useEffect(() => {
    function detectMobile() {
      setMobile(
        window.matchMedia(
          "(max-width: 640px)"
        ).matches
      );
    }

    detectMobile();

    window.addEventListener(
      "resize",
      detectMobile
    );

    return () =>
      window.removeEventListener(
        "resize",
        detectMobile
      );
  }, []);

  useEffect(() => {
    const savedReset =
      window.localStorage.getItem(
        "octoson-casino-stats-reset"
      );

    if (savedReset) {
      const parsed = Number(savedReset);

      if (Number.isFinite(parsed)) {
        setResetAt(parsed);
      }
    }

    const savedDock =
      window.localStorage.getItem(
        "octoson-live-stats-dock"
      );

    if (savedDock) {
      try {
        const parsed = JSON.parse(
          savedDock
        ) as Partial<DockPosition>;

        if (
          (parsed.side === "left" ||
            parsed.side === "right") &&
          Number.isFinite(parsed.y)
        ) {
          setPosition({
            side: parsed.side,
            y: Number(parsed.y),
          });

          setPositionReady(true);
          return;
        }
      } catch {}
    }

    window.localStorage.removeItem(
      "octoson-live-stats-position"
    );

    setPosition({
      side: "right",
      y: DEFAULT_Y,
    });

    setPositionReady(true);
  }, []);

  useEffect(() => {
    void load();

    const timer = window.setInterval(
      () => void load(),
      5000
    );

    return () =>
      window.clearInterval(timer);
  }, [load]);

  /*
   * Rows belonging to the CURRENT Live Stats session.
   * Anything before resetAt is historical and must not
   * appear in stats OR in the game selector.
   */
  const sessionRows = useMemo(() => {
    if (!resetAt) {
      return rows;
    }

    return rows.filter((row) => {
      const raw = row.createdAt;

      if (!raw) {
        return false;
      }

      const time = new Date(raw).getTime();

      return (
        Number.isFinite(time) &&
        time >= resetAt
      );
    });
  }, [rows, resetAt]);

  /*
   * Selector is derived ONLY from the current session.
   */
  const playedGames = useMemo(() => {
    return Array.from(
      new Set(
        sessionRows
          .map(gameFromRow)
          .filter(Boolean)
      )
    );
  }, [sessionRows]);

  const availableGames = useMemo(
    () => ["all", ...playedGames],
    [playedGames]
  );

  const gameCounts = useMemo(() => {
    const counts: Record<string, number> = {};

    for (const row of sessionRows) {
      const value = gameFromRow(row);

      if (!value) {
        continue;
      }

      counts[value] =
        (counts[value] ?? 0) + 1;
    }

    return counts;
  }, [sessionRows]);

  useEffect(() => {
    if (
      game !== "all" &&
      !playedGames.includes(game)
    ) {
      setGame("all");
    }
  }, [game, playedGames]);

  useEffect(() => {
    function outside(event: PointerEvent) {
      if (
        selectorRef.current &&
        !selectorRef.current.contains(
          event.target as Node
        )
      ) {
        setSelectorOpen(false);
      }
    }

    if (selectorOpen && !mobile) {
      window.addEventListener(
        "pointerdown",
        outside
      );
    }

    return () =>
      window.removeEventListener(
        "pointerdown",
        outside
      );
  }, [selectorOpen, mobile]);

  useEffect(() => {
    if (!selectorOpen || !mobile) {
      return;
    }

    const previous =
      document.body.style.overflow;

    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow =
        previous;
    };
  }, [selectorOpen, mobile]);

  const filtered = useMemo(() => {
    if (game === "all") {
      return sessionRows;
    }

    return sessionRows.filter(
      (row) => gameFromRow(row) === game
    );
  }, [sessionRows, game]);

  const stats = useMemo(() => {
    let wagered = 0;
    let profit = 0;
    let wins = 0;
    let losses = 0;

    for (const row of filtered) {
      wagered += getBet(row);

      const net = getNet(row);

      profit += net;

      if (
        row.won === true ||
        net > 0
      ) {
        wins += 1;
      } else if (
        row.won === false ||
        net < 0
      ) {
        losses += 1;
      }
    }

    return {
      wagered,
      profit,
      wins,
      losses,
      graph: buildGraph(filtered),
    };
  }, [filtered]);

  function resetStats() {
    const now = Date.now();

    /*
     * Immediately start a completely clean UI session.
     * Database/history stays untouched.
     */
    setResetAt(now);
    setGame("all");
    setSelectorOpen(false);

    window.localStorage.setItem(
      "octoson-casino-stats-reset",
      String(now)
    );
  }

  function chooseGame(value: string) {
    setGame(value);
    setSelectorOpen(false);
  }

  function startDrag(
    event: React.PointerEvent<HTMLDivElement>
  ) {
    if (mobile) {
      return;
    }

    const target =
      event.target as HTMLElement;

    if (
      target.closest(
        "button, a, input"
      )
    ) {
      return;
    }

    dragRef.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      originY: position.y,
    };

    setIsDragging(true);

    event.currentTarget.setPointerCapture(
      event.pointerId
    );
  }

  function moveDrag(
    event: React.PointerEvent<HTMLDivElement>
  ) {
    if (mobile) {
      return;
    }

    const drag = dragRef.current;

    if (
      !drag ||
      drag.pointerId !== event.pointerId
    ) {
      return;
    }

    const nextSide: DockSide =
      event.clientX <
      window.innerWidth / 2
        ? "left"
        : "right";

    const nextY = clampY(
      drag.originY +
        event.clientY -
        drag.startY
    );

    setPosition({
      side: nextSide,
      y: nextY,
    });
  }

  function endDrag(
    event: React.PointerEvent<HTMLDivElement>
  ) {
    if (mobile) {
      return;
    }

    const drag = dragRef.current;

    if (
      !drag ||
      drag.pointerId !== event.pointerId
    ) {
      return;
    }

    const finalPosition: DockPosition = {
      side:
        event.clientX <
        window.innerWidth / 2
          ? "left"
          : "right",

      y: clampY(
        drag.originY +
          event.clientY -
          drag.startY
      ),
    };

    setPosition(finalPosition);
    saveDock(finalPosition);

    dragRef.current = null;
    setIsDragging(false);

    try {
      event.currentTarget.releasePointerCapture(
        event.pointerId
      );
    } catch {}
  }

  useEffect(() => {
    function resize() {
      if (
        window.matchMedia(
          "(max-width: 640px)"
        ).matches
      ) {
        return;
      }

      setPosition((current) => {
        const next = {
          ...current,
          y: clampY(current.y),
        };

        saveDock(next);

        return next;
      });
    }

    window.addEventListener(
      "resize",
      resize
    );

    return () =>
      window.removeEventListener(
        "resize",
        resize
      );
  }, []);

  if (!positionReady) {
    return null;
  }

  const SelectedIcon =
    GAME_ICONS[game] ?? Activity;

  const dockStyle: React.CSSProperties =
    mobile
      ? {
          left: 10,
          right: 10,
          bottom:
            "calc(76px + env(safe-area-inset-bottom))",
        }
      : {
          top: position.y,
          left:
            position.side === "left"
              ? DOCK_GAP
              : undefined,
          right:
            position.side === "right"
              ? DOCK_GAP
              : undefined,
        };

  const collapsedStyle: React.CSSProperties =
    mobile
      ? {
          right: 14,
          bottom:
            "calc(78px + env(safe-area-inset-bottom))",
        }
      : dockStyle;

  return (
    <>
      <AnimatePresence>
        {open ? (
          <motion.div
            key="live-stats-panel"
            ref={panelRef}
            initial={
              mobile
                ? {
                    opacity: 0,
                    y: 35,
                    scale: 0.97,
                    filter: "blur(8px)",
                  }
                : {
                    opacity: 0,
                    scale: 0.94,
                    x:
                      position.side === "right"
                        ? 18
                        : -18,
                    filter: "blur(7px)",
                  }
            }
            animate={{
              opacity: 1,
              y: 0,
              x: 0,
              scale: 1,
              filter: "blur(0px)",
            }}
            exit={
              mobile
                ? {
                    opacity: 0,
                    y: 30,
                    scale: 0.97,
                    filter: "blur(6px)",
                  }
                : {
                    opacity: 0,
                    scale: 0.95,
                    x:
                      position.side === "right"
                        ? 14
                        : -14,
                    filter: "blur(5px)",
                  }
            }
            transition={{
              type: "spring",
              stiffness: 330,
              damping: 30,
              mass: 0.75,
            }}
            className="
              fixed z-[80]
              w-[324px]
              max-w-[calc(100vw-20px)]
              overflow-visible
              rounded-[20px]
              border border-white/[0.085]
              bg-[#0a0b0d]/[0.88]
              shadow-[0_28px_90px_rgba(0,0,0,.62),0_1px_0_rgba(255,255,255,.055)_inset,0_-1px_0_rgba(0,0,0,.35)_inset]
              backdrop-blur-[30px]
              max-sm:w-auto
              max-sm:rounded-[22px]
              max-sm:bg-[#101113]
              max-sm:backdrop-blur-none
              max-sm:border-white/[0.10]
              max-sm:shadow-[0_24px_80px_rgba(0,0,0,.82),0_1px_0_rgba(255,255,255,.06)_inset]
            "
            style={dockStyle}
          >
            <div className="pointer-events-none absolute inset-[1px] overflow-hidden rounded-[19px] max-sm:rounded-[21px]">
              <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-white/[0.028] to-transparent" />

              <div
                className={`absolute -top-20 h-40 w-40 rounded-full blur-[70px] transition-all duration-700 ${
                  stats.profit >= 0
                    ? "bg-emerald-400/[0.035]"
                    : "bg-rose-400/[0.035]"
                } ${
                  position.side === "right"
                    ? "-right-12"
                    : "-left-12"
                }`}
              />
            </div>

            <div
              onPointerDown={startDrag}
              onPointerMove={moveDrag}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              className="
                relative flex h-12 touch-none select-none
                items-center border-b border-white/[0.055]
                px-3.5
                max-sm:h-[52px]
              "
              style={{
                cursor: mobile
                  ? "default"
                  : isDragging
                    ? "grabbing"
                    : "grab",
              }}
            >
              {mobile ? (
                <div className="absolute left-1/2 top-[6px] h-[3px] w-9 -translate-x-1/2 rounded-full bg-white/[0.11]" />
              ) : null}

              <div className="flex min-w-0 flex-1 items-center gap-2.5">
                <motion.div
                  animate={
                    loading
                      ? {
                          scale: [1, 1.08, 1],
                        }
                      : { scale: 1 }
                  }
                  transition={{
                    duration: 1.1,
                    repeat: loading
                      ? Infinity
                      : 0,
                  }}
                  className="flex h-7 w-7 items-center justify-center rounded-[9px] border border-white/[0.065] bg-white/[0.035] shadow-[0_1px_0_rgba(255,255,255,.025)_inset]"
                >
                  <Activity
                    size={12}
                    className="text-white/[0.48]"
                  />
                </motion.div>

                <div className="min-w-0">
                  <p className="text-[10px] font-semibold tracking-[-0.015em] text-white/[0.76]">
                    Live Stats
                  </p>

                  <div className="mt-[1px] flex items-center gap-1.5">
                    <span
                      className={`h-1 w-1 rounded-full ${
                        loading
                          ? "animate-pulse bg-white/30"
                          : "bg-emerald-400/55"
                      }`}
                    />

                    <p className="text-[6.5px] font-medium uppercase tracking-[0.15em] text-white/[0.19]">
                      Casino session
                    </p>
                  </div>
                </div>
              </div>

              {!mobile ? (
                <div className="mr-2 flex items-center gap-[3px] opacity-20 transition-opacity group-hover:opacity-50">
                  <span className="h-[3px] w-[3px] rounded-full bg-white/50" />
                  <span className="h-[3px] w-[3px] rounded-full bg-white/50" />
                  <span className="h-[3px] w-[3px] rounded-full bg-white/50" />
                </div>
              ) : null}

              <motion.button
                type="button"
                onClick={resetStats}
                whileTap={{ scale: 0.82 }}
                whileHover={
                  mobile
                    ? undefined
                    : { scale: 1.06 }
                }
                title="Statistikanı sıfırla"
                className="flex h-8 w-8 items-center justify-center rounded-[10px] text-white/[0.25] transition-colors hover:bg-white/[0.05] hover:text-white/[0.68]"
              >
                <motion.span
                  animate={
                    loading
                      ? { rotate: 360 }
                      : { rotate: 0 }
                  }
                  transition={
                    loading
                      ? {
                          duration: 0.9,
                          repeat: Infinity,
                          ease: "linear",
                        }
                      : {
                          type: "spring",
                        }
                  }
                >
                  <RefreshCcw size={12} />
                </motion.span>
              </motion.button>

              <motion.button
                type="button"
                onClick={() => {
                  setSelectorOpen(false);
                  setOpen(false);
                }}
                whileTap={{ scale: 0.82 }}
                whileHover={
                  mobile
                    ? undefined
                    : { scale: 1.06 }
                }
                className="ml-0.5 flex h-8 w-8 items-center justify-center rounded-[10px] text-white/[0.25] transition-colors hover:bg-white/[0.05] hover:text-white/[0.68]"
                aria-label="Bağla"
              >
                <X size={13} />
              </motion.button>
            </div>

            <div className="relative p-3 max-sm:p-3.5">
              <div
                ref={selectorRef}
                className="relative z-30 mb-2.5"
              >
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.985 }}
                  onClick={() =>
                    setSelectorOpen(
                      (current) => !current
                    )
                  }
                  className={`
                    flex h-10 w-full items-center rounded-[12px]
                    border px-2.5 text-left
                    shadow-[0_1px_0_rgba(255,255,255,.025)_inset]
                    transition-colors
                    ${
                      selectorOpen
                        ? "border-white/[0.11] bg-white/[0.055]"
                        : "border-white/[0.055] bg-white/[0.025] hover:border-white/[0.085] hover:bg-white/[0.04]"
                    }
                  `}
                >
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[8px] bg-white/[0.04]">
                    <SelectedIcon
                      size={11}
                      strokeWidth={1.8}
                      className="text-white/[0.47]"
                    />
                  </div>

                  <div className="ml-2 min-w-0 flex-1">
                    <p className="truncate text-[9px] font-semibold tracking-[-0.01em] text-white/[0.68]">
                      {GAME_NAMES[game] ?? game}
                    </p>

                    <p className="mt-[1px] text-[6.5px] font-medium text-white/[0.18]">
                      {game === "all"
                        ? `${playedGames.length} oyun növü`
                        : `${gameCounts[game] ?? 0} oyun`}
                    </p>
                  </div>

                  <motion.div
                    animate={{
                      rotate: selectorOpen
                        ? 180
                        : 0,
                    }}
                    transition={{
                      type: "spring",
                      stiffness: 420,
                      damping: 28,
                    }}
                    className="flex h-6 w-6 items-center justify-center"
                  >
                    <ChevronDown
                      size={12}
                      className="text-white/[0.27]"
                    />
                  </motion.div>
                </motion.button>

                <AnimatePresence>
                  {selectorOpen && !mobile ? (
                    <motion.div
                      initial={{
                        opacity: 0,
                        y: -6,
                        scale: 0.97,
                        filter: "blur(5px)",
                      }}
                      animate={{
                        opacity: 1,
                        y: 5,
                        scale: 1,
                        filter: "blur(0px)",
                      }}
                      exit={{
                        opacity: 0,
                        y: -4,
                        scale: 0.98,
                        filter: "blur(4px)",
                      }}
                      transition={{
                        type: "spring",
                        stiffness: 410,
                        damping: 30,
                      }}
                      className="absolute left-0 right-0 top-full z-[100] overflow-hidden rounded-[14px] border border-white/[0.085] bg-[#111214]/[0.96] p-1.5 shadow-[0_22px_70px_rgba(0,0,0,.7),0_1px_0_rgba(255,255,255,.045)_inset] backdrop-blur-[30px]"
                    >
                      <div className="max-h-[255px] overflow-y-auto overscroll-contain">
                        {availableGames.map(
                          (value) => {
                            const Icon =
                              GAME_ICONS[value] ??
                              Activity;

                            const selected =
                              game === value;

                            const count =
                              value === "all"
                                ? sessionRows.length
                                : gameCounts[
                                    value
                                  ] ?? 0;

                            return (
                              <motion.button
                                key={value}
                                type="button"
                                whileTap={{
                                  scale: 0.985,
                                }}
                                onClick={() =>
                                  chooseGame(value)
                                }
                                className={`flex h-10 w-full items-center rounded-[10px] px-2 text-left transition-colors ${
                                  selected
                                    ? "bg-white/[0.065]"
                                    : "hover:bg-white/[0.035]"
                                }`}
                              >
                                <div
                                  className={`flex h-7 w-7 items-center justify-center rounded-[8px] border ${
                                    selected
                                      ? "border-white/[0.09] bg-white/[0.055]"
                                      : "border-transparent bg-white/[0.025]"
                                  }`}
                                >
                                  <Icon
                                    size={11}
                                    strokeWidth={1.8}
                                    className={
                                      selected
                                        ? "text-white/[0.7]"
                                        : "text-white/[0.32]"
                                    }
                                  />
                                </div>

                                <div className="ml-2.5 min-w-0 flex-1">
                                  <p
                                    className={`truncate text-[9px] font-semibold ${
                                      selected
                                        ? "text-white/[0.78]"
                                        : "text-white/[0.5]"
                                    }`}
                                  >
                                    {GAME_NAMES[
                                      value
                                    ] ?? value}
                                  </p>

                                  <p className="mt-[1px] text-[6.5px] text-white/[0.18]">
                                    {value === "all"
                                      ? `${playedGames.length} oyun növü`
                                      : `${count} oyun`}
                                  </p>
                                </div>

                                {selected ? (
                                  <Check
                                    size={12}
                                    strokeWidth={2}
                                    className="mr-1 text-white/[0.55]"
                                  />
                                ) : null}
                              </motion.button>
                            );
                          }
                        )}
                      </div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>

              <motion.div
                layout
                className="grid grid-cols-2 overflow-hidden rounded-[14px] border border-white/[0.05] bg-white/[0.018] shadow-[0_1px_0_rgba(255,255,255,.018)_inset]"
              >
                <div className="border-b border-r border-white/[0.045]">
                  <Metric
                    label="Profit"
                    value={`${stats.profit > 0 ? "+" : stats.profit < 0 ? "−" : ""}${formatAura(
                      stats.profit
                    )}`}
                    suffix="Aura"
                    tone={
                      stats.profit > 0
                        ? "positive"
                        : stats.profit < 0
                          ? "negative"
                          : "neutral"
                    }
                  />
                </div>

                <div className="border-b border-white/[0.045]">
                  <Metric
                    label="Wins"
                    value={stats.wins}
                    tone="positive"
                  />
                </div>

                <div className="border-r border-white/[0.045]">
                  <Metric
                    label="Wagered"
                    value={formatAura(
                      stats.wagered
                    )}
                    suffix="Aura"
                  />
                </div>

                <div>
                  <Metric
                    label="Losses"
                    value={stats.losses}
                    tone="negative"
                  />
                </div>
              </motion.div>

              <motion.div
                layout
                className="mt-2.5 overflow-hidden rounded-[14px] border border-white/[0.05] bg-black/[0.16] shadow-[0_1px_0_rgba(255,255,255,.018)_inset]"
              >
                <div className="flex items-center justify-between border-b border-white/[0.04] px-3 py-2">
                  <p className="text-[7px] font-semibold uppercase tracking-[0.13em] text-white/[0.21]">
                    Session performance
                  </p>

                  <AnimatePresence
                    mode="wait"
                    initial={false}
                  >
                    <motion.p
                      key={filtered.length}
                      initial={{
                        opacity: 0,
                        y: 3,
                      }}
                      animate={{
                        opacity: 1,
                        y: 0,
                      }}
                      exit={{
                        opacity: 0,
                        y: -3,
                      }}
                      className="text-[7px] font-medium text-white/[0.18]"
                    >
                      {filtered.length} oyun
                    </motion.p>
                  </AnimatePresence>
                </div>

                <div className="px-2.5 pb-1 pt-1.5">
                  <Graph values={stats.graph} />
                </div>
              </motion.div>

              <div className="mt-2 flex items-center justify-between px-0.5 max-sm:hidden">
                <p className="text-[6px] font-medium text-white/[0.12]">
                  ↕ sürükləmək üçün
                </p>

                <p className="text-[6px] font-medium text-white/[0.12]">
                  {position.side === "left"
                    ? "sol tərəfə bağlanıb"
                    : "sağ tərəfə bağlanıb"}
                </p>
              </div>

              <p className="mt-2 hidden text-center text-[6px] font-medium text-white/[0.12] max-sm:block">
                Live casino session
              </p>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {selectorOpen && mobile ? (
          <>
            <motion.button
              type="button"
              aria-label="Oyun seçimini bağla"
              onClick={() =>
                setSelectorOpen(false)
              }
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{
                duration: 0.2,
              }}
              className="fixed inset-0 z-[110] bg-black/[0.48] backdrop-blur-[3px]"
            />

            <motion.div
              initial={{
                opacity: 0,
                y: "100%",
              }}
              animate={{
                opacity: 1,
                y: 0,
              }}
              exit={{
                opacity: 0,
                y: "100%",
              }}
              transition={{
                type: "spring",
                stiffness: 350,
                damping: 34,
                mass: 0.85,
              }}
              className="fixed inset-x-2 bottom-2 z-[120] overflow-hidden rounded-[24px] border border-white/[0.09] bg-[#111214] shadow-[0_-24px_90px_rgba(0,0,0,.85),0_1px_0_rgba(255,255,255,.06)_inset] backdrop-blur-none"
              style={{
                paddingBottom:
                  "env(safe-area-inset-bottom)",
              }}
            >
              <div className="relative flex h-[54px] items-center border-b border-white/[0.055] px-4">
                <div className="absolute left-1/2 top-[7px] h-[3px] w-9 -translate-x-1/2 rounded-full bg-white/[0.12]" />

                <div className="min-w-0 flex-1 pt-1">
                  <p className="text-[11px] font-semibold tracking-[-0.02em] text-white/[0.8]">
                    Oyun seç
                  </p>

                  <p className="mt-[1px] text-[7px] font-medium text-white/[0.22]">
                    Yalnız oynadığın oyunlar
                  </p>
                </div>

                <motion.button
                  type="button"
                  whileTap={{ scale: 0.85 }}
                  onClick={() =>
                    setSelectorOpen(false)
                  }
                  className="mt-1 flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.055] text-white/[0.42]"
                >
                  <X size={13} />
                </motion.button>
              </div>

              <div className="max-h-[min(58vh,430px)] overflow-y-auto overscroll-contain p-2">
                {availableGames.map(
                  (value, index) => {
                    const Icon =
                      GAME_ICONS[value] ??
                      Activity;

                    const selected =
                      game === value;

                    const count =
                      value === "all"
                        ? sessionRows.length
                        : gameCounts[
                            value
                          ] ?? 0;

                    return (
                      <motion.button
                        key={value}
                        type="button"
                        initial={{
                          opacity: 0,
                          y: 7,
                        }}
                        animate={{
                          opacity: 1,
                          y: 0,
                        }}
                        transition={{
                          delay:
                            Math.min(
                              index,
                              8
                            ) * 0.025,
                        }}
                        whileTap={{
                          scale: 0.98,
                        }}
                        onClick={() =>
                          chooseGame(value)
                        }
                        className={`flex h-[50px] w-full items-center rounded-[14px] px-2.5 text-left transition-colors ${
                          selected
                            ? "bg-white/[0.07]"
                            : "active:bg-white/[0.04]"
                        }`}
                      >
                        <div
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] border ${
                            selected
                              ? "border-white/[0.1] bg-white/[0.065]"
                              : "border-white/[0.035] bg-white/[0.025]"
                          }`}
                        >
                          <Icon
                            size={13}
                            strokeWidth={1.8}
                            className={
                              selected
                                ? "text-white/[0.72]"
                                : "text-white/[0.34]"
                            }
                          />
                        </div>

                        <div className="ml-3 min-w-0 flex-1">
                          <p
                            className={`truncate text-[10px] font-semibold ${
                              selected
                                ? "text-white/[0.82]"
                                : "text-white/[0.52]"
                            }`}
                          >
                            {GAME_NAMES[value] ??
                              value}
                          </p>

                          <p className="mt-[2px] text-[7px] font-medium text-white/[0.19]">
                            {value === "all"
                              ? `${playedGames.length} oyun növü`
                              : `${count} oyun`}
                          </p>
                        </div>

                        {selected ? (
                          <motion.div
                            initial={{
                              scale: 0,
                            }}
                            animate={{
                              scale: 1,
                            }}
                            className="mr-1 flex h-6 w-6 items-center justify-center rounded-full bg-white/[0.07]"
                          >
                            <Check
                              size={12}
                              className="text-white/[0.62]"
                            />
                          </motion.div>
                        ) : null}
                      </motion.button>
                    );
                  }
                )}
              </div>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>
    </>
  );
}
