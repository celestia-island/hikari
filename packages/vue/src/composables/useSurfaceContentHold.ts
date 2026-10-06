import { computed, watch, type ComputedRef } from "vue";

import type { SurfacePhase } from "../runtime/surfaceMachine";

/**
 * useSurfaceContentHold — keep a surface's last live content on screen
 * for the whole close fold.
 *
 * Consumers routinely tear down the very state that feeds a window's body
 * the moment its v-model flips false (clear-on-close watchers, store
 * resets, socket disconnects). Without a hold, the leave transition then
 * plays on an emptied shell: the frame collapses to its chrome BEFORE the
 * fold starts (chest TodoLogModal, 2026-09-16 field report — the 697px
 * conversation window became a 200px stub in the same tick as the close).
 *
 * While the machine is in a closing phase this serves the most recent
 * live-rendered children instead of re-invoking the slots, so the fold
 * always plays over the content the user was actually looking at. Vue's
 * patch skips identical vnode references, so the held DOM is never
 * re-patched during the close; child components with their own store
 * subscriptions may still self-update.
 *
 * ⚠️ CONTRACT for bodies under this hold (the 2026-10-06 chest crash:
 * `TypeError: Cannot read properties of null (reading 'content')` in a
 * report window's close fold): a held child that subscribed to the body's
 * reactive reads re-renders with the FROZEN slot closures, so any slot
 * body that re-reads a live ref at invocation time sees the host's
 * teardown null and throws. The "self-updates are harmless" claim the
 * original comment made is wrong in exactly that case. Bodies must render
 * a per-render SNAPSHOT of their nullable state (read it once in the
 * render function, hand the captured value to every deferred closure) —
 * never re-read the live ref inside a slot or callback the fold can
 * re-run. (The failure mode under repair remains content VANISHING; a
 * throwing deferred read is the second, sharper failure mode.)
 *
 * The hold releases the moment the surface leaves a closing phase: a
 * reopen interrupt (closing → openingFrom) serves live slots again, and
 * `closed` drops the cache so a closed surface retains nothing.
 */
export function useSurfaceContentHold(phase: ComputedRef<SurfacePhase>) {
  const closing = computed(
    () => phase.value === "closingFrom" || phase.value === "closingTo",
  );

  let held: unknown = null;

  // A closed surface renders nothing — the cache would only pin a dead
  // vnode tree. Drop it on the closed edge.
  watch(phase, (p) => {
    if (p === "closed") held = null;
  });

  /**
   * Wrap one render-region producer: live while opening/open, frozen
   * while closing. The first closing render falls through to live
   * production when no snapshot exists (the surface opened directly into
   * a close is not a real path, but the guard keeps the contract total).
   */
  function hold<T>(produce: () => T): T {
    if (closing.value) {
      if (held !== null) return held as T;
      return produce();
    }
    const next = produce();
    held = next;
    return next;
  }

  return { hold, closing };
}
