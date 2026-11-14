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
  readDebugFloatPersisted,
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

  it("ignores non-primary-button grabs and pointerdowns on the close button", async () => {
    mount(() => h(HkDebugFloat));
    const win = floatWindow()!;
    const header = win.querySelector("[data-el='header']")!;

    dispatchMouse("pointerdown", header, { clientX: 100, clientY: 100, button: 2, buttons: 2 });
    // Vue patches the DOM on a microtask — without the tick the
    // assertion reads the PRE-drag DOM and passes vacuously even when a
    // drag started.
    await nextTick();
    expect(win.hasAttribute("data-dragging")).toBe(false);

    const close = win.querySelector("button.hk-icon-button")!;
    dispatchMouse("pointerdown", close, { clientX: 100, clientY: 100, button: 0, buttons: 1 });
    await nextTick();
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

describe("readDebugFloatPersisted", () => {
  it("parses a record that carries a hidden-section list", () => {
    localStorage.setItem(
      debugFloatStorageKey("unit-hidden"),
      JSON.stringify({ open: true, x: 4, y: 5, hidden: ["gpu", "draws"] }),
    );
    expect(readDebugFloatPersisted("unit-hidden")).toEqual({
      open: true,
      x: 4,
      y: 5,
      hidden: ["gpu", "draws"],
    });
  });

  it("rejects a non-array hidden list (corrupted payloads degrade to null)", () => {
    localStorage.setItem(
      debugFloatStorageKey("unit-bad-hidden"),
      JSON.stringify({ open: true, hidden: "gpu" }),
    );
    expect(readDebugFloatPersisted("unit-bad-hidden")).toBeNull();
    localStorage.setItem(
      debugFloatStorageKey("unit-bad-hidden2"),
      JSON.stringify({ open: true, hidden: ["gpu", 3] }),
    );
    expect(readDebugFloatPersisted("unit-bad-hidden2")).toBeNull();
  });

  it("accepts a record with no hidden half (older writers)", () => {
    localStorage.setItem(debugFloatStorageKey("unit-legacy"), JSON.stringify({ open: false }));
    expect(readDebugFloatPersisted("unit-legacy")).toEqual({ open: false });
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

describe("HkDebugFloat headerless chrome", () => {
  function mountHeaderless(extra: Record<string, unknown> = {}) {
    mount(() => h(HkDebugFloat, { chrome: "none", title: "PERF", ...extra }, () => "fps 60"));
    return floatWindow()!;
  }

  it("renders no title bar and carries the chrome marker", () => {
    const win = mountHeaderless();
    expect(win.getAttribute("data-chrome")).toBe("none");
    expect(win.querySelector("[data-el='header']")).toBeNull();
    expect(win.querySelector("[data-el='title']")).toBeNull();
    // The slot content still lands in the body.
    expect(win.querySelector("[data-el='body']")!.textContent).toContain("fps 60");
  });

  it("keeps the title as the accessible name even without a header", () => {
    const win = mountHeaderless();
    expect(win.getAttribute("aria-label")).toBe("PERF");
    expect(win.getAttribute("role")).toBe("group");
  });

  it("exposes the close button through the hover chrome overlay", () => {
    const win = mountHeaderless();
    const overlay = win.querySelector("[data-el='overlay']")!;
    expect(overlay).toBeTruthy();
    const close = overlay.querySelector("button.hk-debug-float-close")!;
    expect(close).toBeTruthy();
    expect(close.getAttribute("aria-label")).toBe("Close");
  });

  it("close hides the window and emits update:open false", async () => {
    const emitted: boolean[] = [];
    mount(() =>
      h(HkDebugFloat, { chrome: "none", "onUpdate:open": (v: boolean) => emitted.push(v) }),
    );
    const close = floatWindow()!.querySelector("[data-el='overlay'] button") as HTMLButtonElement;
    close.click();
    expect(emitted).toEqual([false]);
    await nextTick();
    expect(floatWindow()).toBeNull();
  });

  it("drags from the whole window body — no header to grab", async () => {
    mount(() => h(HkDebugFloat, { chrome: "none", width: "auto" }));
    const win = floatWindow()!;
    // A press on the window body itself (no [data-el='header'] exists).
    dispatchMouse("pointerdown", win, { clientX: 100, clientY: 100, button: 0, buttons: 1 });
    await nextTick();
    expect(win.hasAttribute("data-dragging")).toBe(true);
    dispatchMouse("pointermove", win, { clientX: 140, clientY: 120, buttons: 1 });
    await nextTick();
    expect(win.style.left).toBe("40px");
    expect(win.style.top).toBe("20px");
    dispatchMouse("pointerup", win);
    await nextTick();
    expect(win.hasAttribute("data-dragging")).toBe(false);
  });

  it("a press on the overlay's close button never starts a body drag", async () => {
    mount(() => h(HkDebugFloat, { chrome: "none" }));
    const win = floatWindow()!;
    const close = win.querySelector("[data-el='overlay'] button")!;
    dispatchMouse("pointerdown", close, { clientX: 100, clientY: 100, button: 0, buttons: 1 });
    // Await the DOM flush so a (broken) drag start is actually visible.
    await nextTick();
    expect(win.hasAttribute("data-dragging")).toBe(false);
    expect(win.style.left).toBe("");
  });
});

describe("HkDebugFloat width", () => {
  it("marks the auto seat and drops the inline px width", () => {
    mount(() => h(HkDebugFloat, { width: "auto" }));
    const win = floatWindow()!;
    expect(win.getAttribute("data-auto-width")).toBe("");
    expect(win.style.width).toBe("");
  });

  it("keeps the numeric seat inline (no auto marker)", () => {
    mount(() => h(HkDebugFloat, { width: 320 }));
    const win = floatWindow()!;
    expect(win.hasAttribute("data-auto-width")).toBe(false);
    expect(win.style.width).toBe("320px");
  });
});

describe("HkDebugFloat sections", () => {
  const SECTIONS = [
    { key: "timing", label: "timing" },
    { key: "draws", label: "draws" },
    { key: "gpu", label: "gpu" },
  ];

  function mountSections(
    propsExtra: Record<string, unknown> = {},
    slots?: Record<string, () => ReturnType<typeof h>>,
  ) {
    mount(
      () =>
        h(
          HkDebugFloat,
          { sections: SECTIONS, chrome: "none", ...propsExtra },
          slots ?? {
            timing: () => h("div", null, "render 60 fps"),
            draws: () => h("div", null, "draws 325"),
            gpu: () => h("div", null, "ANGLE (Intel)"),
          },
        ),
    );
    return floatWindow()!;
  }

  function section(win: HTMLElement, key: string): HTMLElement | null {
    return win.querySelector<HTMLElement>(`[data-el='section'][data-key='${key}']`);
  }

  it("renders each section through its same-named slot, in declared order", () => {
    const win = mountSections();
    const keys = [...win.querySelectorAll("[data-el='section']")].map(
      (el) => el.getAttribute("data-key"),
    );
    expect(keys).toEqual(["timing", "draws", "gpu"]);
    expect(section(win, "draws")!.textContent).toContain("draws 325");
    // The plain default slot is not part of the sections contract.
    expect(win.querySelector("[data-el='body']")!.textContent).not.toContain("unsectioned");
  });

  it("drops a section whose slot is missing instead of crashing", () => {
    const win = mountSections(
      {},
      { timing: () => h("div", null, "render 60 fps"), gpu: () => h("div", null, "ANGLE") },
    );
    expect(section(win, "timing")).toBeTruthy();
    expect(section(win, "draws")).toBeNull();
    expect(section(win, "gpu")).toBeTruthy();
  });

  it("every section gets a toggle chip, pressed = visible", () => {
    const win = mountSections();
    for (const s of SECTIONS) {
      const chip = win.querySelector<HTMLButtonElement>(`.hk-debug-float-section[data-key='${s.key}']`);
      expect(chip, `chip for ${s.key}`).toBeTruthy();
      expect(chip!.textContent).toBe(s.label);
      expect(chip!.getAttribute("aria-pressed")).toBe("true");
    }
  });

  it("toggling a chip hides that section (uncontrolled) and persists it", async () => {
    const win = mountSections({ persistKey: "sections" });
    const chip = win.querySelector<HTMLButtonElement>(
      ".hk-debug-float-section[data-key='draws']",
    )!;
    chip.click();
    await nextTick();
    expect(section(floatWindow()!, "draws")).toBeNull();
    expect(section(floatWindow()!, "timing")).toBeTruthy();
    const raw = localStorage.getItem(debugFloatStorageKey("sections"));
    expect(JSON.parse(raw!)).toEqual({ open: true, hidden: ["draws"] });
  });

  it("a remount restores the hidden set from the persisted record", () => {
    localStorage.setItem(debugFloatStorageKey("restore-hidden"), JSON.stringify({
      open: true,
      hidden: ["gpu", "timing"],
    }));
    const win = mountSections({ persistKey: "restore-hidden" });
    expect(section(win, "gpu")).toBeNull();
    expect(section(win, "timing")).toBeNull();
    expect(section(win, "draws")).toBeTruthy();
    // The chip mirrors the persisted state.
    expect(
      win.querySelector<HTMLButtonElement>(".hk-debug-float-section[data-key='gpu']")!
        .getAttribute("aria-pressed"),
    ).toBe("false");
  });

  it("toggling back re-shows the section and clears the persisted list", async () => {
    localStorage.setItem(
      debugFloatStorageKey("toggle-back"),
      JSON.stringify({ open: true, hidden: ["gpu"] }),
    );
    const win = mountSections({ persistKey: "toggle-back" });
    const chip = win.querySelector<HTMLButtonElement>(".hk-debug-float-section[data-key='gpu']")!;
    expect(chip.getAttribute("aria-pressed")).toBe("false");
    chip.click();
    await nextTick();
    expect(section(floatWindow()!, "gpu")).toBeTruthy();
    const raw = localStorage.getItem(debugFloatStorageKey("toggle-back"));
    expect(JSON.parse(raw!)).toEqual({ open: true });
  });

  it("corrupted hidden lists degrade to all-visible instead of crashing", () => {
    localStorage.setItem(
      debugFloatStorageKey("corrupt-hidden"),
      JSON.stringify({ open: true, hidden: "draws" }),
    );
    const win = mountSections({ persistKey: "corrupt-hidden" });
    expect(section(win, "draws")).toBeTruthy();
    expect(section(win, "gpu")).toBeTruthy();

    // A NON-ARRAY hidden that slipped past the reader would throw at
    // mount time (new Set(3) on a number) — the mount itself succeeding
    // is part of the contract, so pin the numeric shape on a fresh
    // record too (the new window is the LAST in document order).
    localStorage.setItem(
      debugFloatStorageKey("corrupt-hidden-2"),
      JSON.stringify({ open: true, hidden: 3 }),
    );
    mountSections({ persistKey: "corrupt-hidden-2" });
    const windows = document.querySelectorAll<HTMLElement>(".hk-debug-float");
    const win2 = windows[windows.length - 1];
    expect(section(win2, "draws")).toBeTruthy();
    expect(section(win2, "timing")).toBeTruthy();
  });

  it("controlled visibleSections wins over the internal state and emits the next list", async () => {
    const emitted: string[][] = [];
    const win = mountSections(
      {
        visibleSections: ["timing", "gpu"],
        "onUpdate:visibleSections": (keys: string[]) => emitted.push(keys),
      },
    );
    // The prop is the visible list: draws never renders.
    expect(section(win, "draws")).toBeNull();
    expect(section(win, "timing")).toBeTruthy();
    // Toggling the hidden one emits its RETURN, in sections order…
    const chip = win.querySelector<HTMLButtonElement>(".hk-debug-float-section[data-key='draws']")!;
    chip.click();
    await nextTick();
    expect(emitted).toEqual([["timing", "draws", "gpu"]]);
    // …and the uncontrolled state/persistence stay untouched (the prop
    // remains authoritative until the parent round-trips).
    expect(section(win, "draws")).toBeNull();
    // Toggling a visible one removes it from the emitted list.
    win.querySelector<HTMLButtonElement>(".hk-debug-float-section[data-key='timing']")!.click();
    await nextTick();
    expect(emitted[1]).toEqual(["gpu"]);
  });

  it("a drag under controlled visibility persists the prop-derived set, not a stale internal one", async () => {
    // A record from an uncontrolled era must not resurrect through a
    // controlled mount: the visibleSections prop is authoritative, so
    // the drag-drop persistence writes the DERIVED hidden set (empty
    // here) — never the mount-time internal list.
    localStorage.setItem(
      debugFloatStorageKey("ctl-stale"),
      JSON.stringify({ open: true, hidden: ["gpu"] }),
    );
    const win = mountSections({
      persistKey: "ctl-stale",
      visibleSections: ["timing", "draws", "gpu"],
    });
    expect(section(win, "gpu")).toBeTruthy();
    dispatchMouse("pointerdown", win, { clientX: 10, clientY: 10, button: 0, buttons: 1 });
    dispatchMouse("pointermove", win, { clientX: 30, clientY: 20, buttons: 1 });
    dispatchMouse("pointerup", win);
    await nextTick();
    expect(JSON.parse(localStorage.getItem(debugFloatStorageKey("ctl-stale"))!)).toEqual({
      open: true,
      x: 20,
      y: 10,
    });
    // The inverse direction: a controlled prop that HIDES a section
    // persists that same set on drop (prop-derived, both ways). Two
    // windows are mounted by now — the new one is the LAST in document
    // order (floatWindow() would return the first).
    localStorage.setItem(
      debugFloatStorageKey("ctl-stale2"),
      JSON.stringify({ open: true }),
    );
    mountSections({
      persistKey: "ctl-stale2",
      visibleSections: ["timing"],
    });
    const windows = document.querySelectorAll<HTMLElement>(".hk-debug-float");
    const win2 = windows[windows.length - 1];
    dispatchMouse("pointerdown", win2, { clientX: 10, clientY: 10, button: 0, buttons: 1 });
    dispatchMouse("pointermove", win2, { clientX: 30, clientY: 20, buttons: 1 });
    dispatchMouse("pointerup", win2);
    await nextTick();
    expect(JSON.parse(localStorage.getItem(debugFloatStorageKey("ctl-stale2"))!)).toEqual({
      open: true,
      x: 20,
      y: 10,
      hidden: ["draws", "gpu"],
    });
  });

  it("keeps the default-slot contract when no sections are declared", () => {
    mount(() => h(HkDebugFloat, null, () => "fps 60"));
    const win = floatWindow()!;
    expect(win.querySelector("[data-el='section']")).toBeNull();
    expect(win.querySelector("[data-el='body']")!.textContent).toContain("fps 60");
    expect(win.querySelector(".hk-debug-float-section")).toBeNull();
    expect(win.querySelector("[data-el='overlay']")).toBeNull();
  });

  it("headered mode parks the chips overlay but keeps the header close button", () => {
    mount(() => h(HkDebugFloat, { sections: SECTIONS }, {
      timing: () => h("div", null, "t"),
      draws: () => h("div", null, "d"),
      gpu: () => h("div", null, "g"),
    }));
    const win = floatWindow()!;
    expect(win.getAttribute("data-chrome")).toBe("header");
    expect(win.querySelector("[data-el='header'] .hk-debug-float-close")).toBeTruthy();
    // Chips still exist — in the hover overlay, not the header.
    expect(win.querySelectorAll(".hk-debug-float-section").length).toBe(3);
  });
});

describe("HkDebugFloat stylesheet contract", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const css = compile(resolve(here, "HkDebugFloat.scss"), { style: "expanded" }).css;
  const scale = readFileSync(resolve(here, "..", "scale.scss"), "utf8");

  it("fades the CARD to the prop-driven opacity on hover (the wowsp HUD idiom)", () => {
    // The fade lives on [data-el="fade"], never the root — the hover
    // chrome is the card's sibling and must stay legible while the
    // content dims (at a 0.15 dim an in-card close would fade too).
    // Sass compiles quoted attribute selectors unquoted ([data-hovered]).
    expect(css).toMatch(
      /\.hk-debug-float:hover \[data-el=fade\],\s*\.hk-debug-float\[data-hovered\] \[data-el=fade\]\s*\{\s*opacity:\s*var\(--hk-debug-float-hover-opacity,\s*0\.45\);/,
    );
  });

  it("runs the fade as an opacity-only ~150ms transition on the card", () => {
    expect(css).toMatch(
      /\.hk-debug-float \[data-el=fade\]\s*\{[^}]*transition:\s*opacity\s+var\(--duration-short\)/,
    );
    // Opacity-only: nothing about the fade may move layout.
    expect(css).toMatch(/\.hk-debug-float \[data-el=fade\]\s*\{[^}]*transition:\s*opacity[^;]*;/);
  });

  it("keeps the drag exception: a grabbed window's card stays opaque", () => {
    expect(css).toMatch(/\.hk-debug-float\[data-dragging\] \[data-el=fade\]\s*\{\s*opacity:\s*1;/);
  });

  it("pins the drag exception AFTER the hover rule (equal specificity — order is the cascade)", () => {
    // `.hk-debug-float:hover [data-el=fade]` and
    // `[data-dragging] [data-el=fade]` have EQUAL specificity: mid-grab
    // both match (the pointer is captured over the handle, so :hover
    // holds and pointerleave cannot fire). Which rule wins is decided
    // purely by source order — moving the drag exception above the hover
    // rule fades the window mid-grab, and no runtime test exercises that
    // co-occurrence (happy-dom has no real hover pipeline).
    const hoverIdx = css.search(
      /\.hk-debug-float:hover \[data-el=fade\],\s*\.hk-debug-float\[data-hovered\] \[data-el=fade\]\s*\{/,
    );
    const dragIdx = css.search(/\.hk-debug-float\[data-dragging\] \[data-el=fade\]\s*\{/);
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

  it("gives the header the grab affordances and the card the tabular mono face", () => {
    expect(css).toMatch(/\.hk-debug-float \[data-el=header\]\s*\{[^}]*cursor:\s*grab;/);
    expect(css).toMatch(/\.hk-debug-float \[data-el=header\]\s*\{[^}]*touch-action:\s*none;/);
    expect(css).toMatch(
      /\.hk-debug-float\[data-dragging\] \[data-el=header\]\s*\{[^}]*cursor:\s*grabbing;/,
    );
    expect(css).toMatch(/\.hk-debug-float \[data-el=fade\]\s*\{[^}]*font-family:\s*var\(--font-mono\);/);
    expect(css).toMatch(
      /\.hk-debug-float \[data-el=fade\]\s*\{[^}]*font-variant-numeric:\s*tabular-nums;/,
    );
  });

  it("makes the whole headerless window the drag handle", () => {
    expect(css).toMatch(/\.hk-debug-float\[data-chrome=none\]\s*\{[^}]*cursor:\s*grab;/);
    expect(css).toMatch(
      /\.hk-debug-float\[data-chrome=none\]\[data-dragging\]\s*\{[^}]*cursor:\s*grabbing;/,
    );
  });

  it("caps the body so a fat dump cannot cover the viewport", () => {
    expect(css).toMatch(
      /\.hk-debug-float \[data-el=body\]\s*\{[^}]*max-height:\s*40vh;[^}]*overflow:\s*auto;/,
    );
  });

  it("sizes the auto seat to its content, guarded against the viewport", () => {
    expect(css).toMatch(/\.hk-debug-float\[data-auto-width\]\s*\{[^}]*width:\s*max-content;/);
    expect(css).toMatch(
      /\.hk-debug-float\[data-auto-width\]\s*\{[^}]*max-width:\s*calc\(100vw - 2 \* var\(--hk-debug-float-offset,\s*16px\)\);/,
    );
  });

  it("keeps the hover chrome out of the fading card and click-transparent until revealed", () => {
    // Structure: the overlay is a sibling of the card, never inside it —
    // a nested overlay would fade (and unclickable) with the content.
    // dart-sass compiles the attribute selectors UNQUOTED, so search the
    // compiled form — the quoted spelling only survives inside comments
    // and would make this assertion vacuous.
    const fadeIdx = css.indexOf("[data-el=fade]");
    const overlayIdx = css.indexOf("[data-el=overlay]");
    expect(fadeIdx).toBeGreaterThan(-1);
    expect(overlayIdx).toBeGreaterThan(fadeIdx);
    expect(css).not.toMatch(/\.hk-debug-float \[data-el=fade\][^{]*\[data-el=overlay\]/);
    // Hidden until revealed, and reveal never happens inside the card.
    expect(css).toMatch(
      /\.hk-debug-float \[data-el=overlay\]\s*\{[^}]*opacity:\s*0;[^}]*pointer-events:\s*none;/,
    );
    expect(css).toMatch(
      /\.hk-debug-float:hover \[data-el=overlay\],[\s\S]*?\.hk-debug-float\[data-dragging\] \[data-el=overlay\],[\s\S]*?\.hk-debug-float:focus-within \[data-el=overlay\]\s*\{\s*opacity:\s*1;\s*pointer-events:\s*auto;/,
    );
  });

  it("pins the hover chrome INSIDE the window box so wide chip rows cannot catch off-window clicks", () => {
    // The overlay spans both insets and wraps: a chip row wider than a
    // fixed seat stays inside the window instead of painting (and, while
    // revealed, clicking) past its edge.
    expect(css).toMatch(
      /\.hk-debug-float \[data-el=overlay\]\s*\{[^}]*left:\s*var\(--space-4\);[^}]*right:\s*var\(--space-4\);[^}]*flex-wrap:\s*wrap;/,
    );
  });

  it("parks the hover chrome on the top edge when headerless and the bottom edge when headered", () => {
    expect(css).toMatch(
      /\.hk-debug-float\[data-chrome=none\] \[data-el=overlay\]\s*\{[^}]*top:\s*var\(--space-4\);/,
    );
    expect(css).toMatch(
      /\.hk-debug-float\[data-chrome=header\] \[data-el=overlay\]\s*\{[^}]*bottom:\s*var\(--space-4\);/,
    );
  });
});
