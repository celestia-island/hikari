/**
 * Central back-guard service — window-first back navigation.
 *
 * Priority rule (user directive): the back gesture — the mobile
 * back button/gesture and the desktop browser back button alike —
 * must be consumed by the topmost open WINDOW first (modal, drawer,
 * menu sheet stack); only when every window has closed does the
 * gesture reach page history and actually navigate back.
 *
 * Mechanism (a generalization of HkMenu's battle-tested Android
 * modal-navigation mode): every window-like surface pushes marked
 * history entries while open, so a back gesture lands on an entry
 * below the window instead of leaving the page. ONE module-level
 * popstate listener dispatches each gesture to the guard that should
 * consume it, and programmatic closes (X / Escape / overlay tap)
 * rewind the entries the window pushed so the page's own history
 * stays clean.
 *
 * Traversal discipline (the subtle part):
 * - pushes are SYNCHRONOUS (marker depth must stack immediately);
 * - rewinds (pop / release) are DEFERRED to a macrotask and
 *   re-validated at execution time. A same-tick "close A, open B"
 *   (select a menu leaf → closeAll → modal opens) must not fire a
 *   go(-n) computed from a history top that B's push already
 *   replaced: at flush time a guard that no longer owns the current
 *   entry simply drops its claim (its markers stay buried and inert)
 *   instead of yanking B's live entry to the forward stack;
 * - a popstate while a suppressed traversal is in flight is ours;
 *   any other is a user gesture. Listener teardown resets the
 *   expectation so a stale counter can never swallow a later,
 *   genuine gesture after the guard set changed.
 *
 * Dead markers (documented trade-off): when a window closes while a
 * foreign entry sits above it (a router pushed during the window's
 * lifetime), its markers are buried mid-stack and cannot be removed —
 * the history API has no delete-entry primitive. They are inert and
 * self-releasing: the next back that lands on one is treated as plain
 * navigation (the router re-syncs from the URL) and the marker is
 * de-marked in place. A back through such a marker can therefore cost
 * one extra press before the URL actually changes — the unavoidable
 * price of keeping the router's live state intact.
 *
 * State markers stamped into history.state:
 *   { __hkBack: <guardId>, __hkBackDepth: <0-based level> }
 */

import type { ShallowRef } from "vue";
import { shallowRef } from "vue";

/** history.state key holding the owning guard id. */
export const BACK_GUARD_MARKER = "__hkBack";
/** history.state key holding the 0-based level of the pushed entry. */
export const BACK_GUARD_DEPTH = "__hkBackDepth";

interface BackState {
  [BACK_GUARD_MARKER]?: string;
  [BACK_GUARD_DEPTH]?: number;
}

export interface BackGuardOptions {
  /**
   * A user back gesture arrived while this guard is the topmost window.
   * `depth` is the landed entry's level when it belongs to this guard
   * (multi-level surfaces — menu sheet stacks — truncate to it);
   * `null` means the landing was outside this guard's stack and the
   * surface must collapse entirely. The service has already updated
   * its entry bookkeeping before the call.
   */
  onBack: (depth: number | null) => void;
}

export interface BackGuard {
  readonly id: string;
  /** History entries this guard currently owns above the page base. */
  readonly entries: number;
  /** Push one marked entry (opening a window / adding a level). */
  push(): void;
  /**
   * In-app one-level back (a sheet's own back button): a suppressed
   * history.back() deferred like every rewind. The caller truncates
   * its own visual stack; the service only maintains history.
   */
  pop(): void;
  /**
   * Programmatic full close (X / Escape / overlay / unmount): rewind
   * every entry this guard pushed via one suppressed traversal. When a
   * foreign entry sits on top (a router or another window pushed while
   * open) the live state is left untouched — the buried markers simply
   * become inert and are released if the user ever lands on them.
   */
  release(): void;
  /**
   * Drop every entry claim AND cancel any pending rewind WITHOUT
   * touching history: for a close that is itself the consequence of an
   * in-page action started from the surface — a menu leaf whose select
   * handler opens a modal or drives an async router navigation. The
   * deferred rewind would otherwise win the race (its flush runs on the
   * next macrotask, before an async navigation commits its pushState)
   * and yank the page back onto the closed surface's marker entry,
   * silently discarding the action's navigation. The pushed markers
   * stay where they lie as inert dead markers — released in place by
   * the popstate cleanup if a later traversal ever lands on them.
   */
  abandon(): void;
  /**
   * Drop every entry claim WITHOUT touching history: for a surface
   * that is already closed yet finds itself owning the current (spent)
   * marker — de-marks it so a closed window never owns live history.
   */
  forget(): void;
  /** True when the current history entry carries this guard's marker. */
  ownsCurrent(): boolean;
  /** Release and unregister from dispatch. */
  destroy(): void;
}

