import { afterEach, describe, expect, it } from "vitest";
import { createApp, defineComponent, h } from "vue";

import { HkSectionHeader } from "./HkSectionHeader";

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

const FakeIcon = defineComponent({
  name: "FakeIcon",
  props: { size: { type: [Number, String], default: 24 } },
  setup: (props) => () => h("svg", { "data-fake-icon": "", width: props.size, height: props.size }),
});

describe("HkSectionHeader", () => {
  it("renders an h3 title by default with the count beside it", () => {
    const c = mount(h(HkSectionHeader, { title: "Token Usage", count: "12 total" }));
    const title = c.querySelector("h3.hk-section-header-title") as HTMLElement;
    expect(title).toBeTruthy();
    expect(title.textContent).toContain("Token Usage");
    expect(c.querySelector(".hk-section-header-count")?.textContent).toBe("12 total");
  });

  it("honors the level prop for the document outline", () => {
    const c = mount(h(HkSectionHeader, { title: "T", level: "h2" }));
    expect(c.querySelector("h2.hk-section-header-title")).toBeTruthy();
    const c2 = mount(h(HkSectionHeader, { title: "T", level: "div" }));
    expect(c2.querySelector("h2, h3")).toBeNull();
    expect(c2.querySelector(".hk-section-header-title")).toBeTruthy();
  });

  it("renders description under the row and actions right-aligned in the row", () => {
    const c = mount(
      h(HkSectionHeader, { title: "T", description: "one-liner" }, {
        actions: () => h("button", { class: "probe-action" }, "Export"),
      }),
    );
    expect(c.querySelector(".hk-section-header-description")?.textContent).toBe("one-liner");
    expect(c.querySelector(".hk-section-header-row .hk-section-header-actions .probe-action")).toBeTruthy();
  });

  it("renders the leading icon inside the row", () => {
    const c = mount(h(HkSectionHeader, { title: "T", icon: FakeIcon }));
    expect(c.querySelector(".hk-section-header-row .hk-section-header-icon svg[data-fake-icon]")).toBeTruthy();
  });

  it("applies variant and dense classes", () => {
    const c = mount(h(HkSectionHeader, { title: "T", variant: "micro", dense: true }));
    const root = c.querySelector(".hk-section-header") as HTMLElement;
    expect(root.className).toContain("hk-section-header-micro");
    expect(root.className).toContain("hk-section-header-dense");
    const c2 = mount(h(HkSectionHeader, { title: "T", variant: "mono" }));
    expect((c2.querySelector(".hk-section-header") as HTMLElement).className).toContain("hk-section-header-mono");
  });
});
