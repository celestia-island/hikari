import { afterEach, describe, expect, it } from "vitest";
import { createApp, h, nextTick } from "vue";

import { HkLocalizedInput } from "./HkLocalizedInput";

const LOCALES = [
  { code: "en", label: "English" },
  { code: "zh-Hans", label: "简体中文" },
  { code: "ja", label: "日本語" },
];

interface MountOptions {
  modelValue?: string;
  sourceLang?: string;
  translations?: Record<string, string>;
}

const mounts: Array<{ app: ReturnType<typeof createApp>; container: HTMLElement }> = [];

function mountInput(opts: MountOptions = {}) {
  const events = {
    modelValue: [] as string[],
    translations: [] as Record<string, string>[],
    languagechange: [] as string[],
  };
  const container = document.createElement("div");
  document.body.appendChild(container);
  const app = createApp({
    render: () =>
      h(HkLocalizedInput, {
        modelValue: opts.modelValue ?? "",
        sourceLang: opts.sourceLang ?? "en",
        translations: opts.translations ?? {},
        localeOptions: LOCALES,
        "onUpdate:modelValue": (v: string) => {
          events.modelValue.push(v);
        },
        "onUpdate:translations": (v: Record<string, string>) => {
          events.translations.push(v);
        },
        onLanguagechange: (code: string) => {
          events.languagechange.push(code);
        },
      }),
  });
  app.mount(container);
  mounts.push({ app, container });
  return { events, container };
}

function queryChip(container: HTMLElement): HTMLButtonElement {
  const chip = container.querySelector<HTMLButtonElement>(".hk-localized-input-chip");
  expect(chip, "language chip renders inside the input suffix").toBeTruthy();
  return chip!;
}

function queryField(container: HTMLElement): HTMLInputElement {
  const field = container.querySelector<HTMLInputElement>(".hk-input-element");
  expect(field).toBeTruthy();
  return field!;
}

async function openMenu(container: HTMLElement) {
  queryChip(container).click();
  await nextTick();
  await nextTick();
}

function menuRows(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLButtonElement>(".hk-menu-row")];
}

/** The "Delete language" cascade root row (present only when at least
 *  one translation is filled). */
function deleteCascadeRow(): HTMLElement | undefined {
  return menuRows().find((r) => (r.textContent ?? "").includes("Delete language"));
}

/** Click the cascade root so its danger child rows render. */
async function openDeleteCascade() {
  const root = deleteCascadeRow();
  expect(root, "delete-language cascade root row renders").toBeTruthy();
  root!.click();
  await nextTick();
  await nextTick();
}

/** Open the delete cascade, then click the danger child row for `code`. */
async function clickDeleteRow(label: string) {
  await openDeleteCascade();
  const child = menuRows().find(
    (r) => (r.textContent ?? "").includes(label) && r.hasAttribute("data-danger"),
  );
  expect(child, `danger delete row for ${label} renders`).toBeTruthy();
  child!.click();
  await nextTick();
  await nextTick();
}

afterEach(() => {
  for (const { app, container } of mounts.splice(0)) {
    app.unmount();
    container.remove();
  }
  document.body.innerHTML = "";
});

