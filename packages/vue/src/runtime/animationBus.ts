import { setCssAnimationsEnabled } from "../animation/registerAnimations";

export interface FrameContext {
  delta: number;
  elapsed: number;
  now: number;
}

export interface AnimationHandle {
  disconnect(): void;
}

type Callback = (ctx: FrameContext) => void;

/** Frame delivery tier. Every tier hands its callback a delta equal to the
 *  real time elapsed since the entry's OWN last run (clamped to MAX_DELTA),
 *  so motion speed is independent of both the display refresh rate and the
 *  tier's frame budget — only the call cadence differs:
 *  - "sync"  — every animation frame: fine-grained per-frame control, most
 *    CPU. Exception: its delta is the raw per-tick inter-frame gap, NOT
 *    per-entry and NOT clamped — it already runs every frame.
 *  - "normal" — ≈30fps (33ms budget): balanced default for visible motion.
 *  - "idle"  — ≈0.5fps (2000ms budget): cheap background sampling. */
type Priority = "sync" | "normal" | "idle";

interface Entry {
  cb: Callback;
  priority: Priority;
  /** Timestamp (ms) of this entry's own last run; the per-entry delta is
   *  derived from it so throttled tiers stay refresh-rate invariant. */
  lastRun: number;
}

interface OneShotEntry {
  cb: Callback;
  cancelled: boolean;
}

interface IntervalEntry {
  cb: () => void;
  interval: number;
  lastRun: number;
  once: boolean;
}

const syncEntries = new Map<string, Entry>();
const normalEntries = new Map<string, Entry>();
const idleEntries = new Map<string, Entry>();
const oneShotEntries = new Map<string, OneShotEntry>();
const intervalEntries = new Map<string, IntervalEntry>();

const activeTransitions = new Set<string>();

let raf = 0;
let origin = 0;
let prev = 0;
let paused = false;
let scrolling = false;
let scrollTimer: ReturnType<typeof setTimeout> | null = null;
let idleTimer: ReturnType<typeof setTimeout> | null = null;
let oneShotRaf = 0;

const NORMAL_FRAME_BUDGET = 33;
const IDLE_FRAME_BUDGET = 2000;

/** Hard cap (seconds) on the per-entry delta handed to normal/idle
 *  callbacks. A jank/hiccup spike between two runs must not teleport the
 *  animation forward — the sweep simply stalls for the spike and resumes at
 *  the real rate afterwards. Normal operation yields the exact real-time
 *  delta, which is what makes throttled motion refresh-rate independent. */
const MAX_DELTA = 0.1;

function uid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function busyCount(): number {
  return syncEntries.size + normalEntries.size + idleEntries.size + intervalEntries.size + activeTransitions.size;
}

function pickRegistry(priority: Priority): Map<string, Entry> {
  switch (priority) {
    case "sync": return syncEntries;
    case "normal": return normalEntries;
    case "idle": return idleEntries;
  }
}

function tick(now: number) {
  raf = 0;
  if (busyCount() === 0 || paused) {
    return;
  }
  if (!origin) {
    origin = now;
    prev = now;
  }
  const ctx: FrameContext = {
    delta: (now - prev) / 1000,
    elapsed: (now - origin) / 1000,
    now,
  };
  prev = now;

  for (const e of syncEntries.values()) {
    e.cb(ctx);
  }

  const skipNormal = scrolling;
  if (!skipNormal) {
    for (const e of normalEntries.values()) {
      if (now - e.lastRun >= NORMAL_FRAME_BUDGET) {
        // Per-entry real-time delta, clamped so a hiccup spike stalls the
        // animation instead of teleporting it. Compute BEFORE lastRun moves
        // so the delta measures exactly the entry's own wait time.
        const dt = Math.min((now - e.lastRun) / 1000, MAX_DELTA);
        e.lastRun = now;
        e.cb({ ...ctx, delta: dt });
      }
    }
  }

  for (const e of idleEntries.values()) {
    if (now - e.lastRun >= IDLE_FRAME_BUDGET) {
      const dt = Math.min((now - e.lastRun) / 1000, MAX_DELTA);
      e.lastRun = now;
      e.cb({ ...ctx, delta: dt });
    }
  }

  const disconnected: string[] = [];
  for (const [id, e] of intervalEntries) {
    if (now - e.lastRun >= e.interval) {
      e.lastRun = now;
      e.cb();
      if (e.once) disconnected.push(id);
    }
  }
  for (const id of disconnected) intervalEntries.delete(id);

  if (raf !== 0 || idleTimer !== null) return;

  if (syncEntries.size > 0 || normalEntries.size > 0 || intervalEntries.size > 0 || activeTransitions.size > 0) {
    raf = requestAnimationFrame(tick);
  } else if (idleEntries.size > 0) {
    idleTimer = setTimeout(() => {
      idleTimer = null;
      raf = requestAnimationFrame(tick);
    }, IDLE_FRAME_BUDGET);
  }
}

