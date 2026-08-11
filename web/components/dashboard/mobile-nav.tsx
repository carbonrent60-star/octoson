"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import {
  Banknote,
  ChevronRight,
  CircleDollarSign,
  CircleUserRound,
  Crown,
  Dices,
  Gamepad2,
  Gem,
  Home,
  Layers3,
  MoreHorizontal,
  Play,
  ShoppingBag,
  Sparkles,
  Spade,
  Swords,
  Trophy,
  Users,
  X,
  Zap,
} from "lucide-react";

type MobileNavProps = {
  onMore: () => void;
};

const navItems = [
  {
    href: "/dashboard",
    label: "Ana səhifə",
    icon: Home,
  },
  {
    href: "/dashboard/leaderboard",
    label: "Reytinq",
    icon: Trophy,
  },
  {
    href: "/dashboard/market",
    label: "Bazar",
    icon: ShoppingBag,
  },
  {
    href: "/dashboard/profile",
    label: "Profil",
    icon: CircleUserRound,
  },
];

const quickGames = [
  {
    href: "/dashboard/casino/roulette",
    name: "Rulet",
    description: "Klassik rulet masası",
    icon: CircleDollarSign,
    glow: "rgba(251,113,133,.14)",
    iconClass: "text-rose-200",
  },
  {
    href: "/dashboard/casino/blackjack",
    name: "Blackjack",
    description: "21-i tut, masanı keç",
    icon: Spade,
    glow: "rgba(165,243,252,.13)",
    iconClass: "text-cyan-100",
  },
  {
    href: "/dashboard/casino/mines",
    name: "Mines",
    description: "Riski özün seç",
    icon: Gem,
    glow: "rgba(110,231,183,.12)",
    iconClass: "text-emerald-200",
  },
  {
    href: "/dashboard/casino/baccarat",
    name: "Baccarat",
    description: "Player, Banker və ya Tie",
    icon: Layers3,
    glow: "rgba(196,181,253,.13)",
    iconClass: "text-violet-200",
  },
  {
    href: "/dashboard/casino/slots",
    name: "Slots",
    description: "Çevir və şansını yoxla",
    icon: Sparkles,
    glow: "rgba(253,230,138,.12)",
    iconClass: "text-amber-100",
  },
  {
    href: "/dashboard/casino/tower",
    name: "Tower",
    description: "Yuxarı qalx, riski artır",
    icon: Crown,
    glow: "rgba(147,197,253,.12)",
    iconClass: "text-blue-200",
  },
];

