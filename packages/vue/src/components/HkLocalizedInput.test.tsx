import { afterEach, describe, expect, it } from "vitest";
import { createApp, h, nextTick } from "vue";

import { HkLocalizedInput } from "./HkLocalizedInput";

/** Regional-indicator flag pair for an ISO 3166-1 alpha-2 code, built
 * from code points (same derivation as data/dialCodes flagEmoji) so the
 * test source itself carries no literal emoji. */
const flagOf = (iso: string): string =>
  String.fromCodePoint(
    ...Array.from(iso.toUpperCase(), (c) => 0x1f1e6 + c.charCodeAt(0) - 65),
  );

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
 * (which renders from `props.translations`) updates live while the
 * popup stays open, exactly as in an application. One-way `mountInput`
 * cannot show that (its props never change). */
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

async function openPicker(container: HTMLElement) {
  queryChip(container).click();
  await nextTick();
  await nextTick();
}

/** Addable-language rows inside the opened popup's pick list. */
function pickerRows(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>(".hk-affix-row")];
}

/** Language tags of the already-present translations. */
function pickerTags(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>(".hk-affix-tag")];
}

function tagLabels(): string[] {
  return pickerTags().map(
    (t) => t.querySelector(".hk-affix-tag-text")?.textContent ?? "",
  );
}

/** The tag whose label is `label`. */
function tag(label: string): HTMLElement | undefined {
  return pickerTags().find(
    (t) => (t.querySelector(".hk-affix-tag-text")?.textContent ?? "") === label,
  );
}

/** The tag body (switch target) of the language tag. */
function tagBody(label: string): HTMLButtonElement | undefined {
  return tag(label)?.querySelector<HTMLButtonElement>(".hk-affix-tag-body") ?? undefined;
}

/** The × of the language tag (opens the confirm dialog). */
function tagX(label: string): HTMLButtonElement | undefined {
  return tag(label)?.querySelector<HTMLButtonElement>(".hk-affix-tag-x") ?? undefined;
}

/** The message box's confirm/cancel buttons (mounted at body level). */
function boxButton(confirm: boolean): HTMLButtonElement {
  const selector = confirm ? ".hk-message-box-confirm" : ".hk-message-box-actions button:not(.hk-message-box-confirm)";
  const btn = document.body.querySelector<HTMLButtonElement>(selector);
  expect(btn, `message box ${confirm ? "confirm" : "cancel"} button renders`).toBeTruthy();
  return btn!;
}

/** Full erase flow: the × opens the shared confirm dialog naming the
 *  entry; the dialog's Confirm erases. The leaving tag lingers through
 *  its transition window (jsdom has no CSS engine, so the ghost clears
 *  on the next-frame fallback) — poll until the tag is really gone. */
/** Poll until the condition turns truthy (box leave animations and
 *  tag transitions lag a few frames behind the click). */
async function until(condition: () => boolean, what: string): Promise<void> {
  const deadline = Date.now() + 1500;
  while (!condition() && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 10));
    await nextTick();
  }
  expect(condition(), `${what} within the deadline`).toBe(true);
}

/** Wait until the confirm dialog is mounted and naming the entry —
 *  the box rides HkModal's multi-frame open transition. */
async function untilBoxOpen(label: string): Promise<void> {
  const deadline = Date.now() + 1500;
  while (Date.now() < deadline) {
    const text = document.body.querySelector(".hk-message-box-text")?.textContent ?? "";
    if (text.includes(label)) {
      // One extra frame so sibling re-renders (scrollbar lock, panel
      // reposition) triggered by the modal settle too.
      await new Promise((resolve) => setTimeout(resolve, 30));
      await nextTick();
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
    await nextTick();
  }
  expect(
    document.body.querySelector(".hk-message-box-text")?.textContent ?? "",
    `confirm dialog showing "${label}"`,
  ).toContain(label);
}

async function eraseViaConfirm(label: string, tagGone = true) {
  tagX(label)!.click();
  await untilBoxOpen(label);
  boxButton(true).click();
  await until(() => !document.body.querySelector(".hk-message-box-text"), "dialog closes on confirm");
  // The edited language's tag deliberately survives its own erase when
  // no other language remains (it stays as the active tag), so the
  // absence wait only applies to genuinely-removed entries.
  if (tagGone) {
    await until(() => !tag(label), `tag "${label}" erased`);
  } else {
    await nextTick();
    await nextTick();
  }
}

/** Wait for the popup's leave-transition window to finish — rows linger
 *  briefly after a close while the popout animates shut. */
async function untilPickerSettled(): Promise<void> {
  const deadline = Date.now() + 1500;
  while (pickerRows().length > 0 && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 10));
    await nextTick();
  }
}

