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
 * Anchors — the full eight-way compass (4 edges + 4 corners):
 *   - `page` (default) and `bottom`: absolute bottom-center of the
 *     nearest positioned ancestor (the SOUTH edge), `--hk-dock-inset`
 *     above its content floor. `page` is the 2026-09-02 spelling kept
 *     for existing callers; `bottom` is its compass alias — identical
 *     geometry, pick either.
 *   - `top`: absolute top-center (north edge) with the same inset.
 *   - `left` / `right`: absolute middle of the west / east edge — the
 *     dock runs vertically and is centered with translateY; its surface
 *     gets a viewport-aware default max-height.
 *   - `top-left` / `top-right` / `bottom-left` / `bottom-right`:
 *     absolute corner attachment with the same inset, for pagers,
 *     toolbars and HUD panels that live off-center.
 *   - `plane`: NOT a compass direction — in-flow; the host provides
 *     the plane (e.g. a fixed footer band) and this container centers
 *     the surface horizontally. Use it when the host owns positioning.
 *
 * Relationship to HkScrollContainer: that component's dockTop /
 * dockBottom named slots are the contract for docks that live INSIDE a
 * scrolling region — pinned to the scroll viewport, excluded from the
 * scroll flow. HkDockBar is the carrier for docks that FLOAT over a
 * canvas or page instead. Pick by host: scrolling region →
 * HkScrollContainer dock slots; canvas/page overlay → HkDockBar. Do
 * not nest an HkDockBar inside a scroll viewport expecting pinning.
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
  },
  setup(props, { slots }) {
    const style = computed(() => {
      const s: Record<string, string> = {};
      if (props.width) s["--dock-width"] = props.width;
      if (props.maxWidth) s["--dock-max-width"] = props.maxWidth;
      if (props.maxHeight) s["--dock-max-height"] = props.maxHeight;
      if (props.padding) s["--dock-padding"] = props.padding;
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
