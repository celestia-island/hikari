import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h, ref, type Ref } from "vue";

import {
  useSidebarRail,
  SIDEBAR_RAIL_PEEK_DELAY,
  SIDEBAR_RAIL_PEEK_GRACE,
  type SidebarRailHandle,
} from "./useSidebarRail";

/**
 * The rail state machine's timing contract (2026-10-30) — the ONE
 * implementation behind HkFaceShell/HkSidebar rail mode and bespoke
 * hosts. What this file pins:
 *
 * 1. A resting pointer on the rail opens the peek only after the dwell
 *    (default 400ms), and only while collapsed; a leave before the dwell
 *    cancels the arm.
 * 2. A leave while peeking arms the grace close (default 150ms);
 *    re-entering inside the window cancels it — the anti-flicker
 *    contract for diagonal pointer moves.
 * 3. Escape closes an open peek immediately (and says it consumed the
 *    key; other keys pass through).
 * 4. Expanding — by toggle or by an external collapsed flip — absorbs
 *    any open peek.
 * 5. Unmount clears pending timers.
 *
 * Fake timers drive every delay; happy-dom supplies matchMedia (the
 * reduced-motion subscription reads false, which the machine does not
 * branch on — CSS owns that half).
 */

const mounts: Array<{ app: ReturnType<typeof createApp>; container: HTMLElement }> = [];

function mountRail(options: Parameters<typeof useSidebarRail>[0] = {}): SidebarRailHandle {
  let handle: SidebarRailHandle | undefined;
  const Probe = defineComponent({
    setup() {
      handle = useSidebarRail(options);
      return () => h("div", "probe");
    },
  });
  const container = document.createElement("div");
  document.body.appendChild(container);
  const app = createApp(Probe);
  app.mount(container);
  mounts.push({ app, container });
  if (!handle) throw new Error("probe setup did not run");
  return handle;
}

afterEach(() => {
  for (const { app, container } of mounts.splice(0)) {
    app.unmount();
    container.remove();
  }
  vi.useRealTimers();
});

