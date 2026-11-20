import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h, nextTick, ref } from "vue";

const confirmSpy = vi.fn();
const cancelSpy = vi.fn();

vi.mock("../runtime/animationBus", () => ({
  onFrame: vi.fn(() => ({ disconnect: vi.fn() })),
  reportTransition: vi.fn(() => ({ disconnect: vi.fn() })),
}));

// HkModal is stubbed: this suite pins the WINDOW's wiring (open state,
// slot message, gate presence), not the modal chrome (covered upstream).
vi.mock("./HkModal", () => ({
  default: defineComponent({
    name: "HkModal",
    props: { modelValue: { type: Boolean, default: false }, title: { type: String, default: "" } },
    setup(props, { slots }) {
      return () =>
        props.modelValue
          ? h("div", { class: "delwin-stub" }, [
              h("div", { class: "delwin-stub-title" }, props.title),
              slots.default?.(),
            ])
          : null;
    },
  }),
}));

import HkDeleteGateWindow from "./HkDeleteGateWindow";

const mounts: Array<{ app: ReturnType<typeof createApp>; container: HTMLElement }> = [];

function mountWindow(slotHtml: string, props: Record<string, unknown> = {}) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const Harness = defineComponent({
    setup() {
      return () =>
        h(HkDeleteGateWindow, {
          open: true,
          title: "删除工作区",
          label: "此工作区",
          grabHint: "grab",
          trackingHint: "keep going",
          onConfirm: () => confirmSpy(),
          onCancel: (p: number) => cancelSpy(p),
          ...props,
        }, {
          default: () => h("div", {
            class: "hk-delete-gate-message",
            innerHTML: slotHtml,
          }),
        });
    },
  });
  const app = createApp(Harness);
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

describe("HkDeleteGateWindow", () => {
  it("renders the slot message, the title and the gate inside the window", () => {
    const c = mountWindow(
      '<span class="hk-delete-fact"><span class="hk-delete-fact-label">名称</span><span class="hk-delete-fact-value">ml-lab</span></span>',
    );
    expect(c.querySelector(".delwin-stub-title")!.textContent).toBe("删除工作区");
    expect(c.querySelector(".hk-delete-gate-message .hk-delete-fact")!.textContent).toContain("ml-lab");
    expect(c.querySelector(".hk-serpentine")).toBeTruthy();
  });

  it("renders closed when open=false", () => {
    const c = mountWindow("<p>msg</p>", { open: false });
    expect(c.querySelector(".hk-serpentine")).toBeNull();
    expect(c.querySelector(".delwin-stub")).toBeNull();
  });

  it("passes a higher turn range through to the lane (sensitive deletes walk more)", () => {
    const c = mountWindow("<p>msg</p>", { turns: [7, 9], seed: 42 });
    const lane = c.querySelector(".hk-serpentine-lane") as SVGElement;
    const corners = lane.getAttribute("points")!.split(" ").length - 2;
    expect(corners).toBeGreaterThanOrEqual(7);
  });

  it("closes itself after the gate confirms and forwards the walk events", async () => {
    // The gate inside the window is the REAL component; walk it to the goal
    // and release: the window must emit confirm (the parent performs the
    // delete) AND close itself (update:open=false). A short release must
    // NOT close — it only emits cancel with the progress.
    const onUpdate = vi.fn();
    const c = mountWindow("<p>msg</p>", {
      "onUpdate:open": onUpdate,
      seed: 42,
      onConfirm: () => confirmSpy(),
      onCancel: (p: number) => cancelSpy(p),
    });
    const el = c.querySelector(".hk-serpentine")!;
    const down = new PointerEvent("pointerdown", { bubbles: true, clientX: 24, clientY: 48, pointerId: 1 });
    el.dispatchEvent(down);
    // Mid-lane release: cancel only.
    const mid = new PointerEvent("pointermove", { bubbles: true, clientX: 300, clientY: 48, pointerId: 1 });
    el.dispatchEvent(mid);
    const up = new PointerEvent("pointerup", { bubbles: true, clientX: 300, clientY: 48, pointerId: 1 });
    el.dispatchEvent(up);
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(cancelSpy).toHaveBeenCalled();
    expect(onUpdate).not.toHaveBeenCalled(); // stays open
    // Re-open state is already open; a full walk then confirms and closes.
    el.dispatchEvent(down);
    for (let x = 30; x <= 600; x += 10) {
      el.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, clientX: x, clientY: 48, pointerId: 1 }));
    }
    el.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, clientX: 600, clientY: 48, pointerId: 1 }));
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(onUpdate).toHaveBeenCalledWith(false);
  });

  it("key facts carry the emphasis classes", () => {
    const c = mountWindow(
      '<span class="hk-delete-fact"><span class="hk-delete-fact-label">所有者</span><span class="hk-delete-fact-value">demiurge</span></span>',
    );
    expect(c.querySelector(".hk-delete-fact-label")!.textContent).toBe("所有者");
    expect(c.querySelector(".hk-delete-fact-value")!.textContent).toBe("demiurge");
  });
});
