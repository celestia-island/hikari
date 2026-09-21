import { describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h, nextTick, ref } from "vue";

import HkNodeCanvas from "./HkNodeCanvas";
import type { NodeCanvasEdge } from "./nodeCanvasTypes";

/** Mount a component into a detached div appended to the body. */
function mountToDom(component: ReturnType<typeof defineComponent>): HTMLElement {
  const el = document.createElement("div");
  document.body.appendChild(el);
  const app = createApp(component);
  app.mount(el);
  return el;
}

function pointerEvent(type: string, init: PointerEventInit = {}): PointerEvent {
  return new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    pointerId: 1,
    pointerType: "touch",
    buttons: 1,
    ...init,
  });
}

/** Direct-child paths of the visible edge groups (the ink strokes). */
function el2StrokeCount(el: HTMLElement): number {
  return el.querySelectorAll(".hk-node-canvas-edge > path:not(.hk-node-canvas-edge-halo)").length;
}

const EDGES: NodeCanvasEdge[] = [
  { id: "e1", from: { x: 0, y: 0 }, to: { x: 100, y: 100 }, type: "rpc", width: 1.4 },
  { id: "e2", from: { x: 0, y: 50 }, to: { x: 100, y: 150 }, type: "proxy", width: 1.6 },
];

interface EdgeHostProps {
  interactive?: boolean;
  selectedEdgeId?: string | null;
  hoverDimming?: boolean;
}

/** Host wiring the slice of the canvas API the events describe. */
function makeEdgeHost(collected: {
  hover: Array<string | null>;
  click: string[];
  context: string[];
  prevented: boolean[];
}) {
  return defineComponent({
    props: {
      interactive: { type: Boolean, default: true },
      selectedEdgeId: { type: String as () => string | null, default: null },
      hoverDimming: { type: Boolean, default: true },
    },
    setup(props: EdgeHostProps) {
      return () =>
        h(HkNodeCanvas, {
          edges: EDGES,
          interactiveEdges: props.interactive ?? true,
          selectedEdgeId: props.selectedEdgeId ?? null,
          hoverDimming: props.hoverDimming ?? true,
          minimap: false,
          onEdgeHover: (edge: NodeCanvasEdge | null) => collected.hover.push(edge ? edge.id : null),
          onEdgeClick: (edge: NodeCanvasEdge) => collected.click.push(edge.id),
          onEdgeContextmenu: (edge: NodeCanvasEdge, event: { preventDefault(): void }) => {
            collected.context.push(edge.id);
            event.preventDefault();
            collected.prevented.push(true);
          },
        }, { default: () => h("div", "content") });
    },
  });
}

/**
 * HkNodeCanvas interactive edge layer — the hover/click/contextmenu
 * contract topology hosts consume:
 *
 *  - off by default (no hit strokes, no halo paths);
 *  - hit strokes re-enable pointer events per stroke and sit on top;
 *  - hover highlights the edge and dims the rest (dimming optional);
 *  - selection outlives hover; a vanished hovered edge clears the hover;
 *  - click after a pan capture is the gesture's tail, not a pick;
 *  - contextmenu is prevented and reported, and a touch hold
 *    synthesizes one at the press point;
 *  - explicit subpaths render (and hit) one stroke per subpath.
 */
