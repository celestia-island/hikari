/**
 * useHeightRide — the family-level "height ride" measurement primitive.
 *
 * Several hikari surfaces want one specific open/close motion: the SURFACE
 * FRAME itself grows from a fraction of its natural height to the full
 * height, while the chrome (title bar, footer action row, any pinned band)
 * keeps its natural size and stays legible. Scaling the whole frame
 * (`transform: scaleY()`) is the wrong tool for that — it squashes the
 * title glyphs, the buttons and the corner radii along with everything
 * else (2026-11-07 user report on the modal ride), and it re-rasters text
 * for the entire ride.
 *
 * The ride is therefore a LAYOUT-height animation:
 *
 *   frame height  :  chrome + content × factor   ⇄   chrome + content
 *   content region:  scaleY(factor)              ⇄   scaleY(1)   (origin top)
 *
 * The content region keeps its natural layout box (so nothing inside it
 * reflows per frame) and is only visually compressed about its own TOP
 * edge, which makes the compressed paint land exactly in the shorter slot
 * the frame leaves for it: the frame's bottom edge and the content's
 * bottom edge coincide at every t. Chrome is never inside the transform,
 * so its type, icons and padding render at natural size throughout.
 *
 * This composable owns the MEASUREMENT half only: it publishes
 *
 *   --hk-ride-chrome    px  the part of the frame the ride must not squeeze
 *   --hk-ride-content   px  the region that does get compressed
 *   --hk-ride-factor    the fraction (default 0.9)
 *
 * on the frame, and leaves the interpolation to CSS. That split is what
 * keeps it composable with the surfaces' existing state machines: the
 * consumer keeps flipping its own enter/leave classes (HkModal's surface
 * machine, HkRideBox's `riding` prop) and the sheet resolves
 * `height: calc(chrome + content × factor)` from the published numbers.
 * No timers, no class ownership, no fight with a consumer's own height pin
 * — a state rule carrying `!important` legitimately outranks the inline
 * px the size-morph pins while a ride is in flight.
 *
 * Scroll-container compatibility (the reason this lives upstream rather
 * than inside HkModal): every hikari custom scroller (`HkScrollContainer`,
 * `HkScrollPin`, the overlay scrollbar, the windowed scroller) measures
 * LAYOUT boxes — `offsetHeight` / `clientHeight` / `scrollHeight` — which
 * a transform never touches. Because the ride animates the FRAME's height
 * and leaves the content box natural, those measurements, the scroll
 * offsets, the pins and the fade bands stay coherent for the whole ride;
 * nothing has to be re-measured per frame, and nothing drifts when the
 * ride is interrupted.
 */
import { onBeforeUnmount, type Ref } from "vue";

/** Class/attribute vocabulary shared by the sheet and the contract tests. */
export const RIDE_CLASS = "hk-ride";
export const RIDE_FROM_CLASS = "hk-ride--from";
export const RIDE_TO_CLASS = "hk-ride--to";
export const RIDE_CONTENT_CLASS = "hk-ride-content";
export const RIDE_ATTR = "data-hk-riding";
/** Present only once the chrome/content split has been measured. */
export const RIDE_READY_ATTR = "data-hk-ride-ready";

export interface HeightRideOptions {
  /** Content height at the ride's extreme, as a fraction of natural.
   *  Default 0.9 (a 10% vertical reveal). */
  factor?: number;
}

export interface HeightRide {
  /** Measure the frame's chrome/content split and publish the variables.
   *  Safe to call at any time OUTSIDE a ride (rest geometry is what the
   *  ride needs); calling it mid-ride re-measures the live, compressed
   *  box and is therefore a no-op unless `force` is passed. */
  refresh(force?: boolean): void;
  /** Re-apply the LAST measured split without touching the DOM boxes.
   *  A surface that unmounts its frame on close loses the inline variables
   *  with it; republishing on the next mount is what makes the very first
   *  painted frame of the next ride already correct. */
  publish(): boolean;
  /** The chrome height (px) from the last successful measure. */
  chromeHeight(): number;
  /** The content height (px) from the last successful measure. */
  contentHeight(): number;
  /** Drop the published variables (the sheet then falls back to `auto`,
   *  i.e. no ride — never to a wrong box). */
  release(): void;
}

/** Any ride class means the box is (or is heading) somewhere other than its
 *  rest height, so a measurement taken then would poison the next ride. The
 *  guard therefore covers BOTH ends; consumers measure at rest. */
function isInFlight(frame: HTMLElement): boolean {
  return (
    frame.classList.contains(RIDE_FROM_CLASS) || frame.classList.contains(RIDE_TO_CLASS)
  );
}

/**
 * Wire a frame (whose height rides) to the content region it compresses.
 *
 * `frame` must carry `.hk-ride` (directly, or via `HkRideBox`); `content`
 * must carry `.hk-ride-content`. Both are applied by the sheet/component,
 * so consumers normally only supply the refs.
 */
export function useHeightRide(
  frame: Ref<HTMLElement | null | undefined>,
  content: Ref<HTMLElement | null | undefined>,
  options: HeightRideOptions = {},
): HeightRide {
  const factor = options.factor ?? 0.9;
  let chrome = 0;
  let contentH = 0;

  const release = (): void => {
    const f = frame.value;
    if (!f) return;
    f.style.removeProperty("--hk-ride-chrome");
    f.style.removeProperty("--hk-ride-content");
    f.style.removeProperty("--hk-ride-factor");
    f.removeAttribute(RIDE_READY_ATTR);
  };

  const refresh = (force = false): void => {
    const f = frame.value;
    const c = content.value;
    if (!f || !c) return;
    // Once the split is known, re-measuring DURING a ride would read the
    // compressed boxes and shrink again on the next flight. The first
    // measurement is exempt: the sheet keeps the frame at `auto` until the
    // split is published, so that one is taken on honest natural geometry.
    if (!force && f.hasAttribute(RIDE_READY_ATTR) && isInFlight(f)) return;
    // Neither side reads the FRAME's height (that is the number the ride
    // computes): the content region's own layout box, plus the frame's OTHER
    // element children (the pinned chrome bands, always `flex-shrink: 0`).
    // Phones/WebViews that report 0 publish nothing at all rather than a
    // wrong box.
    const contentNatural = c.offsetHeight;
    let chromeNatural = 0;
    for (const child of Array.from(f.children)) {
      if (child === c || !(child instanceof HTMLElement)) continue;
      chromeNatural += child.offsetHeight;
    }
    if (contentNatural <= 0) return;
    contentH = contentNatural;
    chrome = chromeNatural;
    f.style.setProperty("--hk-ride-chrome", `${chrome}px`);
    f.style.setProperty("--hk-ride-content", `${contentH}px`);
    f.style.setProperty("--hk-ride-factor", String(factor));
    // Readiness flag: the sheet only overrides the frame's height once the
    // split is real, so an unmeasured ride degrades to a plain fade instead
    // of collapsing to `calc(0px + 0px)`.
    f.setAttribute(RIDE_READY_ATTR, "");
  };

  onBeforeUnmount(() => release());

  const publish = (): boolean => {
    const f = frame.value;
    if (!f || contentH <= 0) return false;
    f.style.setProperty("--hk-ride-chrome", `${chrome}px`);
    f.style.setProperty("--hk-ride-content", `${contentH}px`);
    f.style.setProperty("--hk-ride-factor", String(factor));
    f.setAttribute(RIDE_READY_ATTR, "");
    return true;
  };

  return {
    refresh,
    publish,
    chromeHeight: () => chrome,
    contentHeight: () => contentH,
    release,
  };
}
