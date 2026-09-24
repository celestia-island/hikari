import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, h, nextTick, ref } from "vue";

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
  // Leave transitions in the tab strip resolve through a ~1ms fallback
  // timer in happy-dom — give swap transitions a real macrotask window.
  await new Promise((resolve) => setTimeout(resolve, 20));
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
  return [...document.body.querySelectorAll<HTMLButtonElement>(".s-theme-mode-row .hk-tabs-trigger")];
}

function altitudeStrip(): HTMLElement | null {
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
  it("renders three segments with the naked altitude cell only in auto mode", async () => {
    useTheme().setMode("dark");
    const { container } = mountToggle(true);
    await settle();

    openMenu(container);
    await settle();

    // Manual mode: plain three-way group, no merged cell.
    expect(modeSegments()).toHaveLength(3);
    expect(altitudeStrip()).toBeNull();
    const dark = modeSegments().find((b) => b.textContent?.includes("Dark"));
    const lightSeg = modeSegments().find((b) => b.textContent?.includes("Light"));
    expect(dark?.getAttribute("aria-checked")).toBe("true");
    expect(lightSeg?.disabled).toBe(false);

    // Back to auto: the Light/Dark options merge into the group's
    // merged cell carrying the altitude strip (HTabs mergeKeys +
    // #merged) — a real track child, NOT the retired absolute overlay.
    modeSegments()
      .find((b) => b.textContent?.includes("Auto"))!
      .click();
    await settle();

    const strip = altitudeStrip();
    expect(strip).toBeTruthy();
    expect(strip!.textContent).toMatch(/[+-]?\d+(?:\.\d+)?°/);
    const cell = strip!.closest<HTMLElement>(".hk-tabs-merged");
    expect(cell).toBeTruthy();
    expect(cell!.getAttribute("data-keys")).toBe("light dark");
    expect(cell!.parentElement?.classList.contains("hk-tabs-list")).toBe(true);
    // Slot-unit width: the cell spans the two options it replaces, so
    // the group divides exactly as it did before the merge.
    expect(cell!.style.getPropertyValue("--hk-tabs-span")).toBe("2");
    expect(cell!.parentElement!.getAttribute("data-slots")).toBe("");
    expect(document.body.querySelector(".hk-tabs-overlay")).toBeNull();
    // The merged Light/Dark triggers leave the radio order entirely —
    // the strip is the single pointer surface while auto is active.
    const segments = modeSegments();
    expect(segments).toHaveLength(1);
    expect(segments[0].textContent).toContain("Auto");
    expect(segments[0].getAttribute("aria-checked")).toBe("true");
  });

  it("resolves auto to a manual side when the altitude strip is pressed", async () => {
    useTheme().setMode("system");
    const { container } = mountToggle(true);
    await settle();

    openMenu(container);
    await settle();
    expect(altitudeStrip()).toBeTruthy();

    altitudeStrip()!.click();
    await settle();

    expect(altitudeStrip()).toBeNull();
    const stored = localStorage.getItem(MODE_KEY);
    expect(["light", "dark"]).toContain(stored);
    const active = modeSegments().find((b) => b.getAttribute("aria-checked") === "true");
    expect(active?.textContent).toContain(stored === "light" ? "Light" : "Dark");
    // All three plain triggers are back in the radio order.
    expect(modeSegments()).toHaveLength(3);
  });

  it("keeps every theme row one full-width pill with deletes overlaid", async () => {
    useTheme().addCustomTheme(anyPresetTokens());
    const { container } = mountToggle(true);
    await settle();

    openMenu(container);
    await settle();

    const rows = [...document.body.querySelectorAll<HTMLElement>(".s-theme-menu .s-theme-item-row")];
    expect(rows.length).toBeGreaterThanOrEqual(2);

    let customRows = 0;
    for (const row of rows) {
      // The pill is the first (and for built-ins the ONLY) in-flow child:
      // no trailing slot element survives (it reserved a dead column
      // right of every built-in row in the mobile sheet). Custom rows
      // flag themselves and carry the delete button overlay as the one
      // extra child.
      expect(row.children[0].classList.contains("s-theme-item-btn")).toBe(true);
      expect(row.querySelector(".s-theme-item-slot")).toBeNull();
      const extra = [...row.children].slice(1);
      if (row.hasAttribute("data-custom")) {
        customRows += 1;
        expect(extra).toHaveLength(1);
        expect(extra[0].classList.contains("s-theme-item-delete")).toBe(true);
      } else {
        expect(extra).toHaveLength(0);
      }
    }
    expect(customRows).toBe(1);

    // Active check glyph sits inside the pill, leading the name.
    const activeBtn = document.body.querySelector<HTMLButtonElement>(".s-theme-item-btn[data-active]");
    expect(activeBtn?.querySelector(".s-theme-item-check")).toBeTruthy();
  });
  it("renders the mode-extra strip under the mode group when provided", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const app = createApp({
      render: () =>
        h(HkThemeToggle, { externalCustomize: true }, {
          "mode-extra": () => h("div", { class: "dpi-mark", "data-x": "1" }, "dpi"),
        }),
    });
    app.mount(container);
    mounts.push({ app, container });
    await settle();
    openMenu(container);
    await settle();

    const strip = document.body.querySelector(".s-theme-menu .s-theme-mode-extra");
    expect(strip).toBeTruthy();
    expect(strip!.querySelector(".dpi-mark")).toBeTruthy();
    // It sits inside the menu, after the mode row and before the divider.
    const menu = document.body.querySelector(".s-theme-menu")!;
    const children = [...menu.children].map((c) => c.className);
    const extraIdx = children.indexOf("s-theme-mode-extra");
    expect(extraIdx).toBeGreaterThan(children.indexOf("s-theme-mode-row"));
    expect(children[extraIdx + 1]).toContain("hk-divider");
  });

  it("omits the mode-extra strip when no slot is provided", async () => {
    let container: HTMLElement;
    const mounted = mountToggle(true);
    container = mounted.container;
    await settle();
    openMenu(container);
    await settle();
    expect(document.body.querySelector(".s-theme-menu .s-theme-mode-extra")).toBeNull();
  });
});

