import { afterEach, describe, expect, it } from "vitest";
import { createApp, h, nextTick } from "vue";

import HkPopover from "./HkPopover";

const mounts: Array<{ app: ReturnType<typeof createApp>; container: HTMLElement }> = [];

afterEach(() => {
  for (const { app, container } of mounts.splice(0)) {
    app.unmount();
    container.remove();
  }
  document.body.querySelectorAll(".hk-popover-panel").forEach((el) => el.remove());
});

describe("HkPopover panel hover intent", () => {
  it("emits from the whole panel, including padding outside the slot content", async () => {
    const events: string[] = [];
    const container = document.createElement("div");
    document.body.appendChild(container);
    const app = createApp({
      render: () => h(
        HkPopover as never,
        {
          modelValue: true,
          title: "hover probe",
          onMouseenter: () => events.push("enter"),
          onMouseleave: () => events.push("leave"),
        },
        () => h("div", { class: "probe-body" }, "content"),
      ),
    });
    app.mount(container);
    mounts.push({ app, container });
    await nextTick();
    const panel = document.body.querySelector<HTMLElement>(".hk-popover-panel")!;
    expect(panel).not.toBeNull();
    panel.dispatchEvent(new MouseEvent("mouseenter"));
    panel.dispatchEvent(new MouseEvent("mouseleave"));
    expect(events).toEqual(["enter", "leave"]);
  });
});
