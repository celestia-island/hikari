/**
 * useAnimationLoop — the family's ONE shared requestAnimationFrame loop.
 *
 * Every JS-driven animation in the library registers a callback here
 * instead of opening its own rAF chain: the context owns a single loop
 * that runs ONLY while at least one callback is registered, and each
 * frame dispatches `(now, deltaMs)` to every callback that was armed at
 * frame start (a callback that registers/unregisters mid-frame takes
 * effect next frame — the iteration walks a snapshot). CSS transitions
 * remain the preferred vehicle (the browser composites them
 * off-thread); this loop is for the choreography CSS cannot express —
 * measured size morphs, staged state sequences, scroll handshakes
 * (user direction 2026-10-22).
 *
 * The family-wide default duration for BOTH CSS and loop-driven
 * animation is 300ms (`DEFAULT_ANIMATION_DURATION_MS`), matching the
 * design system's `--duration-normal` token — one number, everywhere.
 */

/** The family-wide animation default: 300ms (== `--duration-normal`). */
export const DEFAULT_ANIMATION_DURATION_MS = 300;

/** First-frame delta stand-in: one 60Hz frame. */
const DEFAULT_FRAME_DELTA_MS = 1000 / 60;

/** A per-frame callback: absolute rAF timestamp + ms since last frame. */
export type AnimationFrameCallback = (nowMs: number, deltaMs: number) => void;

interface LoopState {
  callbacks: Set<AnimationFrameCallback>;
  handle: number | null;
  last: number | null;
}

// Module-level singleton: one loop per document, however many consumers.
const state: LoopState = { callbacks: new Set(), handle: null, last: null };

function engine(nowMs: number): void {
  // Snapshot BEFORE mutating state: mid-frame (un)registrations land
  // next frame, and a callback never runs twice inside one frame.
  const armed = Array.from(state.callbacks);
  const prev = state.last;
  if (armed.length > 0) {
    state.handle = requestAnimationFrame(engine);
    state.last = nowMs;
  } else {
    state.handle = null;
    state.last = null;
  }
  const delta = prev === null ? DEFAULT_FRAME_DELTA_MS : Math.max(0, nowMs - prev);
  for (const cb of armed) cb(nowMs, delta);
}

/**
 * Register a per-frame callback. Returns the unregister function; call
 * it when the animation settles (or the component unmounts). Registering
 * the SAME function twice is idempotent (Set semantics). The loop is
 * lazily started by the first registration and stops itself the moment
 * the last callback unregisters — idle pages pay zero rAF churn.
 */
export function onAnimationFrame(cb: AnimationFrameCallback): () => void {
  state.callbacks.add(cb);
  if (state.handle === null) {
    state.last = null;
    state.handle = requestAnimationFrame(engine);
  }
  return () => {
    state.callbacks.delete(cb);
    if (state.callbacks.size === 0 && state.handle !== null) {
      cancelAnimationFrame(state.handle);
      state.handle = null;
      state.last = null;
    }
  };
}

/** Test/introspection hook: how many callbacks are armed right now. */
export function animationLoopArmedCount(): number {
  return state.callbacks.size;
}

/**
 * Component-facing wrapper: one registration bound to one callback
 * (register on creation, `dispose()` when the owner unmounts). The
 * callback receives `(nowMs, deltaMs)` every frame while armed.
 */
export function useAnimationLoop(cb: AnimationFrameCallback): { dispose: () => void } {
  let off: (() => void) | null = onAnimationFrame(cb);
  return {
    dispose(): void {
      off?.();
      off = null;
    },
  };
}
