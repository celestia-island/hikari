import { afterEach, describe, expect, it } from "vitest";
import { createApp, defineComponent, h, nextTick, ref } from "vue";

import HkPopover from "./HkPopover";

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
  // Restore a desktop viewport between tests.
  setViewport(1200);
});

function setViewport(width: number) {
  window.innerWidth = width;
  window.dispatchEvent(new Event("resize"));
}

function mountPopover(props: Record<string, unknown> = {}) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  containers.push(container);

  const anchor = document.createElement("button");
  anchor.textContent = "anchor";
  container.appendChild(anchor);

  const open = ref(true);
  const Wrapper = defineComponent({
    setup() {
      return () =>
        h(HkPopover, {
          modelValue: open.value,
          "onUpdate:modelValue": (v: boolean) => { open.value = v; },
          anchorRef: anchor,
          ...props,
        }, { default: () => h("div", { class: "pop-content" }, "content") });
    },
  });
  const app = createApp(Wrapper);
  mounts.push(app);
  app.mount(container);
  return { open };
}

describe("HkPopover sheetOnMobile", () => {
  it("docks as a bottom sheet with a closing scrim on mobile widths", async () => {
    setViewport(375);
    const { open } = mountPopover({ sheetOnMobile: true });
    await nextTick();

    const panel = document.body.querySelector<HTMLElement>(".hk-popover-panel")!;
    expect(panel).toBeTruthy();
    expect(panel.classList.contains("hk-is-sheet")).toBe(true);
    expect(panel.getAttribute("aria-modal")).toBe("true");
    // Grabber affordance present.
    expect(panel.querySelector(".hk-popover-sheet-grabber")).toBeTruthy();
    // Real, clickable scrim (unlike the desktop visual backdrop).
    const scrim = document.body.querySelector<HTMLElement>(".hk-popover-scrim")!;
    expect(scrim).toBeTruthy();
    scrim.click();
    await nextTick();
    expect(open.value).toBe(false);
  });

  it("keeps the anchored popup (no scrim) on desktop widths", async () => {
    setViewport(1200);
    mountPopover({ sheetOnMobile: true });
    await nextTick();

    const panel = document.body.querySelector<HTMLElement>(".hk-popover-panel")!;
    expect(panel.classList.contains("hk-is-sheet")).toBe(false);
    // Anchored placement class instead of the sheet class.
    expect(panel.className).toMatch(/hk-popover-(top|bottom|left|right)/);
    expect(document.body.querySelector(".hk-popover-scrim")).toBeNull();
  });

  it("closes an open popover when the viewport crosses the breakpoint", async () => {
    setViewport(375);
    const { open } = mountPopover({ sheetOnMobile: true });
    await nextTick();
    expect(open.value).toBe(true);

    setViewport(1200);
    await nextTick();
    expect(open.value).toBe(false);
  });

  it("stays anchored on mobile when sheetOnMobile is off", async () => {
    setViewport(375);
    mountPopover();
    await nextTick();

    const panel = document.body.querySelector<HTMLElement>(".hk-popover-panel")!;
    expect(panel.classList.contains("hk-is-sheet")).toBe(false);
    expect(document.body.querySelector(".hk-popover-scrim")).toBeNull();
  });

  it("does NOT close a non-opted-in popover on breakpoint cross (date pickers etc.)", async () => {
    setViewport(1200);
    const { open } = mountPopover();
    await nextTick();
    expect(open.value).toBe(true);

    // A consumer that never set sheetOnMobile keeps the historic
    // behavior: stay open across the breakpoint (it just repositions).
    setViewport(375);
    await nextTick();
    expect(open.value).toBe(true);
    setViewport(1200);
    await nextTick();
    expect(open.value).toBe(true);
  });

  it("omits the scrim when closeOnBackdrop is false in sheet mode", async () => {
    setViewport(375);
    mountPopover({ sheetOnMobile: true, closeOnBackdrop: false });
    await nextTick();
    expect(document.body.querySelector(".hk-popover-panel")!.classList.contains("hk-is-sheet")).toBe(true);
    expect(document.body.querySelector(".hk-popover-scrim")).toBeNull();
  });
});
