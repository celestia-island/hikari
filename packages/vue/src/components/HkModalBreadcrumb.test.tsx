import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, nextTick } from "vue";

import HkModalBreadcrumb from "./HkModalBreadcrumb";
import { usePopupManager } from "../runtime/usePopupManager";

const mounts: ReturnType<typeof createApp>[] = [];
const containers: HTMLElement[] = [];
// The registry is a module singleton shared with the strip.
const manager = usePopupManager();

afterEach(async () => {
  for (const app of mounts.splice(0)) app.unmount();
  for (const el of containers.splice(0)) el.remove();
  for (const entry of [...manager.registry.value.values()]) {
    manager.unregister(entry.id);
  }
  document.body.style.overflow = "";
});

async function mountStrip(): Promise<void> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  containers.push(container);
  const app = createApp(HkModalBreadcrumb);
  mounts.push(app);
  app.mount(container);
  await nextTick();
}

function strip(): HTMLElement | null {
  return document.querySelector("nav.hk-modal-breadcrumb");
}

function labels(): string[] {
  const nav = strip();
  if (!nav) return [];
  return [...nav.querySelectorAll(".hk-modal-breadcrumb-item")].map(
    (el) => el.textContent ?? "",
  );
}

describe("HkModalBreadcrumb window-stack policy", () => {
  it("treats an anchored desktop menu as a hidden level", async () => {
    // Theme window + an untitled anchor-attached popover (blocking=false):
    // the popover is not a window the user navigates, so a single-window
    // situation stays strip-less.
    manager.register("modal", true, "Custom theme");
    manager.register("dropdown", false);
    await mountStrip();
    expect(strip()).toBeNull();
  });

  it("lists a menu only while it blocks as a mobile bottom sheet", async () => {
    manager.register("modal", true, "Custom theme");
    const popup = manager.register("dropdown", false, "Pick a color", true);
    await mountStrip();
    expect(labels()).toEqual(["Custom theme", "Pick a color"]);
    // The sheet paints above the window, so it is the current crumb.
    expect(
      strip()!.querySelector(".hk-modal-breadcrumb-item-current")!.textContent,
    ).toBe("Pick a color");

    // Morphing back to an anchored popover (blocking=false) removes the
    // level instead of leaving a stale crumb behind.
    manager.setBlocking(popup.id, false);
    await nextTick();
    expect(strip()).toBeNull();
  });

  it("never falls back to a bare Layer N label", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      // Untitled window + untitled blocking sheet: the strip must use the
      // localized generic labels ("Window" / "Menu" in en), not "Layer N".
      manager.register("modal", true);
      manager.register("dropdown", false, undefined, true);
      await mountStrip();
      expect(labels()).toEqual(["Window", "Menu"]);
      expect(labels().join(" ")).not.toMatch(/Layer/);
    } finally {
      warn.mockRestore();
    }
  });

  it("orders crumbs by z and names the strip for assistive tech", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const win = manager.register("modal", true, "Settings");
      const drawer = manager.register("drawer", true, "Details");
      expect(drawer.zIndex).toBeGreaterThan(win.zIndex); // same band, later slot
      await mountStrip();
      // In-band order is open order: the later drawer sits on top.
      expect(labels()).toEqual(["Settings", "Details"]);
      expect(strip()!.getAttribute("aria-label")).toBe("Window layers");
    } finally {
      warn.mockRestore();
    }
  });

  it("exposes the registry entry shape the strip reads", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const handle = manager.register("dropdown", false, "Sheet", true);
      const entry = manager.registry.value.get(handle.id);
      expect(entry).toMatchObject({ kind: "dropdown", title: "Sheet", blocking: true });
    } finally {
      warn.mockRestore();
    }
  });
});
