import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h, nextTick, ref } from "vue";

import HkModal from "./HkModal";
import { closeAll } from "../runtime/useOverlay";

const mounts: ReturnType<typeof createApp>[] = [];
const containers: HTMLElement[] = [];

afterEach(async () => {
  for (const app of mounts.splice(0)) app.unmount();
  for (const el of containers.splice(0)) el.remove();
});

describe("HkModal overlay integration", () => {
  it("closeAll() closes an open closable modal through its update:modelValue", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    containers.push(container);

    const open = ref(true);
    const emitted: boolean[] = [];
    const Wrapper = defineComponent({
      setup() {
        return () =>
          h(HkModal, {
            modelValue: open.value,
            closable: true,
            "onUpdate:modelValue": (v: boolean) => { emitted.push(v); open.value = v; },
          }, { default: () => h("div", "content") });
      },
    });
    const app = createApp(Wrapper);
    mounts.push(app);
    app.mount(container);
    await nextTick();

    closeAll();
    await nextTick();
    expect(emitted).toEqual([false]);
  });

  it("closeAll() leaves a non-closable modal alone", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    containers.push(container);

    const open = ref(true);
    const emitted: boolean[] = [];
    const Wrapper = defineComponent({
      setup() {
        return () =>
          h(HkModal, {
            modelValue: open.value,
            closable: false,
            "onUpdate:modelValue": (v: boolean) => { emitted.push(v); open.value = v; },
          }, { default: () => h("div", "content") });
      },
    });
    const app = createApp(Wrapper);
    mounts.push(app);
    app.mount(container);
    await nextTick();

    closeAll();
    await nextTick();
    expect(emitted).toEqual([]);
  });
});

describe("HkModal back-guard (window-first back priority)", () => {
  async function settle(): Promise<void> {
    await nextTick();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await nextTick();
  }

  /** Wait until pred() holds (history navigation settles asynchronously). */
  async function until(pred: () => boolean, ms = 500): Promise<void> {
    const deadline = Date.now() + ms;
    while (!pred() && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 10));
      await nextTick();
    }
  }

  it("pushes a history entry on open and back closes the modal, not the page", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    containers.push(container);

    const open = ref(true);
    const Wrapper = defineComponent({
      setup() {
        return () =>
          h(HkModal, {
            modelValue: open.value,
            closable: true,
            "onUpdate:modelValue": (v: boolean) => { open.value = v; },
          }, { default: () => h("div", "content") });
      },
    });
    const app = createApp(Wrapper);
    mounts.push(app);
    app.mount(container);
    await settle();

    // The open modal owns one marked history entry above the page base.
    expect((window.history.state as Record<string, unknown>)?.__hkBack).toEqual(expect.any(String));

    // Browser/system back: closes the modal and stays on the page.
    // (happy-dom never fires transition end events, so the leave
    // animation keeps the DOM node — the logical state is what matters.)
    window.history.back();
    await until(() => open.value === false);
    await until(() => window.history.state === null);
    app.unmount();
  });

  it("closing via the X button rewinds the pushed entry (no dead back)", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    containers.push(container);

    const open = ref(true);
    const Wrapper = defineComponent({
      setup() {
        return () =>
          h(HkModal, {
            modelValue: open.value,
            closable: true,
            "onUpdate:modelValue": (v: boolean) => { open.value = v; },
          }, { default: () => h("div", "content") });
      },
    });
    const app = createApp(Wrapper);
    mounts.push(app);
    app.mount(container);
    await settle();
    expect((window.history.state as Record<string, unknown>)?.__hkBack).toEqual(expect.any(String));

    (document.querySelector(".hk-modal-close") as HTMLButtonElement).click();
    await until(() => open.value === false);
    // History rewound to the page base — a subsequent back leaves the page,
    // it is not consumed by a spent modal entry.
    await until(() => window.history.state === null);
    app.unmount();
  });

  it("a non-closable modal never owns history", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    containers.push(container);

    const open = ref(true);
    const Wrapper = defineComponent({
      setup() {
        return () =>
          h(HkModal, {
            modelValue: open.value,
            closable: false,
            "onUpdate:modelValue": (v: boolean) => { open.value = v; },
          }, { default: () => h("div", "content") });
      },
    });
    const app = createApp(Wrapper);
    mounts.push(app);
    app.mount(container);
    await settle();

    expect((window.history.state as Record<string, unknown>)?.__hkBack).toBeUndefined();
    app.unmount();
  });
});