interface GuardRecord {
  id: string;
  options: BackGuardOptions;
  /** Live entry count — kept reactive for devtool-friendly consumers. */
  count: ShallowRef<number>;
  /** Entry count the surface WANTS (drives deferred rewinds). */
  desired: number;
}

const hasWindow = typeof window !== "undefined";

/**
 * Dispatch stack, ordered by LAST ACTIVATION (last = topmost window).
 * Guards register at component setup — mount order, not open order —
 * so every 0→1 entry transition re-stamps the activation order; a
 * window opened later must consume the back gesture first.
 */
const guards: GuardRecord[] = [];
/**
 * Records with a pending rewind claim — INCLUDING destroyed ones: a
 * guard unmounted between release() and the flush must still rewind
 * its entries (its markers live in history regardless), or the dead
 * marker strands as the current entry.
 */
const rewindQueue = new Set<GuardRecord>();
/** Popstate events produced by our own suppressed traversals. */
let suppressCount = 0;
/** A suppressed traversal has been issued and expects one popstate. */
let traversalInFlight = false;
/** Macrotask-scheduled rewind flush (single-flight). */
let flushScheduled = false;
let listening = false;

function readState(): BackState | null {
  if (!hasWindow) return null;
  const st = window.history.state;
  return st != null && typeof st === "object" ? (st as BackState) : null;
}

function onPopState(e: PopStateEvent): void {
  if (suppressCount > 0) {
    // Our own rewind traversal landing — not a user gesture.
    suppressCount--;
    traversalInFlight = false;
    maybeDropListener();
    return;
  }
  // Window priority: the topmost guard still owning entries consumes
  // the gesture. Only when no window owns history does the gesture
  // fall through to plain page navigation (handled by the router /
  // the browser, not by us).
  for (let i = guards.length - 1; i >= 0; i--) {
    const g = guards[i];
    if (g.count.value <= 0) continue;
    const st =
      e.state != null && typeof e.state === "object" ? (e.state as BackState) : null;
    const own = st?.[BACK_GUARD_MARKER] === g.id;
    const depth =
      own && typeof st?.[BACK_GUARD_DEPTH] === "number" ? st[BACK_GUARD_DEPTH] : null;
    g.count.value = depth === null ? 0 : depth + 1;
    g.desired = g.count.value;
    g.options.onBack(depth);
    return;
  }
  // No window owns history: a forward gesture onto one of our spent
  // marker entries releases the marker so closed surfaces never keep
  // owning live history.
  const st =
    e.state != null && typeof e.state === "object" ? (e.state as BackState) : null;
  if (typeof st?.[BACK_GUARD_MARKER] === "string") {
    window.history.replaceState(null, "");
  }
}

function ensureListener(): void {
  if (!hasWindow || listening) return;
  listening = true;
  window.addEventListener("popstate", onPopState);
}

/**
 * Drop the listener when nothing needs it — but NEVER while a
 * suppressed traversal is still in flight (its landing popstate must
 * be consumed here, or the expectation leaks into the next listener
 * generation and swallows a genuine gesture). Teardown also clears a
 * spent expectation: a landing nobody observes is harmless, a stale
 * counter is not.
 */
function maybeDropListener(): void {
  if (!hasWindow || !listening) return;
  if (guards.length > 0 || traversalInFlight) return;
  listening = false;
  window.removeEventListener("popstate", onPopState);
  suppressCount = 0;
}

/**
 * Deferred rewind flush, re-validated at execution time. Only the
 * record that still OWNS the current entry may traverse — a foreign or
 * newer window push above it makes its count unreliable, so it DROPS
 * the claim instead (its markers stay buried, inert, self-releasing).
 * Destroyed records keep their place in the queue: their markers live
 * in history regardless of the component tree.
 */
