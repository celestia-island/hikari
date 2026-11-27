/**
 * HkDirectionalSwap — the state-keyed, DIRECTION-AWARE content swap.
 *
 * The sibling of HkCrossfade, for the one job a pure dissolve cannot
 * express: a swap where the reader moved FORWARD or BACK, and the motion
 * should say so. Panes slide in from one side and out to the other while
 * they cross-fade — the vocabulary a step flow, a wizard, an onboarding
 * carousel and a source/preview toggle all speak.
 *
 * Why a separate component and not a prop on HkCrossfade: that component's
 * contract is "pure opacity, no transform, EVER" — its consumers (sidebar
 * rail swap, login steps, tabs, settings) rely on the dissolve never
 * translating anything, because a translated live region is a different
 * layout. Adding motion there would silently change every one of them.
 *
 * Contracts this carries, all of them learned by the family's own swaps:
 *
 *  - CONCURRENT, IN ONE CELL. Old and new occupy the same grid cell
 *    (HkCrossfade's geometry), so the surface keeps the taller
 *    generation's height for the whole exchange — a swap can never
 *    collapse the page mid-animation. No `mode="out-in"`: that would
 *    reintroduce an exit blank.
 *  - DIRECTION IS DATA, NOT A CLASS THE HOST HAS TO REMEMBER. `direction`
 *    flips the travel axis per swap: forward enters from the end edge and
 *    leaves through the start edge; back mirrors. RTL mirrors again (the
 *    stylesheet flips on `[dir="rtl"]`).
 *  - THE LEAVING COPY IS DEAD CONTENT. It gets `inert` + `aria-hidden` for
 *    the dissolve, so it leaves the tab order and the accessibility tree —
 *    a frozen duplicate of a pane is otherwise reachable by Tab and by a
 *    screen reader's virtual cursor.
 *  - REDUCED MOTION KEEPS THE FADE, DROPS THE TRAVEL. Translation is the
 *    part motion-sensitive readers ask to be spared; a short opacity
 *    exchange carries the change of state without it. (`HkPhaseTransition`
 *    precedent.)
 *  - CLIENT-ONLY. It measures nothing, but its Transition runs on the
 *    client; SSR renders the first generation only, which is the no-JS
 *    baseline hosts already ship.
 *  - A STALL WATCHDOG, same shape as HkCrossfade's: if the browser wedges
 *    the Transition engine (rAF frozen), the frozen leaving item is swept
 *    and the wrapper is dropped so keys apply synchronously from then on.
 */

import { defineComponent, onBeforeUnmount, ref, Transition, watch, type PropType, type VNode } from "vue";

import { useReportedTransition } from "../composables/useReportedTransition";
import "./HkDirectionalSwap.scss";

/** Travel distance, CSS px. Deliberately small: this is a change of
 *  position, not a page slide — 24px (the step flow's value) reads as
 *  motion without dragging attention off the content. Hosts override via
 *  `--hk-swap-travel`. */
const DEFAULT_TRAVEL_PX = 24;

/** The watchdog's window: long enough that a healthy swap (one duration,
 *  eased out) has certainly finished, short enough that a reader never
 *  stares at a wedged surface. */
const WATCHDOG_MS = 1200;

/** How long the animation bus must consider this component busy; the
 *  watchdog and the bus disagree on purpose (the bus follows the nominal
 *  duration, the watchdog waits out the worst case). */
const REPORT_MS = 400;

/** Which way the reader moved. See the module note. */
export type SwapDirection = "forward" | "back";

/**
 * The direction a key change implies, given the two ends' positions in the
 * host's own sequence. Pure, so a host can pin it without a DOM.
 *
 * Unknown positions (either key absent from `order`) resolve FORWARD: a
 * content swap that is not a step (a tab, a mode toggle) still wants a
 * consistent, repeatable direction rather than a flicker between two.
 */
export function resolveSwapDirection(
  order: ReadonlyArray<string | number>,
  previous: string | number,
  next: string | number,
): SwapDirection {
  const a = order.indexOf(previous);
  const b = order.indexOf(next);
  if (a < 0 || b < 0) return "forward";
  return b < a ? "back" : "forward";
}