describe("HkModal autoFollow", () => {
  const SCROLL_H = 1000;
  const CLIENT_H = 300;
  /** scrollTop that leaves exactly 200px hidden below the fold. */
  const CANCEL_TOP = SCROLL_H - CLIENT_H - 200;
  /** Bottom-anchored scrollTop (distance to bottom = 0). */
  const BOTTOM_TOP = SCROLL_H - CLIENT_H;

  async function until(pred: () => boolean, ms = 1500): Promise<void> {
    await vi.waitFor(() => {
      if (!pred()) throw new Error("condition not met yet");
    }, { timeout: ms, interval: 10 });
  }

  interface Setup {
    scroller: HTMLElement;
    tag: () => Element | null;
    jump: () => HTMLButtonElement | null;
  }

  function stubGeometry(el: HTMLElement) {
    for (const [key, value] of [
      ["scrollHeight", SCROLL_H],
      ["clientHeight", CLIENT_H],
    ] as const) {
      Object.defineProperty(el, key, { configurable: true, value });
    }
  }

  /** Mount an open autoFollow modal and return its scroll container.
   *  Geometry stubs land BEFORE the enter transition finishes so the
   *  follow setup sees them; a first scroll pass makes the tag appear. */
  async function mountAutoFollow(): Promise<Setup> {
    const container = document.createElement("div");
    document.body.appendChild(container);
    containers.push(container);

    const Wrapper = defineComponent({
      setup() {
        return () =>
          h(HkModal, {
            modelValue: true,
            autoFollow: true,
          }, { default: () => h("p", { class: "follow-line" }, "log line") });
      },
    });
    const app = createApp(Wrapper);
    mounts.push(app);
    app.mount(container);
    await nextTick();

    const scroller = document.body.querySelector<HTMLElement>(".hk-modal-body-scroll");
    if (!scroller) throw new Error("scroller not rendered");
    stubGeometry(scroller);

    // onAfterEnter wires setupAutoFollow; poll instead of assuming when
    // the Transition hook fires under happy-dom. One synthetic scroll
    // makes the initial overflow sense deterministic whenever it runs.
    await until(() => {
      scroller.dispatchEvent(new Event("scroll"));
      return document.body.querySelector(".hk-modal-autofollow-tag") !== null;
    });

    return {
      scroller,
      tag: () => document.body.querySelector(".hk-modal-autofollow-tag"),
      jump: () => document.body.querySelector<HTMLButtonElement>(".hk-modal-jump .hk-fab-button"),
    };
  }

  async function flush(): Promise<void> {
    await nextTick();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await nextTick();
  }

  it("streaming-style pinning never cancels follow", async () => {
    const s = await mountAutoFollow();
    expect(s.tag()).not.toBeNull();
    expect(s.jump()).toBeNull();

    // MutationObserver path: append content while pinned at bottom.
    s.scroller.scrollTop = BOTTOM_TOP;
    const inner = document.body.querySelector(".hk-modal-body-inner");
    if (!inner) throw new Error("body inner missing");
    inner.appendChild(document.createElement("p"));
    // Settle frames keep pinning to the (stubbed constant) bottom.
    await until(() => s.scroller.scrollTop === SCROLL_H);
    await flush();
    await flush();

    expect(s.tag()).not.toBeNull();
    expect(s.jump()).toBeNull();
  });

  it("a gesture followed by an over-threshold scroll cancels follow", async () => {
    const s = await mountAutoFollow();
    expect(s.tag()).not.toBeNull();

    s.scroller.dispatchEvent(new WheelEvent("wheel"));
    s.scroller.scrollTop = CANCEL_TOP; // distance 200 > FOLLOW_THRESHOLD
    s.scroller.dispatchEvent(new Event("scroll"));
    await flush();

    expect(s.tag()).toBeNull();
    expect(s.jump()).not.toBeNull();
  });

  it("a slow drag keeps the flag alive across sub-threshold scrolls and cancels", async () => {
    const s = await mountAutoFollow();
    expect(s.tag()).not.toBeNull();

    s.scroller.dispatchEvent(new WheelEvent("wheel"));
    // First sub-threshold step (<32px): still following — must NOT eat
    // the gesture flag (regression guard for BLOCKER 1).
    s.scroller.scrollTop = BOTTOM_TOP - 10; // distance 10
    s.scroller.dispatchEvent(new Event("scroll"));
    await flush();
    expect(s.tag()).not.toBeNull();
    expect(s.jump()).toBeNull();

    // Drag crosses the threshold later: cancellation must still happen.
    s.scroller.scrollTop = CANCEL_TOP; // distance 200
    s.scroller.dispatchEvent(new Event("scroll"));
    await flush();
    expect(s.tag()).toBeNull();
    expect(s.jump()).not.toBeNull();
  });

  it("jump-to-latest pins to bottom, re-arms follow, drops the FAB", async () => {
    const s = await mountAutoFollow();

    s.scroller.dispatchEvent(new WheelEvent("wheel"));
    s.scroller.scrollTop = CANCEL_TOP;
    s.scroller.dispatchEvent(new Event("scroll"));
    await flush();
    const fab = s.jump();
    if (!fab) throw new Error("jump FAB did not appear after cancel");

    fab.click(); // resumeJumpLatest: direct pin + settle frames re-kick
    await until(() => s.scroller.scrollTop === SCROLL_H);
    await until(() => s.tag() !== null);
    expect(s.scroller.scrollTop).toBe(SCROLL_H);
    expect(s.jump()).toBeNull();
    // Follow is armed again: the next streaming chunk must neither
    // cancel nor demand a fresh gesture. (happy-dom keeps scrollTop
    // unclamped above scrollHeight - clientHeight, so geometry reads
    // as "past the bottom" here — the render state is what matters.)
    const innerAfterJump = document.body.querySelector(".hk-modal-body-inner");
    if (!innerAfterJump) throw new Error("body inner missing");
    innerAfterJump.appendChild(document.createElement("p"));
    for (let i = 0; i < 8; i++) {
      await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
      await flush();
    }
    expect(s.tag()).not.toBeNull();
    expect(s.jump()).toBeNull();
  });
});
