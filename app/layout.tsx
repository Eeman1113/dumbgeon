import type { Metadata, Viewport } from "next";
import Crt from "@/components/Crt";
import SeoContent from "@/components/SeoContent";
import { KEYWORDS, SITE } from "@/lib/site";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: `${SITE.name} — ${SITE.tagline}`,
    template: `%s · ${SITE.name}`,
  },
  description: SITE.description,
  keywords: KEYWORDS,
  applicationName: SITE.name,
  authors: [{ name: SITE.author, url: SITE.authorUrl }],
  creator: SITE.author,
  publisher: SITE.author,
  category: "games",
  alternates: { canonical: "/" },
  manifest: "/manifest.webmanifest",
  robots: {
    index: true,
    follow: true,
    nocache: false,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    siteName: SITE.name,
    title: `${SITE.name} — ${SITE.tagline}`,
    description: SITE.description,
    url: SITE.url,
    locale: "en_US",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "dumbgeon — a text adventure improvised by an AI running inside your browser",
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE.name} — ${SITE.tagline}`,
    description: SITE.short,
    images: ["/og.png"],
    creator: "@eeman1113",
  },
  appleWebApp: {
    capable: true,
    title: SITE.name,
    statusBarStyle: "black-translucent",
  },
  formatDetection: { telephone: false, address: false, email: false },
  other: {
    "theme-color": "#000000",
    "color-scheme": "dark",
    "msapplication-TileColor": "#000000",
    "apple-mobile-web-app-capable": "yes",
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: "#000000",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  // Pinch-zoom stays available: capping it would fail WCAG 1.4.4.
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover",
};

/**
 * Structured data. Two graphs: the game itself, and the questions people
 * actually type into a search box about it.
 */
const JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "VideoGame",
      "@id": `${SITE.url}/#game`,
      name: SITE.name,
      url: SITE.url,
      description: SITE.description,
      image: `${SITE.url}/og.png`,
      genre: ["Interactive Fiction", "Text Adventure", "Role-Playing Game", "Roguelike"],
      gamePlatform: ["Web Browser", "Google Chrome"],
      playMode: "SinglePlayer",
      applicationCategory: "Game",
      operatingSystem: "Any (desktop Chrome 138+)",
      inLanguage: "en",
      author: { "@type": "Person", name: SITE.author, url: SITE.authorUrl },
      publisher: { "@type": "Person", name: SITE.author, url: SITE.authorUrl },
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD", availability: "https://schema.org/InStock" },
      isAccessibleForFree: true,
    },
    {
      "@type": "WebSite",
      "@id": `${SITE.url}/#website`,
      url: SITE.url,
      name: SITE.name,
      description: SITE.short,
      inLanguage: "en",
      publisher: { "@type": "Person", name: SITE.author, url: SITE.authorUrl },
    },
    {
      "@type": "FAQPage",
      "@id": `${SITE.url}/#faq`,
      mainEntity: [
        {
          "@type": "Question",
          name: "Is dumbgeon free?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Yes, completely. The AI model runs on your own machine using Chrome's built-in Gemini Nano, so there is no API key, no subscription and no usage cost of any kind.",
          },
        },
        {
          "@type": "Question",
          name: "Does dumbgeon send my story to a server?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "No. Everything happens inside your browser. There is no backend, no analytics and no network request carrying your gameplay. Your saves live in your browser's local storage.",
          },
        },
        {
          "@type": "Question",
          name: "What do I need to play dumbgeon?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Desktop Chrome 138 or newer with the built-in Gemini Nano model available, roughly 22 GB of free disk space and more than 4 GB of video memory. Chrome downloads the model once, then the game works offline.",
          },
        },
        {
          "@type": "Question",
          name: "Is dumbgeon like AI Dungeon?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "It is the same idea — an improvised text adventure where you type whatever you want — but it runs locally instead of on a server, costs nothing, and uses a story director that tracks tension, deadlines and consequences so the plot escalates instead of drifting.",
          },
        },
      ],
    },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=VT323&family=Press+Start+2P&display=swap"
          rel="stylesheet"
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
        />
      </head>
      <body>
        <SeoContent />
        {children}
        <Crt />
      </body>
    </html>
  );
}
