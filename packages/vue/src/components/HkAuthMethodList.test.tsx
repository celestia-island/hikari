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
  for (const popup of [...document.querySelectorAll(".hk-tooltip-popup")]) popup.remove();
});

const methods = [
  { key: "github", label: "GitHub" },
  { key: "linuxdo", label: "LinuxDo" },
];

describe("HkAuthMethodList", () => {
  it("renders centered independent framed tiles with an optional divider", () => {
    // The card's `methods` slot owns the `.s-auth-methods` container —
    // reproduce that context here (the divider and the tile row are layout
    // children of it through the component's display:contents wrapper).
    const c = mount(
      h("div", { class: "s-auth-methods" }, h(HkAuthMethodList, { divider: "其他方式登录", methods })),
    );
    const divider = c.querySelector(".s-auth-methods-divider");
    expect(divider?.textContent).toContain("其他方式登录");
    const tiles = c.querySelectorAll<HTMLButtonElement>(".s-auth-methods .s-auth-methods-tile");
    expect(tiles.length).toBe(2);
    // Icon-only: the label is the accessible name + tooltip, never visible text.
    expect(tiles[0]!.getAttribute("aria-label")).toBe("GitHub");
    expect(tiles[1]!.getAttribute("aria-label")).toBe("LinuxDo");
    expect(tiles[0]!.textContent).not.toContain("GitHub");
  });

  it("never wraps the providers in a button-group track", () => {
    // 2026-09-14 user direction: a shared group frame (one wide bordered
    // track with the icons floating inside) is NOT this component's
    // grammar — every provider is an independent framed tile. A regression
    // back to HkIconButtonGroup (or any .hk-icon-group markup) must fail
    // here, because the button group is reserved for selectors and tight
    // action strips.
    const c = mount(
      h("div", { class: "s-auth-methods" }, h(HkAuthMethodList, { methods })),
    );
    expect(c.querySelector(".s-auth-methods .hk-icon-group")).toBeNull();
    expect(c.querySelector(".s-auth-methods [role='group']")).toBeNull();
    expect(c.querySelector(".s-auth-methods [role='radiogroup']")).toBeNull();
  });

  it("wraps every tile in a tooltip carrying the provider label", () => {
    const c = mount(
      h("div", { class: "s-auth-methods" }, h(HkAuthMethodList, { methods })),
    );
    const wrappers = c.querySelectorAll(".hk-tooltip-wrapper");
    expect(wrappers.length).toBe(2);
    // The teleported popups exist with the label text (hidden until hover).
    const popups = [...document.querySelectorAll(".hk-tooltip-popup .hk-tooltip-content")]
      .map((el) => el.textContent);
    expect(popups).toContain("GitHub");
    expect(popups).toContain("LinuxDo");
  });

  it("emits select with the method key on click", async () => {
    const picked: string[] = [];
    const c = mount(
      h("div", { class: "s-auth-methods" }, h(HkAuthMethodList, {
        methods,
        onSelect: (key: string) => {
          picked.push(key);
        },
      })),
    );
    const tiles = c.querySelectorAll<HTMLButtonElement>(".s-auth-methods .s-auth-methods-tile");
    tiles[1]!.click();
    await nextTick();
    // Both rows are asserted so a constant-literal emit cannot ride an
    // accidental fixture coincidence.
    tiles[0]!.click();
    await nextTick();
    expect(picked).toEqual(["linuxdo", "github"]);
  });

  it("renders the icon vnode and honors disabled entries", async () => {
    let picked = "";
    const c = mount(
      h("div", { class: "s-auth-methods" }, h(HkAuthMethodList, {
        methods: [
          { key: "gh", label: "GitHub", icon: h("span", { class: "brand-gh" }) },
          { key: "ld", label: "LinuxDo", disabled: true },
          { key: "fs", label: "Feishu" },
        ],
        onSelect: (key: string) => {
          picked = key;
        },
      })),
    );
    const tiles = c.querySelectorAll<HTMLButtonElement>(".s-auth-methods .s-auth-methods-tile");
    expect(tiles.length).toBe(3);
    // The prebuilt brand vnode renders inside the icon box.
    expect(tiles[0]!.querySelector(".brand-gh")).toBeTruthy();
    // A missing icon falls back to the label initial (never an empty box).
    expect(tiles[2]!.querySelector<HTMLElement>(".s-auth-methods-tile-initial")?.textContent).toBe("F");
    // Disabled entries render dead and swallow clicks.
    expect(tiles[1]!.disabled).toBe(true);
    tiles[1]!.click();
    await nextTick();
    expect(picked).toBe("");
  });
});