function scheduleRewind(record: GuardRecord): void {
  if (!hasWindow) return;
  rewindQueue.add(record);
  if (flushScheduled) return;
  flushScheduled = true;
  setTimeout(() => {
    flushScheduled = false;
    // A record can sit in the rewind queue AND still be registered (the
    // normalizer's release-then-push), so collect into a Set to visit
    // each exactly once.
    const candidates = new Set<GuardRecord>(rewindQueue);
    for (const g of guards) {
      if (g.count.value > g.desired) candidates.add(g);
    }
    rewindQueue.clear();
    for (const g of candidates) {
      if (g.count.value <= g.desired) continue;
      const st = readState();
      if (st?.[BACK_GUARD_MARKER] === g.id) {
        const n = g.count.value - g.desired;
        g.count.value = g.desired;
        if (n > 0) {
          if (listening) {
            suppressCount++;
            traversalInFlight = true;
          }
          // With no listener attached (every guard unmounted before
          // this flush ran), the landing popstate goes unobserved —
          // issuing suppression bookkeeping anyway would leak the
          // expectation into the next listener generation and eat a
          // genuine gesture.
          window.history.go(-n);
        }
        return; // one traversal per flush; nothing else can own the top
      }
      // Not ours to rewind (a router or newer window pushed above):
      // abandon the entries where they lie — dead markers are
      // released by the landing cleanup whenever the user reaches
      // them, and forward-stack entries simply die with the session.
      g.count.value = g.desired;
    }
  }, 0);
}

/**
 * Create a back-guard for one window-like surface. The guard must be
 * `destroy()`ed on unmount; `onBack` fires only for user gestures that
 * this guard — as the topmost window — should consume.
 */
export function createBackGuard(options: BackGuardOptions): BackGuard {
  const id = `hk-back-${Math.random().toString(36).slice(2, 10)}`;
  const record: GuardRecord = { id, options, count: shallowRef(0), desired: 0 };
  guards.push(record);
  ensureListener();

  function ownsCurrent(): boolean {
    return readState()?.[BACK_GUARD_MARKER] === id;
  }

  return {
    id,
    get entries(): number {
      return record.count.value;
    },
    push(): void {
      if (!hasWindow) return;
      window.history.pushState(
        { [BACK_GUARD_MARKER]: id, [BACK_GUARD_DEPTH]: record.count.value },
        "",
      );
      record.count.value++;
      // desired advances by ONE level, never snaps to count: a pending
      // release() (desired = 0, rewind deferred) followed by a same-tick
      // push — the HkMenu normalizer's "desktop → mobile" flip — must
      // keep the rewind claim, or the flush sees count == desired and
      // strands the stale entry (N1). Absolute writes (pop / release /
      // dispatch landing) remain absolute: they assert a state, not a delta.
      record.desired++;
      if (record.count.value === 1) {
        // Open order wins over mount order for dispatch priority.
        const i = guards.indexOf(record);
        if (i >= 0 && i !== guards.length - 1) {
          guards.splice(i, 1);
          guards.push(record);
        }
      }
    },
    pop(): void {
      if (!hasWindow || record.count.value <= 0) return;
      // A foreign entry above ours means the history top is not ours to
      // pop — the caller still truncates its visual stack locally.
      if (!ownsCurrent()) return;
      record.desired = record.count.value - 1;
      scheduleRewind(record);
    },
    release(): void {
      record.desired = 0;
      if (!hasWindow) {
        record.count.value = 0;
        return;
      }
      if (record.count.value > 0) {
        scheduleRewind(record);
      } else {
        record.count.value = 0;
      }
    },
    abandon(): void {
      // Snap both counters to zero and retract any queued rewind claim —
      // the flush's `count > desired` re-check then skips this record, so
      // no go(-n) fires and the markers are left buried (inert).
      record.desired = 0;
      record.count.value = 0;
      rewindQueue.delete(record);
    },
    forget(): void {
      record.count.value = 0;
      record.desired = 0;
      if (hasWindow && ownsCurrent()) {
        // Spent marker on the live entry — release ownership in place.
        window.history.replaceState(null, "");
      }
    },
    ownsCurrent,
    destroy(): void {
      this.release();
      // A destroyed guard's rewind cannot wait for the deferred flush:
      // later mounts (the next view, a router swap) stack entries above
      // ours before the macrotask runs, and the deferred candidate can
      // then only abandon — stranding our dead markers mid-stack, where
      // every later rewind stops one short of the page base. The
      // unmount sweep runs before sibling mounts within one patch, so
      // rewinding synchronously here is safe.
      if (hasWindow && record.count.value > 0 && ownsCurrent()) {
        const n = record.count.value;
        record.count.value = 0;
        record.desired = 0;
        rewindQueue.delete(record);
        suppressCount++;
        traversalInFlight = true;
        window.history.go(-n);
      }
      const i = guards.indexOf(record);
      if (i >= 0) guards.splice(i, 1);
      maybeDropListener();
    },
  };
}

/** Test hook: how many guards are registered (leak detection). */
export function __registeredBackGuards(): number {
  return guards.length;
}
/** Test hook: does the module popstate listener currently exist? */
export function __backListenerActive(): boolean {
  return listening;
}
