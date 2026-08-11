"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  X,
  ArrowUpRight,
  Landmark,
  ShoppingBag,
  Trophy,
  UserRound,
  Package,
  Gamepad2,
  Dices,
  Spade,
  Bomb,
  Layers3,
  TrendingUp,
  CircleDollarSign,
  Sparkles,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

type SearchItem = {
  title: string;
  subtitle: string;
  href: string;
  keywords: string[];
  category: string;
  icon: React.ComponentType<{ className?: string }>;
};

const items: SearchItem[] = [
  {
    title: "İdarə paneli",
    subtitle: "Əsas səhifə",
    href: "/dashboard",
    category: "Səhifə",
    keywords: ["dashboard", "home", "ana səhifə", "esas"],
    icon: Sparkles,
  },
  {
    title: "Casino",
    subtitle: "Bütün casino oyunları",
    href: "/dashboard/casino",
    category: "Casino",
    keywords: ["casino", "kazino", "bet", "mərc", "oyun"],
    icon: Dices,
  },
  {
    title: "Blackjack",
    subtitle: "Casino",
    href: "/dashboard/casino/blackjack",
    category: "Casino",
    keywords: ["blackjack", "black jack", "21", "kart"],
    icon: Spade,
  },
  {
    title: "Baccarat",
    subtitle: "Casino",
    href: "/dashboard/casino/baccarat",
    category: "Casino",
    keywords: ["baccarat", "bakara", "kart"],
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
    keywords: ["slots", "slot", "spin"],
    icon: Layers3,
  },
  {
    title: "Tower",
    subtitle: "Casino",
    href: "/dashboard/casino/tower",
    category: "Casino",
    keywords: ["tower", "qüllə", "qulle"],
    icon: TrendingUp,
  },
  {
    title: "Higher or Lower",
    subtitle: "Casino",
    href: "/dashboard/casino/higherlower",
    category: "Casino",
    keywords: ["higher", "lower", "higherlower", "yuxarı", "aşağı"],
    icon: TrendingUp,
  },
  {
    title: "Risk",
    subtitle: "Casino",
    href: "/dashboard/casino/risk",
    category: "Casino",
    keywords: ["risk", "casino"],
    icon: CircleDollarSign,
  },
  {
    title: "Oyunlar",
    subtitle: "Multiplayer və party oyunları",
    href: "/dashboard/games",
    category: "Oyunlar",
    keywords: ["games", "oyunlar", "multiplayer", "party", "reaction", "connect 4"],
    icon: Gamepad2,
  },
  {
    title: "Bank",
    subtitle: "Aura bankçılığı",
    href: "/dashboard/bank",
    category: "Economy",
    keywords: ["bank", "deposit", "withdraw", "loan", "kredit", "aura"],
    icon: Landmark,
  },
  {
    title: "Market",
    subtitle: "Əşyalar və economy",
    href: "/dashboard/market",
    category: "Economy",
    keywords: ["market", "shop", "mağaza", "magaza", "item", "əşya"],
    icon: ShoppingBag,
  },
  {
    title: "İnventar",
    subtitle: "Əşyaların",
    href: "/dashboard/inventory",
    category: "Profil",
    keywords: ["inventory", "inventar", "items", "əşyalar"],
    icon: Package,
  },
  {
    title: "Profil",
    subtitle: "Octoson profilin",
    href: "/dashboard/profile",
    category: "Profil",
    keywords: ["profile", "profil", "account", "hesab", "xp", "level"],
    icon: UserRound,
  },
  {
    title: "Liderlər",
    subtitle: "Leaderboard",
    href: "/dashboard/leaderboard",
    category: "Community",
    keywords: ["leaderboard", "lider", "ranking", "rank", "top"],
    icon: Trophy,
  },
  {
    title: "Dünya",
    subtitle: "Octoson World",
    href: "/dashboard/world",
    category: "World",
    keywords: ["world", "dünya", "dunya"],
    icon: Gamepad2,
  },
];

function normalize(value: string) {
  return value
    .toLocaleLowerCase("az")
    .replace(/ə/g, "e")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ç/g, "c")
    .replace(/ğ/g, "g")
    .trim();
}

