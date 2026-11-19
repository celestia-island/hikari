import { computed, defineComponent, ref, useAttrs, type PropType, type VNode } from "vue";

import HkPopover, { type PopupPlacement } from "./HkPopover";
import HkPillToggleGroup, { type HkPillToggleGroupOption } from "./HkPillToggleGroup";
import { hkPadStyle, type HkPad } from "../runtime/containerPad";
import "./HkFilterChip.scss";

/**
 * HkFilterChip — the FACET filter member of the filter family: a chip
 * trigger that opens a popover (desktop) / bottom sheet (mobile, via
 * HkPopover's sheetOnMobile) holding an HkPillToggleGroup multi-select —
 * the 水表查询 filter-bar grammar, upstreamed from wowsp's
 * FilterCategoryChip (2026-10-11). The sort/direction arrows and the
 * drag-reorderable chip strip stay host-side there; this is the pure
 * facet member.
 *
 * Semantics ride the thin group contract: `toggle(value)` reports one
 * option toggled, `all()` reports the all-pill — the HOST decides
 * whether all means clear or select-everything. The chip label mirrors
 * the selection: the all-label when nothing is picked, otherwise the
 * picked labels in canonical option order (capped at three plus a +N
 * tail, so a wide facet cannot blow up the chip strip's width).
 *
 * Customization (2026-11-19, the wowsp bar's full migration — every
 * filter category of that strip now rides this one component):
 *
 *   - The trigger drops the caret glyph. A facet chip reads as the same
 *     solid-surface family as every bespoke chip beside it (those carry
 *     no affordance arrow either — their arrows mark an ENGAGED sort);
 *     the disclosure state rides aria-expanded. Attrs fall through to
 *     the trigger (HkButton's contract), so hosts state-mark it with
 *     their own classes (wowsp's intermediate sort tint).
 *   - `padding` defaults to "lg": the popup is a CONTENT panel (pills,
 *     sliders, custom bodies), so it rides the shared container-pad
 *     token at the content step instead of the glass chrome's 4px
 *     menu-voice inset that left the pills breathing against the edge.
 *   - `chipText` overrides the selection mirror for hosts whose chip
 *     text is not a picked-label list (a range corridor reads "VI – ★").
 *   - `renderChipTrailing` / `renderPillTrailing` seat the host's
 *     direction arrows: inside the trigger, and after each popup pill
 *     (null scopes the all-pill) — re-evaluated every render, so the
 *     arrows track the host's shared direction flag.
 *   - The default slot replaces the pill group for bodies that are not
 *     an option set (a dual-thumb corridor slider); the hint line still
 *     appends below when provided. `closeOnBackdrop` passes through for
 *     hosts that run a bar-level outside close with chip re-click
 *     switching on desktop.
 */
