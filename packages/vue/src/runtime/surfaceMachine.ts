// Surface lifecycle state machine — the provable core of every overlay
// surface (modal scrim+panel, sheet scrim+panel, popover) in hikari.
//
// WHY A MACHINE. The pre-machine design drove two independent Vue
// <Transition> engines off one boolean, with rAF/transitionend as the
// class-flip clock. Those events can starve (occluded webviews — the
// 2026-09 field reports), and two engines can diverge through the same
// event stream (the mobile "panel visible, scrim gone" state, later the
// full-opacity close flash — the "black rectangle"). The fixes of that
// era (#407 leave watchdog, #414 enter watchdog) REPAIRED observed bad
// states; a repair list is never complete.
//
// This module inverts the approach: the lifecycle is ONE explicit
// finite-state machine whose transition table is total by construction,
// whose outputs are pure functions of the state, and whose only
// correctness clock is setTimeout (the one primitive field-verified to
// fire under the starvation conditions that starve rAF). Bad states —
// divergent layers, stuck transition classes at rest — are UNREPRESENT-
// ABLE in the state space rather than detected and repaired.
//
// AXIOMS (the proof's ground rules):
//   A1 setTimeout callbacks fire exactly once, within a bounded delay.
//   A2 rAF and transitionend may NEVER fire. (The machine stays correct
//      under A2 alone; both are advisory optimizations in the driver.)
//   A3 Synchronous class/style writes take effect at the next style
//      recalc. (What the compositor PAINTS is outside the axioms.)
//
// STATES — six, including the two-phase animation windows (a `.from`
// phase holds the from-class pair until a frame flip; a `.to` phase
// runs the CSS transition to the resting pair):
//
//   closed        no DOM, no timers, nothing registered
//   openingFrom   mounted, enter-from classes, flip pending
//   openingTo     mounted, enter-to classes, animating
//   open          mounted, resting classes, morph armed — the only
//                 state where size measurements are taken
//   closingFrom   mounted, leave-from classes, flip pending
//   closingTo     mounted, leave-to classes, animating
//
// EVENTS:
//   OPEN/CLOSE  surface request (user logic, back gesture, closeAll)
//   FLIP        frame flip (double-rAF or the flip timer — same event)
//   DEADLINE    phase deadline timer (the correctness clock)
//   TEND        transitionend (advisory early completion; the driver
//               does not emit it — the cell exists so the table stays
//               total for future adopters)
//   UNMOUNT     component teardown
//
// THE TABLE. Completeness is the table itself — every (state, event)
// cell is defined; table conformance is enforced by a test that holds
// the spec table as data and diffs the reducer against it cell by cell.
// Duplicate/inappropriate events are idempotent self-loops (absorbing),
// so no interleaving — however adversarial — leaves the machine
// undefined or divergent.

export type SurfacePhase =
  | "closed"
  | "openingFrom"
  | "openingTo"
  | "open"
  | "closingFrom"
  | "closingTo";

export type SurfaceEventType =
  | "OPEN"
  | "CLOSE"
  | "FLIP"
  | "DEADLINE"
  | "TEND"
  | "UNMOUNT";

export type SurfaceEvent = { type: SurfaceEventType };

export const SURFACE_PHASES: readonly SurfacePhase[] = [
  "closed",
  "openingFrom",
  "openingTo",
  "open",
  "closingFrom",
  "closingTo",
] as const;

export const SURFACE_EVENTS: readonly SurfaceEventType[] = [
  "OPEN",
  "CLOSE",
  "FLIP",
  "DEADLINE",
  "TEND",
  "UNMOUNT",
] as const;

/**
 * The total transition function δ: S × E → S.
 *
 * | state       | OPEN         | CLOSE        | FLIP        | DEADLINE    | TEND        | UNMOUNT |
 * |-------------|--------------|--------------|-------------|-------------|-------------|---------|
 * | closed      | openingFrom  | closed       | closed      | closed      | closed      | closed  |
 * | openingFrom | openingFrom  | closingFrom  | openingTo   | open        | open        | closed  |
 * | openingTo   | openingTo    | closingFrom  | openingTo   | open        | open        | closed  |
 * | open        | open         | closingFrom  | open        | open        | open        | closed  |
 * | closingFrom | openingFrom  | closingFrom  | closingTo   | closed      | closed      | closed  |
 * | closingTo   | openingFrom  | closingTo    | closingTo   | closed      | closed      | closed  |
 *
 * Reading guide:
 * - Requests are idempotent (OPEN in any opening/open state is a no-op)
 *   — user flapping converges instead of thrashing.
 * - A CLOSE during the opening window reverses from the CURRENT computed
 *   style (CSS re-targets the running transition); a OPEN during the
 *   closing window likewise reverses. Interruption is a first-class cell,
 *   not a corner case — the f108–f112 churn of the 2026-09 recording.
 * - DEADLINE alone walks any state to a quiescent state: openingFrom →
 *   open, closingFrom → closed — starving frames skip the animation, not
 *   the state). This is the liveness column: under A1+A2 every request
 *   settles within flipBudget + maxDuration + slack.
 */
