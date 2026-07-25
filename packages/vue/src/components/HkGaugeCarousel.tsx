import { computed, defineComponent, onBeforeUnmount, onMounted, ref, type PropType } from "vue";
import "./HkGaugeCarousel.scss";

export interface HkGaugeItem {
  label: string;
  value: number;
  unit: string;
  pct: number;
}

export default defineComponent({
  name: "HkGaugeCarousel",
  props: {
    items: { type: Array as PropType<HkGaugeItem[]>, required: true },
    intervalMs: { type: Number, default: 3000 },
  },
  setup(props, { slots }) {
    const page = ref(0);
    const transitioning = ref(false);
    let timer: ReturnType<typeof setInterval> | null = null;
    const total = computed(() => props.items.length);
    const isActive = computed(() => total.value > 2);

    function advance() {
      transitioning.value = true;
      page.value++;
    }

    onMounted(() => {
      if (isActive.value) timer = setInterval(advance, props.intervalMs);
    });
    onBeforeUnmount(() => { if (timer) clearInterval(timer); });

    function onTransitionEnd() {
      transitioning.value = false;
      if (page.value >= total.value) {
        page.value = page.value % total.value;
      }
    }

    const stepPct = computed(() => 100 / total.value);

    const stageStyle = computed(() => {
      const n = total.value;
      return {
        width: `${n * 50}%`,
        display: "flex",
        flexWrap: "nowrap" as const,
        gap: "4px",
        transform: `translateX(${-((page.value % n) * 50)}%)`,
        transition: transitioning.value
          ? "transform 0.35s var(--ease-out-expo, ease-out)"
          : "none",
      };
    });

    const itemStyle = {
      flex: "0 0 calc(50% - 2px)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    } as const;

    return () => (
      <div class="hk-gauge-carousel">
        {!isActive.value ? (
          <div class="hk-gauge-carousel__track">
            {props.items.map((it) => (
              <div key={it.label} style={itemStyle.value}>
                {slots.default?.({ item: it })}
              </div>
            ))}
          </div>
        ) : (
          <div class="hk-gauge-carousel__viewport">
            <div class="hk-gauge-carousel__stage" style={stageStyle.value} onTransitionend={onTransitionEnd}>
              {[...props.items, ...props.items].map((it, i) => (
                <div key={`${it.label}-${i}`} style={itemStyle.value}>
                  {slots.default?.({ item: it })}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  },
});
