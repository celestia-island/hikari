import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { compile } from "sass";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h, nextTick, ref } from "vue";

import HkModal from "./HkModal";
import { chromeGuard } from "../runtime/chromeGuard";

/**
 * HkModal → chromeGuard wiring tests (runtime/chromeGuard).
 *
 * The modal is the guard's ONLY automatic pusher: every modal-kind
 * window (HkModal + the dialogs composed on it) must register while its
 * surface is on screen so the host's HkTitleBar drops into its guarded
 * rendering, and must release the moment the leave lands. Pinned here:
 * the open/close brackets (including the leave-lag — the guard holds
 * until the veil stops painting), the keepCaptionActions union across
 * stacked windows, the mid-open unmount safety pop, and the live
 * re-publish when the list swaps.
 */

const componentDir = resolve(dirname(fileURLToPath(import.meta.url)));

const mounts: ReturnType<typeof createApp>[] = [];
const containers: HTMLElement[] = [];

beforeEach(() => {
  vi.useFakeTimers();
  const realGCS = window.getComputedStyle.bind(window);
  vi.stubGlobal("getComputedStyle", (el: Element, ...rest: unknown[]) => {
    const style = realGCS(el as Element, ...(rest as []));
    return { ...style, transitionDuration: "0.3s" } as CSSStyleDeclaration;
  });
  vi.stubGlobal("requestAnimationFrame", (_cb: FrameRequestCallback) => 0 as unknown as number);
  vi.stubGlobal("cancelAnimationFrame", () => {});
});

