import type { Metadata, Viewport } from "next";
import { ReactNode, Suspense } from "react";
import "./globals.css";
import Script from "next/script";
import Navbar from "../components/Navbar";
import StatusLinksCard from "../components/StatusLinksCard";
import FooterBanner from "../components/FooterBanner";
import AIAgent from "../components/AIAgent";
import { NextAuthProvider } from "./providers";

export const metadata: Metadata = {
  title: {
    default: "PhDreamHome | Real Estate Listings in the Philippines",
    template: "%s | PhDreamHome"
  },
  description: "Find your dream home in the Philippines. Browse house and lot, condominiums, and commercial properties for sale or rent.",
  keywords: ["Philippines real estate", "house and lot for sale", "condominium for rent", "property listings Philippines"],
  authors: [{ name: "PhDreamHome" }],
  creator: "PhDreamHome",
  publisher: "PhDreamHome",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL('https://www.phdreamhome.com'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: "PhDreamHome | Real Estate Listings in the Philippines",
    description: "Find your dream home in the Philippines. Browse house and lot, condominiums, and commercial properties for sale or rent.",
    url: "https://www.phdreamhome.com",
    siteName: "PhDreamHome",
    locale: "en_PH",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "PhDreamHome | Real Estate Listings in the Philippines",
    description: "Find your dream home in the Philippines.",
    creator: "@phdreamhome",
  },
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
        <Script id="trusted-types-policy" strategy="beforeInteractive">
          {`
            try {
              if (window.trustedTypes && window.trustedTypes.createPolicy) {
                window.trustedTypes.createPolicy('default', {
                  createHTML: string => string,
                  createScriptURL: string => string,
                  createScript: string => string,
                });
              }
            } catch (e) {}
          `}
        </Script>
        <NextAuthProvider>
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
            <>
              <Script
                src={`https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GA_ID}`}
                strategy="afterInteractive"
              />
              <Script id="google-analytics" strategy="afterInteractive">
                {`
                  window.dataLayer = window.dataLayer || [];
                  function gtag(){dataLayer.push(arguments);}
                  gtag('js', new Date());
                  gtag('config', '${process.env.NEXT_PUBLIC_GA_ID}', {
                    page_path: window.location.pathname,
                    transport_type: 'beacon'
                  });
                `}
              </Script>
            </>
          )}
        </NextAuthProvider>
      </body>
    </html>
  );
}
