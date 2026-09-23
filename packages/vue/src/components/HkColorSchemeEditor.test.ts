import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp, h, nextTick, onMounted, ref, type Ref } from "vue";

import { registerTokenGroup, themePresets, useTheme, type ThemeTokenRGB, type TokenGroupDefinition } from "../theme";
import { HkColorSchemeEditor, type HCustomTheme } from "./HkColorSchemeEditor";

// Fresh file = fresh registry module instance: no groups are registered
// until a test registers one, mirroring an app that registers late.
const EDITOR_GROUP: TokenGroupDefinition = {
  id: "editor-wires",
  label: "Editor wires",
  slots: [
    {
      key: "a",
      label: "A",
      defaults: { dark: { r: 1, g: 2, b: 3 }, light: { r: 4, g: 5, b: 6 } },
    },
    {
      key: "b",
      label: "B",
      defaults: { dark: { r: 7, g: 8, b: 9 }, light: { r: 10, g: 11, b: 12 } },
      pairWith: "a",
    },
  ],
};

const SECTIONED_GROUP: TokenGroupDefinition = {
  id: "editor-sectioned",
  label: { en: "Sectioned palette", "zh-Hans": "分区调色板" },
  sections: [
    {
      key: "power",
      label: { en: "Electrical power", "zh-Hans": "电力" },
      slots: [
        {
          key: "l1",
          label: { en: "Phase L1 (yellow)", "zh-Hans": "L1 相（黄）" },
          defaults: { dark: { r: 234, g: 179, b: 8 }, light: { r: 161, g: 98, b: 7 } },
          hueClamp: { center: 45, range: 20 },
        },
        {
          key: "l2",
          label: { en: "Phase L2 (green)", "zh-Hans": "L2 相（绿）" },
          defaults: { dark: { r: 34, g: 197, b: 94 }, light: { r: 21, g: 128, b: 61 } },
        },
      ],
    },
    {
      key: "media",
      label: { en: "Process media", "zh-Hans": "工艺介质" },
      slots: [
        {
          key: "h2",
          label: { en: "Hydrogen", "zh-Hans": "氢气" },
          defaults: { dark: { r: 20, g: 184, b: 166 }, light: { r: 15, g: 118, b: 110 } },
        },
      ],
    },
  ],
};

// Legacy prefill shape: a saved custom theme predating the optional
// on-solid content slots (ThemeSchemeTokens keeps them optional for these).
const legacyDark: HCustomTheme["dark"] = {
  primary: { r: 12, g: 34, b: 56 },
  secondary: { r: 21, g: 43, b: 65 },
  accent: { r: 90, g: 80, b: 70 },
  text: { r: 228, g: 228, b: 231 },
  muted: { r: 180, g: 180, b: 180 },
  border: { r: 255, g: 255, b: 255 },
  focusedBorder: { r: 12, g: 34, b: 56 },
  background: { r: 14, g: 14, b: 30 },
  surface: { r: 24, g: 24, b: 42 },
  selectedBackground: { r: 70, g: 70, b: 85 },
  selectedText: { r: 240, g: 240, b: 240 },
  statusBarBackground: { r: 24, g: 24, b: 42 },
  success: { r: 114, g: 241, b: 184 },
  error: { r: 255, g: 107, b: 107 },
  warning: { r: 253, g: 235, b: 139 },
  info: { r: 110, g: 231, b: 239 },
};

interface EditorExpose {
  reset: () => void;
  getDraft: () => HCustomTheme;
}

const mounts: Array<{ app: ReturnType<typeof createApp>; container: HTMLElement }> = [];

function mountEditor(initial?: {
  initialDark?: HCustomTheme["dark"];
  initialLight?: HCustomTheme["light"];
  initialGroups?: HCustomTheme["groups"];
}): { ref: Ref<EditorExpose | null>; container: HTMLElement } {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const editorRef = ref<EditorExpose | null>(null);
  const app = createApp({
    render: () =>
      h(HkColorSchemeEditor, {
        ref: editorRef,
        ...(initial?.initialDark ? { initialDark: initial.initialDark } : {}),
        ...(initial?.initialLight ? { initialLight: initial.initialLight } : {}),
        ...(initial?.initialGroups ? { initialGroups: initial.initialGroups } : {}),
      }),
  });
  app.mount(container);
  mounts.push({ app, container });
  return { ref: editorRef, container };
}

