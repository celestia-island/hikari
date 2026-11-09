import { computed, defineComponent, type PropType, type VNode } from "vue";

import "./HkProgressBar.scss";

type ProgressBarStatus = "loading" | "done" | "error";

/**
 * Tone of the overspend block: the muted track grey (default) or the
 * error colour, for a window that is already meaningfully past quota.
 */
export type OverspendTone = "muted" | "danger";

/**
 * One block of a segmented progress bar. `value` is a percentage (0-100);
 * blocks are laid left-to-right in order and their values must not sum
 * past 100.
 */
export interface HProgressBarSegment {
  value: number;
  /**
   * Any CSS color — including modern `rgb(var(--x) / a)` space-syntax
   * colors. Omit to fall back to the theme primary background.
   */
  color?: string;
  /** Extra class appended to this block. */
  class?: string;
}

/** Keep percentage widths stable across float noise (4 decimals ≈ 0.1px on a 1000px track). */
const clampPct = (n: number) => Math.min(100, Math.max(0, n));
const roundPct = (n: number) => Math.round(n * 1e4) / 1e4;

interface OverspendGeometry {
  /** The stretched track: `max + overValue`. */
  total: number;
  /** Quota-edge position, as a percentage of `total`. */
  mainPct: number;
  /** Overspend block width, as a percentage of `total`. */
  overPct: number;
}

