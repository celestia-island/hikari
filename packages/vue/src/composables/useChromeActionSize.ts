import { computed, type ComputedRef } from "vue";

import { useBreakpoint } from "../runtime/useBreakpoint";

/**
 * The top-right chrome action size ladder (user ruling 2026-10-24):
 * wide screens (≥1024) wear the generous ghost/32 cluster; narrower
 * viewports tighten to ghost/28 so the row fits. ONE source for every
 * header-chrome icon button — the global search and settings buttons,
 * the page filter trigger, the refresh — so the cluster reads as one
 * row of identical chrome on every face.
 *
 * This is the single authority; hand-rolled `isDesktop ? 32 : 28`
 * copies in consumers drifted exactly the way this helper exists to
 * prevent (2026-10-27: the filter triggers stayed at the old flat 28
 * while the header moved to the ladder, and the funnel read as a
 * different button family from its own neighbors).
 */
export function useChromeActionSize(): ComputedRef<28 | 32> {
  const { isDesktop } = useBreakpoint();
  // `?.` — partial breakpoint surfaces exist (test mocks, embedders that
  // pass only what they use); an absent isDesktop reads as the NARROW
  // rung, the safe-fitting choice for an unknown viewport.
  return computed(() => (isDesktop?.value ? 32 : 28));
}
