import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    // Must be the monorepo root, not `apps/web`. `.npmrc` sets
    // `node-linker=hoisted`, so pnpm installs every dependency into the root
    // `node_modules`; scoping Turbopack's root to `apps/web` cut resolution off
    // below that directory and every runtime dep (clsx, @supabase/ssr, …)
    // failed to resolve even though `tsc` was happy.
    root: path.join(__dirname, "..", ".."),
  },
  transpilePackages: ["@cobuild/tokens", "@cobuild/shared", "@cobuild/db"],
  images: {
    qualities: [50, 75, 90],
    // Next 16 added an SSRF guard that refuses to optimise an upstream image
    // whose host resolves to a "private" IP. On a network that resolves DNS
    // through NAT64, Supabase's Cloudflare-fronted storage resolves to
    // `64:ff9b::/96`-prefixed addresses (e.g. `64:ff9b::ac40:95f6`, which is
    // just 172.64.149.246 — Cloudflare, and genuinely public: the private
    // range is 172.16/12, i.e. .16–.31). Next misreads those NAT64-mapped
    // addresses as private and 400s every image, avatars and covers alike.
    //
    // Only relaxed in development, and safe there specifically because
    // `remotePatterns` below already pins fetches to one hostname — there is
    // no arbitrary-URL surface for the guard to protect. Production keeps the
    // strict default, where DNS is not NAT64 and the guard behaves correctly.
    dangerouslyAllowLocalIP: process.env.NODE_ENV === "development",
    remotePatterns: [
      {
        protocol: "https",
        hostname: "mwxokedrwjlyrqcwvdur.supabase.co",
        pathname: "/storage/v1/object/**",
      },
      {
        protocol: "https",
        hostname: "mwxokedrwjlyrqcwvdur.supabase.co",
        pathname: "/storage/v1/render/image/**",
      },
    ],
  },
};

export default nextConfig;
