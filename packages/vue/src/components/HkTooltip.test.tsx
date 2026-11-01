import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, h, nextTick } from "vue";

import HkTooltip, { type HkTooltipSlotProps } from "./HkTooltip";
import { POPUP_Z_BANDS, POPUP_Z_STEP, usePopupManager } from "../runtime/usePopupManager";

/**
 * HkTooltip contract tests:
 * - popup-manager registration: every mounted tooltip registers ONE
 *   entry of kind "tooltip" in the real singleton registry (read back
 *   through usePopupManager), stacked in the tooltip z band (above the
 *   window/dropdown bands, below toasts), never scroll-locking; the
 *   entry leaves the registry on unmount
 * - the band z lands INLINE on the teleported popup element
 * - show/hide: anchor mouseenter shows after the delay (default 300ms),
 *   mouseleave hides and cancels a pending show; focusin/focusout ride
 *   the same path
 * - the touch half: a touch/pen press ARMS the long-press recognizer of
 *   runtime/touchHint.ts — the hint surfaces in the top-docked touch
 *   hint bar, never in the anchored popup (which stays hover/focus
 *   only); a quick tap shows nothing at all, and the tap's synthetic
 *   mouseenter cannot flash the popup
 * - anchoring: placement drives the popup class, the wrapper
 *   data-position and the measured offset style (happy-dom reports a
 *   zero rect, so the numbers pin the 8px gap and per-placement
 *   transform)
 *
 * House style: raw createApp mounts on a shared container list torn
 * down after each case; the popup-manager singleton is REAL state, so
 * afterEach sweeps it the way usePopupManager.test.ts does.
 */

const mounts: Array<{ app: ReturnType<typeof createApp>; container: HTMLElement }> = [];

function mount(props: Record<string, unknown> = {}) {
  const container = document.createElement("div");
  (document.querySelector('#hk-overlay-root') ?? document.body).appendChild(container);
  const app = createApp({
    render: () =>
      h(HkTooltip, props as never, () => h("span", { class: "anchor-probe" }, "anchor")),
  });
  app.mount(container);
  mounts.push({ app, container });
  return { app, container };
}

const manager = usePopupManager();

function tooltipEntries() {
  return [...manager.registry.value.values()].filter((e) => e.kind === "tooltip");
}

function popup(): HTMLElement {
  return document.querySelector<HTMLElement>(".hk-tooltip-popup")!;
}

function wrapper(c: HTMLElement): HTMLElement {
  return c.querySelector<HTMLElement>(".hk-tooltip-wrapper")!;
}

/** real-timer settle: covers the show setTimeout(0) + the rAF position pass */
async function settle() {
  await new Promise((r) => setTimeout(r, 20));
  await nextTick();
  // Wait for the show-time rAF position pass itself; a wall-clock sleep is
  // not a frame barrier under a loaded test host.
  await new Promise<void>((resolve) => { requestAnimationFrame(() => resolve()); });
  await nextTick();
}

function enter(c: HTMLElement) {
  wrapper(c).dispatchEvent(new MouseEvent("mouseenter"));
}

function leave(c: HTMLElement) {
  wrapper(c).dispatchEvent(new MouseEvent("mouseleave"));
}

afterEach(() => {
  vi.useRealTimers();
  for (const { app, container } of mounts.splice(0)) {
    app.unmount();
    container.remove();
  }
  // The registry is a module singleton — sweep leftovers so tests do not
  // leak z state (same discipline as usePopupManager.test.ts).
  for (const entry of [...manager.registry.value.values()]) {
    manager.unregister(entry.id);
  }
  document.querySelectorAll(".hk-tooltip-popup").forEach((el) => el.remove());
  // The touch hint bar is presenter-owned module state — tear the node
  // out so the next case remounts it fresh (it self-heals on show).
  document.querySelectorAll(".hk-touch-hint-bar").forEach((el) => el.remove());
});

