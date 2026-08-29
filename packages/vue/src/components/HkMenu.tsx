import {
  computed,
  defineComponent,
  h,
  onBeforeUnmount,
  ref,
  watch,
  type Component,
  type PropType,
  type VNode,
} from "vue";

import { ChevronRight } from "lucide-vue-next";

import { useBreakpoint } from "../runtime/useBreakpoint";
import HkSelectPanel, { type SelectPanelPlacement } from "./HkSelectPanel";
import "./HkMenu.scss";

/**
 * Generic cascading menu.
 *
 * One primitive for every "menu with submenus" need — locale picking, theme
 * groups, account actions. The PRESENTATION is not owned here: every level
 * renders through `HkSelectPanel` (the shared dropdown surface), so menus
 * and dropdowns are the same implementation — desktop anchored popouts,
 * mobile bottom sheets (scrim + grabber + title), popup-manager z-stacking,
 * overlay registration, outside-click/Escape closing, and one back-guard
 * history entry per open level.
 *
 * - Desktop: the root panel anchors to the trigger; rows carrying children
 *   cascade into their own nested `HkSelectPanel` anchored to the parent
 *   row (to the RIGHT, flipping to the left when the viewport runs out) —
 *   traditional application menubar behavior. Clicking or hovering a
 *   sibling row switches the open submenu to that row.
 * - Mobile: every level — including the root — docks as its own bottom
 *   sheet layer. Each level owns one back-guard entry (via its panel), so
 *   the system/browser back gesture closes exactly one level; closing the
 *   last level closes the menu.
 * - Sidebar variant: an inline vertical nav list — always rendered, no
 *   popover machinery, no history.
 *
 * Data-driven mode (`items`) and composition mode (default slot) are
 * mutually exclusive per instance: when a default slot is provided its
 * content replaces the item model entirely (no cascade).
 */

export interface HkMenuItem {
  key: string;
  label: string;
  icon?: Component;
  flag?: string;
  checked?: boolean;
  disabled?: boolean;
  danger?: boolean;
  /** Right-aligned count pill (sidebar variant nav rows). */
  badge?: string;
  children?: HkMenuItem[];
}

/** Viewport padding mirrored from HkSelectPanel's popout geometry. */
const VIEWPORT_PAD = 8;
/** Width estimate used ONLY to pick a cascade's flip side; the real
 *  panel box is measured by HkSelectPanel itself. */
const CASCADE_PANEL_W = 224;

/**
 * Minimal anchor contract HkSelectPanel actually relies on (rect + hit
 * containment). Cascade levels anchor to synthetic objects derived from
 * the parent row's live rect — the panel then does all real positioning.
 */
interface PanelAnchor {
  getBoundingClientRect(): DOMRect;
  contains(node: Node): boolean;
}

/** Zero-size rect at a point (cascade anchors have no extent). */
function pointRect(left: number, top: number): DOMRect {
  return {
    x: left,
    y: top,
    width: 0,
    height: 0,
    top,
    left,
    right: left,
    bottom: top,
    toJSON: () => ({}),
  } as DOMRect;
}

/** Exposed surface of HkSelectPanel this component consumes. */
interface PanelInstance {
  panelEl: () => HTMLElement | null;
  /** Cancel the panel's pending back-guard rewind (see onItem). */
  abandonBackGuard?: () => void;
}

