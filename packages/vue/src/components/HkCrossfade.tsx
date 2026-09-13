import { defineComponent, onBeforeUnmount, ref, Transition, watch, type PropType } from "vue";

import { useReportedTransition } from "../composables/useReportedTransition";

import "./HkCrossfade.scss";

/** Swap-stall watchdog budget. Must sit above ANY healthy completion of the
 *  dissolve (--duration-normal 0.3s; 0s under reduced motion or the global
 *  animation switch) so the sweep only ever bites a genuinely stalled swap.
 *  Exported for tests and budget-pinning. */
export const CROSSFADE_WATCHDOG_MS = 450;

/** Animation-bus report window — covers the watchdog budget so JS
 *  choreography reacting to a swap outlives the CSS work under every
 *  timing, including a stalled one. */
const REPORT_MS = CROSSFADE_WATCHDOG_MS;

/**
 * HkCrossfade — same-position simultaneous dissolve for view/mode swaps.
 *
 * The library-level primitive for "the old content fades out WHILE the new
 * content fades in, in place": a default-mode (NO `mode` prop) `<Transition>`
 * whose enter and leave items share ONE grid cell, so the two generations
 * stack at the same geometry for the duration of the dissolve — no exit
 * blank phase (the `out-in` gap of HkPhaseTransition/HkStepFlow), no
 * side-by-side reflow (a bare default-mode Transition), and no height
 * collapse while both are mounted (the host stays as tall as the taller
 * item until the leave completes). This is the height-safe generalization
 * of HkPickerPane's fixed stage + absolute leave: it needs no known stage
 * size, so whole pages (admin views, auth cards) can swap through it.
 *
 * Contract:
 * - `swapKey` is the identity of the content on stage. The component owns
 *   the keyed item wrapper (like HkPhaseTransition owns its key) so the
 *   watchdog can tell stale items from the active one; rendering with the
 *   same value swaps nothing.
 * - Pure opacity — no transform, ever. Same-position means same-position.
 *   Both sides run `--duration-normal` so the exchange is a true dissolve;
 *   both ease out (fast start), which keeps the incoming (top) layer's
 *   opacity ahead of the outgoing one's decay and stops the composite from
 *   dipping toward the background mid-swap.
 * - The leaving item drops pointer events: it is dead content and must not
 *   intercept clicks while it dissolves under the incoming one.
 * - `appear` dissolves the initially rendered item in; off by default —
 *   first paint should never animate (view shells, restored state).
 * - `disabled` renders the active item bare (synchronous swap, no watchdog):
 *   the test escape hatch and the watchdog's degraded render path.
 * - Reduced motion keeps the opacity exchange at `--duration-fast` (a fade
 *   carries no movement — HkPhaseTransition precedent); hosts driving the
 *   global animation switch (`html[data-css-animations="0"]`) already pin
 *   these transitions via theme.scss.
 * - Every swap is REPORTED to the runtime animation bus
 *   (`useReportedTransition`, refcounted across the concurrent enter+leave)
 *   so JS choreography reacting to the swap is not cut short by the CSS
 *   work ending early.
 * - The swap-stall watchdog bounds the rAF-starvation wedge (occluded or
 *   backgrounded webview): Vue's Transition engine is rAF-gated, so a
 *   starved swap freezes the leaving item on top of the new one (field
 *   report 2026-09 in chest's ModeMorphTabs — the design this watchdog
 *   inherits, alongside the surfaceMachine AXIOM A2 deadline rule). The
 *   450ms budget sits above ANY healthy completion, so on healthy surfaces
 *   the sweep fires into an already-settled DOM and is a no-op. After a
 *   real stall it strips the frozen transition classes, removes the stale
 *   item Vue can no longer unmount, and degrades to synchronous rendering
 *   until the next `swapKey` change re-arms the Transition fresh.
 */
