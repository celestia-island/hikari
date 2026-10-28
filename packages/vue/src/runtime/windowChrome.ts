/**
 * Window-chrome plumbing shared by every hikari consumer.
 *
 * Two things live here:
 *
 *   1. `resolveWindowApi()` — THE window-control surface. One resolver, two
 *      wiring paths, in this order:
 *
 *        a. `window.__TAURI__.window.getCurrentWindow()` — the documented JS
 *           API (present when the host builds with `withGlobalTauri`).
 *        b. `window.__TAURI_INTERNALS__.invoke(...)` — the IPC surface every
 *           Tauri 2 webview has. The window is resolved from the IPC context,
 *           so the commands take no required arguments (verified against Tauri
 *           2.12), and `metadata.currentWindow.label` identifies the window.
 *
 *      The second path is not a nicety: the reported failure (2026-10-28) was
 *      a boot where `__TAURI__` was missing/late, so anything that gated on it
 *      rendered NO controls — and the boot bar never got claimed, leaving two
 *      competing caption strips.
 *
 *      `boot-chrome.js` (src/res/boot-chrome.js) mirrors this exact order and
 *      these exact commands. It is a classic script and cannot import this
 *      module, so the two files are kept in sync by convention — and by the
 *      parity test in `src/res/bootChrome.test.ts`, which reads the script and
 *      asserts it carries the same `WINDOW_IPC` command names. Change one,
 *      change both.
 *
 *   2. `claimWindowChrome()` — the `hk:chrome-claim` handoff. A Tauri shell with
 *      `decorations: false` has no OS title bar, so hikari's boot bar draws a
 *      minimal caption strip while the bundle loads. As soon as a component
 *      renders real window controls it dispatches the claim; the boot bar fades
 *      out and removes itself. Dispatch is per-mount and never revoked.
 *
 *      `document.documentElement[data-hk-chrome="app"]` records that the app
 *      owns the chrome, so stylesheets (and the boot bar) can tell "app drawn"
 *      from "still booting" without listening for anything.
 *
 *      Hosts that paint their OWN title bar (instead of HkTitleBar /
 *      HkWindowControls) call `claimWindowChrome(by)` directly.
 */

/** The window event name — the contract between the boot bar and the app. */
export const CHROME_CLAIM_EVENT = "hk:chrome-claim";

/** `<html>` attribute marking the app as the chrome owner. */
export const CHROME_OWNER_ATTR = "data-hk-chrome";

/**
 * The Tauri 2.12 IPC command names, in ONE place.
 *
 * `res/boot-chrome.js` hard-codes the same strings (it cannot import TS); the
 * parity test in `src/res/bootChrome.test.ts` fails if either side drifts.
 */
export const WINDOW_IPC = {
  minimize: "plugin:window|minimize",
  toggleMaximize: "plugin:window|toggle_maximize",
  close: "plugin:window|close",
  isMaximized: "plugin:window|is_maximized",
} as const;

/**
 * How often the internals fallback polls the maximized flag when the shell
 * exposes no resize event at all (the glyph must still track the OS).
 */
export const RESIZE_POLL_MS = 500;

/**
 * The window-control surface every consumer talks to. Both wiring paths are
 * normalized to it, so callers never branch on which one answered.
 */
export interface WindowApiLike {
  /** Which path answered — `global` is the documented API, `internals` the IPC. */
  readonly kind: "global" | "internals";
  /** Window label, when the shell publishes one (`metadata.currentWindow.label`). */
  readonly label: string | null;
  minimize(): Promise<void>;
  toggleMaximize(): Promise<void>;
  close(): Promise<void>;
  isMaximized(): Promise<boolean>;
  /** Subscribe to resize events; resolves with an unlisten handle that is
   *  always safe to call (even when the shell had nothing to subscribe to). */
  onResized(handler: () => void): Promise<() => void>;
}

interface TauriGlobalWindowLike {
  label?: unknown;
  minimize: () => unknown;
  toggleMaximize: () => unknown;
  close: () => unknown;
  isMaximized?: () => unknown;
  onResized?: (handler: () => void) => unknown;
}

interface TauriInternalsLike {
  invoke?: unknown;
  metadata?: { currentWindow?: { label?: unknown } };
}

/** True only where a real document exists (never during SSR). */
function canUseDom(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof document !== "undefined" &&
    !!document.documentElement
  );
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

