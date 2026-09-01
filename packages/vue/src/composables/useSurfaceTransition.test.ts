import { describe, expect, it, vi, beforeEach } from "vitest";
import { defineComponent } from "vue";

import { useSurfaceTransition } from "./useSurfaceTransition";
import type { AnimationHandle } from "../runtime/animationBus";
import type { CronHandle } from "../runtime/cronBus";

// The composable's whole job is delegation: surface hooks arm/cancel a
// reported transition (animationBus) per named track, with the cron
// timer as the safety release. Mock both buses and observe the wiring.
const armed: string[] = [];
const cancelled: string[] = [];

vi.mock("../runtime/animationBus", () => ({
  reportTransition: vi.fn((): AnimationHandle => {
    const id = `anim-${armed.length + 1}`;
    armed.push(id);
    return {
      disconnect() { cancelled.push(id); },
    };
  }),
}));

vi.mock("../runtime/cronBus", () => ({
  scheduleCronAfter: vi.fn((_cb: () => void, _ms: number): CronHandle => ({
    disconnect() { /* timer-side cancel; the handle cancel is what matters */ },
  })),
}));

const Host = defineComponent({
  setup(_, { expose }) {
    const surf = useSurfaceTransition(300);
    expose({ surf });
    return () => null;
  },
});

beforeEach(() => {
  armed.length = 0;
  cancelled.length = 0;
});

describe("useSurfaceTransition", () => {
  it("arms on before-enter/leave and cancels on after-enter/leave", () => {
    const surf = useSurfaceTransition(300);
    const hooks = surf.hooks();

    hooks.onBeforeEnter();
    expect(armed).toHaveLength(1);
    expect(cancelled).toHaveLength(0);

    hooks.onAfterEnter();
    expect(cancelled).toHaveLength(1);

    hooks.onBeforeLeave();
    expect(armed).toHaveLength(2);
    hooks.onAfterLeave();
    expect(cancelled).toHaveLength(2);
  });

  it("releases the report when a transition is cancelled mid-flight", () => {
    const surf = useSurfaceTransition(300);
    const hooks = surf.hooks();

    hooks.onBeforeEnter();
    hooks.onEnterCancelled();
    expect(cancelled).toHaveLength(1);

    hooks.onBeforeLeave();
    hooks.onLeaveCancelled();
    expect(cancelled).toHaveLength(2);
  });

  it("keeps named tracks independent — arming one never cancels the other", () => {
    const surf = useSurfaceTransition(300);
    const scrim = surf.hooks("scrim");
    const panel = surf.hooks("panel");

    scrim.onBeforeEnter();
    panel.onBeforeEnter();
    // Cancelling the scrim's report must not touch the panel's.
    scrim.onAfterEnter();
    expect(cancelled).toHaveLength(1);

    panel.onAfterLeave();
    expect(cancelled).toHaveLength(2);
  });

  it("runs inside a component setup without touching the DOM", () => {
    const surf = useSurfaceTransition(300);
    const hooks = surf.hooks();
    hooks.onBeforeEnter();
    hooks.onAfterEnter();
    expect(Host).toBeTruthy();
  });
});
