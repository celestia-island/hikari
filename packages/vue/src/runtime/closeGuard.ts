// AI-generated: developed with the DeepSeek Harness agent (model
// DeepSeek-Flash) and the ZCode agent (model GLM-5.3), directed and reviewed
// by langyo — SySL-1.0 §2.3 disclosure.

/**
 * The runtime half of hikari's close-request handshake.
 *
 * THE PROTOCOL: a shell that owns its window (a frameless desktop app) cannot
 * let the OS close it blindly — the frontend may need to ask "quit or minimize
 * to tray?" first. Such a shell intercepts the close, emits `hk:close-requested`
 * and arms a DEAD-MAN SWITCH: if the webview does not answer within
 * `DEFAULT_FORCE_CLOSE_AFTER_MS`, the renderer is presumed dead and the shell
 * force-closes the window (otherwise a crashed renderer leaves an unclosable
 * window behind — the 0.6.8 incident). The shell-side command that stands the
 * watchdog down is `CLOSE_ACK_COMMAND`.
 *
 * That makes the ACK a protocol obligation of the frontend: `useCloseRequest`
 * acknowledges BEFORE it runs the host's handler, so a dialog, a store write or
 * a blocked event loop can never be mistaken for a dead renderer.
 *
 * WHY NO `@tauri-apps/api` IMPORT: hikari does not depend on the Tauri JS
 * package (it ships to browser builds too), and the internals surface is the
 * one that exists even when `withGlobalTauri` is off or the global API is
 * late — the field report that shaped `runtime/windowChrome.ts`. Event
 * listening therefore reproduces the two calls `@tauri-apps/api/event`'s
 * `listen` makes against `window.__TAURI_INTERNALS__` (verified against
 * 2.11/2.12):
 *
 *   1. `transformCallback(handler)` registers the JS handler and returns an id;
 *   2. `invoke("plugin:event|listen", { event, target: { kind: "Any" }, handler: id })`
 *      subscribes and resolves with the shell-side event id;
 *   3. unlisten deregisters the JS callback through
 *      `window.__TAURI_EVENT_PLUGIN_INTERNALS__.unregisterListener(event, eventId)`
 *      and tells the shell `invoke("plugin:event|unlisten", { event, eventId })`.
 *
 * If that surface is incomplete, the documented `window.__TAURI__.event.listen`
 * (withGlobalTauri) is used instead. Outside a Tauri webview — a browser tab,
 * SSR, a test — everything here is a safe no-op.
 */

import { type HostWindow } from "../utils/typing";

/** The event a shell emits when the window close is intercepted. */
export const CLOSE_REQUEST_EVENT = "hk:close-requested";

/** The shell-side command that disarms the force-close watchdog. */
export const CLOSE_ACK_COMMAND = "plugin:hikari-host|ack_close";

/**
 * How long a shell waits for the ack before force-closing the window, in ms.
 * Exported so hosts and tests can pin the same budget the shell arms; this
 * module never waits that long itself — the ACK is sent immediately.
 */
export const DEFAULT_FORCE_CLOSE_AFTER_MS = 5000;

interface TauriInternalsLike {
  invoke?: (command: string, args?: Record<string, unknown>) => unknown;
  transformCallback?: (
    callback: (event: unknown) => void,
    once?: boolean,
  ) => unknown;
}

interface TauriEventApiLike {
  listen?: (event: string, handler: (event: unknown) => void) => unknown;
}

interface TauriGlobalLike {
  event?: TauriEventApiLike;
}

interface TauriEventPluginInternalsLike {
  unregisterListener?: (event: string, eventId: unknown) => void;
}

/** The globals a Tauri 2 webview may expose (all optional by design). */
interface TauriScope {
  __TAURI_INTERNALS__?: TauriInternalsLike;
  __TAURI__?: TauriGlobalLike;
  __TAURI_EVENT_PLUGIN_INTERNALS__?: TauriEventPluginInternalsLike;
}

