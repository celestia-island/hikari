import { afterEach, describe, expect, it } from "vitest";
import { createApp, h } from "vue";

import HkFilterBar from "./HkFilterBar";

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

function emitClick(el: Element) {
  el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
}

/** HkPopover teleports its surface to document.body — query the document,
 *  not the mount container, for everything inside the panel. */
const panelQuery = (sel: string) => document.body.querySelector(sel);

describe("HkFilterBar inline", () => {
  it("renders the fields slot inside a search-landmark card row", () => {
    const c = mount(
      h(HkFilterBar, { label: "Ledger filters" }, { default: () => h("input", { "data-probe": "" }) }),
    );
    const bar = c.querySelector(".hk-filter-bar") as HTMLElement;
    expect(bar).toBeTruthy();
    expect(bar.getAttribute("role")).toBe("search");
    expect(bar.getAttribute("aria-label")).toBe("Ledger filters");
    expect(bar.className).not.toContain("hk-filter-bar-popover");
    expect(c.querySelector(".hk-filter-bar-fields input[data-probe]")).toBeTruthy();
  });

  it("shows the reset button and the active-count badge", () => {
    const c = mount(h(HkFilterBar, { activeCount: 2 }, { default: () => null }));
    expect(c.querySelector(".hk-filter-bar-count")?.textContent).toBe("2");
    const reset = c.querySelector(".hk-filter-bar-actions button") as HTMLButtonElement;
    expect(reset).toBeTruthy();
    expect(reset.textContent).toContain("Reset");
  });

  it("emits reset from the actions column and disables it at zero", () => {
    const resets: number[] = [];
    const c = mount(
      h(HkFilterBar, { activeCount: 1, onReset: () => resets.push(1) }, { default: () => null }),
    );
    emitClick(c.querySelector(".hk-filter-bar-actions button")!);
    expect(resets.length).toBe(1);
    // zero active filters → the affordance is disabled, not hidden
    const c2 = mount(h(HkFilterBar, { activeCount: 0 }, { default: () => null }));
    const reset2 = c2.querySelector(".hk-filter-bar-actions button") as HTMLButtonElement;
    expect(reset2.disabled).toBe(true);
  });
});

describe("HkFilterBar popover", () => {
  it("starts collapsed behind a trigger button carrying the count", () => {
    const c = mount(
      h(HkFilterBar, { mode: "popover", activeCount: 3 }, { default: () => h("input", { "data-probe": "" }) }),
    );
    const trigger = c.querySelector(".hk-filter-bar-popover button") as HTMLButtonElement;
    expect(trigger).toBeTruthy();
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(trigger.getAttribute("aria-haspopup")).toBe("dialog");
    expect(trigger.textContent).toContain("Filters");
    expect(trigger.querySelector(".hk-filter-bar-count")?.textContent).toBe("3");
    // collapsed by default: the panel (and the fields with it) is not mounted
    expect(panelQuery(".hk-filter-bar-panel")).toBeNull();
  });

  it("toggling the trigger opens the panel with the fields", async () => {
    const c = mount(
      h(HkFilterBar, { mode: "popover" }, { default: () => h("input", { "data-probe": "" }) }),
    );
    const trigger = c.querySelector(".hk-filter-bar-popover button") as HTMLButtonElement;
    emitClick(trigger);
    await Promise.resolve();
    await Promise.resolve();
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    const panel = panelQuery(".hk-filter-bar-panel") as HTMLElement;
    expect(panel).toBeTruthy();
    expect(panel.querySelector("input[data-probe]")).toBeTruthy();
  });

  it("apply closes the popover and emits apply; footer carries reset", async () => {
    const events: string[] = [];
    const c = mount(
      h(
        HkFilterBar,
        { mode: "popover", activeCount: 1, onApply: () => events.push("apply"), onReset: () => events.push("reset") },
        { default: () => h("input", { "data-probe": "" }) },
      ),
    );
    emitClick(c.querySelector(".hk-filter-bar-popover button")!);
    await Promise.resolve();
    await Promise.resolve();
    const buttons = Array.from(document.body.querySelectorAll(".hk-filter-bar-footer button")) as HTMLButtonElement[];
    expect(buttons.length).toBe(2);
    expect(buttons[0].textContent).toContain("Reset");
    expect(buttons[1].textContent).toContain("Apply");
    emitClick(buttons[1]);
    await Promise.resolve();
    await Promise.resolve();
    expect(events).toEqual(["apply"]);
    expect(
      (c.querySelector(".hk-filter-bar-popover button") as HTMLButtonElement).getAttribute("aria-expanded"),
    ).toBe("false");
  });

  it("showFooter=false drops the footer (live-commit panels)", async () => {
    const c = mount(
      h(HkFilterBar, { mode: "popover", showFooter: false }, { default: () => null }),
    );
    emitClick(c.querySelector(".hk-filter-bar-popover button")!);
    await Promise.resolve();
    await Promise.resolve();
    expect(panelQuery(".hk-filter-bar-footer")).toBeNull();
  });
});
