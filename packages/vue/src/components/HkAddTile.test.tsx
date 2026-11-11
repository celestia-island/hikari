import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h, nextTick } from "vue";

import HkAddTile from "./HkAddTile";

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

/* Functional icon stub with a distinguishing class, same recipe as the
   HkEmptyState tests, so the icon prop / slot override can be asserted
   to have actually mounted. */
const StubIcon = defineComponent({
  name: "StubIcon",
  setup() {
    return () => h("i", { class: "stub-add-icon", "data-stub-icon": "true" });
  },
});

/** A drop event carrying the given files — plain Event + a defined
    dataTransfer, because happy-dom has no real DataTransfer. */
function dropEvent(files: File[]): Event {
  const ev = new Event("drop", { bubbles: true, cancelable: true });
  Object.defineProperty(ev, "dataTransfer", { value: { files } });
  return ev;
}

/** A dragleave carrying a relatedTarget — the containment contract the
    handler keys on (undefined leaves it null = "left to nothing"). */
function leaveEvent(relatedTarget: Node | null): Event {
  const ev = new Event("dragleave", { bubbles: true, cancelable: true });
  Object.defineProperty(ev, "relatedTarget", { value: relatedTarget });
  return ev;
}

function file(name: string): File {
  return new File(["x"], name, { type: "text/plain" });
}

function tileEl(c: HTMLElement): HTMLElement {
  return c.querySelector(".hk-add-tile") as HTMLElement;
}

