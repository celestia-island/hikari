import { describe, expect, it } from "vitest";
import { createApp, h } from "vue";

import { useChromeActionSize } from "./useChromeActionSize";

/**
 * The ladder's VALUES are viewport-dependent (useBreakpoint reads the
 * real window width, and a jsdom default falls outside the wide rung),
 * so this suite pins the CONTRACT — one source, both rungs reachable,
 * never anything else — rather than a hard-coded mapping.
 */
describe("useChromeActionSize", () => {
  it("returns a computed ref resolving to one of the two ladder rungs", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const app = createApp({
      setup() {
        const size = useChromeActionSize();
        // Render the resolved value into the DOM (setupState proxies are
        // unwrapped — rendering is the honest read path).
        return () => h("span", { "data-size": String(size.value) });
      },
    });
    app.mount(container);
    const span = container.querySelector("span")!;
    expect(["28", "32"]).toContain(span.dataset.size!);
    app.unmount();
    container.remove();
  });

  it("maps the viewport onto the ladder rungs (wide→32, narrow→28) and follows a flip", async () => {
    // R3 S2 pin: nothing else pins WHICH rung a width maps to — a
    // regression to a frozen constant passed the whole suite. Drive the
    // REAL useBreakpoint (it listens to resize; no mock split needed).
    const container = document.createElement("div");
    document.body.appendChild(container);
    const app = createApp({
      setup() {
        const size = useChromeActionSize();
        return () => h("span", { "data-size": String(size.value) });
      },
    });
    app.mount(container);
    const read = () => container.querySelector("span")!.dataset.size!;

    window.innerWidth = 1280;
    window.dispatchEvent(new Event("resize"));
    await new Promise((r) => setTimeout(r, 20));
    expect(read()).toBe("32");

    window.innerWidth = 800;
    window.dispatchEvent(new Event("resize"));
    await new Promise((r) => setTimeout(r, 20));
    expect(read()).toBe("28");

    // And back: the flip is followed, not frozen at first read.
    window.innerWidth = 1280;
    window.dispatchEvent(new Event("resize"));
    await new Promise((r) => setTimeout(r, 20));
    expect(read()).toBe("32");

    app.unmount();
    container.remove();
  });
});
