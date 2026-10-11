import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, h, ref, type App } from "vue";

import HkSearchTrigger from "./HkSearchTrigger";

const apps: App[] = [];
const containers: HTMLElement[] = [];

function mount(node: ReturnType<typeof h>) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const app = createApp({ render: () => node });
  app.mount(container);
  apps.push(app);
  containers.push(container);
  return container;
}

afterEach(() => {
  for (const app of apps.splice(0)) app.unmount();
  for (const el of containers.splice(0)) el.remove();
  document.body.innerHTML = "";
});

function triggerButton(container: HTMLElement): HTMLButtonElement {
  const btn = container.querySelector<HTMLButtonElement>("button[aria-haspopup='dialog']");
  expect(btn).not.toBeNull();
  return btn!;
}

function searchField(): HTMLInputElement | null {
  return document.querySelector<HTMLInputElement>(".hk-search-input-field");
}

/** A host that actually BINDS the keyword two-way — the trigger's
 * commit guard compares against `modelValue`, so a static prop would
 * swallow every commit after the first (exactly the bug a v-model host
 * never sees). */
function mountBound(props: Record<string, unknown> = {}) {
  const commits: string[] = [];
  const state = ref("");
  const Host = {
    setup() {
      return () =>
        h(HkSearchTrigger, {
          ...props,
          modelValue: state.value,
          "onUpdate:modelValue": (v: string) => {
            state.value = v;
            commits.push(v);
          },
        });
    },
  };
  const c = mount(h(Host as never));
  return { c, commits, state };
}

describe("HkSearchTrigger", () => {
  it("renders the header-chrome trigger with an accessible name", () => {
    const c = mount(h(HkSearchTrigger, { modelValue: "" }));
    const btn = triggerButton(c);
    expect(btn.getAttribute("aria-label")).toBe("Search");
    expect(btn.getAttribute("aria-expanded")).toBe("false");
    // No keyword → no active dot.
    expect(c.querySelector(".hk-search-trigger-dot")).toBeNull();
  });

  it("an active keyword shows the dot", () => {
    const c = mount(h(HkSearchTrigger, { modelValue: "stale" }));
    expect(c.querySelector(".hk-search-trigger-dot")).not.toBeNull();
  });

  it("click opens the panel with the input focused", async () => {
    const c = mount(h(HkSearchTrigger, { modelValue: "" }));
    triggerButton(c).click();
    await new Promise((r) => setTimeout(r, 20));
    const input = searchField();
    expect(input).not.toBeNull();
    // The panel input receives focus on open.
    expect(document.activeElement).toBe(input);
  });

  it("typing commits debounced; clearing commits immediately", async () => {
    vi.useFakeTimers();
    try {
      const { c, commits } = mountBound({ debounce: 200 });
      triggerButton(c).click();
      await vi.advanceTimersByTimeAsync(10);
      const input = searchField()!;
      input.value = "al";
      input.dispatchEvent(new Event("input"));
      await vi.advanceTimersByTimeAsync(50);
      expect(commits).toEqual([]);
      await vi.advanceTimersByTimeAsync(200);
      expect(commits).toEqual(["al"]);

      // Clearing is immediate — no debounced dot-lag.
      input.value = "";
      input.dispatchEvent(new Event("input"));
      expect(commits).toEqual(["al", ""]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("drafts shorter than minLength never commit (panel edits are free)", async () => {
    vi.useFakeTimers();
    try {
      const { c, commits } = mountBound({ minLength: 3, debounce: 50 });
      triggerButton(c).click();
      await vi.advanceTimersByTimeAsync(10);
      const input = searchField()!;
      input.value = "ab";
      input.dispatchEvent(new Event("input"));
      await vi.advanceTimersByTimeAsync(120);
      expect(commits).toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("Enter commits immediately, skipping the debounce", async () => {
    vi.useFakeTimers();
    try {
      const { c, commits } = mountBound({ debounce: 5000 });
      triggerButton(c).click();
      await vi.advanceTimersByTimeAsync(10);
      const input = searchField()!;
      input.value = "ledger";
      input.dispatchEvent(new Event("input"));
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
      expect(commits).toEqual(["ledger"]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("a pending debounced commit lands even after the panel closes", async () => {
    vi.useFakeTimers();
    try {
      const { c, commits } = mountBound({ debounce: 30_000 });
      triggerButton(c).click();
      await vi.advanceTimersByTimeAsync(10);
      const input = searchField()!;
      input.value = "gpu";
      input.dispatchEvent(new Event("input"));
      await vi.advanceTimersByTimeAsync(50);
      expect(commits).toEqual([]);
      // Close with the debounce still pending — the trigger flushes the
      // draft (the popover tears the input, and its timer, down).
      triggerButton(c).click();
      expect(commits).toEqual(["gpu"]);
    } finally {
      vi.useRealTimers();
    }
  });
});
