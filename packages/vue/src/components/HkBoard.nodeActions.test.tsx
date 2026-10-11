import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h } from "vue";

import HkBoard, { type BoardNodeInput } from "./HkBoard";

/** Pointer event the suite can dispatch (happy-dom has PointerEvent). */
function pointerEvent(type: string, x: number, y: number): Event {
  const Ctor = (globalThis as { PointerEvent?: typeof MouseEvent }).PointerEvent ?? MouseEvent;
  const ev = new Ctor(type, { bubbles: true, cancelable: true, clientX: x, clientY: y });
  (ev as { pointerId?: number }).pointerId = 1;
  return ev;
}

const nodes: BoardNodeInput[] = [
  { id: "a", x: 0, y: 0, w: 100, h: 60, draggable: true, label: "A" },
  { id: "b", x: 160, y: 0, w: 100, h: 60, draggable: true, label: "B" },
];

/** Mounts the board with the given slots, the repo's own way (no
 * @vue/test-utils in this package): a throwaway app on document.body. */
function mountBoard(slots: Record<string, () => unknown> = {}, onNodeMove?: () => void): unknown {
  const host = document.createElement("div");
  document.body.appendChild(host);
  // (defineComponent(fn) treats fn as a FUNCTIONAL component — the wrapper
  // needs the explicit setup form to hand HkBoard its slots.)
  const wrapper = defineComponent({
    setup: () => () => h(HkBoard, { nodes, onNodeMove }, slots),
  });
  const app = createApp(wrapper);
  app.mount(host);
  return app;
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("HkBoard nodeActions slot", () => {
  it("renders the slot per node, docked inside the node shell", () => {
    mountBoard({
      nodeActions: () => [
        h("button", { "data-test": "act" }, "act"),
      ],
    });
    const docks = [...document.body.querySelectorAll<HTMLElement>(".hk-board-node-actions")];
    expect(docks).toHaveLength(2);
    expect(docks[0].querySelector("[data-test=act]")).toBeTruthy();
    expect(docks[1].querySelector("[data-test=act]")).toBeTruthy();
    // The dock lives INSIDE the node shell (the SCSS anchors it to the
    // node's bottom-end corner — pinned by the source contract below).
    expect(docks[0].closest(".hk-board-node")).toBeTruthy();
    expect(docks[0].parentElement!.classList.contains("hk-board-node")).toBe(true);
  });

  it("renders nothing when the slot is absent", () => {
    mountBoard();
    expect(document.body.querySelector(".hk-board-node-actions")).toBeNull();
  });

  it("keeps a press that starts on a dock action from becoming a node drag", () => {
    // The board captures the pointer on its own root for draggable nodes;
    // a dock press must not enter that gesture (upstream HkMinimap guards
    // its zoom chrome the same way). happy-dom cannot emulate capture, so
    // the observable contract here is the DRAG: a pointer that travels
    // after starting on the dock leaves the node where it was.
    const onNodeMove = vi.fn();
    const host = document.createElement("div");
    document.body.appendChild(host);
    const app = mountBoard(
      { nodeActions: () => [h("button", { "data-test": "act" }, "act")] },
      onNodeMove,
    ) as { unmount: () => void };

    const dock = document.body.querySelector<HTMLElement>(".hk-board-node-actions")!;
    const shell = dock.closest(".hk-board-node") as HTMLElement;
    const before = shell.style.left;
    dock.dispatchEvent(pointerEvent("pointerdown", 90, 50));
    shell.dispatchEvent(pointerEvent("pointermove", 400, 50));
    shell.dispatchEvent(pointerEvent("pointerup", 400, 50));
    expect(shell.style.left).toBe(before);
    expect(onNodeMove).not.toHaveBeenCalled();
    app.unmount();
  });
});

/** Source contract for the dock's load-bearing rules (vitest cannot see
 * stylesheets — a deleted rule leaves every DOM guard green). */
const boardScss = (await import("node:fs")).readFileSync(
  (await import("node:path")).resolve(__dirname, "./HkBoard.scss"),
  "utf8",
);

describe("HkBoard nodeActions dock styles", () => {
  it("docks the actions to the node's bottom-end corner above the body", () => {
    const block = boardScss.slice(boardScss.indexOf("&-actions {"));
    expect(block.slice(0, 400)).toMatch(/position:\s*absolute/);
    expect(block.slice(0, 400)).toMatch(/inset-inline-end/);
    expect(block.slice(0, 400)).toMatch(/bottom:/);
    expect(block.slice(0, 400)).toMatch(/z-index/);
  });
});
