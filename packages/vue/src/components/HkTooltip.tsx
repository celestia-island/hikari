import { computed, defineComponent, onBeforeUnmount, ref, Teleport, type CSSProperties, type PropType } from "vue";
import { usePopupManager, type PopupHandle } from "../runtime/usePopupManager";
import { applyTooltipPosition, type TooltipPlacement } from "../runtime/tooltipPosition";
import "./HkTooltip.scss";

let popupSeq = 0;

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
    // Stable id for the aria-describedby link from the trigger wrapper to
    // the popup (set while the popup is visible, mirroring the tooltip
    // bridge's contract).
    const popupId = `hk-tooltip-${++popupSeq}`;
    const wrapperRef = ref<HTMLElement | null>(null);
    const popupRef = ref<HTMLElement | null>(null);
    let showTimer: ReturnType<typeof setTimeout> | null = null;

    // The band handle and the popup DOM are both LAZY (dense-list contract,
    // 2026-10-05): a tooltip that is never engaged — the overwhelming
    // majority in a list of tags — costs no teleported node, no band
    // registration and no pointer wiring beyond the wrapper's own handlers.
    // The first engage registers the popup-manager handle (kind "tooltip",
    // above modal/drawer overlays, below toasts) and mounts the popup;
    // both are held until unmount so re-shows never churn.
    const manager = usePopupManager();
    let popupHandle: PopupHandle | null = null;
    const zIndex = ref<number | null>(null);
    const everShown = ref(false);

    function ensureEngaged() {
      if (!everShown.value) {
        everShown.value = true;
        if (!popupHandle) {
          popupHandle = manager.register("tooltip", false);
        }
        zIndex.value = popupHandle.zIndex;
      }
    }

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
      ensureEngaged();
      showTimer = setTimeout(() => {
        visible.value = true;
        requestAnimationFrame(updatePosition);
      }, props.delay);
    }

    function showNow() {
      clearShowTimer();
      ensureEngaged();
      visible.value = true;
      requestAnimationFrame(updatePosition);
    }

    function hide() {
      clearShowTimer();
      visible.value = false;
      dismissTouchListener();
    }

    function clearShowTimer() {
      if (showTimer !== null) {
        clearTimeout(showTimer);
        showTimer = null;
      }
    }

    // ── touch taps ──────────────────────────────────────────────────
    // Touch has no hover: a finger tap must open the bubble immediately
    // (no delay) and the NEXT tap — anywhere else — must close it.
    // Tap-derived synthetic mouseenter/mouseleave events are ignored for
    // a short window after a touch so they cannot re-open what the tap
    // just closed.
    // -Infinity sentinel: a plain 0 would suppress hover during the
    // first 600ms of page life (performance.now() starts near 0) and
    // under test fake timers (frozen at 0).
    let lastTouchAt = -Infinity;
    let touchDismiss: ((e: PointerEvent) => void) | null = null;

    function dismissTouchListener() {
      if (touchDismiss) {
        document.removeEventListener("pointerdown", touchDismiss, true);
        touchDismiss = null;
      }
    }

    function onPointerdown(e: PointerEvent) {
      if (e.pointerType !== "touch") return;
      lastTouchAt = performance.now();
      if (visible.value) {
        hide();
        return;
      }
      showNow();
      touchDismiss = (ev: PointerEvent) => {
        const node = wrapperRef.value;
        if (node && ev.target instanceof Node && node.contains(ev.target)) {
          // A re-tap on the trigger itself is the toggle case — handled
          // by the branch above on its own pointerdown.
          return;
        }
        hide();
      };
      document.addEventListener("pointerdown", touchDismiss, true);
    }

    onBeforeUnmount(() => {
      clearShowTimer();
      dismissTouchListener();
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
        aria-describedby={visible.value ? popupId : undefined}
        onPointerdown={onPointerdown}
        onMouseenter={() => {
          // Synthetic mouseenter right after a touch tap must not
          // re-open the bubble the tap just toggled closed.
          if (performance.now() - lastTouchAt < 600) return;
          show();
        }}
        onMouseleave={hide}
        onFocusin={show}
        onFocusout={hide}
      >
        <span class="hk-tooltip-trigger">
          {slots.default?.({ popupId, visible: visible.value })}
        </span>
        <Teleport to="body">
          {everShown.value && (
            <div
              ref={popupRef}
              id={popupId}
              role="tooltip"
              class={tooltipCls.value}
              style={popupStyle.value}
            >
              <div class="hk-tooltip-content">{props.text}</div>
            </div>
          )}
        </Teleport>
      </span>
    );
  },
});
