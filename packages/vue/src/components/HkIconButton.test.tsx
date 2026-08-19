import { afterEach, describe, expect, it } from "vitest";
import { createApp, defineComponent, h } from "vue";

import HkIconButton from "./HkIconButton";

const mounts: ReturnType<typeof createApp>[] = [];
const containers: HTMLElement[] = [];

function mountButton(
  props: Record<string, unknown> = {},
  slots: Record<string, () => unknown> = {},
): HTMLButtonElement {
  const container = document.createElement("div");
  document.body.appendChild(container);
  containers.push(container);

  const Wrapper = defineComponent({
    setup() {
      return () => h(HkIconButton, props, slots);
    },
  });

  const app = createApp(Wrapper);
  mounts.push(app);
  app.mount(container);
  return container.querySelector("button") as HTMLButtonElement;
}

afterEach(() => {
  mounts.splice(0).forEach((app) => app.unmount());
  containers.splice(0).forEach((c) => c.remove());
});

describe("HkIconButton", () => {
  it("forwards fallthrough attrs (aria-label) onto the button", () => {
    const btn = mountButton({ "aria-label": "Refresh", size: 24 });
    expect(btn.getAttribute("aria-label")).toBe("Refresh");
  });

  it("merges a caller class into the component class list", () => {
    const btn = mountButton({ class: "s-view-panel-refresh", size: 24 });
    expect(btn.classList.contains("hk-icon-button")).toBe(true);
    expect(btn.classList.contains("s-view-panel-refresh")).toBe(true);
  });

  it("merges array-form and object-form class bindings", () => {
    // Array form: ["a", { b: true, c: false }]
    const arr = mountButton({ class: ["alpha", { beta: true, gamma: false }], size: 24 });
    expect(arr.classList.contains("alpha")).toBe(true);
    expect(arr.classList.contains("beta")).toBe(true);
    expect(arr.classList.contains("gamma")).toBe(false);

    // Object form: { delta: true, epsilon: false }
    const obj = mountButton({ class: { delta: true, epsilon: false }, size: 24 });
    expect(obj.classList.contains("delta")).toBe(true);
    expect(obj.classList.contains("epsilon")).toBe(false);
    // Component classes survive alongside the merged caller classes.
    expect(obj.classList.contains("hk-icon-button")).toBe(true);
    expect(obj.classList.contains("hk-icon-button-ghost")).toBe(true);
  });

  it("emits click when the button is activated", async () => {
    let clicked = 0;
    const btn = mountButton({ size: 24, onClick: () => { clicked += 1; } });
    btn.click();
    expect(clicked).toBe(1);
  });

  it("renders the slotted icon instead of the fallback glyph", () => {
    const btn = mountButton(
      { size: 24 },
      { icon: () => h("span", { class: "slotted" }, "x") },
    );
    expect(btn.querySelector(".slotted")).not.toBeNull();
    // The fallback circle svg must not coexist with the slot content.
    expect(btn.querySelectorAll("svg").length).toBe(0);
  });
});
