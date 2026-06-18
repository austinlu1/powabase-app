import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    POWABASE_URL: process.env.POWABASE_URL!,
    POWABASE_KEY: process.env.POWABASE_KEY!,
  },
};

export default nextConfig;
