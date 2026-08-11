"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import {
  Home,
  Dices,
  Banknote,
  ShoppingBag,
  MoreHorizontal,
} from "lucide-react";

const items = [
  {
    href: "/dashboard",
    label: "Home",
    icon: Home,
  },
  {
    href: "/dashboard/games",
    label: "Games",
    icon: Dices,
  },
  {
    href: "/dashboard/bank",
    label: "Bank",
    icon: Banknote,
  },
  {
    href: "/dashboard/market",
    label: "Market",
    icon: ShoppingBag,
  },
];

export default function MobileNav({
  onMore,
}: {
  onMore: () => void;
}) {
  const pathname = usePathname();

  return (
    <div
      className="
        fixed inset-x-0 bottom-0 z-[60]
        px-3
        pb-[max(10px,env(safe-area-inset-bottom))]
        lg:hidden
      "
    >
      <div
        className="
          mx-auto flex h-[68px] max-w-[520px]
          items-center justify-around
          rounded-[22px]
          border border-white/[0.09]
          bg-[#0a0a0d]/90
          px-1.5
          shadow-[0_-10px_45px_rgba(0,0,0,0.35),0_18px_60px_rgba(0,0,0,0.55)]
          backdrop-blur-2xl
          supports-[backdrop-filter]:bg-[#0a0a0d]/72
        "
      >
        {items.map((item) => {
          const Icon = item.icon;

          const active =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className="
                relative flex h-[56px] min-w-[58px]
                flex-col items-center justify-center
                gap-1 rounded-[17px] px-2
              "
            >
              {active && (
                <motion.div
                  layoutId="octoson-mobile-tab"
                  className="
                    absolute inset-1
                    rounded-[15px]
                    border border-cyan-100/[0.09]
                    bg-cyan-100/[0.065]
                  "
                  transition={{
                    type: "spring",
                    stiffness: 420,
                    damping: 34,
                  }}
                />
              )}

              <motion.div
                whileTap={{ scale: 0.86 }}
                className="relative z-10"
              >
                <Icon
                  strokeWidth={active ? 2.1 : 1.8}
                  className={`h-[19px] w-[19px] transition-colors ${
                    active
                      ? "text-cyan-100"
                      : "text-white/35"
                  }`}
                />
              </motion.div>

              <span
                className={`relative z-10 text-[8px] font-medium transition-colors ${
                  active
                    ? "text-cyan-50/80"
                    : "text-white/25"
                }`}
              >
                {item.label}
              </span>

              {active && (
                <motion.span
                  layoutId="octoson-mobile-dot"
                  className="
                    absolute bottom-[3px]
                    h-[2px] w-[12px]
                    rounded-full bg-cyan-100/80
                  "
                />
              )}
            </Link>
          );
        })}

        <button
          type="button"
          onClick={onMore}
          className="
            relative flex h-[56px] min-w-[58px]
            flex-col items-center justify-center
            gap-1 rounded-[17px] px-2
            text-white/35
          "
        >
          <motion.div whileTap={{ scale: 0.86 }}>
            <MoreHorizontal className="h-[20px] w-[20px]" />
          </motion.div>

          <span className="text-[8px] font-medium">
            More
          </span>
        </button>
      </div>
    </div>
  );
}