export default defineComponent({
  name: "HkCrossfade",
  props: {
    swapKey: { type: [String, Number] as PropType<string | number>, required: true },
    tag: { type: String, default: "div" },
    appear: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
  },
  setup(props, { slots }) {
    const hostRef = ref<HTMLElement | null>(null);
    // Set after a watchdog sweep proved the Transition engine wedged; the
    // render drops the Transition wrapper so keys apply synchronously until
    // the next swap re-arms it (a one-tick toggle re-enters the wedged
    // internal state otherwise — ModeMorphTabs lesson).
    const suppress = ref(false);

    // ── Animation-bus participation ──────────────────────────────────
    // One swap runs an enter AND a leave concurrently; refcount them so
    // the shared track stays armed until BOTH settle (HkListTransition
    // pattern).
    const report = useReportedTransition(REPORT_MS);
    let pending = 0;
    const armReport = () => {
      pending++;
      report.run();
    };
    const settleReport = () => {
      pending = Math.max(0, pending - 1);
      if (pending === 0) report.cancel();
    };

    // ── Swap-stall watchdog ──────────────────────────────────────────
    let watchdog: ReturnType<typeof setTimeout> | null = null;

    function armWatchdog(): void {
      // Re-arm per swap event (enter or leave start); a healthy swap lets
      // the timer fire into a settled DOM, where the sweep is a no-op.
      if (watchdog !== null) clearTimeout(watchdog);
      watchdog = setTimeout(onWatchdog, CROSSFADE_WATCHDOG_MS);
    }

    function sweepFrozenClasses(el: Element): boolean {
      const frozenLeave = el.classList.contains("hk-crossfade-leave-active")
        || el.classList.contains("hk-crossfade-leave-from");
      el.classList.remove(
        "hk-crossfade-enter-active",
        "hk-crossfade-enter-from",
        "hk-crossfade-enter-to",
        "hk-crossfade-leave-active",
        "hk-crossfade-leave-from",
        "hk-crossfade-leave-to",
      );
      return frozenLeave;
    }

    function onWatchdog(): void {
      watchdog = null;
      const host = hostRef.value;
      if (!host) return;
      let wedged = false;
      for (const el of Array.from(host.querySelectorAll<HTMLElement>(":scope > .hk-crossfade-item"))) {
        const frozenLeave = sweepFrozenClasses(el);
        // A stale item still holding a leave class is one Vue's rAF-gated
        // engine can never unmount — remove it by hand and mark the engine
        // wedged so this and future swaps render synchronously.
        if (frozenLeave && el.dataset.crossfadeKey !== String(props.swapKey)) {
          el.remove();
          wedged = true;
        }
      }
      if (wedged) suppress.value = true;
    }

    watch(() => props.swapKey, () => {
      // Fresh swap: restore the Transition (the wedged one was discarded
      // with the suppressed render). The watchdog re-arms from the
      // beforeEnter/beforeLeave hooks of the new Transition instance.
      suppress.value = false;
    });
    onBeforeUnmount(() => {
      if (watchdog !== null) {
        clearTimeout(watchdog);
        watchdog = null;
      }
    });

    return () => {
      const Tag = props.tag as "div" | "section" | "main" | "aside";
      const item = () => (
        <div
          key={props.swapKey}
          class="hk-crossfade-item"
          data-crossfade-key={String(props.swapKey)}
        >
          {slots.default?.()}
        </div>
      );

      if (props.disabled || suppress.value) {
        // Watchdog recovery / explicit opt-out: no Transition wrapper, so
        // the key swap applies synchronously even with rAF frozen.
        return (
          <Tag ref={hostRef} class="hk-crossfade">
            {item()}
          </Tag>
        );
      }

      return (
        <Tag ref={hostRef} class="hk-crossfade">
          {/* Deliberately NO `mode`: enter and leave run CONCURRENTLY in
            the same grid cell — that is the whole point of this component.
            A `mode="out-in"` here would reintroduce the exit blank phase;
            `mode="in-out"` would double-stack full-opacity content. */}
          <Transition
            name="hk-crossfade"
            appear={props.appear}
            onBeforeEnter={() => { armReport(); armWatchdog(); }}
            onAfterEnter={settleReport}
            onEnterCancelled={settleReport}
            onBeforeLeave={() => { armReport(); armWatchdog(); }}
            onAfterLeave={settleReport}
            onLeaveCancelled={settleReport}
          >
            {item()}
          </Transition>
        </Tag>
      );
    };
  },
});
