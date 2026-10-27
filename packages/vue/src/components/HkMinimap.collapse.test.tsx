import { afterEach, describe, expect, it } from "vitest";
import { createApp, h, nextTick } from "vue";

import HkMinimap from "./HkMinimap";

const mounts: Array<{ app: ReturnType<typeof createApp>; container: HTMLElement }> = [];

function mount(props: Record<string, unknown>) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const app = createApp({ render: () => h(HkMinimap, props) });
  app.mount(container);
  mounts.push({ app, container });
  return container;
}

afterEach(() => {
  for (const { app, container } of mounts.splice(0)) {
    app.unmount();
    container.remove();
  }
});

const BOXES = [
  { id: "a", bounds: { x: 0, y: 0, w: 10, h: 10 }, color: "#f00" },
  { id: "b", bounds: { x: 10, y: 0, w: 10, h: 10 }, color: "#0f0" },
];

describe("HkMinimap collapse (user direction 2026-10-27)", () => {
  it("a non-collapsible minimap renders the card and NO minimize button", () => {
    const c = mount({ boxes: BOXES });
    expect(c.querySelector(".hk-minimap--collapsed")).toBeNull();
    expect(c.querySelector(".hk-mm-collapse-btn")).toBeNull();
    expect(c.querySelector("svg.hk-minimap-svg")).toBeTruthy();
  });

  it("collapsible renders the minimize button in the zoom bar", () => {
    const c = mount({ boxes: BOXES, collapsible: true });
    expect(c.querySelector(".hk-mm-collapse-btn")).toBeTruthy();
  });

  it("collapsing swaps the card for the semi-transparent map-icon button", async () => {
    const c = mount({ boxes: BOXES, collapsible: true });
    (c.querySelector(".hk-mm-collapse-btn") as HTMLElement).click();
    await nextTick();
    expect(c.querySelector("svg.hk-minimap-svg")).toBeNull();
    const glyph = c.querySelector<HTMLButtonElement>(".hk-minimap--collapsed");
    expect(glyph).toBeTruthy();
    // The collapsed glyph announces itself and is translucent at rest.
    expect(glyph!.getAttribute("aria-label")).toBe("Show minimap");
    expect(glyph!.className).toContain("hk-minimap--collapsed");
  });

  it("clicking the collapsed glyph expands the card again (uncontrolled)", async () => {
    const c = mount({ boxes: BOXES, collapsible: true });
    (c.querySelector(".hk-mm-collapse-btn") as HTMLElement).click();
    await nextTick();
    (c.querySelector(".hk-minimap--collapsed") as HTMLElement).click();
    await nextTick();
    expect(c.querySelector("svg.hk-minimap-svg")).toBeTruthy();
    expect(c.querySelector(".hk-minimap--collapsed")).toBeNull();
  });

  it("the controlled mode honours the collapsed prop and emits updates", async () => {
    const seen: boolean[] = [];
    const container = document.createElement("div");
    document.body.appendChild(container);
    const app = createApp({
      data: () => ({ collapsed: false }),
      render() {
        return h(HkMinimap, {
          boxes: BOXES,
          collapsible: true,
          collapsed: (this as { collapsed: boolean }).collapsed,
          "onUpdate:collapsed": (v: boolean) => {
            seen.push(v);
            (this as { collapsed: boolean }).collapsed = v;
          },
        });
      },
    });
    app.mount(container);
    mounts.push({ app, container });

    (container.querySelector(".hk-mm-collapse-btn") as HTMLElement).click();
    await nextTick();
    expect(seen).toEqual([true]);
    // The controlled prop drove the swap.
    expect(container.querySelector(".hk-minimap--collapsed")).toBeTruthy();

    (container.querySelector(".hk-minimap--collapsed") as HTMLElement).click();
    await nextTick();
    expect(seen).toEqual([true, false]);
    expect(container.querySelector("svg.hk-minimap-svg")).toBeTruthy();
  });

  it("a controlled `collapsed: true` starts collapsed even without a click", () => {
    const c = mount({ boxes: BOXES, collapsible: true, collapsed: true });
    expect(c.querySelector(".hk-minimap--collapsed")).toBeTruthy();
    expect(c.querySelector("svg.hk-minimap-svg")).toBeNull();
  });
});
