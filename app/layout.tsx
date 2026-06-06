import type { Metadata, Viewport } from "next";
import { Inter, Onest, JetBrains_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";
import { ru } from "@/lib/i18n/ru";
import { ThemeProvider } from "@/lib/theme/theme-provider";
import { MotionProvider } from "@/components/motion/MotionProvider";

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

// Mono font: JetBrains Mono — used for spec-data (gauge, weight, price)
// and any code-adjacent UI. Latin + Cyrillic for Russian copy.
const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin", "cyrillic"],
  display: "swap",
});

// `metadataBase` resolves all relative URLs in OpenGraph / Twitter Cards
// to absolute URLs. Set it from APP_URL so every share preview points
// at the real production deploy. Falls back to the dev origin so local
// builds still work. See docs/17-seo.md.
const APP_URL = process.env.APP_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: ru.studio.name,
    template: `%s — ${ru.studio.name}`,
  },
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
  // Lock scaling: kills pinch-zoom and the iOS Safari focus-zoom that fires
  // when a focused input is under 16px. Inputs are also bumped to 16px on
  // mobile (see the public form components) so nothing jumps if a browser
  // ignores user-scalable.
  maximumScale: 1,
  userScalable: false,
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
    // suppressHydrationWarning: ThemeProvider sets .theme-light / .theme-dark
    // on <html> client-side, which would otherwise produce a Server/Client
    // className diff.
    <html
      lang="ru"
      suppressHydrationWarning
      className={`${inter.variable} ${onest.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <head>
        {/* Pre-paint theme + app-mode resolution. Runs before first paint so
            the correct palette (and the native-shell chrome stripping) are in
            place with no flash:
              • theme — stored choice wins; otherwise follow the OS
                prefers-color-scheme. Sets BOTH the `.theme-*` class (CSS
                tokens) and `data-theme` attribute (watched by the 3D scenes).
              • app mode — `data-app` when the WebView UA carries `PiercApp`.
            ThemeProvider re-asserts the same values on mount, so this is
            idempotent. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var d=document.documentElement;var s=localStorage.getItem("theme");var t=(s==="light"||s==="dark")?s:(window.matchMedia&&window.matchMedia("(prefers-color-scheme: light)").matches?"light":"dark");d.classList.add("theme-"+t);d.setAttribute("data-theme",t);}catch(e){}try{if(navigator.userAgent.indexOf("PiercApp")>-1)d.dataset.app="1";}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-page text-ink">
        <ThemeProvider>
          <MotionProvider>{children}</MotionProvider>
          <Analytics />
          <SpeedInsights />
        </ThemeProvider>
      </body>
    </html>
  );
}
