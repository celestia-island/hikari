import { defineComponent, type PropType } from "vue";

import "./HkEdgeGlow.scss";

/**
 * The four PHYSICAL edges a glow band can be laid on — screen sides, never
 * logical inline/block ones.
 *
 * Physical on purpose: the consumers that need this painter are scroll
 * affordances, and HkScrollContainer already resolves direction itself (it
 * maps its sensed inline start/end onto the physical side from the COMPUTED
 * `direction` in the same pass it derives the bands). A logical
 * `inline-start` edge here would make that mapping direction-truth the
 * component cannot see, and would silently disagree with the band geometry
 * whenever `[dir]` sits somewhere the selector misses. The bands' own spans
 * are direction-neutral (`inset-inline` / `inset-block`), so no RTL slot swap
 * is involved either way.
 */
export type EdgeGlowEdge = "top" | "bottom" | "left" | "right";

/** The canonical order of `edges` in the DOM — also the recovery point for
 *  stray values a JS consumer can hand a TS-typed prop without a checker. */
const EDGE_ORDER: readonly EdgeGlowEdge[] = ["top", "bottom", "left", "right"];

/** Keep the requested bands (deduplicated, canonically ordered). A property
 *  array crosses the JS boundary untyped, so an unknown edge name must be
 *  dropped instead of rendering a band no rule can style. */
function normalizeEdges(edges: EdgeGlowEdge[]): EdgeGlowEdge[] {
  const seen = new Set(edges);
  return EDGE_ORDER.filter((edge) => seen.has(edge));
}

/**
 * HkEdgeGlow — the library's ONE edge-glow painter: a feathered gradient
 * band laid along one or more edges of its positioned parent.
 *
 * It exists because two surfaces need the same effect and one of them was
 * already the visual reference. HkScrollContainer's `selectionHint` lit "the
 * selected row lies beyond this edge" through a pair of ::before/::after
 * painters compiled into its own sheet, and the scroll container's overflow
 * glow (2026-11-08) needs the identical band on the edges that still hide
 * content. Keeping the recipe in two sheets would have made the geometry,
 * feather curve and colour one edit-in-two-places away from drifting, so the
 * painter moved here as a mountable component: HkScrollContainer renders it
 * for both features (one static, one breathing), and any host that wants the
 * effect — a clipped chart, a carousel, a fixed header edge — mounts it
 * directly instead of re-authoring pseudo-element blocks.
 *
 * Geometry (every knob overridable per instance): `size` is the band's
 * thickness measured from the edge inward, `feather` is how far the band's
 * two INLINE ends dissolve, and `color` is the gradient's ink (opaque at the
 * edge, transparent at the inward stop). The end feather is a MASK, not a
 * second gradient: one mask axis keeps engines without `mask-composite`
 * exact, the same reasoning HkScrollContainer.scss records for its fade
 * (Android WebViews below Chromium 120 fall back to additive composition,
 * where two opaque layers union to fully opaque).
 *
 * Decoration only: `aria-hidden`, `pointer-events: none`, no focusable
 * content, and no layout of its own (`position: absolute; inset: 0`). Mount
 * it inside a positioned ancestor — typically as the last child, so it paints
 * above the scrolling content; its `z-index: 2` keeps it UNDER the shared
 * overlay-scrollbar chrome (`--hk-z-scrollbar`, 10) and the jump-back FAB
 * (11), which must stay interactive.
 *
 * `animate` adds the shared breathe (opacity 0.62 -> 1 -> 0.62 over 2.6s
 * ease-in-out, an infinite CSS loop). The loop is registered in
 * animation/registerAnimations.ts — the host's global animation switch pauses
 * it — and the sheet disables it under `prefers-reduced-motion: reduce`. The
 * static default is the selection hint's contract: a hint that pulses draws
 * attention to the wrong thing (the selection is somewhere else), so the
 * settings rail's painter stays still.
 *
 * Usage (the host must be positioned — the root is `position: absolute`):
 *
 * ```tsx
 * // .hk-example-scroller { position: relative; overflow: hidden }
 * <div class="hk-example-scroller">
 *   <div class="hk-example-scroller-viewport">…</div>
 *   <HkEdgeGlow edges={["left", "right"]} animate />
 * </div>
 * ```
 */
export default defineComponent({
  name: "HkEdgeGlow",
  props: {
    /** Which edges glow. Physical sides (see {@link EdgeGlowEdge}); the
     *  default lights the reading flow's two horizontal edges. Bands render
     *  in canonical top/bottom/left/right order regardless of the order the
     *  caller lists, so the DOM is stable across calls. An empty array mounts
     *  the (inert) root with no bands — features that toggle a band keep the
     *  same subtree instead of mounting/unmounting the painter. */
    edges: {
      type: Array as PropType<EdgeGlowEdge[]>,
      default: () => ["top", "bottom"] as EdgeGlowEdge[],
    },
    /** Breathe forever. Off by default: a static band is a STATE hint (the
     *  selected row is beyond this edge), an animated one is ambient chrome
     *  (content is hidden past this edge while a strip scrolls). */
    animate: { type: Boolean, default: false },
    /** Band thickness along the edge normal. A length or any CSS expression
     *  resolving to one — a consumer's own knob is the usual form
     *  (`var(--my-glow-size, var(--space-24))`). */
    size: { type: String, default: "var(--space-24)" },
    /** How far the band's two INLINE ends dissolve (the mask feather), in
     *  the same value space as `size`. 0 restores hard band ends. */
    feather: { type: String, default: "var(--space-24)" },
    /** The gradient's ink at the edge; it fades to transparent inward. Any
     *  CSS color — default is the primary token at 32%, the settings rail's
     *  shipped weight. */
    color: { type: String, default: "rgb(var(--color-primary) / 32%)" },
  },
  setup(props) {
    return () => (
      <div
        class="hk-edge-glow"
        aria-hidden="true"
        data-animate={props.animate ? "true" : undefined}
        style={{
          "--hk-edge-glow-size": props.size,
          "--hk-edge-glow-feather": props.feather,
          "--hk-edge-glow-color": props.color,
        }}
      >
        {normalizeEdges(props.edges ?? []).map((edge) => (
          <span key={edge} class="hk-edge-glow-band" data-edge={edge} />
        ))}
      </div>
    );
  },
});
