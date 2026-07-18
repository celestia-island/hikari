import { computed, defineComponent, ref, Teleport, type CSSProperties, type PropType } from "vue";
import "../../../components/src/styles/components/tooltip.scss";

export default defineComponent({
  name: "HkTooltip",
  props: {
    text: { type: String, required: true },
    placement: { type: String as PropType<"top" | "bottom" | "left" | "right">, default: "top" },
  },
  setup(props, { slots }) {
    const visible = ref(false);
    const wrapperRef = ref<HTMLElement | null>(null);
    const tooltipStyle = ref<CSSProperties>({});

    function updatePosition() {
      if (!wrapperRef.value) return;
      const rect = wrapperRef.value.getBoundingClientRect();
      const gap = 8;
      const style: CSSProperties = {};

      switch (props.placement) {
        case "top":
          style.top = `${rect.top - gap}px`;
          style.left = `${rect.left + rect.width / 2}px`;
          style.transform = "translate(-50%, -100%)";
          break;
        case "bottom":
          style.top = `${rect.bottom + gap}px`;
          style.left = `${rect.left + rect.width / 2}px`;
          style.transform = "translate(-50%, 0)";
          break;
        case "left":
          style.top = `${rect.top + rect.height / 2}px`;
          style.left = `${rect.left - gap}px`;
          style.transform = "translate(-100%, -50%)";
          break;
        case "right":
          style.top = `${rect.top + rect.height / 2}px`;
          style.left = `${rect.right + gap}px`;
          style.transform = "translate(0, -50%)";
          break;
      }

      tooltipStyle.value = style;
    }

    function show() {
      visible.value = true;
      requestAnimationFrame(updatePosition);
    }

    function hide() {
      visible.value = false;
    }

    const tooltipCls = computed(() => [
      "hi-tooltip",
      `hi-tooltip-${props.placement}`,
      visible.value ? "hi-tooltip-visible" : "",
    ]);

    return () => (
      <span
        ref={wrapperRef}
        class="hi-tooltip-wrapper"
        onMouseenter={show}
        onMouseleave={hide}
        onFocusin={show}
        onFocusout={hide}
      >
        <span class="hi-tooltip-trigger">
          {slots.default?.()}
        </span>
        {visible.value && (
          <Teleport to="body">
            <div class={tooltipCls.value} style={tooltipStyle.value}>
              <div class="hi-tooltip-content">{props.text}</div>
            </div>
          </Teleport>
        )}
      </span>
    );
  },
});
