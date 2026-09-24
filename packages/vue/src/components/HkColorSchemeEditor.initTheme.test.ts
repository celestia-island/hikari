/**
 * The end-to-end chain the other two theme suites leave open:
 * `initTheme()` → registry → `HkColorSchemeEditor` → draft → cssvars.
 *
 *   - src/theme/standardGroups.test.ts proves initTheme() REGISTERS `shape`.
 *   - src/components/HkColorSchemeEditor.test.ts proves the editor RENDERS
 *     whatever the registry holds — but it registers its own `editor-kinds`
 *     group by hand (registerTokenGroup) and nothing under src/components/
 *     calls initTheme() at all.
 *
 * So neither side notices when the halves stop agreeing: a standard group
 * shipping slots the editor cannot render, a registry instance the editor
 * does not share with initTheme(), or a slider edit that never reaches the
 * emitted cssvar. That seam is this file's subject.
 *
 * Every case builds a FRESH module graph (vi.resetModules() + dynamic
 * import) and never calls registerTokenGroup, so initTheme() is the only
 * registrant in it. The reverse-control case below takes the same fresh
 * graph but does NOT call initTheme(), which is what keeps the positive
 * assertions from being vacuously true.
 *
 * Known happy-dom noise: each initTheme() call leaves the environment one
 * pending async task that teardown aborts, so one
 * `DOMException [AbortError]: The operation was aborted` dump is printed per
 * call once the file finishes — and none from the reverse-control case,
 * which never calls initTheme(). The dump is pre-existing teardown noise
 * rather than a defect of this seam: this same branch without this file
 * already prints four of them on a full run. Documented, not silenced.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { createApp, h, nextTick, ref, type Ref } from "vue";

import type { HCustomTheme } from "./HkColorSchemeEditor";

interface EditorExpose {
  getDraft: () => HCustomTheme;
}

type EditorComponent = (typeof import("./HkColorSchemeEditor"))["HkColorSchemeEditor"];
type ThemeModule = typeof import("../theme");

// The editor's first dynamic import drags in the whole src/index.ts barrel
// (~200 components), and Vite charges that transform to whichever case runs
// first. Warm the cache here, under a hook budget instead of a case's 5s.
// The instances the cases use are still the fresh ones taken after
// vi.resetModules() below; this hook only invites the transform.
beforeAll(async () => {
  await import("../theme");
  await import("./HkColorSchemeEditor");
}, 120_000);

/** A fresh module graph, with initTheme() the only possible registrant. */
async function freshGraph(): Promise<{ theme: ThemeModule; editor: EditorComponent }> {
  vi.resetModules();
  const theme = await import("../theme");
  const { HkColorSchemeEditor } = await import("./HkColorSchemeEditor");
  return { theme, editor: HkColorSchemeEditor };
}

const mounts: Array<{ app: ReturnType<typeof createApp>; container: HTMLElement }> = [];

function mountEditor(editor: EditorComponent): {
  exposed: Ref<EditorExpose | null>;
  container: HTMLElement;
} {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const exposed = ref<EditorExpose | null>(null);
  const app = createApp({ render: () => h(editor, { ref: exposed }) });
  app.mount(container);
  mounts.push({ app, container });
  return { exposed, container };
}

afterEach(() => {
  for (const { app, container } of mounts.splice(0)) {
    app.unmount();
    container.remove();
  }
});

interface SliderFacts {
  max: string | null;
  label: string | null;
  valueNow: string | null;
  valueText: string | null;
}

/** Every rendered slider of the editor, in DOM order, by aria attribute. */
function sliders(container: HTMLElement): SliderFacts[] {
  return [...container.querySelectorAll(".hk-slider")].map((slider) => ({
    max: slider.getAttribute("aria-valuemax"),
    label: slider.getAttribute("aria-label"),
    valueNow: slider.getAttribute("aria-valuenow"),
    valueText: slider.getAttribute("aria-valuetext"),
  }));
}

