/**
 * Unified messaging context — types & contracts.
 *
 * The messaging context routes user-facing notifications through one or more
 * {@link MessageTransport} adapters. The routing decision is driven by the
 * page-visibility state and the per-transport availability (e.g. browser
 * notification permission).
 *
 * Built-in transports:
 *   - {@link "toast"} — always available; renders via {@link useToast} in the
 *     top-right corner.
 *   - {@link "browser"} — the Web Notifications API; used when the page is
 *     hidden and the user has granted permission.
 *
 * Future transports (desktop/mobile/iOS long-poll) will be registered via
 * {@link registerTransport} and follow the same {@link MessageTransport}
 * contract. Native bridges are expected to expose themselves on
 * `window.__nativeBridge` and call {@link registerTransport} at boot — the
 * messaging layer is transport-agnostic.
 */

/** User-facing severity. Mirrors {@link ToastType} so toasts stay the source of truth. */
export type MessageSeverity = "error" | "warning" | "success" | "info" | "loading";

/** Transport identifiers used by the routing layer. */
export type TransportName = "toast" | "browser" | "native";

/**
 * Options accepted by {@link useMessaging}'s helpers.
 *
 * Most fields are transport-agnostic; transports pick the ones they understand
 * (e.g. the browser transport uses {@link title} as the notification headline
 * while the toast transport only renders {@link message}).
 */
export interface NotifyOptions {
  severity?: MessageSeverity;
  /** Short headline. Used by browser/native transports; toast falls back to {@link message}. */
  title?: string;
  /** Long-form body. Used by browser/native transports when set. */
  body?: string;
  /** Toast auto-close ms. `0` keeps the toast sticky. Defaults to severity-based duration. */
  duration?: number;
  /** Toast: show the copy button. Defaults to `true` for error/warning. */
  copyable?: boolean;
  /** Browser: dedup tag — same-tag notifications replace each other. */
  tag?: string;
  /** Browser: stay open until user dismisses. Defaults to severity-driven. */
  requireInteraction?: boolean;
  /**
   * Restrict routing to a subset of transports. `"all"` (default) lets the
   * visibility/permission gate decide. Useful for low-priority pings that
   * should never interrupt the user off-page (e.g. `transports: ["toast"]`).
   */
  transports?: TransportName[] | "all";
  /**
   * Opaque payload reserved for future native transports (desktop IPC, mobile
   * push subscription, iOS APNs long-poll). Passed through untouched.
   */
  data?: Record<string, unknown>;
}

/** Fully-resolved message handed to each transport. */
export interface MessagePayload {
  id: number;
  severity: MessageSeverity;
  /** Primary text — always populated. */
  message: string;
  title?: string;
  body?: string;
  tag?: string;
  requireInteraction?: boolean;
  copyable?: boolean;
  duration?: number;
  data?: Record<string, unknown>;
  /** Epoch ms — useful for native transports that queue/batch. */
  timestamp: number;
  /** Whether the page was hidden when this message was dispatched. */
  pageHidden: boolean;
}

/**
 * Contract every push channel must implement.
 *
 * Transports are stateless from the registry's perspective: they receive a
 * resolved payload and decide for themselves how to render it. Availability
 * (e.g. permission, native bridge presence) is checked before each send so
 * transports can degrade gracefully without re-registration.
 */
export interface MessageTransport {
  /** Stable identifier — used by {@link NotifyOptions.transports} allow-lists. */
  name: TransportName;
  /** Whether this transport can be used right now (permission, bridge present, …). */
  available(): boolean;
  /** Issue the message. Must not throw — wrap failures in a no-op. */
  send(payload: MessagePayload): void;
  /** Optional teardown for transports that own resources (event listeners, etc.). */
  dispose?(): void;
}

/** Convenience: severity → default toast duration (mirrors {@link TOAST_DURATION}). */
export function defaultDurationFor(severity: MessageSeverity): number {
  if (severity === "error" || severity === "warning") return 30_000;
  if (severity === "loading") return 0;
  return 3_000;
}

/** Convenience: severity → whether a browser notification should stay sticky. */
export function defaultRequireInteraction(severity: MessageSeverity): boolean {
  return severity === "error";
}

/** Convenience: severity → default copyable flag for the toast surface. */
export function defaultCopyable(severity: MessageSeverity): boolean {
  return severity === "error" || severity === "warning";
}
