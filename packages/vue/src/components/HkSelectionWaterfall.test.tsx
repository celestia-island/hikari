/**
 * HkSelectionWaterfall rides the library's base list container
 * (2026-11-27 user direction: every list-shaped surface — rows, cards,
 * waterfalls — runs its add / remove / reorder through HkListTransition so
 * the choreography, the bus reporting and the reduced-motion collapse are
 * written once). Pinned: the flow IS a transition host with the move track
 * armed (not the disabled class), items are its keyed children, and the
 * selection check / multi semantics are unchanged.
 * MUT:waterfall-adopts-primitive
 */
import { afterEach, describe, expect, it } from "vitest";
import { createApp, h, nextTick, ref } from "vue";

import HkSelectionWaterfall, { type WaterfallItem } from "./HkSelectionWaterfall";

const ITEMS: WaterfallItem[] = [
  { id: "a", title: "Alpha", tag: "new" },
  { id: "b", title: "Beta", description: "second" },
  { id: "c", title: "Gamma" },
];

const mounts: Array<{ app: ReturnType<typeof createApp>; container: HTMLElement }> = [];
afterEach(() => {
  for (const { app, container } of mounts.splice(0)) {
    app.unmount();
    container.remove();
  }
});

function mountFlow(props: Record<string, unknown> = {}, items = () => ITEMS) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const picked: string[] = [];
  const app = createApp({
    render: () =>
      h(HkSelectionWaterfall, {
        items: items(),
        onSelect: (item: WaterfallItem) => picked.push(item.id),
        ...props,
      } as never),
  });
  mounts.push({ app, container });
  app.mount(container);
  return { container, picked };
}

describe("HkSelectionWaterfall", () => {
  it("renders its tiles as the keyed children of a move-armed HkListTransition host", () => {
    const { container } = mountFlow();
    const flow = container.querySelector<HTMLElement>(".hk-selection-waterfall-flow")!;
    expect(flow, "the flow renders").toBeTruthy();
    expect(flow.classList.contains("hk-list-fade-move-disabled"), "move track is NOT disabled").toBe(false);
    const tiles = [...flow.children];
    expect(tiles.map((t) => t.querySelector(".hk-selection-waterfall-name")?.textContent)).toEqual([
      "Alpha",
      "Beta",
      "Gamma",
    ]);
    for (const t of tiles) expect(t.classList.contains("hk-selection-waterfall-item")).toBe(true);
  });

  it("keeps a tile's DOM node across a reorder (keyed move, not a remount)", async () => {
    const order = ref<string[]>(["a", "b", "c"]);
    const byId = (id: string) => ITEMS.find((i) => i.id === id)!;
    const { container } = mountFlow({}, () => order.value.map(byId));
    const flow = container.querySelector<HTMLElement>(".hk-selection-waterfall-flow")!;
    const beta = [...flow.children].find((t) => t.textContent?.includes("Beta"))!;
    order.value = ["b", "a", "c"];
    await nextTick();
    expect([...flow.children][0]).toBe(beta);
  });

  it("selection semantics are unchanged: single picks one, multi toggles", async () => {
    const single = mountFlow({ selectedIds: ["a"] });
    const tiles = () => [...single.container.querySelectorAll<HTMLElement>(".hk-selection-waterfall-item")];
    expect(tiles()[0].getAttribute("aria-selected")).toBe("true");
    expect(tiles()[0].querySelector(".hk-selection-waterfall-check")).toBeTruthy();
    expect(tiles()[1].getAttribute("aria-selected")).toBe("false");
    tiles()[1].click();
    expect(single.picked).toEqual(["b"]);

    const multi = mountFlow({ multi: true, selectedIds: ["a", "c"] });
    expect(multi.container.querySelectorAll(".hk-selection-waterfall-check")).toHaveLength(2);
    // Enter / Space on a tile select it too.
    multi.container.querySelectorAll<HTMLElement>(".hk-selection-waterfall-item")[1]
      .dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(multi.picked).toEqual(["b"]);
  });

  it("renders nothing for an empty catalog and keeps the group title when given", () => {
    const empty = mountFlow({}, () => []);
    expect(empty.container.querySelector(".hk-selection-waterfall")).toBeNull();
    const titled = mountFlow({ groupTitle: "Platforms" });
    expect(titled.container.querySelector(".hk-selection-waterfall-title")?.textContent).toBe("Platforms");
  });
});
