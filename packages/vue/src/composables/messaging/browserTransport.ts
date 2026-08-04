import { defaultDurationFor, defaultRequireInteraction, type MessagePayload, type MessageTransport } from "./types";
import { scheduleCronAfter } from "@celestia-island/hikari";

/**
 * Browser Notifications API transport.
 *
 * Fires a native OS notification via `window.Notification`. Used when the page
 * is hidden (user is in another tab/app) and the user has granted permission.
 *
 * Lifecycle notes:
 *  - `available()` only returns true when the API is present *and* the user
 *    has granted permission. Callers should call `requestPermission()` from
 *    a user-gesture-triggered flow (e.g. a settings toggle) before relying
 *    on this transport — browsers reject permission prompts that aren't
 *    initiated by a user gesture.
 *  - For error/warning severities we mirror the toast policy: the
 *    notification is auto-closed after the same 30s window so the two
 *    surfaces feel consistent. Errors additionally request sticky
 *    interaction (`requireInteraction: true`) so they survive OS auto-hide.
 *  - `onclick` focuses the originating window so the user lands back on the
 *    app — this is the bridge back into the SPA from the OS surface.
 */
export const browserTransport: MessageTransport = {
  name: "browser",
  available: () =>
    typeof Notification !== "undefined" && Notification.permission === "granted",
  send(payload: MessagePayload) {
    if (typeof Notification === "undefined") return;
    if (Notification.permission !== "granted") return;

    const severity = payload.severity;
    const requireInteraction =
      payload.requireInteraction ?? defaultRequireInteraction(severity);

    const headlineSource = payload.title || payload.message;
    const title = headlineSource.split("\n")[0]?.slice(0, 200) || headlineSource;
    const body =
      payload.body ||
      (payload.message.length > title.length ? payload.message : undefined);

    let notification: Notification;
    try {
      notification = new Notification(title, {
        body,
        tag: payload.tag,
        requireInteraction,
        data: payload.data,
      });
    } catch {
      // Some browsers throw if the document isn't focused or service worker
      // is unavailable. Swallow — the toast transport still covers the user.
      return;
    }

    notification.onclick = () => {
      try {
        window.focus();
      } catch {
        // Cross-origin or no-op — ignore.
      }
      notification.close();
    };

    // Mirror the toast auto-close window for transient severities. Errors
    // default to sticky (requireInteraction) and are skipped here.
    if (!requireInteraction) {
      const ttl = payload.duration ?? defaultDurationFor(severity);
      if (ttl > 0) {
        scheduleCronAfter(() => {
          try {
            notification.close();
          } catch {
            // Already closed — ignore.
          }
        }, ttl);
      }
    }
  },
};

/**
 * Request browser notification permission. Must be invoked from a user
 * gesture (click handler) — browsers otherwise silently deny.
 *
 * Returns the resulting permission state. The shared permission ref inside
 * {@link useMessaging} is updated as a side effect.
 */
export async function requestBrowserPermission(): Promise<NotificationPermission> {
  if (typeof Notification === "undefined") return "denied";
  if (Notification.permission !== "default") return Notification.permission;
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}