export default function MobileNav({ onMore }: MobileNavProps) {
  const pathname = usePathname();
  const [playOpen, setPlayOpen] = useState(false);
  const [optimisticPath, setOptimisticPath] = useState(pathname);

  useEffect(() => {
    setOptimisticPath(pathname);
    setPlayOpen(false);
  }, [pathname]);

  function beginNavigation(href: string) {
    setOptimisticPath(href);

    /*
     * Remove the launcher immediately instead of waiting for
     * AnimatePresence's exit animation or the server response.
     * This makes the destination clickable immediately.
     */
    setPlayOpen(false);
  }

  useEffect(() => {
    if (!playOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [playOpen]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setPlayOpen(false);
      }
    }

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  const leftItems = navItems.slice(0, 2);
  const rightItems = navItems.slice(2);

  function NavItem({ item }: { item: (typeof navItems)[number] }) {
    const Icon = item.icon;

    const active =
      item.href === "/dashboard"
        ? optimisticPath === "/dashboard"
        : optimisticPath.startsWith(item.href);

    return (
      <Link
        href={item.href}
        data-no-hover-sound="true"
        onPointerDown={() => setOptimisticPath(item.href)}
        onClick={() => beginNavigation(item.href)}
        className="relative flex h-[58px] min-w-0 flex-1 touch-manipulation flex-col items-center justify-center gap-1 rounded-[17px]"
      >
        {active && (
          <div className="absolute inset-1 rounded-[15px] border border-cyan-100/[0.09] bg-cyan-100/[0.06]" />
        )}

        <motion.div whileTap={{ scale: 0.84 }} className="relative z-10">
          <Icon
            strokeWidth={active ? 2.1 : 1.8}
            className={`h-[19px] w-[19px] transition-colors ${
              active ? "text-cyan-100" : "text-white/35"
            }`}
          />
        </motion.div>

        <span
          className={`relative z-10 max-w-full truncate px-0.5 text-[8px] font-medium tracking-[-0.01em] transition-colors ${
            active ? "text-cyan-50/85" : "text-white/28"
          }`}
        >
          {item.label}
        </span>

        {active && (
          <span className="absolute bottom-[3px] h-[2px] w-[12px] rounded-full bg-cyan-100/80 shadow-[0_0_9px_rgba(165,243,252,.55)]" />
        )}
      </Link>
    );
  }

  return (
    <>
      <AnimatePresence>
        {playOpen && (
          <motion.div
            className="fixed inset-0 z-[90] lg:hidden"
            exit={{ pointerEvents: "none" }}
          >
            <motion.button
              type="button"
              aria-label="Oyun menyusunu bağla"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.22 }}
              onClick={() => setPlayOpen(false)}
              className="absolute inset-0 bg-black/80"
            />

            <motion.div
              initial={{
                opacity: 0,
                y: 48,
                scale: 0.97,
              }}
              animate={{
                opacity: 1,
                y: 0,
                scale: 1,
              }}
              exit={{
                opacity: 0,
                y: 32,
                scale: 0.98,
              }}
              transition={{
                type: "spring",
                stiffness: 330,
                damping: 30,
                mass: 0.82,
              }}
              className="absolute inset-x-0 bottom-0"
            >
              <div className="mx-auto max-w-[560px] px-2.5 pb-[max(8px,env(safe-area-inset-bottom))]">
                <div className="relative max-h-[min(76vh,680px)] overflow-hidden rounded-[30px] border border-white/[0.1] bg-[#09090c]/[0.98] shadow-[0_-30px_100px_rgba(0,0,0,.72),0_0_70px_rgba(103,232,249,.045)]">
                  <div className="octo-mobile-heavy-decoration pointer-events-none absolute -left-20 -top-28 h-72 w-72 rounded-full bg-cyan-300/[0.07] blur-[100px]" />
                  <div className="octo-mobile-heavy-decoration pointer-events-none absolute -right-20 top-24 h-60 w-60 rounded-full bg-blue-500/[0.045] blur-[100px]" />

                  <div className="relative max-h-[min(76vh,680px)] overflow-y-auto overscroll-contain px-4 pb-5 pt-3">
                    <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/10" />

                    <div className="flex items-start justify-between gap-4 px-1">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="flex h-7 w-7 items-center justify-center rounded-[9px] border border-cyan-100/[0.1] bg-cyan-100/[0.055]">
                            <Gamepad2 className="h-3.5 w-3.5 text-cyan-100/80" />
                          </span>

                          <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-cyan-100/45">
                            Octoson Play
                          </p>
                        </div>

                        <h2 className="mt-3 text-[24px] font-semibold tracking-[-0.045em] text-white">
                          Nə oynamaq istəyirsən?
                        </h2>

                        <p className="mt-1.5 text-[11px] leading-5 text-white/30">
                          Oyunu seç və bir toxunuşla başla.
                        </p>
                      </div>

                      <motion.button
                        whileTap={{ scale: 0.88 }}
                        type="button"
                        onClick={() => setPlayOpen(false)}
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] border border-white/[0.07] bg-white/[0.035] text-white/40"
                      >
                        <X className="h-4 w-4" />
                      </motion.button>
                    </div>

                    <div className="mt-5 grid grid-cols-2 gap-2.5">
                      <Link
                        href="/dashboard/casino"
                        onPointerDown={() =>
                          beginNavigation("/dashboard/casino")
                        }
                        className="group relative col-span-1 touch-manipulation overflow-hidden rounded-[20px] border border-cyan-100/[0.1] bg-cyan-100/[0.045] p-4"
                      >
                        <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-cyan-200/[0.08] blur-3xl" />

                        <div className="relative">
                          <div className="flex h-9 w-9 items-center justify-center rounded-[12px] border border-cyan-100/[0.11] bg-cyan-100/[0.07]">
                            <Dices className="h-[17px] w-[17px] text-cyan-100/90" />
                          </div>

                          <p className="mt-4 text-[13px] font-semibold text-white">
                            Casino
                          </p>

                          <p className="mt-1 text-[9px] leading-4 text-white/30">
                            Aura ilə sürətli oyunlar
                          </p>

                          <div className="mt-3 flex items-center gap-1 text-[8px] font-semibold uppercase tracking-[0.13em] text-cyan-100/50">
                            Hamısına bax
                            <ChevronRight className="h-3 w-3" />
                          </div>
                        </div>
                      </Link>

                      <Link
                        href="/dashboard/games"
                        onPointerDown={() =>
                          beginNavigation("/dashboard/games")
                        }
                        className="group relative col-span-1 touch-manipulation overflow-hidden rounded-[20px] border border-violet-200/[0.09] bg-violet-200/[0.035] p-4"
                      >
                        <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-violet-300/[0.07] blur-3xl" />

                        <div className="relative">
                          <div className="flex h-9 w-9 items-center justify-center rounded-[12px] border border-violet-100/[0.1] bg-violet-100/[0.055]">
                            <Users className="h-[17px] w-[17px] text-violet-100/85" />
                          </div>

                          <p className="mt-4 text-[13px] font-semibold text-white">
                            Dostlarla
                          </p>

                          <p className="mt-1 text-[9px] leading-4 text-white/30">
                            Otaq yarat və birlikdə oyna
                          </p>

                          <div className="mt-3 flex items-center gap-1 text-[8px] font-semibold uppercase tracking-[0.13em] text-violet-100/45">
                            Multiplayer
                            <ChevronRight className="h-3 w-3" />
                          </div>
                        </div>
                      </Link>
                    </div>

                    <div className="mt-6 flex items-center justify-between px-1">
                      <div>
                        <p className="text-[12px] font-semibold tracking-[-0.02em] text-white/85">
                          Tez başla
                        </p>

                        <p className="mt-0.5 text-[9px] text-white/24">
                          Seçilmiş oyunlar
                        </p>
                      </div>

                      <Link
                        href="/dashboard/casino"
                        onPointerDown={() =>
                          beginNavigation("/dashboard/casino")
                        }
                        className="flex touch-manipulation items-center gap-1 text-[9px] font-medium text-white/30"
                      >
                        Hamısı
                        <ChevronRight className="h-3 w-3" />
                      </Link>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2">
                      {quickGames.map((game, index) => {
                        const Icon = game.icon;

                        return (
                          <motion.div
                            key={game.href}
                            initial={{
                              opacity: 0,
                              y: 14,
                            }}
                            animate={{
                              opacity: 1,
                              y: 0,
                            }}
                            transition={{
                              delay: 0.05 + index * 0.035,
                              duration: 0.28,
                              ease: [0.22, 1, 0.36, 1],
                            }}
                          >
                            <Link
                              href={game.href}
                              onPointerDown={() => beginNavigation(game.href)}
                              className="group relative flex min-h-[76px] touch-manipulation items-center gap-3 overflow-hidden rounded-[17px] border border-white/[0.065] bg-white/[0.025] p-3 transition active:scale-[0.98]"
                            >
                              <div
                                className="pointer-events-none absolute -left-6 -top-8 h-20 w-20 rounded-full blur-3xl"
                                style={{
                                  background: game.glow,
                                }}
                              />

                              <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] border border-white/[0.07] bg-white/[0.035]">
                                <Icon
                                  className={`h-[17px] w-[17px] ${game.iconClass}`}
                                  strokeWidth={1.8}
                                />
                              </div>

                              <div className="relative min-w-0">
                                <p className="truncate text-[11px] font-semibold text-white/85">
                                  {game.name}
                                </p>

                                <p className="mt-1 line-clamp-2 text-[8px] leading-[1.45] text-white/25">
                                  {game.description}
                                </p>
                              </div>
                            </Link>
                          </motion.div>
                        );
                      })}
                    </div>

                    <div className="mt-4 flex items-center justify-between rounded-[17px] border border-white/[0.055] bg-white/[0.018] px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-emerald-300/[0.055]">
                          <Zap className="h-3.5 w-3.5 text-emerald-200/70" />
                        </div>

                        <div>
                          <p className="text-[9px] font-medium text-white/55">
                            Birbaşa oyuna keç
                          </p>
                          <p className="mt-0.5 text-[8px] text-white/20">
                            Menyularda itmədən
                          </p>
                        </div>
                      </div>

                      <Swords className="h-4 w-4 text-white/15" />
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="octo-mobile-fixed fixed inset-x-0 bottom-0 z-[60] px-2.5 pb-[max(8px,env(safe-area-inset-bottom))] lg:hidden">
        <div className="relative mx-auto max-w-[540px]">
          <div className="octo-mobile-heavy-decoration pointer-events-none absolute left-1/2 top-[-26px] h-16 w-28 -translate-x-1/2 rounded-full bg-cyan-300/[0.075] blur-2xl" />

          <div className="relative flex h-[70px] items-center rounded-[23px] border border-white/[0.09] bg-[#0a0a0d]/[0.98] px-1.5 shadow-[0_-10px_35px_rgba(0,0,0,.38),0_16px_42px_rgba(0,0,0,.52)]">
            <div className="flex min-w-0 flex-1 items-center">
              {leftItems.map((item) => (
                <NavItem key={item.href} item={item} />
              ))}
            </div>

            <div className="relative h-full w-[86px] shrink-0">
              <motion.button
                type="button"
                aria-label="Oyna"
                aria-expanded={playOpen}
                onClick={() => setPlayOpen((current) => !current)}
                whileTap={{ scale: 0.91 }}
                className="absolute left-1/2 top-[-31px] z-20 flex -translate-x-1/2 touch-manipulation flex-col items-center"
              >
                <motion.span
                  animate={
                    playOpen
                      ? {
                          rotate: 90,
                          scale: 1.03,
                        }
                      : {
                          rotate: 0,
                          scale: 1,
                        }
                  }
                  transition={{
                    type: "spring",
                    stiffness: 420,
                    damping: 26,
                  }}
                  className="relative flex h-[64px] w-[64px] items-center justify-center rounded-[21px] border border-cyan-100/30 bg-[linear-gradient(145deg,rgba(207,250,254,.98),rgba(103,232,249,.82))] shadow-[0_0_0_4px_rgba(103,232,249,.04),0_0_22px_rgba(103,232,249,.18),0_10px_24px_rgba(0,0,0,.48)]"
                >
                  <span className="absolute inset-[1px] rounded-[20px] border border-white/40" />

                  <span className="pointer-events-none absolute inset-0 rounded-[21px] shadow-[0_0_22px_rgba(103,232,249,.16)]" />

                  {playOpen ? (
                    <X
                      className="relative h-[22px] w-[22px] text-[#071013]"
                      strokeWidth={2.5}
                    />
                  ) : (
                    <Play
                      className="relative ml-0.5 h-[22px] w-[22px] fill-[#071013] text-[#071013]"
                      strokeWidth={2.2}
                    />
                  )}
                </motion.span>

                <span className="mt-1 text-[8px] font-bold uppercase tracking-[0.13em] text-cyan-50/85">
                  Oyna
                </span>
              </motion.button>
            </div>

            <div className="flex min-w-0 flex-1 items-center">
              {rightItems.map((item) => (
                <NavItem key={item.href} item={item} />
              ))}
            </div>

            <button
              type="button"
              aria-label="Daha çox"
              onClick={onMore}
              className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full text-white/0"
            >
              <MoreHorizontal className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
