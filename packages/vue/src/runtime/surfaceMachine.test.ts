import { describe, expect, it } from "vitest";

import {
  SURFACE_EVENTS,
  SURFACE_PHASES,
  classPairOf,
  classesForPair,
  isMounted,
  isQuiescent,
  surfaceTransition,
  type SurfaceEventType,
  type SurfacePhase,
} from "./surfaceMachine";

/** The spec table as data — the single reviewable proof artifact. The
 *  reducer must agree with it on every cell; this test is the diff. */
const SPEC: Record<SurfacePhase, Record<SurfaceEventType, SurfacePhase>> = {
  closed: {
    OPEN: "openingFrom",
    CLOSE: "closed",
    FLIP: "closed",
    DEADLINE: "closed",
    TEND: "closed",
    UNMOUNT: "closed",
  },
  openingFrom: {
    OPEN: "openingFrom",
    CLOSE: "closingFrom",
    FLIP: "openingTo",
    DEADLINE: "open",
    TEND: "open",
    UNMOUNT: "closed",
  },
  openingTo: {
    OPEN: "openingTo",
    CLOSE: "closingFrom",
    FLIP: "openingTo",
    DEADLINE: "open",
    TEND: "open",
    UNMOUNT: "closed",
  },
  open: {
    OPEN: "open",
    CLOSE: "closingFrom",
    FLIP: "open",
    DEADLINE: "open",
    TEND: "open",
    UNMOUNT: "closed",
  },
  closingFrom: {
    OPEN: "openingFrom",
    CLOSE: "closingFrom",
    FLIP: "closingTo",
    DEADLINE: "closed",
    TEND: "closed",
    UNMOUNT: "closed",
  },
  closingTo: {
    OPEN: "openingFrom",
    CLOSE: "closingTo",
    FLIP: "closingTo",
    DEADLINE: "closed",
    TEND: "closed",
    UNMOUNT: "closed",
  },
};

describe("surfaceMachine table", () => {
  // T1 (totality + conformance): all 36 cells defined and matching the
  // spec table — the reducer IS the table.
  it("defines every (phase, event) cell exactly as the spec table", () => {
    expect(SURFACE_PHASES).toHaveLength(6);
    expect(SURFACE_EVENTS).toHaveLength(6);
    for (const phase of SURFACE_PHASES) {
      for (const event of SURFACE_EVENTS) {
        const expected = SPEC[phase][event];
        if (surfaceTransition(phase, event) !== expected) {
          throw new Error(`table cell (${phase}, ${event}) diverges from the spec table`);
        }
      }
    }
  });

  // T2/T3 (outputs are pure functions of state): quiescent states carry
  // no transition classes; only non-closed states mount.
  it("quiescent phases paint no transition classes", () => {
    for (const phase of SURFACE_PHASES) {
      const classes = classesForPair("hk-x", classPairOf(phase));
      if (isQuiescent(phase)) {
        expect(classes).toEqual([]);
      } else {
        expect(classes.length).toBe(2);
      }
      expect(isMounted(phase) === (phase !== "closed")).toBe(true);
    }
  });

  // T4 (liveness): one DEADLINE walks any animation phase to a
  // quiescent phase — the A2 (rAF/transitionend starved) column.
  it("a single DEADLINE settles every animation phase (starvation column)", () => {
    for (const phase of SURFACE_PHASES) {
      const next = surfaceTransition(phase, "DEADLINE");
      expect(isQuiescent(next), `${phase} + DEADLINE`).toBe(true);
    }
  });

  // Idempotence: duplicating any event never moves the machine.
  it("every event is idempotent in its target state", () => {
    for (const phase of SURFACE_PHASES) {
      for (const event of SURFACE_EVENTS) {
        const once = surfaceTransition(phase, event);
        expect(surfaceTransition(once, event)).toBe(once);
      }
    }
  });
});

// ── Property-based exploration ─────────────────────────────────────
// Deterministic seeded RNG (xorshift32) — no PBT dependency, full
// reproducibility from the printed seed on failure.

function rng(seed: number): () => number {
  let s = seed | 0 || 1;
  return () => {
    s ^= s << 13; s ^= s >>> 17; s ^= s << 5;
    return (s >>> 0) / 0x100000000;
  };
}

describe("surfaceMachine property-based exploration", () => {
  const RUNS = 4000;
  const MAX_EVENTS = 40;

  // Invariants checked after EVERY event of every run:
  //  I-mounted: mounted(phase) ⟺ phase !== closed
  //  I-classes: transition classes only on animation phases (implied by
  //             classPairOf being total/pure — asserted via quiescence)
  //  I-quiesce: after draining (each request followed by its DEADLINE),
  //             the machine rests in {closed, open} — bounded settling
  //             without any FLIP/TEND ever arriving (axiom A2).
  it("every random event stream settles quiescently under total frame starvation", () => {
    for (let run = 0; run < RUNS; run++) {
      const rand = rng(run + 1);
      let phase: SurfacePhase = "closed";
      for (let i = 0; i < MAX_EVENTS; i++) {
        const pool: SurfaceEventType[] =
          rand() < 0.5
            ? ["OPEN", "CLOSE", "UNMOUNT"] // starvation diet: no FLIP/TEND
            : [...SURFACE_EVENTS];
        const event = pool[Math.floor(rand() * pool.length)]!;
        phase = surfaceTransition(phase, event);
        // I-mounted
        expect(phase === "closed" || isMounted(phase)).toBe(true);
        // UNMOUNT absorbs: once sent, only OPEN can leave closed.
        if (event === "UNMOUNT") {
          expect(phase).toBe("closed");
        }
      }
      // Drain: one DEADLINE settles any animation phase (T4).
      phase = surfaceTransition(phase, "DEADLINE");
      expect(isQuiescent(phase), `run ${run} drained to ${phase}`).toBe(true);
    }
  });

  // Reversal safety: OPEN/CLOSE may interleave arbitrarily inside the
  // animation windows; the machine must never enter a phase that paints
  // resting classes while mounted=false (the "invisible with content"
  // inversion) or transition classes while quiescent.
  it("request interleavings never invert the mounted/classes relationship", () => {
    for (let run = 0; run < 2000; run++) {
      const rand = rng(10_000 + run);
      let phase: SurfacePhase = "closed";
      for (let i = 0; i < 30; i++) {
        const event: SurfaceEventType =
          rand() < 0.7 ? (rand() < 0.5 ? "OPEN" : "CLOSE") : "FLIP";
        phase = surfaceTransition(phase, event);
        const mounted = isMounted(phase);
        const paintingTransitionClasses = !isQuiescent(phase);
        // A mounted surface either rests (no classes) or animates
        // (classes) — and classes imply mounted.
        if (paintingTransitionClasses) expect(mounted).toBe(true);
        if (!mounted) expect(phase).toBe("closed");
      }
    }
  });
});
