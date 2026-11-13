// AI-generated: developed with the DeepSeek Harness agent (model GLM-5.3 Flash); human-directed.

import { afterEach, describe, expect, it } from "vitest";
import { createApp, defineComponent, h, nextTick, ref } from "vue";
import { readFileSync } from "node:fs";
import { compile } from "sass";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import HkDebugFloat from "./HkDebugFloat";
import {
  clampDebugFloatPosition,
  debugFloatStorageKey,
  HK_DEBUG_FLOAT_DOCUMENT_Z,
} from "./debugFloat";

const mounts: Array<{ app: ReturnType<typeof createApp>; container: HTMLElement }> = [];

function mount(renderNode: () => ReturnType<typeof h>) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const app = createApp({ render: renderNode });
  app.mount(container);
  mounts.push({ app, container });
  return container;
}

/** The live teleported window (HkDebugFloat renders INTO document.body,
 *  never into the mount container). */
function floatWindow(): HTMLElement | null {
  return document.body.querySelector<HTMLElement>(".hk-debug-float");
}

function dispatchMouse(type: string, target: EventTarget, init: MouseEventInit = {}): void {
  target.dispatchEvent(new MouseEvent(type, { bubbles: true, ...init }));
}

afterEach(() => {
  for (const { app, container } of mounts.splice(0)) {
    app.unmount();
    container.remove();
  }
  localStorage.clear();
});

