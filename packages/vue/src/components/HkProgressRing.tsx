import { computed, defineComponent, type PropType } from "vue";

import "./HkProgressRing.scss";

/**
 * One arc of a segmented progress ring. `value` is a percentage of the
 * full ring (0-100). Segments are laid head-to-tail in order and their
 * values must not sum past 100.
 */
export interface HProgressRingSegment {
  value: number;
  /**
   * Any CSS color — including modern `rgb(var(--x) / a)` space-syntax
   * colors. Applied as an inline style (not a presentation attribute) so
   * CSS variables resolve. Omit to fall back to the theme default stroke.
   */
  color?: string;
  /** Extra class appended to this segment's circle. */
  class?: string;
}

/**
 * Visual gap carved between consecutive segments, in percent of the full
 * ring. Each segment's drawn arc is shortened by this amount when another
 * segment follows, so the arcs never touch.
 */
export const PROGRESS_RING_SEG_GAP_PCT = 1;

export default defineComponent({
  name: "HkProgressRing",
  props: {
    value: { type: Number, default: 0 },
    pct: { type: Number, default: undefined },
    size: { type: Number, default: 120 },
    strokeWidth: { type: Number, default: 8 },
    variant: { type: String as PropType<"normal" | "success" | "exception">, default: "normal" },
    showLabel: { type: Boolean, default: false },
    /** Whether to render the background track circle. Set false for overlay-only use. */
    showTrack: { type: Boolean, default: true },
    /**
     * Segmented mode: when set (an empty array included) each segment is
     * drawn as its own arc instead of the single `value`/`pct` fill.
     * Segment values are percentages of the full ring laid head-to-tail;
     * a ~1% gap is carved between consecutive arcs. `value`/`pct` and
     * `variant` are ignored while segments are present.
     */
    segments: { type: Array as PropType<HProgressRingSegment[]>, default: undefined },
  },
  setup(props, { slots }) {
    const clampedValue = computed(() => Math.min(100, Math.max(0, props.pct ?? props.value)));

    const radius = computed(() => (props.size - props.strokeWidth) / 2);
    const circumference = computed(() => 2 * Math.PI * radius.value);
    const dashOffset = computed(() => circumference.value * (1 - clampedValue.value / 100));

    const segmented = computed(() => props.segments != null);

    /**
     * One arc per visible segment. `start` is the cumulative share of the
     * previous segments (the arc's beginning along the ring, in percent),
     * `len` the drawn length in percent — the segment's own share minus
     * the carved inter-segment gap (only when another segment follows).
     */
    const arcs = computed(() => {
      if (!segmented.value) return [];
      const out: Array<{ start: number; len: number; color?: string; class?: string }> = [];
      const visible = (props.segments ?? []).filter((s) => s && s.value > 0);
      let cursor = 0;
      visible.forEach((seg, i) => {
        if (cursor >= 100) return;
        const share = Math.min(Math.max(seg.value, 0), 100 - cursor);
        const gap = i < visible.length - 1 ? PROGRESS_RING_SEG_GAP_PCT : 0;
        const len = Math.max(share - gap, 0);
        if (len > 0) {
          out.push({ start: cursor, len, color: seg.color, class: seg.class });
        }
        cursor += share;
      });
      return out;
    });

    /** Total claimed by the segments — the segments-mode aria-valuenow. */
    const segmentsTotal = computed(() => {
      if (!segmented.value) return clampedValue.value;
      const sum = (props.segments ?? []).reduce(
        (acc, s) => acc + Math.max(s?.value ?? 0, 0),
        0,
      );
      return Math.round(Math.min(100, sum) * 10) / 10;
    });

    const variantClass = computed(() => {
      if (props.variant === "success") return "hk-progress-ring-success";
      if (props.variant === "exception") return "hk-progress-ring-exception";
      return "";
    });

    const textSize = computed(() => Math.round(props.size / 5));
    const center = computed(() => props.size / 2);

    return () => (
      <div
        class={["hk-progress-ring", variantClass.value]}
        style={{ width: `${props.size}px`, height: `${props.size}px` }}
        role="progressbar"
        aria-valuenow={segmentsTotal.value}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <svg class="hk-progress-ring-svg" viewBox={`0 0 ${props.size} ${props.size}`}>
          {props.showTrack && (
            <circle
              class="hk-progress-ring-track"
              cx={center.value}
              cy={center.value}
              r={radius.value}
              fill="none"
              stroke="currentColor"
              stroke-width={props.strokeWidth}
              stroke-linecap="round"
            />
          )}
          {segmented.value
            ? arcs.value.map((arc, i) => {
                const lenPx = (arc.len / 100) * circumference.value;
                return (
                  <circle
                    key={i}
                    class={["hk-progress-ring-seg", arc.class]}
                    cx={center.value}
                    cy={center.value}
                    r={radius.value}
                    fill="none"
                    stroke-width={props.strokeWidth}
                    stroke-dasharray={`${lenPx} ${circumference.value - lenPx}`}
                    stroke-dashoffset={circumference.value * (1 - arc.start / 100)}
                    stroke-linecap="round"
                    transform={`rotate(-90 ${center.value} ${center.value})`}
                    style={arc.color ? { stroke: arc.color } : undefined}
                  />
                );
              })
            : (
              <circle
                class="hk-progress-ring-fill"
                cx={center.value}
                cy={center.value}
                r={radius.value}
                fill="none"
                stroke-width={props.strokeWidth}
                stroke-dasharray={circumference.value}
                stroke-dashoffset={dashOffset.value}
                stroke-linecap="round"
                transform={`rotate(-90 ${center.value} ${center.value})`}
              />
            )}
        </svg>
        {props.showLabel && !slots.default && (
          <span class="hk-progress-ring-label" style={{ fontSize: `${textSize.value}px` }}>
            {Math.round(segmentsTotal.value)}%
          </span>
        )}
        {slots.default && (
          <span class="hk-progress-ring-overlay">
            {slots.default()}
          </span>
        )}
      </div>
    );
  },
});
