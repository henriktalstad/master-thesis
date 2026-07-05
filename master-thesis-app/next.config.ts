import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    dangerouslyAllowSVG: true,
    qualities: [75, 90],
    remotePatterns: [
      { protocol: "https", hostname: "utfs.io" },
      { protocol: "https", hostname: "ufs.sh" },
      { protocol: "https", hostname: "*.ufs.sh" },
      { protocol: "https", hostname: "img.clerk.com" },
      {
        protocol: "https",
        hostname: "stemsenergyplanprodnoea.blob.core.windows.net",
      },
      {
        protocol: "https",
        hostname: "stemslegacyprodnoea.blob.core.windows.net",
      },
      { protocol: "https", hostname: "images.codetools.design" },
    ],
  },
  serverExternalPackages: ["prisma", "@prisma/client"],
};

export default nextConfig;
