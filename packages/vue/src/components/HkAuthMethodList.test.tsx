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

  it("publishes the widest label text plus a 1px headroom as the label-column custom property", async () => {
    const c = mount(h("div", { class: "s-auth-methods" }, h(HkAuthMethodList, { methods })));
    await nextTick();
    const wrapper = c.querySelector<HTMLElement>(".s-auth-methods-list")!;
    expect(wrapper).toBeTruthy();
    // Layout engines in test DOM report zero text metrics; stub a fractional
    // getBoundingClientRect width on the label spans so the widest-wins pair
    // (LinuxDo wider) exercises the ceil+1 headroom instead of the integer
    // scrollWidth that would previously round a fraction and clip the widest.
    const spans = [...wrapper.querySelectorAll<HTMLElement>(".s-auth-methods-label")];
    expect(spans.length).toBe(2);
    // 61.4 ceil→62 (+1→63) and a shorter 58.0: the published column must
    // exceed BOTH so the widest label can never sit on the clip boundary.
    Object.defineProperty(spans[0]!, "getBoundingClientRect", { configurable: true, value: () => ({ width: 58 }) });
    Object.defineProperty(spans[1]!, "getBoundingClientRect", { configurable: true, value: () => ({ width: 61.4 }) });
    await nextTick();
    // Re-run measurement via a re-mount-less route: the component exposes
    // measure() — reach it through the rendered component instance.
    const instance = (wrapper as unknown as { __vueParentComponent?: { exposed?: Record<string, unknown> } })
      .__vueParentComponent?.exposed;
    expect(typeof instance?.measure).toBe("function");
    (instance!.measure as () => void)();
    expect(wrapper.style.getPropertyValue("--auth-methods-label-width")).toBe("63px");
  });

  it("publishes a width in the column's own units inside a scaled root", async () => {
    // The labels are measured where they are DRAWN while the custom property
    // is a CSS length the column is laid out with: in a scaled or zoomed root
    // the published column would come out that many times too wide.
    const c = mount(h("div", { class: "s-auth-methods" }, h(HkAuthMethodList, { methods })));
    await nextTick();
    const wrapper = c.querySelector<HTMLElement>(".s-auth-methods-list")!;
    const spans = [...wrapper.querySelectorAll<HTMLElement>(".s-auth-methods-label")];
    // The scale has to come from a LABEL: the list is `display: contents` and
    // generates no box at all (Blink reports offsetWidth 0 and a 0x0 rect), so
    // stubbing a box on the list would only ever be green by accident.
    for (const [i, drawn] of [58, 61.4].entries()) {
      Object.defineProperty(spans[i]!, "getBoundingClientRect", {
        configurable: true,
        value: () => ({ left: 0, top: 0, right: drawn * 2, bottom: 40, width: drawn * 2, height: 40, x: 0, y: 0 }) as DOMRect,
      });
      // Laid out at half: the label is drawn twice the size it is laid out at.
      Object.defineProperty(spans[i]!, "offsetWidth", { configurable: true, get: () => drawn });
      Object.defineProperty(spans[i]!, "offsetHeight", { configurable: true, get: () => 20 });
    }
    const instance = (wrapper as unknown as { __vueParentComponent?: { exposed?: Record<string, unknown> } })
      .__vueParentComponent?.exposed;
    (instance!.measure as () => void)();
    // 122.8 drawn are 61.4 of the column's own: ceil 62, plus the 1px headroom.
    // Reading the scale off the LIST instead — the shape this shipped with —
    // yields 1 for a `display: contents` element and publishes the drawn 124px.
    expect(wrapper.style.getPropertyValue("--auth-methods-label-width")).toBe("63px");
  });

  it("leaves the column fallback intact when no text metrics are available", async () => {
    const c = mount(h("div", { class: "s-auth-methods" }, h(HkAuthMethodList, { methods })));
    await nextTick();
    const wrapper = c.querySelector<HTMLElement>(".s-auth-methods-list")!;
    // Zero text metrics (no layout) must not publish a 0px or a 1px column.
    expect(wrapper.style.getPropertyValue("--auth-methods-label-width")).toBe("");
  });
});
