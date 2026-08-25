import { afterEach, describe, expect, it } from "vitest";
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
