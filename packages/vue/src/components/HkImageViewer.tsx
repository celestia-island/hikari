import { computed, defineComponent, onBeforeUnmount, onMounted, ref, watch } from "vue";

import HSpinner from "./HkSpinner";
import HMinimap from "./HkMinimap";
import "./HkImageViewer.scss";

/**
 * Zoomable / pannable image viewer.
 *
 * The image is laid out at its natural pixel size and transformed with
 * `translate(panX, panY) scale(zoom)` (transform-origin 0 0). That keeps it
 * compatible with HMinimap's viewport-rect math, which assumes exactly this
 * transform model. Default state is fit-to-container + centred; wheel and
 * double-click zoom (cursor-anchored), drag pans. The minimap reuses the
 * generic HMinimap (rendered with the image as its background).
 */
export default defineComponent({
  name: "HkImageViewer",
  props: {
    src: { type: String, required: true },
    alt: { type: String, default: "" },
  },
  setup(props) {
    const containerRef = ref<HTMLElement | null>(null);
    const imgRef = ref<HTMLImageElement | null>(null);

    const zoom = ref(1);
    const panX = ref(0);
    const panY = ref(0);
    const fit = ref(1);
    const imgW = ref(0);
    const imgH = ref(0);
    const loaded = ref(false);

    const dragging = ref(false);
    const lastPt = ref({ x: 0, y: 0 });

    const MAX_ZOOM = 8;

    const isZoomed = computed(() => loaded.value && zoom.value > fit.value + 0.001);
    const canZoomIn = computed(() => zoom.value < MAX_ZOOM);
    const canZoomOut = computed(() => zoom.value > fit.value + 0.001);

    function dims() {
      const c = containerRef.value;
      return c ? { cw: c.clientWidth, ch: c.clientHeight } : { cw: 0, ch: 0 };
    }

    function recomputeFit() {
      const { cw, ch } = dims();
      if (!imgW.value || !imgH.value || !cw || !ch) return;
      fit.value = Math.min(1, cw / imgW.value, ch / imgH.value);
    }

    function center() {
      const { cw, ch } = dims();
      const dw = imgW.value * zoom.value;
      const dh = imgH.value * zoom.value;
      panX.value = (cw - dw) / 2;
      panY.value = (ch - dh) / 2;
    }

    function clampPan() {
      const { cw, ch } = dims();
      const dw = imgW.value * zoom.value;
      const dh = imgH.value * zoom.value;
      if (dw <= cw) panX.value = (cw - dw) / 2;
      else panX.value = Math.max(cw - dw, Math.min(0, panX.value));
      if (dh <= ch) panY.value = (ch - dh) / 2;
      else panY.value = Math.max(ch - dh, Math.min(0, panY.value));
    }

    function setZoom(next: number, cx?: number, cy?: number) {
      const { cw, ch } = dims();
      const target = Math.max(fit.value, Math.min(MAX_ZOOM, next));
      if (target === zoom.value) return;
      const anchorX = cx ?? cw / 2;
      const anchorY = cy ?? ch / 2;
      const wx = (anchorX - panX.value) / zoom.value;
      const wy = (anchorY - panY.value) / zoom.value;
      zoom.value = target;
      panX.value = anchorX - wx * target;
      panY.value = anchorY - wy * target;
      clampPan();
    }

    function resetView() {
      recomputeFit();
      zoom.value = fit.value;
      center();
    }

    function onImgLoad() {
      const img = imgRef.value;
      if (!img) return;
      imgW.value = img.naturalWidth;
      imgH.value = img.naturalHeight;
      loaded.value = true;
      resetView();
    }

    function onWheel(e: WheelEvent) {
      if (!loaded.value) return;
      e.preventDefault();
      const el = containerRef.value;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      setZoom(zoom.value * factor, cx, cy);
    }

    function onPointerDown(e: PointerEvent) {
      if (!loaded.value) return;
      dragging.value = true;
      lastPt.value = { x: e.clientX, y: e.clientY };
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    }

    function onPointerMove(e: PointerEvent) {
      if (!dragging.value) return;
      const dx = e.clientX - lastPt.value.x;
      const dy = e.clientY - lastPt.value.y;
      lastPt.value = { x: e.clientX, y: e.clientY };
      panX.value += dx;
      panY.value += dy;
      clampPan();
    }

    function onPointerUp() {
      dragging.value = false;
    }

    function onDblClick(e: MouseEvent) {
      if (!loaded.value) return;
      const el = containerRef.value;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      setZoom(isZoomed.value ? fit.value : Math.min(MAX_ZOOM, fit.value * 3), cx, cy);
    }

    function onPanDelta(dx: number, dy: number) {
      panX.value += dx;
      panY.value += dy;
      clampPan();
    }

    let ro: ResizeObserver | null = null;

    onMounted(() => {
      const c = containerRef.value;
      if (!c) return;
      ro = new ResizeObserver(() => {
        const wasFit = !isZoomed.value;
        recomputeFit();
        if (wasFit) {
          zoom.value = fit.value;
          center();
        } else {
          clampPan();
        }
      });
      ro.observe(c);
      c.addEventListener("wheel", onWheel, { passive: false });
      c.addEventListener("pointerdown", onPointerDown);
      c.addEventListener("pointermove", onPointerMove);
      c.addEventListener("pointerup", onPointerUp);
      c.addEventListener("pointercancel", onPointerUp);
      c.addEventListener("dblclick", onDblClick);
    });

    onBeforeUnmount(() => {
      const c = containerRef.value;
      if (!c) return;
      ro?.disconnect();
      ro = null;
      c.removeEventListener("wheel", onWheel);
      c.removeEventListener("pointerdown", onPointerDown);
      c.removeEventListener("pointermove", onPointerMove);
      c.removeEventListener("pointerup", onPointerUp);
      c.removeEventListener("pointercancel", onPointerUp);
      c.removeEventListener("dblclick", onDblClick);
    });

    watch(
      () => props.src,
      () => {
        loaded.value = false;
        imgW.value = 0;
        imgH.value = 0;
        zoom.value = 1;
        fit.value = 1;
        panX.value = 0;
        panY.value = 0;
      },
    );

    const imgStyle = computed(() => ({
      transform: `translate(${panX.value}px, ${panY.value}px) scale(${zoom.value})`,
      transformOrigin: "0 0",
      cursor: isZoomed.value ? (dragging.value ? "grabbing" : "grab") : "zoom-in",
    }));

    const contentBounds = computed(() => ({ x: 0, y: 0, w: imgW.value, h: imgH.value }));
    const zoomPercent = computed(() => Math.round(zoom.value * 100));

    return () => (
      <div ref={containerRef} class="hk-image-viewer">
        <img
          ref={imgRef}
          src={props.src}
          alt={props.alt}
          class={["hk-image-viewer-img", !loaded.value && "is-loading"].filter(Boolean).join(" ")}
          style={imgStyle.value}
          draggable={false}
          onLoad={onImgLoad}
        />
        {!loaded.value && (
          <div class="hk-image-viewer-loading">
            <HSpinner size="md" />
          </div>
        )}

        {loaded.value && isZoomed.value && (
          <HMinimap
            imageSrc={props.src}
            imageBounds={contentBounds.value}
            zoom={zoom.value}
            panX={panX.value}
            panY={panY.value}
            viewportWidth={dims().cw}
            viewportHeight={dims().ch}
            contentBounds={contentBounds.value}
            zoomPercent={zoomPercent.value}
            canZoomIn={canZoomIn.value}
            canZoomOut={canZoomOut.value}
            showReset
            onZoomIn={() => setZoom(zoom.value * 1.2)}
            onZoomOut={() => setZoom(zoom.value / 1.2)}
            onReset={resetView}
            onPanDelta={onPanDelta}
          />
        )}
      </div>
    );
  },
});
