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
  });
});
