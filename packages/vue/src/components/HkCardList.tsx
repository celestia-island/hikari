import { computed, defineComponent, h, inject, onBeforeUnmount, onMounted, ref, type Component, type PropType } from "vue";
import { MoreHorizontal } from "lucide-vue-next";

import HkCard from "./HkCard";
import { HkIconChip } from "./HkIconChip";
import HkMenu from "./HkMenu";
import type { HkMenuItem } from "./HkMenu";
import HkTooltip from "./HkTooltip";
import { hasRenderedContent } from "../runtime/hasRenderedContent";
import { releaseMediaQuery, useMediaQuery } from "../runtime/useMediaQuery";

/** The touch-first predicate, kept as ONE literal: use and release must
 *  name the same registry entry, or the release silently no-ops and the
 *  shared listener leaks. */
const TOUCH_FIRST_QUERY = "(hover: none), (pointer: coarse)";
import type { StatTone } from "./HkStatCard";
import { HK_SCROLL_PROGRESS_REGISTRAR, type HkScrollProgressHandle } from "./HkScrollProgressDock";
import "./HkCardList.scss";

/**
 * Whether a default slot actually rendered any row — the SHARED slot
 * guard (runtime/hasRenderedContent, recursed into fragments so the
 * JSX `<>{cond && …}</>` shape reads as empty too; HkModelCard uses the
 * same one). Testing `slots.default` for truthiness is not enough: the
 * canonical template idiom (`<HkListRow v-for>` plus
 * `<template #empty>`) always provides a default slot whose v-for
 * renders zero vnodes, and a `v-if` row renders a comment placeholder
 * — both would otherwise show an empty bordered card where the empty
 * state belongs.
 */
const renderedRows = hasRenderedContent;

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
  props: {
    /** Authoritative row total the scroll-progress pill uses as its
     *  denominator (the server count behind a windowed/infinite list).
     *  Forwarded to the nearest enclosing enabled HkScrollProgressDock,
     *  exactly like HkAdminTablePage's `total`. Omitted: the pill falls
     *  back to counting the delivered DOM rows (right for
     *  fully-delivered lists, drifting low for windowed ones — pass the
     *  server count there). */
    total: { type: Number, default: undefined },
  },
  setup(props, { slots }) {
    // Scroll-progress registration (the HkTable precedent): the NEAREST
    // enclosing ENABLED HkScrollProgressDock provides the registrar —
    // provide/inject scoping resolves the shell viewport for console
    // pages and keeps a list registered against an inner dock out of
    // the shell. The handle hands the pill the list element as the row
    // root, the `total` prop live, and the rendered HkListRow elements
    // as the rows (a card list's rows ARE its data rows — no
    // section-band caveat).
    const listRef = ref<HTMLElement | null>(null);
    const progressRegistrar = inject(HK_SCROLL_PROGRESS_REGISTRAR, null);
    const progressHandle: HkScrollProgressHandle = {
      getRoot: () => listRef.value,
      getTotal: () => props.total,
      getRows: () =>
        listRef.value
          ? Array.from(listRef.value.children).filter((el) =>
              el.classList.contains("hk-list-row"),
            )
          : [],
    };
    onMounted(() => {
      progressRegistrar?.register(progressHandle);
    });
    onBeforeUnmount(() => {
      progressRegistrar?.unregister(progressHandle);
    });
    return () => {
      const rows = slots.default?.();
      return (
        <HkCard padded={false}>
          {slots.empty && !renderedRows(rows) ? (
            slots.empty()
          ) : (
            <div class="hk-card-list" role="list" ref={listRef}>
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
 * stat cards use. Clicks inside the trailing column and the action lane
 * STOP at their wrapper (the HkStatCard action-wrapper rule): an
 * affordance nested in a clickable row owns its click and never
 * double-fires the row's — the synthesized click a keyboard Enter
 * produces on a lane button bubbles exactly like a pointer click, so
 * the guard lives on the containers, not on individual buttons. The
 * touch trigger's named menu teleports (HkMenu popup panels are
 * siblings of the row, not children), so menu selections don't bubble
 * either. When the touch lane owns the right edge, the trailing column
 * gives up its auto margin (`--parked` below) so the two never split
 * the row's free space.
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
    // Paired with releaseMediaQuery in onBeforeUnmount (the composable's
    // contract): the theme panel mounts/unmounts rows per theme add and
    // remove, so an unpaired handle would pin the shared listener forever.
    const touchFirst = useMediaQuery(TOUCH_FIRST_QUERY);
    onBeforeUnmount(() => releaseMediaQuery(TOUCH_FIRST_QUERY));
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
    /** Clicks inside an interactive wrapper (trailing column, action
     *  lane) stop here: the row's clickable handler must never see
     *  them — a per-row delete button that also selected the row was
     *  the 2026-11-13 theme-panel field report. Covers pointer clicks
     *  AND the click a keyboard Enter synthesizes on the focused
     *  button (same bubbling path). */
    function stopRowClick(e: MouseEvent) {
      e.stopPropagation();
    }
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
        {slots.trailing ? (
          <div
            class={[
              "hk-list-row-trailing",
              // The touch lane parks in the same flex line and owns the
              // auto margin; the trailing column yields (see class doc
              // above) so the two never split the free space.
              hasActions() && touchFirst.value && "hk-list-row-trailing--parked",
            ]}
            onClick={stopRowClick}
          >
            {slots.trailing()}
          </div>
        ) : null}
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
            onClick={stopRowClick}
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
