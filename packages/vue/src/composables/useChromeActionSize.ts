import { computed, onMounted, ref, type ComputedRef } from "vue";

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
 *
 * SSR / FIRST PAINT (2026-11-24, hikari#1531 item 1): the server has no
 * viewport, so the pre-mount answer is the NARROW rung — 28 fits every
 * viewport (the wide 32 is what overflows a 320px phone), so narrow is
 * the safe guess for an unknown one, and a phone's first paint then
 * matches what it keeps after mount (no size swap). A desktop pays one
 * grow-in on mount instead of a shrink — the acceptable direction. This
 * is the documented contract hikari#1531 asks for; hosts that want a
 * different first paint own it above the hook (the docs shell's local
 * `headerActionSize` stays a valid overlay).
 */
export function useChromeActionSize(): ComputedRef<28 | 32> {
  const { isDesktop } = useBreakpoint();
  const mounted = ref(false);
  onMounted(() => {
    mounted.value = true;
  });
  // `?.` — partial breakpoint surfaces exist (test mocks, embedders that
  // pass only what they use); an absent isDesktop reads as the NARROW
  // rung, the safe-fitting choice for an unknown viewport.
  //
  // `!mounted` — SSR and the FIRST CLIENT PASS also read narrow (they have
  // no trustworthy viewport yet: `useBreakpoint`'s server branch answers
  // isDesktop=true unconditionally, which is exactly the 32-at-first-paint
  // swap hikari#1531 documents). Narrow-first means a phone never changes
  // size across hydration, and a desktop grows once on mount instead of
  // shrinking.
  return computed(() => (mounted.value && isDesktop?.value ? 32 : 28));
}
