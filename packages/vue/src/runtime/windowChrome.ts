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
 *      RECORDED, NOT FIXED (PR notes): (a) the internals-only cluster polls
 *      `is_maximized` every `RESIZE_POLL_MS` while mounted — one small IPC
 *      round-trip per interval, the acceptable price of the resize-event
 *      targeting problem above; (b) a PARTIAL `__TAURI__` (some methods
 *      missing) is treated as "not usable" and falls through to the IPC path
 *      rather than rendering buttons that cannot all work.
 *
 *      `boot-chrome.js` (src/res/boot-chrome.js) mirrors this exact order and
 *      these exact commands. It is a classic script and cannot import this
 *      module, so the two files are kept in sync by convention — and by the
 *      parity test in `src/res/bootChrome.test.ts`, which reads the script and
 *      asserts it carries the same `WINDOW_IPC` command names. Change one,
 *      change both.
 *
 *   2. `watchMaximizedState()` — the ONE read path for "is this window
 *      maximized?", so no consumer can re-derive the state by hand again. It
 *      reads the shell once, re-reads on every resize event the shell publishes,
 *      and degrades to a bounded poll when the shell refuses to subscribe. The
 *      2026-11-12 report (a maximized window whose caption button still drew a
 *      square, aria-label stuck on "Maximize") was a consumer-side read path
 *      that had silently lost the shell receiver: Tauri 2's `Window` methods are
 *      PROTOTYPE methods that read `this.label`, so a reference detached from
 *      the window object throws on every call.
 *
 *   3. `claimWindowChrome()` — the `hk:chrome-claim` handoff. A Tauri shell with
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
 *
 *   4. `CHROME_BAND_DRAG_REGION` — the drag-region attribute value caption
 *      band roots carry, so the band's WHOLE surface (not just the pixels the
 *      band element itself paints) drags and double-click-maximizes under
 *      Tauri's injected drag handler. See the constant's doc for the exact
 *      self/deep/false semantics the handler implements.
 *
 *   5. `CHROME_BAND_HEIGHT_VAR` — the custom property a host publishes so the
 *      pre-boot bar wears the app's caption band height from the first frame
 *      instead of a thin default the band then replaces.
 */

import { type HostWindow } from "../utils/typing";

/** The window event name — the contract between the boot bar and the app. */
export const CHROME_CLAIM_EVENT = "hk:chrome-claim";

/** `<html>` attribute marking the app as the chrome owner. */
export const CHROME_OWNER_ATTR = "data-hk-chrome";

/**
 * The `data-tauri-drag-region` attribute value that promotes a WHOLE caption
 * band — the band AND its non-interactive descendants — to a drag/maximize
 * surface (2026-11-12 user report, the chest desktop window).
 *
 * Tauri's injected drag handler (`tauri` 2.12 `src/window/scripts/drag.js`)
 * walks the event's composed path and decides per element:
 *
 *   - bare attr / `"true"` — SELF-only: the drag region matches only when the
 *     event target IS that exact element;
 *   - `"deep"` — any descendant of the element triggers, and the walk stops at
 *     the first match UNLESS a clickable element (a/button/input/select/
 *     textarea/label/summary, an editing host, a tabindexed node or an
 *     interactive role) without the attribute sits in the path — those block;
 *     an element explicitly carrying `"false"` blocks too;
 *   - `"false"` — drag blocked here and for every ancestor.
 *
 * A caption band is never one element: wings, wrappers and text spans tile the
 * whole strip, so a BARE attribute on the band matches only the pixels the band
 * element itself paints — its own children shadow it, and dragging plus the
 * double-click maximize (`internal_toggle_maximize`, already allowed by
 * `core:window:default`) never fire even though the attribute is visibly
 * there. Caption band roots therefore take the value from THIS constant —
 * `HkTitleBar`, the chrome face of `HkAdminHeader`, and every host band —
 * instead of a local literal, so the semantics stay reviewable in one place.
 * Interactive children need no opt-out: the clickables block themselves, and
 * `HkWindowControls` already carries the explicit `"false"`.
 */
export const CHROME_BAND_DRAG_REGION = "deep";

/**
 * The CSS custom property that publishes a host's caption band height to the
 * pre-boot window bar (`src/res/boot-chrome.js`).
 *
 * The boot strip exists BEFORE the app bundle, so it cannot read the app's
 * stylesheet tokens directly; the host declares its band height to :root from
 * its pre-paint skeleton (an inline `:root` style or a static stylesheet) —
 * a plain length (`"48px"`, `"3rem"`) or a var() chain
 * (`"var(--s-header-height, 3rem)"`). The bar wears the value verbatim, so it
 * matches the app's caption band from the first frame AND keeps tracking the
 * token once the real stylesheet lands (2026-11-12 user report: chest's wide
 * 3rem band booted behind a thin 32px strip). Without the var — or when the
 * plugin's explicit `height` option is set — the bar keeps its thin default.
 * The name is mirrored as a string literal inside `res/boot-chrome.js` (a
 * classic script, no imports); the parity test in `src/res/bootChrome.test.ts`
 * fails if either side drifts.
 */