async function settle(): Promise<void> {
  await nextTick();
  await new Promise((resolve) => setTimeout(resolve, 0));
  await nextTick();
}

/** Set the first accent token (primary) of the active mode to a hex color. */
async function setPrimaryHex(hex: string): Promise<void> {
  const swatch = document.body.querySelector(
    ".s-scheme-colors .hk-color-picker-swatch-btn",
  ) as HTMLButtonElement | null;
  swatch!.click();
  await settle();
  const input = document.body.querySelector(
    ".hk-color-picker-hex-row input.hk-input-element",
  ) as HTMLInputElement | null;
  input!.value = hex;
  input!.dispatchEvent(new Event("input", { bubbles: true }));
  await nextTick();
}

/** Set an arbitrary picker slot (by swatch index) of the active mode to a hex color. */
async function setSwatchHex(swatchIndex: number, hex: string): Promise<void> {
  const swatches = document.body.querySelectorAll(
    ".s-scheme-colors .hk-color-picker-swatch-btn",
  );
  (swatches[swatchIndex] as HTMLButtonElement).click();
  await settle();
  const input = document.body.querySelector(
    ".hk-color-picker-hex-row input.hk-input-element",
  ) as HTMLInputElement | null;
  input!.value = hex;
  input!.dispatchEvent(new Event("input", { bubbles: true }));
  await nextTick();
}

/** Set an on-brand content slot (0 = onSolidText, 1 = onSolidIcon) of the
 *  active mode to a hex color — the pair edits inside the extended-colors
 *  section's first group panel, not the accent row. */
async function setOnSolidHex(slotIndex: number, hex: string): Promise<void> {
  const swatches = document.body.querySelectorAll(
    ".s-scheme-groups .s-scheme-group-grid .hk-color-picker-swatch-btn",
  );
  (swatches[slotIndex] as HTMLButtonElement).click();
  await settle();
  const input = document.body.querySelector(
    ".hk-color-picker-hex-row input.hk-input-element",
  ) as HTMLInputElement | null;
  input!.value = hex;
  input!.dispatchEvent(new Event("input", { bubbles: true }));
  await nextTick();
}

beforeEach(() => {
  // Pin the effective mode so edits deterministically target the dark side.
  useTheme().setMode("dark");
});

afterEach(() => {
  for (const { app, container } of mounts.splice(0)) {
    app.unmount();
    container.remove();
  }
});

