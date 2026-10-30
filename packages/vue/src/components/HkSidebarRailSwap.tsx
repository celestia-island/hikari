import { defineComponent } from "vue";

import HkCrossfade from "./HkCrossfade";

import "./HkSidebarRail.scss";

/**
 * HkSidebarRailSwap — the rail/full CONTENT handoff (2026-10-30).
 *
 * THE DEFECT this closes: a rail <-> expanded flip animates the panel's
 * `width` (the slide lever) while the density dress (`[data-rail]` /
 * the slot's scoped state) flips INSTANTLY. The single mounted body is
 * therefore re-laid-out at the ANIMATING panel width — expanding mounts
 * full-width rows inside a still-56px panel (labels wrap and ellipsize,
 * then relax as the panel grows: the reported "squeezed" content) and
 * collapsing snaps rows to icon tiles that glide through the still-wide
 * panel. Both read as the content being crushed for the transition's
 * ~300ms, even though nothing is wrong before or after it.
 *
 * THE CONTRACT (user direction 2026-10-30): during the handoff the
 * content keeps its ORIGINAL width and the clip does the windowing
 * (`overflow: hidden` — `.hk-sidebar-rail-clip`, already in the kit),
 * and the old and new generations exchange through an OPACITY dissolve —
 * the SAME primitive tab panels swap through (HkCrossfade via
 * HkTransitionContainer; the paneSwap contract's standard mechanism, so
 * this component composes it rather than inventing a bespoke fade).
 *
 * Per generation:
 * - the generation wrapper is PINNED at its own width (`railWidth` /
 *   `expandedWidth` inline) and anchored at the docked inline-start
 *   edge, so neither generation ever reflows while the panel animates;
 * - the swap host itself NEVER stretches to the animating clip width
 *   (HkSidebarRail.scss: shrink-to-fit at the widest generation) — the
 *   "original content width" guarantee is structural, not per-frame;
 * - the generation carries `data-rail` while the rail density is
 *   active, so hosts scope their density dress to the GENERATION, never
 *   to the host root (a root-level attribute flips with the state and
 *   would restyle the frozen leaving generation mid-dissolve);
 * - the leaving generation is FROZEN at its last render (Vue keeps the
 *   keyed leaving item unpatched) and drops pointer events for the
 *   dissolve (HkCrossfade's leave rule), so the dead copy can neither
 *   update nor intercept clicks.
 *
 * Slot: the default slot receives `{ rail }` — render the body as a
 * function of it. The ENTERING generation is invoked with the new value;
 * the LEAVING one keeps whatever it last rendered (per-generation density
 * by construction). Hosts that ignore the param and close over their own
 * state get the same freeze for free — but the param is the sanctioned
 * channel because it also drives per-generation branching (icon hints,
 * aria labels) that CSS cannot express.
 *
 * Trade-offs (documented, accepted): each flip MOUNTS the entering
 * generation fresh, exactly like a tab-panel swap —
 * - a scrolled sidebar body starts the entering copy at the top, and
 *   uncontrolled state inside the slot (hover, DOM-local widget state)
 *   does not carry over. Same-family precedent (HkTabs panels, admin
 *   views); rail flips are rare, and preserving scroll across a width
 *   change whose row heights differ would map positions, not restore
 *   them. A MENU FOLD is the documented exception, and it is not this
 *   component's doing: HkFaceShell provides the group-fold store ABOVE
 *   it (known-live-issues #43), so HkMenu's user-toggled groups are read
 *   by every generation instead of remounting back to their defaults. A
 *   host with slot-local state that must survive a flip lifts it the same
 *   way — a provide/inject store above the swap, never an instance ref
 *   inside the slot. A peek OPEN also hands hover to the full row under
 *   the resting pointer without user intent — inherent to any dissolve.
 * - FOCUS: when the leaving generation unmounts at the end of the
 *   dissolve, focus inside it (a nav row focused in an open peek)
 *   drops to <body> — the sharpest edge is Escape-closing a peek from
 *   a focused row, which also drops the host's :focus-within (the
 *   toggle's keyboard reveal) until the next Tab. Hosts that need a
 *   softer landing can refocus the toggle from the peek-closer path.
 *
 * Reduced motion: HkCrossfade keeps a short opacity exchange (a fade
 * carries no movement) while the kit's sheets kill the width slides —
 * the handoff degrades to a quick dip, never a squeeze.
 */
export default defineComponent({
  name: "HkSidebarRailSwap",
  props: {
    /** Which generation is active: true = the icon rail (the collapsed
     *  density), false = the full sidebar (including a peek). */
    rail: { type: Boolean, default: false },
    /** Pinned width of the RAIL generation. The host's collapsed-width
     *  token (HkSidebar's `collapsedWidth`, the shell's
     *  `sidebarCollapsedWidth`, wowsp's 56px). */
    railWidth: { type: String, default: "56px" },
    /** Pinned width of the EXPANDED generation. The host's full sidebar
     *  width token — a CSS length or a var() reference. */
    expandedWidth: { type: String, default: "280px" },
  },
  setup(props, { slots }) {
    return () => (
      // The class rides HkCrossfade's host (Vue class fallthrough), so
      // HkSidebarRail.scss can size the swap INSIDE the clip without a
      // second wrapper element.
      <HkCrossfade class="hk-sidebar-rail-swap" swapKey={props.rail ? "rail" : "full"} tag="div">
        <div
          class="hk-sidebar-rail-generation"
          data-rail={props.rail || undefined}
          style={{ width: props.rail ? props.railWidth : props.expandedWidth }}
        >
          {slots.default?.({ rail: props.rail })}
        </div>
      </HkCrossfade>
    );
  },
});
