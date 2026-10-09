/**
 * Regression rig for popover anchoring under standardized CSS zoom
 * (chest's root-level manual DPI scale): the anchor rect comes back in
 * the root VISUAL space (zoom already applied) while the teleported
 * fixed host lives inside the zoomed subtree and paints its px scaled
 * back up. The host style must carry the VISUAL coords DIVIDED by the
 * cumulative zoom — at a 300% root zoom the theme menu used to open
 * three viewport-widths off screen and a top-anchored sheet floated a
 * zoom× gap above its footer bar.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h, nextTick, ref } from "vue";

import { configurePopupInsets } from "../runtime/popupBounds";
import HkPopover from "./HkPopover";

const mounts: ReturnType<typeof createApp>[] = [];
const containers: HTMLElement[] = [];

afterEach(() => {
  for (const app of mounts.splice(0)) app.unmount();
  for (const el of containers.splice(0)) el.remove();
  document.body
    .querySelectorAll(".hk-popover-panel, .hk-popover-scrim")
    .forEach((el) => el.remove());
  vi.restoreAllMocks();
});

function rect(x: number, y: number, w: number, h: number): DOMRect {
  return { x, y, width: w, height: h, top: y, left: x, right: x + w, bottom: y + h, toJSON: () => ({}) } as DOMRect;
}

/** Report `zoom` on the document element, nothing elsewhere. */
function patchRootZoom(zoom: string) {
  const original = window.getComputedStyle.bind(window);
  vi.spyOn(window, "getComputedStyle").mockImplementation(
    (el: Element, pseudo?: string | null): CSSStyleDeclaration => {
      const decl = original(el, pseudo ?? undefined);
      return new Proxy(decl, {
        get(target, prop, recv) {
          if (prop === "zoom") return el === document.documentElement ? zoom : undefined;
          const v = Reflect.get(target, prop, recv);
          return typeof v === "function" ? (v as (...a: unknown[]) => unknown).bind(target) : v;
        },
      });
    },
  );
}

/** gBCR rig: the anchor answers with a fixed visual rect, the teleported
 *  popover panel with its own, everything else with an empty rect. */
function patchRects(anchor: HTMLElement, anchorRect: DOMRect, panelRect: DOMRect) {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    if (this === anchor) return anchorRect;
    if (this.classList.contains("hk-popover-panel")) return panelRect;
    return rect(0, 0, 0, 0);
  });
}

async function flushFrames() {
  await nextTick();
  for (let i = 0; i < 3; i++) {
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => requestAnimationFrame(() => r(null)));
  }
}

function mountPopover(anchor: HTMLElement, placement: "bottom" | "top-start" | "bottom-start" = "bottom") {
  const container = document.createElement("div");
  document.body.appendChild(container);
  containers.push(container);
  anchor.textContent = "anchor";
  container.appendChild(anchor);

  const open = ref(false);
  const Wrapper = defineComponent({
    setup() {
      return () =>
        h(HkPopover, {
          modelValue: open.value,
          "onUpdate:modelValue": (v: boolean) => { open.value = v; },
          anchorRef: anchor,
          placement,
        }, { default: () => h("div", { class: "pop-content" }, "content") });
    },
  });
  const app = createApp(Wrapper);
  mounts.push(app);
  app.mount(container);
  return open;
}

const ANCHOR = { x: 100, y: 20, w: 80, h: 32 };
const PANEL = { x: 0, y: 0, w: 200, h: 100 };

