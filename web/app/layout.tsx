import type { Metadata } from "next";
import { SourceFooter } from "@/components/SourceFooter";
import "./globals.css";

export const metadata: Metadata = {
  title: "Housing Intelligence Platform",
  description: "NJ-first housing market analytics",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {children}
        {/* In the root layout so it cannot be forgotten on a page: attribution is a
            condition of Zillow's licence, and the pages most likely to be linked
            directly are the ones least likely to have remembered it. */}
        <SourceFooter />
      </body>
    </html>
  );
}
