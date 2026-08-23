import { afterEach, describe, expect, it } from "vitest";
import { createApp, defineComponent, h, nextTick, ref } from "vue";

import HkSelect from "./HkSelect";

const mounts: ReturnType<typeof createApp>[] = [];
const containers: HTMLElement[] = [];

afterEach(() => {
  for (const app of mounts.splice(0)) app.unmount();
  for (const el of containers.splice(0)) el.remove();
  // happy-dom never fires transitionend, so leave transitions never
  // finish and teleported panels linger on <body> — strip them or the
  // next test's querySelector sees this test's panel.
  document.body
    .querySelectorAll(".hk-popover-panel, .hk-popover-scrim, .hk-select-sheet-panel, .hk-select-sheet-scrim")
    .forEach((el) => el.remove());
  setViewport(1200);
});

function setViewport(width: number) {
  window.innerWidth = width;
  window.dispatchEvent(new Event("resize"));
}

function mountSelect(props: Record<string, unknown> = {}) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  containers.push(container);

  const value = ref("a");
  const Wrapper = defineComponent({
    setup() {
      return () =>
        h(HkSelect, {
          modelValue: value.value,
          "onUpdate:modelValue": (v: string) => { value.value = v; },
          label: "Channel",
          options: [
            { value: "a", label: "Alpha" },
            { value: "b", label: "Beta" },
            { value: "c", label: "Gamma" },
          ],
          ...props,
        });
    },
  });
  const app = createApp(Wrapper);
  mounts.push(app);
  app.mount(container);
  return { value, container };
}

describe("HkSelect mobile sheet", () => {
  it("opens as a bottom sheet on mobile widths", async () => {
    setViewport(375);
    const { container } = mountSelect();
    await nextTick();

    container.querySelector<HTMLButtonElement>(".hk-select-trigger")!.click();
    await nextTick();

    const panel = document.body.querySelector<HTMLElement>(".hk-select-sheet-panel")!;
    expect(panel).toBeTruthy();
    expect(panel.getAttribute("aria-modal")).toBe("true");
    // Label surfaces as the sheet title.
    expect(panel.querySelector(".hk-select-sheet-title")!.textContent).toBe("Channel");
    // Options render with touch-sized rows inside the sheet list.
    const options = panel.querySelectorAll(".hk-select-option");
    expect(options).toHaveLength(3);
    expect(document.body.querySelector(".hk-select-sheet-scrim")).toBeTruthy();
    // No anchored popout in sheet mode.
    expect(document.body.querySelector(".hk-select-popout")).toBeNull();
  });

  it("selects from the sheet and closes it", async () => {
    setViewport(375);
    const { value, container } = mountSelect();
    await nextTick();

    container.querySelector<HTMLButtonElement>(".hk-select-trigger")!.click();
    await nextTick();

    const options = document.body.querySelectorAll<HTMLElement>(".hk-select-sheet-panel .hk-select-option");
    options[2].click();
    await nextTick();
    expect(value.value).toBe("c");
    // happy-dom never finishes leave transitions, so the panel element can
    // outlive the close — assert the reactive state instead (the trigger's
    // data-state mirrors isOpen).
    expect(container.querySelector<HTMLElement>(".hk-select-trigger")!.dataset.state).toBe("closed");
  });

  it("closes the sheet via the scrim", async () => {
    setViewport(375);
    const { container } = mountSelect();
    await nextTick();

    container.querySelector<HTMLButtonElement>(".hk-select-trigger")!.click();
    await nextTick();
    (document.body.querySelector<HTMLElement>(".hk-select-sheet-scrim"))!.click();
    await nextTick();
    expect(container.querySelector<HTMLElement>(".hk-select-trigger")!.dataset.state).toBe("closed");
  });

  it("keeps the anchored popout on desktop widths", async () => {
    setViewport(1200);
    const { container } = mountSelect();
    await nextTick();

    container.querySelector<HTMLButtonElement>(".hk-select-trigger")!.click();
    await nextTick();

    expect(document.body.querySelector(".hk-select-popout")).toBeTruthy();
    expect(document.body.querySelector(".hk-select-sheet-panel")).toBeNull();
  });

  it("closes an open sheet when the viewport crosses the breakpoint", async () => {
    setViewport(375);
    const { container } = mountSelect();
    await nextTick();

    container.querySelector<HTMLButtonElement>(".hk-select-trigger")!.click();
    await nextTick();
    expect(document.body.querySelector(".hk-select-sheet-panel")).toBeTruthy();

    setViewport(1200);
    await nextTick();
    expect(container.querySelector<HTMLElement>(".hk-select-trigger")!.dataset.state).toBe("closed");
    expect(document.body.querySelector(".hk-select-popout")).toBeNull();
  });
});
