import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep visited pages in the browser for 30 s so back and repeat taps are instant.
  experimental: { staleTimes: { dynamic: 30 } },
};

export default nextConfig;
