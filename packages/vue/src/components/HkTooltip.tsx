import { computed, defineComponent, onBeforeUnmount, ref, Teleport, type CSSProperties, type PropType } from "vue";
import "./HkTooltip.scss";

export default defineComponent({
  name: "HkTooltip",
  props: {
    text: { type: String, required: true },
    placement: { type: String as PropType<"top" | "bottom" | "left" | "right">, default: "top" },
    delay: { type: Number, default: 300 },
    maxWidth: { type: String, default: undefined },
  },
  setup(props, { slots }) {
    const visible = ref(false);
    const wrapperRef = ref<HTMLElement | null>(null);
    const tooltipStyle = ref<CSSProperties>({});
    let showTimer: ReturnType<typeof setTimeout> | null = null;

    function updatePosition() {
      if (!wrapperRef.value) return;
      const rect = wrapperRef.value.getBoundingClientRect();
      const gap = 8;
      const style: CSSProperties = {};

      if (props.maxWidth) {
        style.maxWidth = props.maxWidth;
      }

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
      clearShowTimer();
      showTimer = setTimeout(() => {
        visible.value = true;
        requestAnimationFrame(updatePosition);
      }, props.delay);
    }

    function hide() {
      clearShowTimer();
      visible.value = false;
    }

    function clearShowTimer() {
      if (showTimer !== null) {
        clearTimeout(showTimer);
        showTimer = null;
      }
    }

    onBeforeUnmount(() => {
      clearShowTimer();
    });

    const tooltipCls = computed(() => [
      "hk-tooltip-popup",
      `hk-tooltip-${props.placement}`,
      visible.value ? "hk-tooltip-visible" : "",
    ]);

    return () => (
      <span
        ref={wrapperRef}
        class="hk-tooltip-wrapper"
        data-position={props.placement}
        onMouseenter={show}
        onMouseleave={hide}
        onFocusin={show}
        onFocusout={hide}
      >
        <span class="hk-tooltip-trigger">
          {slots.default?.()}
        </span>
        <Teleport to="body">
          <div
            class={tooltipCls.value}
            style={tooltipStyle.value}
          >
            <div class="hk-tooltip-content">{props.text}</div>
          </div>
        </Teleport>
      </span>
    );
  },
});