async function typeIntoSearch(value: string) {
  const input = document.querySelector<HTMLInputElement>(".hk-affix-search input");
  expect(input, "search field renders").toBeTruthy();
  input!.value = value;
  input!.dispatchEvent(new Event("input", { bubbles: true }));
  await nextTick();
  await nextTick();
}

/** Dismiss every open message box and wait out its host's self-unmount
 *  (leave transition + timer) so no zombie app re-renders into the next
 *  test's DOM. No-op when a test never opened one. */
async function teardownMessageBoxes() {
  if (!document.body.querySelector(".hk-message-box-confirm")) return;
  for (const btn of [...document.body.querySelectorAll<HTMLButtonElement>(".hk-message-box-confirm")]) {
    btn.click();
  }
  const deadline = Date.now() + 2500;
  // The modal root (not just the confirm button) must be gone: the
  // leave transition + cleanup timer fully unmount the host app, so no
  // zombie registration lingers in the shared popup stack.
  while (
    (document.body.querySelector(".hk-message-box-confirm") ||
      document.body.querySelector(".hk-modal-root")) &&
    Date.now() < deadline
  ) {
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

afterEach(async () => {
  await teardownMessageBoxes();
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

  it("carries the locale code only inside the opened popup", async () => {
    const { container } = mountInput({
      modelValue: "Plant overview",
      translations: { en: "Plant overview", "zh-Hans": "工厂总览" },
    });
    // The chip stays code-free while the popup is closed.
    expect(queryChip(container).textContent).not.toContain("(zh-Hans)");
    await openPicker(container);
    // Tags show the bare label plus a muted code suffix — no parens form.
    const zhTag = tag("简体中文");
    expect(zhTag, "tag for the filled translation renders").toBeTruthy();
    expect(zhTag!.querySelector(".hk-affix-tag-meta")?.textContent).toBe("zh-Hans");
    expect(zhTag!.textContent).not.toContain("(zh-Hans)");
    // Addable rows carry their code as the muted meta too.
    const jaRow = pickerRows().find((r) => (r.textContent ?? "").includes("日本語"));
    expect(jaRow, "addable row for the missing language renders").toBeTruthy();
    expect(jaRow!.querySelector(".hk-affix-row-meta")?.textContent).toBe("ja");
    // Filled languages are not offered as add rows.
    expect(
      pickerRows().some((r) => (r.textContent ?? "").includes("English")),
    ).toBe(false);
    // The chip STILL shows no code while the popup is open.
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

  it("renders a tag for every present language — the edited one active", async () => {
    const { container } = mountInput({
      modelValue: "Plant overview",
      translations: { en: "Plant overview", "zh-Hans": "工厂总览" },
    });
    await openPicker(container);
    // Every language in the map is a tag — the edited one marked active.
    expect(tagLabels()).toEqual(expect.arrayContaining(["English", "简体中文"]));
    const activeTag = pickerTags().find((t) => t.hasAttribute("data-active"));
    expect(activeTag?.querySelector(".hk-affix-tag-text")?.textContent).toBe("English");
    // One body + one arm/confirm × per tag.
    for (const t of pickerTags()) {
      expect(t.querySelector(".hk-affix-tag-body"), "body on every tag").toBeTruthy();
      expect(t.querySelector(".hk-affix-tag-x"), "× on every tag").toBeTruthy();
    }
    // Addable rows exist beside the tags.
    expect(pickerRows().some((r) => (r.textContent ?? "").includes("日本語"))).toBe(true);
  });

  it("lists the edited language even while it holds no translation", async () => {
    const { container } = mountInput({ modelValue: "Plant overview" });
    await openPicker(container);
    // The field edits English with nothing stored yet — still listed, active.
    expect(tagLabels()).toEqual(["English"]);
    expect(tag("English")?.hasAttribute("data-active")).toBe(true);
  });

  it("switches to an existing language via its tag body: commits text, loads its value, closes the popup", async () => {
    const { events, container } = mountInput({
      modelValue: "Plant overview",
      translations: { en: "Plant overview", "zh-Hans": "工厂总览" },
    });
    await openPicker(container);
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
    // Popup closed after the switch (rows linger briefly through the
    // popout's close animation).
    await untilPickerSettled();
    expect(pickerRows().length).toBe(0);
  });

  it("adds a fresh language from the pick list: closes, empty field, chip follows", async () => {
    const { events, container } = mountInput({
      modelValue: "Plant overview",
      translations: { en: "Plant overview" },
    });
    await openPicker(container);
    const jaRow = pickerRows().find((r) => (r.textContent ?? "").includes("日本語"));
    expect(jaRow).toBeTruthy();
    jaRow!.click();
    await nextTick();
    await nextTick();
    expect(events.modelValue.at(-1)).toBe("");
    expect(events.languagechange.at(-1)).toBe("ja");
    expect(events.translations.at(-1)).toMatchObject({ en: "Plant overview" });
    expect(queryChip(container).textContent).toContain("日本語");
    expect(queryChip(container).textContent).not.toContain("(ja)");
    await untilPickerSettled();
    expect(pickerRows().length).toBe(0);
  });

  it("search filters the addable rows live", async () => {
    const { container } = mountInput({
      modelValue: "Plant overview",
      translations: { en: "Plant overview" },
    });
    await openPicker(container);
    await typeIntoSearch("日");
    expect(pickerRows().map((r) => r.textContent)).toEqual([
      expect.stringContaining("日本語"),
    ]);
    await typeIntoSearch("zzz");
    expect(pickerRows()).toHaveLength(0);
    expect(document.querySelector(".hk-affix-empty")?.textContent).toContain(
      "No matching language",
    );
  });

  it("disables the chip when the catalog is exhausted", () => {
    // Exhausted = nothing the picker could offer: no translation to
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
    await openPicker(container);
    // Only the current language's tag remains in the list.
    expect(tagLabels()).toEqual(["English"]);
  });

  it("keeps edits on the switched-from language when the text is blank", async () => {
    const { events, container } = mountInput({
      modelValue: "",
      translations: { "zh-Hans": "工厂总览" },
    });
    await openPicker(container);
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
    await openPicker(container);
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
    await openPicker(container);
    const jaRow = pickerRows().find((r) => (r.textContent ?? "").includes("日本語"));
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
            { code: "en", label: "English", flag: flagOf("gb") },
            { code: "zh-Hans", label: "简体中文", flag: flagOf("cn") },
          ],
        }),
    });
    app.mount(container);
    mounts.push({ app, container });
    await openPicker(container);
    expect(tag("简体中文")?.querySelector(".hk-affix-tag-flag")?.textContent).toBe(flagOf("cn"));
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

  it("tag × opens the confirm dialog; Cancel keeps the translation intact", async () => {
    const { container } = mountInput({
      modelValue: "Plant overview",
      translations: { en: "Plant overview", "zh-Hans": "工厂总览" },
    });
    await openPicker(container);
    tagX("简体中文")!.click();
    await untilBoxOpen("简体中文");
    // The dialog names the entry and carries a danger-toned confirm.
    expect(boxButton(true).className).toContain("hk-btn-danger");
    // Cancel → nothing is erased, the dialog closes.
    boxButton(false).click();
    await until(() => !document.body.querySelector(".hk-message-box-text"), "dialog closes on cancel");
    await until(() => !!tag("简体中文"), "tag stays after cancel");
  });

  it("names the tag body by its switch action and the × by its remove intent", async () => {
    const { container } = mountInput({
      modelValue: "Plant overview",
      translations: { en: "Plant overview", "zh-Hans": "工厂总览" },
    });
    await openPicker(container);
    expect(tagBody("简体中文")?.getAttribute("aria-label")).toBe("Switch to 简体中文");
    expect(tagX("简体中文")?.getAttribute("aria-label")).toBe("Remove — 简体中文");
  });

  it("keeps the picker usable after a dismissed delete dialog", async () => {
    const { container } = mountInput({
      modelValue: "Plant overview",
      translations: { en: "Plant overview", "zh-Hans": "工厂总览" },
    });
    await openPicker(container);
    tagX("简体中文")!.click();
    await untilBoxOpen("简体中文");
    boxButton(false).click();
    await until(() => !document.body.querySelector(".hk-message-box-text"), "dialog closes on cancel");
    // The dialog never leaves the picker half-broken: the tag can still
    // switch the edited language right after a dismissal.
    tagBody("简体中文")!.click();
    await nextTick();
    await nextTick();
    expect(document.activeElement).toBe(queryField(container));
  });

  it("erases a non-current translation via confirm dialog and keeps the popup open", async () => {
    const { events, container } = mountReactive({
      modelValue: "Plant overview",
      translations: { en: "Plant overview", "zh-Hans": "工厂总览" },
    });
    await openPicker(container);
    await eraseViaConfirm("简体中文");
    // The map loses only the erased language; no edit-state events fire.
    expect(events.translations.at(-1)).toEqual({ en: "Plant overview" });
    expect(events.modelValue).toEqual([]);
    expect(events.languagechange).toEqual([]);
    expect(queryField(container).value).toBe("Plant overview");
    expect(queryChip(container).textContent).toContain("English");
    // The popup STAYS open and the list updates live.
    expect(tagLabels()).toEqual(["English"]);
    expect(pickerRows().some((r) => (r.textContent ?? "").includes("日本語"))).toBe(true);
  });

  it("erases several translations in one pass while the popup stays open", async () => {
    const { events, container } = mountReactive({
      modelValue: "Plant overview",
      translations: { en: "Plant overview", "zh-Hans": "工厂总览", ja: "プラント概覧" },
    });
    await openPicker(container);
    await eraseViaConfirm("简体中文");
    await eraseViaConfirm("日本語");
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
    await openPicker(container);
    tagBody("简体中文")!.click();
    await nextTick();
    await nextTick();
    expect(queryChip(container).textContent).toContain("简体中文");
    expect(queryChip(container).textContent).not.toContain("(zh-Hans)");
    await openPicker(container);
    await eraseViaConfirm("简体中文");
    expect(events.translations.at(-1)).toEqual({ en: "Plant overview" });
    expect(events.modelValue.at(-1)).toBe("Plant overview");
    expect(events.languagechange.at(-1)).toBe("en");
    expect(queryChip(container).textContent).toContain("English");
    expect(queryChip(container).textContent).not.toContain("(en)");
    // The popup stays open after an erase.
    expect(tagLabels()).toEqual(["English"]);
  });

  it("falls back to the first remaining translation when the source language is erased", async () => {
    const { events, container } = mountReactive({
      modelValue: "Plant overview",
      sourceLang: "en",
      translations: { en: "Plant overview", "zh-Hans": "工厂总览" },
    });
    await openPicker(container);
    await eraseViaConfirm("English");
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
    await openPicker(container);
    await eraseViaConfirm("English", false);
    expect(events.translations.at(-1)).toEqual({});
    expect(events.modelValue.at(-1)).toBe("");
    // The edited language tag stays (active); the popup stays open.
    expect(tagLabels()).toEqual(["English"]);
    expect(tag("English")?.hasAttribute("data-active")).toBe(true);
    expect(pickerRows().some((r) => (r.textContent ?? "").includes("日本語"))).toBe(true);
  });

  it("dismisses the popup when the active tag's body is clicked", async () => {
    const { container } = mountInput({
      modelValue: "Plant overview",
      translations: { en: "Plant overview", "zh-Hans": "工厂总览" },
    });
    await openPicker(container);
    tagBody("English")!.click();
    await nextTick();
    await nextTick();
    await untilPickerSettled();
    expect(pickerRows().length).toBe(0);
    expect(pickerTags().length).toBe(0);
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