describe("HkNodeCanvas interactive edges", () => {
  it("renders no hit strokes or halos when not interactive", () => {
    const Host = defineComponent({
      setup() {
        return () =>
          h(HkNodeCanvas, { edges: EDGES, minimap: false }, { default: () => h("div", "x") });
      },
    });
    const el = mountToDom(Host);
    expect(el.querySelectorAll(".hk-node-canvas-edge-hit")).toHaveLength(0);
    expect(el.querySelectorAll(".hk-node-canvas-edge-halo")).toHaveLength(0);
    // Visible strokes still render.
    expect(el2StrokeCount(el)).toBe(2);
  });

  it("highlights the hovered edge and dims the rest", async () => {
    const collected = { hover: [] as Array<string | null>, click: [] as string[], context: [] as string[], prevented: [] as boolean[] };
    const el = mountToDom(makeEdgeHost(collected));
    const hits = el.querySelectorAll(".hk-node-canvas-edge-hit[data-edge-id='e1']");
    expect(hits.length).toBe(1);
    hits[0].dispatchEvent(pointerEvent("pointerenter", { pointerType: "mouse" }));
    await nextTick();
    expect(collected.hover).toEqual(["e1"]);
    const groups = el.querySelectorAll(".hk-node-canvas-edge");
    expect(groups[0].classList.contains("is-hovered")).toBe(true);
    expect(groups[1].classList.contains("is-dimmed")).toBe(true);
    hits[0].dispatchEvent(pointerEvent("pointerleave", { pointerType: "mouse" }));
    await nextTick();
    expect(collected.hover).toEqual(["e1", null]);
    expect(groups[1].classList.contains("is-dimmed")).toBe(false);
  });

  it("keeps a selected edge lit through hover changes", async () => {
    const collected = { hover: [] as Array<string | null>, click: [] as string[], context: [] as string[], prevented: [] as boolean[] };
    const Host = defineComponent({
      setup() {
        return () =>
          h(makeEdgeHost(collected), { selectedEdgeId: "e2" });
      },
    });
    const el = mountToDom(Host);
    el.querySelector(".hk-node-canvas-edge-hit[data-edge-id='e1']")
      ?.dispatchEvent(pointerEvent("pointerenter", { pointerType: "mouse" }));
    await nextTick();
    const groups = el.querySelectorAll(".hk-node-canvas-edge");
    expect(groups[1].classList.contains("is-selected")).toBe(true);
    // The selected edge does NOT dim while another is hovered.
    expect(groups[1].classList.contains("is-dimmed")).toBe(false);
    expect(groups[0].classList.contains("is-hovered")).toBe(true);
  });

  it("reports edge clicks unless a pan was captured", async () => {
    const collected = { hover: [] as Array<string | null>, click: [] as string[], context: [] as string[], prevented: [] as boolean[] };
    const el = mountToDom(makeEdgeHost(collected));
    const root = el.querySelector(".hk-node-canvas") as HTMLElement;
    const hit = el.querySelector(".hk-node-canvas-edge-hit[data-edge-id='e1']") as HTMLElement;

    hit.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await nextTick();
    expect(collected.click).toEqual(["e1"]);

    // A pan: pointerdown on the root, move past the slop (capture), up.
    root.dispatchEvent(pointerEvent("pointerdown", { clientX: 100, clientY: 100, button: 0, pointerType: "mouse" }));
    root.dispatchEvent(pointerEvent("pointermove", { clientX: 140, clientY: 100, pointerType: "mouse" }));
    root.dispatchEvent(pointerEvent("pointerup", { pointerType: "mouse" }));
    hit.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await nextTick();
    expect(collected.click).toEqual(["e1"]); // the post-pan click was eaten
  });

  it("prevents and reports contextmenu on a hit stroke", async () => {
    const collected = { hover: [] as Array<string | null>, click: [] as string[], context: [] as string[], prevented: [] as boolean[] };
    const el = mountToDom(makeEdgeHost(collected));
    const event = new MouseEvent("contextmenu", { bubbles: true, cancelable: true });
    el.querySelector(".hk-node-canvas-edge-hit[data-edge-id='e2']")
      ?.dispatchEvent(event);
    await nextTick();
    expect(collected.context).toEqual(["e2"]);
    expect(event.defaultPrevented).toBe(true);
  });

  it("synthesizes contextmenu from a touch long-press", () => {
    vi.useFakeTimers();
    try {
      const collected = { hover: [] as Array<string | null>, click: [] as string[], context: [] as string[], prevented: [] as boolean[] };
      const el = mountToDom(makeEdgeHost(collected));
      const hit = el.querySelector(".hk-node-canvas-edge-hit[data-edge-id='e1']") as HTMLElement;
      hit.dispatchEvent(pointerEvent("pointerdown", { clientX: 40, clientY: 40 }));
      vi.advanceTimersByTime(500);
      expect(collected.context).toEqual(["e1"]);
      // Moving past the slop before the hold fires cancels it.
      hit.dispatchEvent(pointerEvent("pointerdown", { clientX: 40, clientY: 40 }));
      hit.dispatchEvent(pointerEvent("pointermove", { clientX: 70, clientY: 40 }));
      vi.advanceTimersByTime(500);
      expect(collected.context).toEqual(["e1"]); // no second open
      hit.dispatchEvent(pointerEvent("pointerup"));
    } finally {
      vi.useRealTimers();
    }
  });

  it("renders and hits explicit subpaths (bus trunk + stubs)", async () => {
    const busEdge: NodeCanvasEdge = {
      id: "bus",
      from: { x: 0, y: 0 },
      to: { x: 100, y: 0 },
      subpaths: [
        { d: "M 0 0 L 0 20", width: 1.4 },
        { d: "M 0 20 L 100 20", width: 5 },
        { d: "M 100 20 L 100 0", width: 1.4 },
      ],
    };
    const Host = defineComponent({
      setup() {
        return () =>
          h(HkNodeCanvas, {
            edges: [busEdge],
            interactiveEdges: true,
            minimap: false,
          }, { default: () => h("div", "x") });
      },
    });
    const el = mountToDom(Host);
    const group = el.querySelector(".hk-node-canvas-edge[data-edge-id='bus']") as HTMLElement;
    // 3 halo + 3 ink strokes.
    expect(group.querySelectorAll("path")).toHaveLength(6);
    // One hit stroke per subpath, all mapped to the same edge.
    const hits = el.querySelectorAll(".hk-node-canvas-edge-hit[data-edge-id='bus']");
    expect(hits).toHaveLength(3);
    // The trunk hit is the fattest (its own width, camera-aware).
    const widths = [...hits].map((p) => Number((p as SVGPathElement).getAttribute("stroke-width")));
    expect(widths[1]).toBeGreaterThan(widths[0]);
  });

  it("clears the hover when the hovered edge disappears", async () => {
    const collected = { hover: [] as Array<string | null>, click: [] as string[], context: [] as string[], prevented: [] as boolean[] };
    const edges = ref<NodeCanvasEdge[]>([...EDGES]);
    const Host = defineComponent({
      setup() {
        return () =>
          h(HkNodeCanvas, {
            edges: edges.value,
            interactiveEdges: true,
            minimap: false,
            onEdgeHover: (edge: NodeCanvasEdge | null) => collected.hover.push(edge ? edge.id : null),
          }, { default: () => h("div", "x") });
      },
    });
    const el = mountToDom(Host);
    el.querySelector(".hk-node-canvas-edge-hit[data-edge-id='e1']")
      ?.dispatchEvent(pointerEvent("pointerenter", { pointerType: "mouse" }));
    await nextTick();
    expect(collected.hover).toEqual(["e1"]);
    edges.value = EDGES.filter((e) => e.id !== "e1");
    await nextTick();
    // The vanish reported a leave so no stale hover class persists.
    expect(collected.hover).toEqual(["e1", null]);
    expect(el.querySelector(".hk-node-canvas-edge.is-hovered")).toBeNull();
  });
});