describe("HkThemeToggle item slots", () => {
  function mountSlotted(
    lead: (scope: { id: string }) => unknown,
    trail: (scope: { id: string }) => unknown,
  ): HTMLElement {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const app = createApp({
      render: () =>
        h(HkThemeToggle, {
          externalCustomize: true,
        }, {
          "item-leading": lead,
          "item-trailing": trail,
        }),
    });
    app.mount(container);
    mounts.push({ app, container });
    return container;
  }

  it("renders the leading slot on every row in place of the selected-check cell", async () => {
    // Two rows are the point: the stock table holds ONE preset, so a custom
    // supplies the second row these per-row assertions sweep.
    useTheme().addCustomTheme(anyPresetTokens());
    const seen: string[] = [];
    const container = mountSlotted(
      (scope) => { seen.push(scope.id); return h("i", { class: "lead-mark" }); },
      () => null,
    );
    await settle();
    openMenu(container);
    await settle();

    const rows = [...document.body.querySelectorAll<HTMLElement>(".s-theme-menu .s-theme-item-row")];
    expect(rows.length).toBeGreaterThanOrEqual(2);
    // Every row — active or not — carries the slot cell; no check cell is
    // rendered alongside (the slot owns the leading zone). Exactly ONE
    // slot cell per row in the DOM — the machine-era popover re-renders
    // per phase (class outputs are reactive), so slot invocation counts
    // are no longer 1:1 with rows; DOM uniqueness is the invariant.
    for (const row of rows) {
      expect(row.querySelector(".s-theme-item-lead .lead-mark")).toBeTruthy();
      expect(row.querySelectorAll(".lead-mark")).toHaveLength(1);
      expect(row.querySelector(".s-theme-item-check")).toBeNull();
    }
    expect(seen.length).toBeGreaterThanOrEqual(rows.length);
  });

  it("reserves the trailing column and suppresses the built-in delete overlay", async () => {
    // The stock table holds one preset; two customs give the three rows
    // (built-in + 2 custom) this column sweep needs.
    useTheme().addCustomTheme(anyPresetTokens());
    useTheme().addCustomTheme({ ...anyPresetTokens(), id: "test-custom-2", name: "Second custom scheme" });
    const container = mountSlotted(
      () => null,
      (scope) => h("i", { class: "trail-mark", "data-id": scope.id }),
    );
    await settle();
    openMenu(container);
    await settle();

    const rows = [...document.body.querySelectorAll<HTMLElement>(".s-theme-menu .s-theme-item-row")];
    expect(rows.length).toBeGreaterThanOrEqual(3);
    let customRows = 0;
    for (const row of rows) {
      expect(row.hasAttribute("data-trailing")).toBe(true);
      expect(row.getAttribute("data-trailing")).toBe("slot");
      expect(row.querySelector(".s-theme-item-trailing .trail-mark")).toBeTruthy();
      // The slot owns the trailing zone: the built-in overlay is gone
      // even on custom rows.
      expect(row.querySelector(".s-theme-item-delete")).toBeNull();
      if (row.hasAttribute("data-custom")) customRows += 1;
    }
    expect(customRows).toBe(2);
  });

  it("scopes each row with its resolved preset definition", async () => {
    const presets: Array<unknown> = [];
    // Two rows are the point: with a single built-in row the >= 2 bound
    // would pass on slot re-invocations alone, which is not what this claims.
    useTheme().addCustomTheme(anyPresetTokens());
    const container = mountSlotted(
      (scope) => { presets.push((scope as { preset?: unknown }).preset); return null; },
      () => null,
    );
    await settle();
    openMenu(container);
    await settle();

    // Built-in rows resolve to their preset table entry (tokens present).
    expect(presets.length).toBeGreaterThanOrEqual(2);
    for (const preset of presets) {
      const p = preset as { dark?: { primary?: unknown }; light?: { primary?: unknown } } | undefined;
      expect(p).toBeTruthy();
      expect(p!.dark?.primary).toBeTruthy();
      expect(p!.light?.primary).toBeTruthy();
    }
  });
});

