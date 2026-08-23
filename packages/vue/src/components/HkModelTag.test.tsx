import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, h, nextTick } from "vue";

// HPopover teleports to body — stub it with a passthrough that renders its
// slot while open (same pattern as HkAdminHeader.test.tsx).
vi.mock("@celestia-island/hikari", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@celestia-island/hikari")>();
  const { defineComponent, h } = await import("vue");
  const HPopoverStub = defineComponent({
    name: "HPopover",
    props: {
      modelValue: { type: Boolean, default: false },
      placement: { type: String, default: "bottom" },
    },
    setup(props, { slots }) {
      return () =>
        props.modelValue
          ? h("div", { class: "popover-stub" }, slots.default?.())
          : null;
    },
  });
  return { ...actual, HPopover: HPopoverStub };
});

import { HkModelTag } from "./HkModelTag";

/**
 * HkModelTag joined-pill contract tests.
 * (Upstreamed from shittim-chest's plana-legacy layer.)
 *
 * The `#tag` number and the model name must render as ONE badge: a single
 * group, zero gap between the segments, a divider at the seam, and an
 * adaptive name that can ellipsize (never a fixed 180px clamp that
 * overflows narrow containers).
 *
 * (Repo test convention: raw createApp + container queries, no
 * @vue/test-utils dependency.)
 */

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

function tagNode(props: Record<string, unknown>) {
  return h(HkModelTag, props as never);
}

describe("HkModelTag", () => {
  it("renders the #tag and the model name inside one joined group", () => {
    const c = mount(tagNode({ model: "qwen3-coder-plus#8" }));
    const group = c.querySelector(".s-model-tag-group");
    expect(group).not.toBeNull();
    const num = group?.querySelector(".s-model-tag-num");
    const name = group?.querySelector(".s-model-tag-name");
    expect(num?.textContent).toBe("#8");
    expect(name?.textContent).toBe("qwen3-coder-plus");
  });

  it("carries the full model id on the group title for hover-to-read", () => {
    const c = mount(tagNode({ model: "qwen3-coder-plus#8" }));
    expect(c.querySelector(".s-model-tag-group")?.getAttribute("title")).toBe(
      "qwen3-coder-plus#8",
    );
  });

  it("renders a bare model id without the number segment", () => {
    const c = mount(tagNode({ model: "deepseek-v4-pro" }));
    const group = c.querySelector(".s-model-tag-group");
    expect(group?.querySelector(".s-model-tag-num")).toBeNull();
    expect(group?.querySelector(".s-model-tag-name")?.textContent).toBe("deepseek-v4-pro");
  });

  it("renders the hover card title without truncation (expanded pill)", async () => {
    vi.useFakeTimers();
    try {
      const c = mount(tagNode({ model: "qwen3-coder-plus#8" }));
      c.querySelector(".s-model-tag")?.dispatchEvent(
        new MouseEvent("mouseenter", { bubbles: true }),
      );
      vi.advanceTimersByTime(300);
      await nextTick();
      const cardGroup = c.querySelector(
        ".popover-stub .s-model-tag-group[data-expanded]",
      );
      expect(cardGroup).not.toBeNull();
      expect(cardGroup?.textContent).toContain("qwen3-coder-plus");
    } finally {
      vi.useRealTimers();
    }
  });

  it("defaults to the truncating variant", () => {
    const c = mount(tagNode({ model: "gpt-5.5#2" }));
    expect(
      c.querySelector(".s-model-tag-group")?.getAttribute("data-expanded"),
    ).toBeNull();
  });
});
