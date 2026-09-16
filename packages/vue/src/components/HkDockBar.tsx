import { computed, defineComponent, type PropType } from "vue";

import "./HkDockBar.scss";

export type HkDockBarAnchor =
  | "page"
  | "plane"
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
 * Anchors:
 *   - `page`  (default): absolute bottom-center of the nearest positioned
 *     ancestor, `--hk-dock-inset` above its content floor.
 *   - `plane`: in-flow — the host provides the plane (e.g. a fixed
 *     footer band); this container centers the surface horizontally.
 *   - `top-left` / `top-right` / `bottom-left` / `bottom-right`:
 *     absolute corner attachment with the same inset, for pagers,
 *     toolbars and HUD panels that live off-center.
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
    /** Which plane carries the dock: page (bottom-center), a host plane
     *  (in-flow), or one of the four corners. */
    anchor: { type: String as PropType<HkDockBarAnchor>, default: "page" },
    /** Surface finish: glass (blur) or solid (moving canvas). */
    surface: { type: String as PropType<HkDockBarSurface>, default: "glass" },
    /** CSS width of the surface; undefined = shrink-wrap content. */
    width: { type: String, default: undefined },
    /** CSS max-width of the surface (content caps, e.g. minimap clearance). */
    maxWidth: { type: String, default: undefined },
    /** CSS padding override; defaults to the shared chrome rhythm. */
    padding: { type: String, default: undefined },
  },
  setup(props, { slots }) {
    const style = computed(() => {
      const s: Record<string, string> = {};
      if (props.width) s["--dock-width"] = props.width;
      if (props.maxWidth) s["--dock-max-width"] = props.maxWidth;
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