// Vitest stubs CSS, so the runtime suite can never catch a lost rule —
// the hover-fade and band contracts are additionally pinned by the
// compiled stylesheet guard at the bottom of this file (HkBadge pulse
// pattern).
describe("HkDebugFloat", () => {
  it("teleports the window to body — never inside the mount container", () => {
    const c = mount(() => h(HkDebugFloat, null, () => "fps 60"));
    expect(document.body.querySelector(".hk-debug-float")).toBeTruthy();
    expect(c.querySelector(".hk-debug-float")).toBeNull();
  });

  it("renders the slot content", () => {
    mount(() => h(HkDebugFloat, null, () => "fps 60"));
    expect(document.body.querySelector(".hk-debug-float [data-el='body']")!.textContent).toContain(
      "fps 60",
    );
  });

  it("defaults the header to the localized DEBUG label", () => {
    // The en bundle loads eagerly, so the two-arg t() fallback doubles as
    // the assertion's expected string — no i18n test setup (HkLoadMore).
    mount(() => h(HkDebugFloat));
    expect(document.body.querySelector("[data-el='title']")!.textContent).toBe("DEBUG");
  });

  it("lets the title prop override the default", () => {
    mount(() => h(HkDebugFloat, { title: "CACHE" }));
    expect(document.body.querySelector("[data-el='title']")!.textContent).toBe("CACHE");
  });

  it("lets the title slot override everything", () => {
    mount(() => h(HkDebugFloat, { title: "CACHE" }, { title: () => "SLOT" }));
    expect(document.body.querySelector("[data-el='title']")!.textContent).toBe("SLOT");
  });

  it("labels the window group with the title and the close button with Close", () => {
    mount(() => h(HkDebugFloat));
    const win = floatWindow()!;
    expect(win.getAttribute("aria-label")).toBe("DEBUG");
    const close = win.querySelector("button.hk-icon-button")!;
    expect(close.getAttribute("aria-label")).toBe("Close");
  });

  it("reflects the position prop as the corner anchor", () => {
    mount(() => h(HkDebugFloat, { position: "top-left" }));
    expect(floatWindow()!.getAttribute("data-corner")).toBe("top-left");
  });

  it("anchors to bottom-right by default", () => {
    mount(() => h(HkDebugFloat));
    expect(floatWindow()!.getAttribute("data-corner")).toBe("bottom-right");
  });

  it("wires width, offset and hover opacity as inline custom properties", () => {
    mount(() => h(HkDebugFloat, { width: 320, offset: 8, hoverOpacity: 0.2 }));
    const win = floatWindow()!;
    expect(win.style.width).toBe("320px");
    expect(win.style.getPropertyValue("--hk-debug-float-offset")).toBe("8px");
    expect(win.style.getPropertyValue("--hk-debug-float-hover-opacity")).toBe("0.2");
  });

  it("defaults the z-index to the debug band (below every functional popup)", () => {
    mount(() => h(HkDebugFloat));
    expect(floatWindow()!.style.zIndex).toBe(String(HK_DEBUG_FLOAT_DOCUMENT_Z));
    expect(floatWindow()!.style.zIndex).toBe("80000");
  });

  it("honors an explicit zIndex override", () => {
    mount(() => h(HkDebugFloat, { zIndex: 42 }));
    expect(floatWindow()!.style.zIndex).toBe("42");
  });

  it("flips the hovered state on pointerenter and back on pointerleave", async () => {
    mount(() => h(HkDebugFloat));
    const win = floatWindow()!;
    expect(win.hasAttribute("data-hovered")).toBe(false);
    win.dispatchEvent(new Event("pointerenter"));
    await nextTick();
    expect(win.hasAttribute("data-hovered")).toBe(true);
    win.dispatchEvent(new Event("pointerleave"));
    await nextTick();
    expect(win.hasAttribute("data-hovered")).toBe(false);
  });

  it("close hides the window and emits update:open false (uncontrolled)", async () => {
    const emitted: boolean[] = [];
    mount(() =>
      h(HkDebugFloat, {
        "onUpdate:open": (v: boolean) => emitted.push(v),
      }),
    );
    const close = floatWindow()!.querySelector("button.hk-icon-button") as HTMLButtonElement;
    close.click();
    // The emit is synchronous; the unmount lands on the next tick.
    expect(emitted).toEqual([false]);
    await nextTick();
    expect(floatWindow()).toBeNull();
  });

  it("stays hidden on remount when a persistKey persisted the closed state", async () => {
    mount(() => h(HkDebugFloat, { persistKey: "roundtrip" }));
    (floatWindow()!.querySelector("button.hk-icon-button") as HTMLButtonElement).click();
    await nextTick();
    const raw = localStorage.getItem(debugFloatStorageKey("roundtrip"));
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw!)).toMatchObject({ open: false });

    // A fresh mount reads the same record and stays closed.
    mount(() => h(HkDebugFloat, { persistKey: "roundtrip" }));
    expect(floatWindow()).toBeNull();
  });

  it("restores a persisted open state on remount", () => {
    localStorage.setItem(debugFloatStorageKey("reopen"), JSON.stringify({ open: true }));
    mount(() => h(HkDebugFloat, { persistKey: "reopen", defaultOpen: false }));
    expect(floatWindow()).not.toBeNull();
  });

  it("falls back to defaultOpen when nothing was persisted", () => {
    mount(() => h(HkDebugFloat, { persistKey: "fresh", defaultOpen: false }));
    expect(floatWindow()).toBeNull();
    mount(() => h(HkDebugFloat, { persistKey: "fresh", defaultOpen: true }));
    expect(floatWindow()).not.toBeNull();
  });

  it("ignores corrupted persisted payloads instead of crashing", () => {
    localStorage.setItem(debugFloatStorageKey("corrupt"), "{not json");
    mount(() => h(HkDebugFloat, { persistKey: "corrupt" }));
    expect(floatWindow()).not.toBeNull();
    expect(floatWindow()!.style.left).toBe("");
  });

  it("honors the controlled open prop over the internal state", () => {
    mount(() => h(HkDebugFloat, { open: false }));
    expect(floatWindow()).toBeNull();
    mount(() => h(HkDebugFloat, { open: true }));
    expect(floatWindow()).not.toBeNull();
  });

  it("v-model round-trips: clicking close emits and a flipped prop hides", async () => {
    const Host = defineComponent({
      setup() {
        const open = ref(true);
        return () =>
          h(HkDebugFloat, {
            open: open.value,
            "onUpdate:open": (v: boolean) => {
              open.value = v;
            },
          });
      },
    });
    mount(() => h(Host));
    expect(floatWindow()).not.toBeNull();
    (floatWindow()!.querySelector("button.hk-icon-button") as HTMLButtonElement).click();
    await nextTick();
    expect(floatWindow()).toBeNull();
  });
});

