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

  it("renders an optional divider above the rows", () => {
    const c = mount(h(HkAuthChannelList, { divider: "或", methods }));
    expect(c.querySelector(".hk-auth-channel-divider")?.textContent).toContain("或");
  });
});
