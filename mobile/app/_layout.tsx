import { Stack, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as Linking from "expo-linking";
import * as SplashScreen from "expo-splash-screen";
import { useCallback, useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { urlFor } from "@/constants/config";
import { theme } from "@/constants/theme";
import { getTabWebView, tabForPath } from "@/lib/tab-registry";

// Keep the native splash visible until we explicitly hide it (right
// after the first render). Without this, the splash flickers off
// before Expo Router has mounted the tab nav, showing a blank flash.
SplashScreen.preventAutoHideAsync().catch(() => {
  // Already hidden; nothing to do.
});

export default function RootLayout() {
  const router = useRouter();

  // ── Splash dismissal ────────────────────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => {
      SplashScreen.hideAsync().catch(() => undefined);
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  // ── Deep-link handling ──────────────────────────────────────
  // Handles both `pierc://...` (custom scheme) and Universal Links /
  // App Links pointing at the studio's domain. The mapping is:
  //
  //   pierc://catalog/abc123          → catalog tab + WebView /catalog/abc123
  //   https://piercing.studio/book    → book tab + WebView /book
  //   https://piercing.studio/about   → home tab + WebView /about
  //
  // For domain links, we extract just the pathname; the WebView loads
  // the live deploy at APP_URL anyway. For pierc:// links, the host
  // segment is treated as the first path part (so `pierc://catalog/abc`
  // has pathname "catalog/abc").
  const handleUrl = useCallback(
    (rawUrl: string) => {
      let pathname: string;
      try {
        const parsed = Linking.parse(rawUrl);
        // For `pierc://` scheme, expo-linking puts the first segment in
        // hostname. Stitch hostname + path back together.
        const hostPart = parsed.hostname ? `/${parsed.hostname}` : "";
        const pathPart = parsed.path ? `/${parsed.path}` : "";
        pathname = `${hostPart}${pathPart}` || "/";
      } catch {
        pathname = "/";
      }
      // Normalise: collapse double slashes, strip trailing slash except root.
      pathname = pathname.replace(/\/+/g, "/");
      if (pathname.length > 1 && pathname.endsWith("/")) {
        pathname = pathname.slice(0, -1);
      }

      const tab = tabForPath(pathname);
      const targetUrl = urlFor(pathname);

      // Switch to the right tab first so the WebView mounts (if it
      // wasn't already), then defer the in-WebView navigation by a
      // tick so the ref is registered.
      router.navigate(`/(tabs)/${tab === "home" ? "" : tab}`);
      setTimeout(() => {
        getTabWebView(tab)?.navigate(targetUrl);
      }, 50);
    },
    [router],
  );

  // Cold start: app opened from a deep link.
  useEffect(() => {
    let cancelled = false;
    Linking.getInitialURL()
      .then((url) => {
        if (cancelled || !url) return;
        handleUrl(url);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [handleUrl]);

  // Warm: app already running, OS hands us a new URL.
  useEffect(() => {
    const onLinkingUrl = (event: { url: string }) => {
      handleUrl(event.url);
    };
    const subscription = Linking.addEventListener("url", onLinkingUrl);
    return () => {
      subscription.remove();
    };
  }, [handleUrl]);

  return (
    <SafeAreaProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          // Dark scene background so route transitions never flash white
          // before the WebView (or +not-found) paints.
          contentStyle: { backgroundColor: theme.bg },
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="+not-found"
          options={{
            title: "Не найдено",
            headerShown: true,
            headerStyle: { backgroundColor: theme.bg },
            headerTintColor: theme.ink,
            headerShadowVisible: false,
          }}
        />
      </Stack>
      {/* Light status-bar content for the dark surface (matches the web
          app's dark themeColor). */}
      <StatusBar style="light" />
    </SafeAreaProvider>
  );
}
