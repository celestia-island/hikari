import {
  defineComponent,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  type PropType,
} from "vue";

import "./HkBlankCanvas.scss";

/** The size the host's renderer gets told about, in CSS pixels. */
export interface BlankCanvasSize {
  width: number;
  height: number;
}

/**
 * HkBlankCanvas — the base view for a full-bleed mount.
 *
 * Some views are a canvas and nothing else: the 3D twin hands the whole
 * surface to a three.js renderer, an embedded editor hands it to whatever
 * the host embeds. Their shape is not a layout this library should model, so
 * this component owns only the parts every one of them needs:
 *
 *   - **a 100% × 100% host** — the mount element fills its parent, and the
 *     component imposes no padding, scroll container or chrome of its own;
 *   - **a size-ready gate** — `onMount` is not called until the host has a
 *     non-zero size. Initialising a WebGL context (or an editor) against a
 *     0 × 0 element is the cause of the "first frame is wrong, then it
 *     settles" flicker; waiting one frame for layout is cheaper than
 *     rebuilding the surface;
 *   - **resize and teardown signals** — `onResize` on every observed size
 *     change, `onUnmount` before the element goes away, so a renderer can
 *     dispose its GPU resources;
 *   - **an overlay slot** — DOM drawn ABOVE the mount (device cards, leader
 *     lines, HUD), which is what the 3D views put over their canvas.
 *
 * The component draws nothing itself: no background, no placeholder, no
 * error state. A host that needs those renders them in the default slot or
 * the overlay.
 */
export default defineComponent({
  name: "HkBlankCanvas",
  props: {
    /** Called once, when the mount element first has a non-zero size. */
    onMount: {
      type: Function as PropType<((el: HTMLElement, size: BlankCanvasSize) => void) | undefined>,
      default: undefined,
    },
    /** Called on every later size change (rounded to whole pixels). */
    onResize: {
      type: Function as PropType<((size: BlankCanvasSize) => void) | undefined>,
      default: undefined,
    },
    /** Called before the mount element is removed. */
    onUnmount: {
      type: Function as PropType<(() => void) | undefined>,
      default: undefined,
    },
    /** Accessible label for the mount region. */
    ariaLabel: { type: String, default: undefined },
  },
  setup(props, { slots, expose }) {
    const mountEl = shallowRef<HTMLElement | null>(null);
    const size = ref<BlankCanvasSize>({ width: 0, height: 0 });
    /** Whether `onMount` has fired — the gate that keeps a renderer from
     *  initialising against a 0 × 0 element. */
    const ready = ref(false);
    let ro: ResizeObserver | null = null;

    function measure(): BlankCanvasSize {
      const el = mountEl.value;
      if (!el) return { width: 0, height: 0 };
      const rect = el.getBoundingClientRect();
      return { width: Math.round(rect.width), height: Math.round(rect.height) };
    }

    function publish() {
      const next = measure();
      const changed = next.width !== size.value.width || next.height !== size.value.height;
      if (changed) size.value = next;
      if (!ready.value) {
        if (next.width === 0 || next.height === 0) return;
        ready.value = true;
        props.onMount?.(mountEl.value as HTMLElement, next);
        return;
      }
      if (changed) props.onResize?.(next);
    }

    onMounted(() => {
      // One frame first: the element exists but its parent may not have been
      // laid out yet, and the whole point of the gate is not to initialise
      // against the pre-layout box.
      requestAnimationFrame(publish);
      if (typeof ResizeObserver !== "undefined" && mountEl.value) {
        ro = new ResizeObserver(publish);
        ro.observe(mountEl.value);
      }
    });

    onBeforeUnmount(() => {
      ro?.disconnect();
      ro = null;
      if (ready.value) props.onUnmount?.();
      ready.value = false;
    });

    expose({ size, ready, measure });

    return () => (
      <div
        class="hk-blank-canvas"
        aria-label={props.ariaLabel}
        data-ready={ready.value ? "" : undefined}
      >
        <div ref={mountEl} class="hk-blank-canvas-mount">
          {slots.default?.()}
        </div>
        <div class="hk-blank-canvas-overlay">{slots.overlay?.()}</div>
      </div>
    );
  },
});
