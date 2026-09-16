import { afterEach, describe, expect, it } from "vitest";
import { createApp, defineComponent, h, nextTick } from "vue";

import HkDockBar from "./HkDockBar";

const apps: ReturnType<typeof createApp>[] = [];
const containers: HTMLElement[] = [];

afterEach(() => {
  for (const app of apps.splice(0)) app.unmount();
  for (const el of containers.splice(0)) el.remove();
  document.body.innerHTML = "";
});

async function flush() {
  await nextTick();
  await nextTick();
}

/** Mount a dock with the given props and return its root section. */
async function mountDock(props: Record<string, unknown> = {}) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  containers.push(container);
  const Host = defineComponent({
    setup() {
      return () =>
        h(HkDockBar, props, { default: () => h("button", { class: "probe" }, "go") });
    },
  });
  const app = createApp(Host);
  apps.push(app);
  app.mount(container);
  await flush();
  return container.querySelector<HTMLElement>(".hk-dock-bar")!;
}

describe("HkDockBar", () => {
  it("renders slot content inside the surface", async () => {
    const root = await mountDock();
    const probe = root.querySelector<HTMLElement>(".probe");
    expect(probe?.textContent).toBe("go");
    expect(root.querySelector(".hk-dock-bar-surface")).toBeTruthy();
  });

  it("defaults to the page anchor with a glass surface", async () => {
    const root = await mountDock();
    expect(root.dataset.anchor).toBe("page");
    expect(root.dataset.surface).toBe("glass");
  });

  it.each(["plane", "top-left", "top-right", "bottom-left", "bottom-right"] as const)(
    "accepts the %s anchor",
    async (anchor) => {
      const root = await mountDock({ anchor });
      expect(root.dataset.anchor).toBe(anchor);
    },
  );

  it("exposes style hooks for width, max-width and padding", async () => {
    const root = await mountDock({
      width: "22rem",
      maxWidth: "30rem",
      padding: "4px 6px",
    });
    const style = root.style;
    expect(style.getPropertyValue("--dock-width")).toBe("22rem");
    expect(style.getPropertyValue("--dock-max-width")).toBe("30rem");
    expect(style.getPropertyValue("--dock-padding")).toBe("4px 6px");
  });

  it("drops the blur on the solid surface", async () => {
    const root = await mountDock({ surface: "solid" });
    expect(root.dataset.surface).toBe("solid");
  });
});
