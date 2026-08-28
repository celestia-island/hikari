import { computed, defineComponent, onBeforeUnmount, onMounted, ref, Teleport, type CSSProperties, type PropType } from "vue";
import { usePopupManager, type PopupHandle } from "../runtime/usePopupManager";
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

    // Registers with the popup manager (kind "tooltip") so tooltips hold
    // the tooltip band (above modal/drawer overlays, below toasts); the
    // zIndex lands on the popup element and overrides the --hi-z-tooltip
    // fallback in the SCSS.
    const manager = usePopupManager();
    let popupHandle: PopupHandle | null = null;
    const zIndex = ref<number | null>(null);

    onMounted(() => {
      popupHandle = manager.register("tooltip", false);
      zIndex.value = popupHandle.zIndex;
    });

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
      if (popupHandle) {
        manager.unregister(popupHandle.id);
        popupHandle = null;
      }
    });

    const tooltipCls = computed(() => [
      "hk-tooltip-popup",
      `hk-tooltip-${props.placement}`,
      visible.value ? "hk-tooltip-visible" : "",
    ]);

    const popupStyle = computed<CSSProperties>(() => ({
      ...tooltipStyle.value,
      ...(zIndex.value != null ? { zIndex: zIndex.value } : {}),
    }));

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
            style={popupStyle.value}
          >
            <div class="hk-tooltip-content">{props.text}</div>
          </div>
        </Teleport>
      </span>
    );
  },
});
