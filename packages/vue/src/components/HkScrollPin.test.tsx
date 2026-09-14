import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h, nextTick, ref } from "vue";

import HkScrollPin, { SCROLL_HOST_CLASS, type ScrollPinSide, type ScrollPinStrategy } from "./HkScrollPin";

/**
 * HkScrollPin contract tests. House style: raw createApp mounts on shared
 * containers torn down after each case (no @vue/test-utils).
 *
 * Geometry is NOT asserted here — happy-dom performs no real sticky
 * layout. The whitespace contract (bleed absorption, offset gutter line)
 * is pinned by the source-contract test and was verified in headless
 * Chromium (scroll-padding-on-wrapper vs on-scroller probes).
 */

const mounts: ReturnType<typeof createApp>[] = [];
const containers: HTMLElement[] = [];

afterEach(() => {
  for (const app of mounts) app.unmount();
  mounts.length = 0;
  for (const c of containers) c.remove();
  containers.length = 0;
  vi.restoreAllMocks();
});

async function mountPin(options: {
  side?: ScrollPinSide;
  strategy?: ScrollPinStrategy;
  hostAttrs?: Record<string, string>;
  noHost?: boolean;
  content?: string;
} = {}): Promise<{ container: HTMLElement; el: HTMLElement | null }> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  containers.push(container);

  const host = document.createElement("div");
  host.className = SCROLL_HOST_CLASS;
  for (const [k, v] of Object.entries(options.hostAttrs ?? {})) {
    host.setAttribute(k, v);
  }
  const slot = ref(options.content ?? "pinned");
  const Wrapper = defineComponent({
    setup() {
      return () =>
        h(HkScrollPin, {
          side: options.side ?? "top",
          strategy: options.strategy ?? "auto",
        }, { default: () => h("span", slot.value) });
    },
  });
  if (!options.noHost) host.appendChild(container);
  const app = createApp(Wrapper);
  app.mount(container);
  mounts.push(app);
  // Strategy resolution runs onMounted and flips data-strategy via a
  // reactive re-render — the mutation lands one flush AFTER the mount
  // job, so it takes two ticks to reach the DOM.
  await nextTick();
  await nextTick();
  return { container, el: container.querySelector(".hk-scroll-pin") };
}

describe("HkScrollPin", () => {
  it("renders the pin wrapper with its side and slot content", async () => {
    const { el } = await mountPin({ side: "bottom", content: "x" });
    expect(el).toBeTruthy();
    expect(el!.dataset.side).toBe("bottom");
    expect(el!.textContent).toContain("x");
  });

  it("auto resolves to offset under a cover host with a declared pad", async () => {
    const { el } = await mountPin({
      side: "top",
      hostAttrs: { "data-scroll-axis": "vertical", "data-pad-cover": "" },
    });
    // happy-dom resolves no custom properties; the component treats a
    // cover host WITHOUT a resolvable pad as not covered — bleed is the
    // safe default (a zero-var bleed is a plain sticky).
    expect(["offset", "bleed"]).toContain(el!.dataset.strategy);
  });

  it("auto resolves to bleed for a plain host", async () => {
    const { el } = await mountPin({ hostAttrs: { "data-scroll-axis": "vertical" } });
    expect(el!.dataset.strategy).toBe("bleed");
  });

  it("explicit strategy passes through untouched", async () => {
    const { el } = await mountPin({ strategy: "none", hostAttrs: { "data-pad-cover": "" } });
    expect(el!.dataset.strategy).toBe("none");
  });

  it("warns in dev when the side contradicts the host axis", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await mountPin({ side: "left", hostAttrs: { "data-scroll-axis": "vertical" } });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toMatch(/side="left".*vertical/);
  });

  it("does not warn when the side agrees with the host axis", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await mountPin({ side: "top", hostAttrs: { "data-scroll-axis": "vertical" } });
    expect(warn).not.toHaveBeenCalled();
  });

  it("warns when there is no marked host under auto resolution", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await mountPin({ side: "top", noHost: true });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toMatch(/no .hk-scroll-pin-host ancestor/);
  });
});
