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

    send();

    const timer =
      window.setInterval(
        send,
        45_000
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