/** The documented `__TAURI__` window API, normalized. */
function globalWindowApi(): WindowApiLike | null {
  if (!canUseDom()) return null;
  const scope = window as unknown as {
    __TAURI__?: { window?: { getCurrentWindow?: unknown } };
  };
  const api = scope.__TAURI__?.window;
  const get = api?.getCurrentWindow;
  if (typeof get !== "function") return null;

  let found: TauriGlobalWindowLike | null = null;
  try {
    found =
      ((get as () => TauriGlobalWindowLike | null).call(api) as
        | TauriGlobalWindowLike
        | null) ?? null;
  } catch {
    return null;
  }
  if (
    !found ||
    typeof found.minimize !== "function" ||
    typeof found.toggleMaximize !== "function" ||
    typeof found.close !== "function"
  ) {
    return null;
  }
  const shell = found;
  const isMaximized = shell.isMaximized;
  const onResized = shell.onResized;

  return {
    kind: "global",
    label: typeof shell.label === "string" ? shell.label : null,
    minimize: () => call(() => shell.minimize()).then(() => undefined),
    toggleMaximize: () => call(() => shell.toggleMaximize()).then(() => undefined),
    close: () => call(() => shell.close()).then(() => undefined),
    isMaximized:
      typeof isMaximized === "function"
        ? () => call(() => isMaximized()).then((value) => Boolean(value))
        : () => Promise.resolve(false),
    onResized:
      typeof onResized === "function"
        ? (handler) =>
            call(() => onResized.call(shell, handler)).then((off) =>
              typeof off === "function" ? (off as () => void) : noUnlisten,
            )
        : () => Promise.resolve(noUnlisten),
  };
}

/**
 * Resize subscription for the internals path: the host's event API when it is
 * around (`listen("tauri://resize")`), otherwise a light poll of the maximized
 * flag. Losing the event surface must never cost the three buttons, which is
 * why this degrades instead of failing.
 */
function internalsResize(handler: () => void): Promise<() => void> {
  const scope = window as unknown as {
    __TAURI__?: { event?: { listen?: unknown } };
  };
  const eventApi = scope.__TAURI__?.event;
  const listen = eventApi?.listen;
  if (eventApi && typeof listen === "function") {
    const subscribe = listen as (event: string, cb: () => void) => unknown;
    return call(() => subscribe.call(eventApi, "tauri://resize", handler))
      .then((off) => (typeof off === "function" ? (off as () => void) : noUnlisten))
      .catch(() => noUnlisten);
  }
  if (typeof setInterval !== "function") return Promise.resolve(noUnlisten);
  const timer = setInterval(handler, RESIZE_POLL_MS);
  return Promise.resolve(() => clearInterval(timer));
}

/** The `__TAURI_INTERNALS__` IPC path, normalized. */
function internalsWindowApi(): WindowApiLike | null {
  if (!canUseDom()) return null;
  const scope = window as unknown as { __TAURI_INTERNALS__?: TauriInternalsLike };
  const internals = scope.__TAURI_INTERNALS__;
  const invoke = internals?.invoke;
  if (!internals || typeof invoke !== "function") return null;
  const send = (command: string): Promise<unknown> =>
    call(() =>
      (invoke as (cmd: string, args: Record<string, unknown>) => unknown).call(
        internals,
        command,
        {},
      ),
    );
  const label = internals.metadata?.currentWindow?.label;

  return {
    kind: "internals",
    label: typeof label === "string" ? label : null,
    minimize: () => send(WINDOW_IPC.minimize).then(() => undefined),
    toggleMaximize: () => send(WINDOW_IPC.toggleMaximize).then(() => undefined),
    close: () => send(WINDOW_IPC.close).then(() => undefined),
    isMaximized: () => send(WINDOW_IPC.isMaximized).then((value) => Boolean(value)),
    onResized: (handler) => internalsResize(handler),
  };
}

/**
 * The ONE window-control resolver (see the file header): the documented
 * `__TAURI__` API first, the IPC surface second, `null` when neither exists
 * (browser preview, SSR, a shell that never injected Tauri).
 */
export function resolveWindowApi(): WindowApiLike | null {
  return globalWindowApi() ?? internalsWindowApi();
}

/**
 * Announce that `by` has rendered real window controls.
 *
 * Returns true when the claim was dispatched. The detail carries `by` so a
 * listener can log which component took over; the event itself carries no
 * semantics beyond "chrome exists now".
 */
export function claimWindowChrome(by: string): boolean {
  if (!canUseDom()) return false;
  try {
    document.documentElement.setAttribute(CHROME_OWNER_ATTR, "app");
  } catch {
    /* a frozen document must not cost the handoff below */
  }
  try {
    window.dispatchEvent(
      new CustomEvent(CHROME_CLAIM_EVENT, { detail: { by } }),
    );
    return true;
  } catch {
    // Engines without the CustomEvent constructor still need the handoff: a
    // bare event is enough — the boot bar never reads the detail.
    try {
      window.dispatchEvent(new Event(CHROME_CLAIM_EVENT));
      return true;
    } catch {
      return false;
    }
  }
}