describe("useSidebarRail — the peek state machine", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("ships the documented default timings as constants", () => {
    expect(SIDEBAR_RAIL_PEEK_DELAY).toBe(400);
    expect(SIDEBAR_RAIL_PEEK_GRACE).toBe(150);
  });

  it("starts expanded with no peek, session-only (no storage touched)", () => {
    const rail = mountRail();
    expect(rail.collapsed.value).toBe(false);
    expect(rail.peeking.value).toBe(false);
    // The session-only contract: nothing may read or write storage from
    // the machine itself. (Storage absence would throw on access here —
    // happy-dom has it, so assert it stayed empty of rail keys.)
    for (const store of [window.localStorage, window.sessionStorage]) {
      for (let i = 0; i < store.length; i += 1) {
        expect(store.key(i)).not.toMatch(/sidebar|rail|peek/i);
      }
    }
  });

  it("opens the peek after the dwell — and not one tick before", () => {
    const rail = mountRail();
    rail.collapse();
    rail.onPointerEnter();
    vi.advanceTimersByTime(SIDEBAR_RAIL_PEEK_DELAY - 1);
    expect(rail.peeking.value, "one tick before the dwell the peek stays closed").toBe(false);
    vi.advanceTimersByTime(1);
    expect(rail.peeking.value).toBe(true);
  });

  it("never arms the dwell while expanded", () => {
    const rail = mountRail();
    rail.onPointerEnter();
    vi.advanceTimersByTime(SIDEBAR_RAIL_PEEK_DELAY * 3);
    expect(rail.peeking.value).toBe(false);
  });

  it("cancels the arm when the pointer leaves before the dwell", () => {
    const rail = mountRail();
    rail.collapse();
    rail.onPointerEnter();
    vi.advanceTimersByTime(200);
    rail.onPointerLeave();
    vi.advanceTimersByTime(SIDEBAR_RAIL_PEEK_DELAY);
    expect(rail.peeking.value, "the peek only opens under a RESTING pointer").toBe(false);
  });

  it("closes on leave only after the grace window", () => {
    const rail = mountRail();
    rail.collapse();
    rail.onPointerEnter();
    vi.advanceTimersByTime(SIDEBAR_RAIL_PEEK_DELAY);
    expect(rail.peeking.value).toBe(true);

    rail.onPointerLeave();
    vi.advanceTimersByTime(SIDEBAR_RAIL_PEEK_GRACE - 1);
    expect(rail.peeking.value, "inside the grace the peek stays open").toBe(true);
    vi.advanceTimersByTime(1);
    expect(rail.peeking.value).toBe(false);
  });

  it("re-entry inside the grace cancels the close (no flicker)", () => {
    const rail = mountRail();
    rail.collapse();
    rail.onPointerEnter();
    vi.advanceTimersByTime(SIDEBAR_RAIL_PEEK_DELAY);
    expect(rail.peeking.value).toBe(true);

    // A diagonal move: out of the rail, back inside the grace, out again
    // for another grace, in again — the drawer must never flicker shut.
    rail.onPointerLeave();
    vi.advanceTimersByTime(SIDEBAR_RAIL_PEEK_GRACE - 20);
    rail.onPointerEnter();
    vi.advanceTimersByTime(SIDEBAR_RAIL_PEEK_GRACE * 4);
    expect(rail.peeking.value, "re-entry inside the grace keeps the peek open").toBe(true);

    // Leaving for a FULL grace finally closes it.
    rail.onPointerLeave();
    vi.advanceTimersByTime(SIDEBAR_RAIL_PEEK_GRACE);
    expect(rail.peeking.value).toBe(false);
  });

  it("honors configured dwell and grace, including reactive getters", () => {
    const dwell = ref(120);
    const rail = mountRail({ peekDelay: () => dwell.value, peekGrace: 60 });
    rail.collapse();
    rail.onPointerEnter();
    vi.advanceTimersByTime(119);
    expect(rail.peeking.value).toBe(false);
    vi.advanceTimersByTime(1);
    expect(rail.peeking.value).toBe(true);

    // Re-entry inside the grace keeps the OPEN peek open (no flicker) —
    // it must not close and re-open through a second dwell.
    rail.onPointerLeave();
    vi.advanceTimersByTime(59);
    rail.onPointerEnter();
    vi.advanceTimersByTime(SIDEBAR_RAIL_PEEK_GRACE * 4);
    expect(rail.peeking.value, "re-entry keeps the open peek open").toBe(true);

    dwell.value = 500; // a dwell armed AFTER this point reads the NEW value
    // Close fully, re-enter, and the fresh arm waits the new 500ms.
    rail.onPointerLeave();
    vi.advanceTimersByTime(60);
    expect(rail.peeking.value).toBe(false);
    rail.onPointerEnter();
    vi.advanceTimersByTime(499);
    expect(rail.peeking.value, "the re-armed dwell reads the new getter value").toBe(false);
    vi.advanceTimersByTime(1);
    expect(rail.peeking.value).toBe(true);
  });

  it("a zero dwell opens instantly and a zero grace closes instantly", () => {
    const rail = mountRail({ peekDelay: 0, peekGrace: 0 });
    rail.collapse();
    rail.onPointerEnter();
    expect(rail.peeking.value).toBe(true);
    rail.onPointerLeave();
    expect(rail.peeking.value).toBe(false);
  });

  it("Escape closes an open peek and reports consuming the key", () => {
    const rail = mountRail();
    rail.collapse();
    rail.onPointerEnter();
    vi.advanceTimersByTime(SIDEBAR_RAIL_PEEK_DELAY);

    const escape = new KeyboardEvent("keydown", { key: "Escape" });
    expect(rail.onKeydown(escape)).toBe(true);
    expect(rail.peeking.value).toBe(false);

    // With no peek open, Escape is not the machine's to consume…
    expect(rail.onKeydown(escape)).toBe(false);
    // …and other keys never were.
    expect(rail.onKeydown(new KeyboardEvent("keydown", { key: "Tab" }))).toBe(false);
  });

  it("toggle from inside a peek pins the sidebar expanded", () => {
    const rail = mountRail();
    rail.collapse();
    rail.onPointerEnter();
    vi.advanceTimersByTime(SIDEBAR_RAIL_PEEK_DELAY);
    expect(rail.peeking.value).toBe(true);

    rail.toggle();
    expect(rail.collapsed.value).toBe(false);
    expect(rail.peeking.value).toBe(false);
  });

  it("an external collapse→expand flip absorbs an open peek", () => {
    const external = ref(true);
    const rail = mountRail({ collapsed: external as Ref<boolean> });
    rail.onPointerEnter();
    vi.advanceTimersByTime(SIDEBAR_RAIL_PEEK_DELAY);
    expect(rail.peeking.value).toBe(true);

    external.value = false;
    expect(rail.collapsed.value).toBe(false);
    expect(rail.peeking.value, "expanding absorbs the peek").toBe(false);
  });

  it("writes the owner state through the writable collapsed ref", () => {
    const external = ref(false);
    const rail = mountRail({ collapsed: external as Ref<boolean> });
    rail.toggle();
    expect(external.value).toBe(true);
    rail.expand();
    expect(external.value).toBe(false);
    rail.collapse();
    expect(external.value).toBe(true);
  });

  it("clears pending timers when the scope dies", () => {
    const rail = mountRail();
    rail.collapse();
    rail.onPointerEnter();
    expect(vi.getTimerCount()).toBe(1);

    const { app, container } = mounts.splice(0)[0]!;
    app.unmount();
    container.remove();
    expect(vi.getTimerCount(), "unmount clears the dwell arm").toBe(0);
    vi.advanceTimersByTime(SIDEBAR_RAIL_PEEK_DELAY);
    expect(rail.peeking.value).toBe(false);
  });
});