function ensure() {
  if (paused) return;
  if (syncEntries.size > 0 || normalEntries.size > 0 || intervalEntries.size > 0 || activeTransitions.size > 0) {
    if (idleTimer !== null) {
      clearTimeout(idleTimer);
      idleTimer = null;
    }
    if (raf === 0) {
      origin = 0;
      prev = 0;
      raf = requestAnimationFrame(tick);
    }
  } else if (idleEntries.size > 0 && raf === 0 && idleTimer === null) {
    origin = 0;
    prev = 0;
    idleTimer = setTimeout(() => {
      idleTimer = null;
      raf = requestAnimationFrame(tick);
    }, IDLE_FRAME_BUDGET);
  }
}

function halt() {
  if (raf !== 0) {
    cancelAnimationFrame(raf);
    raf = 0;
  }
  if (idleTimer !== null) {
    clearTimeout(idleTimer);
    idleTimer = null;
  }
  if (busyCount() > 0 && !paused) {
    ensure();
  }
}

export function setReducedMotion(flag: boolean) {
  // Reduced motion parks the JS frame scheduler AND the pure-CSS
  // animations registered with the CSS animation registrar. Re-assert
  // the switch on every call so a direct setCssAnimationsEnabled(false)
  // from a performance-context caller is undone when motion resumes.
  setCssAnimationsEnabled(!flag);
  if (paused === flag) return;
  paused = flag;
  if (flag) {
    if (raf !== 0) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
    if (idleTimer !== null) {
      clearTimeout(idleTimer);
      idleTimer = null;
    }
  } else {
    ensure();
  }
}

export function notifyScrollStart() {
  scrolling = true;
  if (scrollTimer) clearTimeout(scrollTimer);
  scrollTimer = setTimeout(() => {
    scrolling = false;
    scrollTimer = null;
  }, 150);
}

export function onFrame(cb: Callback, priority: Priority = "sync"): AnimationHandle {
  const id = uid();
  const registry = pickRegistry(priority);
  registry.set(id, { cb, priority, lastRun: 0 });
  ensure();
  return {
    disconnect() {
      registry.delete(id);
      halt();
    },
  };
}

function ensureOneShotDrain(): void {
  if (oneShotRaf !== 0) return;
  oneShotRaf = requestAnimationFrame(pumpOneShots);
}

function pumpOneShots(now: number): void {
  oneShotRaf = 0;
  if (oneShotEntries.size === 0) return;
  const ctx: FrameContext = { delta: 0, elapsed: 0, now };
  const batch = Array.from(oneShotEntries.values());
  oneShotEntries.clear();
  for (const e of batch) {
    if (!e.cancelled) e.cb(ctx);
  }
}

export function onceFrame(cb: Callback): void {
  oneShotEntries.set(uid(), { cb, cancelled: false });
  ensureOneShotDrain();
}

export function scheduleFrame(cb: Callback): AnimationHandle {
  const entry: OneShotEntry = { cb, cancelled: false };
  const id = uid();
  oneShotEntries.set(id, entry);
  ensureOneShotDrain();
  return {
    disconnect() {
      entry.cancelled = true;
      oneShotEntries.delete(id);
    },
  };
}

export function reportTransition(durationMs: number): AnimationHandle {
  const id = uid();
  activeTransitions.add(id);
  ensure();
  const timer = setTimeout(() => {
    activeTransitions.delete(id);
    halt();
  }, Math.max(0, durationMs));
  return {
    disconnect() {
      clearTimeout(timer);
      activeTransitions.delete(id);
      halt();
    },
  };
}

export function scheduleEvery(cb: () => void, intervalMs: number): AnimationHandle {
  const id = uid();
  intervalEntries.set(id, { cb, interval: intervalMs, lastRun: 0, once: false });
  ensure();
  return {
    disconnect() {
      intervalEntries.delete(id);
      halt();
    },
  };
}

export function scheduleAfter(cb: () => void, delayMs: number): AnimationHandle {
  const id = uid();
  intervalEntries.set(id, { cb, interval: delayMs, lastRun: performance.now(), once: true });
  ensure();
  return {
    disconnect() {
      intervalEntries.delete(id);
      halt();
    },
  };
}
