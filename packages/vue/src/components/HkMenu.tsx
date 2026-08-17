import {
  computed,
  defineComponent,
  h,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  Teleport,
  watch,
  type Component,
  type PropType,
} from "vue";

import { ChevronLeft, ChevronRight } from "lucide-vue-next";

import "./HkMenu.scss";

/**
 * Generic cascading menu.
 *
 * One primitive for every "menu with submenus" need — locale picking, theme
 * groups, account actions. Two presentation modes driven by a breakpoint:
 *
 * - Desktop: popover panel anchored to the trigger; rows carrying children
 *   cascade to the RIGHT of the anchor row (flipping to the left when the
 *   viewport runs out) — the traditional application menubar behavior.
 *   Clicking (or hovering) a sibling row switches the open submenu to that
 *   row, like a classic menubar.
 * - Mobile: every level — including the root — opens as its own fullscreen
 *   sheet, stacked. Every level pushes a history entry, so the system/browser
 *   back gesture closes exactly one level (Android modal navigation mode);
 *   closing the last level closes the menu.
 */
export interface HkMenuItem {
  key: string;
  label: string;
  icon?: Component;
  flag?: string;
  checked?: boolean;
  disabled?: boolean;
  danger?: boolean;
  children?: HkMenuItem[];
}

/** Marker we stamp into history.state for levels this instance pushed. */
interface MenuHistoryState {
  __hkMenuId?: string;
  __hkMenuDepth?: number;
}

const MENU_ID = "__hkMenu";

function viewportIsMobile(breakpoint: number): boolean {
  return typeof window !== "undefined" && window.innerWidth < breakpoint;
}

