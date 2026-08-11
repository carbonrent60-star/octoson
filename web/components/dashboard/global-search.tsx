"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  AnimatePresence,
  motion,
} from "motion/react";
import {
  Search,
  X,
  ArrowUpRight,
  Landmark,
  Dices,
  Spade,
  Bomb,
  Layers3,
  Trophy,
  Package,
  Store,
  UserRound,
  Gamepad2,
  Globe2,
  LayoutDashboard,
  CircleDollarSign,
  ShieldCheck,
} from "lucide-react";

type SearchItem = {
  title: string;
  subtitle: string;
  href: string;
  category: string;
  keywords: string[];
  icon: React.ComponentType<{
    className?: string;
  }>;
};

const ITEMS: SearchItem[] = [
  {
    title: "İdarə paneli",
    subtitle: "Əsas səhifə",
    href: "/dashboard",
    category: "Səhifə",
    keywords: ["dashboard", "home", "esas", "ana sehife"],
    icon: LayoutDashboard,
  },
  {
    title: "Casino",
    subtitle: "Bütün casino oyunları",
    href: "/dashboard/casino",
    category: "Casino",
    keywords: ["casino", "kazino", "games", "oyun"],
    icon: Dices,
  },
  {
    title: "Blackjack",
    subtitle: "Casino",
    href: "/dashboard/casino/blackjack",
    category: "Casino",
    keywords: ["blackjack", "black jack", "21", "cards", "kart"],
    icon: Spade,
  },
  {
    title: "Baccarat",
    subtitle: "Casino",
    href: "/dashboard/casino/baccarat",
    category: "Casino",
    keywords: ["baccarat", "bakara", "cards", "kart"],
    icon: CircleDollarSign,
  },
  {
    title: "Mines",
    subtitle: "Casino",
    href: "/dashboard/casino/mines",
    category: "Casino",
    keywords: ["mines", "mine", "mina", "bomb"],
    icon: Bomb,
  },
  {
    title: "Slots",
    subtitle: "Casino",
    href: "/dashboard/casino/slots",
    category: "Casino",
    keywords: ["slots", "slot"],
    icon: Layers3,
  },
  {
    title: "Higher / Lower",
    subtitle: "Casino",
    href: "/dashboard/casino/higherlower",
    category: "Casino",
    keywords: ["higher", "lower", "higherlower"],
    icon: Trophy,
  },
  {
    title: "Risk",
    subtitle: "Casino",
    href: "/dashboard/casino/risk",
    category: "Casino",
    keywords: ["risk"],
    icon: Dices,
  },
  {
    title: "Tower",
    subtitle: "Casino",
    href: "/dashboard/casino/tower",
    category: "Casino",
    keywords: ["tower", "qüllə", "qulle"],
    icon: Layers3,
  },
  {
    title: "Oyunlar",
    subtitle: "Multiplayer oyunlar və otaqlar",
    href: "/dashboard/games",
    category: "Oyunlar",
    keywords: ["games", "oyunlar", "lobby", "room", "otaq"],
    icon: Gamepad2,
  },
  {
    title: "Bank",
    subtitle: "Aura bankı",
    href: "/dashboard/bank",
    category: "Economy",
    keywords: ["bank", "aura", "deposit", "withdraw", "loan", "kredit"],
    icon: Landmark,
  },
  {
    title: "Market",
    subtitle: "Əşyalar və market",
    href: "/dashboard/market",
    category: "Economy",
    keywords: ["market", "shop", "magaza", "mağaza", "item"],
    icon: Store,
  },
  {
    title: "İnventar",
    subtitle: "Əşyaların",
    href: "/dashboard/inventory",
    category: "Profil",
    keywords: ["inventory", "inventar", "items", "esya", "əşya"],
    icon: Package,
  },
  {
    title: "Profil",
    subtitle: "Octoson profilin",
    href: "/dashboard/profile",
    category: "Profil",
    keywords: ["profile", "profil", "account", "hesab"],
    icon: UserRound,
  },
  {
    title: "Liderlər",
    subtitle: "Leaderboard",
    href: "/dashboard/leaderboard",
    category: "Community",
    keywords: ["leaderboard", "lider", "ranking", "rank"],
    icon: Trophy,
  },
  {
    title: "Dünya",
    subtitle: "Octoson World",
    href: "/dashboard/world",
    category: "World",
    keywords: ["world", "dunya", "dünya"],
    icon: Globe2,
  },
  {
    title: "Admin",
    subtitle: "İdarəetmə",
    href: "/dashboard/admin",
    category: "Admin",
    keywords: ["admin", "management", "idare"],
    icon: ShieldCheck,
  },
];

