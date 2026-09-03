import { afterEach, describe, expect, it } from "vitest";
import { createApp, h, nextTick } from "vue";

import { HkJsonTree, buildJsonTree, tryParseJson } from "./HkJsonTree";

const mounts: Array<{ app: ReturnType<typeof createApp>; container: HTMLElement }> = [];

function mountTree(props: Record<string, unknown>) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const app = createApp({ render: () => h(HkJsonTree, props) });
  app.mount(container);
  mounts.push({ app, container });
  return container;
}

afterEach(() => {
  for (const { app, container } of mounts) {
    app.unmount();
    container.remove();
  }
  mounts.length = 0;
});

describe("tryParseJson", () => {
  it("parses objects and arrays but rejects primitives", () => {
    expect(tryParseJson('{"a":1}')).toEqual({ a: 1 });
    expect(tryParseJson("[1,2]")).toEqual([1, 2]);
    expect(tryParseJson("42")).toBeNull();
    expect(tryParseJson('"str"')).toBeNull();
    expect(tryParseJson("not json")).toBeNull();
    expect(tryParseJson("")).toBeNull();
  });
});

describe("buildJsonTree", () => {
  it("builds nested nodes with stable unique ids", () => {
    const root = buildJsonTree({ a: 1, b: { c: "x" } });
    expect(root).not.toBeNull();
    expect(root!.childCount).toBe(2);
    expect(root!.children.map(c => c.key)).toEqual(["a", "b"]);
    const ids = [root!.id, ...root!.children.flatMap(c => [c.id, ...c.children.map(g => g.id)])];
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("returns null for non-containers", () => {
    expect(buildJsonTree("text")).toBeNull();
    expect(buildJsonTree(null)).toBeNull();
  });

  it("respects maxDepth when building children", () => {
    const root = buildJsonTree({ a: { b: { c: 1 } } }, 1);
    expect(root!.children[0]!.children).toHaveLength(0);
    expect(root!.children[0]!.childCount).toBe(1);
  });
});

describe("HkJsonTree component", () => {
  it("renders rows for keys and primitive values from text", () => {
    const el = mountTree({ text: '{"name":"chest","tries":3}' });
    const rows = el.querySelectorAll(".s-jt-row");
    expect(rows.length).toBe(3);
    expect(el.querySelector(".s-jt-key")!.textContent).toBe("name");
    expect(el.querySelector(".s-jv-str")!.textContent).toBe('"chest"');
    expect(el.querySelector(".s-jv-num")!.textContent).toBe("3");
    expect(el.querySelectorAll(".s-jt-type").length).toBeGreaterThan(0);
  });

  it("renders nothing for non-container input", () => {
    const el = mountTree({ text: '"just a string"' });
    expect(el.querySelector(".s-tool-json-tree")).toBeNull();
  });

  it("toggles containers open and closed on row clicks", async () => {
    const el = mountTree({ text: '{"cfg":{"retries":2}}' });
    // Root + first-level children start expanded: the leaf row is visible.
    expect(el.querySelector(".s-jv-num")!.textContent).toBe("2");
    // Collapse the root container.
    const rootRow = el.querySelector('.s-jt-row[data-parent]')!;
    (rootRow as HTMLElement).click();
    await nextTick();
    // Closed container shows the inline preview instead of children.
    expect(el.querySelector(".s-jt-preview")).not.toBeNull();
    expect(el.querySelector(".s-jv-num")).toBeNull();
    // Re-open restores the child rows.
    (rootRow as HTMLElement).click();
    await nextTick();
    expect(el.querySelector(".s-jv-num")!.textContent).toBe("2");
  });

  it("collapses and re-expands long strings via row clicks", async () => {
    const long = Array.from({ length: 15 }, (_, i) => `line-${i}`).join("\n");
    const el = mountTree({ text: JSON.stringify({ log: long }) });
    // Direct children of the root start expanded: raw per-line rows show.
    expect(el.querySelectorAll(".s-jv-str-raw")).toHaveLength(15);
    // data-parent rows: [0] is the root container, [1] the long string.
    const row = el.querySelectorAll(".s-jt-row[data-parent]")[1]!;
    (row as HTMLElement).click();
    await nextTick();
    expect(el.querySelectorAll(".s-jv-str-raw")).toHaveLength(0);
    (row as HTMLElement).click();
    await nextTick();
    expect(el.querySelectorAll(".s-jv-str-raw")).toHaveLength(15);
  });

  it("prefers the value prop over text", () => {
    const el = mountTree({ value: { from: "value" }, text: '{"from":"text"}' });
    expect(el.querySelector(".s-jt-key")!.textContent).toBe("from");
    expect(el.querySelector(".s-jv-str")!.textContent).toBe('"value"');
  });
});
