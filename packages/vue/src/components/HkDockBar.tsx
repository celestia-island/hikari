import { computed, defineComponent, type PropType } from "vue";

import "./HkDockBar.scss";

export type HkDockBarAnchor =
  | "page"
  | "plane"
  | "top"
  | "bottom"
  | "left"
  | "right"
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right";
export type HkDockBarSurface = "glass" | "solid";

/**
 * HkDockBar — the ONE dock container. Every floating surface that docks
 * to an edge or corner of a canvas — bottom-center cruise docks, corner
 * step pagers, floating chat bars, nameplate pills — mounts its content
 * inside THIS container; the page only provides slot content. One chrome
 * (surface, blur, border, radius, reverse glow) means no dock surface
 * ever re-declares its own background or shadow again.
 *
 * Edge gap contract (2026-11-15): a dock owns BOTH of its content-side
 * distances, and reads both from one CSS token family — the resting
 * inset from the viewport edge it hugs, and a transparent CONTENT BAND on
 * the face that points at the content:
 *
 *   G(edge) = var(--hk-dock-gap-<edge>,
 *                 var(--hk-dock-inset, var(--hk-dock-gap, var(--space-16, 1rem))))
 *
 * `--hk-dock-gap` is declared once by the foundation layer (16px); a host
 * overrides it through the `gap` prop (one CSS length, written inline as
 * `--hk-dock-gap`), or per edge through `--hk-dock-gap-<edge>` /
 * `--hk-dock-inset` on any ancestor. Every edge also adds its safe-area
 * inset to the resting distance, so a notched device keeps the gap on top
 * of the system inset while a desktop resolves it to 0.
 *
 * The band belongs to the DOCK, not to the view that hosts it, and that
 * is what makes both placements self-consistent with no host recipe:
 *   - in a `HkScrollContainer` PIN slot the dock is a flex SIBLING of the
 *     scroll viewport, so the wrapper box (band + surface + inset) makes
 *     the viewport yield the band by layout: content ends `gap` above the
 *     surface with no view padding, so `min-height: 100%` content cannot
 *     resurrect the phantom-scroll trap;
 *   - a FLOATING dock (page / plane) is measured by its own
 *     getBoundingClientRect, which already includes padding — so the
 *     occupancy a host publishes to its content (the tail padding a
 *     consumer reads) automatically contains "surface + inset + band", and
 *     scrolling content stops `gap` short of the surface. Nothing in JS
 *     reads a CSS length.
 *
 * Anchors — the full eight-way compass (4 edges + 4 corners):
 *   - `page` (default) and `bottom`: absolute bottom-center of the
 *     nearest positioned ancestor (the SOUTH edge), one bottom gap above
 *     its content floor, with the band on the block-start side. `page` is
 *     the 2026-09-02 spelling kept for existing callers; `bottom` is its
 *     compass alias — identical geometry, pick either.
 *   - `top`: absolute top-center (north edge) with the top gap, band on
 *     the block-end side.
 *   - `left` / `right`: absolute middle of the west / east edge — the
 *     dock runs vertically and is centered with translateY; the band is
 *     on the inline content side and its surface gets a viewport-aware
 *     default max-height (both horizontal gaps subtracted).
 *   - `top-left` / `top-right` / `bottom-left` / `bottom-right`:
 *     absolute corner attachment with both edge gaps, for pagers,
 *     toolbars and HUD panels that live off-center; the band opens on
 *     both content-facing sides.
 *   - `plane`: NOT a compass direction — in-flow; the host provides
 *     the plane (e.g. a fixed footer band) and this container centers
 *     the surface horizontally, lifts it by the bottom gap and opens the
 *     same gap above it. Use it when the host owns positioning.
 *
 * Relationship to HkScrollContainer: that component's dockTop /
 * dockBottom named slots are the contract for docks that live INSIDE a
 * scrolling region. Those slots place a dock two ways (2026-11-10
 * addition — `dockMode`):
 *   - `ride` (the pinned-to-the-visible-bottom-edge form): the dock
 *     mounts inside the scroll viewport after the content, on a spacer
 *     exactly one measured dock height tall, `position: sticky; bottom:
 *     0`. The air between the content end and the dock is therefore
 *     exactly one dock height; short content lets the dock follow the
 *     content end (the leftover window height falls below it), long
 *     content pins it to the visible bottom edge. Use it for a dock that
 *     belongs to the CONTENT (a cruise canvas's bottom bar under its
 *     last row). The container's ride wrapper is `pointer-events: none`
 *     (it covers content while pinned), so this carrier's own box
 *     contract is what keeps the dock interactive: the anchor box catches
 *     nothing, the surface catches everything.
 *   - `pin` (the default, older form): the dock is a non-scrolling flex
 *     SIBLING of the viewport, so it sits on the container's edge and the
 *     viewport shrinks by its height — correct for chrome that owns the
 *     region's frame rather than trailing its content.
 * HkDockBar is the carrier for docks that FLOAT over a canvas or page
 * instead. Pick by host: scrolling region → HkScrollContainer dock slots
 * (`ride` to follow the content, `pin` to own the edge); canvas/page
 * overlay → HkDockBar. Do not nest an HkDockBar inside a scroll viewport
 * expecting the container to place it — the container's slots do the
 * placing, and a dock it mounted inside the viewport (ride) makes
 * `closest(".hk-scroll-dock")` true, which is how a carrier knows to stop
 * publishing shell-level clearance for it.
 *
 * Surfaces:
 *   - `glass` (default): translucent surface + backdrop blur.
 *   - `solid`: opaque, no blur — for moving canvases (WebGL scenes)
 *     where per-frame backdrop re-sampling is expensive.
 *
 * Pointer-events contract: the anchored box is transparent to canvas
 * gestures (pointer-events: none); the surface catches them.
 */
