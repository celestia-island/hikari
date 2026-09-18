import { describe, expect, it } from "vitest";
import { createApp, defineComponent, h, nextTick, ref } from "vue";

import HkNodeCanvas from "./HkNodeCanvas";
import {
  computeLod,
  edgeMidpoint,
  edgePath,
  LOD_DEFAULTS,
} from "./nodeCanvasTypes";

/** Mount a component into a detached div and return the root element. */
function mountToDom(component: ReturnType<typeof defineComponent>): HTMLElement {
  const el = document.createElement("div");
  document.body.appendChild(el);
  const app = createApp(component);
  app.mount(el);
  return el;
}

const CanvasHost = defineComponent({
  props: {
    edges: { type: Array, default: () => [] },
    printMode: { type: Boolean, default: false },
    printPaper: { type: String as () => "a4-landscape" | "a3-landscape" | "auto", default: "auto" },
    minimap: { type: Boolean, default: false },
  },
  setup(props) {
    return () =>
      h(HkNodeCanvas, {
        edges: props.edges as never[],
        printMode: props.printMode,
        printPaper: props.printPaper,
        minimap: props.minimap,
      }, { default: () => h("div", "content") });
  },
});

/**
 * HkNodeCanvas base upgrade tests — the new rendering capabilities:
 * edge rendering, LOD, print mode, painter registration, and export.
 */