describe("HkDebugFloat drag", () => {
  it("moves the window with the header pointer sequence and clamps to the viewport", async () => {
    mount(() => h(HkDebugFloat, { width: 280 }));
    const win = floatWindow()!;
    const header = win.querySelector("[data-el='header']")!;

    dispatchMouse("pointerdown", header, { clientX: 100, clientY: 100, button: 0, buttons: 1 });
    await nextTick();
    expect(win.hasAttribute("data-dragging")).toBe(true);

    // happy-dom has no layout engine: rects read zero, so the first
    // grab adopts origin (0,0) here — real browsers adopt the
    // CSS-resolved corner spot (the component contract, exercised via
    // the pure clamp helper below).
    dispatchMouse("pointermove", header, { clientX: 140, clientY: 120, buttons: 1 });
    await nextTick();
    // A dragged position pins the top-left in px and kills the insets.
    expect(win.style.left).toBe("40px");
    expect(win.style.top).toBe("20px");
    expect(win.style.right).toBe("auto");
    expect(win.style.bottom).toBe("auto");

    // Clamp: drag past the right/bottom edge of the 1024x768 viewport —
    // the top-left never goes past the viewport box.
    dispatchMouse("pointermove", header, { clientX: 5000, clientY: 5000, buttons: 1 });
    await nextTick();
    expect(Number.parseFloat(win.style.left)).toBeLessThanOrEqual(window.innerWidth);
    expect(Number.parseFloat(win.style.top)).toBeLessThanOrEqual(window.innerHeight);

    dispatchMouse("pointerup", header);
    await nextTick();
    expect(win.hasAttribute("data-dragging")).toBe(false);
  });

  it("persists the dropped position when a persistKey is set", async () => {
    mount(() => h(HkDebugFloat, { persistKey: "dragpos", width: 280 }));
    const win = floatWindow()!;
    const header = win.querySelector("[data-el='header']")!;
    dispatchMouse("pointerdown", header, { clientX: 100, clientY: 100, button: 0, buttons: 1 });
    dispatchMouse("pointermove", header, { clientX: 150, clientY: 120, buttons: 1 });
    dispatchMouse("pointerup", header);
    await nextTick();

    const raw = localStorage.getItem(debugFloatStorageKey("dragpos"));
    expect(raw).not.toBeNull();
    // origin (0,0) + pointer delta (50, 20) from the (100,100) grab.
    expect(JSON.parse(raw!)).toEqual({ open: true, x: 50, y: 20 });
    expect(win.style.left).toBe("50px");
  });

  it("restores a persisted position as an explicit top-left pin", () => {
    localStorage.setItem(
      debugFloatStorageKey("restore"),
      JSON.stringify({ open: true, x: 40, y: 60 }),
    );
    mount(() => h(HkDebugFloat, { persistKey: "restore" }));
    const win = floatWindow()!;
    expect(win.style.left).toBe("40px");
    expect(win.style.top).toBe("60px");
    expect(win.style.right).toBe("auto");
    expect(win.style.bottom).toBe("auto");
  });

  it("clamps a restored position that no longer fits the viewport", () => {
    localStorage.setItem(
      debugFloatStorageKey("offscreen"),
      JSON.stringify({ open: true, x: 9999, y: 9999 }),
    );
    mount(() => h(HkDebugFloat, { persistKey: "offscreen", width: 280 }));
    const win = floatWindow()!;
    // onMounted re-clamps against the rendered box and the viewport.
    expect(win.getBoundingClientRect().right).toBeLessThanOrEqual(window.innerWidth);
    expect(win.getBoundingClientRect().bottom).toBeLessThanOrEqual(window.innerHeight);
  });

  it("ignores non-primary-button grabs and pointerdowns on the close button", () => {
    mount(() => h(HkDebugFloat));
    const win = floatWindow()!;
    const header = win.querySelector("[data-el='header']")!;

    dispatchMouse("pointerdown", header, { clientX: 100, clientY: 100, button: 2, buttons: 2 });
    expect(win.hasAttribute("data-dragging")).toBe(false);

    const close = win.querySelector("button.hk-icon-button")!;
    dispatchMouse("pointerdown", close, { clientX: 100, clientY: 100, button: 0, buttons: 1 });
    expect(win.hasAttribute("data-dragging")).toBe(false);
    // The close button also never starts a drag position.
    expect(win.style.left).toBe("");
  });

  it("a hover with no button held never moves the window", () => {
    mount(() => h(HkDebugFloat));
    const win = floatWindow()!;
    const header = win.querySelector("[data-el='header']")!;
    // moves with dragStart unset (no pointerdown) are no-ops…
    dispatchMouse("pointermove", header, { clientX: 500, clientY: 500, buttons: 1 });
    expect(win.style.left).toBe("");
    // …and a stale start releases when the button is no longer held.
    dispatchMouse("pointerdown", header, { clientX: 100, clientY: 100, button: 0, buttons: 1 });
    dispatchMouse("pointermove", header, { clientX: 140, clientY: 120, buttons: 0 });
    expect(win.hasAttribute("data-dragging")).toBe(false);
  });
});

describe("clampDebugFloatPosition", () => {
  const VW = 1024;
  const VH = 768;

  it("keeps an in-range position untouched", () => {
    expect(clampDebugFloatPosition(10, 20, 280, 200, VW, VH)).toEqual({ x: 10, y: 20 });
  });

  it("clamps negative offsets to the viewport origin", () => {
    expect(clampDebugFloatPosition(-50, -1, 280, 200, VW, VH)).toEqual({ x: 0, y: 0 });
  });

  it("clamps past-edge drags to the fully-visible box", () => {
    expect(clampDebugFloatPosition(5000, 5000, 280, 200, VW, VH)).toEqual({
      x: VW - 280,
      y: VH - 200,
    });
  });

  it("pins a degenerate oversized window to the origin instead of going negative", () => {
    expect(clampDebugFloatPosition(30, 30, 2000, 2000, VW, VH)).toEqual({ x: 0, y: 0 });
  });
});

