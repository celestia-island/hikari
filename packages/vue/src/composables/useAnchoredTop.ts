import { onBeforeUnmount, onMounted, type Ref } from "vue";

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
 * How it works: a ResizeObserver on `target` fires on every size change
 * (before paint, so the correction lands in the same frame the growth
 * did), the element's current viewport top is compared against the top
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
 * - The shift is kept (not released) when the morph settles: releasing it
 *   would slide the block back to its layout position, i.e. replay the
 *   very motion this removes. It oscillates around 0 across symmetric
 *   swaps (account → verify → account returns it to 0 by construction).
 * - At rest the anchor re-bases to wherever the block actually sits, so a
 *   legitimate re-position (viewport resize, a line above the block
 *   appearing, a late webfont reflow) is adopted instead of being fought.
 * - No ResizeObserver / no layout engine (SSR, jsdom): the hook is a
 *   no-op — a block that never animates never drifts, so there is nothing
 *   to correct.
 */
export function useAnchoredTop(
  target: Ref<HTMLElement | null>,
  options: { enabled?: () => boolean } = {},
): void {
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

  onMounted(() => {
    // Record the resting top BEFORE any morph: the mount frame is the
    // only moment guaranteed to be the design's intended position.
    rebase();
    if (typeof ResizeObserver === "undefined") return;
    observer = new ResizeObserver(() => correct());
    if (target.value) observer.observe(target.value);
    // A viewport change re-centers the host, i.e. legitimately moves the
    // block: re-base AFTER the browser settled the new layout so the old
    // anchor does not get defended on the next morph.
    window.addEventListener("resize", rebase);
  });

  onBeforeUnmount(() => {
    observer?.disconnect();
    observer = null;
    if (typeof window !== "undefined") {
      window.removeEventListener("resize", rebase);
    }
  });
}

export default useAnchoredTop;