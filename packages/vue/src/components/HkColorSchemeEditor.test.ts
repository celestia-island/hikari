import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp, h, nextTick, ref, type Ref } from "vue";

import { registerTokenGroup, useTheme, type TokenGroupDefinition } from "../theme";
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
  it("renders the seven accent pickers plus the two on-solid content pickers", async () => {
    const { container } = mountEditor();
    await nextTick();

    const pickers = container.querySelectorAll(".s-scheme-colors .hk-color-picker");
    expect(pickers).toHaveLength(9); // 7 accents + onSolidText + onSolidIcon
    // No groups registered in this file yet: the extension section is absent.
    expect(container.querySelector(".s-scheme-groups")).toBeNull();
  });

  it("editing a token updates getDraft() with the edited RGB", async () => {
    const { ref } = mountEditor();
    await nextTick();

    await setPrimaryHex("ff0000");
    const draft = ref.value!.getDraft();
    expect(draft.dark.primary).toEqual({ r: 255, g: 0, b: 0 });
  });

  it("editing an on-solid content color updates getDraft()", async () => {
    const { ref } = mountEditor();
    await nextTick();

    // 9th picker in the grid = onSolidIcon (7 accents, then text, then icon).
    const swatches = document.body.querySelectorAll(
      ".s-scheme-colors .hk-color-picker-swatch-btn",
    );
    (swatches[8] as HTMLButtonElement).click();
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
    expect(darkGroups["editor-sectioned"].l1.r).toBe(234);
    expect(lightGroups["editor-sectioned"].l2).toEqual({ r: 21, g: 128, b: 61 });
  });

  it("reset() restores the defaults after edits", async () => {
    const { ref } = mountEditor();
    await nextTick();

    const before = ref.value!.getDraft();
    expect(before.dark.primary).toEqual({ r: 255, g: 107, b: 157 });

    await setPrimaryHex("00ff00");
    expect(ref.value!.getDraft().dark.primary).toEqual({ r: 0, g: 255, b: 0 });

    ref.value!.reset();
    await nextTick();
    expect(ref.value!.getDraft().dark.primary).toEqual({ r: 255, g: 107, b: 157 });
  });

  it("reset() re-seeds on-solid slots to white when the prefill omits them", async () => {
    const { ref } = mountEditor({ initialDark: legacyDark });
    await nextTick();

    // 8th picker in the grid = onSolidText (7 accents, then text, then icon).
    await setSwatchHex(7, "00ff00");
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

    await setSwatchHex(7, "00ff00");
    expect(ref.value!.getDraft().dark.onSolidText).toEqual({ r: 0, g: 255, b: 0 });

    ref.value!.reset();
    await nextTick();
    expect(ref.value!.getDraft().dark.onSolidText).toEqual({ r: 255, g: 200, b: 0 });
    expect(ref.value!.getDraft().dark.onSolidIcon).toEqual({ r: 0, g: 200, b: 255 });
  });
});
