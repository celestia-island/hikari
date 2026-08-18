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
