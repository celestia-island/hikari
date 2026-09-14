// Dock-slot contract for HkScrollContainer.
//
// A dock (dockTop / dockBottom named slot) renders as a NON-scrolling
// flex sibling of the viewport: pinned to its edge, occupying layout
// space (the flex: 1 viewport shrinks by the dock's height — content
// can never slide under it). The container measures each mounted dock
// and publishes --hk-scroll-dock-top / --hk-scroll-dock-bottom on the
// host so consumers size their content end-padding against the dock
// without hand-rolled px. The dock-edge fade rides on data-dock-fade.
//
// House style: raw createApp mounts on shared containers (no
// @vue/test-utils).
import { afterEach, describe, expect, it } from "vitest";
import { createApp, h, defineComponent } from "vue";

import HkScrollContainer from "./HkScrollContainer";

const mounts: ReturnType<typeof createApp>[] = [];
const containers: HTMLElement[] = [];

function mountDock(slots: Record<string, () => any>, props: Record<string, unknown> = {}) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  containers.push(container);
  const app = createApp(defineComponent({
    setup() {
      return () => h(HkScrollContainer, props, slots);
    },
  }));
  mounts.push(app);
  return app.mount(container);
}

afterEach(() => {
  for (const app of mounts) app.unmount();
  mounts.length = 0;
  for (const el of containers) el.remove();
  containers.length = 0;
});

describe("HkScrollContainer dock slots", () => {
  it("renders a bottom dock as a non-scrolling sibling with the fade marker", () => {
    const vm = mountDock({
      default: () => h("div", { class: "content" }, "rows"),
      dockBottom: () => h("div", { class: "the-dock" }, "dock"),
    });
    const host = vm.$el as HTMLElement;
    const dock = host.querySelector(".hk-scroll-dock[data-side='bottom']");
    expect(dock).toBeTruthy();
    // Sibling of the viewport, not inside it — the dock never scrolls.
    const viewport = host.querySelector(".hk-scroll-container-viewport")!;
    expect(viewport.contains(dock as Node)).toBe(false);
    // The dock-edge fade engages by default for a bottom dock.
    expect(host.getAttribute("data-dock-fade")).toBe("bottom");
    // The measured-height vars are published on the host (0px in
    // happy-dom — no layout; the contract is the vars exist + RO wired).
    expect(host.style.getPropertyValue("--hk-scroll-dock-bottom")).toBe("0px");
    expect(host.style.getPropertyValue("--hk-scroll-dock-top")).toBe("0px");
  });

  it("renders a top dock and fades the top edge instead", () => {
    const vm = mountDock({
      default: () => h("div", { class: "content" }, "rows"),
      dockTop: () => h("div", { class: "the-dock" }, "progress"),
    });
    const host = vm.$el as HTMLElement;
    expect(host.querySelector(".hk-scroll-dock[data-side='top']")).toBeTruthy();
    expect(host.getAttribute("data-dock-fade")).toBe("top");
    expect(host.querySelector(".hk-scroll-dock[data-side='bottom']")).toBeNull();
  });

  it("omits the dock fade marker when dockFade is off", () => {
    const vm = mountDock(
      {
        default: () => h("div", { class: "content" }, "rows"),
        dockBottom: () => h("div", { class: "the-dock" }, "dock"),
      },
      { dockFade: false },
    );
    const host = vm.$el as HTMLElement;
    expect(host.querySelector(".hk-scroll-dock[data-side='bottom']")).toBeTruthy();
    expect(host.getAttribute("data-dock-fade")).toBeNull();
  });

  it("publishes no dock marker without dock slots", () => {
    const vm = mountDock({ default: () => h("div", { class: "content" }, "rows") });
    const host = vm.$el as HTMLElement;
    expect(host.querySelector(".hk-scroll-dock")).toBeNull();
    expect(host.getAttribute("data-dock-fade")).toBeNull();
    expect(host.style.getPropertyValue("--hk-scroll-dock-bottom")).toBe("");
  });
});