export default defineComponent({
  name: "HkMenu",
  props: {
    /**
     * Presentation: "popup" = the anchored cascading menu (desktop popouts /
     * mobile sheets via HkSelectPanel, driven by `open`); "sidebar" = an
     * inline vertical nav list — always rendered, no popover, no history —
     * where root items carrying `children` render as collapsible groups.
     */
    variant: { type: String as PropType<"popup" | "sidebar">, default: "popup" },
    /** Key of the currently active row (sidebar variant). */
    activeKey: { type: String, default: undefined },
    /** Panel title (mobile sheet header / desktop popout a11y label). */
    title: { type: String, default: "" },
    items: { type: Array as PropType<HkMenuItem[]>, required: true },
    open: { type: Boolean, required: true },
    /** Anchor element for the desktop popout. */
    anchorRef: { type: Object as PropType<HTMLElement | null>, default: null },
    /** Base placement of the desktop panel relative to the anchor. */
    placement: {
      type: String as PropType<
        "bottom-start" | "bottom-end" | "top-start" | "top-end" | "right-start" | "left-start"
      >,
      default: "bottom-start",
    },
    /**
     * Deprecated: the shared panel surface decides sheet mode at the
     * library-wide 768px breakpoint (useBreakpoint). Kept for API
     * compatibility; the override no longer changes the mode.
     */
    mobileBreakpoint: { type: Number, default: 768 },
    /** Vertical offset between anchor and the desktop panel. */
    offset: { type: Number, default: 6 },
    /**
     * Whether the leading check column is reserved on item rows.
     * "auto" (default) reserves it when any item at the current level has
     * `checked !== undefined`; `true`/`false` force it on/off. Rows with
     * `checked === true` render the mark; the rest get an empty placeholder
     * so labels stay aligned — plain action menus show no column at all.
     */
    selectMode: { type: [String, Boolean] as PropType<"auto" | boolean>, default: "auto" },
    /**
     * Desktop popout min-width follows the anchor width (select parity).
     * Menus default to false — shrink-to-fit. Cascade placements always
     * shrink to fit.
     */
    matchAnchorWidth: { type: Boolean, default: false },
  },
  emits: ["update:open", "select"],
  setup(props, { emit, slots }) {
    const { isMobile } = useBreakpoint();

    /** Open submenu path on desktop, e.g. ["theme", "dark"] → panel chain. */
    const desktopPath = ref<string[]>([]);
    /** Pushed sheet chain on mobile: the branch item of each level. */
    const mobileStack = ref<HkMenuItem[]>([]);

    // ── outside-click attribution ────────────────────────────────────
    // Each HkSelectPanel closes on clicks landing outside ITS OWN surface,
    // so a click inside a deeper cascade panel would wrongly tear down the
    // shallower panels (the panels are teleported siblings, not nested
    // DOM). A capture-phase listener registered BEFORE any panel's own
    // listener records the deepest menu level the click landed in; close
    // requests from a panel are ignored while the click clearly belongs to
    // a deeper level. The record clears on a zero-delay macrotask (after
    // the whole dispatch has completed) so programmatic closes (Escape,
    // v-model, breakpoint crossing) are never suppressed.
    const panelInsts = ref<Record<number, PanelInstance | null>>({});
    const clickLevel = ref(-1);

    function deepestPanelAt(target: Node): number {
      const max = isMobile.value ? mobileStack.value.length : desktopPath.value.length;
      for (let level = max; level >= 0; level--) {
        const el = panelInsts.value[level]?.panelEl() ?? null;
        if (el && el.contains(target)) return level;
      }
      return -1;
    }

    function onDocumentClick(e: MouseEvent): void {
      clickLevel.value = deepestPanelAt(e.target as Node);
      // Macrotask clear, NOT a microtask: per HTML spec a microtask
      // checkpoint runs after EVERY event listener returns (the JS stack
      // empties between listeners of one dispatch), so a microtask would
      // wipe the record before the panels' own capture listeners — and
      // their close requests — ever consult it. A zero-delay timeout only
      // fires once the whole dispatch (every listener, target handlers
      // included) has completed.
      setTimeout(() => {
        clickLevel.value = -1;
      }, 0);
    }

    // Snapshot at setup so add/remove stay exactly symmetric even if the
    // (effectively static) variant prop were flipped at runtime.
    const popoverVariant = props.variant !== "sidebar";
    if (popoverVariant && typeof document !== "undefined") {
      document.addEventListener("click", onDocumentClick, true);
    }
    onBeforeUnmount(() => {
      if (popoverVariant) {
        document.removeEventListener("click", onDocumentClick, true);
      }
    });

    function closeAll(): void {
      desktopPath.value = [];
      mobileStack.value = [];
      emit("update:open", false);
    }

    /** Root panel (popout or root sheet) asked to close. */
    function onRootCloseRequest(): void {
      if (clickLevel.value > 0) return; // the click belongs to a deeper level
      closeAll();
    }

    /** Desktop sub-panel at `level` asked to close. */
    function onSubCloseRequest(level: number): void {
      if (clickLevel.value > level) return; // a deeper panel owns this click
      desktopPath.value = desktopPath.value.slice(0, level - 1);
    }

    /** Mobile sheet layer `index` (level = index + 1) asked to close. */
    function onStackCloseRequest(index: number): void {
      if (clickLevel.value > index + 1) return;
      mobileStack.value = mobileStack.value.slice(0, index);
    }

    function onItem(item: HkMenuItem, level: number): void {
      if (item.disabled) return;
      if (item.children?.length) {
        if (isMobile.value) {
          mobileStack.value = [...mobileStack.value.slice(0, level), item];
        } else {
          // Replace the path at the clicked row's level — clicking a
          // sibling in a shallower panel switches the cascade to it.
          desktopPath.value = [...desktopPath.value.slice(0, level), item.key];
        }
        return;
      }
      // A leaf selection IS the action: the consumer's select handler
      // opens a modal or drives an async router navigation. Cancel the
      // panels' pending back-guard rewinds BEFORE closing — the deferred
      // go(-n) would otherwise run on the next macrotask, before an async
      // navigation commits its pushState, and bounce the page back onto
      // the marker entry (the "Admin Panel menu leaf opens /backend and
      // silently stays on the chat view" regression). Plain close paths
      // (overlay tap, Escape, branch collapse) keep the release() rewind.
      for (const inst of Object.values(panelInsts.value)) {
        inst?.abandonBackGuard?.();
      }
      emit("select", item.key, item);
      closeAll();
    }

    /** Classic menubar hover semantics: hovering a row at a level collapses
     *  everything deeper; hovering a sibling branch switches to it. */
    function onRowEnter(item: HkMenuItem, level: number): void {
      if (isMobile.value) return;
      if (desktopPath.value.length <= level) return;
      if (desktopPath.value[level] === item.key) return;
      desktopPath.value = item.children?.length
        ? [...desktopPath.value.slice(0, level), item.key]
        : desktopPath.value.slice(0, level);
    }

    // ── cascade anchors ──────────────────────────────────────────────
    // Row elements of the open cascade, keyed `<level>:<itemKey>`.
    const rowRefs = ref<Record<string, HTMLElement | null>>({});
    const anchorCache = new Map<string, PanelAnchor>();

    /** Synthetic anchor placing a sub-panel beside its parent row:
     *  popout to the right, flipping to the left when the viewport runs
     *  out (classic menubar cascade). The rect stays LIVE — HkSelectPanel
     *  re-reads it on every reposition (open, resize). */
    function rowAnchor(level: number, key: string): PanelAnchor {
      const id = `${level}:${key}`;
      let anchor = anchorCache.get(id);
      if (!anchor) {
        anchor = {
          getBoundingClientRect: () => {
            const row = rowRefs.value[id];
            if (!row) return pointRect(0, 0);
            const r = row.getBoundingClientRect();
            if (!r.width && !r.height) return pointRect(0, 0); // detached
            const openRight = r.right + CASCADE_PANEL_W <= window.innerWidth - VIEWPORT_PAD;
            const left = openRight ? r.right : Math.max(VIEWPORT_PAD, r.left - CASCADE_PANEL_W);
            return pointRect(left, r.top);
          },
          contains: (node) => !!rowRefs.value[id]?.contains(node),
        };
        anchorCache.set(id, anchor);
      }
      return anchor;
    }

    /** Synthetic anchor for root placements HkSelectPanel does not model
     *  natively (right-/left-start): the panel hangs off the anchor's
     *  right edge, flipping to the left when out of viewport. */
    function rootCascadeAnchor(side: "right" | "left"): PanelAnchor {
      return {
        getBoundingClientRect: () => {
          const real = props.anchorRef;
          if (!real) return pointRect(0, 0);
          const r = real.getBoundingClientRect();
          if (!r.width && !r.height) return pointRect(0, 0);
          const gap = props.offset;
          const openRight = r.right + gap + CASCADE_PANEL_W <= window.innerWidth - VIEWPORT_PAD;
          const left =
            side === "right" && openRight
              ? r.right + gap
              : Math.max(VIEWPORT_PAD, r.left - CASCADE_PANEL_W - gap);
          return pointRect(left, r.top);
        },
        contains: (node) => !!props.anchorRef?.contains(node),
      };
    }

    /** Root panel configuration: native placements pass straight through;
     *  cascade placements go through the synthetic anchor (fixed panel
     *  offset 0 — the gap lives in the anchor; shrink-to-fit width). */
    const rootPanelConfig = computed(() => {
      const p = props.placement;
      if (p === "right-start" || p === "left-start") {
        return {
          anchor: rootCascadeAnchor(p === "right-start" ? "right" : "left"),
          placement: "bottom-start" as SelectPanelPlacement,
          offset: 0,
          match: false,
        };
      }
      return {
        anchor: props.anchorRef,
        placement: p as SelectPanelPlacement,
        offset: props.offset,
        match: props.matchAnchorWidth,
      };
    });

    // ── level content ────────────────────────────────────────────────
    /** Which items the given desktop level shows. */
    function itemsAtLevel(level: number): HkMenuItem[] {
      let list = props.items;
      for (let i = 0; i < level; i++) {
        const next = list.find((it) => it.key === desktopPath.value[i])?.children;
        if (!next) return [];
        list = next;
      }
      return list;
    }

    /** The branch item whose children form desktop `level` (title source). */
    function branchAt(level: number): HkMenuItem | undefined {
      let list = props.items;
      let item: HkMenuItem | undefined;
      for (let i = 0; i < level; i++) {
        item = list.find((it) => it.key === desktopPath.value[i]);
        if (!item?.children) return undefined;
        list = item.children;
      }
      return item;
    }

    /** Leading check column reservation for one level's items. */
    function checkReserved(list: HkMenuItem[]): boolean {
      if (props.selectMode === true) return true;
      if (props.selectMode === false) return false;
      return list.some((it) => it.checked !== undefined);
    }

    function renderRow(item: HkMenuItem, level: number, reserved: boolean): VNode {
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
          {reserved && (
            <span class="hk-menu-check" data-on={item.checked || undefined} aria-hidden="true">
              {item.checked ? "✓" : ""}
            </span>
          )}
          {item.flag && <span class="hk-menu-flag">{item.flag}</span>}
          {item.icon && h(item.icon, { size: 15 })}
          <span class="hk-menu-label">{item.label}</span>
          {hasKids && <ChevronRight size={14} class="hk-menu-more" />}
        </button>
      );
    }

    /** One level's content inside the shared panel surface: header slot →
     *  rows (or the consumer's default-slot rows) → footer slot. Custom
     *  slots ride the root level, where an identity block belongs. */
    function renderLevelBody(level: number, list: HkMenuItem[]): VNode[] {
      const head: VNode[] = level === 0 ? (slots.header?.() ?? []) : [];
      const tail: VNode[] = level === 0 ? (slots.footer?.() ?? []) : [];
      if (slots.default) {
        return [...head, ...slots.default(), ...tail];
      }
      const reserved = checkReserved(list);
      return [...head, ...list.map((it) => renderRow(it, level, reserved)), ...tail];
    }

    function levelSurface(level: number, list: HkMenuItem[]): VNode {
      return (
        <div class="hk-menu-level" role="menu">
          {renderLevelBody(level, list)}
        </div>
      );
    }

    // ── desktop popouts ──────────────────────────────────────────────
    function renderPanels(): VNode[] {
      const cfg = rootPanelConfig.value;
      const panels: VNode[] = [
        <HkSelectPanel
          open={props.open}
          anchorRef={cfg.anchor as unknown as HTMLElement | null}
          title={props.title}
          placement={cfg.placement}
          offset={cfg.offset}
          matchAnchorWidth={cfg.match}
          onUpdate:open={(v: boolean) => {
            if (!v) onRootCloseRequest();
          }}
          ref={(inst: unknown) => {
            panelInsts.value[0] = inst as PanelInstance | null;
          }}
        >
          {levelSurface(0, props.items)}
        </HkSelectPanel>,
      ];
      if (!slots.default) {
        for (let level = 1; level <= desktopPath.value.length; level++) {
          const list = itemsAtLevel(level);
          if (!list.length) continue;
          const branch = branchAt(level);
          panels.push(
            <HkSelectPanel
              open
              anchorRef={
                rowAnchor(level - 1, desktopPath.value[level - 1]) as unknown as HTMLElement
              }
              title={branch?.label ?? props.title}
              placement="bottom-start"
              offset={0}
              onUpdate:open={(v: boolean) => {
                if (!v) onSubCloseRequest(level);
              }}
              ref={(inst: unknown) => {
                panelInsts.value[level] = inst as PanelInstance | null;
              }}
            >
              {levelSurface(level, list)}
            </HkSelectPanel>,
          );
        }
      }
      return panels;
    }

    // ── mobile sheet layers ──────────────────────────────────────────
    function renderSheets(): VNode[] {
      const sheets: VNode[] = [
        <HkSelectPanel
          open={props.open}
          anchorRef={props.anchorRef}
          title={props.title}
          onUpdate:open={(v: boolean) => {
            if (!v) onRootCloseRequest();
          }}
          ref={(inst: unknown) => {
            panelInsts.value[0] = inst as PanelInstance | null;
          }}
        >
          {levelSurface(0, props.items)}
        </HkSelectPanel>,
      ];
      mobileStack.value.forEach((branch, i) => {
        const level = i + 1;
        sheets.push(
          <HkSelectPanel
            open
            // Sub-levels carry no title of their own — the parent item's
            // label names the sheet.
            title={branch.label}
            onUpdate:open={(v: boolean) => {
              if (!v) onStackCloseRequest(i);
            }}
            ref={(inst: unknown) => {
              panelInsts.value[level] = inst as PanelInstance | null;
            }}
          >
            {levelSurface(level, branch.children ?? [])}
          </HkSelectPanel>,
        );
      });
      return sheets;
    }

    // ── sidebar variant ──────────────────────────────────────────────
    /** Group keys the USER has expanded or collapsed (their word wins). */
    const userGroups = ref<Set<string>>(new Set());
    /** Groups auto-expanded at mount because they contain the active row. */
    const autoGroups = ref<Set<string>>(new Set());

    function isGroup(item: HkMenuItem): boolean {
      return !!item.children?.length;
    }

    function containsActive(item: HkMenuItem): boolean {
      if (item.key === props.activeKey) return true;
      return (item.children ?? []).some(containsActive);
    }

    /** Keys the user explicitly collapsed (overrides the auto set). */
    const userCollapsed = ref<Set<string>>(new Set());

    function isGroupExpanded(key: string): boolean {
      if (userGroups.value.has(key)) return true;
      if (autoGroups.value.has(key)) return !userCollapsed.value.has(key);
      return false;
    }

    /** Seed the auto set whenever the active key or items change: groups
     *  the user has not touched yet default open when they contain the
     *  active row (a fresh sidebar shows where you are); touched groups
     *  keep the user's word — auto-expand is a default, never a
     *  resurrection. */
    watch(
      () => [props.activeKey, props.items] as const,
      () => {
        const actives = new Set(
          props.items
            .filter((it) => isGroup(it) && containsActive(it))
            .map((it) => it.key),
        );
        autoGroups.value = new Set(
          [...actives].filter(
            (k) => !userGroups.value.has(k) && !userCollapsed.value.has(k),
          ),
        );
      },
      { immediate: true },
    );

    function toggleGroup(key: string): void {
      const wasExpanded = isGroupExpanded(key);
      // Move the key fully into the user set — auto defaults stop applying.
      autoGroups.value.delete(key);
      if (wasExpanded) {
        userGroups.value.delete(key);
        userCollapsed.value.add(key);
      } else {
        userCollapsed.value.delete(key);
        userGroups.value.add(key);
      }
    }

    function renderSidebarRow(item: HkMenuItem, depth: number) {
      const active = item.key === props.activeKey;
      return (
        <button
          key={item.key}
          type="button"
          class="hk-menu-sidebar-row"
          data-depth={depth || undefined}
          data-active={active || undefined}
          data-danger={item.danger || undefined}
          data-disabled={item.disabled || undefined}
          style={
            depth > 0
              ? { paddingLeft: `calc(var(--space-12, 12px) + ${16 * depth}px)` }
              : undefined
          }
          onClick={() => {
            if (item.disabled) return;
            emit("select", item.key, item);
          }}
        >
          {item.icon && h(item.icon, { size: 16 })}
          {item.flag && <span class="hk-menu-flag">{item.flag}</span>}
          <span class="hk-menu-label">{item.label}</span>
          {item.badge && <span class="hk-menu-sidebar-badge">{item.badge}</span>}
        </button>
      );
    }

    function renderSidebarItem(item: HkMenuItem, depth: number) {
      if (!isGroup(item)) return renderSidebarRow(item, depth);
      // Auto-expanded when containing the active row (fresh mount shows
      // where you are); the user's first toggle on a group takes over.
      const expanded = isGroupExpanded(item.key);
      return (
        <div key={item.key} class="hk-menu-sidebar-group" data-open={expanded || undefined}>
          <button
            type="button"
            class="hk-menu-sidebar-row hk-menu-sidebar-group-toggle"
            data-disabled={item.disabled || undefined}
            aria-expanded={expanded}
            aria-haspopup="true"
            onClick={() => {
              if (item.disabled) return;
              toggleGroup(item.key);
            }}
          >
            {item.icon && h(item.icon, { size: 16 })}
            <span class="hk-menu-label">{item.label}</span>
            {item.badge && <span class="hk-menu-sidebar-badge">{item.badge}</span>}
            <ChevronRight size={14} class="hk-menu-more" />
          </button>
          {expanded && (
            <div class="hk-menu-sidebar-children">
              {item.children!.map((child) => renderSidebarItem(child, depth + 1))}
            </div>
          )}
        </div>
      );
    }

    function renderSidebar() {
      return (
        <nav class="hk-menu-sidebar" aria-label={props.title || "menu"}>
          {props.items.map((it) => renderSidebarItem(it, 0))}
        </nav>
      );
    }

    return () => {
      if (props.variant === "sidebar") return renderSidebar();
      if (!props.open) return null;
      // Each level renders through its own HkSelectPanel, which teleports
      // itself to body — desktop popouts / mobile sheet layers alike.
      return isMobile.value ? <>{renderSheets()}</> : <>{renderPanels()}</>;
    };
  },
});