export function surfaceTransition(
  phase: SurfacePhase,
  event: SurfaceEventType,
): SurfacePhase {
  switch (phase) {
    case "closed":
      switch (event) {
        case "OPEN": return "openingFrom";
        case "CLOSE":
        case "FLIP":
        case "DEADLINE":
        case "TEND":
        case "UNMOUNT": return "closed";
      }
      break;
    case "openingFrom":
      switch (event) {
        case "OPEN": return "openingFrom";
        case "CLOSE": return "closingFrom";
        case "FLIP": return "openingTo";
        case "DEADLINE":
        case "TEND": return "open";
        case "UNMOUNT": return "closed";
      }
      break;
    case "openingTo":
      switch (event) {
        case "OPEN": return "openingTo";
        case "CLOSE": return "closingFrom";
        case "FLIP": return "openingTo";
        case "DEADLINE":
        case "TEND": return "open";
        case "UNMOUNT": return "closed";
      }
      break;
    case "open":
      switch (event) {
        case "OPEN":
        case "FLIP":
        case "DEADLINE":
        case "TEND": return "open";
        case "CLOSE": return "closingFrom";
        case "UNMOUNT": return "closed";
      }
      break;
    case "closingFrom":
      switch (event) {
        case "OPEN": return "openingFrom";
        case "CLOSE": return "closingFrom";
        case "FLIP": return "closingTo";
        case "DEADLINE":
        case "TEND": return "closed";
        case "UNMOUNT": return "closed";
      }
      break;
    case "closingTo":
      switch (event) {
        case "OPEN": return "openingFrom";
        case "CLOSE":
        case "FLIP": return "closingTo";
        case "DEADLINE":
        case "TEND": return "closed";
        case "UNMOUNT": return "closed";
      }
      break;
  }
  // Exhaustiveness guard: TypeScript proves every phase/event pair
  // returned above; reaching this line is a compile-time impossibility
  // that we still assert at runtime (a built table can never be wrong
  // silently).
  throw new Error(
    `[surfaceMachine] unhandled transition ${phase} x ${event} — the table has a hole (bug: table not total)`,
  );
}

/** Whether the phase is one of the two quiescent (resting) states. */
export function isQuiescent(phase: SurfacePhase): boolean {
  return phase === "closed" || phase === "open";
}

/** Whether the surface's DOM is mounted (everything except `closed`). */
export function isMounted(phase: SurfacePhase): boolean {
  return phase !== "closed";
}

/** The class-pair family a phase paints (pure Moore output). */
export type SurfaceClassPair = "none" | "enter-from" | "enter-to" | "leave-from" | "leave-to";

export function classPairOf(phase: SurfacePhase): SurfaceClassPair {
  switch (phase) {
    case "closed": return "none";
    case "openingFrom": return "enter-from";
    case "openingTo": return "enter-to";
    case "open": return "none";
    case "closingFrom": return "leave-from";
    case "closingTo": return "leave-to";
  }
}

/** Vue-style transition classes for one layer prefix (Moore output).
 *
 *  The names match what the family's SCSS already animates
 *  (`${prefix}-enter-from` etc.), so adopting the machine changes WHO
 *  flips the classes and WHEN — never WHAT the classes are.
 */
export function classesForPair(prefix: string, pair: SurfaceClassPair): string[] {
  switch (pair) {
    case "none": return [];
    case "enter-from": return [`${prefix}-enter-from`, `${prefix}-enter-active`];
    case "enter-to": return [`${prefix}-enter-to`, `${prefix}-enter-active`];
    case "leave-from": return [`${prefix}-leave-from`, `${prefix}-leave-active`];
    case "leave-to": return [`${prefix}-leave-to`, `${prefix}-leave-active`];
  }
}
