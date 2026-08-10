import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: "..",
  },

  serverExternalPackages: [
    "@supabase/supabase-js",
    "@resvg/resvg-js",
    "@resvg/resvg-js-darwin-arm64",
  ],
};

export default nextConfig;