describe("HkColorSchemeEditor", () => {
  it("renders seven accent pickers and moves the on-solid pair into the extended section", async () => {
    const { container } = mountEditor();
    await nextTick();

    const pickers = container.querySelectorAll(".s-scheme-colors .hk-color-picker");
    expect(pickers).toHaveLength(7); // accents only — the on-solid pair moved out
    // The extended section is always rendered: the on-brand content group
    // lives there even with no extension token group registered.
    const groups = container.querySelector(".s-scheme-groups");
    expect(groups).not.toBeNull();
    expect(groups!.querySelector(".s-scheme-groups-title")).not.toBeNull();
    const onSolidPickers = groups!.querySelectorAll(
      ".s-scheme-group-grid .hk-color-picker",
    );
    expect(onSolidPickers).toHaveLength(2); // onSolidText + onSolidIcon
  });

  it("editing a token updates getDraft() with the edited RGB", async () => {
    const { ref } = mountEditor();
    await nextTick();

    await setPrimaryHex("ff0000");
    const draft = ref.value!.getDraft();
    expect(draft.dark.primary).toEqual({ r: 255, g: 0, b: 0 });
  });

  it("editing an on-brand content color updates getDraft()", async () => {
    const { ref } = mountEditor();
    await nextTick();

    // 2nd picker in the on-brand group grid = onSolidIcon (text first).
    const swatches = document.body.querySelectorAll(
      ".s-scheme-groups .s-scheme-group-grid .hk-color-picker-swatch-btn",
    );
    (swatches[1] as HTMLButtonElement).click();
    await settle();
    const input = document.body.querySelector(
      ".hk-color-picker-hex-row input.hk-input-element",
    ) as HTMLInputElement | null;
    input!.value = "00ff00";
    input!.dispatchEvent(new Event("input", { bubbles: true }));
    await nextTick();

    const draft = ref.value!.getDraft();
    expect(draft.dark.onSolidIcon).toEqual({ r: 0, g: 255, b: 0 });
    // The untouched sibling slot keeps its default white.
    expect(draft.dark.onSolidText).toEqual({ r: 255, g: 255, b: 255 });
  });

  it("getDraft() includes clamped group values", async () => {
    registerTokenGroup(EDITOR_GROUP);
    registerTokenGroup(SECTIONED_GROUP);
    const { ref } = mountEditor();
    await nextTick();

    const draft = ref.value!.getDraft();
    expect(draft.groups).toBeTruthy();
    const darkGroups = draft.groups!.dark!;
    const lightGroups = draft.groups!.light!;
    // Flat group defaults, clamped per slot (no bands → passthrough).
    expect(darkGroups["editor-wires"]).toEqual({
      a: { r: 1, g: 2, b: 3 },
      b: { r: 7, g: 8, b: 9 },
    });
    // Sectioned group slots also land under their group id.
    expect((darkGroups["editor-sectioned"].l1 as ThemeTokenRGB).r).toBe(234);
    expect(lightGroups["editor-sectioned"].l2).toEqual({ r: 21, g: 128, b: 61 });
  });

  it("reset() restores the defaults after edits", async () => {
    const { ref } = mountEditor();
    await nextTick();

    const before = ref.value!.getDraft();
    // Seeded from the stock preset table: assert against it rather than a
    // literal that has to be re-typed every time the default scheme moves.
    expect(before.dark.primary).toEqual(themePresets.default.dark.primary);

    await setPrimaryHex("00ff00");
    expect(ref.value!.getDraft().dark.primary).toEqual({ r: 0, g: 255, b: 0 });

    ref.value!.reset();
    await nextTick();
    expect(ref.value!.getDraft().dark.primary).toEqual(themePresets.default.dark.primary);
  });

  it("reset() re-seeds on-solid slots to white when the prefill omits them", async () => {
    const { ref } = mountEditor({ initialDark: legacyDark });
    await nextTick();

    // 1st picker in the on-brand group grid = onSolidText.
    await setOnSolidHex(0, "00ff00");
    expect(ref.value!.getDraft().dark.onSolidText).toEqual({ r: 0, g: 255, b: 0 });

    ref.value!.reset();
    await nextTick();
    // Regression: Object.assign alone cannot clear a slot the prefill omits,
    // so reset() must re-seed the optional slots explicitly.
    expect(ref.value!.getDraft().dark.onSolidText).toEqual({ r: 255, g: 255, b: 255 });
    expect(ref.value!.getDraft().dark.onSolidIcon).toEqual({ r: 255, g: 255, b: 255 });
  });

  it("reset() restores prefill on-solid slot values after edits", async () => {
    const { ref } = mountEditor({
      initialDark: {
        ...legacyDark,
        onSolidText: { r: 255, g: 200, b: 0 },
        onSolidIcon: { r: 0, g: 200, b: 255 },
      },
    });
    await nextTick();

    await setOnSolidHex(0, "00ff00");
    expect(ref.value!.getDraft().dark.onSolidText).toEqual({ r: 0, g: 255, b: 0 });

    ref.value!.reset();
    await nextTick();
    expect(ref.value!.getDraft().dark.onSolidText).toEqual({ r: 255, g: 200, b: 0 });
    expect(ref.value!.getDraft().dark.onSolidIcon).toEqual({ r: 0, g: 200, b: 255 });
  });

  it("hides the built-in name input under showName=false and takes setThemeName", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    let exposed: { getDraft(): { name: string }; setThemeName(n: string): void } | null = null;
    const app = createApp({
      setup() {
        const ed = ref<{ getDraft(): { name: string }; setThemeName(n: string): void } | null>(null);
        onMounted(() => { exposed = ed.value; });
        return () => h(HkColorSchemeEditor, { ref: ed, showName: false, initialName: "" });
      },
    });
    app.mount(container);
    mounts.push({ app, container });
    await settle();

    const label = [...container.querySelectorAll("label")].find((l) =>
      l.textContent?.includes("Theme name") || l.textContent?.includes("主题名称"),
    );
    expect(label).toBeUndefined();
    exposed!.setThemeName("Host owned name");
    expect(exposed!.getDraft().name).toBe("Host owned name");
  });
});

