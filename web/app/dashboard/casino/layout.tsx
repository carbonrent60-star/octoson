import type { ReactNode } from "react";

import LiveStats from "@/components/casino/live-stats";

export default function CasinoLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <>
      {children}
      <LiveStats />
    </>
  );
}
