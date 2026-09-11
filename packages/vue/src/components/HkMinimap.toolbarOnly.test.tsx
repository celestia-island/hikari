import { afterEach, describe, expect, it } from "vitest";
import { createApp, defineComponent, h } from "vue";

import HkMinimap from "./HkMinimap";

const mounts: ReturnType<typeof createApp>[] = [];
const containers: HTMLElement[] = [];

afterEach(() => {
  for (const app of mounts.splice(0)) app.unmount();
  for (const el of containers.splice(0)) el.remove();
});

function mountMinimap(props: Record<string, unknown>): HTMLElement {
  const container = document.createElement("div");
  document.body.appendChild(container);
  containers.push(container);

  const Host = defineComponent({
    setup() {
      return () => h("div", [h(HkMinimap, props)]);
    },
  });
  const app = createApp(Host);
  mounts.push(app);
  app.mount(container);
  return container;
}

describe("HkMinimap toolbar-only form", () => {
  it("renders nothing without boxes, an image, or the toolbar-only flag", () => {
    const c = mountMinimap({ zoomPercent: 100 });
    expect(c.querySelector(".hk-minimap")).toBeNull();
  });

  it("renders only the zoom bar under toolbarOnly (no overview map)", () => {
    const c = mountMinimap({ zoomPercent: 100, toolbarOnly: true });
    const root = c.querySelector<HTMLElement>(".hk-minimap");
    expect(root).not.toBeNull();
    expect(root!.hasAttribute("data-toolbar-only")).toBe(true);
    expect(root!.querySelector(".hk-minimap-svg")).toBeNull();
    expect(root!.querySelector(".hk-mm-zoom-bar")).not.toBeNull();
    expect(root!.querySelectorAll(".hk-mm-zoom-btn").length).toBe(2);
  });

  it("keeps the overview map when toolbarOnly is not set and an image is given", () => {
    const c = mountMinimap({ imageSrc: "data:image/gif;base64,", toolbarOnly: false });
    const root = c.querySelector<HTMLElement>(".hk-minimap");
    expect(root).not.toBeNull();
    expect(root!.hasAttribute("data-toolbar-only")).toBe(false);
    expect(root!.querySelector(".hk-minimap-svg")).not.toBeNull();
    expect(root!.querySelector(".hk-mm-zoom-bar")).not.toBeNull();
  });
});
