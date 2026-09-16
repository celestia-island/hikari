import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h, nextTick, ref } from "vue";

import HkModal from "./HkModal";

/**
 * Source contract for the leave-window height pin (chest field report
 * 2026-09-16): the close fold owns the frame's geometry for the whole
 * leave, so HkModal must KEEP the size morph's pin through closingFrom →
 * closingTo (morph.hold()) and only release it on the finalize edge. The
 * composable-level semantics are pinned by useSizeMorph.test.ts; this file
 * pins the HkModal INTEGRATION — the wiring bug class (calling stop()
 * instead of hold()) leaves the composable tests green while every real
 * modal folds over a resizing frame.
 *
 * happy-dom has no layout engine, so the frame's offsetHeight is stubbed
 * at the HTMLElement prototype level BEFORE mount — the morph's
 * openingFrom-tick arm then measures 500px and pins it, and every
 * mid-leave assertion reads the inline height string directly.
 */
const mounts: ReturnType<typeof createApp>[] = [];
const containers: HTMLElement[] = [];

afterEach(async () => {
  for (const app of mounts.splice(0)) app.unmount();
  for (const el of containers.splice(0)) el.remove();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function freezeRaf(): void {
  vi.stubGlobal("requestAnimationFrame", (_cb: FrameRequestCallback) => 0 as unknown as number);
  vi.stubGlobal("cancelAnimationFrame", () => {});
}

function stubDurations(): void {
  const realGCS = window.getComputedStyle.bind(window);
  vi.stubGlobal("getComputedStyle", (el: Element, ...rest: unknown[]) => {
    const style = realGCS(el as Element, ...(rest as []));
    return { ...style, transitionDuration: "0.3s" } as CSSStyleDeclaration;
  });
}

/** Prototype-level layout stub: every element measures `layoutH` tall.
 *  Mutable so a test can simulate content growth mid-enter. */
let layoutH = 500;
function stubLayout(initial: number): void {
  layoutH = initial;
  Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
    configurable: true,
    get: () => layoutH,
  });
}

function restoreLayout(): void {
  delete (HTMLElement.prototype as { offsetHeight?: number }).offsetHeight;
}

interface Rig {
  open: { value: boolean };
  pinHeight: () => string;
  frameEl: () => HTMLElement | null;
  clickClose: () => void;
}

async function mountRig(): Promise<Rig> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  containers.push(container);

  const open = ref(false);

  const Wrapper = defineComponent({
    setup() {
      return () =>
        h(HkModal, {
          modelValue: open.value,
          closable: true,
          title: "pin-test",
          "onUpdate:modelValue": (v: boolean) => { open.value = v; },
        }, { default: () => h("div", "content") });
    },
  });
  const app = createApp(Wrapper);
  mounts.push(app);
  app.mount(container);
  await nextTick();

  return {
    open,
    pinHeight: () => document.querySelector<HTMLElement>(".hk-modal-content")?.style.height ?? "",
    frameEl: () => document.querySelector<HTMLElement>(".hk-modal-content"),
    clickClose: () => {
      const btn = document.querySelector<HTMLElement>(".hk-modal-close");
      btn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    },
  };
}

describe("HkModal leave-window height pin", () => {
  it("keeps the morph pin through the whole leave and releases at finalize", async () => {
    vi.useFakeTimers();
    freezeRaf();
    stubDurations();
    stubLayout(500);
    try {
      const rig = await mountRig();

      // Open to rest: the enter-edge arm measured 500px and pinned it.
      rig.open.value = true;
      await vi.advanceTimersByTimeAsync(600);
      expect(rig.frameEl()).not.toBeNull();
      expect(rig.pinHeight()).toBe("500px");

      // Close through the modal's own close button (the real path).
      rig.clickClose();
      await vi.advanceTimersByTimeAsync(150); // mid-leave, past the flip
      expect(rig.frameEl()).not.toBeNull();
      // THE contract: the pin survives the whole closing window — a
      // stop()-instead-of-hold() wiring drops it here and the fold plays
      // over a frame handed back to `height: auto`.
      expect(rig.pinHeight()).toBe("500px");

      // Still pinned late in the leave.
      await vi.advanceTimersByTimeAsync(250);
      if (rig.frameEl()) {
        expect(rig.pinHeight()).toBe("500px");
      }

      // Finalize: the surface unmounts (the release write is invisible).
      await vi.advanceTimersByTimeAsync(600);
      expect(rig.frameEl()).toBeNull();
    } finally {
      restoreLayout();
    }
  });

  it("flushes growth deferred through the enter with an open-edge remeasure", async () => {
    vi.useFakeTimers();
    freezeRaf();
    stubDurations();
    stubLayout(400);
    try {
      const rig = await mountRig();

      // Open: the enter-edge arm pins the enter-time height (400px).
      rig.open.value = true;
      await vi.advanceTimersByTimeAsync(150); // mid-enter, past the flip
      expect(rig.pinHeight()).toBe("400px");

      // Content grows mid-enter — with the enter's defer gate the pin
      // must NOT chase it (the choreography's height-relative geometry
      // stays put; in a real browser the RO fires and is deferred too).
      layoutH = 700;
      await vi.advanceTimersByTimeAsync(50);
      expect(rig.pinHeight()).toBe("400px");

      // The open edge flushes the deferred growth one tick after the
      // transition classes clear — the pin lands at the grown height.
      await vi.advanceTimersByTimeAsync(450);
      expect(rig.pinHeight()).toBe("700px");

      // Sanity: the surface really rested open before the flush assertion.
      expect(rig.frameEl()).not.toBeNull();
    } finally {
      restoreLayout();
    }
  });
});