describe("HkPopover anchoring under root CSS zoom", () => {
  it("writes visual px verbatim at zoom 1 (identity)", async () => {
    window.innerWidth = 1200;
    window.innerHeight = 800;
    patchRootZoom("1");
    const anchor = document.createElement("button");
    patchRects(anchor, rect(ANCHOR.x, ANCHOR.y, ANCHOR.w, ANCHOR.h), rect(PANEL.x, PANEL.y, PANEL.w, PANEL.h));
    const open = mountPopover(anchor);

    open.value = true;
    await flushFrames();

    const host = document.body.querySelector<HTMLElement>(".hk-popover-panel")!.parentElement!;
    // crossPos = 100 + (80-200)/2 = 40 (clamped ≥8), top = 32+4 = 56 —
    // zoom 1 divides by 1, so the legacy values survive unchanged.
    expect(host.style.top).toBe("56px");
    expect(host.style.left).toBe("40px");
  });

  it("divides the fixed coords by the cumulative root zoom", async () => {
    window.innerWidth = 1200;
    window.innerHeight = 800;
    patchRootZoom("2");
    const anchor = document.createElement("button");
    patchRects(anchor, rect(ANCHOR.x, ANCHOR.y, ANCHOR.w, ANCHOR.h), rect(PANEL.x, PANEL.y, PANEL.w, PANEL.h));
    const open = mountPopover(anchor);

    open.value = true;
    await flushFrames();

    const host = document.body.querySelector<HTMLElement>(".hk-popover-panel")!.parentElement!;
    // Same visual target as above, written in the host's local space so
    // the paint-time zoom multiplication lands the panel back at the
    // anchor: 56/2 = 28, 40/2 = 20.
    expect(host.style.top).toBe("28px");
    expect(host.style.left).toBe("20px");
  });

  it("divides a top-anchored placement's bottom offset by the zoom", async () => {
    window.innerWidth = 1200;
    window.innerHeight = 800;
    patchRootZoom("3");
    const anchor = document.createElement("button");
    // Footer bar: 60px tall at the viewport bottom edge in VISUAL px.
    patchRects(anchor, rect(20, 740, 120, 60), rect(0, 400, 240, 90));
    const open = mountPopover(anchor, "top-start");

    open.value = true;
    await flushFrames();

    const host = document.body.querySelector<HTMLElement>(".hk-popover-panel")!.parentElement!;
    // bottom = vh - anchor.top + off = 800 - 740 + 4 = 64 (clamped ≤ 702)
    // → the panel's bottom edge sits 64 visual px above the viewport
    // bottom (4px gap over the bar); start align → left = anchor.left
    // = 20 (inside the pad clamp). Written divided by 3 to survive the
    // ×3 paint scale.
    expect(parseFloat(host.style.bottom)).toBeCloseTo(64 / 3, 2);
    expect(parseFloat(host.style.left)).toBeCloseTo(20 / 3, 2);
  });
});

describe("HkPopover anchoring against an app-chrome band", () => {
  const PREV_HEIGHT = window.innerHeight;

  afterEach(() => {
    configurePopupInsets(null);
    window.innerHeight = PREV_HEIGHT;
  });

  it("clamps the panel inside the band's frame, not the raw window", async () => {
    // The band reserves the BOTTOM 700px of the window — the popup frame
    // is the top 100px strip. The anchor sits inside the band's territory
    // (y=700): both sides are starved inside the frame, the flip picks
    // top (more room), and the main-axis clamp pins the panel bottom at
    // the FRAME's lower gutter (y=84) instead of the window's.
    window.innerWidth = 1200;
    window.innerHeight = 800;
    patchRootZoom("1");

    // Control, no band: the same anchor clamps against the WINDOW bottom
    // edge — panel bottom 104px above it.
    const anchor = document.createElement("button");
    patchRects(anchor, rect(100, 700, 80, 32), rect(0, 0, 200, 60));
    const open = mountPopover(anchor, "bottom");
    open.value = true;
    await flushFrames();
    const panels = document.body.querySelectorAll<HTMLElement>(".hk-popover-panel");
    const host = panels[panels.length - 1]!.parentElement!;
    expect(host.style.bottom).toBe("104px");
    open.value = false;
    await flushFrames();

    configurePopupInsets({ bottom: 700 });
    const anchor2 = document.createElement("button");
    patchRects(anchor2, rect(100, 700, 80, 32), rect(0, 0, 200, 60));
    const open2 = mountPopover(anchor2, "bottom");
    open2.value = true;
    await flushFrames();
    // happy-dom never fires transitionend, so the control panel may
    // linger — the freshly positioned one is the LAST in the body.
    const panels2 = document.body.querySelectorAll<HTMLElement>(".hk-popover-panel");
    const host2 = panels2[panels2.length - 1]!.parentElement!;
    // Panel bottom pinned at frame.y + frame.height - gutter = 100 - 16,
    // written as the viewport-bottom distance 800 - 84 = 716.
    expect(host2.style.bottom).toBe("716px");
    // Cross axis stays HORIZONTAL: centered at 40, inside the frame's
    // x-gutter as-is (an axis-swapped frame would pin it to 16).
    expect(host2.style.left).toBe("40px");
  });

  it("keeps the no-band cross clamp on the horizontal axis of a landscape window", async () => {
    // Regression pin for the cross-axis frame mapping: on a non-square
    // window the cross clamp of a vertically-stacked panel must measure
    // against the WIDTH (1440), not the height (900) — the swapped
    // mapping clamped this start-aligned panel to 634px.
    window.innerWidth = 1440;
    window.innerHeight = 900;
    patchRootZoom("1");
    const anchor = document.createElement("button");
    patchRects(anchor, rect(1300, 500, 40, 40), rect(0, 0, 250, 90));
    const open = mountPopover(anchor, "bottom-start");
    open.value = true;
    await flushFrames();
    const panels = document.body.querySelectorAll<HTMLElement>(".hk-popover-panel");
    const host = panels[panels.length - 1]!.parentElement!;
    expect(host.style.left).toBe("1174px"); // 1440 - 250 - 16
    expect(host.style.top).toBe("544px"); // anchor bottom 540 + offset 4
  });
});
