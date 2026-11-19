/**
 * HkContextMenuProvider.tsx — mount-once host of the app's context menu.
 *
 * Renders nothing of its own except the default slot plus ONE menu: a
 * `HkMenu` (popup variant) whose anchor is a zero-size synthetic rect at
 * the pointer that opened it. Everything a menu needs — desktop popout
 * vs mobile bottom sheet, viewport flipping, popup z-stack, outside
 * click, Escape, keyboard navigation, cascading submenus — is the shared
 * select-panel machinery, so a context menu is styled and behaves like
 * every other menu in the family.
 *
 * The placement picks the quadrant the pointer sits in (menus grow away
 * from the nearest edge); HkSelectPanel still auto-flips when its side
 * cannot host the panel, so the quadrant choice is a preference, not a
 * constraint.
 *
 * Mount once near the app root:
 *
 *   <HContextMenuProvider> <App/> </HContextMenuProvider>
 *
 * Consumers open menus through `useContextMenu()` /
 * `useContextMenuTrigger()` (composables/useContextMenu).
 */

import { computed, defineComponent, onBeforeUnmount, provide, ref, shallowRef, watch } from "vue";

import { popupViewportRect } from "../runtime/popupBounds";
import HkMenu from "./HkMenu";
import type { PanelAnchor } from "./HkSelectPanel";
import { contextMenuDefaultsFor } from "../composables/defaultContextMenu";
import {
  CONTEXT_MENU_KEY,
  type ContextMenuApi,
  type ContextMenuRequest,
  type ContextTriggerPoint,
} from "../composables/useContextMenu";

/** Pick the HkMenu placement that grows away from the pointer's nearest
 * edges: `bottom-*` when there is more room below, `*-start` when there
 * is more room to the right. The halves split the POPUP viewport (the
 * window minus the app-chrome band the host configured — popupBounds),
 * so a menu opened over a desktop shell's reserved strip grows into the
 * usable space like every other popup. */
export function quadrantPlacement(x: number, y: number): "bottom-start" | "bottom-end" | "top-start" | "top-end" {
  if (typeof window === "undefined") return "bottom-start";
  const frame = popupViewportRect();
  const below = y <= frame.y + frame.height / 2;
  const right = x <= frame.x + frame.width / 2;
  if (below && right) return "bottom-start";
  if (below) return "bottom-end";
  return right ? "top-start" : "top-end";
}

/** Zero-size anchor at the open point — the same synthetic-anchor trick
 *  HkMenu's cascades use, so the shared panel positions a menu at a POINTER
 *  exactly like it positions a submenu at a row.
 *
 *  `PanelAnchor` is the panel's own minimum (rect + hit containment), so a
 *  plain object stands in for it with no assertion and no mounted element:
 *  `contains` answers `false` for the panel, so an outside click closes the
 *  menu — the same behavior a detached div with an overridden rect gave. */
function pointAnchor(x: number, y: number): PanelAnchor {
  return {
    getBoundingClientRect: () => new DOMRect(x, y, 0, 0),
    contains: () => false,
  };
}

