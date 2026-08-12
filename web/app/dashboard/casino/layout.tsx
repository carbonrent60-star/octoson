import type { ReactNode } from "react";

import LiveStats from "@/components/casino/live-stats";
import LiveStatsTrigger from "@/components/casino/live-stats-trigger";

export default function CasinoLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <>
      <LiveStatsTrigger />

      {children}

      <LiveStats />
    </>
  );
}
