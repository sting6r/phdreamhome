const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "https://hcytsmimaehlmrvhrbda.supabase.co";
let supabaseHost = "";
try { if (SUPABASE_URL) supabaseHost = new URL(SUPABASE_URL).host; } catch {}

const nextConfig = {
  images: {
    minimumCacheTTL: 60,
    remotePatterns: [
      { protocol: "https", hostname: "hcytsmimaehlmrvhrbda.supabase.co", pathname: "/**" },
      ...(supabaseHost && supabaseHost !== "hcytsmimaehlmrvhrbda.supabase.co" ? [
        { protocol: "https", hostname: supabaseHost, pathname: "/**" }
      ] : []),
      { protocol: "https", hostname: "lh3.googleusercontent.com", pathname: "/**" }
    ]
  },
  serverExternalPackages: ["@supabase/supabase-js"],
  async headers() {
    return [
      {
        source: "/_next/static/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" }
        ]
      }
    ];
  }
};
module.exports = nextConfig;
