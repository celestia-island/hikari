import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, h, nextTick } from "vue";

import HkAuthChannelList from "./HkAuthChannelList";

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

const methods = [
  { key: "feishu", label: "飞书登录", icon: h("svg") },
  { key: "celestial", label: "Celestia 账号" },
];

describe("HkAuthChannelList", () => {
  it("renders full-width rows: the mark on the left, the channel NAME on the right", () => {
    // 2026-11-22 user direction: sign-in destinations are a standard
    // list — the name is plain sight, not a hover tooltip on a tile.
    const c = mount(h(HkAuthChannelList, { methods }));
    const rows = c.querySelectorAll<HTMLButtonElement>(".hk-auth-channel-row");
    expect(rows.length).toBe(2);
    expect(rows[0]!.textContent).toContain("飞书登录");
    expect(rows[1]!.textContent).toContain("Celestia 账号");
    // The accessible name rides the row itself (no role override).
    expect(rows[0]!.getAttribute("aria-label")).toBe("飞书登录");
    expect(rows[0]!.getAttribute("role")).toBeNull();
    // The icon renders BEFORE the name (left-mark, right-name).
    const icon = rows[0]!.querySelector(".hk-auth-channel-icon");
    const name = rows[0]!.querySelector(".hk-auth-channel-name");
    expect(icon).not.toBeNull();
    expect(name).not.toBeNull();
    expect((icon as HTMLElement).compareDocumentPosition(name as HTMLElement)
      & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
  });

  it("emits select with the row's key and honors disabled rows", async () => {
    const onSelect = vi.fn();
    const c = mount(
      h(HkAuthChannelList, {
        methods: [
          ...methods,
          { key: "off", label: "Disabled", disabled: true },
        ],
        onSelect,
      }),
    );
    const rows = c.querySelectorAll<HTMLButtonElement>(".hk-auth-channel-row");
    rows[0]!.click();
    await nextTick();
    expect(onSelect).toHaveBeenCalledWith("feishu");
    rows[2]!.click();
    await nextTick();
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("renders a real link for a row with href, and a button without", () => {
    const c = mount(
      h(HkAuthChannelList, {
        methods: [{ key: "celestial", label: "Celestia", href: "/auth/relay/begin" }, ...methods],
      }),
    );
    const rows = c.querySelectorAll<HTMLElement>(".hk-auth-channel-row");
    expect(rows[0]!.tagName).toBe("A");
    // MUT:row-href-dropped (dropping `href` from the anchor leaves a link
    // that goes nowhere — middle-click and crawlers see no target).
    expect(rows[0]!.getAttribute("href")).toBe("/auth/relay/begin");
    expect(rows[0]!.getAttribute("type")).toBeNull();
    // The old default is untouched: no href → a plain button.
    expect(rows[1]!.tagName).toBe("BUTTON");
    expect(rows[1]!.getAttribute("type")).toBe("button");
    expect(rows[1]!.getAttribute("href")).toBeNull();
    // Same classes and inner grammar on both forms.
    expect(rows[0]!.querySelector(".hk-auth-channel-name")?.textContent).toBe("Celestia");
    expect(rows[0]!.getAttribute("aria-label")).toBe("Celestia");
  });

  it("emits select BEFORE following the link and never prevents the navigation", async () => {
    const onSelect = vi.fn();
    const c = mount(
      h(HkAuthChannelList, {
        methods: [{ key: "celestial", label: "Celestia", href: "/auth/relay/begin" }],
        onSelect,
      }),
    );
    const row = c.querySelector<HTMLAnchorElement>("a.hk-auth-channel-row")!;
    const seen: Array<{ called: boolean; prevented: boolean }> = [];
    row.addEventListener("click", (event) => {
      // Runs AFTER the component's own handler (registered first).
      seen.push({ called: onSelect.mock.calls.length > 0, prevented: event.defaultPrevented });
    });
    row.click();
    await nextTick();
    expect(onSelect).toHaveBeenCalledWith("celestial");
    // MUT:row-select-after-nav (deferring the emit, e.g. into a promise,
    // has the browser leave before the host armed its state).
    expect(seen[0]).toEqual({ called: true, prevented: false });
    // MUT:row-href-prevent-default (cancelling the click turns the link
    // into a button again — no new tab, no crawler target).
    expect(seen[0]!.prevented).toBe(false);
  });

  it("a disabled link renders without href and announces aria-disabled", () => {
    const onSelect = vi.fn();
    const c = mount(
      h(HkAuthChannelList, {
        methods: [{ key: "off", label: "Off", href: "/x", disabled: true }],
        onSelect,
      }),
    );
    const row = c.querySelector<HTMLAnchorElement>("a.hk-auth-channel-row")!;
    expect(row.tagName).toBe("A");
    // MUT:row-disabled-href-kept (leaving the href on a disabled link keeps
    // it navigable by keyboard and by middle-click).
    expect(row.hasAttribute("href")).toBe(false);
    // MUT:row-disabled-aria-dropped (without aria-disabled the row looks
    // enabled to assistive tech).
    expect(row.getAttribute("aria-disabled")).toBe("true");
  });
});