const HkDockBar = defineComponent({
  name: "HkDockBar",
  props: {
    /** Which plane carries the dock: a compass anchor (4 edges + 4
     *  corners, `page` being the south edge), or a host plane
     *  (in-flow). */
    anchor: { type: String as PropType<HkDockBarAnchor>, default: "page" },
    /** Surface finish: glass (blur) or solid (moving canvas). */
    surface: { type: String as PropType<HkDockBarSurface>, default: "glass" },
    /** CSS width of the surface; undefined = shrink-wrap content. */
    width: { type: String, default: undefined },
    /** CSS max-width of the surface (content caps, e.g. minimap clearance). */
    maxWidth: { type: String, default: undefined },
    /** CSS max-height of the surface; defaults to a viewport-aware cap
     *  on the vertical side anchors (left / right), none elsewhere. */
    maxHeight: { type: String, default: undefined },
    /** CSS padding override; defaults to the shared chrome rhythm. */
    padding: { type: String, default: undefined },
    /** CSS length of this dock's edge gap (a larger-than-default dock
     *  passes e.g. `1.5rem`); inline `--hk-dock-gap`, which the sheet
     *  resolves per edge through `--hk-dock-gap-<edge>` →
     *  `--hk-dock-inset` → default. Leave unset to inherit the host's
     *  value (the foundation 16px when nothing overrides it). */
    gap: { type: String, default: undefined },
  },
  setup(props, { slots }) {
    const style = computed(() => {
      const s: Record<string, string> = {};
      if (props.width) s["--dock-width"] = props.width;
      if (props.maxWidth) s["--dock-max-width"] = props.maxWidth;
      if (props.maxHeight) s["--dock-max-height"] = props.maxHeight;
      if (props.padding) s["--dock-padding"] = props.padding;
      if (props.gap) s["--hk-dock-gap"] = props.gap;
      return s;
    });

    return () => (
      <section
        class="hk-dock-bar"
        data-anchor={props.anchor}
        data-surface={props.surface}
        style={style.value}
      >
        <div class="hk-dock-bar-surface">{slots.default?.()}</div>
      </section>
    );
  },
});

export default HkDockBar;
export { HkDockBar };
