"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

export default function PresenceHeartbeat() {
  const pathname = usePathname();

  useEffect(() => {
    let cancelled = false;

    const send = () => {
      if (cancelled) {
        return;
      }

      void fetch(
        "/api/presence",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            path:
              pathname ||
              "/dashboard",
          }),
          keepalive: true,
        }
      ).catch(() => {});
    };

    /*
     * Presence is non-critical. Let the page paint and hydrate first,
     * especially on mobile networks/devices.
     */
    const initialTimer =
      window.setTimeout(
        send,
        4_000
      );

    const timer =
      window.setInterval(
        send,
        60_000
      );

    const visible = () => {
      if (
        document.visibilityState ===
        "visible"
      ) {
        send();
      }
    };

    document.addEventListener(
      "visibilitychange",
      visible
    );

    return () => {
      cancelled = true;

      window.clearTimeout(
        initialTimer
      );

      window.clearInterval(
        timer
      );

      document.removeEventListener(
        "visibilitychange",
        visible
      );
    };
  }, [pathname]);

  return null;
}