describe("HkThemeToggle exposed closeMenu", () => {
  /** Public surface HkThemeToggle exposes via setup expose() —
   *  InstanceType does not carry expose() members, so type it
   *  structurally (the consumer-side contract this ships for). */
  interface ThemeTogglePublic {
    closeMenu: () => void;
  }

  function mountToggleWithRef(): {
    container: HTMLElement;
    toggle: () => ThemeTogglePublic;
  } {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const handle = ref<ThemeTogglePublic | null>(null);
    const app = createApp({
      render: () => h(HkThemeToggle, { ref: handle, externalCustomize: true }),
    });
    app.mount(container);
    mounts.push({ app, container });
    return {
      container,
      toggle: () => {
        const t = handle.value;
        if (!t) throw new Error("HkThemeToggle ref never populated");
        return t;
      },
    };
  }

  it("closes the open menu through the exposed closeMenu", async () => {
    const { container, toggle } = mountToggleWithRef();
    await settle();

    openMenu(container);
    await settle();
    expect(document.body.querySelector(".s-theme-menu")).toBeTruthy();

    // Host-row affordances (e.g. a per-theme edit button) open delegated
    // second-level windows: the desktop popover must be dismissable
    // programmatically — the same teardown path as every internal close.
    toggle().closeMenu();
    await settle();

    expect(document.body.querySelector(".s-theme-menu")).toBeNull();
  });

  it("closeMenu is a no-op while the menu is closed", async () => {
    const { container, toggle } = mountToggleWithRef();
    await settle();

    expect(() => toggle().closeMenu()).not.toThrow();
    await settle();
    expect(document.body.querySelector(".s-theme-menu")).toBeNull();

    // The menu still opens normally afterwards.
    openMenu(container);
    await settle();
    expect(document.body.querySelector(".s-theme-menu")).toBeTruthy();
  });
});

describe("HkThemeToggle theme names", () => {
  it("localizes a name that is a message key and passes literal names through", async () => {
    // The ThemePreset.name convention: a resolvable catalog key renders its
    // message (hosts ship localized built-ins); anything else — user-named
    // customs, strings that merely LOOK like dotted keys — renders raw,
    // because t() falls back to the input when the key is unknown.
    useTheme().addCustomTheme({ ...anyPresetTokens(), id: "test-keyed", name: "hikari::theme.defaultThemeName" });
    useTheme().addCustomTheme({ ...anyPresetTokens(), id: "test-literal", name: "Not A Catalog Key.At All" });
    const { container } = mountToggle(true);
    await settle();

    openMenu(container);
    await settle();

    const names = [...document.body.querySelectorAll<HTMLElement>(".s-theme-menu .s-theme-item-row .s-theme-item-name")]
      .map((el) => el.textContent?.trim());
    // en bundle value of the key (the test locale is hikari's default).
    expect(names).toContain("Default");
    expect(names).toContain("Not A Catalog Key.At All");
    expect(names).not.toContain("hikari::theme.defaultThemeName");
  });
});
