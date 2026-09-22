import { inject, provide, type InjectionKey } from "vue";

import type { RideEntry } from "../composables/useSizeMorph";

/**
 * Fold-ride registry (2026-09-23, round 14): the channel between a
 * hosting sheet and a descendant choreography that owns elements the
 * sheet's fold must NOT slice.
 *
 * The sheet's size morph sweeps a clip edge over content that sits at the
 * sweep's final LAYOUT geometry, so anything the edge crosses — the title
 * bar, mid-sweep — reads as clipped, and a shrink's atomic re-pin snaps
 * the whole column down at the landing. The morph's `collectRide` option
 * fixes that for elements the HOST knows about (the modal's chrome); a
 * descendant like HkStepFlow owns one more element the host cannot name:
 * the entering step body, which must hold its FINAL position while the
 * block rides (a counter-ride) so the new content never moves as it fades
 * in. It registers that element here at swap start; the host merges the
 * registry's snapshot into the morph's collectRide result.
 *
 * Deliberately a provide/inject channel and NOT a DOM event: the morph
 * collects riders synchronously while STAGING (transitions disabled,
 * pre-flush), and the registration must be readable in that same task
 * without depending on event bubbling direction.
 */
export interface SheetRideRegistry {
  /** Register a rider for the next staged sweep; returns its unregister. */
  register(entry: RideEntry): () => void;
  /** Live registrations, in registration order (host merge order). */
  snapshot(): RideEntry[];
}

export const SHEET_RIDE_KEY: InjectionKey<SheetRideRegistry> =
  Symbol("hk-sheet-ride");

/** Create and provide a registry (sheet-side, called once in setup). */
export function provideSheetRide(): SheetRideRegistry {
  const entries = new Set<RideEntry>();
  const registry: SheetRideRegistry = {
    register(entry) {
      entries.add(entry);
      let alive = true;
      return () => {
        // Idempotent: a swap that never staged a sweep still owes its
        // own teardown exactly once.
        if (!alive) return;
        alive = false;
        entries.delete(entry);
      };
    },
    snapshot() {
      return [...entries];
    },
  };
  provide(SHEET_RIDE_KEY, registry);
  return registry;
}

/** Consume the registry (content-side); null outside a hosting sheet. */
export function useSheetRide(): SheetRideRegistry | null {
  return inject(SHEET_RIDE_KEY, null);
}