export default defineComponent({
  name: "HkProgressBar",
  props: {
    value: { type: Number, default: null },
    secondary: { type: Number, default: null },
    max: { type: Number, default: 100 },
    status: { type: String as PropType<ProgressBarStatus>, default: "loading" },
    size: { type: String as PropType<"xs" | "sm" | "md">, default: "sm" },
    showLabel: { type: Boolean, default: false },
    label: { type: String, default: undefined },
    /**
     * Segmented mode: when set (an empty array included) the track renders
     * one block per segment instead of the `value`/`secondary` fills. Each
     * segment's width is its percentage; `status` is ignored while
     * segments are present.
     */
    segments: { type: Array as PropType<HProgressBarSegment[]>, default: undefined },
    /**
     * Overspend amount, in the same unit as `value`/`max`: how far the
     * measured quantity runs past `max`. Pass it explicitly when the caller
     * clamps `value` itself (`value = min(used, quota)`, the quota-card
     * shape); a `value` already past `max` derives `value - max` instead.
     * `0` (or omitted) keeps the legacy single-fill bar untouched.
     */
    overValue: { type: Number, default: null },
    /**
     * Caption for the overspend stretch ("超支 0.8 度"). Rendered next to
     * the value label while overspend is active, in the overspend tone.
     */
    overspendLabel: { type: String, default: undefined },
    /** Overspend block tone; see {@link OverspendTone}. */
    overspendTone: { type: String as PropType<OverspendTone>, default: "muted" },
  },
  setup(props) {
    const segmented = computed(() => props.segments != null);

    const pct = computed(() => {
      if (props.value == null) return null;
      return Math.min(100, Math.max(0, (props.value / props.max) * 100));
    });

    /**
     * Overspend geometry, or `null` on every legacy path.
     *
     * The track grows to `max + overValue` so the quota edge stays at a
     * fixed visual share while the overspend stretch occupies the rest —
     * the same reading the quota card needs (a bar at 100% of quota keeps
     * filling, just in the muted "past quota" tone). Segments cannot sum
     * past 100% and the indeterminate sweep has no quantity at all, so
     * neither enters this path; `overValue: 0` does not either, which is
     * what keeps the no-overspend render byte-identical to the legacy one.
     */
    const overspendGeometry = computed<OverspendGeometry | null>(() => {
      if (segmented.value || props.value == null) return null;
      const value = props.value;
      const over = Math.max(0, props.overValue != null ? props.overValue : value - props.max);
      if (!(over > 0)) return null;
      const total = props.max + over;
      // A degenerate max/over pair (negative or zero total) has no
      // meaningful split — leave it to the legacy fill rather than emit
      // NaN widths.
      if (!(total > 0)) return null;
      return {
        total,
        // Quota edge: the consumed amount capped at `max`, so a value past
        // quota never paints past the divider.
        mainPct: roundPct(clampPct((Math.min(value, props.max) / total) * 100)),
        overPct: roundPct(clampPct((over / total) * 100)),
      };
    });

    const secondaryPct = computed(() => {
      if (props.secondary == null) return null;
      const total = overspendGeometry.value?.total ?? props.max;
      return Math.min(100, Math.max(0, (props.secondary / total) * 100));
    });

    const displayLabel = computed(() => {
      if (props.label) return props.label;
      // Segmented mode has no single value to render — only an explicit
      // caller label makes sense there.
      if (segmented.value) return "";
      if (pct.value == null) return "";
      return `${Math.round(pct.value)}%`;
    });

    const overspendCaption = computed(() =>
      overspendGeometry.value != null && props.overspendLabel ? props.overspendLabel : null,
    );

    const segWidth = (value: number) => `${Math.min(100, Math.max(0, value))}%`;

    /**
     * Label row. With no overspend caption this renders exactly the legacy
     * `<span class="hk-progress-bar-label">label</span>` (one text child),
     * or nothing at all — the byte-identity the regression fixture pins.
     */
    function renderLabel(): VNode | null {
      if (!props.showLabel && overspendCaption.value == null) return null;
      if (overspendCaption.value == null) {
        return <span class="hk-progress-bar-label">{displayLabel.value}</span>;
      }
      return (
        <span class="hk-progress-bar-label">
          {props.showLabel ? displayLabel.value : ""}
          <span
            class={[
              "hk-progress-bar-overspend-label",
              `hk-progress-bar-overspend-label-${props.overspendTone}`,
            ]}
          >
            {overspendCaption.value}
          </span>
        </span>
      );
    }

    /** The secondary overlay (same node in both fill modes). */
    function renderSecondary(): VNode | null {
      if (secondaryPct.value == null) return null;
      return (
        <div
          class={["hk-progress-bar-secondary", `hk-progress-bar-secondary-${props.status}`]}
          style={{ width: `${secondaryPct.value}%` }}
        />
      );
    }

    return () => (
      <div class="hk-progress-bar" data-size={props.size}>
        {renderLabel()}
        <div
          class={[
            "hk-progress-bar-track",
            segmented.value ? "hk-progress-bar-track--segments" : "",
            overspendGeometry.value ? "hk-progress-bar-track--overspend" : "",
          ]}
        >
          {segmented.value ? (
            (props.segments ?? []).map((s, i) => (
              <div
                key={i}
                class={["hk-progress-bar-seg", s.class]}
                style={{
                  width: segWidth(s.value),
                  ...(s.color ? { background: s.color } : {}),
                }}
              />
            ))
          ) : overspendGeometry.value ? (
            <>
              {renderSecondary()}
              <div
                class={["hk-progress-bar-fill", `hk-progress-bar-fill-${props.status}`]}
                style={{ width: `${overspendGeometry.value.mainPct}%` }}
              />
              {/*
                The 1px divider is carved OUT of the overspend block's
                inline-start edge rather than painted as its own line: the
                track's background shows through the seam, so the separator
                needs no colour of its own and the same geometry mirrors in
                RTL. `calc` keeps the seam exactly 1px whatever the track
                width; a sub-pixel overspend ends up 0 wide, which is the
                honest picture of a sliver past quota.
              */}
              <div
                class={[
                  "hk-progress-bar-overspend",
                  `hk-progress-bar-overspend-${props.overspendTone}`,
                ]}
                style={{
                  insetInlineStart: `calc(${overspendGeometry.value.mainPct}% + 1px)`,
                  width: `calc(${overspendGeometry.value.overPct}% - 1px)`,
                }}
                aria-hidden="true"
              />
            </>
          ) : pct.value != null ? (
            <>
              {renderSecondary()}
              <div
                class={["hk-progress-bar-fill", `hk-progress-bar-fill-${props.status}`]}
                style={{ width: `${pct.value}%` }}
              />
            </>
          ) : (
            <div class={["hk-progress-bar-indeterminate", `hk-progress-bar-indeterminate-${props.status}`]} />
          )}
        </div>
      </div>
    );
  },
});
