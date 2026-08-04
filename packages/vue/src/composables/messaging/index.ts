import { computed, readonly, ref } from "vue";

import { browserTransport, requestBrowserPermission } from "./browserTransport";
import { toastTransport } from "./toastTransport";
import { defaultCopyable, defaultDurationFor, type MessagePayload, type MessageSeverity, type MessageTransport, type NotifyOptions, type TransportName } from "./types";

// Re-export the messaging types from the public entry point so consumers
// can `import type { MessageSeverity } from "./messaging"`.
export type {
  MessagePayload,
  MessageSeverity,
  MessageTransport,
  NotifyOptions,
  TransportName,
} from "./types";

/**
 * Registry of all known transports, in priority order.
 *
 * Built-ins (`toast`, `browser`) are pre-registered. Native client bridges
 * (Tauri desktop, mobile native, iOS APNs long-poll) push themselves here
 * via {@link registerTransport} during boot — typically by reading
 * `window.__nativeBridge` and wrapping it in a {@link MessageTransport}.
 */
const transports: MessageTransport[] = [toastTransport, browserTransport];

/** Page visibility — drives the toast-vs-browser routing decision. */
const _pageHidden = ref(typeof document !== "undefined" && document.hidden);
if (typeof document !== "undefined") {
  const onVis = () => { _pageHidden.value = document.hidden; };
  document.addEventListener("visibilitychange", onVis);
}
const pageHidden = computed(() => _pageHidden.value);

/** Live browser notification permission. */
const browserPermission = ref<NotificationPermission>(
  typeof Notification !== "undefined" ? Notification.permission : "denied",
);

function refreshPermission() {
  if (typeof Notification !== "undefined") {
    browserPermission.value = Notification.permission;
  }
}

let nextId = 0;

/**
 * Register a new transport (e.g. a native bridge). Idempotent — re-registering
 * the same name replaces the prior instance and disposes it if supported.
 *
 * Returns an unregister handle so ephemeral bridges (e.g. a reconnecting
 * WebSocket-based push subscription) can tear themselves down cleanly.
 */
export function registerTransport(transport: MessageTransport): () => void {
  const idx = transports.findIndex((t) => t.name === transport.name);
  if (idx !== -1) {
    const [prev] = transports.splice(idx, 1);
    prev.dispose?.();
  }
  transports.push(transport);
  return () => {
    const i = transports.indexOf(transport);
    if (i !== -1) {
      const [removed] = transports.splice(i, 1);
      removed.dispose?.();
    }
  };
}

/**
 * Register a native bridge discovered on `window.__nativeBridge`. Safe to call
 * unconditionally — no-ops if no bridge is present. Future native client
 * integrations (Tauri `notification` plugin, HarmonyOS `NotificationService`,
 * iOS long-poll subscriber) should hook in here.
 */
export function registerNativeBridge(): () => void {
  const bridge =
    typeof window !== "undefined"
      ? (window as unknown as { __nativeBridge?: MessageTransport }).__nativeBridge
      : undefined;
  if (!bridge || typeof bridge.send !== "function") return () => {};
  if (bridge.name !== "native") {
    // Coerce the name so routing allow-lists resolve consistently.
    (bridge as MessageTransport).name = "native";
  }
  return registerTransport(bridge);
}

/**
 * Decide which transports a given payload should fire on. Returns the
 * filtered list (in registry order).
 *
 * Routing policy:
 *   - `toast`: ALWAYS (it's the in-app surface; cheap and visible when the
 *     user returns).
 *   - `browser`: ONLY when the page is hidden AND permission is granted AND
 *     the severity is actionable off-page (error/warning/success). Pure info
 *     pings don't earn an OS-level interruption.
 *   - `native`: ALWAYS when available (the native shell decides how to render
 *     based on its own focus state — we don't second-guess it from the web
 *     layer).
 */
function routePayload(
  payload: MessagePayload,
  allowList: TransportName[] | "all",
): MessageTransport[] {
  const allow = allowList === "all" ? null : new Set(allowList);
  const out: MessageTransport[] = [];
  for (const t of transports) {
    if (allow && !allow.has(t.name)) continue;
    if (!t.available()) continue;
    if (t.name === "browser") {
      const actionable =
        payload.severity === "error" ||
        payload.severity === "warning" ||
        payload.severity === "success";
      if (!payload.pageHidden || !actionable) continue;
    }
    out.push(t);
  }
  return out;
}

/**
 * Unified messaging context. Drop-in replacement for {@link useToast} at call
 * sites that want cross-transport routing — the helper signatures
 * (`error`/`warning`/`success`/`info`) mirror the toast API to make migration
 * mechanical.
 *
 * @example
 * const msg = useMessaging();
 * msg.error(t("auth.login.failed"));          // top-right toast + (if hidden) browser push
 * msg.warning("Disk almost full", { tag: "disk" });
 * msg.notify("Saved", { severity: "success", transports: ["toast"] }); // in-app only
 */
export function useMessaging() {
  function notify(message: string, options: NotifyOptions = {}): number {
    const severity: MessageSeverity = options.severity || "info";
    const payload: MessagePayload = {
      id: ++nextId,
      severity,
      message,
      title: options.title,
      body: options.body,
      tag: options.tag,
      requireInteraction: options.requireInteraction,
      copyable: options.copyable ?? defaultCopyable(severity),
      duration: options.duration ?? defaultDurationFor(severity),
      data: options.data,
      timestamp: Date.now(),
      pageHidden: pageHidden.value,
    };

    const routed = routePayload(payload, options.transports ?? "all");
    for (const t of routed) {
      try {
        t.send(payload);
      } catch {
        // Transport failure must never propagate — the next transport still
        // gets a chance.
      }
    }
    return payload.id;
  }

  function error(message: string, options: Omit<NotifyOptions, "severity"> = {}) {
    return notify(message, { ...options, severity: "error" });
  }
  function warning(message: string, options: Omit<NotifyOptions, "severity"> = {}) {
    return notify(message, { ...options, severity: "warning" });
  }
  function success(message: string, options: Omit<NotifyOptions, "severity"> = {}) {
    return notify(message, { ...options, severity: "success" });
  }
  function info(message: string, options: Omit<NotifyOptions, "severity"> = {}) {
    return notify(message, { ...options, severity: "info" });
  }

  /**
   * Request browser notification permission. Must be called from a user
   * gesture handler (button click) — otherwise browsers silently deny.
   */
  async function ensureBrowserPermission(): Promise<NotificationPermission> {
    const result = await requestBrowserPermission();
    refreshPermission();
    return result;
  }

  return {
    notify,
    error,
    warning,
    success,
    info,
    ensureBrowserPermission,
    /** Whether the browser tab is currently hidden. Reactive. */
    pageHidden: readonly(pageHidden),
    /** Live browser notification permission. Reactive. */
    browserPermission: readonly(browserPermission),
    /** Register a transport at runtime (e.g. native bridge). */
    registerTransport,
  };
}
