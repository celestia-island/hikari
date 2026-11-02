import { afterEach, describe, expect, it, vi } from "vitest";

import {
  armTouchHint,
  installHkTouchHintBridge,
  type HkTouchHintOptions,
} from "./touchHint";
import { usePopupManager } from "./usePopupManager";

/**
 * installHkTouchHintBridge / armTouchHint contract tests:
 * - engage: a touch/pen pointerdown over an anchor starts the hold; the
 *   anchor is guarded (user-select / -webkit-touch-callout none) for the
 *   duration and restored on every exit; mouse NEVER engages
 * - fire: after holdMs the bar shows the resolved text — resolve()
 *   override wins, else title, else the hover bridge's data-hk-title
 *   stash; empty resolution shows nothing
 * - cancel: pointermove beyond slopPx (same pointerId), pointercancel,
 *   early pointerup, or ANY scroll while pending
 * - bar lifecycle: visible while the finger is down, lingers after the
 *   pointerup, hidden immediately by pointerdown/scroll/Escape/blur
 * - exactly ONE contextmenu inside the anchor is swallowed after a fire
 *   (Android long-press menus) — the second is a real gesture
 * - exclude + disabled anchors never engage; the bar mounts inside
 *   #hk-overlay-root with the tooltip-band z; idempotent install per
 *   document, uninstall tears the delegation down
 */

const manager = usePopupManager();

function install(options: HkTouchHintOptions = {}) {
  const uninstall = installHkTouchHintBridge(options);
  uninstalls.push(uninstall);
  return uninstall;
}

const uninstalls: Array<() => void> = [];

function trigger(title: string): HTMLElement {
  const el = document.createElement("button");
  el.setAttribute("title", title);
  el.textContent = "probe";
  document.body.appendChild(el);
  return el;
}

/** The gesture drivers: every event a phone ride produces, pointed at
 *  document-level capture exactly like the recognizer binds them. */
function press(el: Element, init: PointerEventInit = {}) {
  el.dispatchEvent(new PointerEvent("pointerdown", {
    pointerType: "touch",
    pointerId: 1,
    clientX: 100,
    clientY: 100,
    bubbles: true,
    ...init,
  }));
}

function move(x: number, y: number, init: PointerEventInit = {}) {
  document.dispatchEvent(new PointerEvent("pointermove", {
    pointerType: "touch",
    pointerId: 1,
    clientX: x,
    clientY: y,
    bubbles: true,
    ...init,
  }));
}

function release(init: PointerEventInit = {}) {
  document.dispatchEvent(new PointerEvent("pointerup", {
    pointerType: "touch",
    pointerId: 1,
    bubbles: true,
    ...init,
  }));
}

function cancelGesture() {
  document.dispatchEvent(new PointerEvent("pointercancel", {
    pointerType: "touch",
    pointerId: 1,
    bubbles: true,
  }));
}

function scrollAnywhere() {
  document.dispatchEvent(new Event("scroll"));
}

function bar(): HTMLElement | null {
  return document.querySelector<HTMLElement>(".hk-touch-hint-bar");
}

function shown(): boolean {
  return bar()?.classList.contains("is-on") ?? false;
}

afterEach(() => {
  vi.useRealTimers();
  // End any hold still in flight (restores anchor guards), then tear the
  // delegation down and sweep the shared singletons the way the sibling
  // suites sweep the popup registry.
  release();
  for (const u of uninstalls.splice(0)) u();
  for (const entry of [...manager.registry.value.values()]) {
    manager.unregister(entry.id);
  }
  document.querySelectorAll(".hk-touch-hint-bar").forEach((el) => el.remove());
});

