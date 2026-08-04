import { useToast } from "@celestia-island/hikari";
import type { MessagePayload, MessageTransport } from "./types";

/**
 * In-app toast transport. Always available while the SPA is mounted — the
 * toast container lives in {@link AppShell} and is teleport-bound to
 * `document.body`, so it renders even when individual route views are
 * unmounted.
 *
 * The toast is the canonical surface for user feedback: even when the page
 * is hidden and a browser notification fires, the same payload is also pushed
 * here so the user sees it the moment they return (within the 30s
 * warning/error window).
 */
export const toastTransport: MessageTransport = {
  name: "toast",
  available: () => true,
  send(payload: MessagePayload) {
    const toast = useToast();
    toast.show(payload.message, {
      type: payload.severity,
      duration: payload.duration,
      copyable: payload.copyable,
    });
  },
};
