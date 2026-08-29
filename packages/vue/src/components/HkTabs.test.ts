import { afterEach, describe, expect, it } from "vitest";
import { createApp, defineComponent, h, nextTick, ref } from "vue";

import HkTabs from "./HkTabs";

const mounts: ReturnType<typeof createApp>[] = [];
const containers: HTMLElement[] = [];

interface TabsHarness {
  container: HTMLElement;
  setActive: (key: string) => void;
}

function mountTabs(props: Record<string, unknown> = {}, onAction?: (side: string) => void): TabsHarness {
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
          onAction: onAction,
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
  it("wraps the list in a centered horizontal scroller by default", () => {
    const t = mountTabs();
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

  it("renders a bare list with scrollable opted out", () => {
    const t = mountTabs({ scrollable: false });
    expect(t.container.querySelector(".hk-tabs[data-scrollable]")).toBeNull();
    expect(t.container.querySelector(".hk-tabs-scroller")).toBeNull();
    const list = t.container.querySelector(".hk-tabs-list");
    expect(list?.parentElement?.classList.contains("hk-scroll-container-viewport")).toBe(false);
  });

  it("keeps the pill indicator tracking the active tab inside the scroller", async () => {
    const t = mountTabs({ variant: "pill" });
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
    const plain = mountTabs();
    await nextTick();
    expect(plain.container.querySelector(".hk-scrollbar-track[data-axis='horizontal']")).toBeNull();

    const tracked = mountTabs({ scrollbar: true });
    await nextTick();
    expect(tracked.container.querySelector(".hk-scrollbar-track[data-axis='horizontal']")).not.toBeNull();
  });

  it("drops safe centering for a block (row-filling) segmented strip", () => {
    const t = mountTabs({ variant: "segmented", block: true });
    const scroller = t.container.querySelector<HTMLElement>(".hk-tabs-scroller");
    expect(scroller).not.toBeNull();
    // align="start": no center aligner — the list stretches to the row.
    expect(scroller?.getAttribute("data-align")).toBeNull();
    expect(scroller?.querySelector(".hk-scroll-container-aligner")).toBeNull();
    const list = t.container.querySelector<HTMLElement>(".hk-tabs-list");
    expect(list?.getAttribute("data-block")).toBe("true");
  });
});

describe("HkTabs end actions", () => {
  it("renders the protruding end button with endAction and emits action('end')", async () => {
    const sides: string[] = [];
    const t = mountTabs({ endAction: { label: "Add view" } }, (side) => { sides.push(side); });

    // The strip is wrapped in the shared hover-reveal surface and the
    // button lives in its extension slot, outside the tab list.
    const wrap = t.container.querySelector<HTMLElement>(".hk-tabs-addwrap.hk-hover-reveal");
    expect(wrap).not.toBeNull();
    expect(wrap?.getAttribute("data-placement") ?? "right").toBe("right");
    expect(t.container.querySelector(".hk-tabs[data-actions='end']")).not.toBeNull();

    const addBtn = wrap!.querySelector<HTMLButtonElement>(".hk-hover-reveal-extension button");
    expect(addBtn).not.toBeNull();
    expect(addBtn!.getAttribute("aria-label")).toBe("Add view");
    expect(addBtn!.getAttribute("title")).toBe("Add view");
    // The button lives OUTSIDE the scroll viewport, so it never scrolls away.
    expect(addBtn!.closest(".hk-scroll-container")).toBeNull();
    expect(addBtn!.closest(".hk-tabs-addwrap")).not.toBeNull();

    addBtn!.click();
    await nextTick();
    expect(sides).toEqual(["end"]);
  });

  it("renders the protruding start button with startAction and emits action('start')", async () => {
    const sides: string[] = [];
    const t = mountTabs({ startAction: { label: "Collapse" } }, (side) => { sides.push(side); });

    const wrap = t.container.querySelector<HTMLElement>(".hk-tabs-addwrap.hk-hover-reveal");
    expect(wrap).not.toBeNull();
    expect(wrap?.getAttribute("data-placement")).toBe("left");
    expect(t.container.querySelector(".hk-tabs[data-actions='start']")).not.toBeNull();

    const btn = wrap!.querySelector<HTMLButtonElement>(".hk-hover-reveal-extension button");
    expect(btn).not.toBeNull();
    expect(btn!.getAttribute("aria-label")).toBe("Collapse");
    expect(btn!.closest(".hk-scroll-container")).toBeNull();

    btn!.click();
    await nextTick();
    expect(sides).toEqual(["start"]);
  });

  it("supports both ends at once with nested reveal hosts", async () => {
    const sides: string[] = [];
    const t = mountTabs(
      { startAction: { label: "Back" }, endAction: { label: "Add view" } },
      (side) => { sides.push(side); },
    );

    expect(t.container.querySelector(".hk-tabs[data-actions='both']")).not.toBeNull();
    const wraps = t.container.querySelectorAll<HTMLElement>(".hk-tabs-addwrap.hk-hover-reveal");
    expect(wraps.length).toBe(2);
    const placements = Array.from(wraps).map((w) => w.getAttribute("data-placement") ?? "right");
    expect(placements).toContain("left");
    expect(placements).toContain("right");

    const labels = Array.from(
      t.container.querySelectorAll<HTMLButtonElement>(".hk-hover-reveal-extension button"),
    ).map((b) => b.getAttribute("aria-label"));
    expect(labels).toContain("Back");
    expect(labels).toContain("Add view");
    // Both buttons live outside the scroll viewport.
    for (const b of t.container.querySelectorAll<HTMLButtonElement>(".hk-hover-reveal-extension button")) {
      expect(b.closest(".hk-scroll-container")).toBeNull();
    }

    const [first] = t.container.querySelectorAll<HTMLButtonElement>(".hk-hover-reveal-extension button");
    first!.click();
    await nextTick();
    expect(sides.length).toBe(1);
  });

  it("falls back to the shared label and stays absent without actions", async () => {
    const bare = mountTabs();
    expect(bare.container.querySelector(".hk-tabs-addwrap")).toBeNull();
    expect(bare.container.querySelector(".hk-tabs[data-actions]")).toBeNull();

    const t = mountTabs({ endAction: {} });
    const addBtn = t.container.querySelector<HTMLButtonElement>(".hk-hover-reveal-extension button");
    expect(addBtn).not.toBeNull();
    // Default i18n string (test env resolves the en locale).
    expect(addBtn!.getAttribute("aria-label")).toContain("Add");
  });
});

describe("HkTabs segmented variant", () => {
  async function settle(): Promise<void> {
    await nextTick();
    await new Promise((r) => setTimeout(r, 20));
    await nextTick();
  }

  function key(el: Element, k: string): void {
    el.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }));
  }

  /** Mount with a live v-model and per-test tabs/slots. */
  function mountLive(
    extra: Record<string, unknown>,
    slots?: Record<string, () => unknown>,
  ): { container: HTMLElement; active: ReturnType<typeof ref<string>> } {
    const active = ref("a");
    const container = document.createElement("div");
    document.body.appendChild(container);
    containers.push(container);
    const Wrapper = defineComponent({
      setup() {
        return () =>
          h(HkTabs, {
            tabs: [
              { key: "a", label: "Alpha" },
              { key: "b", label: "Beta" },
              { key: "c", label: "Gamma", disabled: true },
            ],
            renderPanels: false,
            ...extra,
            modelValue: active.value,
            "onUpdate:modelValue": (v: string) => { active.value = v; },
          }, slots ?? {});
      },
    });
    const app = createApp(Wrapper);
    mounts.push(app);
    app.mount(container);
    return { container, active };
  }

  it("exposes radiogroup semantics and never renders panels", () => {
    const { container } = mountLive({ variant: "segmented" });
    const list = container.querySelector(".hk-tabs-list")!;
    expect(list.getAttribute("role")).toBe("radiogroup");
    expect(list.getAttribute("data-variant")).toBe("segmented");
    const trig = container.querySelectorAll(".hk-tabs-trigger");
    expect(trig[0].getAttribute("role")).toBe("radio");
    expect(trig[0].getAttribute("aria-checked")).toBe("true");
    expect(trig[0].getAttribute("tabindex")).toBeNull();
    expect(trig[1].getAttribute("tabindex")).toBe("-1");
    expect(container.querySelector(".hk-tabs-panel")).toBeNull();
  });

  it("keeps tab semantics for pill (the default)", () => {
    const { container } = mountLive({});
    const list = container.querySelector(".hk-tabs-list")!;
    expect(list.getAttribute("role")).toBe("tablist");
    expect(list.getAttribute("data-variant")).toBe("pill");
    const trig = container.querySelectorAll(".hk-tabs-trigger");
    expect(trig[0].getAttribute("role")).toBe("tab");
    expect(trig[0].getAttribute("aria-selected")).toBe("true");
    expect(trig[0].getAttribute("aria-checked")).toBeNull();
  });

  it("navigates with arrows and Home/End, skipping disabled tabs", async () => {
    const { container, active } = mountLive({ variant: "segmented" });
    const trig = container.querySelectorAll(".hk-tabs-trigger");
    key(trig[0], "ArrowRight");
    await settle();
    expect(active.value).toBe("b");
    // "c" disabled: wraps to "a".
    key(trig[1], "ArrowRight");
    await settle();
    expect(active.value).toBe("a");
    key(trig[0], "End");
    await settle();
    expect(active.value).toBe("b");
    // Keydowns always originate from a trigger in real browsers (the list
    // itself is not focusable) — Home from the focused trigger.
    key(trig[1], "Home");
    await settle();
    expect(active.value).toBe("a");
  });

  it("renders a measured tail overlay from overlayFrom with slot content", async () => {
    const { container } = mountLive(
      { variant: "segmented", overlayFrom: 0 },
      { overlay: () => h("button", { type: "button", class: "strip" }, "+32.5°") },
    );
    const overlay = container.querySelector<HTMLElement>(".hk-tabs-overlay")!;
    expect(overlay).not.toBeNull();
    expect(overlay.querySelector(".strip")).not.toBeNull();
    // The geometry pass runs one tick after mount: happy-dom has no
    // layout, so the equal-share fallback (tab 0 of 3) applies.
    await settle();
    expect(overlay.style.left).toBe("33.3333%");
    // Dropping the anchor disables the layer entirely.
    const bare = mountLive({ variant: "segmented", overlayFrom: -1 },
      { overlay: () => h("span", "x") });
    expect(bare.container.querySelector(".hk-tabs-overlay")).toBeNull();
    // Anchoring at the last tab leaves no tail to cover.
    const last = mountLive({ variant: "segmented", overlayFrom: 2 },
      { overlay: () => h("span", "x") });
    expect(last.container.querySelector(".hk-tabs-overlay")).toBeNull();
  });

  it("spans measured geometry once layout exists", async () => {
    const { container } = mountLive(
      { variant: "segmented", overlayFrom: 0 },
      { overlay: () => h("button", { class: "strip" }, "x") },
    );
    const list = container.querySelector<HTMLElement>(".hk-tabs-list")!;
    const trig = container.querySelectorAll<HTMLElement>(".hk-tabs-trigger");
    // Stub layout: trigger 0 at 14px wide 48, list inner width 182.
    Object.defineProperty(trig[0], "offsetLeft", { value: 14, configurable: true });
    Object.defineProperty(trig[0], "offsetWidth", { value: 48, configurable: true });
    Object.defineProperty(list, "clientWidth", { value: 182, configurable: true });
    await settle();
    const overlay = container.querySelector<HTMLElement>(".hk-tabs-overlay")!;
    // Unified chrome: zero inter-trigger gap, 2px track padding.
    expect(overlay.style.left).toBe("62px");
    expect(overlay.style.width).toBe("118px");
  });

  it("renders a tab icon field before the label", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    containers.push(container);
    const active = ref("a");
    const Icon = () => h("i", { class: "glyph" });
    const Wrapper = defineComponent({
      setup() {
        return () => h(HkTabs, {
          variant: "segmented",
          renderPanels: false,
          tabs: [{ key: "a", label: "Alpha", icon: h(Icon) }],
          modelValue: active.value,
        });
      },
    });
    const app = createApp(Wrapper);
    mounts.push(app);
    app.mount(container);
    expect(container.querySelector(".hk-tabs-trigger-icon .glyph")).not.toBeNull();
  });
});
