import { defineComponent, ref, type ComponentPublicInstance } from "vue";

import { useRailIconFlight } from "../composables/useRailIconFlight";
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
 *   dissolve (and the leaving item is marked inert, which blurs a
 *   focused descendant), focus inside it would drop to <body> — taking
 *   the host's :focus-within (the toggle's keyboard reveal) with it. The
 *   KIT closes this for rail hosts: useSidebarRail.closePeek (and every
 *   path that funnels through it, including the pointerleave grace close)
 *   hands focus to the toggle when the focused node lived inside the
 *   swapped window (2026-10-31). A bespoke host that drives its own
 *   close paths still owns the handoff.
 * - The leaving generation also carries `inert` + `aria-hidden` for the
 *   dissolve (HkCrossfade), so the frozen copy is neither tabbable nor
 *   announced while the live one fades in.
 *
 * THE ICON FLIGHT (2026-11-02, useRailIconFlight): a pure dissolve
 * cannot show the icons' small horizontal journey into the rail column —
 * both copies fade, nothing moves (user direction: "I can't tell the
 * icon slides slightly left as it collapses"). This component hands the
 * flip to the flight choreographer: icons opted in by HkMenu
 * (`data-flip-icon`) are cloned into a flight layer on THIS host and
 * animated from the leaving rect to the entering one, while the leaving
 * copies hide (`data-flipping` + the leave class) and the rest of the
 * content keeps the plain dissolve. Skipped under reduced motion / the
 * animation switch / no WAAPI / no matching pair — every such case
 * degrades to today's dissolve.
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
     *  `sidebarCollapsedWidth`, wowsp's 56px). The rail row square's
     *  body inline track reads the same width as
     *  `--hk-sidebar-rail-w` — declared by the rail holder (HkSidebar /
     *  HkFaceShell), so a non-default width keeps exact squares. */
    railWidth: { type: String, default: "56px" },
    /** Pinned width of the EXPANDED generation. The host's full sidebar
     *  width token — a CSS length or a var() reference. */
    expandedWidth: { type: String, default: "280px" },
  },
  setup(props, { slots }) {
    // The swap host IS this component's root element — HkCrossfade's
    // host div (class fallthrough). The component ref's $el reaches it
    // without adding a wrapper (the clip's child combinator styles
    // `.hk-sidebar-rail-clip > .hk-sidebar-rail-swap` directly).
    const swapRef = ref<ComponentPublicInstance | null>(null);
    const swapEl = (): HTMLElement | null => (swapRef.value?.$el as HTMLElement | null) ?? null;
    useRailIconFlight(swapEl, () => props.rail, () => (props.rail ? "rail" : "full"));
    return () => (
      // The class rides HkCrossfade's host (Vue class fallthrough), so
      // HkSidebarRail.scss can size the swap INSIDE the clip without a
      // second wrapper element.
      <HkCrossfade ref={swapRef} class="hk-sidebar-rail-swap" swapKey={props.rail ? "rail" : "full"} tag="div">
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
