import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h, nextTick, ref } from "vue";

import HkContextMenuProvider from "./HkContextMenuProvider";
import { HkJsonTree } from "./HkJsonTree";

/**
 * HkJsonTree editable mode — the opt-in menu-driven editing lane.
 *
 * The read-only viewer is pinned by HkJsonTree.test.tsx /
 * HkJsonTree.contract.test.ts; everything here exercises what ONLY exists
 * when a host passes `editable` with a `value` root: the row context menu
 * (through the shared provider machinery), the inline editor (chips,
 * invalid-number blocking, Enter/Escape/blur), the empty-container
 * affordance and the path-keyed expansion set. Mounting uses a live host
 * component (reactive value + update:value handler) because the tree is a
 * CONTROLLED editor: every commit is emitted with the new root and only
 * becomes visible after the host applies it.
 *
 * Sequencing: the context-menu trigger binds through a watcher on the
 * tree element, so every test settles a tick after mount BEFORE dispatching
 * events on rows.
 */

const mounts: Array<{ app: ReturnType<typeof createApp>; container: HTMLElement }> = [];

/** A live host: owns the root value, mirrors commits back into the tree. */
function mountEditableHost(initial: unknown, opts: { provider?: boolean } = {}) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const value = ref(initial);
  const emitted: unknown[] = [];
  const Inner = defineComponent({
    name: "JtEditableHost",
    setup() {
      return () =>
        h(HkJsonTree, {
          value: value.value,
          editable: true,
          "onUpdate:value": (v: unknown) => {
            emitted.push(v);
            value.value = v;
          },
        });
    },
  });
  const app = createApp({
    render: () =>
      opts.provider === false ? h(Inner) : h(HkContextMenuProvider, () => h(Inner)),
  });
  app.mount(container);
  mounts.push({ app, container });
  return { container, value, emitted };
}

function mountTree(props: Record<string, unknown>) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const app = createApp({ render: () => h(HkJsonTree, props) });
  app.mount(container);
  mounts.push({ app, container });
  return container;
}

afterEach(() => {
  for (const { app, container } of mounts.splice(0)) {
    app.unmount();
    container.remove();
  }
  document
    .querySelectorAll(
      ".hk-select-popout, .hk-select-sheet-panel, .hk-select-sheet-scrim",
    )
    .forEach((el) => el.remove());
  // HkMenu panels push back-guard history entries (same discipline as
  // HkMenu's own tests); fake timers must never leak into the next test.
  window.history.replaceState(null, "");
  vi.useRealTimers();
});

/** nextTick + a macrotask + nextTick — menus mount/unmount through
 *  transitions and history, and the trigger binding lands on a watcher
 *  flush, so a single nextTick races them. */
async function settle(): Promise<void> {
  await nextTick();
  await new Promise((resolve) => setTimeout(resolve, 0));
  await nextTick();
}

/** Past the fold's report window: the leaving block is really gone. */
async function settleFold() {
  await vi.advanceTimersByTimeAsync(400);
  await nextTick();
}

/** Fake-timer twin of `settle()`: flushes Vue and the faked macrotask
 *  queue without ever touching real time. */
async function settleFake(): Promise<void> {
  await nextTick();
  await vi.advanceTimersByTimeAsync(0);
  await nextTick();
}

const popouts = () =>
  Array.from(document.querySelectorAll(".hk-select-popout")) as HTMLElement[];

const menuRows = () =>
  Array.from(document.querySelectorAll(".hk-menu-row")) as HTMLButtonElement[];

function menuRow(label: string): HTMLButtonElement | undefined {
  return menuRows().find((r) => r.textContent?.trim() === label);
}

/** The row stamped with the node's path (editable mode's menu address).
 *  Attribute-value comparison — happy-dom rejects escaped quotes inside
 *  CSS attribute selectors, so the path literal never goes near one. */
