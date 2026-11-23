import { onBeforeUnmount, onMounted, watch, type Ref } from "vue";

/** Drift (px) small enough to read as "still at rest" — sub-pixel churn
 *  and the 1px rounding of a centered box must not buy a correction. */
const REST_EPSILON_PX = 0.5;

/**
 * One correction step of the anchor loop, pure so tests can pin the
 * arithmetic without a layout engine:
 *
 * `renderedTop` is the element's CURRENT viewport top (transforms
 * included), `anchorTop` the top the block is pinned to, `shift` the
 * translate the wrapper already carries. The returned shift is the one
 * that puts the rendered top back on `anchorTop` in a single step, and
 * the formula is incremental (`shift + delta`) so a partial correction
 * (measurement taken mid-frame) still converges instead of overshooting.
 */
export function nextAnchorShift(
  shift: number,
  renderedTop: number,
  anchorTop: number,
): number {
  return shift + (anchorTop - renderedTop);
}

/** Whether a measured drift is worth a correction (see REST_EPSILON_PX). */
export function needsAnchorCorrection(
  renderedTop: number,
  anchorTop: number,
): boolean {
  return Math.abs(renderedTop - anchorTop) >= REST_EPSILON_PX;
}

/**
 * useAnchoredTop — keep a centered block's TOP EDGE still while its
 * height changes.
 *
 * The problem it exists for (2026-11-24 user report — "the whole card
 * flies up when I go from sign-in to verify-account"): a block that the
 * host centers vertically (`align-items: center`, `place-items: center`,
 * `margin: auto`) is re-centered on EVERY layout pass, so a height morph
 * moves both edges — the top edge climbs by half the growth while the
 * content, anchored to the top, travels with it. The user reads that as
 * the card flying; nothing in CSS can express "grow downward only" for a
 * box whose position is owned by its parent's centering.
 *
 * How it works: a ResizeObserver on `target` fires on size changes (the
 * observer delivers once per frame at most, so a smooth growth arrives as
 * a stream of frames, each corrected before it paints), the element's
 * current viewport top is compared against the top
 * recorded at rest, and the difference is folded into a `translateY` on
 * the SAME element — painting it back onto its resting top. Consequences
 * worth knowing:
 *
 * - It is CLOSED-LOOP, so it needs no knowledge of the host: a
 *   top-anchored layout simply never drifts, the measured delta stays 0
 *   and no transform is ever written (the hook is a no-op there rather
 *   than a second opinion on the layout).
 * - The transform is paint-only: it never feeds back into layout, so the
 *   loop cannot oscillate and the correction is exact after one step.
 * - The shift is kept (not released) when the morph settles: the held
 *   offset is part of the resting arrangement now, and dropping it would
 *   move the block by that offset the next time it re-enters the
 *   measurement path. It therefore ACCUMULATES across swaps, and a
 *   symmetric pair returns it to where it started only when both legs are
 *   measured the same way — the shipped symmetric swaps (account → verify
 *   → account, channel A → B → A) do, verified on the browser rig, but
 *   that is an observation about those swaps, not a theorem: an asymmetric
 *   series can leave a residual offset of at most half the largest height
 *   delta seen so far.
 * - At rest the anchor re-bases to wherever the block actually sits, so a
 *   legitimate re-position (viewport resize, a line above the block
 *   appearing, a late webfont reflow) is adopted instead of being fought.
 * - No ResizeObserver / no layout engine (SSR, jsdom): the hook is a
 *   no-op — a block that never animates never drifts, so there is nothing
 *   to correct.
 */
export interface UseAnchoredTopOptions {
  /** Gate the correction (a surface that is not in its anchored mode). */
  enabled?: () => boolean;
  /** Where the correction goes, in px (0 = no correction active).
   *
   *  Defaults to an inline `transform: translateY(…)` on the target —
   *  right for a host that owns nothing else on that element. A surface
   *  that already animates `transform` (HkModal's open/close ride) or
   *  composes its offset through a CSS custom property supplies its own
   *  writer instead, so the anchor and the surface's own choreography
   *  never fight over one property. */
  apply?: (shiftPx: number) => void;
}