describe("initTheme() → registry → HkColorSchemeEditor", () => {
  it("registers the shape group and renders its four radius sliders", async () => {
    const { theme, editor } = await freshGraph();
    // Fresh graph: the registry is empty until initTheme() runs, which is
    // what makes initTheme() the only registrant of every slot asserted on.
    expect(theme.getTokenGroups()).toEqual([]);

    theme.initTheme();
    // Pin the editing tab. The editor seeds it from `effectiveMode`, which
    // under the default "system" mode resolves from the SOLAR PERIOD — so
    // without this the assertions below flip with the wall clock (they read
    // the dark side while a daytime run edits the light side). Same pin as
    // the sibling HkColorSchemeEditor.test.ts does in its beforeEach.
    theme.useTheme().setMode("dark");

    const shape = theme
      .getTokenGroups()
      .find((group) => group.id === theme.STANDARD_SHAPE_GROUP_ID);
    expect(shape, "initTheme() registered the shape group").toBeDefined();
    // The four slots target the existing L2 scale tokens, and their maxima
    // are the aria-valuemax values the mount below is identified by.
    const slotFacts = (shape!.slots ?? []).map((slot) => {
      if (!theme.isNumberSlot(slot)) {
        throw new Error(`shape slot ${slot.key} is not a number slot`);
      }
      return [slot.key, slot.cssVar, slot.max];
    });
    expect(slotFacts).toEqual([
      ["radius-sm", "--radius-sm", 24],
      ["radius-md", "--radius-md", 32],
      ["radius-lg", "--radius-lg", 40],
      ["radius-xl", "--radius-xl", 48],
    ]);

    const { container } = mountEditor(editor);
    await nextTick();

    const rendered = sliders(container);
    expect(rendered, "one slider per number slot, and only those").toHaveLength(4);
    expect(rendered.map((s) => s.max)).toEqual(["24", "32", "40", "48"]);
    // aria-label carries the LOCALIZED slot label — never the raw
    // `hikari::theme.groups.<id>.<key>` message key or a stringified label
    // map. The expectation is read BACK FROM THE REGISTRY rather than
    // re-typed here: a second hand-copied list would go red on a pure copy
    // edit while the seam stayed intact, which is the drift class this repo
    // keeps retiring (see styles/channelFallbacks.test.ts). The controls
    // below still pin the seam itself.
    const expectedLabels = (shape!.slots ?? []).map((slot) =>
      theme.resolveLocalizedText(slot.label, "en"),
    );
    expect(rendered.map((s) => s.label)).toEqual(expectedLabels);
    for (const { label } of rendered) {
      expect(label).not.toContain("hikari::");
      expect(label).not.toContain("[object Object]");
      expect(label!.length).toBeGreaterThan(0);
    }
    // Current values, unit-formatted the same way the cssvar is written.
    expect(rendered.map((s) => s.valueNow)).toEqual(["4", "8", "12", "16"]);
    expect(rendered.map((s) => s.valueText)).toEqual(["4px", "8px", "12px", "16px"]);
  });

  it("routes a slider edit into the dark draft only, and into the cssvars", async () => {
    const { theme, editor } = await freshGraph();
    theme.initTheme();
    // Pin the editing tab. The editor seeds it from `effectiveMode`, which
    // under the default "system" mode resolves from the SOLAR PERIOD — so
    // without this the assertions below flip with the wall clock (they read
    // the dark side while a daytime run edits the light side). Same pin as
    // the sibling HkColorSchemeEditor.test.ts does in its beforeEach.
    theme.useTheme().setMode("dark");
    const { exposed, container } = mountEditor(editor);
    await nextTick();

    const first = container.querySelector<HTMLElement>(".hk-slider");
    expect(first, "the sm slider rendered").not.toBeNull();
    // The control's own update path (HkSlider's key handler → emit → the
    // editor's updateGroupToken), not a direct draft write.
    first!.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    await nextTick();

    const draft = exposed.value!.getDraft();
    expect(draft.groups, "getDraft() carries the initTheme()-registered group").toBeTruthy();
    expect(draft.groups!.dark!.shape["radius-sm"]).toBe(5);
    // Per-mode isolation: the light side keeps the registry default.
    expect(draft.groups!.light!.shape["radius-sm"]).toBe(4);

    // …and the edit is what the theme layer would emit for the dark mode.
    const darkVars = theme.groupTokensToCSSVars(draft.groups!.dark!);
    expect(darkVars["--radius-sm"]).toBe("5px");
    // Untouched siblings still serialize their defaults.
    expect(darkVars["--radius-md"]).toBe("8px");
    expect(darkVars["--radius-lg"]).toBe("12px");
    expect(darkVars["--radius-xl"]).toBe("16px");
    expect(theme.groupTokensToCSSVars(draft.groups!.light!)["--radius-sm"]).toBe("4px");
  });

  it("renders no slider at all when initTheme() never runs", async () => {
    // Reverse control: the same fresh graph WITHOUT initTheme(). If the
    // assertions above were true for any reason other than initTheme()
    // registering the group, this case would still show four sliders.
    const { theme, editor } = await freshGraph();
    expect(theme.getTokenGroups()).toEqual([]);

    const { container } = mountEditor(editor);
    await nextTick();

    expect(container.querySelectorAll(".hk-slider")).toHaveLength(0);
  });
});
