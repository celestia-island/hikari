import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, h, nextTick } from "vue";

import HExpansionPanel from "./HkExpansionPanel";

const mounts: Array<{ app: ReturnType<typeof createApp>; container: HTMLElement }> = [];

function mountPanel(props: Record<string, unknown> = {}, slots: Record<string, () => unknown> = {}) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const app = createApp({
    render: () => h(HExpansionPanel, props, slots),
  });
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

function panelOf(container: HTMLElement): HTMLElement {
  const panel = container.querySelector<HTMLElement>(".hk-expansion-panel");
  expect(panel).toBeTruthy();
  return panel!;
}

function headerOf(panel: HTMLElement): HTMLElement {
  const header = panel.querySelector<HTMLElement>(".hk-expansion-panel-header");
  expect(header).toBeTruthy();
  return header!;
}

describe("HkExpansionPanel", () => {
  it("renders closed by default with aria-expanded=false and collapsed body", () => {
    const container = mountPanel({ title: "Electrical power" }, { default: () => h("p", "body") });
    const panel = panelOf(container);
    expect(panel.getAttribute("data-open")).toBeNull();
    expect(headerOf(panel).getAttribute("aria-expanded")).toBe("false");
    expect(panel.querySelector(".hk-expansion-panel-title")!.textContent).toBe("Electrical power");
    // The collapsed body stays in the DOM but carries the closed state
    // (CSS hides it; happy-dom does not cascade stylesheets).
    expect(panel.querySelector(".hk-expansion-panel-content")).toBeTruthy();
    expect(panel.textContent).toContain("body");
  });

  it("opens on header click, emits update:modelValue + toggle, and reflects aria-expanded", async () => {
    const onUpdate = vi.fn();
    const onToggle = vi.fn();
    const container = mountPanel(
      { title: "T", "onUpdate:modelValue": onUpdate, onToggle },
      { default: () => h("p", "body") },
    );
    const panel = panelOf(container);
    headerOf(panel).click();
    await nextTick();
    expect(panel.getAttribute("data-open")).not.toBeNull();
    expect(headerOf(panel).getAttribute("aria-expanded")).toBe("true");
    expect(onUpdate).toHaveBeenCalledWith(true);
    expect(onToggle).toHaveBeenCalledWith(true);
    headerOf(panel).click();
    await nextTick();
    expect(panel.getAttribute("data-open")).toBeNull();
    expect(onUpdate).toHaveBeenLastCalledWith(false);
  });

  it("respects a controlled modelValue", () => {
    const container = mountPanel({ title: "T", modelValue: true }, { default: () => h("p", "body") });
    expect(panelOf(container).getAttribute("data-open")).not.toBeNull();
  });

  it("starts open with defaultOpen in uncontrolled mode", () => {
    const container = mountPanel({ title: "T", defaultOpen: true }, { default: () => h("p", "x") });
    expect(panelOf(container).getAttribute("data-open")).not.toBeNull();
  });

  it("does not toggle when disabled", async () => {
    const onToggle = vi.fn();
    const container = mountPanel({ title: "T", disabled: true, onToggle }, { default: () => h("p", "x") });
    const panel = panelOf(container);
    expect(panel.getAttribute("data-disabled")).not.toBeNull();
    expect(headerOf(panel).getAttribute("aria-disabled")).toBe("true");
    headerOf(panel).click();
    await nextTick();
    expect(panel.getAttribute("data-open")).toBeNull();
    expect(onToggle).not.toHaveBeenCalled();
  });

  it("renders subtitle and action slot; action clicks do not toggle", async () => {
    const onToggle = vi.fn();
    const container = mountPanel(
      { title: "T", subtitle: "9 colors", onToggle },
      {
        default: () => h("p", "body"),
        action: () => h("button", { class: "act", onClick: () => {} }, "act"),
      },
    );
    const panel = panelOf(container);
    expect(panel.querySelector(".hk-expansion-panel-subtitle")!.textContent).toBe("9 colors");
    panel.querySelector<HTMLElement>(".act")!.click();
    await nextTick();
    expect(panel.getAttribute("data-open")).toBeNull();
    expect(onToggle).not.toHaveBeenCalled();
  });
});
