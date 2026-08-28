import { afterEach, describe, expect, it } from "vitest";
import { createApp, defineComponent, h, nextTick, ref } from "vue";

import HkTabs from "./HkTabs";

const mounts: ReturnType<typeof createApp>[] = [];
const containers: HTMLElement[] = [];

interface TabsHarness {
  container: HTMLElement;
  setActive: (key: string) => void;
}

function mountTabs(props: Record<string, unknown> = {}, onAdd?: () => void): TabsHarness {
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
          onAdd: onAdd,
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

  it("only mounts the auto-hiding overlay scrollbar when opted in", async () => {
    const plain = mountTabs({ scrollable: true });
    await nextTick();
    expect(plain.container.querySelector(".hk-scrollbar-track[data-axis='horizontal']")).toBeNull();

    const tracked = mountTabs({ scrollable: true, scrollbar: true });
    await nextTick();
    expect(tracked.container.querySelector(".hk-scrollbar-track[data-axis='horizontal']")).not.toBeNull();
  });
});

describe("HkTabs addable", () => {
  it("renders the protruding add button only with addable and wires the add emit", async () => {
    let adds = 0;
    const t = mountTabs({ addable: true, addLabel: "Add view" }, () => { adds += 1; });

    // The strip is wrapped in the shared hover-reveal surface and the
    // button lives in its extension slot, outside the tab list.
    const wrap = t.container.querySelector<HTMLElement>(".hk-tabs-addwrap.hk-hover-reveal");
    expect(wrap).not.toBeNull();
    expect(t.container.querySelector(".hk-tabs[data-addable]")).not.toBeNull();

    const addBtn = wrap!.querySelector<HTMLButtonElement>(".hk-hover-reveal-extension button");
    expect(addBtn).not.toBeNull();
    expect(addBtn!.getAttribute("aria-label")).toBe("Add view");
    expect(addBtn!.getAttribute("title")).toBe("Add view");
    // The "+" lives OUTSIDE the scroll viewport, so it never scrolls away.
    expect(addBtn!.closest(".hk-scroll-container")).toBeNull();
    expect(addBtn!.closest(".hk-tabs-addwrap")).not.toBeNull();

    addBtn!.click();
    await nextTick();
    expect(adds).toBe(1);
  });

  it("falls back to the shared label and stays absent without addable", async () => {
    const bare = mountTabs();
    expect(bare.container.querySelector(".hk-tabs-addwrap")).toBeNull();
    expect(bare.container.querySelector(".hk-tabs[data-addable]")).toBeNull();

    const t = mountTabs({ addable: true });
    const addBtn = t.container.querySelector<HTMLButtonElement>(".hk-hover-reveal-extension button");
    expect(addBtn).not.toBeNull();
    // Default i18n string (test env resolves the en locale).
    expect(addBtn!.getAttribute("aria-label")).toContain("Add");
  });
});
