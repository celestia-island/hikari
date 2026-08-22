import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h, type Component } from "vue";

import { closeAll, isOverlayOpen, useOverlay, type OverlayHandle } from "./useOverlay";

interface Mounted {
  app: ReturnType<typeof createApp>;
  container: HTMLElement;
  overlay: OverlayHandle;
}

const mounts: Mounted[] = [];

function mountOverlay(
  name: string,
  group?: string,
  onCloseRequested?: () => void,
): Mounted {
  // Plain variable, not a ref: storing the handle in a ref would
  // deep-convert the object and unwrap the nested `isOpen` ref.
  let handle: OverlayHandle | null = null;
  const Comp = defineComponent({
    setup() {
      const overlay = useOverlay({ name, group, onCloseRequested });
      handle = overlay;
      return () => null;
    },
  });
  const container = document.createElement("div");
  document.body.appendChild(container);
  const app = createApp({ render: () => h(Comp as Component) });
  app.mount(container);
  const mounted = { app, container, overlay: handle! };
  mounts.push(mounted);
  return mounted;
}

afterEach(() => {
  for (const { app, container } of mounts.splice(0)) {
    app.unmount();
    container.remove();
  }
  closeAll();
});

describe("useOverlay registry", () => {
  it("registers two instances sharing a name without overwriting each other", () => {
    const a = mountOverlay("hk-select");
    const b = mountOverlay("hk-select");

    a.overlay.open();
    expect(isOverlayOpen("hk-select")).toBe(true);

    b.overlay.open();
    // Both stay open under the unique per-instance ids — the old
    // name-keyed registry would have dropped `a` here.
    expect(a.overlay.isOpen.value).toBe(true);
    expect(b.overlay.isOpen.value).toBe(true);

    closeAll();
    expect(a.overlay.isOpen.value).toBe(false);
    expect(b.overlay.isOpen.value).toBe(false);
    expect(isOverlayOpen("hk-select")).toBe(false);
  });

  it("closing one instance leaves the other registered", () => {
    const a = mountOverlay("hk-popout");
    const b = mountOverlay("hk-popout");

    a.overlay.open();
    b.overlay.open();
    a.overlay.close();

    expect(a.overlay.isOpen.value).toBe(false);
    expect(b.overlay.isOpen.value).toBe(true);
    expect(isOverlayOpen("hk-popout")).toBe(true);

    b.overlay.close();
    expect(isOverlayOpen("hk-popout")).toBe(false);
  });

  it("opening an overlay closes previously open overlays in the same group", () => {
    const a = mountOverlay("hk-a", "picker");
    const b = mountOverlay("hk-b", "picker");

    a.overlay.open();
    b.overlay.open();

    expect(a.overlay.isOpen.value).toBe(false);
    expect(b.overlay.isOpen.value).toBe(true);
    expect(isOverlayOpen("hk-a")).toBe(false);
    expect(isOverlayOpen("hk-b")).toBe(true);
  });

  it("unmounting an open overlay unregisters it", () => {
    const a = mountOverlay("hk-modal");
    a.overlay.open();
    expect(isOverlayOpen("hk-modal")).toBe(true);

    a.app.unmount();
    a.container.remove();
    mounts.splice(mounts.indexOf(a), 1);

    expect(isOverlayOpen("hk-modal")).toBe(false);
  });

  it("isOverlayOpen reports per-name across same-named instances", () => {
    const a = mountOverlay("hk-drawer");
    mountOverlay("hk-drawer");
    a.overlay.open();
    expect(isOverlayOpen("hk-drawer")).toBe(true);
    a.overlay.close();
    expect(isOverlayOpen("hk-drawer")).toBe(false);
  });

  it("closeAll invokes the registered onCloseRequested hook", () => {
    const closed: string[] = [];
    const a = mountOverlay("hk-select", undefined, () => closed.push("a"));
    const b = mountOverlay("hk-color-picker", undefined, () => closed.push("b"));

    a.overlay.open();
    b.overlay.open();
    closeAll();

    expect(closed).toEqual(["a", "b"]);
    expect(a.overlay.isOpen.value).toBe(false);
    expect(b.overlay.isOpen.value).toBe(false);
  });

  it("a throwing onCloseRequested does not prevent the remaining hooks", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const closed: string[] = [];
    const a = mountOverlay("hk-select", undefined, () => { throw new Error("boom"); });
    const b = mountOverlay("hk-popup-select", undefined, () => closed.push("b"));

    a.overlay.open();
    b.overlay.open();
    expect(() => closeAll()).not.toThrow();

    expect(closed).toEqual(["b"]);
    expect(a.overlay.isOpen.value).toBe(false);
    expect(b.overlay.isOpen.value).toBe(false);
    vi.restoreAllMocks();
  });

  it("closeAll closes every entry under unique ids, including same-named ones", () => {
    const closed: string[] = [];
    const a = mountOverlay("hk-popout", undefined, () => closed.push("a"));
    const b = mountOverlay("hk-popout", undefined, () => closed.push("b"));
    const c = mountOverlay("hk-popout", undefined, () => closed.push("c"));

    a.overlay.open();
    b.overlay.open();
    c.overlay.open();
    closeAll();

    expect(closed).toEqual(["a", "b", "c"]);
    expect(isOverlayOpen("hk-popout")).toBe(false);
  });
});
