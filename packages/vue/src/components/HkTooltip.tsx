import { computed, defineComponent, onBeforeUnmount, onMounted, ref, Teleport, type CSSProperties, type PropType } from "vue";
import { usePopupManager, type PopupHandle } from "../runtime/usePopupManager";
import { applyTooltipPosition, type TooltipPlacement } from "../runtime/tooltipPosition";
import "./HkTooltip.scss";

export default defineComponent({
  name: "HkTooltip",
  props: {
    text: { type: String, required: true },
    placement: { type: String as PropType<TooltipPlacement>, default: "top" },
    delay: { type: Number, default: 300 },
    maxWidth: { type: String, default: undefined },
  },
  setup(props, { slots }) {
    const visible = ref(false);
    const wrapperRef = ref<HTMLElement | null>(null);
    const popupRef = ref<HTMLElement | null>(null);
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
      if (!wrapperRef.value || !popupRef.value) return;
      const rect = wrapperRef.value.getBoundingClientRect();
      // Placement geometry lives in the shared runtime helper (it also
      // serves the document-level tooltip bridge) — including the
      // ancestor-zoom division that keeps teleported popups pinned to
      // their trigger inside scaled roots, and the measure-and-clamp pass
      // that keeps the measured bubble inside the viewport gutter (flip,
      // cap, shift) instead of spilling off-screen or shrinking to the
      // containing block's leftover space.
      applyTooltipPosition(popupRef.value, rect, props.placement, props.maxWidth);
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

    // Only the popup-manager z rides the vnode; the geometry is written
    // straight onto the element by applyTooltipPosition (same as the
    // tooltip bridge) so a re-render can never clobber a clamp shift.
    const popupStyle = computed<CSSProperties>(() =>
      zIndex.value != null ? { zIndex: zIndex.value } : {},
    );

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
            ref={popupRef}
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
