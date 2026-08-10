import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: "..",
  },

  serverExternalPackages: [
    "@supabase/supabase-js",
    "@resvg/resvg-js",
  ],
};

export default nextConfig;
