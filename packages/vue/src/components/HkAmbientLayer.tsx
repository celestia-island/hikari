import { defineComponent, type PropType, Teleport } from "vue";

import { ensureHudRoot } from "../overlay/hudRoot";
import "./HkAmbientLayer.scss";

/**
 * HkAmbientLayer — the shared host for always-visible, NON-INTERACTIVE
 * annotations: a slot teleported into hikari's ambient HUD root
 * (`#hk-hud-root`, overlay/hudRoot.ts) so it paints above EVERY popup —
 * the modal backdrop included — without entering the popup manager's
 * window/anchored/tooltip stack.
 *
 * The 2026-11-05 identify defect is the reason this exists: the
 * screen-identify card was teleported to `<body>` with a hand-written
 * `z-index: 5000`, so the modal tree (document band 90000) buried it and
 * the card showed through the scrim as dimmed background. Layer
 * selection is a LIBRARY decision, not a per-consumer number: one HUD
 * root, one band (`--hk-z-hud`), and a single reviewable floor
 * (`--hk-overlay-z-hud`) for layers inside it.
 *
 * Non-interactive by default: the wrapper spans the viewport but lets
 * every pointer through (`pointer-events: none`). Pass
 * `pointerEvents="auto"` only for a HUD that really is clickable (an
 * annotation chip with a dismiss button), and keep its footprint small so
 * it never swallows the page.
 *
 * Usage:
 *
 * ```tsx
 * <HkAmbientLayer>
 *   <div class="hk-recording-dot" />
 * </HkAmbientLayer>
 * ```
 *
 * `zIndex` orders several ambient layers against each other inside the
 * HUD root (default: the base floor). The wrapper never leaves the root,
 * so it cannot be covered by a later-opened modal.
 */
export default defineComponent({
  name: "HkAmbientLayer",
  props: {
    /** Whether the layer accepts pointer input. Default `none` — an
     *  annotation must not block the window it annotates. */
    pointerEvents: {
      type: String as PropType<"none" | "auto">,
      default: "none",
      validator: (value: string) => value === "none" || value === "auto",
    },
    /** Stacking order among ambient layers (larger = nearer the user).
     *  Local to the HUD root, never a document-space number. */
    zIndex: { type: Number, default: 1 },
    /** Accessible name for the layer as a landmark. Omit for purely
     *  decorative hosts; the card inside carries its own status role. */
    label: { type: String, default: undefined },
  },
  setup(props, { slots }) {
    return () => (
      <Teleport to={ensureHudRoot()}>
        <div
          class="hk-ambient-layer"
          data-pointer-events={props.pointerEvents}
          role={props.label ? "region" : undefined}
          aria-label={props.label}
          style={{ zIndex: String(props.zIndex) }}
        >
          {slots.default?.()}
        </div>
      </Teleport>
    );
  },
});
