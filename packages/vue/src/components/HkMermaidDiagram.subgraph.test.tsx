import { afterEach, describe, expect, it } from "vitest";
import { createApp, h, nextTick } from "vue";

import HkMermaidDiagram from "./HkMermaidDiagram";
import { mermaidParser } from "../mermaid";
import { setMermaidEngineForTests } from "../mermaid/engine";
import { mermaidReady } from "../mermaid/wasmEngine";

/**
 * Subgraph clusters (mermaid `subgraph … end`).
 *
 * Before cluster support the parser had no notion of a block: `subgraph` and
 * `end` fell through to the plain-node rule and the docs hub painted two
 * literal boxes labelled "subgraph" and "end" instead of a container. These
 * pins cover the three things the renderer must now get right — no fake
 * nodes, a paint-only frame behind the members, and edges addressed to the
 * cluster id landing on that frame.
 */

const CLUSTERED = [
  "flowchart TD",
  '    C["client"]',
  '    subgraph G["Gateway （node-2:8420）"]',
  '        N0["router"]',
  '        N1["memory"]',
  "    end",
  '    C -->|call| G',
  '    N1 --> T["agent"]',
].join("\n");

const mounts: { app: ReturnType<typeof createApp>; container: HTMLElement }[] = [];

function mount(source: string): HTMLElement {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const app = createApp({ render: () => h(HkMermaidDiagram, { source, minimap: false }) });
  app.mount(container);
  mounts.push({ app, container });
  return container;
}

async function settle(): Promise<void> {
  await nextTick();
  await new Promise((r) => setTimeout(r, 0));
  await nextTick();
}

afterEach(() => {
  for (const { app, container } of mounts.splice(0)) {
    app.unmount();
    container.remove();
  }
  setMermaidEngineForTests(null);
});

describe("HkMermaidDiagram subgraph clusters", () => {
  it("paints a cluster frame instead of subgraph/end nodes", async () => {
    setMermaidEngineForTests(mermaidParser);
    await mermaidReady;
    const c = mount(CLUSTERED);
    await settle();

    const labels = [...c.querySelectorAll(".hk-mmd-node__label")].map((el) => el.textContent);
    expect(labels).toEqual(["client", "router", "memory", "agent"]);
    expect(labels).not.toContain("subgraph");
    expect(labels).not.toContain("end");

    const frame = c.querySelector(".hk-mmd-group__label");
    expect(frame?.textContent).toBe("Gateway （node-2:8420）");
  });

  it("keeps the frame behind its members and out of the pointer path", async () => {
    setMermaidEngineForTests(mermaidParser);
    await mermaidReady;
    const c = mount(CLUSTERED);
    await settle();

    const painted = [...c.querySelectorAll(".hk-board-node")];
    const frameIndex = painted.findIndex((n) => n.querySelector(".hk-mmd-group"));
    const memberIndex = painted.findIndex((n) => n.querySelector(".hk-mmd-node__label")?.textContent === "router");
    expect(frameIndex).toBeGreaterThanOrEqual(0);
    expect(memberIndex).toBeGreaterThan(frameIndex);

    const frameNode = painted[frameIndex] as HTMLElement;
    expect(frameNode.className).toContain("hk-board-node--passthrough");
    expect(frameNode.className).toContain("hk-board-node--group");
    // Members stay interactive (only the frame is passthrough).
    expect((painted[memberIndex] as HTMLElement).className).not.toContain("hk-board-node--passthrough");
  });

  it("routes an edge addressed to the cluster id onto the frame", async () => {
    setMermaidEngineForTests(mermaidParser);
    await mermaidReady;
    const c = mount(CLUSTERED);
    await settle();

    // The cluster-sized edge is the only one whose path starts on the
    // client node and ends at the frame's border: assert the frame node
    // exists and the labelled edge is painted exactly once.
    expect(c.querySelectorAll(".hk-mmd-group")).toHaveLength(1);
    const edgeLabels = [...c.querySelectorAll(".hk-board-edge-label")].map((el) => el.textContent);
    expect(edgeLabels).toEqual(["call"]);
    const frame = c.querySelector(".hk-board-node--group") as HTMLElement;
    const members = [...c.querySelectorAll(".hk-board-node")].filter((n) => !n.classList.contains("hk-board-node--group"));
    // The frame truly encloses its members (inline geometry from the board).
    const box = (el: HTMLElement): { x: number; y: number; w: number; h: number } => ({
      x: Number.parseFloat(el.style.left),
      y: Number.parseFloat(el.style.top),
      w: Number.parseFloat(el.style.width),
      h: Number.parseFloat(el.style.height),
    });
    const f = box(frame);
    for (const member of members) {
      const m = box(member as HTMLElement);
      const inside = m.x >= f.x && m.y >= f.y && m.x + m.w <= f.x + f.w && m.y + m.h <= f.y + f.h;
      // Only the cluster's own members are enclosed; the client/agent sit
      // outside (mermaid draws the frame around members only).
      const label = member.querySelector(".hk-mmd-node__label")?.textContent;
      if (label === "router" || label === "memory") expect(inside).toBe(true);
      if (label === "client" || label === "agent") expect(inside).toBe(false);
    }
  });

  it("nests an outer frame around its inner frame", async () => {
    setMermaidEngineForTests(mermaidParser);
    await mermaidReady;
    const c = mount([
      "flowchart TD",
      '  subgraph Outer["outer"]',
      '    subgraph Inner["inner"]',
      '      A["a"]',
      "    end",
      '    B["b"]',
      "  end",
    ].join("\n"));
    await settle();

    const frames = [...c.querySelectorAll(".hk-board-node--group")].map((n) => ({
      label: n.querySelector(".hk-mmd-group__label")?.textContent,
      x: Number.parseFloat((n as HTMLElement).style.left),
      y: Number.parseFloat((n as HTMLElement).style.top),
      w: Number.parseFloat((n as HTMLElement).style.width),
      h: Number.parseFloat((n as HTMLElement).style.height),
    }));
    const outer = frames.find((f) => f.label === "outer");
    const inner = frames.find((f) => f.label === "inner");
    expect(outer && inner).toBeTruthy();
    expect(inner!.x).toBeGreaterThan(outer!.x);
    expect(inner!.y).toBeGreaterThan(outer!.y);
    expect(inner!.x + inner!.w).toBeLessThan(outer!.x + outer!.w);
    expect(inner!.y + inner!.h).toBeLessThan(outer!.y + outer!.h);
  });
});