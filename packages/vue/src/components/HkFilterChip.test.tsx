import { afterEach, describe, expect, it } from "vitest";
import { createApp, h, ref } from "vue";

import HkFilterChip from "./HkFilterChip";

const mounts: Array<{ app: ReturnType<typeof createApp>; container: HTMLElement }> = [];

function mount(node: ReturnType<typeof h>) {
  return mountRendered(() => node);
}

/** Mount with the vnode built INSIDE the render fn, so reactive props
 * (a host's open ref) re-render the tree when they change. */
function mountRendered(build: () => ReturnType<typeof h>) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const app = createApp({ render: () => build() });
  app.mount(container);
  mounts.push({ app, container });
  return container;
}

afterEach(() => {
  for (const { app, container } of mounts.splice(0)) {
    app.unmount();
    container.remove();
  }
  document.body.querySelectorAll(".hk-popover-scrim, .hk-popover-panel").forEach((el) => el.remove());
});

const OPTIONS = [
  { value: "deepseek", label: "DeepSeek" },
  { value: "openai", label: "OpenAI" },
  { value: "anthropic", label: "Anthropic" },
  { value: "gemini", label: "Gemini" },
];

const chipButton = (c: HTMLElement) => c.querySelector<HTMLButtonElement>(".hk-filter-chip")!;

