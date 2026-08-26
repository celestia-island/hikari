import { afterEach, describe, expect, it } from "vitest";
import { createApp, h, nextTick } from "vue";

import HkAltSignIn from "./HkAltSignIn";

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

const entries = [
  { key: "passkey", label: "使用 passkey 登录" },
  { key: "feishu", label: "飞书登录" },
];

function trigger(c: HTMLElement): HTMLButtonElement {
  const el = c.querySelector<HTMLButtonElement>(".hk-alt-signin__trigger");
  if (!el) throw new Error("trigger button not rendered");
  return el;
}

describe("HkAltSignIn", () => {
  it("renders the trigger label and decorative rules", () => {
    const c = mount(
      h(HkAltSignIn, {
        label: "其他方式登录",
        entries,
        onSelect: () => undefined,
      }),
    );
    expect(trigger(c).textContent).toContain("其他方式登录");
    expect(c.querySelectorAll(".hk-alt-signin__rule").length).toBe(2);
  });

  it("opens the entry panel and emits select with the entry key", async () => {
    const selected: string[] = [];
    const c = mount(
      h(HkAltSignIn, {
        label: "更多",
        entries,
        onSelect: (k: string) => selected.push(k),
      }),
    );
    trigger(c).click();
    // The popover manager + flip coords resolve over a couple of frames.
    for (let i = 0; i < 5 && !document.querySelector(".hk-alt-signin__panel"); i++) {
      await nextTick();
      await new Promise((r) => setTimeout(r, 10));
    }
    const panel = document.querySelector(".hk-alt-signin__panel");
    expect(panel).not.toBeNull();
    const items = [...document.querySelectorAll<HTMLButtonElement>(".hk-menu-action-item")];
    expect(items.map((b) => b.textContent?.trim())).toEqual([
      "使用 passkey 登录",
      "飞书登录",
    ]);
    items[1]!.click();
    expect(selected).toEqual(["feishu"]);
  });

  it("does not open while disabled", async () => {
    const c = mount(
      h(HkAltSignIn, {
        label: "更多",
        entries,
        disabled: true,
        onSelect: () => undefined,
      }),
    );
    trigger(c).click();
    await nextTick();
    expect(trigger(c).disabled).toBe(true);
    expect(c.querySelector(".hk-alt-signin__panel")).toBeNull();
  });
});
