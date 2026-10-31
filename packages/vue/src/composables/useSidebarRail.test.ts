import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h, nextTick, ref, type Ref } from "vue";

import { __teardownMediaQueries } from "../runtime/useMediaQuery";
import {
  useSidebarRail,
  SIDEBAR_RAIL_CLIP_SELECTOR,
  SIDEBAR_RAIL_PEEK_DELAY,
  SIDEBAR_RAIL_PEEK_GRACE,
  SIDEBAR_RAIL_PIN_FALLBACK,
  SIDEBAR_RAIL_TOGGLE_BUTTON_SELECTOR,
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
 *    any open peek, and opens a PIN window (the rail -> expanded
 *    transition) that clears on the host's transitionend, on the
 *    fallback timer, or on a collapse.
 * 5. Suppression (2026-10-30, the reported hover twitch): while the
 *    pointer rests on the toggle the dwell may not arm — a pending arm is
 *    dropped and fresh arms are refused — while an OPEN peek is never
 *    closed by it. Releasing suppression with the pointer still on the
 *    rail re-arms a FULL dwell.
 * 6. A pointerleave whose relatedTarget is still inside the host region
 *    is DOM churn, not a leave: it neither starts the grace close nor
 *    kills the arm.
 * 7. Unmount clears pending timers.
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

describe("useSidebarRail — peek suppression (the hover-twitch fix)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("drops a pending arm and refuses to arm while suppressed", () => {
    const rail = mountRail();
    rail.collapse();
    // The pointer entered the rail (normal arm) and THEN landed on the
    // toggle: the host's first pointermove suppresses, which must kill
    // the dwell already counting down.
    rail.onPointerEnter();
    expect(vi.getTimerCount()).toBe(1);
    rail.setPeekSuppressed(true);
    expect(rail.peekSuppressed.value).toBe(true);
    expect(vi.getTimerCount(), "suppression clears the pending arm").toBe(0);

    vi.advanceTimersByTime(SIDEBAR_RAIL_PEEK_DELAY * 4);
    expect(rail.peeking.value, "the drawer never opens under a resting cursor").toBe(false);

    // A fresh pointerenter while suppressed must not arm either.
    rail.onPointerEnter();
    vi.advanceTimersByTime(SIDEBAR_RAIL_PEEK_DELAY * 4);
    expect(rail.peeking.value).toBe(false);
  });

  it("re-arms a FULL dwell when suppression is released with the pointer still on the rail", () => {
    const rail = mountRail();
    rail.collapse();
    rail.onPointerEnter();
    rail.setPeekSuppressed(true);
    vi.advanceTimersByTime(SIDEBAR_RAIL_PEEK_DELAY * 2);
    expect(rail.peeking.value).toBe(false);

    // The pointer moved OFF the toggle but stayed inside the rail.
    rail.setPeekSuppressed(false);
    vi.advanceTimersByTime(SIDEBAR_RAIL_PEEK_DELAY - 1);
    expect(rail.peeking.value, "a full fresh dwell, not a stale remainder").toBe(false);
    vi.advanceTimersByTime(1);
    expect(rail.peeking.value, "off the toggle the peek arms normally").toBe(true);
  });

  it("never closes an OPEN peek", () => {
    const rail = mountRail();
    rail.collapse();
    rail.onPointerEnter();
    vi.advanceTimersByTime(SIDEBAR_RAIL_PEEK_DELAY);
    expect(rail.peeking.value).toBe(true);

    rail.setPeekSuppressed(true);
    vi.advanceTimersByTime(SIDEBAR_RAIL_PEEK_DELAY * 4);
    expect(rail.peeking.value, "suppression is about ARMING, never closing").toBe(true);
  });

  it("arms nothing while expanded, suppressed or not", () => {
    const rail = mountRail();
    rail.setPeekSuppressed(true);
    rail.onPointerEnter();
    vi.advanceTimersByTime(SIDEBAR_RAIL_PEEK_DELAY * 4);
    expect(rail.peeking.value).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("leaves no arm timer behind once the peek opens", () => {
    const rail = mountRail();
    rail.collapse();
    rail.onPointerEnter();
    expect(vi.getTimerCount()).toBe(1);
    vi.advanceTimersByTime(SIDEBAR_RAIL_PEEK_DELAY);
    expect(rail.peeking.value).toBe(true);
    expect(vi.getTimerCount(), "the fired arm owns no timer").toBe(0);
  });
});

