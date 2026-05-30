"use client";

import { Component, type ReactNode } from "react";

/**
 * Local error boundary for the GLB preview surface.
 *
 * `useGLTF` throws during render when a model URL is unreachable (404/403,
 * expired CDN link, CORS-masked failure) or the file is malformed. Without a
 * boundary that throw escapes the <Suspense> and bubbles to the route's
 * error.tsx — taking out the *entire* jewelry edit page just because one
 * preview couldn't load. A bad model link must never lock the admin out of
 * the page.
 *
 * This catches the throw and renders `fallback` in place of the viewer, so
 * the rest of the page (form, photos, generation panel, the "remove model"
 * action that lets the admin recover) stays fully usable.
 *
 * Keyed by `url` at the call site so a new model URL resets the boundary and
 * gets a fresh load attempt after a previous failure.
 *
 * Must be a class component — React has no hook equivalent for
 * getDerivedStateFromError / error boundaries.
 */
export class GlbPreviewBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error("[GlbPreviewBoundary] model failed to load", error);
  }

  render() {
    if (this.state.failed) return this.props.fallback;
    return this.props.children;
  }
}