afterEach(() => {
  for (const app of mounts.splice(0)) app.unmount();
  for (const el of containers.splice(0)) el.remove();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

/** The machine's open flip runs on its flip budget; the leave runs to
 *  its deadline. One generous sweep covers both (phases clear their own
 *  timers, so over-advancing is safe). */
async function settle() {
  await nextTick();
  vi.advanceTimersByTime(600);
  await nextTick();
}

interface Rig {
  open: { value: boolean };
  keep: { value: string[] };
  unmount: () => void;
}

function mountModal(initialKeep: string[], initialOpen = false): Rig {
  const open = ref(initialOpen);
  const keep = ref(initialKeep);
  const container = document.createElement("div");
  document.body.appendChild(container);
  const Wrapper = defineComponent({
    setup() {
      return () =>
        h(HkModal, {
          modelValue: open.value,
          title: "Window",
          keepCaptionActions: keep.value,
          "onUpdate:modelValue": (v: boolean) => {
            open.value = v;
          },
        });
    },
  });
  const app = createApp(Wrapper);
  app.mount(container);
  mounts.push(app);
  containers.push(container);
  return {
    open,
    keep,
    unmount: () => app.unmount(),
  };
}

describe("HkModal chrome-guard wiring", () => {
  it("engages the guard for a modal MOUNTED open (modelValue:true)", async () => {
    // The imperative boxes (HkMessageBox alert/confirm/prompt) mount
    // with modelValue already true: the modelValue watcher's immediate
    // arm flips machine.mounted during setup, before the guard watcher
    // would ever fire — only the guard watcher's own immediate arm
    // sees that value. Regression: without it every message box ran
    // with the bar fully interactive.
    const rig = mountModal(["gear"], true);
    await settle();
    expect(chromeGuard.active.value).toBe(true);
    expect(chromeGuard.keep.value.has("gear")).toBe(true);

    rig.open.value = false;
    await settle();
    expect(chromeGuard.active.value).toBe(false);
    expect(chromeGuard.keep.value.has("gear")).toBe(false);
  });

  it("pushes the guard on open and pops it when the leave lands", async () => {
    const rig = mountModal([]);
    expect(chromeGuard.active.value).toBe(false);

    rig.open.value = true;
    await settle();
    expect(chromeGuard.active.value).toBe(true);

    rig.open.value = false;
    await settle();
    expect(chromeGuard.active.value).toBe(false);
  });

  it("publishes keepCaptionActions for the window's lifetime", async () => {
    const rig = mountModal(["gear"]);
    rig.open.value = true;
    await settle();
    expect(chromeGuard.keep.value.has("gear")).toBe(true);

    rig.open.value = false;
    await settle();
    expect(chromeGuard.keep.value.has("gear")).toBe(false);
  });

  it("stacks windows: the union holds until each window pops", async () => {
    const first = mountModal(["gear"]);
    const second = mountModal(["gear", "bell"]);
    first.open.value = true;
    second.open.value = true;
    await settle();

    expect(chromeGuard.active.value).toBe(true);
    expect(chromeGuard.keep.value.has("bell")).toBe(true);
    expect(chromeGuard.keep.value.has("gear")).toBe(true);

    second.open.value = false;
    await settle();
    // The stacked window's extra id leaves with it; the first window
    // still holds the guard and its own id.
    expect(chromeGuard.active.value).toBe(true);
    expect(chromeGuard.keep.value.has("bell")).toBe(false);
    expect(chromeGuard.keep.value.has("gear")).toBe(true);

    first.open.value = false;
    await settle();
    expect(chromeGuard.active.value).toBe(false);
  });

  it("releases the guard when the component unmounts mid-open", async () => {
    const rig = mountModal(["gear"]);
    rig.open.value = true;
    await settle();
    expect(chromeGuard.active.value).toBe(true);

    // Hosts v-if whole modal subtrees away on route changes: Vue stops
    // the setup watcher without running it, so the safety pop in
    // onBeforeUnmount is the only release path.
    rig.unmount();
    await nextTick();
    expect(chromeGuard.active.value).toBe(false);
    expect(chromeGuard.keep.value.has("gear")).toBe(false);
  });

  it("re-publishes in place when the keep list swaps while open", async () => {
    const rig = mountModal(["gear"]);
    rig.open.value = true;
    await settle();
    expect(chromeGuard.keep.value.has("gear")).toBe(true);

    rig.keep.value = ["bell"];
    await nextTick();
    expect(chromeGuard.keep.value.has("gear")).toBe(false);
    expect(chromeGuard.keep.value.has("bell")).toBe(true);
    expect(chromeGuard.active.value).toBe(true);

    rig.open.value = false;
    await settle();
    expect(chromeGuard.active.value).toBe(false);
  });
});

describe("HkModal chrome-guard stylesheet contract", () => {
  it("keeps the modal above the guarded bar's sweep targets", () => {
    // The modal renders inside #hk-overlay-root, far above the bar; the
    // contract worth pinning is that HkModal.scss never lets the frame
    // or the backdrop opt INTO the guard markers the sweep exempts —
    // a stray data-window-control here would resurrect bar controls.
    const css = compile(resolve(componentDir, "HkModal.scss"), {
      style: "expanded",
    }).css;
    expect(css).not.toMatch(/data-window-control/);
    expect(css).not.toMatch(/data-keep-when-guarded/);
  });
});

describe("HkWindowControls caption-chrome markers", () => {
  it("tags every caption button data-window-control for the guard sweep", async () => {
    // Attribute selectors do not inherit: the sweep exempts only the
    // elements CARRYING data-window-control, so the standalone
    // cluster's buttons must each be tagged (a wrapper marker alone
    // would leave them swept dead under the guard). The cluster renders
    // only against a Tauri-like global, so stub one.
    vi.stubGlobal("__TAURI__", {
      window: {
        getCurrentWindow: () => ({
          minimize: async () => {},
          toggleMaximize: async () => {},
          close: async () => {},
          isMaximized: async () => false,
          onResized: async () => () => {},
        }),
      },
    });
    try {
      const { default: HkWindowControls } = await import("./HkWindowControls");
      const container = document.createElement("div");
      document.body.appendChild(container);
      const app = createApp({ render: () => h(HkWindowControls, { variant: "standard" }) });
      app.mount(container);
      mounts.push(app);
      containers.push(container);
      await nextTick();

      const buttons = [...container.querySelectorAll<HTMLButtonElement>(".hk-window-controls__btn")];
      expect(buttons.length).toBe(3);
      for (const button of buttons) {
        expect(button.hasAttribute("data-window-control")).toBe(true);
      }
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
