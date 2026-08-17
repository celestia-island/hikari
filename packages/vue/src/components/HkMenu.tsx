import {
  computed,
  defineComponent,
  h,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
  type Component,
  type PropType,
} from "vue";

import { ChevronLeft, ChevronRight } from "lucide-vue-next";

/**
 * Generic cascading menu.
 *
 * One primitive for every "menu with submenus" need — locale picking, theme
 * groups, account actions. Two presentation modes driven by a breakpoint:
 *
 * - Desktop: popover panel anchored to the trigger; rows carrying children
 *   cascade to the RIGHT of the anchor row (flipping to the left when the
 *   viewport runs out) — the traditional application menubar behavior.
 * - Mobile: every level opens as its own fullscreen sheet, stacked. Each
 *   pushed level also pushes a history entry, so the system/browser back
 *   gesture closes exactly one level (Android modal navigation mode).
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

function isMobileViewport(): boolean {
  return typeof window !== "undefined" && window.innerWidth < 768;
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
    /** Stacked sheet chain on mobile: each entry is the items of that level. */
    const mobileStack = ref<{ title: string; items: HkMenuItem[] }[]>([]);
    const instanceId = `${MENU_ID}-${Math.random().toString(36).slice(2, 8)}`;
    let pushedDepth = 0;

    const mobileMode = computed(
      () => typeof window !== "undefined" && window.innerWidth < props.mobileBreakpoint,
    );

    function closeAll(): void {
      desktopPath.value = [];
      mobileStack.value = [];
      restoreHistory();
      emit("update:open", false);
    }

    function restoreHistory(): void {
      while (pushedDepth > 0 && window.history.state?.__hkMenuId === instanceId) {
        window.history.back();
        pushedDepth--;
      }
    }

    function onPopState(e: PopStateEvent): void {
      const st = e.state as MenuHistoryState | null;
      if (st?.__hkMenuId === instanceId) return; // still one of ours
      // Back landed outside our stack — collapse whatever remains.
      pushedDepth = 0;
      if (mobileStack.value.length > 0) mobileStack.value = [];
      if (desktopPath.value.length > 0) desktopPath.value = [];
      emit("update:open", false);
    }

    function pushLevel(title: string, items: HkMenuItem[]): void {
      mobileStack.value.push({ title, items });
      window.history.pushState(
        { __hkMenuId: instanceId, __hkMenuDepth: ++pushedDepth } satisfies MenuHistoryState,
        "",
      );
    }

    function popLevel(): boolean {
      if (mobileStack.value.length === 0) return false;
      mobileStack.value.pop();
      if (pushedDepth > 0 && window.history.state?.__hkMenuId === instanceId) {
        window.history.back();
        pushedDepth--;
      }
      return true;
    }

    onMounted(() => window.addEventListener("popstate", onPopState));
    onBeforeUnmount(() => {
      window.removeEventListener("popstate", onPopState);
      restoreHistory();
    });

    function onItem(item: HkMenuItem): void {
      if (item.disabled) return;
      if (item.children?.length) {
        if (mobileMode.value) pushLevel(item.label, item.children);
        else {
          desktopPath.value = [...desktopPath.value.slice(0, currentLevel.value), item.key];
        }
        return;
      }
      emit("select", item.key, item);
      closeAll();
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

    const currentLevel = computed(() => desktopPath.value.length);

    // ── desktop popover geometry ────────────────────────────────────
    const panelStyle = ref<Record<string, string>>({});

    function positionPanel(): void {
      const anchor = props.anchorRef;
      if (!anchor) return;
      const r = anchor.getBoundingClientRect();
      const panelW = 224;
      const panelH = Math.min(320, Math.max(120, currentItems.value.length * 34 + 16));
      let top = r.bottom + props.offset;
      let left = r.left;
      if (props.placement.endsWith("-end")) left = r.right - panelW;
      if (props.placement.startsWith("top-")) top = r.top - panelH - props.offset;
      if (top + panelH > window.innerHeight - 8) top = Math.max(8, r.top - panelH - props.offset);
      if (left + panelW > window.innerWidth - 8) left = Math.max(8, r.left - panelW);
      panelStyle.value = {
        position: "fixed",
        top: `${Math.round(top)}px`,
        left: `${Math.round(left)}px`,
        width: `${panelW}px`,
      };
    }

    // Rows the deepest submenu anchors from (each open row element).
    const rowRefs = ref<Record<number, HTMLElement | null>>({});
    const subStyles = ref<Record<number, Record<string, string>>>({});

    function positionSubmenus(): void {
      for (let d = 0; d < desktopPath.value.length; d++) {
        const row = rowRefs.value[d];
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
      () => [props.open, desktopPath.value.length, currentItems.value] as const,
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
                  rowRefs.value[level] = el as HTMLElement | null;
                }
              : undefined
          }
          data-active={active || undefined}
          data-checked={item.checked || undefined}
          data-danger={item.danger || undefined}
          data-disabled={item.disabled || undefined}
          onClick={() => onItem(item)}
          onMouseenter={() => {
            if (!hasKids && desktopPath.value.length > level) {
              desktopPath.value = desktopPath.value.slice(0, level);
            }
          }}
        >
          {item.flag && <span class="hk-menu-flag">{item.flag}</span>}
          {item.icon && h(item.icon, { size: 15 })}
          <span class="hk-menu-label">{item.label}</span>
          {item.checked && <span class="hk-menu-check">✓</span>}
          {hasKids && <ChevronRight size={14} class="hk-menu-more" />}
        </button>
      );
    }

    return () => {
      if (!props.open) return null;

      if (isMobileViewport()) {
        const top = mobileStack.value[mobileStack.value.length - 1];
        const sheets = mobileStack.value;
        return (
          <div class="hk-menu-mobile-stack">
            {sheets.map((sheet, i) => (
              <div
                key={i}
                class="hk-menu-sheet"
                data-level={i}
                style={{ zIndex: `${1200 + i}` }}
              >
                <div class="hk-menu-sheet-header">
                  <button
                    type="button"
                    class="hk-menu-sheet-back"
                    aria-label="Back"
                    onClick={() => {
                      if (!popLevel()) closeAll();
                    }}
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <span class="hk-menu-sheet-title">{sheet.title || props.title}</span>
                </div>
                <div class="hk-menu-sheet-body">
                  {sheet.items.map((it) => renderRow(it, i, i))}
                </div>
              </div>
            ))}
            {/* level-0 sheet when no submenu is open */}
            {sheets.length === 0 && (
              <div class="hk-menu-sheet" data-level={0} style={{ zIndex: "1200" }}>
                <div class="hk-menu-sheet-header">
                  <button
                    type="button"
                    class="hk-menu-sheet-back"
                    aria-label="Back"
                    onClick={() => closeAll()}
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <span class="hk-menu-sheet-title">{props.title}</span>
                </div>
                <div class="hk-menu-sheet-body">
                  {props.items.map((it, idx) => renderRow(it, 0, idx))}
                </div>
              </div>
            )}
          </div>
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
        <div class="hk-menu-desktop">
          <div class="hk-menu-backdrop" onClick={() => closeAll()} />
          {panels}
        </div>
      );
    };
  },
});
