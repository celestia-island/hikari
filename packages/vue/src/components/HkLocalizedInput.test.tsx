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
  multiline?: boolean;
  autoGrow?: boolean;
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
        multiline: opts.multiline ?? false,
        autoGrow: opts.autoGrow ?? false,
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

/**
 * Reactive harness — a REAL v-model parent: `update:translations` /
 * `update:modelValue` flow back into the props, so the language list
 * (which renders from `props.translations`) updates live while the menu
 * stays open, exactly as in an application. One-way `mountInput` cannot
 * show that (its props never change). */
function mountReactive(opts: MountOptions = {}) {
  const events = {
    modelValue: [] as string[],
    translations: [] as Record<string, string>[],
    languagechange: [] as string[],
  };
  const container = document.createElement("div");
  document.body.appendChild(container);
  const app = createApp({
    data: () => ({
      modelValue: opts.modelValue ?? "",
      sourceLang: opts.sourceLang ?? "en",
      translations: { ...(opts.translations ?? {}) },
    }),
    render() {
      return h(HkLocalizedInput, {
        modelValue: this.modelValue,
        sourceLang: this.sourceLang,
        translations: this.translations,
        localeOptions: LOCALES,
        "onUpdate:modelValue": (v: string) => {
          this.modelValue = v;
          events.modelValue.push(v);
        },
        "onUpdate:translations": (v: Record<string, string>) => {
          this.translations = v;
          events.translations.push(v);
        },
        onLanguagechange: (code: string) => {
          events.languagechange.push(code);
        },
      });
    },
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

function queryField(container: HTMLElement): HTMLInputElement | HTMLTextAreaElement {
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

/** Language rows inside the opened menu's header list. */
function menuTags(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>(".hk-localized-input-tag")];
}

function tagLabels(): string[] {
  return menuTags().map(
    (t) => t.querySelector(".hk-localized-input-tag-label")?.textContent ?? "",
  );
}

/** The language row whose chip label is `label`. */
function tag(label: string): HTMLElement | undefined {
  return menuTags().find(
    (t) => (t.querySelector(".hk-localized-input-tag-label")?.textContent ?? "") === label,
  );
}

/** The row body (text zone — switch target) of the language row. */
function tagBody(label: string): HTMLButtonElement | undefined {
  return tag(label)?.querySelector<HTMLButtonElement>(".hk-localized-input-tag-body") ?? undefined;
}

/** The language chip (arm-delete target) of the row. */
function tagLocale(label: string): HTMLButtonElement | undefined {
  return tag(label)?.querySelector<HTMLButtonElement>(".hk-localized-input-tag-locale") ?? undefined;
}

/** The confirm × on the row. */
function tagX(label: string): HTMLButtonElement | undefined {
  return tag(label)?.querySelector<HTMLButtonElement>(".hk-localized-input-tag-x") ?? undefined;
}

/** Full two-step erase: arm via the chip, then confirm on the ×. The
 *  TransitionGroup keeps the leaving row mounted through its leave window
 *  (jsdom has no CSS engine, so the ghost clears on the next-frame
 *  fallback) — poll until the row is really gone. */
async function eraseViaArm(container: HTMLElement, label: string) {
  tagLocale(label)!.click();
  await nextTick();
  expect(tag(label)?.hasAttribute("data-armed"), "row is armed before the confirm ×").toBe(true);
  tagX(label)!.click();
  await nextTick();
  await nextTick();
  const deadline = Date.now() + 800;
  while (tag(label) && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 10));
    await nextTick();
  }
}

/** Wait for the menu's leave-transition window to finish — rows linger
 *  briefly after a close while the popout animates shut. */
async function untilMenuSettled(): Promise<void> {
  const deadline = Date.now() + 800;
  while (menuRows().length > 0 && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 10));
    await nextTick();
  }
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

  it("carries the locale code only inside the opened menu rows", async () => {
    const { container } = mountInput({
      modelValue: "Plant overview",
      translations: { en: "Plant overview", "zh-Hans": "工厂总览" },
    });
    // The chip stays code-free while the menu is closed.
    expect(queryChip(container).textContent).not.toContain("(zh-Hans)");
    await openMenu(container);
    // Rows show the bare label plus a small code suffix — no parens form.
    const row = tag("简体中文");
    expect(row, "row for the filled translation renders").toBeTruthy();
    expect(row!.querySelector(".hk-localized-input-tag-code")?.textContent).toBe("zh-Hans");
    expect(row!.textContent).not.toContain("(zh-Hans)");
    // "Add language" cascade children still carry the parenthesized code.
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

  it("renders a row for every language, including the one being edited — text left, chip right", async () => {
    const { container } = mountInput({
      modelValue: "Plant overview",
      translations: { en: "Plant overview", "zh-Hans": "工厂总览" },
    });
    await openMenu(container);
    // Every language in the map is a row — the edited one included, marked active.
    expect(tagLabels()).toEqual(expect.arrayContaining(["English", "简体中文"]));
    const activeTag = menuTags().find((t) => t.hasAttribute("data-active"));
    expect(activeTag?.querySelector(".hk-localized-input-tag-label")?.textContent).toBe("English");
    // LEFT = the translation text, RIGHT = the language chip.
    const zhRow = tag("简体中文")!;
    const text = zhRow.querySelector(".hk-localized-input-tag-text")!;
    expect(text.textContent).toBe("工厂总览");
    expect(text.hasAttribute("data-empty")).toBe(false);
    const enRow = tag("English")!;
    expect(
      enRow.querySelector(".hk-localized-input-tag-text")?.textContent,
    ).toBe("Plant overview");
    // The dedicated delete cascade is gone — rows carry their own arm/× pair.
    const allRows = menuRows().map((r) => r.textContent ?? "");
    expect(allRows.some((l) => l.includes("Delete language"))).toBe(false);
    expect(allRows.some((l) => l.includes("Add language"))).toBe(true);
    // One chip + one × per row.
    for (const row of menuTags()) {
      expect(row.querySelector(".hk-localized-input-tag-locale"), "chip on every row").toBeTruthy();
      expect(row.querySelector(".hk-localized-input-tag-x"), "confirm × on every row").toBeTruthy();
    }
  });

  it("lists the edited language even while it holds no translation (empty glyph)", async () => {
    const { container } = mountInput({ modelValue: "Plant overview" });
    await openMenu(container);
    // The field edits English with nothing stored yet — still listed.
    expect(tagLabels()).toEqual(["English"]);
    const row = tag("English")!;
    const text = row.querySelector(".hk-localized-input-tag-text")!;
    expect(text.textContent).toBe("—");
    expect(text.hasAttribute("data-empty")).toBe(true);
    expect(row.hasAttribute("data-active")).toBe(true);
  });

  it("switches to an existing language via its row body: commits text, loads its value, closes the menu", async () => {
    const { events, container } = mountInput({
      modelValue: "Plant overview",
      translations: { en: "Plant overview", "zh-Hans": "工厂总览" },
    });
    await openMenu(container);
    const body = tagBody("简体中文");
    expect(body).toBeTruthy();
    body!.click();
    await nextTick();
    await nextTick();
    expect(events.modelValue.at(-1)).toBe("工厂总览");
    expect(events.languagechange.at(-1)).toBe("zh-Hans");
    expect(events.translations.at(-1)).toMatchObject({ en: "Plant overview" });
    expect(queryChip(container).textContent).toContain("简体中文");
    expect(queryChip(container).textContent).not.toContain("(zh-Hans)");
    // Menu closed after the switch (rows linger briefly through
    // the popout's close animation).
    await untilMenuSettled();
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
    await untilMenuSettled();
    expect(menuRows().length).toBe(0);
  });

  it("disables the chip when the catalog is exhausted", () => {
    // Exhausted = nothing the menu could offer: no translation to
    // switch to or erase (empty map), and no language left to add
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

  it("keeps the chip enabled when only translations remain (no addable language)", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const app = createApp({
      render: () =>
        h(HkLocalizedInput, {
          modelValue: "Plant overview",
          sourceLang: "en",
          translations: { en: "Plant overview" },
          localeOptions: [{ code: "en", label: "English" }],
        }),
    });
    app.mount(container);
    mounts.push({ app, container });
    expect(queryChip(container).disabled).toBe(false);
    await openMenu(container);
    // Only the current language's row remains in the list.
    expect(tagLabels()).toEqual(["English"]);
  });

  it("keeps edits on the switched-from language when the text is blank", async () => {
    const { events, container } = mountInput({
      modelValue: "",
      translations: { "zh-Hans": "工厂总览" },
    });
    await openMenu(container);
    const body = tagBody("简体中文");
    body!.click();
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
    const body = tagBody("简体中文");
    body!.click();
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

  it("renders tag flags when the catalog provides them", async () => {
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
    const row = tag("简体中文");
    expect(row?.querySelector(".hk-localized-input-tag-flag")?.textContent).toBe("🇨🇳");
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

  it("arms only the tapped row and disarms it on a second tap", async () => {
    const { container } = mountInput({
      modelValue: "Plant overview",
      translations: { en: "Plant overview", "zh-Hans": "工厂总览" },
    });
    await openMenu(container);
    tagLocale("简体中文")!.click();
    await nextTick();
    expect(tag("简体中文")?.hasAttribute("data-armed")).toBe(true);
    expect(tag("English")?.hasAttribute("data-armed")).toBe(false);
    // Tapping the same chip again disarms.
    tagLocale("简体中文")!.click();
    await nextTick();
    expect(tag("简体中文")?.hasAttribute("data-armed")).toBe(false);
    // Arming a sibling disarms the previous row.
    tagLocale("简体中文")!.click();
    await nextTick();
    tagLocale("English")!.click();
    await nextTick();
    expect(tag("English")?.hasAttribute("data-armed")).toBe(true);
    expect(tag("简体中文")?.hasAttribute("data-armed")).toBe(false);
  });

  it("keeps the confirm × out of the tab order until the row is armed", async () => {
    const { container } = mountInput({
      modelValue: "Plant overview",
      translations: { en: "Plant overview", "zh-Hans": "工厂总览" },
    });
    await openMenu(container);
    const x = tagX("简体中文")!;
    // Disarmed: not tabbable, hidden from AT — the arm step is the guard.
    expect(x.tabIndex).toBe(-1);
    expect(x.getAttribute("aria-hidden")).toBe("true");
    // Arm: the × becomes the next tab stop and announces itself.
    tagLocale("简体中文")!.click();
    await nextTick();
    expect(x.tabIndex).toBe(0);
    expect(x.hasAttribute("aria-hidden")).toBe(false);
  });

  it("names the row body by its action and the arm/confirm controls by their step", async () => {
    const { container } = mountInput({
      modelValue: "Plant overview",
      translations: { en: "Plant overview", "zh-Hans": "工厂总览" },
    });
    await openMenu(container);
    expect(tagBody("简体中文")?.getAttribute("aria-label")).toBe("Switch to 简体中文 (zh-Hans)");
    // The chip labels the ARM step (Remove translation), the × the
    // confirm step (Confirm delete).
    expect(tagLocale("简体中文")?.getAttribute("aria-label")).toBe(
      "Remove translation — 简体中文 (zh-Hans)",
    );
    expect(tagX("简体中文")?.getAttribute("aria-label")).toBe(
      "Confirm delete — 简体中文 (zh-Hans)",
    );
  });

  it("disarms every row when the menu closes", async () => {
    const { container } = mountInput({
      modelValue: "Plant overview",
      translations: { en: "Plant overview", "zh-Hans": "工厂总览" },
    });
    await openMenu(container);
    tagLocale("简体中文")!.click();
    await nextTick();
    expect(tag("简体中文")?.hasAttribute("data-armed")).toBe(true);
    // Close the menu, then reopen it: the armed state must not survive —
    // a stale armed row would turn the next open into an armed delete
    // waiting to fire.
    queryChip(container).click();
    await nextTick();
    await nextTick();
    queryChip(container).click();
    await nextTick();
    await nextTick();
    expect(tag("简体中文")?.hasAttribute("data-armed")).toBe(false);
    expect(tag("English")?.hasAttribute("data-armed")).toBe(false);
  });

  it("erases a non-current translation via arm → confirm × and keeps the menu open", async () => {
    const { events, container } = mountReactive({
      modelValue: "Plant overview",
      translations: { en: "Plant overview", "zh-Hans": "工厂总览" },
    });
    await openMenu(container);
    await eraseViaArm(container, "简体中文");
    // The map loses only the erased language; no edit-state events fire.
    expect(events.translations.at(-1)).toEqual({ en: "Plant overview" });
    expect(events.modelValue).toEqual([]);
    expect(events.languagechange).toEqual([]);
    expect(queryField(container).value).toBe("Plant overview");
    expect(queryChip(container).textContent).toContain("English");
    // The menu STAYS open and the list updates live.
    expect(tagLabels()).toEqual(["English"]);
    expect(menuRows().some((r) => (r.textContent ?? "").includes("Add language"))).toBe(true);
  });

  it("erases several translations in one pass while the menu stays open", async () => {
    const { events, container } = mountReactive({
      modelValue: "Plant overview",
      translations: { en: "Plant overview", "zh-Hans": "工厂总览", ja: "プラント概覧" },
    });
    await openMenu(container);
    await eraseViaArm(container, "简体中文");
    await eraseViaArm(container, "日本語");
    expect(events.translations.at(-1)).toEqual({ en: "Plant overview" });
    expect(tagLabels()).toEqual(["English"]);
  });

  it("falls back to the source language when the edited language is erased", async () => {
    const { events, container } = mountReactive({
      modelValue: "Plant overview",
      sourceLang: "en",
      translations: { en: "Plant overview", "zh-Hans": "工厂总览" },
    });
    // Switch to zh-Hans first so erasing it means erasing the edited
    // language while the source still holds a translation.
    await openMenu(container);
    tagBody("简体中文")!.click();
    await nextTick();
    await nextTick();
    expect(queryChip(container).textContent).toContain("简体中文");
    expect(queryChip(container).textContent).not.toContain("(zh-Hans)");
    await openMenu(container);
    await eraseViaArm(container, "简体中文");
    expect(events.translations.at(-1)).toEqual({ en: "Plant overview" });
    expect(events.modelValue.at(-1)).toBe("Plant overview");
    expect(events.languagechange.at(-1)).toBe("en");
    expect(queryChip(container).textContent).toContain("English");
    expect(queryChip(container).textContent).not.toContain("(en)");
    // The menu stays open after an erase.
    expect(tagLabels()).toEqual(["English"]);
  });

  it("falls back to the first remaining translation when the source language is erased", async () => {
    const { events, container } = mountReactive({
      modelValue: "Plant overview",
      sourceLang: "en",
      translations: { en: "Plant overview", "zh-Hans": "工厂总览" },
    });
    await openMenu(container);
    await eraseViaArm(container, "English");
    expect(events.translations.at(-1)).toEqual({ "zh-Hans": "工厂总览" });
    expect(events.modelValue.at(-1)).toBe("工厂总览");
    expect(events.languagechange.at(-1)).toBe("zh-Hans");
    expect(queryChip(container).textContent).toContain("简体中文");
    expect(queryChip(container).textContent).not.toContain("(zh-Hans)");
  });

  it("erases the last translation and empties the field", async () => {
    const { events, container } = mountReactive({
      modelValue: "Plant overview",
      translations: { en: "Plant overview" },
    });
    await openMenu(container);
    await eraseViaArm(container, "English");
    expect(events.translations.at(-1)).toEqual({});
    expect(events.modelValue.at(-1)).toBe("");
    // The edited language row stays (empty glyph); the menu stays open.
    expect(tagLabels()).toEqual(["English"]);
    expect(tag("English")?.querySelector(".hk-localized-input-tag-text")?.textContent).toBe("—");
    expect(menuRows().some((r) => (r.textContent ?? "").includes("Add language"))).toBe(true);
  });

  it("dismisses the menu when the active row's body is clicked", async () => {
    const { container } = mountInput({
      modelValue: "Plant overview",
      translations: { en: "Plant overview", "zh-Hans": "工厂总览" },
    });
    await openMenu(container);
    tagBody("English")!.click();
    await nextTick();
    await nextTick();
    await untilMenuSettled();
    expect(menuRows().length).toBe(0);
    expect(menuTags().length).toBe(0);
  });

  it("multiline renders a textarea with the chip intact", () => {
    const { container } = mountInput({ modelValue: "Plant overview", multiline: true });
    const root = container.querySelector<HTMLElement>(".hk-localized-input");
    expect(root?.hasAttribute("data-multiline")).toBe(true);
    const ta = container.querySelector("textarea.hk-input-element");
    expect(ta, "multiline switches the field to a textarea").toBeTruthy();
    expect(ta!.textContent).toBe("");
    expect((ta as HTMLTextAreaElement).value).toBe("Plant overview");
    expect(queryChip(container).textContent).toContain("English");
  });

  it("multiline commits values with inner newlines preserved", async () => {
    const { events, container } = mountInput({ modelValue: "", multiline: true, autoGrow: true });
    const ta = queryField(container) as HTMLTextAreaElement;
    ta.value = "Line one\nLine two";
    ta.dispatchEvent(new Event("input", { bubbles: true }));
    await nextTick();
    expect(events.modelValue.at(-1)).toBe("Line one\nLine two");
    expect(events.translations.at(-1)).toEqual({ en: "Line one\nLine two" });
  });
});
