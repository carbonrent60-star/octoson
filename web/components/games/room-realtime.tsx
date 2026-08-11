"use client";

import {
  useEffect,
  useRef,
} from "react";

import { useRouter } from "next/navigation";

import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

type Props = {
  roomId: string;
};

const HEARTBEAT_MS = 15_000;

export default function RoomRealtime({
  roomId,
}: Props) {
  const router = useRouter();

  const timerRef =
    useRef<ReturnType<
      typeof setTimeout
    > | null>(null);

  useEffect(() => {
    const supabase =
      getSupabaseBrowserClient();

    let destroyed = false;

    const refresh = (
      source: string
    ) => {
      if (destroyed) {
        return;
      }

      console.log(
        "[ROOM REALTIME REFRESH]",
        source,
        roomId
      );

      if (timerRef.current) {
        clearTimeout(
          timerRef.current
        );
      }

      timerRef.current =
        setTimeout(() => {
          if (!destroyed) {
            router.refresh();
          }
        }, 350);
    };

    async function heartbeat() {
      if (destroyed) {
        return;
      }

      try {
        const response =
          await fetch(
            "/api/games/room-heartbeat",
            {
              method: "POST",
              headers: {
                "Content-Type":
                  "application/json",
              },
              body: JSON.stringify({
                roomId,
              }),
              cache: "no-store",
            }
          );

        if (
          !response.ok &&
          response.status !== 404
        ) {
          console.warn(
            "[ROOM HEARTBEAT]",
            response.status
          );
        }

        if (response.ok) {
          refresh("heartbeat");
        }
      } catch (error) {
        console.warn(
          "[ROOM HEARTBEAT]",
          error
        );
      }
    }

    const channel = supabase
      .channel(
        `octoson-room-shell:${roomId}`
      )

      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table:
            "game_room_players",
          filter:
            `room_id=eq.${roomId}`,
        },
        () =>
          refresh(
            "game_room_players"
          )
      )

      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "game_rooms",
          filter:
            `id=eq.${roomId}`,
        },
        () =>
          refresh("game_rooms")
      )

      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table:
            "game_matches",
          filter:
            `room_id=eq.${roomId}`,
        },
        () =>
          refresh("game_matches")
      )

      .subscribe((status) => {
        console.log(
          "[ROOM REALTIME]",
          roomId,
          status
        );
      });

    void heartbeat();

    const heartbeatTimer =
      window.setInterval(
        () => {
          if (
            document.visibilityState ===
            "visible"
          ) {
            void heartbeat();
          }
        },
        HEARTBEAT_MS
      );

    const visibility = () => {
      if (
        document.visibilityState ===
        "visible"
      ) {
        void heartbeat();
        refresh("visibility");
      }
    };

    const focus = () => {
      void heartbeat();
      refresh("focus");
    };

    document.addEventListener(
      "visibilitychange",
      visibility
    );

    window.addEventListener(
      "focus",
      focus
    );

    return () => {
      destroyed = true;

      window.clearInterval(
        heartbeatTimer
      );

      if (timerRef.current) {
        clearTimeout(
          timerRef.current
        );
      }

      document.removeEventListener(
        "visibilitychange",
        visibility
      );

      window.removeEventListener(
        "focus",
        focus
      );

      void supabase.removeChannel(
        channel
      );
    };
  }, [roomId, router]);

  return null;
}