describe("installHkTouchHintBridge", () => {
  it("shows the bar with the title text after a long-press hold", () => {
    vi.useFakeTimers();
    install();
    const el = trigger("Hello touch");
    press(el);
    // Lazy presenter: nothing exists before the first fire.
    expect(bar()).toBeNull();
    vi.advanceTimersByTime(449);
    expect(shown()).toBe(false);
    vi.advanceTimersByTime(1);
    expect(shown()).toBe(true);
    expect(bar()!.textContent).toBe("Hello touch");
    // status + polite: the hint ANNOUNCES itself without interrupting.
    expect(bar()!.getAttribute("role")).toBe("status");
    expect(bar()!.getAttribute("aria-live")).toBe("polite");
    // Same home and band as every other tooltip face: inside the overlay
    // root, z stamped inline from the tooltip-kind popup-manager handle.
    expect(bar()!.parentElement).toBe(document.querySelector("#hk-overlay-root"));
    expect(Number(bar()!.style.zIndex)).toBeGreaterThanOrEqual(300);
  });

  it("engages pen holds too, but never mouse", () => {
    vi.useFakeTimers();
    install();
    const pen = trigger("Stylus");
    press(pen, { pointerType: "pen" });
    vi.advanceTimersByTime(450);
    expect(shown()).toBe(true);
    expect(bar()!.textContent).toBe("Stylus");

    const mouse = trigger("Rodent");
    press(mouse, { pointerType: "mouse" });
    vi.advanceTimersByTime(1000);
    expect(bar()?.textContent).toBe("Stylus"); // unchanged — no new hint
  });

  it("lets resolve() override the text, and an empty resolution show nothing", () => {
    vi.useFakeTimers();
    install({
      resolve: (el) =>
        el.classList.contains("special") ? `custom:${el.getAttribute("title")}` : null,
    });
    const special = trigger("Winner");
    special.classList.add("special");
    press(special);
    vi.advanceTimersByTime(450);
    expect(bar()!.textContent).toBe("custom:Winner");
    release(); // the fired hold owns the engage slot until the lift

    // resolve() yielding null falls through to the attribute chain…
    const plain = trigger("Fallback");
    press(plain);
    vi.advanceTimersByTime(450);
    expect(bar()!.textContent).toBe("Fallback");
  });

  it("falls back to the hover bridge's data-hk-title stash", () => {
    vi.useFakeTimers();
    // The hover bridge stashes a held title in data-hk-title and REMOVES
    // the attribute — so the touch resolver must read the stash.
    install({ selector: "[title],[data-hk-title]" });
    const stashed = document.createElement("button");
    stashed.setAttribute("data-hk-title", "Stashed");
    document.body.appendChild(stashed);
    press(stashed);
    vi.advanceTimersByTime(450);
    expect(bar()!.textContent).toBe("Stashed");
    release(); // the fired hold owns the engage slot until the lift

    // When both exist, the live title attribute wins.
    const both = trigger("Live title");
    both.setAttribute("data-hk-title", "Stale stash");
    press(both);
    vi.advanceTimersByTime(450);
    expect(bar()!.textContent).toBe("Live title");
  });

  it("cancels when the pointer moves beyond the slop before the hold elapses", () => {
    vi.useFakeTimers();
    install();
    // Within the default 10px slop the hold survives…
    const steady = trigger("Steady");
    press(steady);
    move(100 + 10, 100); // exactly at the slop, not beyond
    vi.advanceTimersByTime(450);
    expect(shown()).toBe(true);
    expect(bar()!.textContent).toBe("Steady");
    release(); // the fired hold owns the engage slot until the lift

    // …beyond it the finger was scrolling, not asking.
    const scroller = trigger("Scroller");
    press(scroller);
    move(100 + 11, 100);
    vi.advanceTimersByTime(1000);
    expect(shown()).toBe(false); // the new press retired the old bar…
    // …and the cancelled hold never fired its own text into it.
    expect(bar()?.textContent).toBe("Steady");

    // A different pointer's travels never cancel the held one.
    const steady2 = trigger("Steady2");
    press(steady2);
    move(400, 400, { pointerId: 9 }); // someone else's finger
    vi.advanceTimersByTime(450);
    expect(bar()?.textContent).toBe("Steady2");
  });

  it("cancels on pointercancel", () => {
    vi.useFakeTimers();
    install();
    const el = trigger("Reclaimed");
    press(el);
    vi.advanceTimersByTime(200);
    cancelGesture();
    vi.advanceTimersByTime(1000);
    expect(shown()).toBe(false);
  });

  it("cancels on an early pointerup (a quick tap hints nothing)", () => {
    vi.useFakeTimers();
    install();
    const el = trigger("Tapped");
    press(el);
    vi.advanceTimersByTime(100);
    release();
    vi.advanceTimersByTime(1000);
    expect(shown()).toBe(false);
  });

  it("scroll cancels a pending hold and hides a shown bar", () => {
    vi.useFakeTimers();
    install();
    // Pending: the scroll of a finger that gave up on the hold.
    const pending = trigger("Pending");
    press(pending);
    vi.advanceTimersByTime(100);
    scrollAnywhere();
    vi.advanceTimersByTime(1000);
    expect(shown()).toBe(false);

    // Shown: any scroll invalidates the inspected-content premise.
    const live = trigger("Live");
    press(live);
    vi.advanceTimersByTime(450);
    expect(shown()).toBe(true);
    scrollAnywhere();
    expect(shown()).toBe(false);
  });

  it("stays while the finger is down and lingers after the pointerup", () => {
    vi.useFakeTimers();
    install();
    const el = trigger("Hold and read");
    press(el);
    vi.advanceTimersByTime(450);
    expect(shown()).toBe(true);
    // A long read with the finger still down: no timer is running.
    vi.advanceTimersByTime(5000);
    expect(shown()).toBe(true);
    release();
    expect(shown()).toBe(true); // linger starts, it does not end, here
    vi.advanceTimersByTime(2199);
    expect(shown()).toBe(true);
    vi.advanceTimersByTime(1);
    expect(shown()).toBe(false);
  });

  it("hides immediately on a new pointerdown, Escape and window blur", () => {
    vi.useFakeTimers();
    install();
    const el = trigger("Dismiss me");
    press(el);
    vi.advanceTimersByTime(450);
    expect(shown()).toBe(true);

    const next = trigger("Next");
    press(next);
    expect(shown()).toBe(false); // the new press retired the old hint
    release(); // the fired hold owns the engage slot until the lift

    press(el);
    vi.advanceTimersByTime(450);
    expect(shown()).toBe(true);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(shown()).toBe(false);
    release();

    press(el);
    vi.advanceTimersByTime(450);
    expect(shown()).toBe(true);
    window.dispatchEvent(new Event("blur"));
    expect(shown()).toBe(false);
    release();
  });

  it("skips excluded and disabled anchors", () => {
    vi.useFakeTimers();
    install({ exclude: ".quiet" });
    const excluded = trigger("Excluded");
    excluded.className = "quiet";
    press(excluded);
    vi.advanceTimersByTime(1000);
    expect(bar()).toBeNull();

    const disabled = trigger("Disabled");
    // The content attribute reflects into the control's disabled face.
    disabled.setAttribute("disabled", "");
    press(disabled);
    vi.advanceTimersByTime(1000);
    expect(bar()).toBeNull();
  });

  it("suppresses exactly one contextmenu inside the anchor after a fire", () => {
    vi.useFakeTimers();
    install();
    const el = trigger("Android");
    press(el);
    vi.advanceTimersByTime(450);
    // Elsewhere first: not ours to swallow, and the flag stays armed.
    const elsewhere = document.createElement("div");
    document.body.appendChild(elsewhere);
    const outside = new MouseEvent("contextmenu", { bubbles: true, cancelable: true });
    elsewhere.dispatchEvent(outside);
    expect(outside.defaultPrevented).toBe(false);

    const first = new MouseEvent("contextmenu", { bubbles: true, cancelable: true });
    el.dispatchEvent(first);
    expect(first.defaultPrevented).toBe(true); // the synthesized menu dies
    const second = new MouseEvent("contextmenu", { bubbles: true, cancelable: true });
    el.dispatchEvent(second);
    expect(second.defaultPrevented).toBe(false); // a real ask passes
    elsewhere.remove();
  });

  it("guards userSelect/touchCallout for the hold and restores them after", () => {
    vi.useFakeTimers();
    install();
    // The cancel path (early lift)…
    const cancelled = trigger("Cancelled");
    cancelled.style.setProperty("user-select", "text");
    press(cancelled);
    expect(cancelled.style.getPropertyValue("user-select")).toBe("none");
    expect(cancelled.style.getPropertyValue("-webkit-touch-callout")).toBe("none");
    release();
    expect(cancelled.style.getPropertyValue("user-select")).toBe("text");
    expect(cancelled.style.getPropertyValue("-webkit-touch-callout")).toBe("");

    // …and the fired path (guards outlive the fire until the lift).
    const fired = trigger("Fired");
    press(fired);
    vi.advanceTimersByTime(450);
    expect(fired.style.getPropertyValue("user-select")).toBe("none");
    release();
    expect(fired.style.getPropertyValue("user-select")).toBe("");
    expect(fired.style.getPropertyValue("-webkit-touch-callout")).toBe("");
  });

  it("is idempotent per document and uninstallable", () => {
    vi.useFakeTimers();
    install();
    // The duplicate install reuses the first bridge: its uninstaller
    // tears THAT one down, after which no hold ever engages.
    const second = installHkTouchHintBridge();
    const el = trigger("After uninstall");
    second();
    press(el);
    vi.advanceTimersByTime(1000);
    expect(bar()).toBeNull();
  });
});

describe("armTouchHint", () => {
  it("runs the same recognizer for a known element + text", () => {
    vi.useFakeTimers();
    const el = document.createElement("span");
    document.body.appendChild(el);
    const cancel = armTouchHint(el, "  Component text  ", {
      pointerId: 4,
      origin: { x: 100, y: 100 },
    });
    vi.advanceTimersByTime(450);
    expect(shown()).toBe(true);
    expect(bar()!.textContent).toBe("Component text"); // trimmed
    // The cancel function retires a pending hold before it fires.
    const el2 = document.createElement("span");
    document.body.appendChild(el2);
    const cancel2 = armTouchHint(el2, "Never", { origin: { x: 0, y: 0 } });
    cancel2();
    vi.advanceTimersByTime(1000);
    expect(bar()?.textContent).toBe("Component text");
    cancel();
    el.remove();
    el2.remove();
  });
});
