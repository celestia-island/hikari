/**
 * useContextMenu.ts — the injection API + trigger bindings for the
 * app-wide pointer-anchored context menu.
 *
 * The SURFACE is not owned here: the menu renders through the same
 * cascading-menu machinery every other menu uses (`HkContextMenuProvider`
 * mounts one `HkMenu` whose anchor is a zero-size rect at the pointer),
 * so a context menu gets desktop popouts, mobile bottom sheets, popup
 * z-stacking, outside-click/Escape closing, keyboard navigation and
 * submenus for free — instead of a second, parallel menu implementation.
 *
 * Three triggers ship with the API (hosts can also call `open()`
 * directly — the canvas edge layer does, with its own long-press):
 *
 *   - right-click (`contextmenu`, always `preventDefault`ed — the app
 *     never shows the browser's own menu again);
 *   - touch/pen long-press (480 ms hold, 8 px slop);
 *   - the keyboard menu key (ContextMenu / Shift+F10) at the focused
 *     element.
 *
 * A `contextmenu` event that follows our own long-press within the
 * suppression window is swallowed, so platforms that synthesize one
 * after a long touch do not open the menu twice.
 */

import { inject, onBeforeUnmount, watch, type InjectionKey, type Ref } from "vue";

import type { HkMenuItem } from "../components/HkMenu";

/** One open request: where the menu anchors and what it offers. */
export interface ContextMenuRequest {
  /** Anchor point in client (visual) pixels. */
  x: number;
  y: number;
  items: HkMenuItem[];
  /** Sheet header on mobile / popout a11y label on desktop. */
  title?: string;
  /** Called with the picked item's key. The menu closes itself. */
  onSelect?: (key: string, item: HkMenuItem) => void;
  /** Called when the menu closes without a selection (outside click,
   *  Escape, back gesture). */
  onClose?: () => void;
}

/** What a provider injects. */
export interface ContextMenuApi {
  /** Open (or replace) the context menu at a point. */
  open: (request: ContextMenuRequest) => void;
  /** Close the menu, if any (`onClose` fires — the caller cancelled). */
  close: () => void;
}

export const CONTEXT_MENU_KEY: InjectionKey<ContextMenuApi> = Symbol("hk-context-menu");

/** The no-op fallback: without a provider (SSR, a bare test mount) the
 *  triggers do nothing instead of throwing — a context menu is always an
 *  enhancement, never a load-bearing control. */
const NOOP_API: ContextMenuApi = {
  open: () => {},
  close: () => {},
};

/** The context-menu API of the nearest `HkContextMenuProvider`. */
export function useContextMenu(): ContextMenuApi {
  return inject(CONTEXT_MENU_KEY, NOOP_API);
}

/** Long-press hold time and travel slop (px) — the same pair the canvas
 *  edge layer uses, so every surface in the app long-presses alike. */
export const CONTEXT_HOLD_MS = 480;
export const CONTEXT_HOLD_SLOP = 8;

/** How long after a long-press-open a native `contextmenu` event is
 *  still considered the same gesture (some platforms synthesize one). */
const CONTEXT_SUPPRESS_MS = 400;

/** Where the trigger came from — hosts may offer different items for a
 *  keyboard-invoked menu (no pointer target) than a pointer one. */
export interface ContextTriggerPoint {
  x: number;
  y: number;
  kind: "pointer" | "longpress" | "keyboard";
  /** The element the trigger landed on (event.target). */
  target: EventTarget | null;
}

/**
 * Bind the context-menu triggers to an element: right-click, touch/pen
 * long-press and the keyboard menu key. `build` returns the request to
 * open (items + callbacks) or `null` to let the event through untouched
 * — a `null` does NOT preventDefault, so a host can defer to an inner
 * binding (menus resolve innermost-first by DOM order).
 *
 * Returns an unbind function.
 */