export default defineComponent({
  name: "HkFilterChip",
  /** Attrs land on the TRIGGER button (HkButton's fallthrough contract):
   *  the trigger is the chrome hosts style and state-mark, while the
   *  anchor span stays a bare layout wrapper. class/style are re-merged
   *  explicitly below — a bare spread would let attrs.class win the
   *  whole class list instead of compounding onto the chrome. */
  inheritAttrs: false,
  props: {
    /** Popup title + the trigger's accessible name (the category). */
    label: { type: String, required: true },
    /** Chip text with nothing picked, and the all-pill's label. */
    allLabel: { type: String, required: true },
    /** Facet values in canonical display order (also the chip-label
     * order — picked labels mirror it, not the Set's insertion order). */
    options: {
      type: Array as PropType<HkPillToggleGroupOption[]>,
      default: () => [],
    },
    /** The picked values — single source of truth, never mutated here. */
    selected: { type: Object as PropType<Set<string>>, default: () => new Set<string>() },
    open: { type: Boolean, default: false },
    placement: { type: String as PropType<PopupPlacement>, default: "bottom-start" },
    /** Bottom hint line below the pill group. Host-provided on purpose:
     * the facet's semantics (multi-select? radio? clears what?) are the
     * host's story to tell. */
    hint: { type: String, default: undefined },
    /** Chip-label override — for hosts whose chip text is not the picked
     * label list (a range corridor). Undefined keeps the mirror. */
    chipText: { type: String, default: undefined },
    /** The popup's content inset — the shared container-pad token
     * (runtime/containerPad). Defaults to the lg content step: this panel
     * hosts pills and sliders, not menu voices. */
    padding: { type: String as PropType<HkPad>, default: "lg" },
    /** HkPopover outside-close passthrough. Hosts that own a bar-level
     * outside close (with chip re-click switching) turn it off where
     * the two closes would fight; mobile keeps its scrim either way. */
    closeOnBackdrop: { type: Boolean, default: true },
    /** Trigger-suffix renderer — the seat for a host's direction arrow.
     * Re-evaluated every render; render nothing while disengaged. */
    renderChipTrailing: { type: Function as PropType<() => VNode>, default: undefined },
    /** Popup pill-suffix renderer, forwarded to the pill group — a null
     * value scopes the all-pill, a value scopes that option. Ignored
     * while the default slot replaces the pill group. */
    renderPillTrailing: {
      type: Function as PropType<(value: string | null) => VNode>,
      default: undefined,
    },
  },
  emits: {
    "update:open": (_v: boolean) => true,
    toggle: (_value: string) => true,
    all: () => true,
  },
  setup(props, { emit, slots, attrs }) {
    const anchorRef = ref<HTMLElement | null>(null);

    /** Picked options in canonical order — the chip label's source. */
    const picked = computed(() => props.options.filter((o) => props.selected.has(o.value)));

    const mirrored = computed(() => {
      if (picked.value.length === 0) return props.allLabel;
      const names = picked.value.map((o) => o.label);
      const head = names.slice(0, 3).join(", ");
      const rest = names.length - 3;
      return rest > 0 ? `${head} +${rest}` : head;
    });

    const chipText = computed(() => props.chipText ?? mirrored.value);

    /** The accessible name carries the SAME text the eye sees once a
     * selection (or a corridor override) engages — a bare category
     * aria-label would mask the chip's visible state. */
    const ariaLabel = computed(() =>
      picked.value.length > 0 || (props.chipText != null && props.chipText !== props.allLabel)
        ? `${props.label}: ${chipText.value}`
        : props.label,
    );

    return () => (
      <span ref={anchorRef} class="hk-filter-chip-anchor">
        <button
          {...attrs}
          type="button"
          class={["hk-filter-chip", props.selected.size > 0 && "hk-filter-chip--on", attrs.class]}
          style={attrs.style || undefined}
          aria-haspopup="dialog"
          aria-expanded={props.open ? "true" : "false"}
          aria-label={ariaLabel.value}
          title={props.label}
          onClick={() => emit("update:open", !props.open)}
        >
          <span class="hk-filter-chip-text">{chipText.value}</span>
          {props.renderChipTrailing?.()}
        </button>
        <HkPopover
          modelValue={props.open}
          onUpdate:modelValue={(v: boolean) => emit("update:open", v)}
          anchorRef={anchorRef.value}
          placement={props.placement}
          offset={6}
          sheetOnMobile
          closeOnBackdrop={props.closeOnBackdrop}
          padding={props.padding}
          title={props.label}
        >
          <div class="hk-filter-chip-body">
            {slots.default ? (
              slots.default()
            ) : (
              <HkPillToggleGroup
                label={props.label}
                options={props.options}
                selected={props.selected}
                allLabel={props.allLabel}
                renderTrailing={props.renderPillTrailing}
                onToggle={(v: string) => emit("toggle", v)}
                onAll={() => emit("all")}
              />
            )}
            {props.hint && <div class="hk-filter-chip-hint">{props.hint}</div>}
          </div>
        </HkPopover>
      </span>
    );
  },
});