describe("HkNodeCanvas rendering base upgrades", () => {
  describe("nodeCanvasTypes", () => {
    it("computes LOD from zoom factor and thresholds", () => {
      expect(computeLod(1.0, LOD_DEFAULTS)).toBe("high");
      expect(computeLod(0.5, LOD_DEFAULTS)).toBe("high");
      expect(computeLod(0.45, LOD_DEFAULTS)).toBe("high");
      expect(computeLod(0.44, LOD_DEFAULTS)).toBe("medium");
      expect(computeLod(0.18, LOD_DEFAULTS)).toBe("medium");
      expect(computeLod(0.17, LOD_DEFAULTS)).toBe("low");
      expect(computeLod(0.05, LOD_DEFAULTS)).toBe("low");
    });

    it("supports custom LOD thresholds", () => {
      const custom = { medium: 0.8, low: 0.3 };
      expect(computeLod(0.9, custom)).toBe("high");
      expect(computeLod(0.75, custom)).toBe("medium");
      expect(computeLod(0.2, custom)).toBe("low");
    });

    it("generates a direct edge path", () => {
      const path = edgePath(
        { from: { x: 0, y: 0 }, to: { x: 100, y: 50 } },
        "direct",
      );
      expect(path).toBe("M 0 0 L 100 50");
    });

    it("generates a bezier edge path with correct control points", () => {
      const path = edgePath(
        { from: { x: 0, y: 0 }, to: { x: 200, y: 100 } },
        "bezier",
      );
      // cp = max(|dx| * 0.4, 40) = max(80, 40) = 80
      // C (from.x+80) from.y, (to.x-80) to.y, to.x to.y
      expect(path).toBe("M 0 0 C 80 0, 120 100, 200 100");
    });

    it("uses minimum control point offset for short edges", () => {
      // dx = 50 → cp = max(20, 40) = 40 (minimum kicks in)
      const path = edgePath(
        { from: { x: 0, y: 0 }, to: { x: 50, y: 0 } },
        "bezier",
      );
      expect(path).toBe("M 0 0 C 40 0, 10 0, 50 0");
    });

    it("generates an orthogonal (manhattan) edge path", () => {
      const path = edgePath(
        { from: { x: 0, y: 0 }, to: { x: 100, y: 100 } },
        "orthogonal",
      );
      expect(path).toBe("M 0 0 L 50 0 L 50 100 L 100 100");
    });

    it("computes edge midpoints", () => {
      const mid = edgeMidpoint(
        { from: { x: 0, y: 0 }, to: { x: 100, y: 100 } },
        "direct",
      );
      expect(mid).toEqual({ x: 50, y: 50 });
    });
  });

  describe("HkNodeCanvas component", () => {
    it("mounts without edges (backward compatible)", () => {
      const el = mountToDom(CanvasHost);
      const canvas = el.querySelector(".hk-node-canvas");
      expect(canvas).toBeTruthy();
      const layer = el.querySelector(".hk-node-canvas-layer");
      expect(layer?.textContent).toBe("content");
      // No edge layer when edges is empty.
      expect(el.querySelector(".hk-node-canvas-edges")).toBeNull();
      el.remove();
    });

    it("renders edges as SVG paths", async () => {
      const el = mountToDom(defineComponent({
        setup() {
          return () =>
            h(HkNodeCanvas, {
              minimap: false,
              edges: [
                { id: "e1", from: { x: 0, y: 0 }, to: { x: 100, y: 50 }, label: "proxy" },
                { id: "e2", from: { x: 50, y: 50 }, to: { x: 150, y: 150 }, routing: "direct" as const },
              ],
            }, { default: () => h("div") });
        },
      }));
      await nextTick();

      const paths = el.querySelectorAll(".hk-node-canvas-edge path");
      expect(paths.length).toBe(2);
      // First edge uses bezier by default.
      expect(paths[0].getAttribute("d")).toMatch(/^M 0 0 C /);
      // Second edge uses direct routing (override).
      expect(paths[1].getAttribute("d")).toBe("M 50 50 L 150 150");
      // Edge label is rendered.
      const label = el.querySelector(".hk-node-canvas-edge text");
      expect(label?.textContent).toBe("proxy");
      el.remove();
    });

    it("renders dashed edges with stroke-dasharray", async () => {
      const el = mountToDom(defineComponent({
        setup() {
          return () =>
            h(HkNodeCanvas, {
              minimap: false,
              edges: [
                { id: "e1", from: { x: 0, y: 0 }, to: { x: 100, y: 0 }, dashed: true },
              ],
            }, { default: () => h("div") });
        },
      }));
      await nextTick();
      const path = el.querySelector(".hk-node-canvas-edge path");
      expect(path?.getAttribute("stroke-dasharray")).toBe("6 4");
      el.remove();
    });

    it("renders a canvas layer element", () => {
      const el = mountToDom(CanvasHost);
      const canvas = el.querySelector("canvas.hk-node-canvas-canvas");
      expect(canvas).toBeTruthy();
      el.remove();
    });

    it("exposes levelOfDetail, registerPainter, exportSVG", () => {
      const exposed: Record<string, unknown> = {};
      const Host = defineComponent({
        setup() {
          const canvasRef = ref<unknown>(null);
          const check = () => {
            const vm = canvasRef.value as Record<string, unknown> | null;
            if (vm) {
              Object.assign(exposed, {
                levelOfDetail: vm.levelOfDetail,
                registerPainter: vm.registerPainter,
                unregisterPainter: vm.unregisterPainter,
                exportSVG: vm.exportSVG,
                exportPNG: vm.exportPNG,
              });
            }
          };
          return () =>
            h(HkNodeCanvas, {
              ref: canvasRef,
              minimap: false,
              camera: { k: 1, x: 0, y: 0 },
              onVnodeMounted: check,
            }, { default: () => h("div") });
        },
      });
      const el = mountToDom(Host);
      expect(exposed.levelOfDetail).toBeDefined();
      expect(typeof exposed.registerPainter).toBe("function");
      expect(typeof exposed.unregisterPainter).toBe("function");
      expect(typeof exposed.exportSVG).toBe("function");
      expect(typeof exposed.exportPNG).toBe("function");
      // LOD at zoom=1 should be "high". Vue expose auto-unwraps refs,
      // so this may be a string or a ref depending on the consumer pattern.
      const lod = exposed.levelOfDetail;
      const lodValue = typeof lod === "string" ? lod : (lod as { value: string }).value;
      expect(lodValue).toBe("high");
      el.remove();
    });

    it("printMode disables minimap and gestures", async () => {
      const el = mountToDom(defineComponent({
        setup() {
          return () =>
            h(HkNodeCanvas, {
              minimap: true,
              printMode: true,
            }, { default: () => h("div") });
        },
      }));
      await nextTick();
      const root = el.querySelector(".hk-node-canvas");
      expect(root).toBeTruthy();
      expect(root!.classList.contains("hk-node-canvas--print")).toBe(true);
      expect(el.querySelector(".hk-node-canvas-minimap")).toBeNull();
      expect(root!.getAttribute("data-pannable")).toBeNull();
      el.remove();
    });

    it("printMode with paper size sets fixed dimensions", async () => {
      const el = mountToDom(defineComponent({
        setup() {
          return () =>
            h(HkNodeCanvas, {
              printMode: true,
              printPaper: "a4-landscape" as const,
            }, { default: () => h("div") });
        },
      }));
      await nextTick();
      const root = el.querySelector(".hk-node-canvas") as HTMLElement;
      expect(root.style.width).toBe("1122.5px");
      expect(root.style.height).toBe("793.7px");
      el.remove();
    });
  });
});