describe("HkColorSchemeEditor seed provenance", () => {
  /**
   * Behavioural, not textual.
   *
   * An earlier cut of this guard scanned the component source for hard-coded
   * palette literals. Mutation rounds killed it three times over: a re-spelled
   * literal, a hex literal, a member access and a reordered key object all
   * walked through it, while its exact-string anchors went red on a mere
   * reformat. Text cannot pin this invariant.
   *
   * So pin the invariant itself — move the stock table and require the editor
   * to follow. A hard-coded seed cannot, whatever spelling it uses, and no
   * formatting choice can make this false-positive.
   */
  it("seeds the dark scheme from the live preset table", async () => {
    const sentinel = { r: 7, g: 8, b: 9 };
    const scheme = themePresets.default.dark;
    const original = scheme.primary;
    scheme.primary = sentinel;
    try {
      const { ref } = mountEditor();
      await nextTick();
      expect(ref.value!.getDraft().dark.primary).toEqual(sentinel);
    } finally {
      scheme.primary = original;
    }
  });

  it("seeds the light scheme from the live preset table", async () => {
    const sentinel = { r: 11, g: 12, b: 13 };
    const scheme = themePresets.default.light;
    const original = scheme.primary;
    scheme.primary = sentinel;
    try {
      const { ref } = mountEditor();
      await nextTick();
      expect(ref.value!.getDraft().light.primary).toEqual(sentinel);
    } finally {
      scheme.primary = original;
    }
  });

  it("survives a consumer that clears the stock keys", async () => {
    // Chest does exactly this at boot: every stock key is deleted and only its
    // brand line is registered (brandPresets.ts), so `themePresets.default` is
    // simply absent downstream. An unconditional dereference mounts fine in
    // every test in this repo and throws at mount inside that consumer — this
    // case is the only thing that can see it.
    const table = themePresets as Record<string, (typeof themePresets)[string]>;
    const stock = table.default;
    const brand = {
      id: "brand",
      name: "Brand",
      dark: { ...stock.dark, primary: { r: 1, g: 2, b: 3 } },
      light: { ...stock.light, primary: { r: 4, g: 5, b: 6 } },
    };
    for (const key of Object.keys(table)) delete table[key];
    table.brand = brand;
    try {
      const { ref } = mountEditor();
      await nextTick();
      // Seeded from the consumer's line, not from a missing stock entry.
      expect(ref.value!.getDraft().dark.primary).toEqual(brand.dark.primary);
      expect(ref.value!.getDraft().light.primary).toEqual(brand.light.primary);
    } finally {
      delete table.brand;
      table.default = stock;
    }
  });

  it("still seeds when the table is empty altogether", async () => {
    // Defensive arm: a consumer that clears the table without registering
    // anything leaves `stockDefaultPreset` as the only reachable palette. The
    // editor must mount rather than throw.
    const table = themePresets as Record<string, (typeof themePresets)[string]>;
    const stock = table.default;
    delete table.default;
    try {
      const { ref } = mountEditor();
      await nextTick();
      expect(ref.value!.getDraft().dark.primary).toEqual(stock.dark.primary);
    } finally {
      table.default = stock;
    }
  });
});

// ── Widened slot kinds: numbers and enums next to colors ─────────────

/** Registered for the cases below only, so the counting assertions of the
 *  cases above never see it. */
const KIND_SLOTS_GROUP: TokenGroupDefinition = {
  id: "editor-kinds",
  label: "Editor kinds",
  slots: [
    {
      key: "radius-md",
      cssVar: "--radius-md",
      kind: "number",
      label: { en: "Medium radius", "zh-Hans": "中圆角" },
      defaults: { dark: 8, light: 8 },
      min: 0,
      max: 32,
      step: 1,
      unit: "px",
    },
    {
      key: "density",
      kind: "enum",
      label: { en: "Density", "zh-Hans": "密度" },
      defaults: { dark: "compact", light: "cozy" },
      options: [
        { value: "compact", label: { en: "Compact", "zh-Hans": "紧凑" } },
        { value: "cozy", label: "Cozy" },
      ],
    },
    {
      key: "wire",
      label: { en: "Wire", "zh-Hans": "导线" },
      defaults: { dark: { r: 220, g: 60, b: 60 }, light: { r: 180, g: 40, b: 40 } },
    },
  ],
};

