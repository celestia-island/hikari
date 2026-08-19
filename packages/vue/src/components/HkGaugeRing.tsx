import { computed, defineComponent, onMounted, ref, watch, type PropType } from "vue";

import { useReportedTransition } from "../composables/useReportedTransition";
import { onceFrame } from "../runtime/animationBus";
import "./HkGaugeRing.scss";

/** Visual variant of one arc. `auto` picks from the theme palette by
 *  utilisation thresholds (>= 90 danger, >= 75 warning, else success). */
export type GaugeVariant =
  | "primary"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "muted"
  | "auto";

/** Resolve the `auto` variant against a concrete pct. */
function resolveAuto(pct: number): Exclude<GaugeVariant, "auto"> {
  if (pct >= 90) return "danger";
  if (pct >= 75) return "warning";
  return "success";
}

export interface RingData {
  pct: number;
  /** Explicit color override (any CSS color). Wins over `variant`. */
  color?: string;
  /** Theme-palette variant. Wins over the component-level `variant`. */
  variant?: GaugeVariant;
  /** Explicit track color override (any CSS color). */
  trackColor?: string;
}

const RING_ANIM_MS = 800;

export default defineComponent({
  name: "HkGaugeRing",
  props: {
    /** Multi-ring layout (concentric arcs). When both `rings` and `value`
     *  are given, `rings` wins (backwards compatibility). */
    rings: {
      type: Array as () => RingData[],
      default: undefined,
    },
    /** Single-ring convenience: builds one arc from a 0-100 value colored
     *  by the component-level `variant`. */
    value: { type: Number, default: undefined },
    /** Default arc variant — colors resolve from the theme palette context
     *  (`--color-*` with `--hi-color-*` fallbacks), never hard-coded. */
    variant: {
      type: String as PropType<GaugeVariant>,
      default: "primary",
    },
    /** Default track treatment for arcs without an explicit trackColor. */
    trackVariant: {
      type: String as PropType<"muted" | "surface">,
      default: "muted",
    },
    size: { type: Number, default: 140 },
    strokeWidth: { type: Number, default: 8 },
    gap: { type: Number, default: 6 },
    centerLabel: { type: String, default: "" },
    centerValue: { type: String, default: "" },
    animate: { type: Boolean, default: true },
  },
  setup(props) {
    const progress = ref(props.animate ? 0 : 1);

    const anim = useReportedTransition(RING_ANIM_MS);
    function kickRamp() {
      progress.value = 0;
      onceFrame(() => {
        progress.value = 1;
      });
      anim.run();
    }

    onMounted(() => {
      if (!props.animate) return;
      kickRamp();
    });

    watch(() => props.rings, () => {
      if (!props.animate) return;
      kickRamp();
    });
    watch(() => props.value, () => {
      if (!props.animate) return;
      kickRamp();
    });

    /** Normalised arc list: the explicit `rings` array, or a single arc
     *  built from `value` (defaulting to 0 so the track still renders). */
    const arcs = computed<RingData[]>(() => {
      if (props.rings) return props.rings;
      return [{ pct: props.value ?? 0, variant: props.variant }];
    });

    /** Concrete stroke variant for an arc (explicit color short-circuits). */
    function arcVariant(ring: RingData): Exclude<GaugeVariant, "auto"> {
      const v = ring.variant ?? props.variant;
      return v === "auto" ? resolveAuto(ring.pct) : v;
    }

    const rings = computed(() => {
      const { strokeWidth, gap, size } = props;
      const svg: {
        radius: number;
        circumference: number;
        dashOffset: number;
        variant: Exclude<GaugeVariant, "auto">;
        color: string | undefined;
        trackColor: string | undefined;
        strokeWidth: number;
      }[] = [];
      let r = (size - strokeWidth) / 2;
      for (const ring of arcs.value) {
        const radius = Math.max(r, 1);
        const circumference = 2 * Math.PI * radius;
        const dashOffset = circumference * (1 - (Math.min(ring.pct, 100) / 100) * progress.value);
        svg.push({
          radius,
          circumference,
          dashOffset,
          variant: arcVariant(ring),
          color: ring.color,
          trackColor: ring.trackColor,
          strokeWidth,
        });
        r -= strokeWidth + gap;
        if (r < strokeWidth / 2) break;
      }
      return svg;
    });

    const center = computed(() => props.size / 2);

    /** Center typography scales with the ring so callers never need their
     *  own font hacks: value = clamp(11, size/6, 22)px. */
    const valueFontSize = computed(() =>
      Math.round(Math.min(22, Math.max(11, props.size / 6))));
    const labelFontSize = computed(() =>
      Math.round(Math.min(12, Math.max(8, valueFontSize.value * 0.75))));

    const aria = computed(() => {
      const single = arcs.value.length === 1 ? arcs.value[0] : null;
      if (!single) return { role: "img" as const, now: undefined };
      return { role: "progressbar" as const, now: Math.round(Math.min(single.pct, 100)) };
    });

    return () => (
      <div
        class="hk-gauge-ring"
        style={{ width: `${props.size}px`, height: `${props.size}px` }}
        role={aria.value.role}
        aria-valuenow={aria.value.now}
        aria-valuemin={aria.value.now != null ? 0 : undefined}
        aria-valuemax={aria.value.now != null ? 100 : undefined}
        aria-label={aria.value.role === "progressbar" && props.centerLabel ? props.centerLabel : undefined}
      >
        <svg
          width={props.size}
          height={props.size}
          viewBox={`0 0 ${props.size} ${props.size}`}
          style={{ transform: "rotate(-90deg)" }}
        >
          {rings.value.map((ring, i) => (
            <g key={i}>
              <circle
                class="hk-gauge-ring__track"
                cx={center.value}
                cy={center.value}
                r={ring.radius}
                fill="none"
                data-variant={props.trackVariant}
                stroke-width={ring.strokeWidth}
                /* Inline style so an explicit trackColor outranks the
                 * data-variant palette rules (inline > class > attribute). */
                style={ring.trackColor ? { stroke: ring.trackColor } : undefined}
              />
              <circle
                class="hk-gauge-ring__arc"
                cx={center.value}
                cy={center.value}
                r={ring.radius}
                fill="none"
                data-variant={ring.variant}
                stroke-width={ring.strokeWidth}
                stroke-linecap="round"
                stroke-dasharray={ring.circumference}
                stroke-dashoffset={ring.dashOffset}
                style={{
                  ...(ring.color ? { stroke: ring.color } : {}),
                  transition: props.animate ? "stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1)" : "none",
                }}
              />
            </g>
          ))}
        </svg>
        {(props.centerValue || props.centerLabel) && (
          <div class="hk-gauge-ring__center">
            {props.centerValue && (
              <div class="hk-gauge-ring__value" style={{ fontSize: `${valueFontSize.value}px` }}>
                {props.centerValue}
              </div>
            )}
            {props.centerLabel && (
              <div class="hk-gauge-ring__label" style={{ fontSize: `${labelFontSize.value}px` }}>
                {props.centerLabel}
              </div>
            )}
          </div>
        )}
      </div>
    );
  },
});
