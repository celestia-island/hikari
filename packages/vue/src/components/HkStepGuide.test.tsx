import { afterEach, describe, expect, it } from "vitest";
import { createApp, defineComponent, h } from "vue";

import HkStepGuide, { type StepGuideItem } from "./HkStepGuide";

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

const StubIcon = defineComponent({
  name: "StubIcon",
  setup() {
    return () => h("i", { class: "stub-step-icon" });
  },
});

const ITEMS: StepGuideItem[] = [
  { id: "power", title: "插入电源", description: "接通设备供电", icon: StubIcon },
  { id: "card", title: "装入 SD 卡", image: "https://example.com/card.png" },
  { id: "net", title: "连接网线" },
];

describe("HkStepGuide", () => {
  it("renders every item as a list entry with its title", () => {
    const c = mount(h(HkStepGuide, { items: ITEMS }));
    const items = Array.from(c.querySelectorAll(".hk-step-guide-item"));
    expect(items.length).toBe(3);
    const titles = items.map((i) => i.querySelector(".hk-step-guide-item-title")?.textContent);
    expect(titles).toEqual(["插入电源", "装入 SD 卡", "连接网线"]);
    // An ordered list — a guide is sequential by contract.
    expect(c.querySelector(".hk-step-guide-list")?.tagName).toBe("OL");
  });

  it("numbers the steps and swaps the ordinal for a check on done steps", () => {
    const c = mount(h(HkStepGuide, { items: ITEMS, doneIds: ["power"] }));
    const ordinals = Array.from(c.querySelectorAll(".hk-step-guide-ordinal"));
    expect(ordinals[0].querySelector(".hk-step-guide-check")).not.toBeNull();
    expect(ordinals[1].textContent?.trim()).toBe("2");
    expect(ordinals[2].textContent?.trim()).toBe("3");
    // The done step's art dims.
    const arts = Array.from(c.querySelectorAll(".hk-step-guide-item"));
    expect(arts[0].hasAttribute("data-done")).toBe(true);
    expect(arts[1].hasAttribute("data-done")).toBe(false);
  });

  it("renders the icon component when given, the image otherwise, nothing last", () => {
    const c = mount(h(HkStepGuide, { items: ITEMS }));
    const arts = Array.from(c.querySelectorAll(".hk-step-guide-art"));
    expect(arts[0].querySelector(".stub-step-icon")).not.toBeNull();
    const img = arts[1].querySelector("img.hk-step-guide-art-img") as HTMLImageElement;
    expect(img?.getAttribute("src")).toBe("https://example.com/card.png");
    expect(img?.getAttribute("alt")).toBe("装入 SD 卡");
    expect(arts[2].children.length).toBe(0);
    expect(arts[2].getAttribute("aria-hidden")).toBe("true");
  });

  it("renders the section title and honors the grid layout hook", () => {
    const c = mount(h(HkStepGuide, { items: ITEMS, title: "上架步骤", layout: "grid" }));
    expect(c.querySelector(".hk-step-guide-title")?.textContent).toBe("上架步骤");
    expect(c.querySelector(".hk-step-guide")?.getAttribute("data-layout")).toBe("grid");
  });

  it("renders nothing for an empty item list", () => {
    const c = mount(h(HkStepGuide, { items: [] }));
    expect(c.querySelector(".hk-step-guide")).toBeNull();
  });
});
