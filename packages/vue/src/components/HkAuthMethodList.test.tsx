import { afterEach, describe, expect, it } from "vitest";
import { createApp, h, nextTick } from "vue";

import HkAuthMethodList from "./HkAuthMethodList";

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

const methods = [
  { key: "github", label: "GitHub" },
  { key: "linuxdo", label: "LinuxDo" },
];

describe("HkAuthMethodList", () => {
  it("renders one fixed-column button per method and an optional divider", () => {
    // The card's `methods` slot owns the `.s-auth-methods` container —
    // reproduce that context here (the buttons are layout children of it
    // through the component's display:contents wrapper).
    const c = mount(
      h("div", { class: "s-auth-methods" }, h(HkAuthMethodList, { divider: "其他方式登录", methods })),
    );
    const divider = c.querySelector(".s-auth-methods-divider");
    expect(divider?.textContent).toContain("其他方式登录");
    const buttons = c.querySelectorAll<HTMLButtonElement>(".s-auth-methods .hk-btn");
    expect(buttons.length).toBe(2);
    const labels = [...buttons].map(
      (b) => b.querySelector<HTMLElement>(".s-auth-methods-label")?.textContent,
    );
    expect(labels).toEqual(["GitHub", "LinuxDo"]);
    for (const b of buttons) {
      expect(b.querySelector(".s-auth-methods-icon")).toBeTruthy();
      expect(b.classList.contains("hk-btn-block")).toBe(true);
    }
  });

  it("emits select with the method key on click", async () => {
    let picked = "";
    const c = mount(
      h("div", { class: "s-auth-methods" }, h(HkAuthMethodList, {
        methods,
        onSelect: (key: string) => {
          picked = key;
        },
      })),
    );
    const buttons = c.querySelectorAll<HTMLButtonElement>(".s-auth-methods .hk-btn");
    buttons[1]!.click();
    await nextTick();
    expect(picked).toBe("linuxdo");
  });

  it("publishes the widest label text as the label-column custom property", async () => {
    const c = mount(h("div", { class: "s-auth-methods" }, h(HkAuthMethodList, { methods })));
    await nextTick();
    const wrapper = c.querySelector<HTMLElement>(".s-auth-methods-list")!;
    expect(wrapper).toBeTruthy();
    // Layout engines in test DOM report zero text metrics; stub scrollWidth
    // on the label spans to a deterministic widest-wins pair (LinuxDo wider).
    const spans = [...wrapper.querySelectorAll<HTMLElement>(".s-auth-methods-label")];
    expect(spans.length).toBe(2);
    Object.defineProperty(spans[0]!, "scrollWidth", { configurable: true, value: 61 });
    Object.defineProperty(spans[1]!, "scrollWidth", { configurable: true, value: 59 });
    // Trigger the measurement through a fresh label change (watch path).
    await nextTick();
    const { app } = mounts[mounts.length - 1]!;
    // Re-run measurement via a re-mount-less route: the component exposes
    // measure() — reach it through the rendered component instance.
    const instance = (wrapper as unknown as { __vueParentComponent?: { exposed?: Record<string, unknown> } })
      .__vueParentComponent?.exposed;
    expect(typeof instance?.measure).toBe("function");
    (instance!.measure as () => void)();
    expect(wrapper.style.getPropertyValue("--auth-methods-label-width")).toBe("61px");
    void app;
  });

  it("leaves the column fallback intact when no text metrics are available", async () => {
    const c = mount(h("div", { class: "s-auth-methods" }, h(HkAuthMethodList, { methods })));
    await nextTick();
    const wrapper = c.querySelector<HTMLElement>(".s-auth-methods-list")!;
    // Zero scrollWidth (no layout) must not publish a 0px column.
    expect(wrapper.style.getPropertyValue("--auth-methods-label-width")).toBe("");
  });
});
