import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  experimental: {
    serverActions: {
      // Document photos and PDFs go straight to Supabase Storage from the
      // browser, so server actions only carry small form data.
      bodySizeLimit: "1mb",
    },
  },
};

// Connects next-intl (src/i18n/request.ts) to the app.
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

export default withNextIntl(nextConfig);
