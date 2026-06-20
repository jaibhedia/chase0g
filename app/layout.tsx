import type { Metadata, Viewport } from "next";
import { VT323, Press_Start_2P } from "next/font/google";
import "./globals.css";
import { SocketProvider } from "./providers/SocketProvider";
import { AudioInitializer } from "./components/AudioInitializer";
import { ServiceWorkerRegister } from "./components/ServiceWorkerRegister";
import { RotateOverlay } from "./components/RotateOverlay";
import { Analytics } from "@vercel/analytics/next";
import { siteConfig } from "./siteConfig";

// Pixel-art type: VT323 for readable body copy, Press Start 2P for headings.
const bodyFont = VT323({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-body",
});

const pressStart = Press_Start_2P({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-heading",
});


// Game canvas requires browser globals — disable static prerender.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: siteConfig.title,
    template: `%s · ${siteConfig.name}`,
  },
  description: siteConfig.description,
  applicationName: siteConfig.name,
  keywords: [...siteConfig.keywords],
  authors: siteConfig.authors.map((a) => ({ ...a })),
  creator: siteConfig.creator,
  publisher: siteConfig.creator,
  category: "games",
  alternates: { canonical: "/" },
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/icon-192.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/icon-192.png", sizes: "192x192" }],
  },
  openGraph: {
    type: "website",
    siteName: siteConfig.name,
    title: siteConfig.title,
    description: siteConfig.description,
    url: siteConfig.url,
    locale: siteConfig.locale,
  },
  twitter: {
    card: "summary_large_image",
    title: siteConfig.title,
    description: siteConfig.description,
    site: siteConfig.twitterHandle,
    creator: siteConfig.twitterHandle,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-video-preview": -1,
      "max-snippet": -1,
    },
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#1a3a1a",
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <style dangerouslySetInnerHTML={{ __html: `
          @media screen and (max-width: 768px) {
            body {
              overflow: hidden;
            }
          }
        `}} />
      </head>
      <body className={`${bodyFont.variable} ${pressStart.variable} font-body`}>
        <SocketProvider>
          <AudioInitializer />
          <ServiceWorkerRegister />
          {children}
          <Analytics />
        </SocketProvider>
        {/* Landscape-only gate for phones/tablets (matches manifest orientation). */}
        <RotateOverlay />
        {/* Subtle CRT scanline + vignette overlay across the whole app. */}
        <div className="scanlines" aria-hidden="true" />
      </body>
    </html>
  );
}