function rowByPath(container: HTMLElement, path: unknown[]): Element | null {
  const attr = JSON.stringify(path);
  return (
    Array.from(container.querySelectorAll("[data-jt-node]")).find(
      (el) => el.getAttribute("data-jt-node") === attr,
    ) ?? null
  );
}

function contextMenu(el: Element, x = 12, y = 12) {
  el.dispatchEvent(
    new MouseEvent("contextmenu", {
      bubbles: true,
      cancelable: true,
      clientX: x,
      clientY: y,
    }),
  );
}

function editorRow(container: HTMLElement): HTMLElement | null {
  return container.querySelector(".s-jt-edit");
}

function editorInput(container: HTMLElement, label: "Key" | "Value"): HTMLInputElement | null {
  return container.querySelector(`.s-jt-edit input[aria-label="${label}"]`);
}

/** Type into an editor input the way a user's keystrokes arrive. */
function typeInto(input: HTMLInputElement, text: string) {
  input.value = text;
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

function pressKey(input: HTMLInputElement, key: string) {
  input.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
}

describe("HkJsonTree editable opt-in surface", () => {
  it("keeps read-only trees byte-identical: no editable class, no row stamps", () => {
    const el = mountTree({ value: { a: { b: 1 } } });
    const root = el.firstElementChild as HTMLElement;
    expect(root.classList.contains("s-jt-editable")).toBe(false);
    expect(el.querySelector("[data-jt-node]")).toBeNull();
    expect(el.querySelector(".s-jt-empty-add")).toBeNull();
  });

  it("marks an editable tree and stamps rows with node paths", async () => {
    const { container } = mountEditableHost({ a: { b: 1 } });
    await settle();
    const root = container.firstElementChild as HTMLElement;
    expect(root.classList.contains("s-jt-editable")).toBe(true);
    expect(rowByPath(container, [])).not.toBeNull();
    expect(rowByPath(container, ["a"])).not.toBeNull();
    expect(rowByPath(container, ["a", "b"])).not.toBeNull();
  });

  it("stays read-only for text-driven trees even when editable is on", async () => {
    // Editing pairs with the controlled `value` root; a text-only tree has
    // nothing to mutate, so it must not pretend otherwise.
    const el = mountTree({ text: '{"a":1}', editable: true });
    expect((el.firstElementChild as HTMLElement).classList.contains("s-jt-editable")).toBe(false);
    expect(el.querySelector("[data-jt-node]")).toBeNull();
    contextMenu(el.querySelector(".s-jt-row")!);
    await settle();
    expect(popouts()).toHaveLength(0);
  });

  it("opens nothing and throws nothing without a provider (NOOP contract)", async () => {
    const { container } = mountEditableHost({ a: 1 }, { provider: false });
    await settle();
    contextMenu(rowByPath(container, ["a"])!);
    await settle();
    expect(popouts()).toHaveLength(0);
  });
});

describe("HkJsonTree row menu", () => {
  it("offers edit/rename/delete for an object-member leaf and deletes it", async () => {
    const { container, emitted } = mountEditableHost({ name: "chest", tries: 3 });
    await settle();
    contextMenu(rowByPath(container, ["name"])!);
    await settle();
    expect(popouts()).toHaveLength(1);
    expect(menuRow("Edit value")).toBeTruthy();
    expect(menuRow("Rename key")).toBeTruthy();
    expect(menuRow("Delete")).toBeTruthy();
    menuRow("Delete")!.click();
    await settle();
    expect(emitted.at(-1)).toEqual({ tries: 3 });
    expect(rowByPath(container, ["name"])).toBeNull();
    expect(rowByPath(container, ["tries"])).not.toBeNull();
  });

  it("offers only the add-child submenu for the root", async () => {
    const { container } = mountEditableHost({ a: 1 });
    await settle();
    contextMenu(rowByPath(container, [])!);
    await settle();
    expect(menuRow("Edit value")).toBeUndefined();
    expect(menuRow("Rename key")).toBeUndefined();
    expect(menuRow("Delete")).toBeUndefined();
    expect(menuRow("New child")).toBeTruthy();
  });

  it("cascades the six-type submenu and lands the default with an inline editor", async () => {
    const { container, emitted } = mountEditableHost({ a: 1 });
    await settle();
    contextMenu(rowByPath(container, [])!);
    await settle();
    menuRow("New child")!.click();
    await settle();
    // The submenu carries exactly the six JSON types.
    const typeLabels = ["String", "Number", "Boolean", "Null", "Object", "Array"];
    for (const label of typeLabels) expect(menuRow(label), label).toBeTruthy();
    menuRow("Object")!.click();
    await settle();
    expect(emitted.at(-1)).toEqual({ a: 1, key: {} });
    // The fresh child is open for inline editing (key input focused lane).
    const row = editorRow(container);
    expect(row).not.toBeNull();
    expect(editorInput(container, "Key")).not.toBeNull();
    // The editor replaced the child's row: the new key shows as input, and
    // the value side stays hidden for containers.
    expect(editorInput(container, "Value")).toBeNull();
  });

  it("builds container menus with rename + add-child (no edit-value)", async () => {
    const { container } = mountEditableHost({ cfg: { retries: 2 } });
    await settle();
    contextMenu(rowByPath(container, ["cfg"])!);
    await settle();
    expect(menuRow("Edit value")).toBeUndefined();
    expect(menuRow("Rename key")).toBeTruthy();
    expect(menuRow("New child")).toBeTruthy();
    expect(menuRow("Delete")).toBeTruthy();
  });

  it("omits rename for array elements but keeps edit + delete", async () => {
    const { container } = mountEditableHost({ list: [1, 2] });
    await settle();
    contextMenu(rowByPath(container, ["list", "0"])!);
    await settle();
    expect(menuRow("Edit value")).toBeTruthy();
    expect(menuRow("Rename key")).toBeUndefined();
    expect(menuRow("Delete")).toBeTruthy();
  });
});

describe("HkJsonTree inline editor", () => {
  it("commits a new string on Enter and emits the new root", async () => {
    const { container, emitted } = mountEditableHost({ name: "chest", tries: 3 });
    await settle();
    contextMenu(rowByPath(container, ["name"])!);
    await settle();
    menuRow("Edit value")!.click();
    await settle();
    const input = editorInput(container, "Value")!;
    expect(input.value).toBe("chest");
    typeInto(input, "krolva");
    pressKey(input, "Enter");
    await settle();
    expect(emitted.at(-1)).toEqual({ name: "krolva", tries: 3 });
    expect(editorRow(container)).toBeNull();
    // The rebuilt tree shows the committed value.
    expect(container.querySelector(".s-jv-str")!.textContent).toBe('"krolva"');
  });

  it("blocks invalid numbers from committing and shows the invalid state", async () => {
    const { container, emitted } = mountEditableHost({ tries: 3 });
    await settle();
    contextMenu(rowByPath(container, ["tries"])!);
    await settle();
    menuRow("Edit value")!.click();
    await settle();
    // The draft type derives from the committed value: number is active.
    const active = container.querySelector(".s-jt-chip[data-on]")!;
    expect(active.textContent).toBe("Number");
    const input = editorInput(container, "Value")!;
    typeInto(input, "abc");
    await nextTick();
    expect(input.hasAttribute("data-invalid")).toBe(true);
    expect(container.querySelector(".s-jt-invalid")?.textContent).toBe("Invalid number");
    pressKey(input, "Enter");
    await settle();
    expect(emitted).toHaveLength(0); // blocked
    typeInto(input, "42");
    await nextTick();
    expect(input.hasAttribute("data-invalid")).toBe(false);
    pressKey(input, "Enter");
    await settle();
    expect(emitted.at(-1)).toEqual({ tries: 42 });
  });

  it("switches leaf type through the chips (boolean, null)", async () => {
    const { container, emitted } = mountEditableHost({ flag: true });
    await settle();
    contextMenu(rowByPath(container, ["flag"])!);
    await settle();
    menuRow("Edit value")!.click();
    await settle();
    const pick = (label: string) =>
      (Array.from(container.querySelectorAll(".s-jt-chip")) as HTMLButtonElement[])
        .find((c) => c.textContent?.trim() === label)!
        .click();
    pick("Boolean");
    await nextTick();
    // Boolean renders a true/false pair instead of a text input.
    expect(editorInput(container, "Value")).toBeNull();
    const pair = Array.from(container.querySelectorAll(".s-jt-chip")).map((c) =>
      c.textContent?.trim(),
    );
    expect(pair).toContain("true");
    expect(pair).toContain("false");
    pick("false");
    await nextTick();
    pressKey(editorInput(container, "Key")!, "Enter");
    await settle();
    expect(emitted.at(-1)).toEqual({ flag: false });

    // Null type commits JSON null.
    contextMenu(rowByPath(container, ["flag"])!);
    await settle();
    menuRow("Edit value")!.click();
    await settle();
    pick("Null");
    await nextTick();
    expect(container.querySelector(".s-jt-edit .s-jv-null")?.textContent).toBe("null");
    pressKey(editorInput(container, "Key")!, "Enter");
    await settle();
    expect(emitted.at(-1)).toEqual({ flag: null });
  });

  it("renames an object member key (order may move; content must be exact)", async () => {
    const { container, emitted } = mountEditableHost({ name: "chest", tries: 3 });
    await settle();
    contextMenu(rowByPath(container, ["name"])!);
    await settle();
    menuRow("Rename key")!.click();
    await settle();
    const keyInput = editorInput(container, "Key")!;
    expect(keyInput.value).toBe("name");
    typeInto(keyInput, "title");
    pressKey(keyInput, "Enter");
    await settle();
    expect(emitted.at(-1)).toEqual({ tries: 3, title: "chest" });
    // The rebuilt tree carries the new key.
    expect(rowByPath(container, ["title"])).not.toBeNull();
    expect(rowByPath(container, ["name"])).toBeNull();
  });

  it("suppresses the emit for a no-op commit (byte-identical rename)", async () => {
    const { container, emitted } = mountEditableHost({ cfg: { retries: 2 } });
    await settle();
    contextMenu(rowByPath(container, ["cfg"])!);
    await settle();
    menuRow("Rename key")!.click();
    await settle();
    // Commit with the key text BYTE-IDENTICAL: the rename composite is
    // skipped (keyText === node.key), a container sets no value, so
    // commitEdit's `next !== props.value` guard (reference identity) sees
    // the untouched root and suppresses the emit entirely.
    pressKey(editorInput(container, "Key")!, "Enter");
    await settle();
    expect(emitted).toHaveLength(0);
    expect(editorRow(container)).toBeNull();
  });

  it("cancels on Escape without emitting", async () => {
    const { container, emitted } = mountEditableHost({ name: "chest" });
    await settle();
    contextMenu(rowByPath(container, ["name"])!);
    await settle();
    menuRow("Edit value")!.click();
    await settle();
    const input = editorInput(container, "Value")!;
    typeInto(input, "changed");
    pressKey(input, "Escape");
    await settle();
    expect(emitted).toHaveLength(0);
    expect(editorRow(container)).toBeNull();
    expect(container.querySelector(".s-jv-str")!.textContent).toBe('"chest"');
  });

  it("commits when focus leaves the editor row", async () => {
    const { container, emitted } = mountEditableHost({ name: "chest" });
    await settle();
    contextMenu(rowByPath(container, ["name"])!);
    await settle();
    menuRow("Edit value")!.click();
    await settle();
    const row = editorRow(container)!;
    const input = editorInput(container, "Value")!;
    typeInto(input, "outside");
    // Focus hops INSIDE the row (chip click) must not commit…
    row.dispatchEvent(new FocusEvent("focusout", { relatedTarget: input }));
    await settle();
    expect(emitted).toHaveLength(0);
    expect(editorRow(container)).not.toBeNull();
    // …while focus leaving the row entirely commits.
    row.dispatchEvent(new FocusEvent("focusout", { relatedTarget: document.body }));
    await settle();
    expect(emitted.at(-1)).toEqual({ name: "outside" });
    expect(editorRow(container)).toBeNull();
  });

  it("keeps the copy-on-click off the editor row and the affordance", async () => {
    const writeText = vi.fn(async () => undefined);
    const original = Object.getOwnPropertyDescriptor(navigator, "clipboard");
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    try {
      const { container, emitted } = mountEditableHost({ name: "chest", obj: {} });
      await settle();
      contextMenu(rowByPath(container, ["name"])!);
      await settle();
      menuRow("Edit value")!.click();
      await settle();
      editorRow(container)!.click();
      await nextTick();
      expect(writeText).not.toHaveBeenCalled();
      expect(emitted).toHaveLength(0);
      // The empty-container affordance is editing UI too, not a copy
      // target: clicking it opens the type picker, never the clipboard.
      (container.querySelector(".s-jt-empty-add") as HTMLButtonElement).click();
      await settle();
      expect(writeText).not.toHaveBeenCalled();
      expect(emitted).toHaveLength(0);
    } finally {
      if (original) Object.defineProperty(navigator, "clipboard", original);
      else Reflect.deleteProperty(navigator, "clipboard");
    }
  });
});

describe("HkJsonTree empty-container affordance", () => {
  it("offers the type picker for an open empty object and inserts the default", async () => {
    const { container, emitted } = mountEditableHost({ obj: {} });
    await settle();
    // Empty child containers start expanded (root + direct children).
    const add = container.querySelector(".s-jt-empty-add") as HTMLButtonElement;
    expect(add?.textContent).toContain("New child");
    add.click();
    await settle();
    expect(popouts()).toHaveLength(1);
    expect(menuRow("Array")).toBeTruthy();
    menuRow("String")!.click();
    await settle();
    expect(emitted.at(-1)).toEqual({ obj: { key: "" } });
    // The fresh child opens for inline editing; the affordance row is gone
    // (the container is no longer empty).
    expect(editorInput(container, "Key")).not.toBeNull();
    expect(container.querySelector(".s-jt-empty-add")).toBeNull();
  });
});

describe("HkJsonTree array editing", () => {
  it("appends the default child and opens the value editor (no key input)", async () => {
    const { container, emitted } = mountEditableHost({ list: [1] });
    await settle();
    contextMenu(rowByPath(container, ["list"])!);
    await settle();
    menuRow("New child")!.click();
    await settle();
    menuRow("Number")!.click();
    await settle();
    expect(emitted.at(-1)).toEqual({ list: [1, 0] });
    expect(editorInput(container, "Value")).not.toBeNull();
    expect(editorInput(container, "Key")).toBeNull();
    expect(rowByPath(container, ["list", "1"])).not.toBeNull();
  });

  it("deletes an array element by index and reindexes", async () => {
    const { container, emitted } = mountEditableHost({ list: [1, 2, 3] });
    await settle();
    contextMenu(rowByPath(container, ["list", "1"])!);
    await settle();
    menuRow("Delete")!.click();
    await settle();
    expect(emitted.at(-1)).toEqual({ list: [1, 3] });
    expect(rowByPath(container, ["list", "0"])).not.toBeNull();
    expect(rowByPath(container, ["list", "1"])).not.toBeNull();
    expect(rowByPath(container, ["list", "2"])).toBeNull();
  });
});

describe("HkJsonTree editable expansion (path-keyed)", () => {
  it("survives a rebuild: a collapsed node stays collapsed after a commit", async () => {
    vi.useFakeTimers();
    const { container, value } = mountEditableHost({ a: { deep: { b: 1 } }, c: 2 });
    await settleFake();
    const groupFor = (path: unknown[]) =>
      rowByPath(container, path)!.closest(".s-jt-group") as HTMLElement;
    // Collapse "a" (fold leaves the children mounted briefly).
    (rowByPath(container, ["a"])! as HTMLElement).click();
    await nextTick();
    await settleFold();
    expect(groupFor(["a"])!.hasAttribute("data-open")).toBe(false);
    // A rebuild (host swaps the value) must NOT re-expand — the expanded
    // set is keyed by path, not by the rebuilt tree's node ids.
    value.value = { a: { deep: { b: 1 } }, c: 3 };
    await nextTick();
    await settleFold();
    expect(groupFor(["a"])!.hasAttribute("data-open")).toBe(false);
  });

  it("does not reset expansion on an edit commit either", async () => {
    vi.useFakeTimers();
    const { container } = mountEditableHost({ a: { deep: { b: 1 } }, c: 2 });
    await settleFake();
    const groupFor = (path: unknown[]) =>
      rowByPath(container, path)!.closest(".s-jt-group") as HTMLElement;
    (rowByPath(container, ["a"])! as HTMLElement).click();
    await nextTick();
    await settleFold();
    expect(groupFor(["a"])!.hasAttribute("data-open")).toBe(false);
    // Commit an edit on "c" through the real flow: menu → editor → Enter.
    contextMenu(rowByPath(container, ["c"])!);
    await settleFold();
    menuRow("Edit value")!.click();
    await nextTick();
    const input = editorInput(container, "Value")!;
    typeInto(input, "9");
    pressKey(input, "Enter");
    await settleFold();
    expect(editorRow(container)).toBeNull();
    expect(groupFor(["a"])!.hasAttribute("data-open")).toBe(false);
  });

  it("keeps the non-editable reset behavior untouched (id-keyed reset)", async () => {
    vi.useFakeTimers();
    const container = document.createElement("div");
    document.body.appendChild(container);
    const value = ref({ a: { b: 1 }, c: 2 });
    const app = createApp({
      render: () => h(HkJsonTree, { value: value.value }),
    });
    app.mount(container);
    mounts.push({ app, container });
    await settleFake();
    // Read-only rows carry no path stamps: address the "a" row by its key
    // span (document order makes the first .s-jt-key the root's first
    // member, "a").
    const rowA = container.querySelector(".s-jt-key")!.closest(".s-jt-row")!;
    const groupFor = (el: Element) => el.closest(".s-jt-group") as HTMLElement;
    (rowA as HTMLElement).click();
    await nextTick();
    await settleFold();
    expect(groupFor(rowA).hasAttribute("data-open")).toBe(false);
    value.value = { a: { b: 1 }, c: 3 };
    await nextTick();
    await settleFold();
    // Read-only trees reset to root + direct children on rebuild, exactly
    // as before editable mode existed.
    expect(groupFor(rowA).hasAttribute("data-open")).toBe(true);
  });
});

describe("HkJsonTree long-string editing", () => {
  it("edits the string value from a raw line row's menu", async () => {
    const { container, emitted } = mountEditableHost({ log: "line1\nline2\nline3".padEnd(80, "x") });
    await settle();
    // Direct children start expanded: the raw per-line rows are visible.
    const lineRow = container.querySelector(".s-jv-str-raw")!.closest(".s-jt-row")!;
    expect(lineRow.getAttribute("data-jt-node")).toBe('["log"]');
    contextMenu(lineRow);
    await settle();
    menuRow("Edit value")!.click();
    await settle();
    // The whole long-string group is replaced by the editor row while
    // editing; the raw line rows are gone.
    expect(editorRow(container)).not.toBeNull();
    expect(container.querySelector(".s-jv-str-raw")).toBeNull();
    const input = editorInput(container, "Value")!;
    typeInto(input, "short");
    pressKey(input, "Enter");
    await settle();
    expect(emitted.at(-1)).toEqual({ log: "short" });
  });
});