function normalize(value: string) {
  return value
    .toLocaleLowerCase("az")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

export default function GlobalSearch() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [selected, setSelected] = useState(0);

  const results = useMemo(() => {
    const q = normalize(query);

    if (!q) return [];

    return ITEMS
      .map((item) => {
        const title = normalize(item.title);
        const subtitle = normalize(item.subtitle);
        const category = normalize(item.category);
        const keywords = item.keywords.map(normalize);

        let score = 0;

        if (title === q) score += 100;
        else if (title.startsWith(q)) score += 70;
        else if (title.includes(q)) score += 45;

        if (keywords.some((k) => k === q)) score += 80;
        else if (keywords.some((k) => k.startsWith(q))) score += 55;
        else if (keywords.some((k) => k.includes(q))) score += 30;

        if (category.startsWith(q)) score += 20;
        if (subtitle.includes(q)) score += 10;

        return { item, score };
      })
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 7)
      .map((entry) => entry.item);
  }, [query]);

  const open = focused;

  function navigate(item: SearchItem) {
    setQuery("");
    setFocused(false);
    router.push(item.href);
  }

  useEffect(() => {
    setSelected(0);
  }, [query]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (
        (event.metaKey || event.ctrlKey) &&
        event.key.toLowerCase() === "k"
      ) {
        event.preventDefault();
        inputRef.current?.focus();
        return;
      }

      if (!focused) return;

      if (event.key === "Escape") {
        setFocused(false);
        inputRef.current?.blur();
      }

      if (!results.length) return;

      if (event.key === "ArrowDown") {
        event.preventDefault();
        setSelected((value) =>
          Math.min(value + 1, results.length - 1)
        );
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setSelected((value) =>
          Math.max(value - 1, 0)
        );
      }

      if (event.key === "Enter") {
        event.preventDefault();
        navigate(results[selected]);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () =>
      window.removeEventListener("keydown", onKeyDown);
  }, [focused, results, selected]);

  return (
    <div className="relative w-full">
      <motion.div
        animate={{
          borderColor: focused
            ? "rgba(103,232,249,.28)"
            : "rgba(255,255,255,.08)",
          boxShadow: focused
            ? "0 0 0 1px rgba(103,232,249,.04), 0 0 28px rgba(34,211,238,.07)"
            : "0 0 0 1px rgba(255,255,255,0)",
        }}
        transition={{ duration: 0.18 }}
        className="relative flex h-[42px] w-full items-center overflow-hidden rounded-[14px] border bg-[#090b0d]"
      >
        <motion.div
          animate={{
            opacity: focused ? 1 : 0,
          }}
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_50%,rgba(103,232,249,.07),transparent_38%)]"
        />

        <Search
          className={`relative ml-3.5 h-[16px] w-[16px] shrink-0 transition-colors ${
            focused
              ? "text-cyan-100/65"
              : "text-white/32"
          }`}
        />

        <input
          ref={inputRef}
          value={query}
          onChange={(event) =>
            setQuery(event.target.value)
          }
          onFocus={() => setFocused(true)}
          placeholder="Octoson-da axtar..."
          autoComplete="off"
          spellCheck={false}
          className="relative h-full min-w-0 flex-1 bg-transparent px-3 text-[12px] font-medium text-white/90 outline-none placeholder:text-white/25"
        />

        <AnimatePresence mode="wait">
          {query ? (
            <motion.button
              key="clear"
              type="button"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              onMouseDown={(event) =>
                event.preventDefault()
              }
              onClick={() => {
                setQuery("");
                inputRef.current?.focus();
              }}
              className="mr-2 flex h-7 w-7 items-center justify-center rounded-lg text-white/30 transition hover:bg-white/[0.06] hover:text-white/70"
            >
              <X className="h-3.5 w-3.5" />
            </motion.button>
          ) : (
            <motion.div
              key="shortcut"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="mr-2 flex h-6 items-center rounded-[7px] border border-white/[0.07] bg-white/[0.025] px-2 text-[9px] font-medium text-white/20"
            >
              ⌘ K
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <AnimatePresence>
        {open && query.trim() && (
          <>
            <motion.button
              type="button"
              aria-label="Close search"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onMouseDown={() => {
                setFocused(false);
                inputRef.current?.blur();
              }}
              className="fixed inset-0 z-[80] cursor-default bg-transparent"
            />

            <motion.div
              initial={{
                opacity: 0,
                y: -5,
                scale: 0.99,
              }}
              animate={{
                opacity: 1,
                y: 0,
                scale: 1,
              }}
              exit={{
                opacity: 0,
                y: -4,
                scale: 0.99,
              }}
              transition={{
                duration: 0.16,
                ease: [0.22, 1, 0.36, 1],
              }}
              className="absolute left-0 right-0 top-[50px] z-[90] overflow-hidden rounded-[16px] border border-white/[0.09] bg-[#080a0c] p-1.5 shadow-[0_24px_80px_rgba(0,0,0,.72),0_0_0_1px_rgba(255,255,255,.015)]"
              style={{
                WebkitBackdropFilter: "none",
                backdropFilter: "none",
              }}
            >
              {results.length > 0 ? (
                <div className="max-h-[390px] overflow-y-auto">
                  {results.map((item, index) => {
                    const Icon = item.icon;
                    const active =
                      selected === index;

                    return (
                      <button
                        key={item.href}
                        type="button"
                        onMouseEnter={() =>
                          setSelected(index)
                        }
                        onMouseDown={(event) =>
                          event.preventDefault()
                        }
                        onClick={() => navigate(item)}
                        className={`group flex w-full items-center gap-3 rounded-[12px] px-3 py-2.5 text-left transition ${
                          active
                            ? "bg-white/[0.075]"
                            : "bg-transparent hover:bg-white/[0.045]"
                        }`}
                      >
                        <div
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] border transition ${
                            active
                              ? "border-cyan-100/[0.13] bg-cyan-100/[0.055] text-cyan-50/75"
                              : "border-white/[0.07] bg-white/[0.025] text-white/32"
                          }`}
                        >
                          <Icon className="h-[15px] w-[15px]" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[12px] font-medium text-white/85">
                            {item.title}
                          </div>

                          <div className="mt-0.5 truncate text-[10px] text-white/25">
                            {item.subtitle}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="hidden text-[8px] font-semibold uppercase tracking-[0.14em] text-white/16 sm:block">
                            {item.category}
                          </span>

                          <ArrowUpRight
                            className={`h-3.5 w-3.5 transition ${
                              active
                                ? "text-white/50"
                                : "text-white/12"
                            }`}
                          />
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="flex items-center gap-3 px-4 py-5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.025]">
                    <Search className="h-4 w-4 text-white/20" />
                  </div>

                  <div>
                    <p className="text-[12px] font-medium text-white/55">
                      Nəticə tapılmadı
                    </p>
                    <p className="mt-0.5 text-[10px] text-white/22">
                      “{query}” üçün uyğun səhifə yoxdur.
                    </p>
                  </div>
                </div>
              )}

              {results.length > 0 && (
                <div className="mx-2 flex items-center gap-3 border-t border-white/[0.05] px-1 pb-1 pt-2 text-[8px] font-medium text-white/15">
                  <span>↑↓ seç</span>
                  <span>↵ aç</span>
                  <span>esc bağla</span>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