export function bindContextMenu(
  el: HTMLElement,
  api: ContextMenuApi,
  build: (point: ContextTriggerPoint) => ContextMenuRequest | null,
): () => void {
  let holdTimer: ReturnType<typeof setTimeout> | null = null;
  let holdOrigin: { x: number; y: number } | null = null;
  let lastOpenedAt = 0;

  const cancelHold = () => {
    if (holdTimer !== null) {
      clearTimeout(holdTimer);
      holdTimer = null;
    }
    holdOrigin = null;
  };

  const openAt = (point: ContextTriggerPoint) => {
    const request = build(point);
    if (!request) return false;
    lastOpenedAt = performance.now();
    api.open(request);
    return true;
  };

  const onContextMenu = (event: MouseEvent) => {
    // Our own long-press just opened the menu; a synthesized native
    // event for the same gesture must not re-open (or replace) it.
    if (performance.now() - lastOpenedAt < CONTEXT_SUPPRESS_MS) {
      event.preventDefault();
      return;
    }
    const opened = openAt({
      x: event.clientX,
      y: event.clientY,
      kind: "pointer",
      target: event.target,
    });
    if (opened) event.preventDefault();
    // Not opened: let it bubble to an outer binding untouched.
  };

  const onPointerDown = (event: PointerEvent) => {
    cancelHold();
    if (event.pointerType === "mouse") return; // mice have a real button
    holdOrigin = { x: event.clientX, y: event.clientY };
    const { clientX, clientY } = event;
    holdTimer = setTimeout(() => {
      cancelHold();
      openAt({ x: clientX, y: clientY, kind: "longpress", target: event.target });
    }, CONTEXT_HOLD_MS);
  };

  const onPointerMove = (event: PointerEvent) => {
    if (holdTimer === null || holdOrigin === null) return;
    if (
      Math.hypot(event.clientX - holdOrigin.x, event.clientY - holdOrigin.y)
        > CONTEXT_HOLD_SLOP
    ) {
      cancelHold();
    }
  };

  const onKeyDown = (event: KeyboardEvent) => {
    const menuKey = event.key === "ContextMenu" || (event.key === "F10" && event.shiftKey);
    if (!menuKey) return;
    const rect = el.getBoundingClientRect();
    const opened = openAt({
      x: rect.left,
      y: rect.bottom,
      kind: "keyboard",
      target: event.target,
    });
    if (opened) event.preventDefault();
  };

  el.addEventListener("contextmenu", onContextMenu);
  el.addEventListener("pointerdown", onPointerDown);
  el.addEventListener("pointermove", onPointerMove);
  el.addEventListener("pointerup", cancelHold);
  el.addEventListener("pointercancel", cancelHold);
  el.addEventListener("keydown", onKeyDown);

  return () => {
    cancelHold();
    el.removeEventListener("contextmenu", onContextMenu);
    el.removeEventListener("pointerdown", onPointerDown);
    el.removeEventListener("pointermove", onPointerMove);
    el.removeEventListener("pointerup", cancelHold);
    el.removeEventListener("pointercancel", cancelHold);
    el.removeEventListener("keydown", onKeyDown);
  };
}

/**
 * Reactive form of `bindContextMenu`: watches the element ref, binds on
 * presence, unbinds on absence and on component unmount. The canonical
 * host usage:
 *
 *   const root = ref<HTMLElement | null>(null);
 *   useContextMenuTrigger(root, ({ kind, target }) =>
 *     buildItemsFor(target, kind));
 */
export function useContextMenuTrigger(
  target: Ref<HTMLElement | null>,
  build: (point: ContextTriggerPoint) => ContextMenuRequest | null,
): void {
  const api = useContextMenu();
  let unbind: (() => void) | null = null;
  watch(
    target,
    (el) => {
      unbind?.();
      unbind = el ? bindContextMenu(el, api, build) : null;
    },
    { immediate: true },
  );
  onBeforeUnmount(() => {
    unbind?.();
    unbind = null;
  });
}