describe("useSidebarRail — leave hardening (DOM churn is not a leave)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  /** A host region with a child inside it, plus a sibling OUTSIDE it. */
  function region() {
    const host = document.createElement("div");
    const inner = document.createElement("button");
    host.appendChild(inner);
    const outside = document.createElement("div");
    document.body.append(host, outside);
    return {
      host,
      inner,
      outside,
      cleanup: () => {
        host.remove();
        outside.remove();
      },
    };
  }

  it("ignores a leave whose relatedTarget is still inside the host region", () => {
    const r = region();
    try {
      const rail = mountRail({ host: () => r.host });
      rail.collapse();
      rail.onPointerEnter();
      vi.advanceTimersByTime(SIDEBAR_RAIL_PEEK_DELAY);
      expect(rail.peeking.value).toBe(true);

      rail.onPointerLeave({ relatedTarget: r.inner });
      vi.advanceTimersByTime(SIDEBAR_RAIL_PEEK_GRACE * 4);
      expect(rail.peeking.value, "churn must not start a grace close").toBe(true);

      // …while a REAL leave (relatedTarget outside) still closes it.
      rail.onPointerLeave({ relatedTarget: r.outside });
      vi.advanceTimersByTime(SIDEBAR_RAIL_PEEK_GRACE);
      expect(rail.peeking.value).toBe(false);
    } finally {
      r.cleanup();
    }
  });

  it("keeps a pending arm alive across churn inside the region", () => {
    const r = region();
    try {
      const rail = mountRail({ host: () => r.host });
      rail.collapse();
      rail.onPointerEnter();
      vi.advanceTimersByTime(120);
      rail.onPointerLeave({ relatedTarget: r.inner });
      vi.advanceTimersByTime(SIDEBAR_RAIL_PEEK_DELAY);
      expect(rail.peeking.value, "the arm survives the churn").toBe(true);
    } finally {
      r.cleanup();
    }
  });

  it("treats a leave with no event / no relatedTarget as a real leave", () => {
    const rail = mountRail();
    rail.collapse();
    rail.onPointerEnter();
    rail.onPointerLeave();
    rail.onPointerLeave(null);
    vi.advanceTimersByTime(SIDEBAR_RAIL_PEEK_DELAY * 2);
    expect(rail.peeking.value).toBe(false);
  });
});