describe("HkLocalizedInput", () => {
  it("shows only the language label on the chip, never the code", () => {
    const { container } = mountInput({ modelValue: "Plant overview" });
    expect(queryChip(container).textContent).toContain("English");
    expect(queryChip(container).textContent).not.toContain("(en)");
    expect(queryField(container).value).toBe("Plant overview");
  });

  it("carries the locale code only in the opened menu rows", async () => {
    const { container } = mountInput({
      modelValue: "Plant overview",
      translations: { en: "Plant overview", "zh-Hans": "工厂总览" },
    });
    // The chip stays code-free while the menu is closed.
    expect(queryChip(container).textContent).not.toContain("(zh-Hans)");
    await openMenu(container);
    const labels = menuRows().map((r) => r.textContent ?? "");
    // Switch-level rows read "label (code)".
    expect(labels.some((l) => l.includes("简体中文 (zh-Hans)"))).toBe(true);
    // "Add language" cascade children carry the code too.
    const addRow = menuRows().find((r) => (r.textContent ?? "").includes("Add language"));
    addRow!.click();
    await nextTick();
    await nextTick();
    const childLabels = menuRows().map((r) => r.textContent ?? "");
    expect(childLabels.some((l) => l.includes("日本語 (ja)"))).toBe(true);
    // Filled languages are not offered in the add cascade.
    expect(childLabels.some((l) => l.includes("English (en)"))).toBe(false);
    // The chip STILL shows no code while the menu is open.
    expect(queryChip(container).textContent).not.toContain("(");
  });

  it("commits the edited text into translations on every input", async () => {
    const { events, container } = mountInput({ modelValue: "" });
    const field = queryField(container);
    field.value = "Plant overview";
    field.dispatchEvent(new Event("input", { bubbles: true }));
    await nextTick();
    expect(events.modelValue.at(-1)).toBe("Plant overview");
    expect(events.translations.at(-1)).toEqual({ en: "Plant overview" });
  });

  it("prunes empty values from the translations map", async () => {
    const { events, container } = mountInput({ modelValue: "Plant overview" });
    const field = queryField(container);
    field.value = "  ";
    field.dispatchEvent(new Event("input", { bubbles: true }));
    await nextTick();
    expect(events.translations.at(-1)?.en).toBeUndefined();
  });

  it("lists existing translations and an add-language cascade in the menu", async () => {
    const { container } = mountInput({
      modelValue: "Plant overview",
      translations: { en: "Plant overview", "zh-Hans": "工厂总览" },
    });
    await openMenu(container);
    const labels = menuRows().map((r) => r.textContent ?? "");
    expect(labels.some((l) => l.includes("简体中文"))).toBe(true);
    // The currently edited language is not offered as a switch target.
    expect(labels.some((l) => l.includes("English"))).toBe(false);
    expect(labels.some((l) => l.includes("Add language"))).toBe(true);
  });

  it("switches to an existing language: commits text, loads its value, closes the menu", async () => {
    const { events, container } = mountInput({
      modelValue: "Plant overview",
      translations: { en: "Plant overview", "zh-Hans": "工厂总览" },
    });
    await openMenu(container);
    const row = menuRows().find((r) => (r.textContent ?? "").includes("简体中文"));
    expect(row).toBeTruthy();
    row!.click();
    await nextTick();
    await nextTick();
    expect(events.modelValue.at(-1)).toBe("工厂总览");
    expect(events.languagechange.at(-1)).toBe("zh-Hans");
    expect(events.translations.at(-1)).toMatchObject({ en: "Plant overview" });
    expect(queryChip(container).textContent).toContain("简体中文");
    expect(queryChip(container).textContent).not.toContain("(zh-Hans)");
    // Menu closed after the switch.
    expect(menuRows().length).toBe(0);
  });

  it("adds a fresh language via the cascade: closes menu, empty field, chip follows", async () => {
    const { events, container } = mountInput({
      modelValue: "Plant overview",
      translations: { en: "Plant overview" },
    });
    await openMenu(container);
    const addRow = menuRows().find((r) => (r.textContent ?? "").includes("Add language"));
    expect(addRow).toBeTruthy();
    addRow!.click();
    await nextTick();
    await nextTick();
    // Cascade child rows render for the not-yet-added languages.
    const jaRow = menuRows().find((r) => (r.textContent ?? "").includes("日本語"));
    expect(jaRow).toBeTruthy();
    jaRow!.click();
    await nextTick();
    await nextTick();
    expect(events.modelValue.at(-1)).toBe("");
    expect(events.languagechange.at(-1)).toBe("ja");
    expect(events.translations.at(-1)).toMatchObject({ en: "Plant overview" });
    expect(queryChip(container).textContent).toContain("日本語");
    expect(queryChip(container).textContent).not.toContain("(ja)");
    expect(menuRows().length).toBe(0);
  });

  it("disables the chip when the catalog is exhausted", () => {
    // Exhausted = nothing the menu could offer: no translation to
    // switch to or delete (empty map), and no language left to add
    // (single-language catalog whose only entry is the source language).
    const container = document.createElement("div");
    document.body.appendChild(container);
    const app = createApp({
      render: () =>
        h(HkLocalizedInput, {
          modelValue: "",
          sourceLang: "en",
          translations: {},
          localeOptions: [{ code: "en", label: "English" }],
        }),
    });
    app.mount(container);
    mounts.push({ app, container });
    expect(queryChip(container).disabled).toBe(true);
  });

  it("keeps edits on the switched-from language when the text is blank", async () => {
    const { events, container } = mountInput({
      modelValue: "",
      translations: { "zh-Hans": "工厂总览" },
    });
    await openMenu(container);
    const row = menuRows().find((r) => (r.textContent ?? "").includes("简体中文"));
    row!.click();
    await nextTick();
    await nextTick();
    // No empty "en" key is committed.
    expect(events.translations.at(-1)?.en).toBeUndefined();
    expect(events.modelValue.at(-1)).toBe("工厂总览");
  });

  it("focuses the field after switching languages", async () => {
    const { container } = mountInput({
      modelValue: "Plant overview",
      translations: { en: "Plant overview", "zh-Hans": "工厂总览" },
    });
    await openMenu(container);
    const row = menuRows().find((r) => (r.textContent ?? "").includes("简体中文"));
    row!.click();
    await nextTick();
    await nextTick();
    await nextTick();
    expect(document.activeElement).toBe(queryField(container));
  });

  it("edits the switched-to language: new keystrokes land on it", async () => {
    const { events, container } = mountInput({
      modelValue: "Plant overview",
      translations: { en: "Plant overview" },
    });
    await openMenu(container);
    const addRow = menuRows().find((r) => (r.textContent ?? "").includes("Add language"));
    addRow!.click();
    await nextTick();
    await nextTick();
    const jaRow = menuRows().find((r) => (r.textContent ?? "").includes("日本語"));
    jaRow!.click();
    await nextTick();
    await nextTick();
    const field = queryField(container);
    field.value = "プラント概覧";
    field.dispatchEvent(new Event("input", { bubbles: true }));
    await nextTick();
    expect(events.translations.at(-1)).toMatchObject({
      en: "Plant overview",
      ja: "プラント概覧",
    });
  });

  it("trims values on commit so storage never diverges from display", async () => {
    const { events, container } = mountInput({ modelValue: "" });
    const field = queryField(container);
    field.value = "  Plant overview  ";
    field.dispatchEvent(new Event("input", { bubbles: true }));
    await nextTick();
    expect(events.translations.at(-1)?.en).toBe("Plant overview");
  });

  it("renders menu-row flags when the catalog provides them", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const app = createApp({
      render: () =>
        h(HkLocalizedInput, {
          modelValue: "Plant overview",
          sourceLang: "en",
          translations: { en: "Plant overview", "zh-Hans": "工厂总览" },
          localeOptions: [
            { code: "en", label: "English", flag: "🇬🇧" },
            { code: "zh-Hans", label: "简体中文", flag: "🇨🇳" },
          ],
        }),
    });
    app.mount(container);
    mounts.push({ app, container });
    await openMenu(container);
    const row = menuRows().find((r) => (r.textContent ?? "").includes("简体中文"));
    expect(row?.querySelector(".hk-menu-flag")?.textContent).toBe("🇨🇳");
  });

  it("follows a sourceLang change without stealing focus", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const events: string[] = [];
    const app = createApp({
      data: () => ({
        modelValue: "Plant overview",
        sourceLang: "en",
        translations: { en: "Plant overview", "zh-Hans": "工厂总览" },
      }),
      render() {
        return h(HkLocalizedInput, {
          modelValue: this.modelValue,
          sourceLang: this.sourceLang,
          translations: this.translations,
          localeOptions: LOCALES,
          "onUpdate:modelValue": (v: string) => {
            this.modelValue = v;
          },
          onLanguagechange: (code: string) => events.push(code),
        });
      },
    });
    app.mount(container);
    mounts.push({ app, container });
    // Simulate an app-level locale switch mid-edit.
    const state = app._instance?.proxy as unknown as {
      sourceLang: string;
    };
    state.sourceLang = "zh-Hans";
    await nextTick();
    await nextTick();
    expect(events.at(-1)).toBe("zh-Hans");
    expect(queryField(container).value).toBe("工厂总览");
    expect(document.activeElement).not.toBe(queryField(container));
  });

  it("offers a delete-language cascade listing every filled language as danger rows", async () => {
    const { container } = mountInput({
      modelValue: "Plant overview",
      translations: { en: "Plant overview", "zh-Hans": "工厂总览" },
    });
    await openMenu(container);
    await openDeleteCascade();
    // Every filled language is offered — including the edited one.
    const dangerLabels = menuRows()
      .filter((r) => r.hasAttribute("data-danger"))
      .map((r) => r.querySelector(".hk-menu-label")?.textContent ?? "");
    expect(dangerLabels).toEqual(expect.arrayContaining(["English (en)", "简体中文 (zh-Hans)"]));
  });

  it("deletes a non-current language and keeps the edit state untouched", async () => {
    const { events, container } = mountInput({
      modelValue: "Plant overview",
      translations: { en: "Plant overview", "zh-Hans": "工厂总览" },
    });
    await openMenu(container);
    await clickDeleteRow("简体中文");
    // The map loses only the deleted language; no edit-state events fire.
    expect(events.translations.at(-1)).toEqual({ en: "Plant overview" });
    expect(events.modelValue).toEqual([]);
    expect(events.languagechange).toEqual([]);
    expect(queryField(container).value).toBe("Plant overview");
    expect(queryChip(container).textContent).toContain("English");
    expect(queryChip(container).textContent).not.toContain("(en)");
    expect(menuRows().length).toBe(0);
  });

  it("falls back to the source language when the edited language is deleted", async () => {
    const { events, container } = mountInput({
      modelValue: "Plant overview",
      sourceLang: "en",
      translations: { en: "Plant overview", "zh-Hans": "工厂总览" },
    });
    // Switch to zh-Hans first so deleting it means deleting the edited
    // language while the source still holds a translation.
    await openMenu(container);
    const row = menuRows().find((r) => (r.textContent ?? "").includes("简体中文"));
    row!.click();
    await nextTick();
    await nextTick();
    expect(queryChip(container).textContent).toContain("简体中文");
    expect(queryChip(container).textContent).not.toContain("(zh-Hans)");
    await openMenu(container);
    await clickDeleteRow("简体中文");
    await nextTick();
    expect(events.translations.at(-1)).toEqual({ en: "Plant overview" });
    expect(events.modelValue.at(-1)).toBe("Plant overview");
    expect(events.languagechange.at(-1)).toBe("en");
    expect(queryChip(container).textContent).toContain("English");
    expect(queryChip(container).textContent).not.toContain("(en)");
    expect(menuRows().length).toBe(0);
    expect(document.activeElement).toBe(queryField(container));
  });

  it("falls back to the first remaining translation when the source language is the one deleted", async () => {
    const { events, container } = mountInput({
      modelValue: "Plant overview",
      sourceLang: "en",
      translations: { en: "Plant overview", "zh-Hans": "工厂总览" },
    });
    await openMenu(container);
    await clickDeleteRow("English");
    expect(events.translations.at(-1)).toEqual({ "zh-Hans": "工厂总览" });
    expect(events.modelValue.at(-1)).toBe("工厂总览");
    expect(events.languagechange.at(-1)).toBe("zh-Hans");
    expect(queryChip(container).textContent).toContain("简体中文");
    expect(queryChip(container).textContent).not.toContain("(zh-Hans)");
  });

  it("deletes the last translation and empties the field", async () => {
    const { events, container } = mountInput({
      modelValue: "Plant overview",
      translations: { en: "Plant overview" },
    });
    await openMenu(container);
    await clickDeleteRow("English");
    expect(events.translations.at(-1)).toEqual({});
    expect(events.modelValue.at(-1)).toBe("");
  });

  it("hides the delete cascade when no translation is filled", async () => {
    const { container } = mountInput({ modelValue: "" });
    await openMenu(container);
    const labels = menuRows().map((r) => r.textContent ?? "");
    expect(labels.some((l) => l.includes("Delete language"))).toBe(false);
  });
});
