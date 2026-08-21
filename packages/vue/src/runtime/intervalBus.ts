/**
 * Visibility-aware interval bus — the periodic-event context for DATA
 * polling (as opposed to animation frames).
 *
 * Why this exists alongside the two existing schedulers:
 *
 * - `scheduleEvery` (animationBus) rides the rAF loop: it stops while the
 *   tab is hidden (good for battery) but ALSO stops when the user enables
 *   reduced motion (`setReducedMotion` parks the whole bus). Data polling
 *   is not animation — a reduced-motion user still deserves live terminals,
 *   health ticks, and clock updates. Using `scheduleEvery` for polling
 *   silently freezes those surfaces.
 * - `scheduleCron` (cronBus) is a bare `setInterval`: it keeps firing in
 *   background tabs (battery/radio cost on phones) and, worse, mobile OSes
 *   throttle interval timers while hidden which skewed drift-sensitive
 *   callbacks never correct.
 *
 * `scheduleInterval` is the unified replacement for both polling shapes:
 *
 * - runs on its own timer (independent of rAF / reduced-motion),
 * - PAUSES while `document.hidden` (no background battery/radio burn),
 * - on becoming visible, fires immediately if the schedule elapsed while
 *   hidden (catch-up, so stale polls refresh right away) and then
 *   reschedules,
 * - never double-fires; `disconnect()` is always safe.
 *
 * `scheduleIntervalAfter` is the one-shot (delay) variant with the same
 * hidden-pause semantics: the countdown holds while hidden rather than
 * burning down on a throttled timer.
 */
import { onPageLifecycle } from "./pageLifecycle";

export interface IntervalHandle {
  disconnect(): void;
}

interface Slot {
  cb: () => void;
  intervalMs: number;
  once: boolean;
  timer: ReturnType<typeof setTimeout> | null;
  nextDue: number;
  disconnected: boolean;
}

const slots = new Set<Slot>();
let lifecycleUnsub: (() => void) | null = null;

/** Run a slot callback with bus isolation: a throwing consumer is
 *  reported but never takes the shared timer/lifecycle machinery down
 *  (mirrors pageLifecycle's per-listener isolation). A repeat slot whose
 *  callback throws is dropped — a poll that throws every beat is broken
 *  and would otherwise spin. */
function fire(slot: Slot): void {
  try {
    slot.cb();
  } catch (err) {
    if (typeof console !== "undefined") {
      console.error("[intervalBus] callback threw; slot dropped", err);
    }
    slot.disconnected = true;
    park(slot);
    slots.delete(slot);
    maybePark();
  }
}

function arm(slot: Slot): void {
  if (slot.disconnected || slot.timer !== null) return;
  const delay = Math.max(0, slot.nextDue - Date.now());
  slot.timer = setTimeout(() => {
    slot.timer = null;
    if (slot.disconnected) return;
    if (slot.once) {
      fire(slot);
      if (!slot.disconnected) {
        slot.disconnected = true;
        slots.delete(slot);
        maybePark();
      }
      return;
    }
    fire(slot);
    if (slot.disconnected) return;
    slot.nextDue = Date.now() + slot.intervalMs;
    // Catch-up guard: if the callback stalled longer than one interval
    // (throttled timer, long GC), skip the missed beats instead of firing
    // a burst.
    if (slot.nextDue <= Date.now()) slot.nextDue = Date.now() + slot.intervalMs;
    arm(slot);
  }, delay);
}

function park(slot: Slot): void {
  if (slot.timer !== null) {
    clearTimeout(slot.timer);
    slot.timer = null;
  }
}

function ensureLifecycle(): void {
  if (lifecycleUnsub !== null || typeof document === "undefined") return;
  lifecycleUnsub = onPageLifecycle(({ visible }) => {
    for (const slot of slots) {
      if (visible) {
        // Visible again: if the schedule elapsed while hidden, the poll
        // is stale — fire once now (catch-up), then resume the cadence.
        if (!slot.once && slot.nextDue <= Date.now() && slot.timer === null) {
          fire(slot);
          if (!slot.disconnected) slot.nextDue = Date.now() + slot.intervalMs;
        }
        arm(slot);
      } else {
        park(slot);
      }
    }
    maybePark();
  });
}

function maybePark(): void {
  if (slots.size === 0 && lifecycleUnsub !== null) {
    lifecycleUnsub();
    lifecycleUnsub = null;
  }
}

/**
 * Visibility-aware `setInterval` replacement for data polling. While the
 * page is hidden the timer is parked; on return to visibility an elapsed
 * schedule fires once immediately (catch-up), then continues.
 *
 * Not affected by reduced-motion (this is data, not animation).
 */
export function scheduleInterval(cb: () => void, intervalMs: number): IntervalHandle {
  // Sub-second bursts (<=0) would spin the macrotask queue — clamp to a
  // sane floor rather than trust every caller.
  const safeInterval = Math.max(16, intervalMs);
  const slot: Slot = {
    cb,
    intervalMs: safeInterval,
    once: false,
    timer: null,
    nextDue: Date.now() + safeInterval,
    disconnected: false,
  };
  slots.add(slot);
  ensureLifecycle();
  if (typeof document === "undefined" || !document.hidden) {
    arm(slot);
  }
  return {
    disconnect() {
      slot.disconnected = true;
      park(slot);
      slots.delete(slot);
      maybePark();
    },
  };
}

/**
 * Visibility-aware `setTimeout` replacement. The countdown holds (does not
 * burn down on a throttled background timer) while the page is hidden and
 * resumes on visibility.
 */
export function scheduleIntervalAfter(cb: () => void, delayMs: number): IntervalHandle {
  const slot: Slot = {
    cb,
    intervalMs: delayMs,
    once: true,
    timer: null,
    nextDue: Date.now() + delayMs,
    disconnected: false,
  };
  slots.add(slot);
  ensureLifecycle();
  if (typeof document === "undefined" || !document.hidden) {
    arm(slot);
  }
  return {
    disconnect() {
      slot.disconnected = true;
      park(slot);
      slots.delete(slot);
      maybePark();
    },
  };
}
