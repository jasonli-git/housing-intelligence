import type { Metadata } from "next";
import { JetBrains_Mono, Public_Sans, Space_Grotesk } from "next/font/google";

import { InlineScript } from "@/components/InlineScript";
import { LicenceLine } from "@/components/LicenceLine";
import { Masthead } from "@/components/Masthead";
import { SourceFooter } from "@/components/SourceFooter";
import { THEME_SCRIPT } from "@/lib/theme";
import "./tokens.css";
import "./globals.css";
import "./redesign.css";

// Self-hosted at build time: next/font downloads each face once and serves it from this
// site, so a reader's browser never asks Google for anything (ARCHITECTURE #121).
// Public Sans is Housing's own voice — the US Web Design System's face, the typography
// of the federal data this site is built from. JetBrains Mono sets labels, and matches
// jasonli.app's mono. Space Grotesk appears once, in the shared bar, at the one weight
// jasonli.app uses there.
const publicSans = Public_Sans({ subsets: ["latin"], variable: "--font-public-sans", display: "swap" });
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains-mono", display: "swap" });
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500"],
  variable: "--font-space-grotesk",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Housing — New Jersey housing data",
  description: "New Jersey housing, county by county: prices, rents, incomes and affordability, every figure traced to its source.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // `suppressHydrationWarning` because the theme script below may set `data-theme` on
    // this element before React hydrates; the DOM is right and React should keep it.
    <html
      lang="en"
      className={`${publicSans.variable} ${jetbrainsMono.variable} ${spaceGrotesk.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* A stored theme choice, applied before the first paint (#134). */}
        <InlineScript html={THEME_SCRIPT} />
      </head>
      <body>
        <Masthead />
        <LicenceLine />
        {children}
        {/* In the root layout so it cannot be forgotten on a page: attribution is a
            condition of Zillow's licence, and the pages most likely to be linked
            directly are the ones least likely to have remembered it. */}
        <SourceFooter />
      </body>
    </html>
  );
}