describe("HkAddTile", () => {
  it("renders the label and the default Plus icon", () => {
    const c = mount(h(HkAddTile, null, { default: () => "Add one" }));
    const el = tileEl(c);
    expect(el.tagName).toBe("BUTTON");
    expect(el.textContent).toContain("Add one");
    expect(el.querySelector("svg")).not.toBeNull();
    expect(el.classList.contains("hk-add-tile--compact")).toBe(false);
  });

  it("compact form carries the compact modifier", () => {
    const c = mount(h(HkAddTile, { compact: true }, { default: () => "Add" }));
    expect(tileEl(c).classList.contains("hk-add-tile--compact")).toBe(true);
  });

  it("icon prop replaces the default glyph", () => {
    const c = mount(h(HkAddTile, { icon: StubIcon }, { default: () => "Add" }));
    expect(c.querySelector(".stub-add-icon")).not.toBeNull();
  });

  it("icon slot wins over both the default and the icon prop", () => {
    const c = mount(
      h(HkAddTile, { icon: StubIcon }, { icon: () => h("i", { class: "slot-icon" }), default: () => "Add" }),
    );
    expect(c.querySelector(".slot-icon")).not.toBeNull();
    expect(c.querySelector(".stub-add-icon")).toBeNull();
    // The default Plus must not ride along either.
    expect(tileEl(c).querySelectorAll("svg").length).toBe(0);
  });

  it("emits click for an enabled tile", () => {
    const onClick = vi.fn();
    const c = mount(h(HkAddTile, { onClick }, { default: () => "Add" }));
    tileEl(c).dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("does not emit click when disabled", () => {
    const onClick = vi.fn();
    const c = mount(h(HkAddTile, { disabled: true, onClick }, { default: () => "Add" }));
    const el = tileEl(c);
    expect(el.classList.contains("hk-add-tile--disabled")).toBe(true);
    // The handler-level guard (a disabled button never receives the
    // native click in a real browser, but dispatchEvent bypasses that).
    el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(onClick).not.toHaveBeenCalled();
  });

  it("emits drop-files with the dropped files", () => {
    const onDropFiles = vi.fn();
    const c = mount(h(HkAddTile, { droppable: true, onDropFiles }, { default: () => "Drop" }));
    const ev = dropEvent([file("a.toml"), file("b.toml")]);
    tileEl(c).dispatchEvent(ev);
    expect(onDropFiles).toHaveBeenCalledTimes(1);
    const files = onDropFiles.mock.calls[0][0] as File[];
    expect(files.map((f) => f.name)).toEqual(["a.toml", "b.toml"]);
  });

  it("ignores drops without files (the gesture contract is files)", () => {
    const onDropFiles = vi.fn();
    const c = mount(h(HkAddTile, { droppable: true, onDropFiles }, { default: () => "Drop" }));
    tileEl(c).dispatchEvent(dropEvent([]));
    expect(onDropFiles).not.toHaveBeenCalled();
  });

  it("ignores drops when not droppable", () => {
    const onDropFiles = vi.fn();
    const c = mount(h(HkAddTile, { onDropFiles }, { default: () => "Nope" }));
    tileEl(c).dispatchEvent(dropEvent([file("a.toml")]));
    expect(onDropFiles).not.toHaveBeenCalled();
  });

  it("ignores drops and drag styling when disabled", () => {
    const onDropFiles = vi.fn();
    const c = mount(
      h(HkAddTile, { disabled: true, droppable: true, onDropFiles }, { default: () => "Off" }),
    );
    const el = tileEl(c);
    el.dispatchEvent(new Event("dragenter", { bubbles: true }));
    expect(el.classList.contains("hk-add-tile--drag-over")).toBe(false);
    el.dispatchEvent(dropEvent([file("a.toml")]));
    expect(onDropFiles).not.toHaveBeenCalled();
  });

  it("keeps drag-over across child boundaries, clears on real exit", async () => {
    const c = mount(h(HkAddTile, { droppable: true }, { default: () => "Drop" }));
    const el = tileEl(c);
    // The default slot text is a direct child; enter the tile, then its
    // glyph boundary, then back into the label area only.
    el.dispatchEvent(new Event("dragenter", { bubbles: true }));
    await nextTick();
    expect(el.classList.contains("hk-add-tile--drag-over")).toBe(true);
    const inner = el.firstElementChild as Element;
    inner.dispatchEvent(new Event("dragenter", { bubbles: true })); // depth 2
    // Internal move (leaving the glyph toward the label): contained, so
    // the depth must NOT decrement — the old blind decrement cleared the
    // wash here.
    inner.dispatchEvent(leaveEvent(el));
    await nextTick();
    expect(el.classList.contains("hk-add-tile--drag-over")).toBe(true);
    el.dispatchEvent(leaveEvent(null)); // left to nothing — full reset
    await nextTick();
    expect(el.classList.contains("hk-add-tile--drag-over")).toBe(false);
  });

  it("self-heals when a hovered child leaves the DOM mid-drag", async () => {
    // The stuck-depth leak (residual sweep): a slot child removed
    // mid-hover never fires its own leave, so the old decrement could
    // strand the count above zero and keep the wash lit after the
    // pointer had fully exited. The containment reset clears the wash on
    // the first real exit regardless of how deep the count was stranded.
    const c = mount(h(HkAddTile, { droppable: true }, { default: () => "Drop" }));
    const el = tileEl(c);
    el.dispatchEvent(new Event("dragenter", { bubbles: true }));
    const inner = el.firstElementChild as Element;
    inner.dispatchEvent(new Event("dragenter", { bubbles: true })); // depth 2
    inner.remove(); // slot swap: the child's leave never fires
    el.dispatchEvent(leaveEvent(null)); // pointer exits the tile for real
    await nextTick();
    expect(el.classList.contains("hk-add-tile--drag-over")).toBe(false);
    // The next drag session starts from a clean slate.
    el.dispatchEvent(new Event("dragenter", { bubbles: true }));
    await nextTick();
    expect(el.classList.contains("hk-add-tile--drag-over")).toBe(true);
  });

  it("cancels dragenter/dragover exactly when it accepts the drag", () => {
    // The browser only DELIVERS a drop onto a target whose last dragover
    // was not cancelled — these defaultPrevented pins ARE the drop-target
    // contract; deleting either preventDefault keeps every emit-level
    // test green while killing the feature in real browsers (R2-S2).
    const c = mount(h(HkAddTile, { droppable: true }, { default: () => "Drop" }));
    const el = tileEl(c);
    const enter = new Event("dragenter", { cancelable: true });
    el.dispatchEvent(enter);
    expect(enter.defaultPrevented).toBe(true);
    const over = new Event("dragover", { cancelable: true });
    el.dispatchEvent(over);
    expect(over.defaultPrevented).toBe(true);
  });

  it("never cancels drag events when not droppable or disabled (refusal = no preventDefault)", () => {
    const c = mount(h(HkAddTile, {}, { default: () => "No" }));
    const over = new Event("dragover", { cancelable: true });
    tileEl(c).dispatchEvent(over);
    expect(over.defaultPrevented).toBe(false);
    const off = mount(
      h(HkAddTile, { droppable: true, disabled: true }, { default: () => "Off" }),
    );
    const over2 = new Event("dragover", { cancelable: true });
    tileEl(off).dispatchEvent(over2);
    expect(over2.defaultPrevented).toBe(false);
  });

  it("hands the native drop event as the second drop-files argument", () => {
    const onDropFiles = vi.fn();
    const c = mount(h(HkAddTile, { droppable: true, onDropFiles }, { default: () => "Drop" }));
    const ev = dropEvent([file("a.toml")]);
    tileEl(c).dispatchEvent(ev);
    expect(onDropFiles.mock.calls[0][1]).toBe(ev);
  });

  it("clears the drag-over state on drop", async () => {
    const onDropFiles = vi.fn();
    const c = mount(h(HkAddTile, { droppable: true, onDropFiles }, { default: () => "Drop" }));
    const el = tileEl(c);
    el.dispatchEvent(new Event("dragenter", { bubbles: true }));
    await nextTick();
    expect(el.classList.contains("hk-add-tile--drag-over")).toBe(true);
    el.dispatchEvent(dropEvent([file("a.toml")]));
    await nextTick();
    expect(el.classList.contains("hk-add-tile--drag-over")).toBe(false);
    // A second drop after the depth reset must still emit (no stale
    // depth leaking into the next drag session).
    el.dispatchEvent(new Event("dragenter", { bubbles: true }));
    el.dispatchEvent(dropEvent([file("b.toml")]));
    expect(onDropFiles).toHaveBeenCalledTimes(2);
  });
});