export const CHROME_BAND_HEIGHT_VAR = "--hk-chrome-band-h";

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
 * How many resize-fallback reads a shell that hands out NO subscription gets.
 *
 * The global path does not poll while the shell publishes resize events (one
 * event per maximize/restore, verified live) — that would be needless IPC. This
 * bound only applies to the last-resort case: a shell that failed to give us an
 * unlisten handle. Bounded on purpose, so a broken shell costs at most this
 * many reads (a minute at `RESIZE_POLL_MS`) instead of one forever.
 */
export const RESIZE_FALLBACK_TICKS = 120;

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
  invoke?: (command: string, args?: Record<string, unknown>) => unknown;
  metadata?: { currentWindow?: { label?: unknown } };
}

/** The host-injected globals this module reads, as `window` extensions. */
interface TauriGlobalScope {
  __TAURI__?: { window?: { getCurrentWindow?: unknown } };
}

interface TauriInternalsScope {
  __TAURI_INTERNALS__?: TauriInternalsLike;
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

/**
 * The handle returned when a shell could not give us an event subscription.
 *
 * Exported from THIS module (deliberately NOT from the package barrels, so the
 * public surface is unchanged) so the two places that must tell "subscribed"
 * from "nothing to subscribe to" compare against one documented sentinel
 * instead of re-deriving it. Every `onResized` path returns it verbatim when it
 * cannot subscribe — pinned by the resolver tests — which is what lets
 * `watchMaximizedState` decide whether its bounded fallback poll is needed.
 */
export const NO_UNLISTEN: () => void = noUnlisten;

/** The documented `__TAURI__` window API, normalized. */
function globalWindowApi(): WindowApiLike | null {
  if (!canUseDom()) return null;
  const scope = window as HostWindow<TauriGlobalScope>;
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
  // THE RECEIVER RULE (2026-11-12): Tauri 2 hands out a CLASS INSTANCE whose
  // methods live on the prototype and read `this.label` (Tauri 2.12:
  // `async isMaximized() { return invoke("plugin:window|is_maximized", { label:
  // (await this.getCurrentWindow()).label }) }`-shaped). Extracting a method by
  // value — `const isMaximized = shell.isMaximized; isMaximized()` — loses the
  // receiver and throws "Cannot read properties of undefined (reading 'label')"
  // on EVERY call. That was this file's bug: `minimize`/`toggleMaximize`/`close`
  // were wrapped as thunks (keeping the receiver) while `isMaximized` was
  // detached, so the maximized state was permanently `false` and the caption
  // glyph never flipped to Restore. Every shell method is now invoked THROUGH
  // `shell` (or with an explicit `.call(shell)`), so the split cannot come back.
  //
  // The two optional methods are copied into locals (typed by the resolver's own
  // interface) and called with `.call(shell)`: keeps the receiver WITHOUT an
  // assertion, and narrows once instead of once per invocation.
  const isMax = shell.isMaximized;
  const onRes = shell.onResized;

  return {
    kind: "global",
    label: typeof shell.label === "string" ? shell.label : null,
    minimize: () => call(() => shell.minimize()).then(() => undefined),
    toggleMaximize: () => call(() => shell.toggleMaximize()).then(() => undefined),
    close: () => call(() => shell.close()).then(() => undefined),
    isMaximized:
      typeof isMax === "function"
        ? () => call(() => isMax.call(shell)).then((value) => Boolean(value))
        : () => Promise.resolve(false),
    onResized:
      typeof onRes === "function"
        ? (handler) =>
            call(() => onRes.call(shell, handler)).then((off) =>
              typeof off === "function" ? (off as () => void) : noUnlisten,
            )
        : () => Promise.resolve(noUnlisten),
  };
}

/**
 * Resize subscription for the internals path.
 *
 * The internals-only case polls the maximized flag instead of listening to
 * `tauri://resize`: Tauri 2 emits window resize events targeted at
 * `Window{label}` / `WebviewWindow{label}`, so a listener registered with the
 * default (Any) target never receives them — the glyph silently stops
 * following the window. A 500 ms `is_maximized` poll always works and is
 * stopped by the returned handle. (Accepted cost, recorded for the PR: one
 * small IPC round-trip per interval while an internals-only cluster is
 * mounted.) Losing the maximized state must never cost the three buttons,
 * which is why this degrades instead of failing.
 */
function internalsResize(handler: () => void): Promise<() => void> {
  if (typeof setInterval !== "function") return Promise.resolve(noUnlisten);
  const timer = setInterval(handler, RESIZE_POLL_MS);
  return Promise.resolve(() => clearInterval(timer));
}

/** The `__TAURI_INTERNALS__` IPC path, normalized. */
function internalsWindowApi(): WindowApiLike | null {
  if (!canUseDom()) return null;
  const scope = window as HostWindow<TauriInternalsScope>;
  const internals = scope.__TAURI_INTERNALS__;
  const invoke = internals?.invoke;
  if (!internals || typeof invoke !== "function") return null;
  const send = (command: string): Promise<unknown> =>
    call(() => invoke.call(internals, command, {}));
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

/** What a caller gets when there is no shell to watch. */
const NO_WATCH: () => void = noUnlisten;

/**
 * Watch the maximized state — THE read path for caption-button glyphs.
 *
 * Depends on nothing but `WindowApiLike`, so it reuses whichever test double
 * the caller resolved and cannot re-break the receiver rule (a detached helper
 * function has no receiver to lose). It stops when its handle is called, and
 * never leaves an unhandled rejection behind: an unresolved state is not a
 * failure worth taking the window down for (the family's `res/fatal-fallback.js`
 * turns one into a full-screen boot-failure landing).
 *
 * Failure ladder, cheapest first:
 *   1. one immediate read, so the first paint already matches the window;
 *   2. `onResized` — Tauri 2 delivers resize events to `Window{label}` targets,
 *      which is why the internals path has no event to subscribe to and brings
 *      its own bounded poll instead;
 *   3. only when the subscription itself is refused (or hands back nothing
 *      callable) does a bounded poll take over, so a maximized window still
 *      draws Restore on a shell that cannot publish events at all.
 *
 * `report` is called only with real observations — a rejected read keeps the
 * previous answer rather than flashing a bogus glyph.
 */
export function watchMaximizedState(
  api: WindowApiLike | null,
  report: (maximized: boolean) => void,
): () => void {
  // No shell at all: the callers render nothing in that case, so the only
  // contract left to keep is "the handle is always callable".
  if (!api || typeof report !== "function") return NO_WATCH;

  let stopped = false;
  // True once the shell handed back a callable unlisten handle — the ONLY thing
  // that keeps the bounded fallback poll disarmed.
  let subscribed = false;
  let unlisten: (() => void) | null = null;
  let timer: ReturnType<typeof setInterval> | null = null;

  const read = () => {
    if (stopped) return;
    // BOTH failure surfaces are handled: a shell that throws SYNCHRONOUSLY out
    // of isMaximized() (a foreign WindowApiLike can — the library's own
    // resolver wraps every call in call()), and a reporter that throws. On this
    // family res/fatal-fallback.js turns ONE unhandled rejection into the
    // full-screen "Application failed to load" landing, so neither surface may
    // ever escape this function.
    try {
      void api.isMaximized().then(
        (value) => {
          if (stopped) return;
          try {
            report(!!value);
          } catch {
            /* a throwing reporter is a consumer bug, not a boot failure */
          }
        },
        () => {},
      );
    } catch {
      /* degrade exactly like a rejected read: keep the previous answer */
    }
  };

  const stopPolling = () => {
    if (timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  };

  /** Call an unlisten handle that may throw — teardown must never surface it. */
  const safeStop = (stop: () => void): void => {
    try {
      stop();
    } catch {
      /* a hostile handle must not break teardown (or become unhandled) */
    }
  };

  /**
   * The last resort: at most `RESIZE_FALLBACK_TICKS` reads, then it gives up
   * quietly (a window whose shell cannot report events should not cost an IPC
   * round-trip a minute for the rest of the session). Internals already count
   * their own poll as `onResized`, so this only covers the global path.
   */
  const startPolling = () => {
    if (stopped || subscribed || typeof setInterval !== "function") return;
    // Never two timers: a refused subscription can reach here twice (a thrown
    // call and a rejected promise), and a double poll would double the IPC.
    if (timer !== null) return;
    let ticks = 0;
    timer = setInterval(() => {
      ticks += 1;
      if (ticks > RESIZE_FALLBACK_TICKS) {
        stopPolling();
        return;
      }
      read();
    }, RESIZE_POLL_MS);
  };

  read();
  // An EXPLICIT signal, not an identity check against `noUnlisten`: both
  // wiring paths are allowed to grow their own unlisten shapes, and only this
  // flag decides whether the bounded fallback poll is needed. The internals
  // path returns a real `() => clearInterval(timer)` handle, so it counts as
  // subscribed and never arms a second poll here.
  const subscribe = (): void => {
    let subscription: Promise<() => void>;
    try {
      subscription = api.onResized(read);
    } catch {
      if (!stopped) startPolling();
      return;
    }
    void subscription.then(
      (off) => {
        // The documented sentinel, not "any function counts": a path that could
        // not subscribe hands back `NO_UNLISTEN`, and that is the ONLY thing
        // that arms the bounded fallback below.
        const stop = typeof off === "function" ? (off as () => void) : NO_UNLISTEN;
        if (stopped) {
          safeStop(stop);
          return;
        }
        if (stop === NO_UNLISTEN) {
          startPolling();
          return;
        }
        subscribed = true;
        unlisten = stop;
      },
      () => {
        if (!stopped) startPolling();
      },
    );
  };
  subscribe();

  return () => {
    stopped = true;
    stopPolling();
    const off = unlisten;
    unlisten = null;
    if (off) safeStop(off);
  };
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