/** True only where a real document exists (never during SSR). */
function canUseDom(): boolean {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

/** The Tauri global surface, or null outside a webview. */
function tauriScope(): TauriScope | null {
  if (!canUseDom()) return null;
  // A single legal assertion: every `TauriScope` member is optional, so the
  // intersection only ADDS the host-injected names on top of `window`.
  return window as HostWindow<TauriScope>;
}

/** Run a shell call that may throw, return a promise or return a scalar. */
function call<T>(fn: () => T | Promise<T>): Promise<T> {
  try {
    return Promise.resolve(fn());
  } catch (err) {
    return Promise.reject(err);
  }
}

function noUnlisten(): void {
  /* nothing was subscribed */
}

/**
 * Acknowledge a close request and stand the shell's force-close watchdog down.
 *
 * Fire-and-forget by contract: resolves `true` when the shell accepted the ack,
 * `false` when there is no shell / the command failed (older shell, IPC
 * hiccup). NEVER throws and NEVER rejects — a failed ack must not cost the
 * host its quit dialog.
 */
export function ackCloseRequest(): Promise<boolean> {
  const internals = tauriScope()?.__TAURI_INTERNALS__;
  const invoke = internals?.invoke;
  if (!internals || typeof invoke !== "function") return Promise.resolve(false);
  return call(() => invoke.call(internals, CLOSE_ACK_COMMAND, {})).then(
    () => true,
    () => false,
  );
}

/**
 * Subscribe through the `__TAURI_INTERNALS__` IPC surface (the path that works
 * with or without `withGlobalTauri`). Returns null when that surface is
 * incomplete, so the caller can fall back to the documented global API.
 */
function subscribeInternals(
  handler: (event: unknown) => void,
): Promise<() => void> | null {
  const scope = tauriScope();
  const internals = scope?.__TAURI_INTERNALS__;
  const invoke = internals?.invoke;
  const transformCallback = internals?.transformCallback;
  if (
    !scope ||
    !internals ||
    typeof invoke !== "function" ||
    typeof transformCallback !== "function"
  ) {
    return null;
  }

  let callbackId: unknown;
  try {
    callbackId = transformCallback.call(internals, handler, false);
  } catch {
    return null;
  }

  const listening = call(() =>
    invoke.call(internals, "plugin:event|listen", {
      event: CLOSE_REQUEST_EVENT,
      target: { kind: "Any" },
      handler: callbackId,
    }),
  );

  return listening.then((eventId) => {
    return () => {
      // Mirrors @tauri-apps/api/event's _unlisten: deregister the JS callback
      // first (best effort — the shell-side unlisten below is the contract).
      try {
        const pluginInternals = scope.__TAURI_EVENT_PLUGIN_INTERNALS__;
        const unregister = pluginInternals?.unregisterListener;
        if (pluginInternals && typeof unregister === "function") {
          unregister.call(pluginInternals, CLOSE_REQUEST_EVENT, eventId);
        }
      } catch {
        /* a missing callback table must not skip the shell unlisten */
      }
      void call(() =>
        invoke.call(internals, "plugin:event|unlisten", {
          event: CLOSE_REQUEST_EVENT,
          eventId: eventId,
        }),
      ).catch(() => undefined);
    };
  });
}

/**
 * Subscribe through the documented `window.__TAURI__.event.listen` (only
 * present when the host builds with `withGlobalTauri`). Fallback for shells
 * whose internals surface is incomplete.
 */
function subscribeGlobal(
  handler: (event: unknown) => void,
): Promise<() => void> | null {
  const scope = tauriScope();
  const eventApi = scope?.__TAURI__?.event;
  const listen = eventApi?.listen;
  if (!eventApi || typeof listen !== "function") return null;
  return call(() => listen.call(eventApi, CLOSE_REQUEST_EVENT, handler)).then(
    (off) => (typeof off === "function" ? (off as () => void) : noUnlisten),
  );
}

/**
 * Subscribe to `hk:close-requested` for the current window.
 *
 * On every close request the ACK is sent FIRST (fire-and-forget), then
 * `handler` runs — that ordering is the point of this composable: the shell's
 * dead-man switch must stand down before any host code can block.
 *
 * Returns an idempotent, always-safe unlisten. Outside a Tauri webview (browser
 * tab, SSR) it subscribes to nothing and returns a no-op. The subscription is
 * asynchronous internally; disposing before it resolves still releases the
 * listener as soon as it exists.
 *
 * @param handler Host-side close-request handler (show the quit dialog, run the
 *   remembered action, …). Exceptions propagate to the shell's event dispatch,
 *   exactly like a DOM listener.
 * @returns Idempotent unlisten callback.
 */
export function useCloseRequest(handler: () => void): () => void {
  const scope = tauriScope();
  if (!scope || typeof handler !== "function") return noUnlisten;

  const dispatch = (): void => {
    // ACK BEFORE the host handler — see the file header. Fire-and-forget: a
    // failed ack (older shell, IPC hiccup) must never affect the quit flow.
    void ackCloseRequest();
    handler();
  };

  // Internals first (works without withGlobalTauri); documented global API
  // second (a shell that injected only __TAURI__).
  const pending = subscribeInternals(dispatch) ?? subscribeGlobal(dispatch);
  if (!pending) return noUnlisten;

  let disposed = false;
  let unlisten: (() => void) | null = null;

  void pending
    .then((off) => {
      if (disposed) {
        // Disposed before the async subscription resolved: release it now.
        try {
          off();
        } catch {
          /* unlisten is always safe */
        }
        return;
      }
      unlisten = off;
    })
    .catch(() => {
      /* The shell refused the subscription; nothing is listening. */
    });

  return () => {
    disposed = true;
    const off = unlisten;
    unlisten = null;
    if (off) {
      try {
        off();
      } catch {
        /* unlisten is always safe */
      }
    }
  };
}