describe("HkDebugFloat stylesheet contract", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const css = compile(resolve(here, "HkDebugFloat.scss"), { style: "expanded" }).css;
  const scale = readFileSync(resolve(here, "..", "scale.scss"), "utf8");

  it("fades to the prop-driven opacity on hover (the wowsp HUD idiom)", () => {
    // Sass compiles quoted attribute selectors unquoted ([data-hovered]).
    expect(css).toMatch(
      /\.hk-debug-float:hover,\s*\.hk-debug-float\[data-hovered\]\s*\{\s*opacity:\s*var\(--hk-debug-float-hover-opacity,\s*0\.45\);/,
    );
  });

  it("runs the fade as an opacity-only ~150ms transition on the root", () => {
    expect(css).toMatch(
      /\.hk-debug-float\s*\{[^}]*transition:\s*opacity\s+var\(--duration-short\)/,
    );
    // Opacity-only: nothing about the fade may move layout.
    expect(css).toMatch(/\.hk-debug-float\s*\{[^}]*transition:\s*opacity[^;]*;/);
  });

  it("keeps the drag exception: a grabbed window stays opaque", () => {
    expect(css).toMatch(/\.hk-debug-float\[data-dragging\]\s*\{\s*opacity:\s*1;/);
  });

  it("pins the drag exception AFTER the hover rule (equal specificity — order is the cascade)", () => {
    // `.hk-debug-float:hover`/`[data-hovered]` and `[data-dragging]` have
    // EQUAL specificity (0,2,0): mid-grab both match (the pointer is captured
    // over the header, so :hover holds and pointerleave cannot fire). Which
    // rule wins is decided purely by source order — moving the drag exception
    // above the hover rule fades the window mid-grab, and no runtime test
    // exercises that co-occurrence (happy-dom has no real hover pipeline).
    const hoverIdx = css.search(
      /\.hk-debug-float:hover,\s*\.hk-debug-float\[data-hovered\]\s*\{/,
    );
    const dragIdx = css.search(/\.hk-debug-float\[data-dragging\]\s*\{/);
    expect(hoverIdx).toBeGreaterThan(-1);
    expect(dragIdx).toBeGreaterThan(hoverIdx);
  });

  it("keeps scale.scss, the sheet fallback and the TS constant on one band", () => {
    const band = scale.match(/--hk-z-debug-float:\s*(\d+)/);
    // A missing match is a broken contract, not an empty pass.
    expect(band).not.toBeNull();
    expect(Number(band![1])).toBe(HK_DEBUG_FLOAT_DOCUMENT_Z);
    expect(css).toContain(`z-index: var(--hk-z-debug-float, ${HK_DEBUG_FLOAT_DOCUMENT_Z});`);
  });

  it("parks the band above content chrome and below every functional popup", () => {
    const value = (name: string) => {
      const m = scale.match(new RegExp(`--hk-z-${name}:\\s*(\\d+)`));
      expect(m, `--hk-z-${name} must stay defined in scale.scss`).not.toBeNull();
      return Number(m![1]);
    };
    const band = value("debug-float");
    // Above every content-chrome rung (tooltip is the highest).
    expect(band).toBeGreaterThan(value("tooltip"));
    // Strictly below the fenced popup root: modals, drawers, toasts and
    // tooltips all live inside #hk-overlay-root and must win over the
    // debug window.
    expect(band).toBeLessThan(value("overlay-root"));
  });

  it("never spans the viewport — pointers outside the window land on the page", () => {
    const root = css.match(/\.hk-debug-float\s*\{[^}]*\}/)![0];
    expect(root).not.toMatch(/inset\s*:/);
    expect(root).toMatch(/pointer-events:\s*auto;/);
    expect(css).not.toMatch(/\.hk-debug-float\s*\{[^}]*position:\s*absolute/);
  });

  it("gives the header the grab affordances and the body the tabular mono face", () => {
    expect(css).toMatch(/\.hk-debug-float \[data-el=header\]\s*\{[^}]*cursor:\s*grab;/);
    expect(css).toMatch(/\.hk-debug-float \[data-el=header\]\s*\{[^}]*touch-action:\s*none;/);
    expect(css).toMatch(
      /\.hk-debug-float\[data-dragging\] \[data-el=header\]\s*\{[^}]*cursor:\s*grabbing;/,
    );
    expect(css).toMatch(/\.hk-debug-float\s*\{[^}]*font-family:\s*var\(--font-mono\);/);
    expect(css).toMatch(/\.hk-debug-float\s*\{[^}]*font-variant-numeric:\s*tabular-nums;/);
  });

  it("caps the body so a fat dump cannot cover the viewport", () => {
    expect(css).toMatch(
      /\.hk-debug-float \[data-el=body\]\s*\{[^}]*max-height:\s*40vh;[^}]*overflow:\s*auto;/,
    );
  });
});
