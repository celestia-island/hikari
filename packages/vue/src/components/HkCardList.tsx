import { Comment, computed, defineComponent, h, onBeforeUnmount, onMounted, ref, type Component, type PropType, type VNode } from "vue";
import { MoreHorizontal } from "lucide-vue-next";

import HkCard from "./HkCard";
import { HkIconChip } from "./HkIconChip";
import HkMenu from "./HkMenu";
import type { HkMenuItem } from "./HkMenu";
import HkTooltip from "./HkTooltip";
import { useMediaQuery } from "../runtime/useMediaQuery";
import type { StatTone } from "./HkStatCard";
import "./HkCardList.scss";

/**
 * Whether a default slot actually rendered any row. Testing
 * `slots.default` for truthiness is not enough: the canonical template
 * idiom (`<HkListRow v-for>` plus `<template #empty>`) always provides a
 * default slot whose v-for renders zero vnodes, and a `v-if` row renders
 * a comment placeholder — both would otherwise show an empty bordered
 * card where the empty state belongs.
 */
function renderedRows(nodes: unknown): boolean {
  if (nodes == null || nodes === false || nodes === "") return false;
  if (Array.isArray(nodes)) return nodes.some((n) => renderedRows(n));
  if (typeof nodes === "object") return (nodes as VNode).type !== Comment;
  return true; // non-empty text content
}

/**
 * HkCardList — the standard card list: an unpadded HkCard whose body is
 * a `role="list"` column of HkListRow entries separated by hairlines.
 *
 * This anatomy is what the console family calls "card rows, never raw
 * ul/ol" (the host's UnoCSS setup has no preflight, so `<ul>` indents
 * 40px): a bordered card surface, rows at `px-4 py-3` with a 12px gutter,
 * hairline dividers between them. It was copy-pasted across ten views
 * before becoming a component.
 *
 * ```tsx
 * <HkCardList>
 *   <HkListRow icon={Server} title={row.name} subtitle={row.url}
 *              trailing={() => <HkBadge>{row.status}</HkBadge>} />
 * </HkCardList>
 * ```
 */
export const HkCardList = defineComponent({
  name: "HkCardList",
  setup(_props, { slots }) {
    return () => {
      const rows = slots.default?.();
      return (
        <HkCard padded={false}>
          {slots.empty && !renderedRows(rows) ? (
            slots.empty()
          ) : (
            <div class="hk-card-list" role="list">
              {rows}
            </div>
          )}
        </HkCard>
      );
    };
  },
});

/** One named action of an HkListRow's option-control array (the
 *  `actions` prop). `name` is REQUIRED: it is the button's accessible
 *  name and its only visible identity — the pointer tooltip's text on
 *  hover devices, and the touch/narrow menu's row label where tooltips
 *  never fire. */
export interface HkListRowAction {
  name: string;
  icon?: Component;
  danger?: boolean;
  disabled?: boolean;
  onSelect: () => void;
}

/** The option-control array's layout contract (see `actionsMode`):
 *  "overlay" — the array costs the row no width; it stays hidden until
 *  engaged (hover / keyboard focus on pointer devices, tap on touch)
 *  and then temporarily covers the row's right content. "persistent" —
 *  the array takes the last column and stays visible. */
export type HkListRowActionsMode = "overlay" | "persistent";

/** The touch trigger's menu model: one HkMenuItem per named action.
 *  Keys are the action NAMES (unique per row by contract), so the
 *  menu's select payload maps straight back onto `onSelect`. */
export function hkListRowMenuItems(actions: readonly HkListRowAction[]): HkMenuItem[] {
  return actions.map((a) => ({
    key: a.name,
    label: a.name,
    icon: a.icon,
    danger: a.danger,
    disabled: a.disabled,
  }));
}

/**
 * HkListRow — one entry of an HkCardList: an optional tone-tinted icon
 * chip, a main column (title / subtitle / free-form default slot), and a
 * trailing slot pinned to the right edge (badges, switches, actions).
 *
 * The row is a list item, not a button — set `clickable` when the whole
 * row drills through, which adds the cursor/focus/hover contract the
 * stat cards use.
 */
