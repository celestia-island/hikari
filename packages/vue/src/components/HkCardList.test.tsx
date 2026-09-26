import { afterEach, describe, expect, it } from "vitest";
import { createApp, defineComponent, h } from "vue";

import { HkCardList, HkListRow } from "./HkCardList";

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

const FakeIcon = defineComponent({
  name: "FakeIcon",
  props: { size: { type: [Number, String], default: 24 } },
  setup: (props) => () => h("svg", { "data-fake-icon": "", width: props.size, height: props.size }),
});

describe("HkCardList", () => {
  it("renders rows inside an unpadded card list landmark", () => {
    const c = mount(
      h(HkCardList, () => h(HkListRow, { title: "A" })),
    );
    expect(c.querySelector(".hk-card")).toBeTruthy();
    expect(c.querySelector(".hk-card-body-unpadded")).toBeTruthy();
    const list = c.querySelector(".hk-card-list") as HTMLElement;
    expect(list.getAttribute("role")).toBe("list");
    expect(list.querySelectorAll(".hk-list-row")).toHaveLength(1);
  });

  it("renders the empty slot instead of the list when provided without rows", () => {
    const c = mount(h(HkCardList, null, { empty: () => h("p", { class: "probe-empty" }, "empty") }));
    expect(c.querySelector(".hk-card-list")).toBeNull();
    expect(c.querySelector(".probe-empty")?.textContent).toBe("empty");
  });
});

describe("HkListRow", () => {
  it("renders icon chip, title, subtitle and the trailing slot", () => {
    const c = mount(
      h(HkListRow, { icon: FakeIcon, iconTone: "success", title: "gpu-1", subtitle: "192.168.2.10" }, {
        trailing: () => h("span", { class: "probe-badge" }, "online"),
      }),
    );
    const row = c.querySelector(".hk-list-row") as HTMLElement;
    expect(row.getAttribute("role")).toBe("listitem");
    expect(row.querySelector(".hk-icon-chip-tone-success svg[data-fake-icon]")).toBeTruthy();
    expect(row.querySelector(".hk-list-row-title")?.textContent).toBe("gpu-1");
    expect(row.querySelector(".hk-list-row-subtitle")?.textContent).toBe("192.168.2.10");
    expect(row.querySelector(".hk-list-row-trailing .probe-badge")?.textContent).toBe("online");
  });

  it("keeps the default slot beside title/subtitle inside the main column", () => {
    const c = mount(
      h(HkListRow, { title: "T" }, { default: () => h("div", { class: "probe-extra" }, "extra") }),
    );
    expect(c.querySelector(".hk-list-row-main .probe-extra")).toBeTruthy();
  });

  it("activates on Enter/Space when clickable, ignoring bubbled keys", async () => {
    const clicks: string[] = [];
    const c = mount(
      h(HkListRow, {
        title: "T",
        clickable: true,
        onClick: (e: MouseEvent | KeyboardEvent) => clicks.push("key" in e ? e.key : "mouse"),
      }),
    );
    const row = c.querySelector(".hk-list-row") as HTMLElement;
    expect(row.getAttribute("tabindex")).toBe("0");
    for (const key of ["Enter", " "]) {
      row.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
      await Promise.resolve();
    }
    expect(clicks).toEqual(["Enter", " "]);
  });

  it("is not interactive without clickable", () => {
    const c = mount(h(HkListRow, { title: "T" }));
    const row = c.querySelector(".hk-list-row") as HTMLElement;
    expect(row.className).not.toContain("hk-list-row-clickable");
    expect(row.getAttribute("tabindex")).toBeNull();
  });
});