describe("HkFilterChip", () => {
  it("renders the chip closed, labelled by the all-label when nothing is picked", () => {
    const c = mount(
      h(HkFilterChip, { label: "Providers", allLabel: "All providers", options: OPTIONS }),
    );
    const btn = chipButton(c);
    expect(btn.textContent).toContain("All providers");
    expect(btn.getAttribute("aria-haspopup")).toBe("dialog");
    expect(btn.getAttribute("aria-expanded")).toBe("false");
    expect(btn.className).not.toContain("hk-filter-chip--on");
    // Nothing teleported while closed.
    expect(document.body.querySelector(".hk-pill-group")).toBeNull();
  });

  it("opens the pill group in a popover and reports toggle / all", async () => {
    const open = ref(false);
    const toggled: string[] = [];
    const allClicks: number[] = [];
    const c = mountRendered(
      () =>
        h(HkFilterChip, {
          label: "Providers",
          allLabel: "All providers",
          options: OPTIONS,
          open: open.value,
          "onUpdate:open": (v: boolean) => (open.value = v),
          onToggle: (v: string) => toggled.push(v),
          onAll: () => allClicks.push(1),
          hint: "Multi-select hint line",
        }),
    );
    chipButton(c).dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();
    expect(open.value).toBe(true);
    expect(chipButton(c).getAttribute("aria-expanded")).toBe("true");

    // HkPopover teleports the surface to the body — the pill group and
    // the host-authored hint line live there, not in the anchor.
    const group = document.body.querySelector(".hk-pill-group");
    expect(group, "pill group mounted in the popover after the chip click").toBeTruthy();
    expect(document.body.querySelector(".hk-filter-chip-hint")?.textContent).toContain("Multi-select hint line");

    const pills = [...document.body.querySelectorAll<HTMLButtonElement>(".hk-pill-group-pill")];
    expect(pills.length).toBe(OPTIONS.length + 1);
    pills[2].dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await Promise.resolve();
    expect(toggled).toEqual(["openai"]);

    pills[0].dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await Promise.resolve();
    expect(allClicks.length).toBe(1);
    expect(toggled).toEqual(["openai"]);
  });

  it("mirrors the selection on the chip in canonical option order, capped with a +N tail", async () => {
    // Canonical order wins over Set insertion order; the 4th pick caps
    // the label instead of growing the chip without bound.
    const selected = new Set(["gemini", "openai", "anthropic", "deepseek"]);
    const c = mount(
      h(HkFilterChip, {
        label: "Providers",
        allLabel: "All providers",
        options: OPTIONS,
        selected,
        open: true,
      }),
    );
    const text = chipButton(c).querySelector(".hk-filter-chip-text")!.textContent;
    expect(text).toBe("DeepSeek, OpenAI, Anthropic +1");
    expect(chipButton(c).className).toContain("hk-filter-chip--on");
    // The accessible name carries the SAME selection the eye sees — an
    // aria-label of just the category would mask the mirror (R1 P2).
    expect(chipButton(c).getAttribute("aria-label")).toContain("DeepSeek, OpenAI, Anthropic +1");
  });

  it("re-renders when the host's selected set changes post-mount", async () => {
    const selected = ref(new Set<string>());
    const c = mountRendered(
      () =>
        h(HkFilterChip, {
          label: "Providers",
          allLabel: "All providers",
          options: OPTIONS,
          selected: selected.value,
          open: false,
        }),
    );
    expect(chipButton(c).querySelector(".hk-filter-chip-text")!.textContent).toBe("All providers");
    selected.value = new Set(["openai"]);
    await Promise.resolve();
    await Promise.resolve();
    expect(chipButton(c).querySelector(".hk-filter-chip-text")!.textContent).toBe("OpenAI");
    expect(chipButton(c).className).toContain("hk-filter-chip--on");
    expect(chipButton(c).getAttribute("aria-label")).toContain("OpenAI");
  });

  it("renders no caret — the facet chip reads as the solid-chip family", () => {
    const c = mount(
      h(HkFilterChip, { label: "Providers", allLabel: "All providers", options: OPTIONS }),
    );
    // The 2026-11-19 default: no affordance arrow beside the label (the
    // bespoke chips of the wowsp bar carry none either); disclosure rides
    // aria-expanded. Host suffixes seat through renderChipTrailing.
    expect(chipButton(c).querySelector(".hk-filter-chip-caret")).toBeNull();
  });

  it("opens the popup at the lg pad step by default — a content panel, not a menu", async () => {
    const open = ref(false);
    const c = mountRendered(
      () =>
        h(HkFilterChip, {
          label: "Providers",
          allLabel: "All providers",
          options: OPTIONS,
          open: open.value,
          "onUpdate:open": (v: boolean) => (open.value = v),
        }),
    );
    chipButton(c).dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();
    // The shared container-pad token lands inline on the teleported panel
    // at the lg step (16px) — the glass chrome's 4px menu-voice inset read
    // cramped against the pill group.
    const panel = document.body.querySelector<HTMLElement>(".hk-popover-panel")!;
    expect(panel).toBeTruthy();
    expect(panel.style.getPropertyValue("--hk-pad")).toBe("var(--space-16, 1rem)");
  });

  it("chipText overrides the selection mirror on the trigger and in the aria name", () => {
    // A range corridor is not a picked-label list: the host names it.
    const c = mount(
      h(HkFilterChip, {
        label: "Tier",
        allLabel: "All tiers",
        chipText: "VI – ★",
      }),
    );
    expect(chipButton(c).querySelector(".hk-filter-chip-text")!.textContent).toBe("VI – ★");
    // The override differs from the all-label: the state stays audible.
    expect(chipButton(c).getAttribute("aria-label")).toBe("Tier: VI – ★");
  });

  it("seats the host's chip suffix (renderChipTrailing) after the text", () => {
    const c = mount(
      h(HkFilterChip, {
        label: "Providers",
        allLabel: "All providers",
        options: OPTIONS,
        renderChipTrailing: () => h("span", { class: "chip-arrow" }, "↑"),
      }),
    );
    const arrow = chipButton(c).querySelector(".chip-arrow");
    expect(arrow).toBeTruthy();
    // After the text span: the suffix is the LAST element child.
    expect(chipButton(c).lastElementChild).toBe(arrow);
  });

  it("forwards renderPillTrailing to the pill group; null scopes the all-pill", async () => {
    const scopes: Array<string | null> = [];
    const c = mountRendered(
      () =>
        h(HkFilterChip, {
          label: "Providers",
          allLabel: "All providers",
          options: OPTIONS,
          selected: new Set(["openai"]),
          open: true,
          renderPillTrailing: (value) => {
            scopes.push(value);
            return h("span", { class: value === null ? "arrow-all" : "arrow-opt" }, "↑");
          },
        }),
    );
    expect(document.body.querySelector(".hk-pill-group")).toBeTruthy();
    // One call per rendered pill: the all-pill (null) plus each option.
    expect(scopes).toEqual([null, "deepseek", "openai", "anthropic", "gemini"]);
    // The all-pill arrow and exactly the option arrows rendered.
    expect(document.body.querySelector(".arrow-all")).toBeTruthy();
    const optArrows = document.body.querySelectorAll(".arrow-opt");
    expect(optArrows.length).toBe(OPTIONS.length);
    optArrows.forEach((arrow) => {
      const pill = arrow.closest(".hk-pill-group-pill")!;
      // The arrow seats after the label (the pill's last text node ends it).
      expect(pill.textContent).toContain("↑");
    });
  });

  it("the default slot replaces the pill group; the hint still appends", async () => {
    const open = ref(true);
    mountRendered(
      () =>
        h(
          HkFilterChip,
          {
            label: "Tier",
            allLabel: "All tiers",
            hint: "Drag either end",
            open: open.value,
            "onUpdate:open": (v: boolean) => (open.value = v),
          },
          { default: () => h("div", { class: "custom-body" }, "slider lives here") },
        ),
    );
    await Promise.resolve();
    await Promise.resolve();
    // The host's body mounts in the slot's place — a range slider is not
    // an option set — and the hint line still appends below it.
    expect(document.body.querySelector(".custom-body")?.textContent).toBe("slider lives here");
    expect(document.body.querySelector(".hk-pill-group")).toBeNull();
    expect(document.body.querySelector(".hk-filter-chip-hint")?.textContent).toBe(
      "Drag either end",
    );
  });
});
