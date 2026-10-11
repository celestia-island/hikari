import { afterEach, describe, expect, it } from "vitest";
import { createApp, h } from "vue";

import HkPillToggleGroup from "./HkPillToggleGroup";

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

const OPTIONS = [
  { value: "deepseek", label: "DeepSeek" },
  { value: "openai", label: "OpenAI" },
  { value: "anthropic", label: "Anthropic" },
];

describe("HkPillToggleGroup", () => {
  it("renders one pill per option plus the all-pill, active state from the selected set", () => {
    const c = mount(
      h(HkPillToggleGroup, {
        label: "Providers",
        options: OPTIONS,
        selected: new Set(["openai"]),
        allLabel: "All",
      }),
    );
    const pills = [...c.querySelectorAll<HTMLButtonElement>(".hk-pill-group-pill")];
    expect(pills.map((p) => p.textContent?.trim())).toEqual(["All", "DeepSeek", "OpenAI", "Anthropic"]);
    // Active tint rides data-active (the segmented grammar — no aria-only state).
    expect(pills[0].hasAttribute("data-active")).toBe(false);
    expect(pills[2].hasAttribute("data-active")).toBe(true);
    // Every pill is a pressed-state toggle button (screen readers hear the set).
    expect(pills[2].getAttribute("aria-pressed")).toBe("true");
    expect(pills[1].getAttribute("aria-pressed")).toBe("false");
    expect(c.querySelector(".hk-pill-group")!.getAttribute("role")).toBe("group");
  });

  it("marks the all-pill active when nothing is picked, and hides it without allLabel", () => {
    const withAll = mount(
      h(HkPillToggleGroup, { label: "P", options: OPTIONS, selected: new Set<string>(), allLabel: "All" }),
    );
    expect(withAll.querySelectorAll(".hk-pill-group-pill")[0].hasAttribute("data-active")).toBe(true);

    const bare = mount(h(HkPillToggleGroup, { label: "P", options: OPTIONS, selected: new Set<string>() }));
    expect(bare.querySelectorAll(".hk-pill-group-pill").length).toBe(OPTIONS.length);
  });

  it("reports toggle(value) and all() — the set itself is never mutated here", async () => {
    const seen: string[] = [];
    const allClicks: number[] = [];
    const selected = new Set<string>(["deepseek"]);
    const c = mount(
      h(HkPillToggleGroup, {
        label: "P",
        options: OPTIONS,
        selected,
        allLabel: "All",
        onToggle: (v: string) => seen.push(v),
        onAll: () => allClicks.push(1),
      }),
    );
    const pills = [...c.querySelectorAll<HTMLButtonElement>(".hk-pill-group-pill")];
    pills[2].dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await Promise.resolve();
    expect(seen).toEqual(["openai"]);
    // The host-owned set is untouched — the component only reports.
    expect([...selected]).toEqual(["deepseek"]);

    pills[0].dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await Promise.resolve();
    expect(allClicks.length).toBe(1);
    expect(seen).toEqual(["openai"]);
  });

  it("normalizes option icons: components render, junk renders nothing, nothing stringifies", async () => {
    const { h } = await import("vue");
    const { Zap } = await import("lucide-vue-next");
    const c = mount(
      h(HkPillToggleGroup, {
        label: "P",
        selected: new Set<string>(),
        options: [
          { value: "fn", label: "Fn", icon: Zap },
          { value: "vnode", label: "Vn", icon: h(Zap) },
          { value: "junk", label: "Jk", icon: 42 },
        ],
      }),
    );
    await Promise.resolve();
    const pills = [...c.querySelectorAll<HTMLButtonElement>(".hk-pill-group-pill")];
    // A raw lucide component FUNCTION must render as its <svg> — the R1
    // landmine: unnormalized it stringifies into source text.
    expect(pills[0].querySelector("svg"), "function icon renders").toBeTruthy();
    expect(pills[0].textContent).not.toContain("h(");
    // A prebuilt vnode passes through identically.
    expect(pills[1].querySelector("svg"), "vnode icon renders").toBeTruthy();
    // Junk (a number) renders nothing — and never its digits.
    expect(pills[2].querySelector(".hk-pill-group-icon")).toBeNull();
    expect(pills[2].textContent?.trim()).toBe("Jk");
  });
});
