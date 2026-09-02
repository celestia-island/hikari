import { afterEach, describe, expect, it } from "vitest";
import { createApp, h, nextTick } from "vue";

import HkAuthMethodList from "./HkAuthMethodList";

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
  { key: "github", label: "GitHub" },
  { key: "linuxdo", label: "LinuxDo" },
];

describe("HkAuthMethodList", () => {
  it("renders one fixed-column button per method and an optional divider", () => {
    // The card's `methods` slot owns the `.s-auth-methods` container —
    // reproduce that context here (the component itself is a fragment).
    const c = mount(
      h("div", { class: "s-auth-methods" }, h(HkAuthMethodList, { divider: "其他方式登录", methods })),
    );
    const divider = c.querySelector(".s-auth-methods-divider");
    expect(divider?.textContent).toContain("其他方式登录");
    const buttons = c.querySelectorAll<HTMLButtonElement>(".s-auth-methods > .hk-btn");
    expect(buttons.length).toBe(2);
    const labels = [...buttons].map(
      (b) => b.querySelector<HTMLElement>(".s-auth-methods-label")?.textContent,
    );
    expect(labels).toEqual(["GitHub", "LinuxDo"]);
    for (const b of buttons) {
      expect(b.querySelector(".s-auth-methods-icon")).toBeTruthy();
      expect(b.classList.contains("hk-btn-block")).toBe(true);
    }
  });

  it("emits select with the method key on click", async () => {
    let picked = "";
    const c = mount(
      h("div", { class: "s-auth-methods" }, h(HkAuthMethodList, {
        methods,
        onSelect: (key: string) => {
          picked = key;
        },
      })),
    );
    const buttons = c.querySelectorAll<HTMLButtonElement>(".s-auth-methods > .hk-btn");
    buttons[1]!.click();
    await nextTick();
    expect(picked).toBe("linuxdo");
  });
});