export default defineComponent({
  name: "HkContextMenuProvider",
  props: {
    /**
     * Install the app-wide DEFAULT context-menu regime while this
     * provider is mounted (composables/defaultContextMenu): a
     * window-level bubble listener that yields to any element-level
     * binding (those preventDefault first), consults the registered
     * default contributors (the built-in clipboard menu claims
     * editable targets), and suppresses the platform menu everywhere
     * else. Hosts extend the regime with
     * `registerContextMenuDefault(...)` — region-specific defaults
     * belong in contributors, not in new window listeners.
     */
    defaults: { type: Boolean, default: false },
  },
  setup(props, { slots }) {
    const open = ref(false);
    const request = shallowRef<ContextMenuRequest | null>(null);
    /** Remount identity: every open() swaps the HkMenu instance, so a
     *  replacement menu starts from a CLEAN slate — cascade levels,
     *  back-guard, hovered submenus — without racing a
     *  close-then-reopen toggle through Vue's scheduler (a same-tick
     *  double open, or the reactive-proxy identity trap, both ride
     *  that race; R2 NEW-MAJOR-1/NEW-MINOR-1). */
    const menuEpoch = ref(0);
    /** The select handler just ran: HkMenu follows `select` with
     *  `update:open(false)` (select first, then closeAll — HkMenu's
     *  onItem). That trailing close belongs to the FINISHED menu: it
     *  must not fire the new request's onClose nor close a menu the
     *  onSelect handler opened in the meantime. One-shot flag. */
    let justSelected = false;

    /** Close hooks fire exactly once per open. */
    function close(announce: boolean) {
      if (!open.value) return;
      open.value = false;
      if (announce) request.value?.onClose?.();
      request.value = null;
    }

    const api: ContextMenuApi = {
      open(next: ContextMenuRequest) {
        // Replacing an open menu closes the previous one — its owner gets
        // the "closed without a selection" hook it was promised.
        if (open.value) request.value?.onClose?.();
        request.value = next;
        menuEpoch.value += 1;
        open.value = true;
      },
      close() {
        close(true);
      },
    };
    provide(CONTEXT_MENU_KEY, api);

    // ── The default regime (prop `defaults`) ─────────────────────────
    // Window-level BUBBLE phase: target-level bindings run first on the
    // element; only their leftovers reach here (defaultPrevented =
    // yielded). The platform menu never appears: the regime owns every
    // unclaimed right-click, with a menu when a contributor claims the
    // point and silent suppression otherwise.
    //
    // preventDefault comes FIRST: the platform menu must be suppressed
    // even when a contributor misbehaves, and a throwing contributor is
    // isolated (DEV-loud) instead of silently handing the event back to
    // the browser.
    function onWindowContextMenu(event: MouseEvent) {
      if (event.defaultPrevented) return; // a binding opened its menu
      event.preventDefault();
      const point: ContextTriggerPoint = {
        x: event.clientX,
        y: event.clientY,
        kind: "pointer",
        target: event.target,
        defaultPrevented: false,
      };
      let request: ContextMenuRequest | null = null;
      try {
        request = contextMenuDefaultsFor(point);
      } catch (err) {
        if (import.meta.env.DEV) {
          // eslint-disable-next-line no-console -- dev-only drift alarm
          console.error("[HkContextMenuProvider] default contributor threw:", err);
        }
      }
      if (request) api.open(request);
    }

    // The listener follows the prop: a host may flip `defaults` at
    // runtime (a face that gains the regime after boot), and toggling it
    // off must actually stop claiming right-clicks.
    let defaultsListening = false;
    /** SSR-safe: a server render has no window, and `immediate: true` runs
     *  this during setup (the provider's documented SSR contract). */
    const canListen = typeof window !== "undefined";
    watch(
      () => props.defaults,
      (on) => {
        if (!canListen) return;
        if (on && !defaultsListening) {
          window.addEventListener("contextmenu", onWindowContextMenu);
          defaultsListening = true;
        } else if (!on && defaultsListening) {
          window.removeEventListener("contextmenu", onWindowContextMenu);
          defaultsListening = false;
        }
      },
      { immediate: true },
    );
    onBeforeUnmount(() => {
      // A menu still open when the provider goes away is a menu that
      // closed without a selection — the documented hook fires.
      request.value?.onClose?.();
      if (!canListen) return;
      window.removeEventListener("contextmenu", onWindowContextMenu);
      defaultsListening = false;
    });

    /** A server render has no DOM to build the anchor from: pass `null`,
     *  the same state as a consumer that gives HkMenu no anchor at all
     *  (positioning only ever runs in the browser). */
    const anchor = computed<PanelAnchor | null>(() =>
      typeof document === "undefined"
        ? null
        : pointAnchor(request.value?.x ?? 0, request.value?.y ?? 0),
    );
    const placement = computed(() =>
      quadrantPlacement(request.value?.x ?? 0, request.value?.y ?? 0),
    );

    /** The request's custom regions become HkMenu's level-0 header/
     *  footer slots (object children = slots in Vue JSX). Only the
     *  keys that exist are handed over, so a request without custom
     *  content renders exactly as before. The slot closures re-read
     *  the CURRENT request through the shallowRef, and each open
     *  bumps menuEpoch — a fresh HkMenu mounts with fresh slots, and
     *  the region's own reactive reads (host state) keep it live
     *  while the menu stays open. */
    const menuSlots = () => {
      const req = request.value;
      return {
        ...(req?.header ? { header: () => req.header!() } : {}),
        ...(req?.footer ? { footer: () => req.footer!() } : {}),
      };
    };

    return () => (
      <>
        {slots.default?.()}
        <HkMenu
          key={menuEpoch.value}
          variant="popup"
          items={request.value?.items ?? []}
          open={open.value}
          onUpdate:open={(v: boolean) => {
            if (!v && justSelected) {
              justSelected = false;
              return;
            }
            if (!v) close(true);
          }}
          onSelect={(key: string, item: { key: string }) => {
            const current = request.value;
            if (!current) return;
            justSelected = true;
            open.value = false;
            request.value = null;
            current.onSelect?.(key, item as Parameters<NonNullable<ContextMenuRequest["onSelect"]>>[1]);
          }}
          anchorRef={anchor.value}
          placement={placement.value}
          title={request.value?.title ?? ""}
        >
          {menuSlots()}
        </HkMenu>
      </>
    );
  },
});
