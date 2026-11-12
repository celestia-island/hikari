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
  // The single merged trigger (user direction 2026-09-30): ONE ghost
  // HkIconButton opens the menu — the retired main/arrow pair is gone.
  const trigger = container.querySelector(
    ".s-theme-toggle-btn",
  ) as HTMLButtonElement | null;
  trigger!.click();
}

function triggerButton(container: HTMLElement): HTMLButtonElement {
  const trigger = container.querySelector<HTMLButtonElement>(".s-theme-toggle-btn");
  expect(trigger).toBeTruthy();
  return trigger!;
}

function customizeEntry(): HTMLButtonElement {
  // The entry rides the standard HkAddTile (2026-11-11 family migration)
  // and no longer carries s-theme-item-btn — the stable host hook class
  // is the query surface. (The helper's old paletteButton name retired
  // with the palette glyph: the tile's default is a Plus.)
  const btn = document.body.querySelector<HTMLButtonElement>(
    ".s-theme-menu .s-theme-item-customize",
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

describe("HkThemeToggle trigger", () => {
  it("renders ONE standard ghost icon-button trigger and no retired pair", async () => {
    const { container } = mountToggle(true);
    await settle();

    // Exactly one trigger, and it IS the shared standard part: the merged
    // single button (user direction 2026-09-30) must be chrome-identical
    // to the functional HkIconButtons hosts place beside it — the ghost
    // variant's shared rest/hover/press paint, not a bespoke block. The
    // size step is the chrome action ladder (2026-10-24 ruling via
    // useChromeActionSize): ghost/32 wide, ghost/28 narrow — the rung is
    // viewport-driven, so the test pins "the ladder's class", never one
    // hard-coded step.
    const triggers = container.querySelectorAll(".s-theme-toggle-btn");
    expect(triggers).toHaveLength(1);
    const trigger = triggers[0] as HTMLElement;
    expect(trigger.classList.contains("hk-icon-button")).toBe(true);
    expect(
      trigger.classList.contains("hk-icon-button-28")
      || trigger.classList.contains("hk-icon-button-32"),
    ).toBe(true);
    expect(trigger.classList.contains("hk-icon-button-ghost")).toBe(true);
    // The retired main/arrow data hooks must never come back.
    expect(trigger.hasAttribute("data-variant")).toBe(false);
    // A palette glyph, not the retired mode glyphs (the mode state lives
    // in the menu's segmented group now).
    expect(trigger.querySelector("svg")).toBeTruthy();
  });

  it("opens the theme menu from the single trigger with menu aria wiring", async () => {
    const { container } = mountToggle(true);
    await settle();

    const trigger = triggerButton(container);
    expect(trigger.getAttribute("aria-haspopup")).toBe("menu");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    // A click opens the menu; no mode switch fires (the retired direct
    // mode-cycle press is gone — mode switching lives in the strip).
    const modeBefore = useTheme().currentMode.value;
    trigger.click();
    await settle();
    expect(document.body.querySelector(".s-theme-menu")).toBeTruthy();
    expect(useTheme().currentMode.value).toBe(modeBefore);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");

    // Second press closes it again (plain toggle, same as before).
    trigger.click();
    await settle();
    expect(document.body.querySelector(".s-theme-menu")).toBeNull();
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });
});

describe("HkThemeToggle external customization", () => {
  it("emits open-customize and keeps the dialog closed when externalCustomize is true", async () => {
    const { container, openCustomize } = mountToggle(true);
    await settle();

    openMenu(container);
    await settle();

    customizeEntry().click();
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

    customizeEntry().click();
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

  it("keeps every theme row one standard list row with the delete on the action lane", async () => {
    useTheme().addCustomTheme(anyPresetTokens());
    const { container } = mountToggle(true);
    await settle();

    openMenu(container);
    await settle();

    const rows = [...document.body.querySelectorAll<HTMLElement>(".s-theme-menu .s-theme-item-row")];
    expect(rows.length).toBeGreaterThanOrEqual(2);

    let customRows = 0;
    for (const row of rows) {
      // Every row is the STANDARD list row (2026-11-13 user direction):
      // the menu-item pill stays on the shared root, the name rides the
      // row's main column, and affordances live on HkListRow's action
      // lane — custom rows flag themselves and carry the delete there;
      // built-ins carry no lane at all.
      expect(row.classList.contains("hk-list-row")).toBe(true);
      expect(row.querySelector(".s-theme-item-line .s-theme-item-name")).toBeTruthy();
      const lane = row.querySelector<HTMLElement>(".hk-list-row-actions");
      if (row.hasAttribute("data-custom")) {
        customRows += 1;
        expect(lane).toBeTruthy();
        const del = lane!.querySelector<HTMLElement>(".hk-list-row-actions__btn");
        expect(del).toBeTruthy();
        expect(del!.hasAttribute("data-danger")).toBe(true);
        expect(del!.getAttribute("aria-label")).toBe("Delete theme");
      } else {
        expect(lane).toBeNull();
      }
    }
    expect(customRows).toBe(1);

    // The active row's selection indicator is the data-active wash alone:
    // the check glyph retired with the leading-icon cell (2026-10-21 user
    // direction). No leading mark renders without an item-leading slot.
    const activeRow = document.body.querySelector<HTMLElement>(".s-theme-item-row[data-active]");
    expect(activeRow).toBeTruthy();
    expect(activeRow!.querySelector(".s-theme-item-check")).toBeNull();
    // The row is a real selectable list item (clickable contract):
    // keyboard parity comes from HkListRow.
    expect(activeRow!.getAttribute("aria-current")).toBe("true");
    expect(activeRow!.classList.contains("hk-list-row-clickable")).toBe(true);

    // Clicking a NON-active row selects it and closes the menu (the row's
    // click contract carries the selection; request-close dismisses the
    // popover — the old anatomy's inner button did both).
    const before = useTheme().currentTheme.value;
    // The custom scheme is the fixture's only non-active row.
    const target = rows.find((r) => !r.hasAttribute("data-active"))!;
    expect(target.hasAttribute("data-custom")).toBe(true);
    target.click();
    await settle();
    expect(useTheme().currentTheme.value).not.toBe(before);
    expect(useTheme().currentTheme.value).toBe("test-custom");
    // request-close dismissed the popover.
    expect(document.body.querySelector(".s-theme-menu")).toBeNull();
  });

  it("lane action clicks never double-fire the row's selection", async () => {
    // 2026-11-13 R2: the row is clickable and the lane is INSIDE it —
    // without the wrapper-level stopPropagation (HkCardList's
    // HkStatCard-action rule) a lane click also selected the row (the
    // delete button on a custom row SWITCHED to the theme it was
    // deleting and closed the menu). The guard must hold for the whole
    // composed behavior: action runs, selection unchanged, menu open.
    useTheme().addCustomTheme(anyPresetTokens());
    const container = document.createElement("div");
    document.body.appendChild(container);
    const deleted: string[] = [];
    const app = createApp({
      render: () =>
        h(HkThemeToggle, {
          externalCustomize: true,
          itemActions: (scope: { id: string }) => [
            { name: `Act ${scope.id}`, onSelect: () => { deleted.push(scope.id); } },
          ],
        }),
    });
    app.mount(container);
    mounts.push({ app, container });
    await settle();
    openMenu(container);
    await settle();

    const customRow = [...document.body.querySelectorAll<HTMLElement>(".s-theme-menu .s-theme-item-row")]
      .find((r) => r.hasAttribute("data-custom"))!;
    expect(customRow).toBeTruthy();
    customRow.querySelector<HTMLButtonElement>(".hk-list-row-actions__btn")!.click();
    await settle();

    expect(deleted).toHaveLength(1);
    expect(useTheme().currentTheme.value).toBe("default");
    expect(document.body.querySelector(".s-theme-menu")).toBeTruthy();
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
    nameSuffix?: (scope: { id: string }) => unknown,
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
          // Only provided when the case exercises it: the slot's ABSENCE is
          // itself a contract (rows must stay exactly as before).
          ...(nameSuffix ? { "item-name-suffix": nameSuffix } : {}),
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

  it("renders the trailing slot as quiet content and suppresses the built-in delete lane", async () => {
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
      // The slot owns the affordance column (the old suppression
      // contract): no built-in action lane renders, not even on
      // custom rows.
      expect(row.querySelector(".hk-list-row-actions")).toBeNull();
      if (row.hasAttribute("data-custom")) customRows += 1;
    }
    expect(customRows).toBe(2);

    // Clicks inside the trailing column stop at the column (HkCardList's
    // wrapper guard — the R2b round found the trailing wrapper unpinned
    // while it is load-bearing for exactly this host shape: a badge in a
    // clickable theme row). A click on a NON-ACTIVE row's quiet mark
    // (the R3 round flagged the active-row fixture as vacuous for the
    // selection half) neither selects that row nor closes the menu.
    const before = useTheme().currentTheme.value;
    const markedRow = rows.find((r) => r.hasAttribute("data-custom"))!;
    expect(markedRow.hasAttribute("data-active")).toBe(false);
    markedRow.querySelector<HTMLElement>(".s-theme-item-trailing .trail-mark")!.click();
    await settle();
    expect(useTheme().currentTheme.value).toBe(before);
    expect(document.body.querySelector(".s-theme-menu")).toBeTruthy();
  });

  it("lets the host itemActions prop own the standard action lane", async () => {
    // The new grammar: the host returns named actions from the callback
    // PROP (deliberately not a slot — slot returns are normalized into
    // vnodes, which would destroy the plain action objects);
    // HkListRow renders them through its lane (the same facility every
    // card list uses).
    useTheme().addCustomTheme(anyPresetTokens());
    const container = document.createElement("div");
    document.body.appendChild(container);
    const picked: string[] = [];
    const app = createApp({
      render: () =>
        h(HkThemeToggle, {
          externalCustomize: true,
          itemActions: (scope: { id: string }) => [
            {
              name: `Inspect ${scope.id}`,
              onSelect: () => { picked.push(scope.id); },
            },
          ],
        }),
    });
    app.mount(container);
    mounts.push({ app, container });
    await settle();
    openMenu(container);
    await settle();

    const rows = [...document.body.querySelectorAll<HTMLElement>(".s-theme-menu .s-theme-item-row")];
    expect(rows.length).toBeGreaterThanOrEqual(2);
    for (const row of rows) {
      const btn = row.querySelector<HTMLButtonElement>(".hk-list-row-actions__btn");
      expect(btn).toBeTruthy();
      expect(btn!.getAttribute("aria-label")).toMatch(/^Inspect /);
      btn!.click();
    }
    expect(picked.length).toBeGreaterThanOrEqual(2);
    expect(rows.every((r) => r.querySelector(".s-theme-item-trailing"))).toBe(false);
  });

  it("declines per row: undefined inherits the default, [] suppresses", async () => {
    // The documented contract: a PRESENT builder owns the lane, and a
    // per-row undefined DECLINES (falls back to the built-in anatomy —
    // the custom row gets the standard delete), while an explicit []
    // means "no actions". Returning undefined must NOT read as [].
    useTheme().addCustomTheme(anyPresetTokens());
    const container = document.createElement("div");
    document.body.appendChild(container);
    const app = createApp({
      render: () =>
        h(HkThemeToggle, {
          externalCustomize: true,
          itemActions: (scope: { id: string }) =>
            scope.id === "test-custom" ? undefined : [],
        }),
    });
    app.mount(container);
    mounts.push({ app, container });
    await settle();
    openMenu(container);
    await settle();

    const customRow = [...document.body.querySelectorAll<HTMLElement>(".s-theme-menu .s-theme-item-row")]
      .find((r) => r.hasAttribute("data-custom"))!;
    const builtin = customRow.querySelector<HTMLButtonElement>(".hk-list-row-actions__btn");
    expect(builtin, "the declined custom row falls back to the built-in delete").toBeTruthy();
    expect(builtin!.getAttribute("aria-label")).toBe("Delete theme");
    const stockRow = [...document.body.querySelectorAll<HTMLElement>(".s-theme-menu .s-theme-item-row")]
      .find((r) => !r.hasAttribute("data-custom"))!;
    expect(stockRow.querySelector(".hk-list-row-actions")).toBeNull();
  });

  it("renders the name-suffix cell inside the row's name line, right after the name", async () => {
    // The whole point of the slot (vs. reusing item-trailing) is that the
    // mark reads as part of the NAME. That is a DOM-position claim, so it
    // is asserted structurally: inside the row's `.s-theme-item-line`
    // (the row IS the click target — HkListRow's clickable contract), in
    // the same row, and immediately after `.s-theme-item-name` — not
    // merely "somewhere in the row".
    useTheme().addCustomTheme(anyPresetTokens());
    const container = mountSlotted(
      () => null,
      () => null,
      (scope) => h("i", { class: "suffix-mark", "data-id": scope.id }),
    );
    await settle();
    openMenu(container);
    await settle();

    const rows = [...document.body.querySelectorAll<HTMLElement>(".s-theme-menu .s-theme-item-row")];
    expect(rows.length).toBeGreaterThanOrEqual(2);
    for (const row of rows) {
      expect(row.getAttribute("data-name-suffix")).toBe("slot");
      const cell = row.querySelector<HTMLElement>(".s-theme-item-name-suffix .suffix-mark");
      expect(cell).toBeTruthy();
      expect(row.querySelectorAll(".suffix-mark")).toHaveLength(1);
      const name = row.querySelector<HTMLElement>(".s-theme-item-name");
      expect(name).toBeTruthy();
      // Inside the row's name line (the row itself carries the click
      // contract) and the name's immediate next sibling.
      expect(name!.closest(".s-theme-item-line")).toBeTruthy();
      expect(name!.closest(".s-theme-item-line")!.parentElement!.classList.contains("hk-list-row-main")).toBe(true);
      expect(cell!.closest(".s-theme-item-name-suffix")!.parentElement).toBe(name!.parentElement);
      expect(name!.nextElementSibling).toBe(cell!.closest(".s-theme-item-name-suffix"));
    }
  });

  it("leaves suffix rows untouched when the host provides no name-suffix slot", async () => {
    // Absence is a contract: without the slot the row must keep the
    // unmodified DOM (no empty cell, no data attribute), or every
    // existing host gains a phantom cell.
    useTheme().addCustomTheme(anyPresetTokens());
    const container = mountSlotted(() => null, () => null);
    await settle();
    openMenu(container);
    await settle();

    const rows = [...document.body.querySelectorAll<HTMLElement>(".s-theme-menu .s-theme-item-row")];
    expect(rows.length).toBeGreaterThanOrEqual(2);
    for (const row of rows) {
      expect(row.hasAttribute("data-name-suffix")).toBe(false);
      expect(row.querySelector(".s-theme-item-name-suffix")).toBeNull();
      expect(row.querySelector(".s-theme-item-name")).toBeTruthy();
    }
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
