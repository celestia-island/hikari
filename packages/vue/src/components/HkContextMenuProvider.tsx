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

import { computed, defineComponent, provide, ref, shallowRef } from "vue";

import HkMenu from "./HkMenu";
import {
  CONTEXT_MENU_KEY,
  type ContextMenuApi,
  type ContextMenuRequest,
} from "../composables/useContextMenu";

/** Pick the HkMenu placement that grows away from the pointer's nearest
 * edges: `bottom-*` when there is more room below, `*-start` when there
 * is more room to the right. */
function quadrantPlacement(x: number, y: number): "bottom-start" | "bottom-end" | "top-start" | "top-end" {
  const below = y <= (typeof window !== "undefined" ? window.innerHeight : 0) / 2;
  const right = x <= (typeof window !== "undefined" ? window.innerWidth : 0) / 2;
  if (below && right) return "bottom-start";
  if (below) return "bottom-end";
  return right ? "top-start" : "top-end";
}

/** Zero-size client rect at the open point — the same synthetic-anchor
 * trick HkMenu's cascades use, so the shared panel positions a menu at a
 * POINTER exactly like it positions a submenu at a row. */
function pointAnchor(x: number, y: number): HTMLElement {
  return {
    getBoundingClientRect: () =>
      ({
        x, y,
        left: x, top: y, right: x, bottom: y,
        width: 0, height: 0,
        toJSON: () => ({}),
      }) as DOMRect,
    contains: () => false,
  } as unknown as HTMLElement;
}

export default defineComponent({
  name: "HkContextMenuProvider",
  setup(_, { slots }) {
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
        request.value = next;
        menuEpoch.value += 1;
        open.value = true;
      },
      close() {
        close(true);
      },
    };
    provide(CONTEXT_MENU_KEY, api);

    const anchor = computed(() =>
      pointAnchor(request.value?.x ?? 0, request.value?.y ?? 0),
    );
    const placement = computed(() =>
      quadrantPlacement(request.value?.x ?? 0, request.value?.y ?? 0),
    );

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
        />
      </>
    );
  },
});