export default defineComponent({
  name: "HkDirectionalSwap",
  props: {
    /** Identity of the content on stage; changing it starts the swap. */
    swapKey: { type: [String, Number] as PropType<string | number>, required: true },
    /** Travel direction of THIS swap. Hosts that own a sequence can derive
     *  it with `resolveSwapDirection`; a plain toggle passes `"forward"`. */
    direction: {
      type: String as PropType<SwapDirection>,
      default: "forward",
    },
    /** Travel axis. `horizontal` (the default) is the reading-direction
     *  vocabulary: forward enters from the end edge. `vertical` is for
     *  stacked surfaces (a wizard moving down a page). */
    axis: {
      type: String as PropType<"horizontal" | "vertical">,
      default: "horizontal",
    },
    /** Exchange duration, ms. Family default 300. */
    duration: { type: Number, default: 300 },
    /** Travel distance, px. */
    travel: { type: Number, default: DEFAULT_TRAVEL_PX },
    /** Drop the Transition wrapper entirely (synchronous key swaps) — the
     *  escape a host uses when it knows the engine is wedged, and what the
     *  watchdog switches to on its own. */
    disabled: { type: Boolean, default: false },
    tag: { type: String, default: "div" },
  },
  emits: {
    /** Fired once the exchange settles — hosts forward this to their own
     *  scrollers/focus management, the HkTransitionContainer contract. */
    swap: (_payload: { key: string | number; previous: string | number; direction: SwapDirection }) => true,
  },
  setup(props, { slots, emit }) {
    const hostRef = ref<HTMLElement | null>(null);
    // Set when the watchdog had to unwedge the engine; the render then
    // drops the Transition so keys apply synchronously until the next swap
    // re-arms it (same one-tick recovery as HkCrossfade).
    const suppress = ref(false);

    const report = useReportedTransition(() => REPORT_MS + props.duration);
    let pending = 0;
    const armReport = (): void => {
      pending += 1;
      report.run();
    };
    const settleReport = (): void => {
      pending = Math.max(0, pending - 1);
      if (pending === 0) report.cancel();
    };

    let previousKey: string | number = props.swapKey;

    /** Mark a leaving item inert (out of the tab order and the a11y tree)
     *  for the dissolve; restore on a cancelled leave so a live copy is
     *  never left inert. */
    function setLeavingInert(el: Element | null | undefined, on: boolean): void {
      if (!el) return;
      if (on) {
        el.setAttribute("inert", "");
        el.setAttribute("aria-hidden", "true");
        return;
      }
      el.removeAttribute("inert");
      el.removeAttribute("aria-hidden");
    }

    let watchdog: ReturnType<typeof setTimeout> | null = null;

    function armWatchdog(): void {
      if (watchdog !== null) clearTimeout(watchdog);
      watchdog = setTimeout(onWatchdog, WATCHDOG_MS + props.duration);
    }

    function onWatchdog(): void {
      watchdog = null;
      const host = hostRef.value;
      if (!host) return;
      let wedged = false;
      for (const el of Array.from(host.querySelectorAll<HTMLElement>(":scope > .hk-dswap-item"))) {
        const frozenLeave = el.classList.contains("hk-dswap-leave-active")
          || el.classList.contains("hk-dswap-leave-from");
        el.classList.remove(
          "hk-dswap-enter-active",
          "hk-dswap-enter-from",
          "hk-dswap-enter-to",
          "hk-dswap-leave-active",
          "hk-dswap-leave-from",
          "hk-dswap-leave-to",
        );
        if (frozenLeave && el.dataset.swapKey !== String(props.swapKey)) {
          el.remove();
          wedged = true;
        }
      }
      if (wedged) suppress.value = true;
    }

    watch(
      () => props.swapKey,
      (next) => {
        suppress.value = false;
        const from = previousKey;
        previousKey = next;
        // Settle after the exchange; the emit carries the direction so the
        // host can hand scroll/focus the same vocabulary.
        setTimeout(() => {
          emit("swap", { key: next, previous: from, direction: props.direction });
        }, motionDuration() + 40);
      },
    );

    /** Reduced motion: zero the travel (the fade stays, shortened by the
     *  stylesheet). Read per swap so an OS setting changed mid-session is
     *  honoured on the next exchange rather than at boot. */
    function motionDuration(): number {
      if (typeof window === "undefined") return props.duration;
      const reduced =
        typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const switchedOff = document.documentElement.dataset.cssAnimations === "0";
      return reduced || switchedOff ? 0 : props.duration;
    }

    onBeforeUnmount(() => {
      if (watchdog !== null) clearTimeout(watchdog);
      watchdog = null;
    });

    function item(): VNode {
      return (
        <div
          key={String(props.swapKey)}
          class="hk-dswap-item"
          data-swap-key={String(props.swapKey)}
        >
          {slots.default?.()}
        </div>
      ) as VNode;
    }

    return () => {
      const Tag = props.tag as "div" | "section" | "main" | "aside";
      const hostProps = {
        ref: hostRef,
        class: "hk-dswap",
        "data-direction": props.direction,
        "data-axis": props.axis,
        style: {
          "--hk-swap-duration": `${motionDuration()}ms`,
          "--hk-swap-travel": `${motionDuration() === 0 ? 0 : props.travel}px`,
        } as Record<string, string>,
      };

      if (props.disabled || suppress.value) {
        return (
          <Tag {...hostProps} data-swap-disabled="">
            {item()}
          </Tag>
        );
      }

      return (
        <Tag {...hostProps}>
          {/* No `mode`: enter and leave run concurrently in the same cell
            (see the module note). The classes are direction-scoped by the
            host's data attributes; the stylesheet owns the geometry. */}
          <Transition
            name="hk-dswap"
            onBeforeEnter={() => {
              armReport();
              armWatchdog();
            }}
            onAfterEnter={settleReport}
            onEnterCancelled={settleReport}
            onBeforeLeave={(el: Element) => {
              setLeavingInert(el, true);
              armReport();
              armWatchdog();
            }}
            onAfterLeave={settleReport}
            onLeaveCancelled={(el: Element) => {
              setLeavingInert(el, false);
              settleReport();
            }}
          >
            {item()}
          </Transition>
        </Tag>
      );
    };
  },
});
