import { computed, defineComponent, nextTick, ref, type PropType } from "vue";

import { useMeasuredHighlight } from "../composables/useMeasuredHighlight";
import "./HkSegmented.scss";

/** One segment of an [HkSegmented] group. */
export interface HkSegmentedOption {
  value: string;
  label: string;
  /** Optional icon rendered before the label. */
  icon?: unknown;
  /** Disables just this segment. */
  disabled?: boolean;
}

/**
 * HkSegmented — a compact segmented control (button group) for switching
 * between a small set of mutually exclusive modes. The desktop/tablet form
 * is the classic joined pill track; ≤ the mobile breakpoint it widens to
 * full-bleed tappable segments (larger hit areas), so touch users are not
 * left with sub-target tap zones.
 *
 * Semantics: two flavors over one visual primitive —
 * - `radiogroup` (default): a mode picker (ARIA radio group);
 * - `tablist`: a compact tab strip (ARIA tabs) for a handful of panels —
 *   for scrollable tab bars with overflow affordances use [HTabs] instead.
 *
 * Both flavors get full arrow-key navigation (arrows/Home/End, wrapping,
 * disabled options skipped, selection follows focus).
 *
 * Overlay: `overlayFrom` plus the `#overlay` slot render a passive info
 * layer covering the tail of the track — everything right of option
 * `overlayFrom` — e.g. a live readout that replaces the remaining
 * segments while an "auto" option is active. The layer uses the same
 * measured geometry pass as the sliding thumb (real offsets, re-measured
 * on resize and font load), carries the thumb's pill chrome, and is
 * click-through by default (`pointer-events: none`); interactive content
 * inside the slot opts back in per element.
 */
