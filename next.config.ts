import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin();

/** Hostnames from TRUSTED_ORIGINS, e.g. "http://192.168.1.20:3000" → "192.168.1.20". */
const trustedHosts = (process.env.TRUSTED_ORIGINS ?? "")
  .split(",")
  .map((origin) => {
    try {
      return new URL(origin.trim()).hostname;
    } catch {
      return null;
    }
  })
  .filter((host): host is string => Boolean(host));

const nextConfig: NextConfig = {
  serverExternalPackages: ["sharp", "cloudinary"],
  // Lets `pnpm dev` be opened from a phone: Tailscale IPs (100.x.x.x), MagicDNS names and TRUSTED_ORIGINS hosts.
  allowedDevOrigins: ["100.*.*.*", "**.ts.net", ...trustedHosts],
  experimental: {
    serverActions: { bodySizeLimit: "2mb" },
  },
};

export default withNextIntl(nextConfig);
