import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "i.pravatar.cc",
      },
      {
        protocol: "https",
        hostname: "ui-avatars.com",
      },
    ],
  },
  async redirects() {
    return [
      // There is no dashboard screen — the brief specifies five screens and
      // Inventory is the entry point. Handled here at the routing layer rather
      // than by a client component calling redirect(), which had to ship JS,
      // hydrate and render before it could bounce. That render was the flash.
      {
        source: "/",
        destination: "/inventory",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
