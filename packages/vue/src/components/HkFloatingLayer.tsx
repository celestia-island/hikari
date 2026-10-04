import {
  defineComponent,
  onBeforeUnmount,
  ref,
  Teleport,
  watch,
  type PropType,
} from "vue";

import { hasLiveWindow, usePopupManager } from "../runtime/usePopupManager";
import "./HkFloatingLayer.scss";

type FloatCorner = "bottom-right" | "bottom-left" | "top-right" | "top-left";

/**
 * HkFloatingLayer — viewport-fixed chrome that floats at the TOP layer.
 *
 * The dial/FAB problem this solves: always-reachable chrome anchored to
 * a page (or a window) dies the moment a real window opens over it —
 * either it is buried under the modal overlay (page pads), or it gets
 * re-rendered as an in-window copy that no longer shares the page's
 * geometry (the per-modal dial copies this layer replaces). Floating at
 * the popup manager's tooltip band makes the chrome independent of the
 * window stack, exactly like a tooltip: above every modal/drawer
 * overlay, below toasts, present on its own merits.
 *
 * Mechanics:
 *   - Teleported to <body>, so no transformed ancestor (morph tabs,
 *     modal content frames) can re-anchor or clip a `position: fixed`
 *     child, and the layer resolves against the viewport full stop.
 *   - Registered with the popup manager (kind "tooltip", non-blocking,
 *     no scroll lock, no breadcrumb title): the z slot derives from the
 *     live registry instead of a magic constant, and the layer shows up
 *     in `readHkRuntime("popupManager")` like every other surface.
 *   - The layer itself is gesture-transparent (pointer-events: none);
 *     the widgets inside catch their own pointers.
 *   - Corner insets mirror HkFab's safe-area-aware math, extended per
 *     instance by the offset props.
 *
 *   - Within the tooltip band, stacking is open-order (the manager's
 *     rule): a tooltip that registered later paints above this chrome
 *     near the corner, and a layer mounted after a live tooltip paints
 *     above it — transient vs persistent chrome trades locally. Do not
 *     "fix" this with a magic z. Two layers at one corner overlap;
 *     pass offsets to stack them deliberately.
 *   - While a modal is open, the modal's focus trap keeps this chrome
 *     pointer-reachable but NOT keyboard-reachable — the standing
 *     tradeoff for floating chrome; a focus relay is out of scope.
 *
 * Consumers: the shell's quick-action pad, a modal's detached date dial
 * (via `HkFab layer="top"` or direct use) — anything that must survive
 * the next window opening on top of it.
 */
export default defineComponent({
  name: "HkFloatingLayer",
  props: {
    /** False unmounts the teleported layer and releases its band slot
     *  (true = always shown). House `open` convention, like every other
     *  hikari surface. */
    open: { type: Boolean, default: true },
    corner: { type: String as PropType<FloatCorner>, default: "bottom-right" },
    offsetX: { type: String, default: undefined },
    offsetY: { type: String, default: undefined },
    /** Accessible group name for the chrome (e.g. "Date dial"). */
    ariaLabel: { type: String, default: "" },
    /** Stack priority (user direction 2026-10-04): when true the layer
     *  yields the screen while ANY window is open - page-level dial
     *  chrome disappears under the top window instead of floating over
     *  it, and returns when the last window closes. */
    yieldToWindows: { type: Boolean, default: false },
  },
  setup(props, { slots }) {
    const { register, unregister } = usePopupManager();
    const handle = ref<{ id: string; zIndex: number } | null>(null);

    // Annotation-band chrome, not a breadcrumb level: non-blocking,
    // untitled, no scroll lock, no outside-dismiss channel. Registered
    // exactly while shown (immediate, so the first paint already
    // carries the band z); a hidden layer holds no slot. (A
    // yielded layer keeps its slot held while hidden — constant chrome
    // flipping a registered slot on every window open/close would churn
    // the band for no visual effect.)
    watch(
      () => props.open,
      (show) => {
        if (show && !handle.value) handle.value = register("tooltip", false);
        else if (!show && handle.value) {
          unregister(handle.value.id);
          handle.value = null;
        }
      },
      { immediate: true },
    );
    onBeforeUnmount(() => {
      if (handle.value) unregister(handle.value.id);
      handle.value = null;
    });

    return () => {
      if (!props.open || (props.yieldToWindows && hasLiveWindow.value)) return null;
      return (
        <Teleport to="body">
          <div
            class="hk-floating-layer"
            data-corner={props.corner}
            role={props.ariaLabel ? "group" : undefined}
            aria-label={props.ariaLabel || undefined}
            style={{
              "--hk-float-z": handle.value ? String(handle.value.zIndex) : undefined,
              "--hk-float-offset-x": props.offsetX,
              "--hk-float-offset-y": props.offsetY,
            }}
          >
            {slots.default?.()}
          </div>
        </Teleport>
      );
    };
  },
});
