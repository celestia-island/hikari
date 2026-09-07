import { computed, nextTick, onBeforeUnmount, shallowRef, type ComputedRef } from "vue";

import {
  classPairOf,
  classesForPair,
  isMounted,
  surfaceTransition,
  type SurfaceEventType,
  type SurfacePhase,
} from "../runtime/surfaceMachine";

export interface SurfaceMachineLayer {
  /** Vue-style transition-name prefix (e.g. "hk-modal-overlay"). */
  prefix: string;
  /** Live element accessor — lets the driver read the layer's EFFECTIVE
   *  CSS duration (themes, reduced-motion, `data-css-animations="0"`). */
  el?: () => HTMLElement | null | undefined;
  /** Fallback enter budget, ms — the A2 bound when the element (or its
   *  computed style) cannot be read. */
  enterMs: () => number;
  /** Fallback leave budget, ms. */
  leaveMs: () => number;
}

export interface SurfaceMachineOptions {
  layers: SurfaceMachineLayer[];
  /**
   * How long a `.from` phase waits for a frame flip before the timer
   * forces it (ms). Under A2 (rAF starved) this bounds the from-pair's
   * lifetime; the forced flip snaps (nothing is painting anyway).
   */
  flipBudgetMs?: number;
  /** Extra ms on top of the CSS duration before a deadline fires. */
  deadlineSlackMs?: number;
  /** Phase-edge side effects (registration, focus, morph, reports). */
  onPhase?: (from: SurfacePhase, to: SurfacePhase, event: SurfaceEventType) => void;
}

export interface SurfaceMachine {
  /** Current phase (reactive — render-time reads track it). */
  phase: ComputedRef<SurfacePhase>;
  /** Whether the surface DOM should render (v-if anchor). */
  mounted: ComputedRef<boolean>;
  /** Reactive transition classes for one layer's prefix. */
  classesFor: (prefix: string) => string[];
  /** Dispatch an event through the total transition table. */
  send: (event: SurfaceEventType) => void;
}

/**
 * useSurfaceMachine — the Vue driver for the pure surface lifecycle
 * machine (runtime/surfaceMachine.ts).
 *
 * Ownership rules that make the machine's proofs carry over:
 * - Classes are bound REACTIVELY from the phase (render reads
 *   `classesFor`), so the initial mount paints with its from-pair — no
 *   write-after-mount race, no Vue `<Transition>` engine to diverge.
 * - The ONLY correctness clock is setTimeout: every animation phase arms
 *   exactly one deadline timer; the frame flip is double-rAF (smooth)
 *   with a flip timer as the starved fallback. Duplicate FLIPs are
 *   absorbed by the table (idempotent self-loops).
 * - Phase changes clear every pending timer/rAF before arming the next
 *   phase's — at most one flip + one deadline exist at any moment, so
 *   timers cannot leak or fire stale (the machine has no "late
 *   completion" callbacks at all).
 */