export default function GlobalSearch() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(0);

  const results = useMemo(() => {
    const q = normalize(query);

    if (!q) return items.slice(0, 6);

    return items
      .map((item) => {
        const title = normalize(item.title);
        const subtitle = normalize(item.subtitle);
        const keywords = item.keywords.map(normalize);

        let score = 0;

        if (title === q) score += 100;
        if (title.startsWith(q)) score += 60;
        if (title.includes(q)) score += 35;
        if (subtitle.includes(q)) score += 12;

        for (const keyword of keywords) {
          if (keyword === q) score += 50;
          else if (keyword.startsWith(q)) score += 25;
          else if (keyword.includes(q)) score += 10;
        }

        return { item, score };
      })
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .map(({ item }) => item)
      .slice(0, 8);
  }, [query]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
        requestAnimationFrame(() => inputRef.current?.focus());
      }

      if (event.key === "Escape") {
        setOpen(false);
        inputRef.current?.blur();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    setSelected(0);
  }, [query]);

  function go(item: SearchItem) {
    setOpen(false);
    setQuery("");
    inputRef.current?.blur();
    router.push(item.href);
  }

  return (
    <div className="relative w-full max-w-[620px]">
      <motion.div
        animate={{
          boxShadow: open
            ? "0 0 0 1px rgba(103,232,249,.14), 0 16px 60px rgba(0,0,0,.35), 0 0 35px rgba(34,211,238,.055)"
            : "0 0 0 1px rgba(255,255,255,.055), 0 8px 30px rgba(0,0,0,.15)",
        }}
        className="relative overflow-hidden rounded-[16px] bg-white/[0.025] backdrop-blur-xl"
      >
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, x: "-80%" }}
              animate={{ opacity: [0, 1, 0], x: "180%" }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.1, ease: "easeOut" }}
              className="pointer-events-none absolute inset-y-0 w-28 bg-gradient-to-r from-transparent via-cyan-100/[0.055] to-transparent"
            />
          )}
        </AnimatePresence>

        <div className="relative flex h-[42px] items-center">
          <Search
            className={`ml-3.5 h-[16px] w-[16px] transition duration-300 ${
              open ? "text-cyan-100/65" : "text-white/25"
            }`}
          />

          <input
            ref={inputRef}
            value={query}
            onFocus={() => setOpen(true)}
            onChange={(event) => {
              setQuery(event.target.value);
              setOpen(true);
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setSelected((value) =>
                  Math.min(value + 1, Math.max(results.length - 1, 0)),
                );
              }

              if (event.key === "ArrowUp") {
                event.preventDefault();
                setSelected((value) => Math.max(value - 1, 0));
              }

              if (event.key === "Enter" && results[selected]) {
                event.preventDefault();
                go(results[selected]);
              }
            }}
            placeholder="Octoson-da axtar..."
            className="h-full min-w-0 flex-1 bg-transparent px-3 text-[13px] text-white/85 outline-none placeholder:text-white/20"
          />

          {query ? (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                inputRef.current?.focus();
              }}
              className="mr-2 flex h-7 w-7 items-center justify-center rounded-lg text-white/25 transition hover:bg-white/[0.05] hover:text-white/70"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : (
            <div className="mr-2.5 hidden items-center gap-1 rounded-[7px] border border-white/[0.06] bg-black/20 px-2 py-1 text-[9px] font-medium text-white/20 sm:flex">
              <span>⌘</span>
              <span>K</span>
            </div>
          )}
        </div>

        <motion.div
          initial={false}
          animate={{ scaleX: open ? 1 : 0, opacity: open ? 1 : 0 }}
          transition={{ duration: 0.3 }}
          className="absolute bottom-0 left-4 right-4 h-px origin-center bg-gradient-to-r from-transparent via-cyan-200/35 to-transparent"
        />
      </motion.div>

      <AnimatePresence>
        {open && (
          <>
            <button
              type="button"
              aria-label="Axtarışı bağla"
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-[54] cursor-default"
            />

            <motion.div
              initial={{ opacity: 0, y: -7, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -5, scale: 0.99 }}
              transition={{ duration: 0.16 }}
              className="absolute left-0 right-0 top-[50px] z-[55] overflow-hidden rounded-[18px] border border-white/[0.075] bg-[#090a0d]/95 p-2 shadow-[0_30px_90px_rgba(0,0,0,.65)] backdrop-blur-2xl"
            >
              <div className="px-2.5 pb-2 pt-1.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-white/20">
                {query ? "Nəticələr" : "Sürətli keçid"}
              </div>

              {results.length ? (
                <div className="space-y-1">
                  {results.map((item, index) => {
                    const Icon = item.icon;
                    const active = selected === index;

                    return (
                      <button
                        key={item.href}
                        type="button"
                        onMouseEnter={() => setSelected(index)}
                        onClick={() => go(item)}
                        className={`group flex w-full items-center gap-3 rounded-[13px] px-3 py-2.5 text-left transition ${
                          active
                            ? "bg-white/[0.065]"
                            : "hover:bg-white/[0.04]"
                        }`}
                      >
                        <div
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] border transition ${
                            active
                              ? "border-cyan-100/[0.12] bg-cyan-100/[0.055] text-cyan-100/70"
                              : "border-white/[0.055] bg-white/[0.025] text-white/30"
                          }`}
                        >
                          <Icon className="h-[15px] w-[15px]" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[12px] font-medium text-white/80">
                            {item.title}
                          </div>
                          <div className="mt-0.5 truncate text-[10px] text-white/25">
                            {item.subtitle}
                          </div>
                        </div>

                        <div className="hidden text-[9px] uppercase tracking-[0.12em] text-white/15 sm:block">
                          {item.category}
                        </div>

                        <ArrowUpRight
                          className={`h-3.5 w-3.5 transition ${
                            active
                              ? "translate-x-0 text-white/45"
                              : "-translate-x-1 text-white/0"
                          }`}
                        />
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center px-5 py-8 text-center">
                  <Search className="mb-3 h-5 w-5 text-white/15" />
                  <div className="text-[12px] text-white/45">
                    Heç nə tapılmadı
                  </div>
                  <div className="mt-1 text-[10px] text-white/20">
                    Başqa sözlə axtarmağa çalış.
                  </div>
                </div>
              )}

              <div className="mt-2 flex items-center gap-4 border-t border-white/[0.05] px-3 pb-1 pt-2.5 text-[9px] text-white/15">
                <span>↑↓ seçim</span>
                <span>↵ aç</span>
                <span>esc bağla</span>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
