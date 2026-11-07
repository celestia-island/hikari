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
 * open-edge arm then measures 500px and pins it, and every
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
  vi.stubGlobal("requestAnimationFrame", (_cb: FrameRequestCallback) => 0);
  vi.stubGlobal("cancelAnimationFrame", () => {});
}

/** Pin the viewport to the phone band (<768px): the desktop height ride
 *  blacks the morph out of the open/close edges, and these suites test the
 *  morph's own contracts. happy-dom's 1024px default would route them into
 *  the desktop branch. */
function stubPhoneViewport(): void {
  vi.stubGlobal(
    "matchMedia",
    (query: string) =>
      ({
        matches: false,
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        onchange: null,
        dispatchEvent: () => false,
      }) as MediaQueryList,
  );
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
    stubPhoneViewport();
    stubDurations();
    stubLayout(500);
    try {
      const rig = await mountRig();

      // Open to rest: the open-edge arm measured 500px and pinned it.
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

  it("leaves the frame unpinned through the enter; the open edge pins the settled height", async () => {
    vi.useFakeTimers();
    freezeRaf();
    stubPhoneViewport();
    stubDurations();
    stubLayout(400);
    try {
      const rig = await mountRig();

      // Open: nothing arms during the enter — the frame stays height:auto
      // so content that streams in mid-enter reflows it live instead of
      // sitting clipped behind a mount-time pin (2026-11-07 chest report:
      // topic windows fetched their detail mid-enter and the bottom of
      // the window stayed missing for the whole open animation).
      rig.open.value = true;
      await vi.advanceTimersByTimeAsync(150); // mid-enter, past the flip
      expect(rig.frameEl()).not.toBeNull();
      expect(rig.pinHeight()).toBe("");

      // Content grows mid-enter: still unpinned — the growth IS the
      // frame (auto height follows it frame-by-frame).
      layoutH = 700;
      await vi.advanceTimersByTimeAsync(50);
      expect(rig.pinHeight()).toBe("");

      // The open edge pins the settled natural height directly — no
      // deferred flush, no second growth spurt after the enter.
      await vi.advanceTimersByTimeAsync(450);
      expect(rig.pinHeight()).toBe("700px");

      // Sanity: the surface really rested open before the pin assertion.
      expect(rig.frameEl()).not.toBeNull();
    } finally {
      restoreLayout();
    }
  });

  it("drops the held pin at a reopen-interrupt edge; the open edge re-pins", async () => {
    vi.useFakeTimers();
    freezeRaf();
    stubPhoneViewport();
    stubDurations();
    stubLayout(500);
    try {
      const rig = await mountRig();

      // Open to rest (the open-edge arm pins 500px), then request a
      // close: the leave holds the pin (the fold owns the frame).
      rig.open.value = true;
      await vi.advanceTimersByTimeAsync(600);
      expect(rig.pinHeight()).toBe("500px");
      rig.open.value = false;
      await vi.advanceTimersByTimeAsync(150); // mid-leave
      expect(rig.frameEl()).not.toBeNull();
      expect(rig.pinHeight()).toBe("500px");

      // Reopen mid-leave: the reopening edge must DROP the held pin —
      // otherwise the reopen enter plays at the OLD content's height and
      // clips whatever the new content renders (the sibling of the
      // first-open bug this suite retired).
      rig.open.value = true;
      await vi.advanceTimersByTimeAsync(150); // mid-reopen-enter
      expect(rig.frameEl()).not.toBeNull();
      expect(rig.pinHeight()).toBe("");

      // The open edge re-pins at rest (content unchanged → same height).
      await vi.advanceTimersByTimeAsync(450);
      expect(rig.pinHeight()).toBe("500px");
      expect(rig.frameEl()).not.toBeNull();
    } finally {
      restoreLayout();
    }
  });
});
