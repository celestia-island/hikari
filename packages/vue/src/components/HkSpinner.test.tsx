import { afterEach, describe, expect, it } from "vitest";
import { createApp, h } from "vue";

import HkSpinner from "./HkSpinner";

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

describe("HkSpinner", () => {
  it("renders the bare wheel without the centered contract by default", () => {
    const c = mount(h(HkSpinner));
    const wrapper = c.querySelector(".hk-spinner-wrapper") as HTMLElement;
    expect(wrapper.className).not.toContain("hk-spinner-centered");
    expect(wrapper.querySelector(".hk-spinner")).not.toBeNull();
  });

  it("center opts into the two-axis loading-state placement class", () => {
    const c = mount(h(HkSpinner, { center: true }));
    const wrapper = c.querySelector(".hk-spinner-wrapper") as HTMLElement;
    expect(wrapper.className).toContain("hk-spinner-centered");
  });

  it("minHeight only emits the tuning custom property in centered mode", () => {
    const c = mount(h(HkSpinner, { center: true, minHeight: 96 }));
    const wrapper = c.querySelector(".hk-spinner-wrapper") as HTMLElement;
    expect(wrapper.style.getPropertyValue("--hk-loading-min-height")).toBe("96px");

    const c2 = mount(h(HkSpinner, { minHeight: "5rem" }));
    const inline = c2.querySelector(".hk-spinner-wrapper") as HTMLElement;
    expect(inline.style.getPropertyValue("--hk-loading-min-height")).toBe("");
  });

  it("centered mode without minHeight leaves the floor fallback in place", () => {
    const c = mount(h(HkSpinner, { center: true }));
    const wrapper = c.querySelector(".hk-spinner-wrapper") as HTMLElement;
    expect(wrapper.style.getPropertyValue("--hk-loading-min-height")).toBe("");

    const empty = mount(h(HkSpinner, { center: true, minHeight: "" }));
    const emptyWrapper = empty.querySelector(".hk-spinner-wrapper") as HTMLElement;
    expect(emptyWrapper.style.getPropertyValue("--hk-loading-min-height")).toBe("");
  });

  it("stacks optional text below the wheel", () => {
    const c = mount(h(HkSpinner, { center: true, text: "Loading" }));
    const text = c.querySelector(".hk-spinner-text") as HTMLElement;
    expect(text.textContent).toBe("Loading");
  });
});
