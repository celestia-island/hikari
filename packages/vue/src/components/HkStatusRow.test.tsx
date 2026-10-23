import { afterEach, describe, expect, it } from "vitest";
import { createApp, defineComponent, h, type App } from "vue";

import HkStatusRow from "./HkStatusRow";

const containers: HTMLElement[] = [];

function mountRow(props: Record<string, unknown>, slots: Record<string, () => unknown> = {}): {
  app: App;
  container: HTMLElement;
} {
  const container = document.createElement("div");
  document.body.appendChild(container);
  containers.push(container);
  const Wrapper = defineComponent({
    render: () =>
      h(HkStatusRow as never, props, slots),
  });
  const app = createApp(Wrapper);
  app.mount(container);
  return { app, container };
}

afterEach(() => {
  for (const c of containers.splice(0)) c.remove();
});

describe("HkStatusRow (the standard status-card anatomy)", () => {
  it("renders title, status, chip and action slots", () => {
    const t = mountRow(
      { title: "evernight", status: "detected" },
      { icon: () => h("i"), action: () => h("button", "register") },
    );
    expect(t.container.querySelector(".hk-status-row__title")?.textContent).toBe("evernight");
    expect(t.container.querySelector(".hk-status-row__status")?.textContent).toBe("detected");
    expect(t.container.querySelector(".hk-status-row__chip")).not.toBeNull();
    expect(t.container.querySelector(".hk-status-row__action button")?.textContent).toBe("register");
    t.app.unmount();
  });

  it("maps the tone onto the modifier class", () => {
    const t = mountRow({ title: "x", tone: "warning" });
    expect(t.container.querySelector(".hk-status-row--warning")).not.toBeNull();
    t.app.unmount();
  });

  it("defaults to neutral", () => {
    const t = mountRow({ title: "x" });
    expect(t.container.querySelector(".hk-status-row--neutral")).not.toBeNull();
    t.app.unmount();
  });

  it("absent renders the dashed quiet variant", () => {
    const t = mountRow({ title: "x", absent: true });
    expect(t.container.querySelector(".hk-status-row--absent")).not.toBeNull();
    t.app.unmount();
  });

  it("omits the status line when empty and the action zone without a slot", () => {
    const t = mountRow({ title: "x" });
    expect(t.container.querySelector(".hk-status-row__status")).toBeNull();
    expect(t.container.querySelector(".hk-status-row__action")).toBeNull();
    t.app.unmount();
  });
});