describe("useSidebarRail — pin window (expand must not replay the slide)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("opens on a rail -> expanded flip and clears on the fallback", () => {
    const rail = mountRail();
    rail.collapse();
    expect(rail.pinning.value).toBe(false);
    rail.expand();
    expect(rail.pinning.value, "the rail -> expanded window is pinned").toBe(true);

    vi.advanceTimersByTime(SIDEBAR_RAIL_PIN_FALLBACK - 1);
    expect(rail.pinning.value).toBe(true);
    vi.advanceTimersByTime(1);
    expect(rail.pinning.value, "the fallback closes the window").toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("clears early on the host's width transition (endPinning) and drops the fallback", () => {
    const rail = mountRail();
    rail.collapse();
    rail.expand();
    expect(vi.getTimerCount()).toBe(1);
    rail.endPinning();
    expect(rail.pinning.value).toBe(false);
    expect(vi.getTimerCount(), "the fallback timer is dropped with the window").toBe(0);
  });

  it("pins the peek-pin path too (toggle during an open peek)", () => {
    const rail = mountRail();
    rail.collapse();
    rail.onPointerEnter();
    vi.advanceTimersByTime(SIDEBAR_RAIL_PEEK_DELAY);
    expect(rail.peeking.value).toBe(true);

    rail.toggle();
    expect(rail.collapsed.value).toBe(false);
    expect(rail.peeking.value).toBe(false);
    expect(rail.pinning.value, "a peek pin is still a rail -> expanded flip").toBe(true);
  });

  it("never pins a collapse, and a collapse closes an open window", () => {
    const rail = mountRail();
    rail.expand(); // already expanded: no rail -> expanded transition
    expect(rail.pinning.value).toBe(false);

    rail.collapse();
    expect(rail.pinning.value).toBe(false);

    rail.expand();
    expect(rail.pinning.value).toBe(true);
    rail.collapse();
    expect(rail.pinning.value, "collapsing ends the window immediately").toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("skips the window under reduced motion — nothing is animating to mask", () => {
    // The shared subscription caches per query string: clear it so this
    // mount reads the stubbed reduce state instead of a cached false.
    __teardownMediaQueries();
    // A REAL MediaQueryList with `matches` shadowed: `matches` is getter-only
    // on the real object, and a literal cannot stand in for the interface.
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    Object.defineProperty(reduced, "matches", { configurable: true, value: true });
    vi.spyOn(window, "matchMedia").mockReturnValue(reduced);
    try {
      const rail = mountRail();
      expect(rail.reducedMotion.value).toBe(true);
      rail.collapse();
      rail.expand();
      expect(rail.pinning.value).toBe(false);
      expect(vi.getTimerCount(), "no fallback timer either").toBe(0);
    } finally {
      vi.mocked(window.matchMedia).mockRestore();
      __teardownMediaQueries();
    }
  });
});
describe("useSidebarRail — peek-close focus handoff (2026-10-31)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  /** The rail host DOM the handoff reasons about: the swapped content
   *  window (the clip) with a focused row inside, the straddling toggle
   *  OUTSIDE it (the handoff target), and panel chrome that is neither.
   *  Built from the EXPORTED selectors, so a drifted constant fails here
   *  (it would look for a target the real markup never renders). */
  function focusFixture() {
    // "…-toggle button" -> the wrapper's class name (drop the leading ".").
    const toggleClass = SIDEBAR_RAIL_TOGGLE_BUTTON_SELECTOR.split(" ")[0]!.slice(1);
    const host = document.createElement("div");
    host.innerHTML = [
      `<div class="${SIDEBAR_RAIL_CLIP_SELECTOR.slice(1)}"><button class="nav-row">nav</button></div>`,
      `<div class="${toggleClass}"><button class="toggle-btn">toggle</button></div>`,
      '<button class="panel-chrome">chrome</button>',
    ].join("");
    document.body.appendChild(host);
    const outside = document.createElement("button");
    document.body.appendChild(outside);
    return {
      host,
      row: host.querySelector<HTMLButtonElement>(".nav-row")!,
      toggle: host.querySelector<HTMLButtonElement>(SIDEBAR_RAIL_TOGGLE_BUTTON_SELECTOR)!,
      chrome: host.querySelector<HTMLButtonElement>(".panel-chrome")!,
      outside,
      cleanup: () => {
        host.remove();
        outside.remove();
      },
    };
  }

  /** Open a peek on the fixture's host. */
  function openPeek(f: ReturnType<typeof focusFixture>): SidebarRailHandle {
    const rail = mountRail({ host: () => f.host });
    rail.collapse();
    rail.onPointerEnter();
    vi.advanceTimersByTime(SIDEBAR_RAIL_PEEK_DELAY);
    expect(rail.peeking.value).toBe(true);
    return rail;
  }

  it("hands focus to the toggle when the focused row is inside the swapped clip", async () => {
    const f = focusFixture();
    try {
      const rail = openPeek(f);
      f.row.focus();
      expect(document.activeElement).toBe(f.row);

      rail.closePeek();
      await nextTick();
      expect(
        document.activeElement,
        "the focused row is unmounted by the flip — focus must land on the toggle",
      ).toBe(f.toggle);
    } finally {
      f.cleanup();
    }
  });

  it("Escape closes through the same handoff (the keyboard path)", async () => {
    const f = focusFixture();
    try {
      const rail = openPeek(f);
      f.row.focus();
      const consumed = rail.onKeydown(new KeyboardEvent("keydown", { key: "Escape" }));
      expect(consumed).toBe(true);
      await nextTick();
      expect(document.activeElement).toBe(f.toggle);
    } finally {
      f.cleanup();
    }
  });

  it("leaves focus alone when it lives OUTSIDE the swapped clip", async () => {
    const f = focusFixture();
    try {
      const rail = openPeek(f);

      // Panel chrome inside the host but outside the clip survives the
      // flip — it keeps the focus it had.
      f.chrome.focus();
      rail.closePeek();
      await nextTick();
      expect(document.activeElement).toBe(f.chrome);

      // Focus outside the host entirely is never touched either.
      const rail2 = openPeek(f);
      f.outside.focus();
      rail2.closePeek();
      await nextTick();
      expect(document.activeElement).toBe(f.outside);
    } finally {
      f.cleanup();
    }
  });

  it("a NO-OP closePeek (no open peek) never steals focus", async () => {
    const f = focusFixture();
    try {
      const rail = mountRail({ host: () => f.host });
      f.row.focus();
      rail.closePeek(); // expanded, nothing to close — a nav-click path
      await nextTick();
      expect(document.activeElement, "navigation focus stays where the user put it").toBe(f.row);
    } finally {
      f.cleanup();
    }
  });

  it("the pointerleave GRACE close hands off too (the most common close)", async () => {
    // Regression pin for the 2026-10-31 review finding: the grace timer
    // and the grace<=0 branch used to write `peeking` directly, bypassing
    // the handoff — hover-peek, focus a header inside it, move the
    // pointer away, and focus died with the leaving generation.
    const f = focusFixture();
    try {
      const rail = openPeek(f);
      f.row.focus();

      rail.onPointerLeave();
      vi.advanceTimersByTime(SIDEBAR_RAIL_PEEK_GRACE - 1);
      expect(rail.peeking.value, "still inside the grace").toBe(true);
      expect(document.activeElement, "focus untouched before the close").toBe(f.row);

      vi.advanceTimersByTime(1);
      expect(rail.peeking.value).toBe(false);
      expect(document.activeElement, "the grace close hands focus to the toggle").toBe(f.toggle);
    } finally {
      f.cleanup();
    }
  });

  it("the grace<=0 branch (no grace configured) hands off as well", async () => {
    const f = focusFixture();
    try {
      const rail = mountRail({ host: () => f.host, peekGrace: 0 });
      rail.collapse();
      rail.onPointerEnter();
      vi.advanceTimersByTime(SIDEBAR_RAIL_PEEK_DELAY);
      expect(rail.peeking.value).toBe(true);
      f.row.focus();

      rail.onPointerLeave();
      expect(rail.peeking.value).toBe(false);
      expect(document.activeElement).toBe(f.toggle);
    } finally {
      f.cleanup();
    }
  });
});

