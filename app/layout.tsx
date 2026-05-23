import type { Metadata, Viewport } from "next";
import { Inter, Onest } from "next/font/google";
import "./globals.css";
import { ru } from "@/lib/i18n/ru";

// Body font: Inter (Latin + Cyrillic).
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "cyrillic"],
  display: "swap",
});

// Heading / display font: Onest (Latin + Cyrillic).
const onest = Onest({
  variable: "--font-onest",
  subsets: ["latin", "cyrillic"],
  display: "swap",
});

export const metadata: Metadata = {
  title: ru.studio.name,
  description: ru.studio.tagline,
};

// Sent in HTTP and rendered as a real <meta name="viewport"> tag.
// Includes:
//  - viewport-fit=cover so safe-area-inset-* works on notched devices
//  - themeColor matched to --page so the iOS/Android URL bar tints to
//    the page background in either theme
//  - colorScheme exposes the dark theme to native form controls
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0908" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    // suppressHydrationWarning: globals.css applies prefers-color-scheme
    // theme tokens; the future <ThemeToggle> will set .theme-light /
    // .theme-dark on <html> client-side, which would otherwise produce
    // a Server/Client className diff.
    <html
      lang="ru"
      suppressHydrationWarning
      className={`${inter.variable} ${onest.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-page text-ink">
        {children}
      </body>
    </html>
  );
}
