import type { Metadata, Viewport } from "next";
import { ReactNode, Suspense } from "react";
import "./globals.css";
import { GoogleAnalytics } from "@next/third-parties/google";
import Navbar from "../components/Navbar";
import StatusLinksCard from "../components/StatusLinksCard";
import FooterBanner from "../components/FooterBanner";
import AIAgent from "../components/AIAgent";

export const metadata: Metadata = {
  title: "PhDreamHome",
  description: "Real estate listings",
  applicationName: "PhDreamHome",
  appleWebApp: {
    title: "PhDreamHome",
    statusBarStyle: "default",
    capable: true,
  },
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/logo.svg",
    apple: "/logo.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#260038",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-white text-black safe-area">
        <Navbar />
        <div id="status-links-wrapper" className="sticky top-[3.75rem] z-40 bg-white">
          <Suspense fallback={<div className="h-10" />}>
            <StatusLinksCard />
          </Suspense>
        </div>
        <main className="container py-6">{children}</main>
        <footer className="mt-10" style={{ background: "#EFDCEC" }}>
          <FooterBanner />
          <div className="container border-t py-4 sm:py-2 flex flex-col sm:flex-row items-center justify-between gap-2 sm:gap-0 text-xs text-black text-center sm:text-left">
            <div>© 2026 PhDreamHome. All rights reserved.</div>
            <div className="flex items-center gap-3">
              <a href="/terms" className="text-black hover:underline">Terms and Conditions</a>
              <a href="/privacy" className="text-black hover:underline">Privacy Policy</a>
            </div>
          </div>
        </footer>
        <AIAgent />
        {process.env.NEXT_PUBLIC_GA_ID && (
          <GoogleAnalytics gaId={process.env.NEXT_PUBLIC_GA_ID} />
        )}
      </body>
    </html>
  );
}