describe("HkTooltip popup-manager registration", () => {
  it("defers the band entry until the first engage (lazy contract)", () => {
    mount({ text: "dormant" });
    // A never-engaged tooltip — the dense-list majority — costs no
    // teleported popup and no registry entry at all.
    expect(document.querySelector(".hk-tooltip-popup")).toBeNull();
    expect(tooltipEntries().length).toBe(0);
  });

  it("registers one tooltip-kind entry at the tooltip band and stamps its z inline", async () => {
    const { container } = mount({ text: "hello" });
    enter(container);
    await settle();
    const entries = tooltipEntries();
    expect(entries.length).toBe(1);
    expect(entries[0]!.kind).toBe("tooltip");
    expect(entries[0]!.zIndex).toBe(POPUP_Z_BANDS.tooltip);
    // Tooltips are transient annotations — they never lock scroll.
    expect(entries[0]!.locksScroll).toBe(false);
    expect(document.body.style.overflow).not.toBe("hidden");
    // The band z lands on the teleported popup element, overriding the
    // --hi-z-tooltip SCSS fallback.
    expect(popup().style.zIndex).toBe(String(POPUP_Z_BANDS.tooltip));
  });

  it("stacks a second tooltip one step above within the band", async () => {
    const a = mount({ text: "one" });
    const b = mount({ text: "two" });
    enter(a.container);
    enter(b.container);
    await settle();
    const entries = tooltipEntries();
    expect(entries.length).toBe(2);
    const zs = entries.map((e) => e.zIndex).sort((x, y) => x - y);
    expect(zs[1]).toBe(zs[0]! + POPUP_Z_STEP);
    expect(zs[0]).toBeGreaterThanOrEqual(POPUP_Z_BANDS.tooltip);
  });

  it("removes its registry entry on unmount", async () => {
    const { app, container } = mount({ text: "bye" });
    enter(container);
    await settle();
    expect(tooltipEntries().length).toBe(1);
    app.unmount();
    expect(tooltipEntries().length).toBe(0);
  });

  it("keeps a single registration across show/hide cycles", async () => {
    const { container } = mount({ text: "stable", delay: 0 });
    enter(container);
    await settle();
    leave(container);
    await nextTick();
    enter(container);
    await settle();
    expect(tooltipEntries().length).toBe(1);
  });
});

describe("HkTooltip show/hide", () => {
  it("mounts the popup on first engage and keeps it hidden after hide, with the text content", async () => {
    const { container } = mount({ text: "the tip" });
    // Nothing before the first engage…
    expect(document.querySelector(".hk-tooltip-popup")).toBeNull();
    // …then engage and hide: the popup persists, hidden, for reuse.
    enter(container);
    await settle();
    leave(container);
    await nextTick();
    const el = popup();
    expect(document.body.contains(el)).toBe(true);
    // The tooltip teleports into the overlay root (a child of body).
    expect(el.className).not.toContain("hk-tooltip-visible");
    expect(el.querySelector(".hk-tooltip-content")!.textContent).toBe("the tip");
    // The anchor slot renders inside the wrapper's trigger span.
    expect(wrapper(container).querySelector(".hk-tooltip-trigger .anchor-probe")).not.toBeNull();
  });

  it("wires aria: role=tooltip + id on the popup, describedby on the wrapper while visible", async () => {
    const { container } = mount({ text: "a11y tip", delay: 0 });
    enter(container);
    await settle();
    const el = popup();
    expect(el.getAttribute("role")).toBe("tooltip");
    const id = el.getAttribute("id");
    expect(id).toBeTruthy();
    expect(wrapper(container).getAttribute("aria-describedby")).toBe(id);
    leave(container);
    await nextTick();
    expect(wrapper(container).getAttribute("aria-describedby")).toBeNull();
  });

  it("hands { popupId, visible } to the default slot for focus-target wiring", async () => {
    const container = document.createElement("div");
    (document.querySelector('#hk-overlay-root') ?? document.body).appendChild(container);
    let seen: Partial<HkTooltipSlotProps> = {};
    const app = createApp({
      render: () =>
        h(
          HkTooltip,
          { text: "slot props", delay: 0 },
          // Object-form scoped slot; the arg type comes from the local
          // annotation against the exported contract (h()'s RawSlots has
          // no SlotsType-aware overload), not from the slots declaration.
          { default: (slotProps: HkTooltipSlotProps) => {
            seen = slotProps;
            return h("span", { class: "anchor-probe" }, "anchor");
          } },
        ),
    });
    app.mount(container);
    mounts.push({ app, container });
    await nextTick();
    wrapper(container).dispatchEvent(new MouseEvent("mouseenter"));
    await settle();
    expect(seen.visible).toBe(true);
    expect(seen.popupId).toBe(popup().getAttribute("id"));
  });

  it("waits out the default 300ms delay before showing", async () => {
    vi.useFakeTimers();
    const { container } = mount({ text: "delayed" });
    enter(container);
    await vi.advanceTimersByTimeAsync(299);
    await nextTick();
    expect(popup().className).not.toContain("hk-tooltip-visible");

    await vi.advanceTimersByTimeAsync(1);
    await nextTick();
    expect(popup().className).toContain("hk-tooltip-visible");
  });

  it("shows on anchor enter and hides on leave (delay 0)", async () => {
    const { container } = mount({ text: "quick", delay: 0 });
    enter(container);
    await settle();
    expect(popup().className).toContain("hk-tooltip-visible");

    leave(container);
    await nextTick();
    expect(popup().className).not.toContain("hk-tooltip-visible");
  });

  it("cancels a pending show when the anchor is left before the delay elapses", async () => {
    vi.useFakeTimers();
    const { container } = mount({ text: "cancelled", delay: 200 });
    enter(container);
    await vi.advanceTimersByTimeAsync(100);
    leave(container);
    await vi.advanceTimersByTimeAsync(1000);
    await nextTick();
    expect(popup().className).not.toContain("hk-tooltip-visible");
  });

  it("shows on focusin and hides on focusout like hover", async () => {
    const { container } = mount({ text: "focused", delay: 0 });
    container
      .querySelector(".hk-tooltip-trigger")!
      .dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    await settle();
    expect(popup().className).toContain("hk-tooltip-visible");

    container
      .querySelector(".hk-tooltip-trigger")!
      .dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
    await nextTick();
    expect(popup().className).not.toContain("hk-tooltip-visible");
  });
});

