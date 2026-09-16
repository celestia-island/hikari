import { afterEach, describe, expect, it } from "vitest";
import { createApp, defineComponent, h, nextTick, type App } from "vue";

import HkKanban from "./HkKanban";

/**
 * HkKanban tests — lanes, headers, cards, the scroll axis, and the drag
 * contract (a drop emits both ends; a drop on the origin emits nothing).
 */

interface Lane {
  key: string;
  cards: string[];
}

const apps: App[] = [];

afterEach(() => {
  for (const app of apps.splice(0)) app.unmount();
});

function mount(props: Record<string, unknown>, slots: Record<string, unknown> = {}) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const Root = defineComponent({
    setup() {
      return () =>
        h(
          HkKanban,
          { ref: undefined, ...props } as never,
          {
            laneHeader: ({ lane }: { lane: unknown }) =>
              h("span", { class: "lane-name" }, (lane as Lane).key),
            card: ({ card }: { card: unknown }) => h("div", { class: "card" }, String(card)),
            ...slots,
          },
        );
    },
  });
  const app = createApp(Root);
  app.mount(container);
  apps.push(app);
  return container;
}

const LANES: Lane[] = [
  { key: "todo", cards: ["a", "b"] },
  { key: "doing", cards: ["c"] },
];

const base = {
  lanes: LANES,
  laneKeyOf: (lane: unknown) => (lane as Lane).key,
  cardsOf: (lane: unknown) => (lane as Lane).cards,
};

/** A drag event the board understands in a DOM without dataTransfer. */
function dragEvent(type: string): DragEvent {
  const event = new Event(type, { bubbles: true, cancelable: true }) as DragEvent;
  Object.defineProperty(event, "dataTransfer", {
    value: { setData: () => {}, effectAllowed: "", dropEffect: "" },
    configurable: true,
  });
  return event;
}

