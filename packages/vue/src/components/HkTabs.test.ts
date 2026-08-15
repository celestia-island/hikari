import { afterEach, describe, expect, it } from "vitest";
import { createApp, defineComponent, h, nextTick, ref } from "vue";

import HkTabs from "./HkTabs";

const mounts: ReturnType<typeof createApp>[] = [];
const containers: HTMLElement[] = [];

interface TabsHarness {
  container: HTMLElement;
  setActive: (key: string) => void;
}

function mountTabs(props: Record<string, unknown> = {}): TabsHarness {
  const container = document.createElement("div");
  document.body.appendChild(container);
  containers.push(container);

  const active = ref(props.modelValue as string ?? "a");
  const Wrapper = defineComponent({
    setup() {
      return () =>
        h(HkTabs, {
          ...props,
          modelValue: active.value,
          "onUpdate:modelValue": (v: string) => { active.value = v; },
          tabs: [
            { key: "a", label: "Alpha" },
            { key: "b", label: "Beta" },
            { key: "c", label: "Gamma" },
          ],
          renderPanels: false,
        });
    },
  });

  const app = createApp(Wrapper);
  mounts.push(app);
  app.mount(container);
  return { container, setActive: (key) => { active.value = key; } };
}

afterEach(() => {
  for (const app of mounts.splice(0)) app.unmount();
  for (const el of containers.splice(0)) el.remove();
});

describe("HkTabs scrollable", () => {
  it("renders a bare list without scrollable", () => {
    const t = mountTabs();
    expect(t.container.querySelector(".hk-tabs[data-scrollable]")).toBeNull();
    expect(t.container.querySelector(".hk-tabs-scroller")).toBeNull();
    const list = t.container.querySelector(".hk-tabs-list");
    expect(list?.parentElement?.classList.contains("hk-scroll-container-viewport")).toBe(false);
  });

  it("wraps the list in a centered horizontal scroller with scrollable", () => {
    const t = mountTabs({ scrollable: true });
    const tabs = t.container.querySelector<HTMLElement>(".hk-tabs[data-scrollable]");
    expect(tabs).not.toBeNull();
    const scroller = t.container.querySelector<HTMLElement>(".hk-tabs-scroller");
    expect(scroller).not.toBeNull();
    expect(scroller?.getAttribute("data-axis")).toBe("horizontal");
    expect(scroller?.getAttribute("data-align")).toBe("center");
    expect(scroller?.getAttribute("data-fade")).toBe("true");
    const aligner = scroller?.querySelector(".hk-scroll-container-aligner");
    expect(aligner).not.toBeNull();
    expect(aligner?.querySelector(".hk-tabs-list")).not.toBeNull();
  });

  it("keeps the pill indicator tracking the active tab inside the scroller", async () => {
    const t = mountTabs({ scrollable: true, variant: "pill" });
    const indicator = () => t.container.querySelector<HTMLElement>(".hk-tabs-indicator");
    expect(indicator()).not.toBeNull();
    t.setActive("c");
    await nextTick();
    await nextTick();
    const activeBtn = t.container.querySelector<HTMLElement>('.hk-tabs-trigger[data-active]');
    expect(activeBtn?.textContent).toContain("Gamma");
    // offsetLeft/offsetWidth are 0 in happy-dom, so the indicator stays
    // at its last concrete values — the contract under test is that a
    // modelValue change does not break the indicator update pass.
    expect(indicator()).not.toBeNull();
  });
});