export default defineComponent({
  name: "HkSegmented",
  props: {
    /** Currently selected value (v-model). */
    modelValue: { type: String, default: "" },
    options: {
      type: Array as PropType<HkSegmentedOption[]>,
      required: true,
    },
    /** Disable the whole group. */
    disabled: { type: Boolean, default: false },
    /** Visual size — sm matches form-control heights. */
    size: {
      type: String as PropType<"sm" | "md">,
      default: "md",
    },
    /** Grow to fill the container width (segments share it equally). */
    block: { type: Boolean, default: false },
    /** Interaction semantics: ARIA radio group (default) or tab strip. */
    semantics: {
      type: String as PropType<"radiogroup" | "tablist">,
      default: "radiogroup",
    },
    /** When ≥ 0 and the `#overlay` slot is provided, render the overlay
     *  layer covering the track to the right of option[overlayFrom]
     *  (measured geometry). -1 disables the layer. */
    overlayFrom: { type: Number, default: -1 },
    /** Override the viewport breakpoint (default 768px) under which the
     *  touch-optimized full-bleed form renders. */
    mobileBreakpoint: { type: Number, default: 768 },
  },
  emits: {
    "update:modelValue": (_value: string) => true,
  },
  setup(props, { emit, slots }) {
    const rootRef = ref<HTMLElement | null>(null);
    const segmentRefs = ref<HTMLElement[]>([]);
    const isTabs = computed(() => props.semantics === "tablist");
    // -1 (no match, e.g. the default "") clears the thumb instead of
    // pointing it at the first segment — mirrors aria-checked all-false.
    const activeIndex = computed(() =>
      props.options.findIndex((o) => o.value === props.modelValue),
    );
    // Sliding thumb geometry from real measurements — options of unequal
    // label width would drift percentage math. Until a non-zero width is
    // measured (jsdom/SSR never get there) the per-segment checked styling
    // below remains as the fallback.
    const { x, width, ready } = useMeasuredHighlight({
      container: rootRef,
      activeIndex,
      itemSelector: ".hk-segmented__segment",
      extraSources: [() => props.options],
    });
    const thumbStyle = computed(() => ({
      transform: `translateX(${x.value}px)`,
      width: `${width.value}px`,
    }));

    // ── Tail overlay geometry ─────────────────────────────────────────
    // A second measurement pass anchored on the boundary option: the
    // overlay spans from that option's right edge to the track's right
    // padding. The segment gap and track padding constants mirror the
    // SCSS so the math lives here once — consumers never hand-roll calc().
    const SEG_GAP = 2;
    const TRACK_PAD = 2;
    const overlayActive = computed(
      () => props.overlayFrom >= 0 && props.overlayFrom < props.options.length - 1,
    );
    const overlayAnchor = computed(() => (overlayActive.value ? props.overlayFrom : -1));
    const overlayMeasure = useMeasuredHighlight({
      container: rootRef,
      activeIndex: overlayAnchor,
      itemSelector: ".hk-segmented__segment",
      extraSources: [() => props.options, () => props.overlayFrom],
    });
    const overlayStyle = computed(() => {
      if (!overlayActive.value) return undefined;
      // Measured geometry: from the anchor option's right edge (plus the
      // segment gap) to the track's right padding.
      if (overlayMeasure.ready.value) {
        const left = overlayMeasure.x.value + overlayMeasure.width.value + SEG_GAP;
        const trackWidth = overlayMeasure.containerWidth.value;
        if (trackWidth > left + TRACK_PAD) {
          return { left: `${left}px`, width: `${trackWidth - left - TRACK_PAD}px` };
        }
      }
      // Pre-measurement fallback: equal-share estimate of the tail.
      const share = (props.overlayFrom + 1) / props.options.length;
      return { left: `${(share * 100).toFixed(4)}%` };
    });
    const hasOverlay = computed(() => overlayActive.value && slots.overlay != null);

    function select(v: string) {
      if (props.disabled) return;
      const opt = props.options.find((o) => o.value === v);
      if (opt?.disabled) return;
      if (v === props.modelValue) return;
      emit("update:modelValue", v);
    }

    // ── Keyboard navigation (radio group + tab strip) ─────────────────
    // role=radio/tab buttons get no native arrow behavior — the group
    // owns it. Selection follows focus; disabled options are skipped;
    // Home/End jump to the first/last enabled option.
    function focusSegment(idx: number) {
      void nextTick(() => segmentRefs.value[idx]?.focus());
    }
    function moveSelection(from: number, delta: number) {
      const n = props.options.length;
      if (n === 0) return;
      let idx = from;
      for (let step = 0; step < n; step += 1) {
        idx = (idx + delta + n) % n;
        if (!props.options[idx].disabled) {
          select(props.options[idx].value);
          focusSegment(idx);
          return;
        }
      }
    }
    function onKeydown(e: KeyboardEvent) {
      if (props.disabled) return;
      const current = activeIndex.value < 0 ? 0 : activeIndex.value;
      switch (e.key) {
        case "ArrowRight":
        case "ArrowDown":
          moveSelection(current, 1);
          break;
        case "ArrowLeft":
        case "ArrowUp":
          moveSelection(current, -1);
          break;
        case "Home": {
          const first = props.options.findIndex((o) => !o.disabled);
          if (first >= 0) {
            select(props.options[first].value);
            focusSegment(first);
          }
          break;
        }
        case "End": {
          for (let i = props.options.length - 1; i >= 0; i -= 1) {
            if (!props.options[i].disabled) {
              select(props.options[i].value);
              focusSegment(i);
              break;
            }
          }
          break;
        }
        default:
          return;
      }
      e.preventDefault();
    }

    return () => (
      <div
        class="hk-segmented"
        ref={rootRef}
        data-size={props.size}
        data-block={props.block || undefined}
        data-disabled={props.disabled || undefined}
        data-ready={ready.value ? "true" : undefined}
        data-semantics={props.semantics}
        role={isTabs.value ? "tablist" : "radiogroup"}
        onKeydown={onKeydown}
      >
        <span class="hk-segmented__thumb" aria-hidden="true" style={thumbStyle.value} />
        {props.options.map((opt, i) => {
          const checked = opt.value === props.modelValue;
          return (
            <button
              key={opt.value}
              ref={(el) => { if (el) segmentRefs.value[i] = el as HTMLElement; }}
              type="button"
              class="hk-segmented__segment"
              role={isTabs.value ? "tab" : "radio"}
              aria-checked={isTabs.value ? undefined : checked}
              aria-selected={isTabs.value ? checked : undefined}
              aria-disabled={opt.disabled || undefined}
              // Roving tabindex (tab-strip convention): the selected tab
              // stays in the page tab sequence, the others remain
              // arrow-reachable only.
              tabindex={isTabs.value && !checked ? -1 : undefined}
              data-checked={checked || undefined}
              data-disabled={props.disabled || opt.disabled || undefined}
              disabled={props.disabled || opt.disabled}
              onClick={() => select(opt.value)}
            >
              {opt.icon != null && <span class="hk-segmented__icon">{opt.icon as any}</span>}
              <span class="hk-segmented__label">{opt.label}</span>
            </button>
          );
        })}
        {hasOverlay.value && (
          <span
            class="hk-segmented__overlay"
            data-ready={overlayMeasure.ready.value ? "true" : undefined}
            style={overlayStyle.value}
          >
            {slots.overlay?.()}
          </span>
        )}
      </div>
    );
  },
});
