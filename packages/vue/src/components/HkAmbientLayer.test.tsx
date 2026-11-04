import { afterEach, describe, expect, it } from "vitest";
import { createApp, defineComponent, h, nextTick } from "vue";

import HkAmbientLayer from "./HkAmbientLayer";

type LayerProps = {
  pointerEvents?: "none" | "auto";
  zIndex?: number;
  label?: string;
};

/**
 * HkAmbientLayer contract:
 * - the slot teleports into #hk-hud-root (never <body> directly), which
 *   is what makes an annotation out-paint the whole popup tree;
 * - the wrapper is a pointer ghost by default and exposes its own
 *   pointer-events opt-in;
 * - zIndex orders ambient layers against each other inside the root;
 * - the label turns the layer into a named landmark; no label keeps it
 *   decorative (the card carries its own status role);
 * - unmounting removes the content from the root.
 *
 * (Repo test convention: raw createApp + document queries.)
 */

const mounts: Array<() => void> = [];

function mountLayer(props: LayerProps = {}, slotText = "HUD") {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const app = createApp(
    defineComponent({
      setup() {
        return () =>
          h(
            HkAmbientLayer,
            props,
            { default: () => h("span", { class: "hud-probe" }, slotText) },
          );
      },
    }),
  );
  app.mount(container);
  mounts.push(() => {
    app.unmount();
    container.remove();
  });
  return container;
}

afterEach(() => {
  while (mounts.length) mounts.pop()?.();
  // The HUD root is a module-owned singleton; leave the DOM tidy for the
  // next case (the root itself stays, layer content must be gone).
  document.querySelectorAll("#hk-hud-root .hk-ambient-layer").forEach((el) => el.remove());
});

describe("HkAmbientLayer", () => {
  it("teleports the slot into the ambient HUD root", async () => {
    mountLayer();
    await nextTick();
    const root = document.querySelector("#hk-hud-root");
    expect(root).not.toBeNull();
    const layer = root!.querySelector(".hk-ambient-layer");
    expect(layer).not.toBeNull();
    expect(layer!.querySelector(".hud-probe")?.textContent).toBe("HUD");
  });

  it("does not leave the slot in <body> outside the root", async () => {
    const container = mountLayer();
    await nextTick();
    expect(container.querySelector(".hud-probe")).toBeNull();
    const inRoot = document
      .querySelector("#hk-hud-root")!
      .querySelector(".hud-probe");
    expect(inRoot).not.toBeNull();
  });

  it("is a pointer ghost by default and exposes the auto opt-in", async () => {
    mountLayer();
    await nextTick();
    const layer = document.querySelector<HTMLElement>("#hk-hud-root .hk-ambient-layer")!;
    expect(layer.getAttribute("data-pointer-events")).toBe("none");
  });

  it("carries the auto pointer mode when asked", async () => {
    mountLayer({ pointerEvents: "auto" });
    await nextTick();
    const layer = document.querySelector<HTMLElement>("#hk-hud-root .hk-ambient-layer")!;
    expect(layer.getAttribute("data-pointer-events")).toBe("auto");
  });

  it("orders ambient layers by the zIndex prop inside the root", async () => {
    mountLayer({ zIndex: 7 });
    await nextTick();
    const layer = document.querySelector<HTMLElement>("#hk-hud-root .hk-ambient-layer")!;
    expect(layer.style.zIndex).toBe("7");
  });

  it("labels the layer as a landmark only when a label is given", async () => {
    mountLayer();
    await nextTick();
    let layer = document.querySelector<HTMLElement>("#hk-hud-root .hk-ambient-layer")!;
    expect(layer.hasAttribute("role")).toBe(false);
    expect(layer.hasAttribute("aria-label")).toBe(false);
  });

  it("turns a labelled layer into a named region", async () => {
    mountLayer({ label: "Recording" });
    await nextTick();
    const layer = document.querySelector<HTMLElement>("#hk-hud-root .hk-ambient-layer")!;
    expect(layer.getAttribute("role")).toBe("region");
    expect(layer.getAttribute("aria-label")).toBe("Recording");
  });

  it("removes its content from the root on unmount", async () => {
    mountLayer();
    await nextTick();
    expect(document.querySelector("#hk-hud-root .hud-probe")).not.toBeNull();
    mounts.pop()?.();
    await nextTick();
    expect(document.querySelector("#hk-hud-root .hud-probe")).toBeNull();
  });
});