export function useSurfaceMachine(options: SurfaceMachineOptions): SurfaceMachine {
  const flipBudget = options.flipBudgetMs ?? 120;
  const slack = options.deadlineSlackMs ?? 80;

  const phase = shallowRef<SurfacePhase>("closed");
  const mounted = computed(() => isMounted(phase.value));

  let flipTimer: ReturnType<typeof setTimeout> | null = null;
  let deadlineTimer: ReturnType<typeof setTimeout> | null = null;
  let raf1 = 0;
  let raf2 = 0;

  function clearClock(): void {
    if (flipTimer !== null) {
      clearTimeout(flipTimer);
      flipTimer = null;
    }
    if (deadlineTimer !== null) {
      clearTimeout(deadlineTimer);
      deadlineTimer = null;
    }
    if (raf1) cancelAnimationFrame(raf1);
    if (raf2) cancelAnimationFrame(raf2);
    raf1 = 0;
    raf2 = 0;
  }

  /** Worst-case deadline for the phase being entered, from the CONFIGURED
   *  budgets (the A2 bound when the live CSS cannot be read). */
  function budgetFor(next: SurfacePhase): number {
    switch (next) {
      case "openingFrom":
        return flipBudget + Math.max(...options.layers.map((l) => l.enterMs())) + slack;
      case "openingTo":
        return Math.max(...options.layers.map((l) => l.enterMs())) + slack;
      case "closingFrom":
        return flipBudget + Math.max(...options.layers.map((l) => l.leaveMs())) + slack;
      case "closingTo":
        return Math.max(...options.layers.map((l) => l.leaveMs())) + slack;
      default:
        return 0;
    }
  }

  /** Effective CSS transition duration of one layer, ms — the maximum
   *  across the comma-separated duration list ("0.3s, 0.25s"). Reduced
   *  motion and `html[data-css-animations="0"]` both collapse this to 0,
   *  which is exactly the fast-path signal.
   *  Caveat: `transition-delay` is deliberately ignored (no current
   *  surface staggers its layers) — a future adopter adding delays must
   *  fold them into the layer's enter/leave fallback budgets. */
  function cssDurationMs(el: HTMLElement): number {
    const raw = window.getComputedStyle(el).transitionDuration;
    if (!raw) return 0;
    let max = 0;
    for (const part of raw.split(",")) {
      const value = parseFloat(part);
      if (!Number.isFinite(value)) continue;
      max = Math.max(max, part.includes("ms") ? value : value * 1000);
    }
    return max;
  }

  /** Max effective CSS duration across layers, or null when no layer
   *  element is readable (surface mid-mount) — the caller falls back to
   *  the configured budget. */
  function measuredBudget(): number | null {
    let max: number | null = null;
    for (const layer of options.layers) {
      const el = layer.el?.();
      if (!el || !el.isConnected) continue;
      max = Math.max(max ?? 0, cssDurationMs(el));
    }
    return max;
  }

  function rearmDeadline(ms: number): void {
    if (deadlineTimer !== null) clearTimeout(deadlineTimer);
    deadlineTimer = setTimeout(() => {
      deadlineTimer = null;
      send("DEADLINE");
    }, Math.max(0, ms));
  }

  function armClock(next: SurfacePhase): void {
    clearClock();
    if (next === "closed" || next === "open") return;
    // Frame flip: double-rAF guarantees a style recalc between the
    // from-pair and the to-pair (a same-recalc flip would coalesce into
    // an instant jump); the flip timer forces the same event when rAF
    // starves. Both may fire — the table absorbs the duplicate.
    if (next === "openingFrom" || next === "closingFrom") {
      raf1 = requestAnimationFrame(() => {
        raf1 = 0;
        raf2 = requestAnimationFrame(() => {
          raf2 = 0;
          send("FLIP");
        });
      });
      flipTimer = setTimeout(() => {
        flipTimer = null;
        send("FLIP");
      }, flipBudget);
    }
    deadlineTimer = setTimeout(() => {
      deadlineTimer = null;
      send("DEADLINE");
    }, budgetFor(next));

    // Effective-duration probe: once the layer elements are live (one
    // microtask after the mounting patch), replace the configured bound
    // with what the CSS actually says. A zero duration (no transitions
    // — happy-dom, reduced motion, the global animation switch) makes
    // the deadline fire on the next macrotask, restoring the legacy
    // instant-completion semantics; a long theme gets its real budget.
    // The phase guard makes a late probe a no-op.
    if (next === "openingFrom" || next === "closingFrom") {
      const phaseAtArm = next;
      void nextTick(() => {
        if (phase.value !== phaseAtArm) return;
        const measured = measuredBudget();
        if (measured === null) return;
        rearmDeadline(measured > 0 ? flipBudget + measured + slack : 0);
      });
    } else {
      // *.to phases: the elements exist and styles settled at the flip.
      const measured = measuredBudget();
      if (measured !== null) {
        rearmDeadline(measured > 0 ? measured + slack : 0);
      }
    }
  }

  function send(event: SurfaceEventType): void {
    const from = phase.value;
    const to = surfaceTransition(from, event);
    if (to === from) return; // table-idempotent absorb (no effects)
    phase.value = to;
    armClock(to);
    options.onPhase?.(from, to, event);
  }

  onBeforeUnmount(() => {
    clearClock();
    // UNMOUNT walks any phase to `closed` so onPhase observers see a
    // consistent final state even mid-animation.
    send("UNMOUNT");
    clearClock();
  });

  function classesFor(prefix: string): string[] {
    return classesForPair(prefix, classPairOf(phase.value));
  }

  return { phase: computed(() => phase.value), mounted, classesFor, send };
}
