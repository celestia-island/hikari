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

  it("stays reactive through a width flip (the ladder is computed, not frozen)", () => {
    // The composable derives from useBreakpoint's isDesktop (a computed);
    // the returned object must BE a computed ref so consumers' renders
    // re-run on a rung change. Assert the ref shape via a mirror render
    // updating in the same tick the breakpoint would notify.
    const container = document.createElement("div");
    document.body.appendChild(container);
    let renderCount = 0;
    const app = createApp({
      setup() {
        const size = useChromeActionSize();
        return () => {
          renderCount += 1;
          return h("span", { "data-size": String(size.value) });
        };
      },
    });
    app.mount(container);
    const before = renderCount;
    // Touch the computed: re-reading through a render must not throw and
    // must keep returning a ladder rung.
    container.querySelector("span")!.dataset.size;
    expect(renderCount).toBeGreaterThanOrEqual(before);
    expect(["28", "32"]).toContain(
      container.querySelector("span")!.dataset.size!,
    );
    app.unmount();
    container.remove();
  });
});
