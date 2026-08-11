"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Gamepad2, Sparkles, Zap } from "lucide-react";

const BOOT_KEY = "octoson:boot:v1";

/*
 * These are intentionally the routes people are most likely
 * to visit from the dashboard.
 *
 * We warm them AFTER the current page becomes interactive.
 * We do not make the first render wait for them.
 */
const priorityRoutes = [
  "/dashboard",
  "/dashboard/leaderboard",
  "/dashboard/market",
  "/dashboard/profile",
];

const secondaryRoutes = [
  "/dashboard/bank",
  "/dashboard/casino",
  "/dashboard/games",
  "/dashboard/inventory",
  "/dashboard/world",
];

type IdleWindow = Window & {
  requestIdleCallback?: (
    callback: () => void,
    options?: {
      timeout?: number;
    },
  ) => number;

  cancelIdleCallback?: (id: number) => void;
};

export default function OctosonBoot() {
  const router = useRouter();

  useEffect(() => {
    const root = document.documentElement;

    let alreadySeen = false;

    try {
      alreadySeen = window.localStorage.getItem(BOOT_KEY) === "1";
    } catch {
      // localStorage can be unavailable in restrictive modes.
    }

    /*
     * The tiny inline script in app/layout.tsx normally handles
     * repeat visits before first paint. This is a second safety
     * check after React hydrates.
     */
    if (alreadySeen) {
      root.classList.add("octo-boot-seen");
      root.classList.remove("octo-boot-active");
    } else {
      root.classList.add("octo-boot-active");

      /*
       * This animation is cosmetic only.
       *
       * The application is already rendering underneath it and
       * route warming starts immediately. We never wait on a
       * network request before dismissing the loader.
       */
      const startedAt = performance.now();
      const minimumVisibleMs = 780;

      const reveal = () => {
        const elapsed = performance.now() - startedAt;

        const remaining = Math.max(0, minimumVisibleMs - elapsed);

        window.setTimeout(() => {
          root.classList.add("octo-boot-leaving");

          window.setTimeout(() => {
            root.classList.add("octo-boot-seen");
            root.classList.remove("octo-boot-active", "octo-boot-leaving");

            try {
              window.localStorage.setItem(BOOT_KEY, "1");
            } catch {
              // Ignore storage failures.
            }
          }, 430);
        }, remaining);
      };

      /*
       * If hydration happened after the page fully loaded,
       * reveal immediately (subject to the short animation).
       */
      if (document.readyState === "complete") {
        reveal();
      } else {
        window.addEventListener("load", reveal, {
          once: true,
        });
      }
    }

    /*
     * Main mobile-navbar destinations are warmed first.
     *
     * router.prefetch() fills Next's client router cache so the
     * server/component payload can already be available before
     * the user taps the destination.
     */
    const prefetchPriority = () => {
      priorityRoutes.forEach((href, index) => {
        window.setTimeout(() => {
          router.prefetch(href);
        }, index * 90);
      });
    };

    /*
     * Less-important routes warm when the browser has idle time.
     * This prevents us from stealing CPU/network time from the
     * initial dashboard render.
     */
    const prefetchSecondary = () => {
      secondaryRoutes.forEach((href, index) => {
        window.setTimeout(() => {
          router.prefetch(href);
        }, index * 140);
      });
    };

    prefetchPriority();

    const idleWindow = window as IdleWindow;

    let idleId: number | undefined;
    let timeoutId: number | undefined;

    if (idleWindow.requestIdleCallback) {
      idleId = idleWindow.requestIdleCallback(prefetchSecondary, {
        timeout: 1800,
      });
    } else {
      timeoutId = window.setTimeout(prefetchSecondary, 700);
    }

    return () => {
      if (idleId !== undefined && idleWindow.cancelIdleCallback) {
        idleWindow.cancelIdleCallback(idleId);
      }

      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [router]);

  return (
    <div className="octo-boot-screen" aria-hidden="true">
      <div className="octo-boot-ambient octo-boot-ambient-a" />
      <div className="octo-boot-ambient octo-boot-ambient-b" />

      <div className="octo-boot-grid" />

      <div className="octo-boot-content">
        <div className="octo-boot-mark-wrap">
          <div className="octo-boot-orbit octo-boot-orbit-a" />
          <div className="octo-boot-orbit octo-boot-orbit-b" />

          <div className="octo-boot-mark">
            <div className="octo-boot-mark-glow" />

            <Gamepad2 className="octo-boot-mark-icon" strokeWidth={1.7} />
          </div>

          <span className="octo-boot-particle octo-boot-particle-a">
            <Sparkles />
          </span>

          <span className="octo-boot-particle octo-boot-particle-b">
            <Zap />
          </span>
        </div>

        <div className="octo-boot-copy">
          <p className="octo-boot-eyebrow">OCTOSON</p>

          <h1 className="octo-boot-title">Aura dünyasına daxil ol</h1>

          <p className="octo-boot-subtitle">
            Profil və oyun sistemi hazırlanır
          </p>
        </div>

        <div className="octo-boot-progress">
          <div className="octo-boot-progress-fill" />
        </div>

        <div className="octo-boot-status">
          <span className="octo-boot-status-dot" />
          Sistem hazırdır
        </div>
      </div>
    </div>
  );
}
