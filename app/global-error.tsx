"use client";

// Last-resort error boundary. Used when an error escapes ALL layouts —
// even the root layout's <html><body>. Must include its own <html><body>.
// Keep dependencies minimal: no Tailwind setup is guaranteed at this layer,
// so we use inline styles for safety.

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global-error]", error);
  }, [error]);

  return (
    <html lang="ru">
      <body
        style={{
          margin: 0,
          padding: "32px 16px",
          minHeight: "100vh",
          background: "#0a0908",
          color: "#efe7d8",
          fontFamily:
            'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ maxWidth: 480, textAlign: "center" }}>
          <p
            style={{
              margin: 0,
              fontSize: 12,
              letterSpacing: "0.4em",
              textTransform: "uppercase",
              color: "#fe017e",
            }}
          >
            Pierc Studio
          </p>
          <h1
            style={{
              marginTop: 12,
              marginBottom: 8,
              fontSize: 32,
              fontWeight: 500,
              lineHeight: 1.1,
            }}
          >
            Что-то пошло не так
          </h1>
          <p
            style={{
              margin: "0 0 24px",
              color: "#a39d92",
              fontSize: 15,
              lineHeight: 1.5,
            }}
          >
            Мы уже знаем об ошибке. Попробуйте обновить страницу.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              padding: "12px 24px",
              background: "#fe017e",
              color: "#ffffff",
              border: "none",
              borderRadius: 9999,
              fontSize: 15,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Попробовать снова
          </button>
          {error.digest ? (
            <p
              style={{
                marginTop: 32,
                fontSize: 11,
                color: "#6b6359",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              Код: <span style={{ fontFamily: "monospace" }}>{error.digest}</span>
            </p>
          ) : null}
        </div>
      </body>
    </html>
  );
}
