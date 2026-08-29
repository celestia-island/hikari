import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, h, nextTick } from "vue";

import { HkThemeToggle } from "./HkThemeToggle";
import { themePresets, useTheme, type CustomThemePreset } from "../theme";

const mounts: Array<{ app: ReturnType<typeof createApp>; container: HTMLElement }> = [];

interface Mounted {
  container: HTMLElement;
  openCustomize: () => number;
}

const MODE_KEY = "hikari-theme-mode";

function anyPresetTokens(): CustomThemePreset {
  const [base] = Object.values(themePresets);
  if (!base) throw new Error("no builtin theme presets available");
  return {
    id: "test-custom",
    name: "A Rather Long Custom Scheme Name For Width Checks",
    light: base.light,
    dark: base.dark,
  };
}

function resetThemeState(): void {
  const { setMode, removeCustomTheme } = useTheme();
  setMode("system");
  removeCustomTheme("test-custom");
  for (const key of ["hikari-theme", MODE_KEY, "hikari-custom-themes"]) {
    localStorage.removeItem(key);
  }
}

function mountToggle(externalCustomize: boolean): Mounted {
  const container = document.createElement("div");
  document.body.appendChild(container);
  let openCount = 0;
  const app = createApp({
    render: () =>
      h(HkThemeToggle, {
        externalCustomize,
        "onOpen-customize": () => {
          openCount += 1;
        },
      }),
  });
  app.mount(container);
  mounts.push({ app, container });
  return { container, openCustomize: () => openCount };
}

async function settle(): Promise<void> {
  await nextTick();
  await new Promise((resolve) => setTimeout(resolve, 0));
  await nextTick();
}

function openMenu(container: HTMLElement): void {
  const arrow = container.querySelector(
    '.s-theme-toggle-btn[data-variant="arrow"]',
  ) as HTMLButtonElement | null;
  arrow!.click();
}

function paletteButton(): HTMLButtonElement {
  const btn = [...document.body.querySelectorAll<HTMLButtonElement>(".s-theme-menu .s-theme-item-btn")].find(
    (b) => b.textContent?.includes("Customize"),
  );
  return btn!;
}

function modeSegments(): HTMLButtonElement[] {
  return [...document.body.querySelectorAll<HTMLButtonElement>(".s-theme-mode-row .hk-segmented__segment")];
}

function altitudeOverlay(): HTMLElement | null {
  return document.body.querySelector<HTMLElement>(".s-theme-mode-autoalt");
}

beforeEach(() => {
  // Hermetic geo: the component probes a geo API on mount; answer "not ok"
  // so it silently falls back to the timezone heuristic with no network.
  vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ ok: false })));
  resetThemeState();
});

afterEach(() => {
  for (const { app, container } of mounts.splice(0)) {
    app.unmount();
    container.remove();
  }
  vi.unstubAllGlobals();
});

describe("HkThemeToggle external customization", () => {
  it("emits open-customize and keeps the dialog closed when externalCustomize is true", async () => {
    const { container, openCustomize } = mountToggle(true);
    await settle();

    openMenu(container);
    await settle();

    paletteButton().click();
    await settle();

    expect(openCustomize()).toBe(1);
    // The internal dialog is never rendered in external mode.
    expect(document.body.querySelector(".s-scheme-dialog")).toBeNull();
  });

  it("opens the built-in dialog when externalCustomize defaults to false", async () => {
    const { container, openCustomize } = mountToggle(false);
    await settle();

    openMenu(container);
    await settle();

    paletteButton().click();
    await settle();

    expect(openCustomize()).toBe(0);
    expect(document.body.querySelector(".s-scheme-dialog")).toBeTruthy();
  });
});

describe("HkThemeToggle color-mode group", () => {
  it("renders three segments with the altitude overlay only in auto mode", async () => {
    useTheme().setMode("dark");
    const { container } = mountToggle(true);
    await settle();

    openMenu(container);
    await settle();

    // Manual mode: plain three-way group, no cover strip.
    expect(modeSegments()).toHaveLength(3);
    expect(altitudeOverlay()).toBeNull();
    const dark = modeSegments().find((b) => b.textContent?.includes("Dark"));
    const lightSeg = modeSegments().find((b) => b.textContent?.includes("Light"));
    expect(dark?.getAttribute("aria-checked")).toBe("true");
    expect(lightSeg?.disabled).toBe(false);

    // Back to auto: the group's tail overlay covers the Light/Dark halves
    // with the altitude strip (HkSegmented overlayFrom + #overlay).
    modeSegments()
      .find((b) => b.textContent?.includes("Auto"))!
      .click();
    await settle();

    const overlay = altitudeOverlay();
    expect(overlay).toBeTruthy();
    expect(overlay!.textContent).toMatch(/[+-]?\d+(?:\.\d+)?°/);
    // The overlay rides inside the segmented group's overlay layer.
    expect(overlay!.closest(".hk-segmented__overlay")).toBeTruthy();
    // Covered segments sit out of the tab order; the strip is the single
    // pointer surface while auto is active.
    expect(lightSeg?.disabled).toBe(true);
    expect(dark?.disabled).toBe(true);
  });

  it("resolves auto to a manual side when the altitude strip is pressed", async () => {
    useTheme().setMode("system");
    const { container } = mountToggle(true);
    await settle();

    openMenu(container);
    await settle();
    expect(altitudeOverlay()).toBeTruthy();

    altitudeOverlay()!.click();
    await settle();

    expect(altitudeOverlay()).toBeNull();
    const stored = localStorage.getItem(MODE_KEY);
    expect(["light", "dark"]).toContain(stored);
    const active = modeSegments().find((b) => b.getAttribute("aria-checked") === "true");
    expect(active?.textContent).toContain(stored === "light" ? "Light" : "Dark");
  });

  it("keeps every theme row footprint uniform for list highlights", async () => {
    useTheme().addCustomTheme(anyPresetTokens());
    const { container } = mountToggle(true);
    await settle();

    openMenu(container);
    await settle();

    const rows = [...document.body.querySelectorAll<HTMLElement>(".s-theme-menu .s-theme-item-row")];
    expect(rows.length).toBeGreaterThanOrEqual(2);

    let customRows = 0;
    for (const row of rows) {
      // Every row is exactly [pill button][trailing slot] — delete button
      // for custom themes, an equally sized invisible slot otherwise — so
      // all highlight boxes share one width and left/right padding.
      expect(row.children).toHaveLength(2);
      expect(row.children[0].classList.contains("s-theme-item-btn")).toBe(true);
      const trailing = row.children[1];
      const isDelete = trailing.classList.contains("s-theme-item-delete");
      const isSlot = trailing.classList.contains("s-theme-item-slot");
      expect(isDelete || isSlot).toBe(true);
      if (isDelete) customRows += 1;
    }
    expect(customRows).toBe(1);

    // Built-ins keep an explicit reserved slot element.
    expect(rows[0].querySelector(".s-theme-item-slot")).toBeTruthy();

    // Active check glyph sits inside the pill, leading the name.
    const activeBtn = document.body.querySelector<HTMLButtonElement>(".s-theme-item-btn[data-active]");
    expect(activeBtn?.querySelector(".s-theme-item-check")).toBeTruthy();
  });
});
