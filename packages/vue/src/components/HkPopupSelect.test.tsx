import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, h } from "vue";

// The sheet half of this file runs with a pinned mobile breakpoint (the
// desktop pins below share the file's module graph, and useBreakpoint
// cannot be re-mocked per-test) — mirror of HkFilterTrigger.mobile's
// split.
vi.mock("../runtime/useBreakpoint", () => ({
  useBreakpoint: () => ({ isMobile: { value: false } }),
}));

import HkPopupSelect from "./HkPopupSelect";

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
  document.body.querySelectorAll(".hk-popover-scrim, .hk-popover-panel, .hk-select-popout-host").forEach((el) => el.remove());
});

const OPTIONS = [
  { value: "a1", label: "Agent One" },
  { value: "a2", label: "Agent Two" },
];

describe("HkPopupSelect", () => {
  it("renders the md stock by default — no sm class, no derived aria-label", () => {
    const c = mount(h(HkPopupSelect, { modelValue: "a1", label: "Agent", options: OPTIONS }));
    const trigger = c.querySelector<HTMLButtonElement>(".hk-popup-select-trigger")!;
    expect(trigger.className).toContain("hk-popup-select-trigger");
    expect(trigger.className).not.toContain("hk-popup-select-trigger-sm");
    // Without hideLabel the caption renders and no aria-label is derived.
    expect(c.querySelector(".hk-popup-select-label")?.textContent).toBe("Agent");
    expect(trigger.getAttribute("aria-label")).toBeNull();
  });

  it("size=sm rides the compact trigger class", () => {
    const c = mount(h(HkPopupSelect, { modelValue: "a1", size: "sm", options: OPTIONS }));
    expect(c.querySelector(".hk-popup-select-trigger-sm")).toBeTruthy();
  });

  it("hideLabel drops the caption but keeps the name on the trigger", () => {
    const c = mount(
      h(HkPopupSelect, { modelValue: "a1", label: "Agent", hideLabel: true, options: OPTIONS }),
    );
    expect(c.querySelector(".hk-popup-select-label")).toBeNull();
    expect(c.querySelector(".hk-popup-select-trigger")!.getAttribute("aria-label")).toBe("Agent");
  });

  it("a caller-provided aria-label cannot reach the trigger (fallthrough lands on the wrapper)", () => {
    // Unlike HkInput (whose field element spreads caller attrs after the
    // derived aria-label), this trigger is an explicit element in the
    // render — callers rename the field through `label`, which feeds
    // both the caption and (with hideLabel) the derived aria-label.
    const c = mount(
      h(HkPopupSelect, {
        modelValue: "a1",
        label: "Agent",
        hideLabel: true,
        "aria-label": "Custom name",
        options: OPTIONS,
      }),
    );
    expect(c.querySelector(".hk-popup-select-trigger")!.getAttribute("aria-label")).toBe("Agent");
    expect(c.querySelector(".hk-popup-select-wrapper")!.getAttribute("aria-label")).toBe("Custom name");
  });

  it("without hideLabel no aria-label is derived, even when a label renders", () => {
    const c = mount(h(HkPopupSelect, { modelValue: "a1", label: "Agent", options: OPTIONS }));
    expect(c.querySelector(".hk-popup-select-trigger")!.getAttribute("aria-label")).toBeNull();
  });

  it("an option description renders its own muted line under the label", async () => {
    const c = mount(
      h(HkPopupSelect, {
        modelValue: "",
        options: [{ value: "a1", label: "Agent One", description: "Personal · /srv/one" }],
      }),
    );
    // Open the popout — option rows live in the anchored panel, which
    // mounts across a microtask (the mobile sheet tests await the same).
    c.querySelector<HTMLButtonElement>(".hk-popup-select-trigger")!
      .dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();
    const item = document.body.querySelector(".hk-popup-select-item")!;
    expect(item.textContent).toContain("Agent One");
    const desc = item.querySelector(".hk-popup-select-item-desc");
    expect(desc?.textContent).toBe("Personal · /srv/one");
    // The label sits in its own span so the two lines never merge.
    expect(item.querySelector(".hk-popup-select-item-label")?.textContent).toBe("Agent One");
  });

  it("no description → the exact stock DOM: bare label span, no body wrapper", async () => {
    const c = mount(h(HkPopupSelect, { modelValue: "", options: OPTIONS }));
    c.querySelector<HTMLButtonElement>(".hk-popup-select-trigger")!
      .dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();
    const item = document.body.querySelector(".hk-popup-select-item")!;
    // R2 contract: description-less rows render the pre-description DOM —
    // no two-line anatomy, so no mi.label ellipsis/optical spec applies.
    expect(item.querySelector(".hk-popup-select-item-body")).toBeNull();
    expect(item.querySelector(".hk-popup-select-item-label")).toBeNull();
    expect(item.querySelector("span")?.textContent).toBe("Agent One");
  });

  it("the collapsed trigger shows the label only, never the description", () => {
    const c = mount(
      h(HkPopupSelect, {
        modelValue: "a1",
        options: [{ value: "a1", label: "Agent One", description: "secret-meta" }],
      }),
    );
    const value = c.querySelector(".hk-popup-select-value")!;
    expect(value.textContent).toBe("Agent One");
    expect(value.textContent).not.toContain("secret-meta");
  });
});