export interface AnchoredTopHandle {
  /** Drop the correction and adopt the element's current top as the new
   *  anchor (a reopen/remount edge). The sink always runs with 0, so a
   *  surface whose offset is not a DOM transform still gets its clear; the
   *  re-base itself is a no-op when the element is gone.
   *
   *  ⚠️ Only call this on a frame at REST: the re-base adopts whatever top
   *  the element has at that instant, so calling it mid-morph pins the
   *  anchor to a transient geometry and the loop then bakes that transient
   *  into the resting position. A host that can be mid-motion (HkModal,
   *  during a height transition) must defer until it settles. */
  reset: () => void;
}

export function useAnchoredTop(
  // `undefined` is accepted alongside `null`: a host ref declared without
  // an initial value (`ref<HTMLElement>()`) reads as undefined until mount.
  target: Ref<HTMLElement | null | undefined>,
  options: UseAnchoredTopOptions = {},
): AnchoredTopHandle {
  let observer: ResizeObserver | null = null;
  /** Translate currently written on the target (px, 0 = none). */
  let shift = 0;
  /** The viewport top the block is pinned to (recorded at rest). */
  let anchorTop = 0;
  let anchored = false;

  function measureTop(): number | null {
    const el = target.value;
    if (!el || typeof el.getBoundingClientRect !== "function") return null;
    const { top } = el.getBoundingClientRect();
    return Number.isFinite(top) ? top : null;
  }

  function applyShift(): void {
    if (options.apply) {
      options.apply(shift);
      return;
    }
    const el = target.value;
    if (!el) return;
    // `translateY(0)` would still create a containing block and a
    // stacking context — write the empty string instead so an anchored
    // block that never drifts stays byte-identical to an unhooked one.
    el.style.transform = shift === 0 ? "" : `translateY(${shift}px)`;
  }

  /** Adopt the block's current resting top as the new anchor (no visual
   *  change: the shift is kept, only the reference moves). */
  function rebase(): void {
    const top = measureTop();
    if (top === null) return;
    anchorTop = top;
    anchored = true;
  }

  function correct(): void {
    if (options.enabled && !options.enabled()) return;
    const top = measureTop();
    if (top === null) return;
    if (!anchored) {
      anchorTop = top;
      anchored = true;
      return;
    }
    if (!needsAnchorCorrection(top, anchorTop)) {
      // At rest, or noise: adopt where the block actually is.
      anchorTop = top;
      return;
    }
    shift = nextAnchorShift(shift, top, anchorTop);
    applyShift();
  }

  /** Point the observer at whatever the target is now: a host that mounts
   *  the block behind a `v-if`, swaps it, or hands the ref over later must
   *  still be anchored — an observe() that only ever ran once against a
   *  `null` target would disable the hook for the whole instance,
   *  silently (A2 review finding: the composable is public API). */
  function observe(): void {
    if (typeof ResizeObserver === "undefined") return;
    if (!observer) observer = new ResizeObserver(() => correct());
    observer.disconnect();
    const el = target.value;
    if (!el) return;
    // Re-anchor to where the element actually landed before watching it:
    // a late target is a late resting position, not a stale one.
    rebase();
    observer.observe(el);
  }

  onMounted(() => {
    // Record the resting top BEFORE any morph: the mount frame is the
    // only moment guaranteed to be the design's intended position.
    rebase();
    observe();
    // A viewport change re-centers the host, i.e. legitimately moves the
    // block: re-base AFTER the browser settled the new layout so the old
    // anchor does not get defended on the next morph.
    window.addEventListener("resize", rebase);
  });

  watch(target, () => observe());

  onBeforeUnmount(() => {
    observer?.disconnect();
    observer = null;
    if (typeof window !== "undefined") {
      window.removeEventListener("resize", rebase);
    }
  });

  /** Reopen edge: forget the correction and re-anchor where the block is
   *  now. A surface that holds its frame through a leave (HkModal) needs
   *  this, or the next open would inherit the previous cycle's offset. */
  function reset(): void {
    shift = 0;
    anchored = false;
    applyShift();
    rebase();
  }

  return { reset };
}

export default useAnchoredTop;