describe("HkTooltip touch hint bar", () => {
  // The touch half is the top-docked hint bar (runtime/touchHint.ts):
  // a touch press ARMS a long-press recognizer against the wrapper, and
  // the anchored popup stays a hover/focus (and pen-hover) surface.
  function touchDown(el: Element) {
    el.dispatchEvent(new PointerEvent("pointerdown", {
      pointerType: "touch", pointerId: 1, clientX: 40, clientY: 40, bubbles: true,
    }));
  }

  function touchUp() {
    document.dispatchEvent(new PointerEvent("pointerup", {
      pointerType: "touch", pointerId: 1, bubbles: true,
    }));
  }

  function hintBar(): HTMLElement | null {
    return document.querySelector<HTMLElement>(".hk-touch-hint-bar");
  }

  it("long-press shows the top hint bar with the text, not the anchored popup", async () => {
    vi.useFakeTimers();
    const { container } = mount({ text: "hold me", delay: 3000 });
    touchDown(wrapper(container));
    await vi.advanceTimersByTimeAsync(449);
    expect(hintBar()?.classList.contains("is-on")).toBeFalsy();
    await vi.advanceTimersByTimeAsync(1);
    expect(hintBar()?.classList.contains("is-on")).toBe(true);
    expect(hintBar()?.textContent).toBe("hold me");
    // The anchored popup never enters the touch path: no teleported
    // node at all — the lazy engage never ran.
    expect(document.querySelector(".hk-tooltip-popup")).toBeNull();
    touchUp(); // end the fired hold (restores the wrapper guards)
  });

  it("a quick tap shows neither the anchored popup nor the bar", async () => {
    vi.useFakeTimers();
    const { container } = mount({ text: "tap", delay: 3000 });
    touchDown(wrapper(container));
    await vi.advanceTimersByTimeAsync(100);
    touchUp();
    await vi.advanceTimersByTimeAsync(1000);
    expect(document.querySelector(".hk-tooltip-popup")).toBeNull();
    expect(hintBar()?.classList.contains("is-on")).toBeFalsy();
  });

  it("mouse hover still shows the anchored popup (desktop unchanged)", async () => {
    const { container } = mount({ text: "mouse only", delay: 0 });
    enter(container);
    await settle();
    expect(popup().className).toContain("hk-tooltip-visible");
    expect(hintBar()?.classList.contains("is-on")).toBeFalsy();
  });

  it("ignores mouse pointerdown (the hover path owns mice)", async () => {
    const { container } = mount({ text: "mouse", delay: 3000 });
    wrapper(container).dispatchEvent(
      new PointerEvent("pointerdown", { pointerType: "mouse", bubbles: true }),
    );
    await nextTick();
    // A mouse press never engages the lazy tooltip at all — no popup
    // node, no touch hint bar.
    expect(document.querySelector(".hk-tooltip-popup")).toBeNull();
    expect(hintBar()).toBeNull();
  });

  it("does not flash the anchored popup from the synthetic mouseenter after a tap", async () => {
    const { container } = mount({ text: "synthetic", delay: 0 });
    touchDown(wrapper(container));
    touchUp();
    await nextTick();
    // The tap's synthetic mouseenter arrives right after the pointer
    // events — it must not open the hover-only anchored popup.
    enter(container);
    await settle();
    expect(document.querySelector(".hk-tooltip-popup")).toBeNull();
  });
});