export default defineComponent({
  name: "HkMenu",
  props: {
    /** Panel title (mobile sheet header / desktop a11y label root). */
    title: { type: String, default: "" },
    items: { type: Array as PropType<HkMenuItem[]>, required: true },
    open: { type: Boolean, required: true },
    /** Anchor element for the desktop popover. */
    anchorRef: { type: Object as PropType<HTMLElement | null>, default: null },
    /** Base placement of the desktop panel relative to the anchor. */
    placement: {
      type: String as PropType<
        "bottom-start" | "bottom-end" | "top-start" | "top-end" | "right-start" | "left-start"
      >,
      default: "bottom-start",
    },
    /** Override the viewport breakpoint (default 768px). */
    mobileBreakpoint: { type: Number, default: 768 },
    /** Vertical offset between anchor and the desktop panel. */
    offset: { type: Number, default: 6 },
  },
  emits: ["update:open", "select"],
  setup(props, { emit }) {
    /** Open submenu path on desktop, e.g. ["theme", "dark"] → panel chain. */
    const desktopPath = ref<string[]>([]);
    /** Pushed sheet chain on mobile: each entry is one submenu level. */
    const mobileStack = ref<{ title: string; items: HkMenuItem[] }[]>([]);
    const instanceId = `${MENU_ID}-${Math.random().toString(36).slice(2, 8)}`;
    /**
     * History entries this instance pushed above the page's base entry —
     * also the number of back() calls needed to reach the base again.
     * History depth 0 (the root sheet) counts, so this is depth + 1.
     */
    let pushedDepth = 0;
    /** Popstate events produced by our own restoreHistory — not user backs. */
    let suppressPop = 0;
    /** Bumped on viewport resize so an open menu re-renders in the right mode. */
    const viewportTick = ref(0);

    const mobileMode = computed(() => {
      void viewportTick.value; // re-evaluate when the viewport changes
      return viewportIsMobile(props.mobileBreakpoint);
    });

    function pushHistoryEntry(depth: number): void {
      window.history.pushState(
        { __hkMenuId: instanceId, __hkMenuDepth: depth } satisfies MenuHistoryState,
        "",
      );
      pushedDepth = depth + 1;
    }

    function restoreHistory(): void {
      // Single multi-step traversal: consecutive back() calls can be
      // coalesced (happy-dom) or racy (browsers), go(-n) cannot. Depth is
      // only trusted while our entry is still current — a foreign pushState
      // while open (router navigation, another component) invalidates the
      // count, so release ownership by de-marking the current entry instead
      // of traversing a count we can no longer trust.
      if (pushedDepth > 0 && window.history.state?.__hkMenuId === instanceId) {
        suppressPop++;
        window.history.go(-pushedDepth);
      } else if (pushedDepth > 0) {
        // Our entries are still buried below the foreign top; replacing the
        // current entry releases ownership without touching live history.
        window.history.replaceState(null, "");
      }
      pushedDepth = 0;
    }

    function closeAll(): void {
      desktopPath.value = [];
      mobileStack.value = [];
      restoreHistory();
      emit("update:open", false);
    }

    function onPopState(e: PopStateEvent): void {
      if (suppressPop > 0) {
        // Our own restore traversal landing — not a user back gesture.
        suppressPop--;
        return;
      }
      const st = e.state as MenuHistoryState | null;
      if (st?.__hkMenuId === instanceId) {
        // Landed on one of our own entries — close exactly one level.
        const depth = Math.max(0, st.__hkMenuDepth ?? 0);
        mobileStack.value = props.open ? mobileStack.value.slice(0, depth) : [];
        desktopPath.value = [];
        pushedDepth = depth + 1;
        if (!props.open) {
          // Forward gesture into a spent stack while closed: release the
          // ownership marker so a closed menu never owns live history.
          window.history.replaceState(null, "");
          pushedDepth = 0;
        }
        return;
      }
      if (!props.open && pushedDepth === 0) return; // idle; nothing to do
      // Landed outside our stack — collapse whatever remains.
      pushedDepth = 0;
      mobileStack.value = [];
      desktopPath.value = [];
      emit("update:open", false);
    }

    function pushLevel(title: string, items: HkMenuItem[]): void {
      mobileStack.value.push({ title, items });
      pushHistoryEntry(mobileStack.value.length);
    }

    function popLevel(): boolean {
      if (mobileStack.value.length === 0) return false;
      if (pushedDepth > 0 && window.history.state?.__hkMenuId === instanceId) {
        // The popstate handler (ours, depth-1) truncates the stack — one
        // source of truth for both drivers (in-app back and browser back).
        window.history.back();
      } else {
        mobileStack.value.pop();
      }
      return true;
    }

    function onResize(): void {
      viewportTick.value++;
      // Desktop panels are viewport-fixed; a same-mode resize strands them.
      if (!mobileMode.value && props.open) void nextTick(refreshGeometry);
    }

    onMounted(() => window.addEventListener("popstate", onPopState));
    onMounted(() => window.addEventListener("resize", onResize));
    onBeforeUnmount(() => {
      window.removeEventListener("popstate", onPopState);
      window.removeEventListener("resize", onResize);
      restoreHistory();
    });

    /**
     * Keep the history chain in sync with the open state and the active
     * mode: a menu opened on mobile owns one root entry; a menu that ends
     * up on desktop releases every entry it pushed.
     */
    watch(
      // String key: fires on real state changes only, not on every resize tick.
      () => `${props.open ? 1 : 0}:${mobileMode.value ? 1 : 0}`,
      (key) => {
        const openNow = key.startsWith("1");
        const mobile = key.endsWith("1");
        if (!openNow) {
          if (pushedDepth > 0 || mobileStack.value.length > 0 || desktopPath.value.length > 0) {
            desktopPath.value = [];
            mobileStack.value = [];
            restoreHistory();
          }
          return;
        }
        if (mobile) {
          // Normalize: exactly one fresh root entry above the page's history.
          if (pushedDepth !== 0) restoreHistory();
          pushHistoryEntry(0);
        } else if (pushedDepth > 0) {
          desktopPath.value = [];
          mobileStack.value = [];
          restoreHistory();
        }
      },
      { immediate: true, flush: "sync" },
    );

    function onItem(item: HkMenuItem, level: number): void {
      if (item.disabled) return;
      if (item.children?.length) {
        if (mobileMode.value) {
          pushLevel(item.label, item.children);
        } else {
          // Replace the path at the clicked row's level — clicking a
          // sibling in a shallower panel switches the cascade to it.
          desktopPath.value = [...desktopPath.value.slice(0, level), item.key];
        }
        return;
      }
      emit("select", item.key, item);
      closeAll();
    }

    /** Classic menubar hover semantics: hovering a row at a level collapses
     *  everything deeper; hovering a sibling branch switches to it. */
    function onRowEnter(item: HkMenuItem, level: number): void {
      if (mobileMode.value) return;
      if (desktopPath.value.length <= level) return;
      if (desktopPath.value[level] === item.key) return;
      desktopPath.value = item.children?.length
        ? [...desktopPath.value.slice(0, level), item.key]
        : desktopPath.value.slice(0, level);
    }

    /** Which items the currently deepest desktop panel shows. */
    const currentItems = computed<HkMenuItem[]>(() => {
      let list = props.items;
      for (const key of desktopPath.value) {
        const next = list.find((i) => i.key === key)?.children;
        if (!next) break;
        list = next;
      }
      return list;
    });

    // ── desktop popover geometry ────────────────────────────────────
    const panelStyle = ref<Record<string, string>>({ width: "224px" });

    function positionPanel(): void {
      const anchor = props.anchorRef;
      if (!anchor) return;
      const r = anchor.getBoundingClientRect();
      const panelW = 224;
      const panelH = Math.min(320, Math.max(120, currentItems.value.length * 34 + 16));
      let top: number;
      let left: number;
      if (props.placement.startsWith("right-")) {
        // cascade from the anchor's RIGHT edge (traditional submenu):
        left = r.right + props.offset;
        top = r.top;
        if (left + panelW > window.innerWidth - 8) left = Math.max(8, r.left - panelW - props.offset);
      } else if (props.placement.startsWith("left-")) {
        left = Math.max(8, r.left - panelW - props.offset);
        top = r.top;
      } else {
        top = r.bottom + props.offset;
        left = props.placement.endsWith("-end") ? r.right - panelW : r.left;
        if (props.placement.startsWith("top-")) top = r.top - panelH - props.offset;
        if (left + panelW > window.innerWidth - 8) left = Math.max(8, window.innerWidth - 8 - panelW);
      }
      if (top + panelH > window.innerHeight - 8) top = Math.max(8, window.innerHeight - 8 - panelH);
      panelStyle.value = {
        position: "fixed",
        top: `${Math.round(top)}px`,
        left: `${Math.round(left)}px`,
        width: `${panelW}px`,
      };
    }

    /** Anchor row elements of the open cascade, keyed `<level>:<itemKey>`. */
    const rowRefs = ref<Record<string, HTMLElement | null>>({});
    const subStyles = ref<Record<number, Record<string, string>>>({});

    function positionSubmenus(): void {
      for (let d = 0; d < desktopPath.value.length; d++) {
        const row = rowRefs.value[`${d}:${desktopPath.value[d]}`];
        if (!row) continue;
        const r = row.getBoundingClientRect();
        const w = 224;
        const h = 180;
        const openRight = r.right + w <= window.innerWidth - 8;
        const left = openRight ? r.right : r.left - w;
        let top = r.top;
        if (top + h > window.innerHeight - 8) top = Math.max(8, window.innerHeight - 8 - h);
        subStyles.value[d] = {
          position: "fixed",
          top: `${Math.round(top)}px`,
          left: `${Math.round(left)}px`,
          width: `${w}px`,
        };
      }
    }

    function refreshGeometry(): void {
      positionPanel();
      positionSubmenus();
    }

    // reposition on open + on level change (after the DOM settles)
    watch(
      () => [props.open, desktopPath.value.length, currentItems.value, props.anchorRef] as const,
      () => {
        void nextTick(refreshGeometry);
      },
      { immediate: true },
    );

    function itemsAtLevel(level: number): HkMenuItem[] {
      let list = props.items;
      for (let i = 0; i < level; i++) {
        const key = desktopPath.value[i];
        const next = list.find((it) => it.key === key)?.children;
        if (!next) return [];
        list = next;
      }
      return list;
    }

    function renderRow(item: HkMenuItem, level: number, _index: number) {
      const hasKids = !!item.children?.length;
      const active = desktopPath.value[level] === item.key;
      return (
        <button
          key={item.key}
          type="button"
          class="hk-menu-row"
          ref={
            hasKids
              ? (el: unknown) => {
                  rowRefs.value[`${level}:${item.key}`] = el as HTMLElement | null;
                }
              : undefined
          }
          data-active={active || undefined}
          data-checked={item.checked || undefined}
          data-danger={item.danger || undefined}
          data-disabled={item.disabled || undefined}
          onClick={() => onItem(item, level)}
          onMouseenter={() => onRowEnter(item, level)}
        >
          {item.flag && <span class="hk-menu-flag">{item.flag}</span>}
          {item.icon && h(item.icon, { size: 15 })}
          <span class="hk-menu-label">{item.label}</span>
          {item.checked && <span class="hk-menu-check">✓</span>}
          {hasKids && <ChevronRight size={14} class="hk-menu-more" />}
        </button>
      );
    }

    function renderSheet(
      level: number,
      sheetTitle: string,
      list: HkMenuItem[],
      onBack: () => void,
    ) {
      return (
        <div
          key={level}
          class="hk-menu-sheet"
          data-level={level}
          style={{ zIndex: `${1200 + level}` }}
        >
          <div class="hk-menu-sheet-header">
            <button type="button" class="hk-menu-sheet-back" aria-label="Back" onClick={onBack}>
              <ChevronLeft size={18} />
            </button>
            <span class="hk-menu-sheet-title">{sheetTitle || props.title}</span>
          </div>
          <div class="hk-menu-sheet-body">
            {list.map((it, idx) => renderRow(it, level, idx))}
          </div>
        </div>
      );
    }

    return () => {
      if (!props.open) return null;

      // Both modes render through a Teleport: `position: fixed` children of
      // an ancestor with backdrop-filter/filter/transform (glass popovers,
      // drawers) are positioned relative to THAT ancestor, not the viewport.
      if (mobileMode.value) {
        // Root sheet is level 0; every pushed submenu level stacks above it.
        const sheets = [
          renderSheet(0, props.title, props.items, () => closeAll()),
          ...mobileStack.value.map((entry, i) =>
            renderSheet(i + 1, entry.title, entry.items, () => {
              if (!popLevel()) closeAll();
            }),
          ),
        ];
        return (
          <Teleport to="body">
            <div class="hk-menu-mobile-stack">{sheets}</div>
          </Teleport>
        );
      }

      // Desktop: root panel + one popover per open submenu level.
      const panels: ReturnType<typeof h>[] = [];
      panels.push(
        <div class="hk-menu-panel" role="menu" style={panelStyle.value}>
          {props.items.map((it, idx) => renderRow(it, 0, idx))}
        </div>,
      );
      for (let level = 0; level < desktopPath.value.length; level++) {
        const list = itemsAtLevel(level + 1);
        if (!list.length) continue;
        panels.push(
          <div class="hk-menu-panel hk-menu-sub" role="menu" style={subStyles.value[level]}>
            {list.map((it, idx) => renderRow(it, level + 1, idx))}
          </div>,
        );
      }
      return (
        <Teleport to="body">
          <div class="hk-menu-desktop">
            <div class="hk-menu-backdrop" onClick={() => closeAll()} />
            {panels}
          </div>
        </Teleport>
      );
    };
  },
});
