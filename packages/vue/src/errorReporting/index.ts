import { createApp, type App, type Plugin } from "vue";

import { HkErrorReportingOverlay } from "./HkErrorReportingOverlay";
import {
  clearErrorReportingState,
  reportError,
  setErrorReportingOptions,
  type HkErrorReportingOptions,
  type HkErrorSource,
} from "./state";

export type {
  HkErrorReportingOptions,
  HkErrorSource,
  HkReportedError,
} from "./state";
export { HkErrorReportingOverlay } from "./HkErrorReportingOverlay";

/**
 * createErrorReporting — the install-and-forget global error reporting hook.
 *
 * `app.use(createErrorReporting())` is all a host needs to get the
 * family-wide unified error landing for every error nothing else caught:
 *
 * - `app.config.errorHandler` (render trees without an HErrorBoundary,
 *   watchers, lifecycle hooks, async component failures, …);
 * - uncaught `window` error events;
 * - `unhandledrejection` events.
 *
 * On the first accepted error the plugin mounts a dedicated overlay app on
 * `document.body` (z-index above every popup band) rendering HkErrorLanding
 * with Home / Retry actions. Because the overlay lives on its own tiny app
 * instance, it still shows when the host tree itself is what crashed.
 *
 * Any pre-existing `app.config.errorHandler` is chained, not discarded.
 * All capture channels are optional; `shouldReport` filters, `onError` is
 * the telemetry hook.
 */
export function createErrorReporting(options: HkErrorReportingOptions = {}): Plugin {
  return {
    install(app: App) {
      setErrorReportingOptions(options);

      const previous = app.config.errorHandler;
      app.config.errorHandler = (err, instance, info) => {
        if (previous) {
          try {
            previous(err, instance, info);
          } catch {
            // A broken custom handler must not swallow the report.
          }
        }
        if (reportError(err, "vue", info)) ensureOverlayMounted();
      };

      installWindowHooks(options);
    },
  };
}

/**
 * Raise the global error landing programmatically — the runtime-error
 * counterpart of the old `window.__appFatal` handoff: fatal-fallback
 * surfaces can route post-mount reports here once the SPA is up.
 */
export function reportGlobalError(err: unknown, source: HkErrorSource = "manual"): void {
  if (reportError(err, source)) ensureOverlayMounted();
}

/** Dismiss the landing and tear the overlay app down (programmatic reset). */
export function clearGlobalError(): void {
  clearErrorReportingState();
  unmountOverlay();
}

// ── window hooks ────────────────────────────────────────────────────────

let windowCleanup: (() => void) | null = null;

function installWindowHooks(options: HkErrorReportingOptions): void {
  if (typeof window === "undefined") return;
  if (windowCleanup) return; // One set of listeners per document, ever.

  const disposers: Array<() => void> = [];

  if (options.captureWindow !== false) {
    const onError = (event: ErrorEvent) => {
      // Resource-load failures never reach here (no capture phase); script
      // errors always carry `error` or at least a `message`.
      const err = event.error ?? new Error(event.message || "Unknown script error");
      if (reportError(err, "window")) ensureOverlayMounted();
    };
    window.addEventListener("error", onError);
    disposers.push(() => window.removeEventListener("error", onError));
  }

  if (options.captureRejection !== false) {
    const onRejection = (event: PromiseRejectionEvent) => {
      if (reportError(event.reason, "rejection")) ensureOverlayMounted();
    };
    window.addEventListener("unhandledrejection", onRejection);
    disposers.push(() => window.removeEventListener("unhandledrejection", onRejection));
  }

  if (disposers.length === 0) return;
  windowCleanup = () => {
    for (const dispose of disposers) dispose();
    windowCleanup = null;
  };
}

// ── dedicated overlay app ───────────────────────────────────────────────

let overlayApp: App | null = null;
let overlayHost: HTMLElement | null = null;
let overlayMounting = false;

function ensureOverlayMounted(): void {
  if (overlayApp || overlayMounting) return;
  if (typeof document === "undefined") return;
  overlayMounting = true;
  try {
    overlayHost = document.createElement("div");
    overlayHost.dataset.hikariErrorReporting = "";
    document.body.appendChild(overlayHost);
    overlayApp = createApp(HkErrorReportingOverlay);
    overlayApp.mount(overlayHost);
  } catch (err) {
    // Never let overlay mounting recurse into another report.
    console.error("[hikari:error-reporting] failed to mount the overlay", err);
    overlayHost?.remove();
    overlayHost = null;
    overlayApp = null;
  } finally {
    overlayMounting = false;
  }
}

function unmountOverlay(): void {
  if (overlayApp) {
    try {
      overlayApp.unmount();
    } catch {
      // Already gone.
    }
    overlayApp = null;
  }
  overlayHost?.remove();
  overlayHost = null;
}

/** Test-only: reset singleton state, listeners and the overlay app. */
export function resetErrorReportingForTests(): void {
  clearErrorReportingState();
  windowCleanup?.();
  windowCleanup = null;
  unmountOverlay();
}
