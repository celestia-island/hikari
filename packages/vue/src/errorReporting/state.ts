import { ref, type Ref } from "vue";

import { reportHkRuntime, type HkRuntimeHandle } from "../runtime/registry";

/** Where a reported error came from. */
export type HkErrorSource = "vue" | "window" | "rejection" | "manual";

/** A normalized error record carried by the global error landing. */
export interface HkReportedError {
  source: HkErrorSource;
  error: unknown;
  name: string;
  message: string;
  stack: string;
  /** Vue's `info` string for errors surfaced through `app.config.errorHandler`. */
  info?: string;
}

export interface HkErrorReportingOptions {
  /** Headline override; defaults to `hikari::errors.defaultTitle`. */
  title?: string;
  /** Description builder; defaults to the error's message, falling back to
   * `hikari::errors.unexpectedDesc` when the error carries none. */
  describe?: (err: HkReportedError) => string;
  /** Target of the "back to home" action. `false` hides the button.
   * Ignored when `onHome` is set. Default `/`. */
  homeHref?: string | false;
  /** Overrides the default `window.location.assign(homeHref)` home action. */
  onHome?: () => void;
  /** Overrides the default `window.location.reload()` retry action. */
  onRetry?: () => void;
  /** Listen for uncaught `window` error events. Default `true`. */
  captureWindow?: boolean;
  /** Listen for `unhandledrejection` events. Default `true`. */
  captureRejection?: boolean;
  /** Drop an error entirely (no overlay, no `onError` callback). */
  shouldReport?: (err: unknown, source: HkErrorSource) => boolean;
  /** Telemetry hook: logging / reporting pipeline. Fires for every accepted
   * error, including ones arriving while the landing is already up. */
  onError?: (err: unknown, source: HkErrorSource) => void;
}

export function normalizeError(err: unknown): { name: string; message: string; stack: string } {
  if (err instanceof Error) {
    return {
      name: err.name || "Error",
      message: err.message || String(err),
      stack: err.stack || "",
    };
  }
  return { name: "Error", message: String(err), stack: "" };
}

/**
 * Module-level singleton state for the global error reporting overlay.
 * Module scope (not app provide/inject) is deliberate: window hooks and the
 * dedicated overlay app must reach it without a host component tree — the
 * host tree is exactly what is broken when this fires.
 */
const currentError: Ref<HkReportedError | null> = ref(null);

/** Options of the most recent `createErrorReporting` install. */
let activeOptions: HkErrorReportingOptions = {};

export function getErrorReportingOptions(): HkErrorReportingOptions {
  return activeOptions;
}

export function setErrorReportingOptions(options: HkErrorReportingOptions): void {
  activeOptions = options;
  runtimeReport?.setMeta({
    captureWindow: options.captureWindow !== false,
    captureRejection: options.captureRejection !== false,
  });
}

export function useErrorReportingState(): Ref<HkReportedError | null> {
  return currentError;
}

/**
 * Raise the global error landing. The first error wins while the landing is
 * up; later errors still log and fire `onError` but never swap the card.
 * Returns the record when accepted, `null` when filtered or already showing.
 */
export function reportError(err: unknown, source: HkErrorSource, info?: string): HkReportedError | null {
  const options = activeOptions;
  if (options.shouldReport && !options.shouldReport(err, source)) return null;

  console.error(`[hikari:error-reporting:${source}]`, err);
  options.onError?.(err, source);

  if (currentError.value !== null) return null;

  // Accepted onto the landing (first-error-wins): later errors while the
  // landing is up still log/fire onError above but do not count.
  acceptedReports += 1;
  runtimeReport?.pulse({ reports: acceptedReports });

  const normalized = normalizeError(err);
  const record: HkReportedError = {
    source,
    error: err,
    name: normalized.name,
    message: normalized.message,
    stack: normalized.stack,
    info,
  };
  currentError.value = record;
  return record;
}

export function clearErrorReportingState(): void {
  currentError.value = null;
}

// Runtime-registry reporting (the "context of contexts"): the error
// reporting module is a global singleton, so it reports itself at module
// init and pulses on every accepted error. The read facet keeps the
// current landing card observable (name/message/source only — never the
// whole error object) from readHkRuntime("errorReporting").
let acceptedReports = 0;
const runtimeReport: HkRuntimeHandle = reportHkRuntime("errorReporting", {
  kind: "plugin",
  description: "The global error reporting landing: app.config.errorHandler + window/rejection hooks with the full-screen error card.",
  meta: { captureWindow: activeOptions.captureWindow !== false, captureRejection: activeOptions.captureRejection !== false },
  read: () => ({
    reports: acceptedReports,
    landingUp: currentError.value !== null,
    current: currentError.value
      ? { name: currentError.value.name, message: currentError.value.message, source: currentError.value.source }
      : null,
  }),
});
