import { afterEach, describe, expect, it } from "vitest";
import { createApp, defineComponent, h } from "vue";

import { HkIconChip } from "./HkIconChip";

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

describe("HkIconChip", () => {
  it("renders the icon at the md box size by default", () => {
    const c = mount(h(HkIconChip, { icon: FakeIcon }));
    const chip = c.querySelector(".hk-icon-chip") as HTMLElement;
    expect(chip).toBeTruthy();
    expect(chip.className).toContain("hk-icon-chip-md");
    expect(chip.className).toContain("hk-icon-chip-tone-primary");
    expect(chip.getAttribute("aria-hidden")).toBe("true");
    expect(chip.querySelector("svg[data-fake-icon]")?.getAttribute("width")).toBe("15");
  });

  it("renders the sm box with a 13px glyph", () => {
    const c = mount(h(HkIconChip, { icon: FakeIcon, size: "sm" }));
    const chip = c.querySelector(".hk-icon-chip") as HTMLElement;
    expect(chip.className).toContain("hk-icon-chip-sm");
    expect(chip.querySelector("svg[data-fake-icon]")?.getAttribute("width")).toBe("13");
  });

  it("carries the tone class for every palette entry", () => {
    for (const tone of ["success", "warning", "error", "info", "primary", "muted"] as const) {
      const c = mount(h(HkIconChip, { icon: FakeIcon, tone }));
      expect((c.querySelector(".hk-icon-chip") as HTMLElement).className).toContain(
        `hk-icon-chip-tone-${tone}`,
      );
    }
  });
});