describe("HkTooltip anchoring", () => {
  it("uses an explicitly-sized absolute wrapper as the visible cell anchor", async () => {
    const { container } = mount({
      text: "cell", delay: 0, placement: "bottom",
      style: { position: "absolute", left: "200px", top: "100px", width: "400px", height: "240px" },
    });
    const anchor = wrapper(container);
    expect(anchor.style.position).toBe("absolute");
    expect(anchor.style.width).toBe("400px");
    anchor.getBoundingClientRect = () => ({
      x: 200, y: 100, left: 200, top: 100, right: 600, bottom: 340,
      width: 400, height: 240, toJSON: () => ({}),
    }) as DOMRect;
    enter(container);
    await settle();
    expect(popup().style.top).toBe("348px"); // cell.bottom 340 + 8px gap
    expect(popup().style.left).toBe("400px"); // visible frame's centre
    expect(popup().style.transform).toBe("translate(-50%, 0)");
  });

  it("follows a moving anchor while visible (wheel zoom / minimap pan)", async () => {
    const { container } = mount({ text: "moving", delay: 0, placement: "bottom" });
    let top = 100;
    wrapper(container).getBoundingClientRect = () => ({
      x: 200, y: top, left: 200, top, right: 280, bottom: top + 40,
      width: 80, height: 40, toJSON: () => ({}),
    }) as DOMRect;
    enter(container);
    await settle();
    expect(popup().style.top).toBe("148px");

    top = 120; // the same hovered cell moves with the camera; no new enter
    await settle();
    expect(popup().style.top).toBe("168px");
    leave(container);
    await nextTick();
    expect(popup().className).not.toContain("hk-tooltip-visible");
  });

  it("places the popup above the anchor with the top placement (gap + transform)", async () => {
    const { container } = mount({ text: "up", delay: 0, placement: "top" });
    enter(container);
    await settle();
    const el = popup();
    expect(el.className).toContain("hk-tooltip-top");
    expect(wrapper(container).getAttribute("data-position")).toBe("top");
    // happy-dom reports a zero anchor rect: top = 0 - 8 gap, left = the
    // anchor center, transform flips the popup above that point.
    expect(el.style.top).toBe("-8px");
    expect(el.style.left).toBe("0px");
    expect(el.style.transform).toBe("translate(-50%, -100%)");
  });

  it("places the popup beside the anchor with the right placement", async () => {
    const { container } = mount({ text: "side", delay: 0, placement: "right" });
    enter(container);
    await settle();
    const el = popup();
    expect(el.className).toContain("hk-tooltip-right");
    expect(wrapper(container).getAttribute("data-position")).toBe("right");
    expect(el.style.top).toBe("0px");
    expect(el.style.left).toBe("8px");
    expect(el.style.transform).toBe("translate(0, -50%)");
  });

  it("carries the maxWidth prop onto the popup style", async () => {
    const { container } = mount({ text: "wide", delay: 0, maxWidth: "220px" });
    enter(container);
    await settle();
    expect(popup().style.maxWidth).toBe("220px");
  });

  it("sizes the popup to its content (max-content) for the gutter clamp", async () => {
    // The compression fix: the popup box must be position-independent
    // (width: max-content) so a screen-edge trigger cannot shrink it to
    // the containing block's leftover space; applyTooltipPosition then
    // clamps the measured box into the viewport gutter (no-op here —
    // happy-dom reports a zero rect).
    const { container } = mount({ text: "sized", delay: 0 });
    enter(container);
    await settle();
    expect(popup().style.width).toBe("max-content");
  });
});