describe("HkKanban", () => {
  it("renders every lane with its header and its cards", async () => {
    const root = mount(base);
    await nextTick();
    const lanes = [...root.querySelectorAll<HTMLElement>(".hk-kanban-lane")];
    expect(lanes.map((lane) => lane.dataset.lane)).toEqual(["todo", "doing"]);
    expect(lanes[0].querySelector(".lane-name")?.textContent).toBe("todo");
    expect(
      [...lanes[0].querySelectorAll<HTMLElement>(".card")].map((card) => card.textContent),
    ).toEqual(["a", "b"]);
  });

  it("carries the scroll axis it was given", async () => {
    const root = mount({ ...base, axis: "vertical" });
    await nextTick();
    expect(root.querySelector(".hk-kanban")?.getAttribute("data-axis")).toBe("vertical");
  });

  it("renders the empty slot when there are no lanes", async () => {
    const root = mount(
      { ...base, lanes: [] },
      { empty: () => h("p", { class: "none" }, "none") },
    );
    await nextTick();
    expect(root.querySelector(".none")?.textContent).toBe("none");
    expect(root.querySelectorAll(".hk-kanban-lane")).toHaveLength(0);
  });

  it("emits a move with both ends when a card lands on another lane", async () => {
    const moves: unknown[] = [];
    const root = mount({ ...base, draggable: true, onMove: (m: unknown) => moves.push(m) });
    await nextTick();
    const cards = root.querySelectorAll<HTMLElement>(".hk-kanban-card");
    const target = root.querySelector<HTMLElement>(".hk-kanban-lane[data-lane='doing'] .hk-kanban-lane-tail");
    expect(cards[0] && target).toBeTruthy();

    cards[0].dispatchEvent(dragEvent("dragstart"));
    target?.dispatchEvent(dragEvent("dragover"));
    target?.dispatchEvent(dragEvent("drop"));

    expect(moves).toHaveLength(1);
    expect(moves[0]).toMatchObject({
      card: "a",
      fromLaneKey: "todo",
      fromIndex: 0,
      toLaneKey: "doing",
      toIndex: 1,
    });
  });

  it("marks the lane under a dragged card as the drop target", async () => {
    const root = mount({ ...base, draggable: true });
    await nextTick();
    const card = root.querySelector<HTMLElement>(".hk-kanban-card");
    const lane = root.querySelector<HTMLElement>(".hk-kanban-lane[data-lane='doing']");
    card?.dispatchEvent(dragEvent("dragstart"));
    lane?.dispatchEvent(dragEvent("dragover"));
    await nextTick();
    expect(lane?.hasAttribute("data-drop-target")).toBe(true);
  });

  it("stays quiet when a card is dropped where it started", async () => {
    // The host should not have to filter "nothing moved" itself.
    const moves: unknown[] = [];
    const root = mount({ ...base, draggable: true, onMove: (m: unknown) => moves.push(m) });
    await nextTick();
    const card = root.querySelector<HTMLElement>(".hk-kanban-card");
    card?.dispatchEvent(dragEvent("dragstart"));
    card?.dispatchEvent(dragEvent("dragover"));
    card?.dispatchEvent(dragEvent("drop"));
    expect(moves).toHaveLength(0);
  });

  it("does not make cards draggable unless asked", async () => {
    const root = mount(base);
    await nextTick();
    const card = root.querySelector<HTMLElement>(".hk-kanban-card");
    expect(card?.hasAttribute("draggable")).toBe(false);
  });

  it("scrolls the strip on BOTH axes when the axis is both", async () => {
    // `both` used to be a value nothing consumed: the strip was horizontal
    // whatever it said. A board whose lanes and cards both overflow has to
    // travel on either axis.
    const root = mount({ ...base, axis: "both" });
    await nextTick();
    expect(root.querySelector(".hk-kanban")?.getAttribute("data-axis")).toBe("both");
    expect(root.querySelector(".hk-scroll-container")?.getAttribute("data-axis")).toBe("both");
  });

  it("scrolls the strip down when the axis is vertical", async () => {
    const root = mount({ ...base, axis: "vertical" });
    await nextTick();
    expect(root.querySelector(".hk-scroll-container")?.getAttribute("data-axis")).toBe("vertical");
  });

  it("passes the lane size through as the shared variable", async () => {
    const root = mount({ ...base, laneSize: "22rem" });
    await nextTick();
    const lanes = root.querySelector<HTMLElement>(".hk-kanban-lanes");
    expect(lanes?.style.getPropertyValue("--hk-kanban-lane-size")).toBe("22rem");
  });

  it("accepts a drop anywhere on the lane, not only on a card", async () => {
    // The whole lane is highlighted as a target, so the whole lane has to be
    // one: hovering the header used to show the outline and then swallow the
    // drop silently.
    const moves: Array<Record<string, unknown>> = [];
    const root = mount({
      ...base,
      draggable: true,
      onMove: (m: Record<string, unknown>) => moves.push(m),
    });
    await nextTick();
    root.querySelector<HTMLElement>(".hk-kanban-card")?.dispatchEvent(dragEvent("dragstart"));
    const header = root.querySelector<HTMLElement>(
      ".hk-kanban-lane[data-lane='doing'] .hk-kanban-lane-header",
    );
    header?.dispatchEvent(dragEvent("dragover"));
    header?.dispatchEvent(dragEvent("drop"));

    expect(moves).toHaveLength(1);
    expect(moves[0]).toMatchObject({ card: "a", toLaneKey: "doing", toIndex: 1 });
  });

  it("marks the drop as handled, so the browser cannot fall back", async () => {
    const root = mount({ ...base, draggable: true });
    await nextTick();
    root.querySelector<HTMLElement>(".hk-kanban-card")?.dispatchEvent(dragEvent("dragstart"));
    const event = dragEvent("drop");
    root.querySelector<HTMLElement>(".hk-kanban-lane[data-lane='doing']")?.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it("keeps the highlight while the pointer crosses cards inside one lane", async () => {
    // dragleave bubbles from every child, so an unguarded handler blinks the
    // outline off when the pointer moves from one card to the next.
    const root = mount({ ...base, draggable: true });
    await nextTick();
    const cards = root.querySelectorAll<HTMLElement>(".hk-kanban-card");
    const lane = root.querySelector<HTMLElement>(".hk-kanban-lane[data-lane='todo']");
    cards[0]?.dispatchEvent(dragEvent("dragstart"));
    lane?.dispatchEvent(dragEvent("dragover"));
    await nextTick();
    expect(lane?.hasAttribute("data-drop-target")).toBe(true);

    const leave = dragEvent("dragleave");
    Object.defineProperty(leave, "relatedTarget", { value: cards[1], configurable: true });
    cards[0]?.dispatchEvent(leave);
    await nextTick();
    expect(lane?.hasAttribute("data-drop-target")).toBe(true);
  });
});
