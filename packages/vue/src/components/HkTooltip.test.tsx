import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, h, nextTick } from "vue";

import HkTooltip from "./HkTooltip";
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
  document.body.appendChild(container);
  const app = createApp({
    render: () =>
      h(HkTooltip, props, () => h("span", { class: "anchor-probe" }, "anchor")),
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
});

describe("HkTooltip popup-manager registration", () => {
  it("registers one tooltip-kind entry at the tooltip band and stamps its z inline", async () => {
    mount({ text: "hello" });
    const entries = tooltipEntries();
    expect(entries.length).toBe(1);
    expect(entries[0]!.kind).toBe("tooltip");
    expect(entries[0]!.zIndex).toBe(POPUP_Z_BANDS.tooltip);
    // Tooltips are transient annotations — they never lock scroll.
    expect(entries[0]!.locksScroll).toBe(false);
    expect(document.body.style.overflow).not.toBe("hidden");
    // The band z lands on the teleported popup element (set from
    // onMounted, so the patch flushes on the next tick), overriding the
    // --hi-z-tooltip SCSS fallback.
    await nextTick();
    expect(popup().style.zIndex).toBe(String(POPUP_Z_BANDS.tooltip));
  });

  it("stacks a second tooltip one step above within the band", () => {
    mount({ text: "one" });
    mount({ text: "two" });
    const entries = tooltipEntries();
    expect(entries.length).toBe(2);
    const zs = entries.map((e) => e.zIndex).sort((a, b) => a - b);
    expect(zs[1]).toBe(zs[0] + POPUP_Z_STEP);
    expect(zs[0]).toBeGreaterThanOrEqual(POPUP_Z_BANDS.tooltip);
  });

  it("removes its registry entry on unmount", () => {
    const { app } = mount({ text: "bye" });
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
  it("teleports the popup to body, hidden, with the text content", () => {
    const { container } = mount({ text: "the tip" });
    const el = popup();
    expect(document.body.contains(el)).toBe(true);
    expect(el.parentElement).toBe(document.body);
    expect(el.className).not.toContain("hk-tooltip-visible");
    expect(el.querySelector(".hk-tooltip-content")!.textContent).toBe("the tip");
    // The anchor slot renders inside the wrapper's trigger span.
    expect(wrapper(container).querySelector(".hk-tooltip-trigger .anchor-probe")).not.toBeNull();
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

describe("HkTooltip anchoring", () => {
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
});