export const HkListRow = defineComponent({
  name: "HkListRow",
  props: {
    /** Leading icon — rendered through the standard HkIconChip. */
    icon: { type: [Object, Function] as PropType<Component>, default: undefined },
    iconTone: { type: String as PropType<StatTone>, default: "primary" },
    title: { type: String, default: undefined },
    subtitle: { type: String, default: undefined },
    /** Whole-row click (drill-through). */
    clickable: { type: Boolean, default: false },
    /** The row's option-control array: named icon actions rendered as
     *  the row's last lane. Omit for rows without row-level actions. */
    actions: { type: Array as PropType<HkListRowAction[]>, default: undefined },
    /** See HkListRowActionsMode. Default "overlay": the array is parked
     *  out of the flow and only covers the right content while engaged. */
    actionsMode: { type: String as PropType<HkListRowActionsMode>, default: "overlay" },
    /** Accessible name of the action lane (role="toolbar"). */
    actionsLabel: { type: String, default: undefined },
    /** Accessible name / menu title of the touch trigger. Falls back to
     *  `actionsLabel`. */
    actionsMenuLabel: { type: String, default: undefined },
  },
  emits: { click: (_e: MouseEvent | KeyboardEvent) => true },
  setup(props, { emit, slots }) {
    // Touch-first clients get the named menu (tooltips never fire there);
    // pointer clients get the inline icon lane whose names ride tooltips.
    const touchFirst = useMediaQuery("(hover: none), (pointer: coarse)");
    /** Touch-driven overlay reveal. Pointer devices reveal through CSS
     *  :hover/:focus-within — the common path stays declarative. */
    const revealed = ref(false);
    const menuOpen = ref(false);
    const rowEl = ref<HTMLElement | null>(null);
    const triggerEl = ref<HTMLElement | null>(null);
    const hasActions = () => (props.actions?.length ?? 0) > 0;
    /** A tap inside the row reveals the overlay lane; a tap anywhere
     *  else dismisses it (capture-phase document listener). */
    function onRowPointerDown(e: PointerEvent) {
      if (!hasActions() || e.pointerType === "mouse") return;
      revealed.value = true;
    }
    function onDocumentPointerDown(e: PointerEvent) {
      if (!revealed.value) return;
      if (rowEl.value?.contains(e.target as Node)) return;
      revealed.value = false;
    }
    onMounted(() => document.addEventListener("pointerdown", onDocumentPointerDown, true));
    onBeforeUnmount(() => document.removeEventListener("pointerdown", onDocumentPointerDown, true));
    const menuItems = computed<HkMenuItem[]>(() => hkListRowMenuItems(props.actions ?? []));
    return () => (
      <div
        ref={rowEl}
        onPointerdown={onRowPointerDown}
        class={["hk-list-row", props.clickable && "hk-list-row-clickable"]}
        role="listitem"
        tabindex={props.clickable ? 0 : undefined}
        onKeydown={
          props.clickable
            ? (e: KeyboardEvent) => {
                // role listitem + tabindex promises keyboard activation
                // only when the row itself is made interactive; keys
                // bubbling from focusable children are left alone.
                if (e.target !== e.currentTarget) return;
                if (e.key !== "Enter" && e.key !== " ") return;
                e.preventDefault();
                emit("click", e);
              }
            : undefined
        }
        onClick={props.clickable ? (e: MouseEvent) => emit("click", e) : undefined}

      >
        {props.icon ? <HkIconChip icon={props.icon} tone={props.iconTone} /> : null}
        <div class="hk-list-row-main">
          {props.title ? <div class="hk-list-row-title">{props.title}</div> : null}
          {props.subtitle ? <div class="hk-list-row-subtitle">{props.subtitle}</div> : null}
          {slots.default?.()}
        </div>
        {slots.trailing ? <div class="hk-list-row-trailing">{slots.trailing()}</div> : null}
        {hasActions() && (
          <div
            class={[
              "hk-list-row-actions",
              touchFirst.value
                ? "hk-list-row-actions--touch"
                : props.actionsMode === "persistent"
                  ? "hk-list-row-actions--persistent"
                  : "hk-list-row-actions--overlay",
            ]}
            data-revealed={revealed.value ? "" : undefined}
            role={touchFirst.value ? undefined : "toolbar"}
            aria-label={touchFirst.value ? undefined : props.actionsLabel}
          >
            {touchFirst.value ? (
              <button
                ref={triggerEl}
                type="button"
                class="hk-list-row-actions__trigger"
                aria-haspopup="menu"
                aria-expanded={menuOpen.value}
                aria-label={props.actionsMenuLabel ?? props.actionsLabel}
                onClick={() => (menuOpen.value = !menuOpen.value)}
              >
                <MoreHorizontal size={14} />
              </button>
            ) : (
              (props.actions ?? []).map((a) => (
                <HkTooltip text={a.name} placement="top">
                  {() => (
                    <button
                      type="button"
                      class="hk-list-row-actions__btn"
                      data-danger={a.danger || undefined}
                      disabled={a.disabled}
                      aria-label={a.name}
                      onClick={() => a.onSelect()}
                    >
                      {a.icon ? h(a.icon, { size: 14 }) : null}
                    </button>
                  )}
                </HkTooltip>
              ))
            )}
          </div>
        )}
        {menuOpen.value && (
          <HkMenu
            variant="popup"
            items={menuItems.value}
            open
            anchorRef={triggerEl.value}
            placement="top-end"
            title={props.actionsMenuLabel ?? props.actionsLabel ?? ""}
            onSelect={(key: string) => {
              menuOpen.value = false;
              (props.actions ?? []).find((a) => a.name === key)?.onSelect();
            }}
            onUpdate:open={(v: boolean) => (menuOpen.value = v)}
          />
        )}
      </div>
    );
  },
});
