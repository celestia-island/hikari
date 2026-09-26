import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";
import { createApp, h } from "vue";

import * as Hk from "../index";
import HkBoard from "./HkBoard";
import HkMinimap from "./HkMinimap";

const mounts: Array<{ app: ReturnType<typeof createApp>; container: HTMLElement }> = [];

function mount(node: ReturnType<typeof h>) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const app = createApp({ render: () => node });
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

/**
 * SVG presentation attributes carrying `var()` colors are NOT substituted
 * on every engine — Firefox drops the whole declaration (stroke:none / fill:
 * none → invisible ink; svgwg#1031, browsers still disagree). The house
 * contract is therefore: paint through an inline `style` channel BESIDE the
 * attribute (inline always wins, so literal colors behave identically, while
 * var() colors still resolve everywhere). HkGaugeRing documents the same
 * contract for its ring colors; these tests pin the remaining SVG painters.
 */

describe("HkBoard edge ink dual channel", () => {
  it("paints edge strokes through the inline style beside the attribute", () => {
    const c = mount(
      h(HkBoard, {
        nodes: [
          { id: "a", x: 40, y: 40, w: 120, h: 60, label: "A" },
          { id: "b", x: 320, y: 40, w: 120, h: 60, label: "B" },
        ],
        edges: [{ id: "e1", from: "a", to: "b" }],
      }),
    );
    const edge = c.querySelector(".hk-board-edge") as SVGPathElement;
    expect(edge).toBeTruthy();
    const attr = edge.getAttribute("stroke");
    const inline = edge.style.stroke;
    // the attribute keeps the literal value…
    expect(attr).toBe("rgb(var(--color-primary) / 38%)");
    // …and the inline channel carries the SAME var() form so Firefox resolves it
    expect(inline).toBe("rgb(var(--color-primary) / 38%)");
  });
});

describe("HkMinimap paint dual channel", () => {
  it("paints box fill/stroke through the inline style beside the attributes", () => {
    const c = mount(
      h(HkMinimap, {
        boxes: [{ id: "b1", bounds: { x: 0, y: 0, w: 100, h: 80 }, color: "rgb(var(--color-primary))" }],
        hubPos: { x: 600, y: 400 },
      }),
    );
    const box = c.querySelector(".hk-minimap-svg rect[fill]") as SVGRectElement;
    expect(box).toBeTruthy();
    expect(box.getAttribute("fill")).toBe("rgb(var(--color-primary))");
    expect(box.style.fill).toBe("rgb(var(--color-primary))");
    expect(box.style.stroke).toBe("rgb(var(--color-primary))");
  });

  it("paints the hub dot and viewport frame through the inline style", () => {
    const c = mount(
      h(HkMinimap, {
        // an empty roster renders null (documented early return) — the frame
        // and hub ride along with any painted box
        boxes: [{ id: "b1", bounds: { x: 0, y: 0, w: 100, h: 80 }, color: "rgb(var(--color-info, #5b8def))" }],
        hubPos: { x: 600, y: 400 },
      }),
    );
    const svg = c.querySelector(".hk-minimap-svg") as SVGSVGElement;
    expect(svg).toBeTruthy();
    const hub = svg.querySelector("circle") as SVGCircleElement;
    expect(hub.getAttribute("fill")).toBe("rgb(var(--color-primary))");
    expect(hub.style.fill).toBe("rgb(var(--color-primary))");
    const frame = svg.querySelector('rect[stroke-dasharray="3 2"]') as SVGRectElement;
    expect(frame.getAttribute("stroke")).toBe("rgb(var(--color-primary))");
    expect(frame.style.stroke).toBe("rgb(var(--color-primary))");
  });
});

describe("static sweep — literal var() presentation attributes must ride an inline style", () => {
  const dir = dirname(fileURLToPath(import.meta.url));

  /** Returns offending `stroke="…var(…"` / `fill="…var(…"` literal lines that
   *  have no compensating `style={{` within the following 3 lines. */
  async function violations(file: string): Promise<string[]> {
    const text = await readFile(join(dir, file), "utf-8");
    const lines = text.split("\n");
    const bad: string[] = [];
    for (let i = 0; i < lines.length; i++) {
      if (/\b(stroke|fill)="[^"]*var\(--/.test(lines[i])) {
        const window = lines.slice(i + 1, i + 4).join("\n");
        const prop = /stroke=/.test(lines[i]) ? "stroke" : "fill";
        if (!window.includes(`style={{`) || !window.includes(`${prop}:`)) {
          bad.push(`${file}:${i + 1}: ${lines[i].trim()}`);
        }
      }
    }
    return bad;
  }

  it("the sweep self-certifies on a known-bad sample", async () => {
    // Zero-产出防呆：the detector must fire on a constructed violation, or the
    // sweep below proves nothing.
    const badSample = [
      `<circle`,
      `  cx={1}`,
      `  fill="rgb(var(--color-x))"`,
      `  r={2}`,
      `/>`,
    ].join("\n");
    const lines = badSample.split("\n");
    let fired = false;
    for (let i = 0; i < lines.length; i++) {
      if (/\b(stroke|fill)="[^"]*var\(--/.test(lines[i])) {
        const window = lines.slice(i + 1, i + 4).join("\n");
        if (!window.includes(`style={{`)) fired = true;
      }
    }
    expect(fired).toBe(true);
    void violations;
  });

  it("every painted component file is clean", async () => {
    const files = (await readdir(dir)).filter((f) => /^Hk.+\.tsx$/.test(f) && !f.includes(".test."));
    const offenders: string[] = [];
    for (const f of files) {
      offenders.push(...(await violations(f)));
    }
    expect(offenders).toEqual([]);
  });
});

describe("index export surface smoke", () => {
  it("exposes the standard KPI/filter/painter surfaces under both names", () => {
    for (const name of [
      "HkStatCard",
      "HStatCard",
      "HkFilterBar",
      "HFilterBar",
      "HkGaugeRing",
      "HGaugeRing",
      "HkBoard",
      "HkMinimap",
      "HkNodeCanvas",
      "HkEmptyState",
      "HkPageHeader",
      "HkTable",
      "HkIconChip",
      "HIconChip",
      "HkCardList",
      "HCardList",
      "HkListRow",
      "HListRow",
      "HkSectionHeader",
      "HSectionHeader",
      "HkAdminTablePage",
    ] as const) {
      expect(Hk, `missing export: ${name}`).toHaveProperty(name);
    }
    expect(typeof Hk.statToneColor).toBe("function");
  });
});
