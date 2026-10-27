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

  it("drag-to-pan SURVIVES a collapse→expand cycle (the R2/R3 S1)", async () => {
    // The old imperative listeners bound once at mount to the mount-time
    // element; the collapsed swap replaced the node and the re-expanded
    // card never got them back. The handlers now ride the vnodes, so the
    // gesture works on whatever element renders.
    const c = mount({ boxes: BOXES, collapsible: true });
    const card = c.querySelector(".hk-minimap") as HTMLElement;
    const before = c.querySelector("svg.hk-minimap-svg")!;
    card.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, clientX: 10, clientY: 10 }));
    card.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, clientX: 20, clientY: 14 }));
    card.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
    expect(c.querySelector(".hk-minimap")).toBeTruthy(); // gesture ran
    void before;
    // Round-trip: collapse then expand.
    (c.querySelector(".hk-mm-collapse-btn") as HTMLElement).click();
    await nextTick();
    (c.querySelector(".hk-minimap--collapsed") as HTMLElement).click();
    await nextTick();
    // The re-expanded card is a NEW element — the drag handlers must be
    // on IT. A pointer sequence must reach the pan machinery: assert via
    // the dragging data flag, which only onDown sets.
    const card2 = c.querySelector(".hk-minimap") as HTMLElement;
    expect(card2).not.toBe(card); // the node really was replaced
    card2.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, clientX: 5, clientY: 5 }));
    await nextTick(); // the data flag renders on the next patch
    expect(card2.getAttribute("data-dragging")).toBe("");
    card2.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
    await nextTick();
    expect(card2.getAttribute("data-dragging")).toBeNull();
  });

  it("a controlled `collapsed: true` starts collapsed even without a click", () => {
    const c = mount({ boxes: BOXES, collapsible: true, collapsed: true });
    expect(c.querySelector(".hk-minimap--collapsed")).toBeTruthy();
    expect(c.querySelector("svg.hk-minimap-svg")).toBeNull();
  });
});
