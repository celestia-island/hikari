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
  it("renders the seven accent pickers on initial render", async () => {
    const { container } = mountEditor();
    await nextTick();

    const pickers = container.querySelectorAll(".s-scheme-colors .hk-color-picker");
    expect(pickers).toHaveLength(7);
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
});
