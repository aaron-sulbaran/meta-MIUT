import type { NextConfig } from "next";

// The presenters' phone links, short and in any letter case (phones capitalize the
// first letter): /jing, /demo/jing and /phone/jing all go to /demo/phone/jing.
// None of these paths is a page of its own. Slugs match CAST_SLUG in lib/demo/beats.ts.
const PHONE_SLUGS = ["jing", "jolyn", "lisa", "trish"];
const anyCase = (word: string) => [...word].map((letter) => `[${letter}${letter.toUpperCase()}]`).join("");

const nextConfig: NextConfig = {
  // Keep visited pages in the browser for 30 s so back and repeat taps are instant.
  experimental: { staleTimes: { dynamic: 30 } },
  async redirects() {
    return PHONE_SLUGS.flatMap((slug) =>
      ["", "/demo", "/phone"].map((prefix) => ({
        source: `${prefix}/:name(${anyCase(slug)})`,
        destination: `/demo/phone/${slug}`,
        permanent: false,
      })),
    );
  },
};

export default nextConfig;
