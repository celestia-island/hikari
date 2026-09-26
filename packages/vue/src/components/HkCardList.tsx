import { defineComponent, type Component, type PropType } from "vue";

import HkCard from "./HkCard";
import { HkIconChip } from "./HkIconChip";
import type { StatTone } from "./HkStatCard";
import "./HkCardList.scss";

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
    return () => (
      <HkCard padded={false}>
        {slots.empty && !slots.default ? (
          slots.empty()
        ) : (
          <div class="hk-card-list" role="list">
            {slots.default?.()}
          </div>
        )}
      </HkCard>
    );
  },
});

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
    icon: { type: Object as PropType<Component>, default: undefined },
    iconTone: { type: String as PropType<StatTone>, default: "primary" },
    title: { type: String, default: undefined },
    subtitle: { type: String, default: undefined },
    /** Whole-row click (drill-through). */
    clickable: { type: Boolean, default: false },
  },
  emits: { click: (_e: MouseEvent | KeyboardEvent) => true },
  setup(props, { emit, slots }) {
    return () => (
      <div
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
      </div>
    );
  },
});
