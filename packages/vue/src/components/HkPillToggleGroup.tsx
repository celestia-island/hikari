import { defineComponent, type PropType } from "vue";

import "./HkPillToggleGroup.scss";

/** One toggleable pill of the group. */
export interface HkPillOption {
  /** Stable identity — the value emitted back through `toggle`. */
  value: string;
  label: string;
  /** Optional leading glyph (lucide component or any renderable). Typed
   * loose on purpose (same as HkIconButtonGroup entries): hosts mount
   * hikari against their own vue minor and a hard VNode type breaks
   * typecheck whenever the host's vue differs. */
  icon?: unknown;
}

/**
 * HkPillToggleGroup — the segmented pill-track multi-select: shared
 * chrome around per-option toggle buttons, the active option carrying
 * the indicator tint directly (multi-select cannot use HkTabs — its
 * sliding indicator is radio semantics). Grammar ported from the wowsp
 * 水表查询 filter bar's option strip (2026-10-11), wrapping instead of
 * panning: hikari ships page-sized groups, and hosts with strip-scale
 * sets host their own panning track.
 *
 * Deliberately THIN (the host owns the set): `toggle(value)` reports one
 * pill toggled; the optional leading all-pill reports `all()` and the
 * HOST decides what that means (clear the facet, or select everything —
 * both are legitimate; see HkFilterChip and the provider model groups).
 * `selected` is the single source of truth and is never mutated here.
 */
export default defineComponent({
  name: "HkPillToggleGroup",
  props: {
    /** Accessible name of the group (role=group aria-label). */
    label: { type: String, required: true },
    options: {
      type: Array as PropType<HkPillOption[]>,
      default: () => [],
    },
    /** The picked values — single source of truth, never mutated here. */
    selected: { type: Object as PropType<Set<string>>, default: () => new Set<string>() },
    /** The leading all-pill's label; omit to hide the all-pill. The pill
     * wears the active tint exactly when nothing is picked. */
    allLabel: { type: String, default: undefined },
  },
  emits: {
    toggle: (_value: string) => true,
    all: () => true,
  },
  setup(props, { emit }) {
    return () => (
      <div class="hk-pill-group" role="group" aria-label={props.label}>
        {props.allLabel != null && (
          <button
            type="button"
            class="hk-pill-group-pill"
            data-active={props.selected.size === 0 || undefined}
            aria-pressed={props.selected.size === 0 ? "true" : "false"}
            onClick={() => emit("all")}
          >
            {props.allLabel}
          </button>
        )}
        {props.options.map((o) => (
          <button
            type="button"
            key={o.value}
            class="hk-pill-group-pill"
            data-active={props.selected.has(o.value) || undefined}
            aria-pressed={props.selected.has(o.value) ? "true" : "false"}
            onClick={() => emit("toggle", o.value)}
          >
            {o.icon != null && <span class="hk-pill-group-icon">{o.icon}</span>}
            {o.label}
          </button>
        ))}
      </div>
    );
  },
});
