import type { Metadata } from "next";
import { Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { siteUrl } from "@/lib/site-url";

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const jetBrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  // Required for the generated `opengraph-image` routes: Next resolves those
  // to absolute URLs against this, and defaults to localhost without it.
  metadataBase: siteUrl(),
  title: "CoBuild",
  description:
    "Post what you've built, upvote what you like, and keep a portfolio you can put on a résumé.",
  openGraph: {
    siteName: "CoBuild",
    type: "website",
  },
  // Inherited by every route, so a page only has to supply the image itself.
  // Without `summary_large_image`, X renders the 1200×630 card as a small
  // square thumbnail and crops most of it away.
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={cn(
        "h-full",
        "antialiased",
        plusJakartaSans.variable,
        jetBrainsMono.variable,
        "font-sans",
      )}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
