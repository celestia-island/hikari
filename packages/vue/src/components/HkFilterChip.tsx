import { computed, defineComponent, ref, type PropType } from "vue";
import { ChevronDown } from "lucide-vue-next";

import HkPopover, { type PopupPlacement } from "./HkPopover";
import HkPillToggleGroup, { type HkPillToggleGroupOption } from "./HkPillToggleGroup";
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
 */
export default defineComponent({
  name: "HkFilterChip",
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
  },
  emits: {
    "update:open": (_v: boolean) => true,
    toggle: (_value: string) => true,
    all: () => true,
  },
  setup(props, { emit }) {
    const anchorRef = ref<HTMLElement | null>(null);

    /** Picked options in canonical order — the chip label's source. */
    const picked = computed(() => props.options.filter((o) => props.selected.has(o.value)));

    const chipText = computed(() => {
      if (picked.value.length === 0) return props.allLabel;
      const names = picked.value.map((o) => o.label);
      const head = names.slice(0, 3).join(", ");
      const rest = names.length - 3;
      return rest > 0 ? `${head} +${rest}` : head;
    });

    return () => (
      <span ref={anchorRef} class="hk-filter-chip-anchor">
        <button
          type="button"
          class={["hk-filter-chip", props.selected.size > 0 && "hk-filter-chip--on"]}
          aria-haspopup="dialog"
          aria-expanded={props.open ? "true" : "false"}
          aria-label={
            picked.value.length > 0 ? `${props.label}: ${chipText.value}` : props.label
          }
          title={props.label}
          onClick={() => emit("update:open", !props.open)}
        >
          <span class="hk-filter-chip-text">{chipText.value}</span>
          <ChevronDown size={12} class="hk-filter-chip-caret" />
        </button>
        <HkPopover
          modelValue={props.open}
          onUpdate:modelValue={(v: boolean) => emit("update:open", v)}
          anchorRef={anchorRef.value}
          placement={props.placement}
          offset={6}
          sheetOnMobile
          title={props.label}
        >
          <div class="hk-filter-chip-body">
            <HkPillToggleGroup
              label={props.label}
              options={props.options}
              selected={props.selected}
              allLabel={props.allLabel}
              onToggle={(v: string) => emit("toggle", v)}
              onAll={() => emit("all")}
            />
            {props.hint && <div class="hk-filter-chip-hint">{props.hint}</div>}
          </div>
        </HkPopover>
      </span>
    );
  },
});
