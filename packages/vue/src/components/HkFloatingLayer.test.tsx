import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h, nextTick, ref } from "vue";

import HkFloatingLayer from "./HkFloatingLayer";
import { POPUP_Z_BANDS, usePopupManager } from "../runtime/usePopupManager";

const mounts: ReturnType<typeof createApp>[] = [];
const containers: HTMLElement[] = [];

/** Mount an HkFloatingLayer through a wrapper app (mirrors the
 *  HkFab.test.tsx harness). The layer teleports its node to <body>,
 *  so queries go through document.body, not the host container. */
function mountLayer(props: Record<string, unknown> = {}, slot?: () => unknown) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  containers.push(container);

  const Wrapper = defineComponent({
    setup() {
      return () => h(HkFloatingLayer, props, slot ? { default: slot } : undefined);
    },
  });
  const app = createApp(Wrapper);
  mounts.push(app);
  app.mount(container);

  return {
    app,
    root: () => document.body.querySelector<HTMLElement>(".hk-floating-layer"),
  };
}

afterEach(() => {
  for (const app of mounts.splice(0)) app.unmount();
  for (const el of containers.splice(0)) el.remove();
  document.body.innerHTML = "";
});

describe("HkFloatingLayer", () => {
  it("teleports the corner layer to body with a tooltip-band z slot", () => {
    const m = mountLayer({ ariaLabel: "Date dial" });
    const root = m.root();
    expect(root).not.toBeNull();
    // Teleported: outside the wrapper's host subtree.
    expect(containers[0].contains(root!)).toBe(false);
    expect(root!.getAttribute("data-corner")).toBe("bottom-right");
    expect(root!.getAttribute("role")).toBe("group");
    expect(root!.getAttribute("aria-label")).toBe("Date dial");
    // Inline z from the popup manager registration — inside the
    // tooltip band, strictly below the toast band.
    const z = Number(root!.style.getPropertyValue("--hk-float-z"));
    expect(z).toBeGreaterThanOrEqual(POPUP_Z_BANDS.tooltip);
    expect(z).toBeLessThan(POPUP_Z_BANDS.toast);
  });

  it("open=false renders nothing at all", () => {
    const m = mountLayer({ open: false });
    expect(m.root()).toBeNull();
  });

  it("registers exactly one tooltip entry and releases it on unmount", () => {
    const manager = usePopupManager();
    const tooltipCount = () => {
      let n = 0;
      for (const entry of manager.registry.value.values()) {
        if (entry.kind === "tooltip") n++;
      }
      return n;
    };
    const before = tooltipCount();
    // Non-blocking, untitled chrome must stay silent (a future
    // warnUntitled change folding tooltip into the naming rule would
    // dev-warn on every mount — that regression goes red here).
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const m = mountLayer();
    expect(tooltipCount()).toBe(before + 1);
    m.app.unmount();
    mounts.splice(mounts.indexOf(m.app), 1);
    expect(tooltipCount()).toBe(before);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("hide releases the slot; re-show re-registers with a fresh band z", async () => {
    const manager = usePopupManager();
    const tooltipCount = () => {
      let n = 0;
      for (const entry of manager.registry.value.values()) {
        if (entry.kind === "tooltip") n++;
      }
      return n;
    };
    const container = document.createElement("div");
    document.body.appendChild(container);
    containers.push(container);

    const visible = ref(true);
    const Wrapper = defineComponent({
      setup() {
        return () => h(HkFloatingLayer, { open: visible.value });
      },
    });
    const app = createApp(Wrapper);
    mounts.push(app);
    app.mount(container);

    const layer = () => document.body.querySelector<HTMLElement>(".hk-floating-layer");
    const before = tooltipCount();
    expect(before).toBeGreaterThanOrEqual(1);
    const z1 = Number(layer()!.style.getPropertyValue("--hk-float-z"));
    expect(z1).toBeGreaterThanOrEqual(POPUP_Z_BANDS.tooltip);

    // Hide: the node leaves AND the band slot is released — the
    // count test above cannot catch this branch on its own (unmount
    // cleanup would mask it).
    visible.value = false;
    await nextTick();
    expect(tooltipCount()).toBe(before - 1);
    expect(layer()).toBeNull();

    // Re-show: registered again, first paint already carries the z.
    visible.value = true;
    await nextTick();
    expect(tooltipCount()).toBe(before);
    const z2 = Number(layer()!.style.getPropertyValue("--hk-float-z"));
    expect(z2).toBeGreaterThanOrEqual(POPUP_Z_BANDS.tooltip);

    app.unmount();
    mounts.splice(mounts.indexOf(app), 1);
    expect(tooltipCount()).toBe(before - 1);
  });

  it("honours the corner and offset props", () => {
    const m = mountLayer({ corner: "top-left", offsetX: "1rem", offsetY: "2rem" });
    const root = m.root()!;
    expect(root.getAttribute("data-corner")).toBe("top-left");
    expect(root.style.getPropertyValue("--hk-float-offset-x")).toBe("1rem");
    expect(root.style.getPropertyValue("--hk-float-offset-y")).toBe("2rem");
  });

  it("keeps slot content mounted inside the layer", () => {
    const m = mountLayer({}, () => h("button", { class: "probe" }, "go"));
    expect(m.root()!.querySelector(".probe")).not.toBeNull();
  });
});
