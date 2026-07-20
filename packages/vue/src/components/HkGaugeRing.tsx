import { computed, defineComponent, onMounted, ref, watch } from "vue";

import { useReportedTransition } from "../composables/useReportedTransition";
import { onceFrame } from "../runtime/animationBus";
import "./HkGaugeRing.scss";

interface RingData {
  pct: number;
  color: string;
  trackColor: string;
}

const RING_ANIM_MS = 800;

export default defineComponent({
  name: "HkGaugeRing",
  props: {
    rings: {
      type: Array as () => RingData[],
      required: true,
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

    const rings = computed(() => {
      const { strokeWidth, gap, size } = props;
      const svg: {
        radius: number;
        circumference: number;
        dashOffset: number;
        color: string;
        trackColor: string;
        strokeWidth: number;
      }[] = [];
      let r = (size - strokeWidth) / 2;
      for (const ring of props.rings) {
        const radius = Math.max(r, 1);
        const circumference = 2 * Math.PI * radius;
        const dashOffset = circumference * (1 - (Math.min(ring.pct, 100) / 100) * progress.value);
        svg.push({
          radius,
          circumference,
          dashOffset,
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

    return () => (
      <div class="hk-gauge-ring" style={{ width: `${props.size}px`, height: `${props.size}px` }}>
        <svg
          width={props.size}
          height={props.size}
          viewBox={`0 0 ${props.size} ${props.size}`}
          style={{ transform: "rotate(-90deg)" }}
        >
          {rings.value.map((ring, i) => (
            <g key={i}>
              <circle
                cx={center.value}
                cy={center.value}
                r={ring.radius}
                fill="none"
                stroke={ring.trackColor}
                stroke-width={ring.strokeWidth}
              />
              <circle
                cx={center.value}
                cy={center.value}
                r={ring.radius}
                fill="none"
                stroke={ring.color}
                stroke-width={ring.strokeWidth}
                stroke-linecap="round"
                stroke-dasharray={ring.circumference}
                stroke-dashoffset={ring.dashOffset}
                style={{
                  transition: props.animate ? "stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1)" : "none",
                }}
              />
            </g>
          ))}
        </svg>
        {(props.centerValue || props.centerLabel) && (
          <div class="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            {props.centerValue && (
              <div class="text-lg font-bold text-text leading-none">{props.centerValue}</div>
            )}
            {props.centerLabel && (
              <div class="text-2xs text-muted mt-0.5">{props.centerLabel}</div>
            )}
          </div>
        )}
      </div>
    );
  },
});
