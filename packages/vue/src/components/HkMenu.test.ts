import { afterEach, describe, expect, it } from "vitest";
import { createApp, defineComponent, h, nextTick, ref } from "vue";

import HkMenu, { type HkMenuItem } from "./HkMenu";

const mounts: ReturnType<typeof createApp>[] = [];
const containers: HTMLElement[] = [];

const items: HkMenuItem[] = [
  {
    key: "lang",
    label: "Language",
    children: [
      { key: "en", label: "English", flag: "🇬🇧" },
      { key: "zh", label: "中文", flag: "🇨🇳", checked: true },
    ],
  },
  { key: "logout", label: "Log out", danger: true },
];

function mountMenu(openRef = ref(true)): HTMLElement {
  const container = document.createElement("div");
  document.body.appendChild(container);
  containers.push(container);
  const Wrapper = defineComponent({
    setup() {
      return () =>
        h(HkMenu, {
          open: openRef.value,
          title: "Menu",
          items,
          onUpdate: () => {},
        });
    },
  });
  const app = createApp(Wrapper);
  mounts.push(app);
  app.mount(container);
  return container;
}

afterEach(() => {
  while (mounts.length) mounts.pop()?.unmount();
  while (containers.length) containers.pop()?.remove();
});

describe("HkMenu", () => {
  it("renders the root rows when open and nothing when closed", () => {
    const c = mountMenu(ref(false));
    expect(c.textContent ?? "").toBe("");
    const c2 = mountMenu(ref(true));
    expect(c2.textContent ?? "").toContain("Language");
    expect(c2.textContent ?? "").toContain("Log out");
  });

  it("cascades into children on the desktop path and emits select on leaves", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    containers.push(container);
    const selected: string[] = [];
    const closes: boolean[] = [];
    const openRef = ref(true);
    const Wrapper = defineComponent({
      setup() {
        return () =>
          h(HkMenu, {
            open: openRef.value,
            title: "Menu",
            items,
            onSelect: (key: string) => selected.push(key),
            "onUpdate:open": (v: boolean) => { closes.push(v); openRef.value = v; },
          });
      },
    });
    const app = createApp(Wrapper);
    mounts.push(app);
    app.mount(container);
    await nextTick();

    const rows = Array.from(container.querySelectorAll(".hk-menu-row")) as HTMLButtonElement[];
    rows.find((r) => r.textContent?.includes("Language"))!.click();
    await nextTick();
    const panels = Array.from(container.querySelectorAll(".hk-menu-panel"));
    expect(panels.length).toBe(2);
    expect(panels[1].textContent).toContain("中文");

    const leaf = Array.from(panels[1].querySelectorAll(".hk-menu-row")).find(
      (r) => r.textContent?.includes("中文"),
    ) as HTMLButtonElement;
    leaf.click();
    await nextTick();
    expect(selected).toEqual(["zh"]);
    expect(closes.at(-1)).toBe(false);
  });
});
