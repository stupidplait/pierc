import { Ionicons } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  BackHandler,
  Platform,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { WebView, type WebViewNavigation } from "react-native-webview";
import { isExternalUrl } from "@/constants/config";
import { theme } from "@/constants/theme";

interface PiercWebViewProps {
  /** Initial URL to load. Tab screens pass their tab-specific URL. */
  source: string;
  /**
   * Called whenever the URL changes (real navigation, not just hash
   * fragments) so the parent can mirror it into native state if it
   * needs the current location for share, deep-linking, etc.
   */
  onUrlChange?: (url: string) => void;
}

export interface PiercWebViewHandle {
  /** Navigate the WebView to a new URL. Used by deep-linking. */
  navigate: (url: string) => void;
  /** Reload the current page. */
  reload: () => void;
}

/**
 * The studio web app rendered inside a `react-native-webview`.
 *
 * Responsibilities the native shell handles (everything else is the
 * web app's problem):
 *
 *   • Hardware back button on Android — traverses WebView history
 *     before falling through to the default exit behavior
 *   • External link interception — taps on t.me / wa.me / instagram
 *     etc. open in the system browser via expo-web-browser, not the
 *     in-app WebView
 *   • Native share button (top-right) — shares the current page URL
 *     via the iOS share sheet / Android Intent
 *   • Loading + error states — native spinner before first paint;
 *     retry button if the page fails to load
 */
export const PiercWebView = forwardRef<PiercWebViewHandle, PiercWebViewProps>(
  function PiercWebView({ source, onUrlChange }, ref) {
    const webViewRef = useRef<WebView | null>(null);
    const [currentUrl, setCurrentUrl] = useState<string>(source);
    const [canGoBack, setCanGoBack] = useState<boolean>(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    // Inset web content below the status bar / notch. The site hides its own
    // header in app mode (detected via the `PiercApp` UA marker below), so its
    // top edge would otherwise sit under the notch.
    const insets = useSafeAreaInsets();

    useImperativeHandle(
      ref,
      () => ({
        navigate(url: string) {
          // Programmatic navigation via injected JS — react-native-webview
          // doesn't expose a `navigate` method directly, but we can flip
          // the source via state, or run window.location.assign().
          webViewRef.current?.injectJavaScript(
            `window.location.href = ${JSON.stringify(url)}; true;`,
          );
        },
        reload() {
          webViewRef.current?.reload();
        },
      }),
      [],
    );

    // ── Hardware back button (Android) ──────────────────────────
    // Only active when this tab is focused. Pops WebView history if
    // possible; otherwise lets the default exit behavior run.
    useFocusEffect(
      useCallback(() => {
        if (Platform.OS !== "android") return;
        const onBackPress = (): boolean => {
          if (canGoBack && webViewRef.current) {
            webViewRef.current.goBack();
            return true;
          }
          return false;
        };
        const sub = BackHandler.addEventListener(
          "hardwareBackPress",
          onBackPress,
        );
        return () => sub.remove();
      }, [canGoBack]),
    );

    // ── Navigation tracking ─────────────────────────────────────
    const handleNavStateChange = useCallback(
      (nav: WebViewNavigation) => {
        setCanGoBack(nav.canGoBack);
        if (nav.url && nav.url !== currentUrl) {
          setCurrentUrl(nav.url);
          onUrlChange?.(nav.url);
        }
      },
      [currentUrl, onUrlChange],
    );

    // ── External link interception ──────────────────────────────
    // Returning false stops the WebView from navigating; we then open
    // the URL in the system browser via expo-web-browser.
    const handleShouldStartLoad = useCallback(
      (req: { url: string; navigationType?: string }) => {
        if (!req.url.startsWith("http")) return true; // about:blank, data:, etc.
        if (isExternalUrl(req.url)) {
          void WebBrowser.openBrowserAsync(req.url);
          return false;
        }
        return true;
      },
      [],
    );

    // ── Share button ────────────────────────────────────────────
    const handleShare = useCallback(async () => {
      try {
        await Share.share({
          message: currentUrl,
          url: currentUrl, // iOS uses `url`; Android uses `message`
        });
      } catch {
        // User cancelled or share unavailable — silent.
      }
    }, [currentUrl]);

    // ── Render ──────────────────────────────────────────────────
    return (
      <View style={styles.root}>
        {errorMessage ? (
          <View style={[styles.errorBox, { paddingTop: insets.top }]}>
            <Ionicons
              name="cloud-offline-outline"
              size={48}
              color={theme.accent}
            />
            <Text style={styles.errorTitle}>Не удалось загрузить</Text>
            <Text style={styles.errorBody}>{errorMessage}</Text>
            <TouchableOpacity
              style={styles.retryBtn}
              onPress={() => {
                setErrorMessage(null);
                webViewRef.current?.reload();
              }}
            >
              <Text style={styles.retryText}>Попробовать снова</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <WebView
            ref={webViewRef}
            source={{ uri: source }}
            style={[styles.webView, { marginTop: insets.top }]}
            // Marks every request's user-agent so the web app can switch to
            // "app mode" (hide its header/footer, full-height forms, safe areas).
            // Appended to the device UA, so responsive CSS is unaffected.
            applicationNameForUserAgent="PiercApp"
            originWhitelist={["http://*", "https://*", "pierc://*"]}
            onNavigationStateChange={handleNavStateChange}
            onShouldStartLoadWithRequest={handleShouldStartLoad}
            onError={(e) => {
              const msg = e.nativeEvent?.description ?? "Сеть недоступна";
              setErrorMessage(msg);
            }}
            startInLoadingState
            renderLoading={() => (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="large" color={theme.accent} />
              </View>
            )}
            cacheEnabled
            domStorageEnabled
            javaScriptEnabled
            allowsBackForwardNavigationGestures
            pullToRefreshEnabled
            mediaPlaybackRequiresUserAction
            // iOS file-upload picker requires this; Android handles natively.
            allowsInlineMediaPlayback
            // Prevents zoom on form-focus (matches mobile-web behavior).
            scalesPageToFit={false}
          />
        )}

        <TouchableOpacity
          style={[styles.shareBtn, { top: insets.top + 14 }]}
          onPress={handleShare}
          accessibilityLabel="Поделиться страницей"
          hitSlop={8}
        >
          <Ionicons name="share-outline" size={22} color={theme.ink} />
        </TouchableOpacity>
      </View>
    );
  },
);

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.bg,
  },
  webView: {
    flex: 1,
    backgroundColor: "transparent",
  },
  loadingBox: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: theme.bg,
  },
  shareBtn: {
    position: "absolute",
    // `top` is set inline from the safe-area inset (see render).
    right: 14,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(10, 9, 8, 0.72)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.line,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 2,
  },
  errorBox: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
    backgroundColor: theme.bg,
  },
  errorTitle: {
    marginTop: 16,
    fontSize: 20,
    fontWeight: "600",
    color: theme.ink,
  },
  errorBody: {
    marginTop: 8,
    fontSize: 14,
    color: theme.inkMuted,
    textAlign: "center",
  },
  retryBtn: {
    marginTop: 20,
    backgroundColor: theme.accent,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 9999,
  },
  retryText: {
    color: theme.onAccent,
    fontWeight: "500",
  },
});
