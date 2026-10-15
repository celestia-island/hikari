import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, h, defineComponent } from "vue";

import HHoverRevealAction from "./HkHoverRevealAction";

/** Mount the component into a detached container and return the host element. */
async function mountHost(props: Record<string, unknown> = {}) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const app = createApp({
    render: () =>
      h(HHoverRevealAction, props, {
        default: () => h("span", "main"),
        extension: () => h("span", "ext"),
      }),
  });
  app.mount(host);
  const el = host.querySelector(".hk-hover-reveal") as HTMLElement;
  return { host, app, el };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("HHoverRevealAction touch reveal modes", () => {
  it("tap mode (default) reveals on touchstart immediately", async () => {
    const { el } = await mountHost();
    el.dispatchEvent(new Event("touchstart", { bubbles: true }));
    await Promise.resolve();
    expect(el.className).toContain("is-revealed");
  });

  it("longpress mode does NOT reveal on a quick tap", async () => {
    vi.useFakeTimers();
    const { el } = await mountHost({ touchRevealMode: "longpress", longPressDelay: 500 });
    el.dispatchEvent(new Event("touchstart", { bubbles: true }));
    vi.advanceTimersByTime(100);
    el.dispatchEvent(new Event("touchend", { bubbles: true }));
    vi.advanceTimersByTime(1000);
    await Promise.resolve();
    expect(el.className).not.toContain("is-revealed");
  });

  it("longpress mode reveals only after the finger rests long enough", async () => {
    vi.useFakeTimers();
    const { el } = await mountHost({ touchRevealMode: "longpress", longPressDelay: 500 });
    el.dispatchEvent(new Event("touchstart", { bubbles: true }));
    vi.advanceTimersByTime(600);
    await Promise.resolve();
    expect(el.className).toContain("is-revealed");
    // Lifting starts the linger countdown; after it elapses it hides again.
    el.dispatchEvent(new Event("touchend", { bubbles: true }));
    vi.advanceTimersByTime(3100);
    await Promise.resolve();
    expect(el.className).not.toContain("is-revealed");
  });

  it("longpress mode cancels the pending reveal when the finger slides", async () => {
    vi.useFakeTimers();
    const { el } = await mountHost({ touchRevealMode: "longpress", longPressDelay: 500 });
    el.dispatchEvent(new Event("touchstart", { bubbles: true }));
    el.dispatchEvent(new Event("touchmove", { bubbles: true }));
    vi.advanceTimersByTime(600);
    await Promise.resolve();
    expect(el.className).not.toContain("is-revealed");
  });
});

describe("HHoverRevealAction bare-click robustness", () => {
  it("reveals on mousedown even without a preceding hover (synthetic clicks)", async () => {
    // Test drivers dispatch a click straight at the extension's coordinates
    // with no mouseenter; without the mousedown reveal the extension stays
    // pointer-events:none and the click passes through to the page below.
    const { el } = await mountHost();
    expect(el.className).not.toContain("is-revealed");
    el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    await Promise.resolve();
    expect(el.className).toContain("is-revealed");
  });

  it("keeps the touch suppress window authoritative over mousedown", async () => {
    // Touch interactions fire an emulated mousedown after the tap; during
    // the touch linger the touch path owns the state and a stray emulated
    // mousedown must not re-reveal (which would clear the hide timer).
    vi.useFakeTimers();
    const { el } = await mountHost();
    el.dispatchEvent(new Event("touchstart", { bubbles: true }));
    el.dispatchEvent(new Event("touchend", { bubbles: true }));
    await Promise.resolve();
    expect(el.className).toContain("is-revealed");
    // Emulated mousedown while the touch linger owns the reveal.
    el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    // After the linger expires the extension hides — the mousedown must
    // not have reset the hide timer (i.e. must have been suppressed).
    vi.advanceTimersByTime(3100);
    await Promise.resolve();
    expect(el.className).not.toContain("is-revealed");
  });
});