describe("HkColorSchemeEditor slot kinds", () => {
  beforeEach(() => {
    registerTokenGroup(KIND_SLOTS_GROUP);
  });

  /** The expansion panel holding this group's slots. */
  function kindPanel(container: HTMLElement): HTMLElement {
    const slider = container.querySelector(".s-scheme-group-field .hk-slider");
    expect(slider, "the number slot renders a slider").not.toBeNull();
    return slider!.closest(".hk-expansion-panel") as HTMLElement;
  }

  it("renders a slider for number slots and a segmented strip for enum slots", async () => {
    const { container } = mountEditor();
    await nextTick();

    const panel = kindPanel(container);
    // The slot's own field wrapper carries the label a slider cannot show.
    const fields = panel.querySelectorAll(".s-scheme-group-field");
    expect(fields).toHaveLength(2); // number + enum (the color slot keeps its picker)
    expect(fields[0].querySelector(".s-scheme-group-field-label")!.textContent).toBe(
      "Medium radius",
    );

    const slider = panel.querySelector(".hk-slider") as HTMLElement;
    expect(slider.getAttribute("aria-label")).toBe("Medium radius");
    expect(slider.getAttribute("aria-valuemin")).toBe("0");
    expect(slider.getAttribute("aria-valuemax")).toBe("32");
    expect(slider.getAttribute("aria-valuenow")).toBe("8");
    // formatValue feeds aria-valuetext with the slot's unit.
    expect(slider.getAttribute("aria-valuetext")).toBe("8px");
    expect(fields[0].querySelector(".s-scheme-group-field-value")!.textContent).toBe("8px");

    // Enum slot: one segmented trigger per option, labeled per locale.
    const triggers = [...panel.querySelectorAll(".hk-tabs-trigger")];
    expect(triggers.map((t) => t.textContent?.trim())).toEqual(["Compact", "Cozy"]);

    // The color slot is untouched: still the picker, still in the same grid.
    expect(panel.querySelectorAll(".hk-color-picker")).toHaveLength(1);
    expect(panel.querySelector(".s-scheme-group-grid")).not.toBeNull();
  });

  it("writes slider and tab edits into getDraft() as primitives", async () => {
    const { ref, container } = mountEditor();
    await nextTick();

    const seeded = ref.value!.getDraft().groups!.dark!["editor-kinds"];
    expect(seeded["radius-md"]).toBe(8);
    expect(seeded.density).toBe("compact");

    const panel = kindPanel(container);
    const slider = panel.querySelector(".hk-slider") as HTMLElement;
    slider.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    await nextTick();
    const cozy = [...panel.querySelectorAll(".hk-tabs-trigger")].find(
      (t) => t.textContent?.trim() === "Cozy",
    ) as HTMLElement;
    cozy.click();
    await settle();

    const edited = ref.value!.getDraft().groups!.dark!["editor-kinds"];
    expect(edited["radius-md"]).toBe(9);
    expect(edited.density).toBe("cozy");
  });

  it("clamps a stored draft value back into the slot on the way out", async () => {
    // A saved theme carrying a hand-edited / since-retired value must not
    // leak out of the editor: getDraft() re-clamps every slot by kind.
    const { ref } = mountEditor({
      initialGroups: {
        dark: { "editor-kinds": { "radius-md": 999, density: "spacious" } },
        light: { "editor-kinds": { "radius-md": 7, density: "cozy" } },
      },
    });
    await nextTick();

    const draft = ref.value!.getDraft();
    // Out of range → the slot max; out of vocabulary → the dark anchor.
    expect(draft.groups!.dark!["editor-kinds"]["radius-md"]).toBe(32);
    expect(draft.groups!.dark!["editor-kinds"].density).toBe("compact");
    // In-range values ride through untouched, per mode.
    expect(draft.groups!.light!["editor-kinds"]["radius-md"]).toBe(7);
    expect(draft.groups!.light!["editor-kinds"].density).toBe("cozy");
  });
});
