import { afterEach, describe, expect, it } from "vitest";
import { createApp, defineComponent, h, nextTick, ref } from "vue";

import HkModal from "./HkModal";
import HkTagInput, { type HkTagOption } from "./HkTagInput";

/** Regional-indicator flag pair for an ISO 3166-1 alpha-2 code, built
 * from code points (same derivation as data/dialCodes flagEmoji) so the
 * fixture source itself carries no literal emoji. */
const flagOf = (iso: string): string =>
  String.fromCodePoint(
    ...Array.from(iso.toUpperCase(), (c) => 0x1f1e6 + c.charCodeAt(0) - 65),
  );

const OPTIONS: HkTagOption[] = [
  { key: "news", label: "News", meta: "feed", keywords: "press 新闻" },
  { key: "cn-main", label: "中华人民共和国", meta: "cn" },
  { key: "tech", label: "Technology", meta: "tech", keywords: "dev 技术" },
  { key: "de", label: "Germany", meta: "de", flag: flagOf("de") },
  { key: "retired", label: "Retired", meta: "old", disabled: true },
];

interface MountOptions {
  modelValue?: readonly string[];
  options?: readonly HkTagOption[];
  allowCustom?: boolean;
  label?: string;
  placeholder?: string;
  hint?: string;
  disabled?: boolean;
  size?: "sm" | "md" | "lg";
  maxTags?: number;
  searchPlaceholder?: string;
  emptyText?: string;
}

const mounts: Array<{ app: ReturnType<typeof createApp>; container: HTMLElement }> = [];

/** Reactive harness — a REAL v-model parent: `update:modelValue` flows
 * back into the prop, so toggling a row re-renders the tag list exactly
 * as it does in an application (the component owns no selection state of
 * its own). Every emitted payload is recorded verbatim. */
function mountTagInput(opts: MountOptions = {}) {
  const events = {
    modelValue: [] as string[][],
    add: [] as string[],
    remove: [] as string[],
    open: [] as boolean[],
  };
  const container = document.createElement("div");
  document.body.appendChild(container);
  const Host = defineComponent({
    name: "HkTagInputHost",
    setup() {
      const value = ref<readonly string[]>(opts.modelValue ?? []);
      return () =>
        h(HkTagInput, {
          modelValue: value.value,
          options: opts.options ?? OPTIONS,
          allowCustom: opts.allowCustom ?? false,
          label: opts.label,
          placeholder: opts.placeholder,
          hint: opts.hint,
          disabled: opts.disabled ?? false,
          size: opts.size ?? "md",
          maxTags: opts.maxTags,
          searchPlaceholder: opts.searchPlaceholder,
          emptyText: opts.emptyText,
          "onUpdate:modelValue": (keys: string[]) => {
            events.modelValue.push(keys);
            value.value = keys;
          },
          onAdd: (key: string) => events.add.push(key),
          onRemove: (key: string) => events.remove.push(key),
          "onUpdate:open": (open: boolean) => events.open.push(open),
        });
    },
  });
  const app = createApp(Host);
  app.mount(container);
  mounts.push({ app, container });
  return { events, container };
}

async function settle(): Promise<void> {
  await nextTick();
  await nextTick();
  await new Promise((resolve) => setTimeout(resolve, 0));
  await nextTick();
}

/** Wait out a leave transition (the panel stays mounted while it folds). */
async function untilSettled(check: () => number): Promise<void> {
  const deadline = Date.now() + 800;
  while (check() > 0 && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 10));
    await nextTick();
  }
}

function field(container: HTMLElement): HTMLElement {
  const box = container.querySelector<HTMLElement>(".hk-tag-input-box");
  expect(box, "field box renders").toBeTruthy();
  return box!;
}

function chevron(container: HTMLElement): HTMLButtonElement {
  const button = container.querySelector<HTMLButtonElement>(".hk-tag-input-chevron");
  expect(button, "chevron renders").toBeTruthy();
  return button!;
}

function inlineInput(container: HTMLElement): HTMLInputElement | null {
  return container.querySelector<HTMLInputElement>(".hk-tag-input-element");
}

function tags(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>(".hk-tag")];
}

function tagTexts(container: HTMLElement): string[] {
  return tags(container).map(
    (tag) => tag.querySelector(".hk-tag-input-tag-text")?.textContent ?? "",
  );
}

function closeButtons(container: HTMLElement): HTMLButtonElement[] {
  return [...container.querySelectorAll<HTMLButtonElement>(".hk-tag-close")];
}

/** Rows live in the teleported panel, so they are queried on body. */
function rows(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>(".hk-tag-input-row")];
}

function rowLabels(): string[] {
  return rows().map(
    (row) => row.querySelector(".hk-tag-input-row-label")?.textContent ?? "",
  );
}

function rowByLabel(label: string): HTMLElement {
  const row = rows().find(
    (r) => (r.querySelector(".hk-tag-input-row-label")?.textContent ?? "") === label,
  );
  expect(row, `row "${label}" renders`).toBeTruthy();
  return row!;
}

function customRow(): HTMLElement | null {
  return document.querySelector<HTMLElement>('.hk-tag-input-row[data-custom="true"]');
}

function searchInput(): HTMLInputElement {
  const input = document.querySelector<HTMLInputElement>(".hk-tag-input-search input");
  expect(input, "panel search field renders").toBeTruthy();
  return input!;
}

async function openPanel(container: HTMLElement): Promise<void> {
  chevron(container).click();
  await settle();
}

async function typeInto(input: HTMLInputElement, value: string): Promise<void> {
  input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  await settle();
}

async function typeInline(container: HTMLElement, value: string): Promise<void> {
  const input = inlineInput(container);
  expect(input, "inline input renders").toBeTruthy();
  await typeInto(input!, value);
}

async function typeSearch(value: string): Promise<void> {
  await typeInto(searchInput(), value);
}

function pressKey(el: Element, key: string): void {
  el.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
}

afterEach(async () => {
  for (const { app, container } of mounts.splice(0)) {
    app.unmount();
    container.remove();
  }
  document.body.innerHTML = "";
});

describe("HkTagInput", () => {
  it("renders the tags in modelValue order and degrades unknown keys to the raw key", () => {
    const { container } = mountTagInput({
      modelValue: ["tech", "legacy-flag", "news"],
    });
    expect(tagTexts(container)).toEqual(["Technology", "legacy-flag", "News"]);
    expect(tags(container)).toHaveLength(3);
    // Every tag is closable, and each × names the entry it removes.
    expect(closeButtons(container)).toHaveLength(3);
    expect(closeButtons(container)[0].getAttribute("aria-label")).toBe(
      "Remove — Technology",
    );
  });

  it("maps the field size onto the box and the tags", () => {
    const small = mountTagInput({ modelValue: ["news"], size: "sm" });
    expect(field(small.container).classList.contains("hk-tag-input-box-sm")).toBe(true);
    expect(tags(small.container)[0].classList.contains("hk-tag-sm")).toBe(true);
    // HkTag only knows sm/md — the field's lg maps down to a md chip while
    // the box itself takes the tall rhythm.
    const large = mountTagInput({ modelValue: ["news"], size: "lg" });
    expect(field(large.container).classList.contains("hk-tag-input-box-lg")).toBe(true);
    expect(tags(large.container)[0].classList.contains("hk-tag-md")).toBe(true);
    expect(inlineInput(large.container), "lg still types").not.toBeNull();
  });

  it("opens the panel from the chevron and from a click inside the field", async () => {
    const { events, container } = mountTagInput({ modelValue: ["news"] });

    await openPanel(container);
    expect(rows().length).toBe(OPTIONS.length);
    expect(events.open).toEqual([true]);

    // Fold it again through the panel's own Escape, then reopen by
    // clicking anywhere in the field.
    pressKey(searchInput(), "Escape");
    await untilSettled(() => rows().length);
    expect(rows()).toHaveLength(0);
    expect(events.open.at(-1)).toBe(false);

    field(container).click();
    await settle();
    expect(rows().length).toBe(OPTIONS.length);
  });

  it("opens the panel with ArrowDown from the inline input", async () => {
    const { container } = mountTagInput();
    const input = inlineInput(container)!;
    expect(input.getAttribute("aria-expanded")).toBe("false");
    pressKey(input, "ArrowDown");
    await settle();
    expect(rows().length).toBe(OPTIONS.length);
    expect(input.getAttribute("aria-expanded")).toBe("true");
  });

  it("exposes combobox / listbox semantics with aria-selected on every row", async () => {
    const { container } = mountTagInput({ modelValue: ["news"] });
    const input = inlineInput(container)!;
    expect(input.getAttribute("role")).toBe("combobox");
    expect(input.getAttribute("aria-autocomplete")).toBe("list");
    expect(input.getAttribute("aria-expanded")).toBe("false");

    await openPanel(container);
    const list = document.querySelector<HTMLElement>(".hk-tag-input-list");
    expect(list).toBeTruthy();
    expect(list!.getAttribute("role")).toBe("listbox");
    expect(list!.getAttribute("aria-multiselectable")).toBe("true");
    expect(input.getAttribute("aria-controls")).toBe(list!.id);
    expect(input.getAttribute("aria-expanded")).toBe("true");

    expect(rowByLabel("News").getAttribute("role")).toBe("option");
    expect(rowByLabel("News").getAttribute("aria-selected")).toBe("true");
    expect(rowByLabel("Technology").getAttribute("aria-selected")).toBe("false");
    // The chevron and the search field carry accessible names.
    expect(chevron(container).getAttribute("aria-label")).toBe("Tags");
    expect(searchInput().getAttribute("aria-label")).toBe("Search");
  });

  it("lists EVERY option — selected ones stay visible with a check glyph", async () => {
    const { container } = mountTagInput({ modelValue: ["news", "tech"] });
    await openPanel(container);
    expect(rowLabels()).toEqual([
      "News",
      "中华人民共和国",
      "Technology",
      "Germany",
      "Retired",
    ]);
    expect(rowByLabel("News").hasAttribute("data-selected")).toBe(true);
    expect(rowByLabel("Technology").hasAttribute("data-selected")).toBe(true);
    expect(rowByLabel("Germany").hasAttribute("data-selected")).toBe(false);
    // The check glyph marks the selected rows.
    expect(rowByLabel("News").querySelector(".hk-tag-input-check svg")).toBeTruthy();
    expect(rowByLabel("Germany").querySelector(".hk-tag-input-check svg")).toBeNull();
  });

  it("toggling a row appends to the END, keeps the panel open, and emits exact payloads", async () => {
    const { events, container } = mountTagInput({ modelValue: ["tech"] });
    await openPanel(container);

    rowByLabel("News").click();
    await settle();
    // "news" is FIRST in the catalog but lands LAST in the host order.
    expect(events.add).toEqual(["news"]);
    expect(events.remove).toEqual([]);
    expect(events.modelValue).toEqual([["tech", "news"]]);
    expect(tagTexts(container)).toEqual(["Technology", "News"]);
    expect(rowByLabel("News").getAttribute("aria-selected")).toBe("true");
    // Batch editing: the panel is still there.
    expect(rows().length).toBe(OPTIONS.length);

    rowByLabel("News").click();
    await settle();
    expect(events.remove).toEqual(["news"]);
    expect(events.modelValue.at(-1)).toEqual(["tech"]);
    expect(tagTexts(container)).toEqual(["Technology"]);
    expect(rows().length).toBe(OPTIONS.length);
  });

  it("never toggles a disabled option on", async () => {
    const { events, container } = mountTagInput();
    await openPanel(container);
    const retired = rowByLabel("Retired");
    expect(retired.hasAttribute("data-disabled")).toBe(true);
    expect(retired.getAttribute("aria-disabled")).toBe("true");
    retired.click();
    await settle();
    expect(events.add).toEqual([]);
    expect(events.modelValue).toEqual([]);
    expect(tagTexts(container)).toEqual([]);
  });

  it("lets a disabled option that is already set be toggled back off", async () => {
    // `disabled` means "cannot be toggled ON": a catalog edit must never
    // strand a key the host already carries.
    const { events, container } = mountTagInput({ modelValue: ["retired"] });
    await openPanel(container);
    const retired = rowByLabel("Retired");
    expect(retired.getAttribute("aria-selected")).toBe("true");
    expect(retired.hasAttribute("data-disabled")).toBe(false);
    retired.click();
    await settle();
    expect(events.remove).toEqual(["retired"]);
    expect(events.modelValue).toEqual([[]]);
    expect(tagTexts(container)).toEqual([]);
  });

  it("removes a tag immediately on ×, with no confirm dialog", async () => {
    const { events, container } = mountTagInput({ modelValue: ["news", "tech"] });
    await openPanel(container);
    const close = closeButtons(container)[0];
    expect(close.getAttribute("aria-label")).toBe("Remove — News");
    close.click();
    // One click, one synchronous commit: no dialog stands between the ×
    // and the model (HkAffixPicker's confirmRemove does — deliberately not
    // here), and the open panel survives for the next edit.
    await settle();
    expect(events.remove).toEqual(["news"]);
    expect(events.modelValue).toEqual([["tech"]]);
    expect(tagTexts(container)).toEqual(["Technology"]);
    expect(rows()).toHaveLength(OPTIONS.length);
    expect(document.querySelector(".hk-message-box-confirm")).toBeNull();
    expect(document.querySelector(".hk-message-box-text")).toBeNull();
    expect(document.querySelector(".hk-modal-root")).toBeNull();
  });

  it("removing a tag from the closed field never opens the panel", async () => {
    const { events, container } = mountTagInput({ modelValue: ["news"] });
    closeButtons(container)[0].click();
    await settle();
    expect(events.remove).toEqual(["news"]);
    expect(events.open).toEqual([]);
    expect(rows()).toHaveLength(0);
  });

  it("emits a fresh ordered array and never mutates the host's array", async () => {
    const host = ["tech", "news"];
    const { events, container } = mountTagInput({ modelValue: host });
    closeButtons(container)[0].click();
    await settle();
    expect(events.modelValue.at(-1)).toEqual(["news"]);
    // The host's own array is untouched, and the emitted value is a copy
    // the host can keep, reorder or discard freely.
    expect(host).toEqual(["tech", "news"]);
    expect(events.modelValue.at(-1)).not.toBe(host);
    expect(tagTexts(container)).toEqual(["News"]);
  });

  it("falls back to the raw key when a catalog label is blank", async () => {
    const blank: HkTagOption[] = [
      { key: "news", label: "News" },
      { key: "ghost", label: "" },
    ];
    const { container } = mountTagInput({ modelValue: ["ghost", "news"], options: blank });
    // An empty chip would be invisible and unnameable — the key carries it.
    expect(tagTexts(container)).toEqual(["ghost", "News"]);
    await openPanel(container);
    expect(rowLabels()).toContain("ghost");
  });

  it("filters rows by substring and by in-order subsequence", async () => {
    const { container } = mountTagInput();
    await openPanel(container);

    await typeSearch("Technology");
    expect(rowLabels()).toEqual(["Technology"]);

    await typeSearch("feed");
    expect(rowLabels()).toEqual(["News"]);

    // Subsequence: 中国 is NOT a substring of 中华人民共和国.
    await typeSearch("中国");
    expect(rowLabels()).toEqual(["中华人民共和国"]);

    // Order-violating query must not fuzzy-match it.
    await typeSearch("国民");
    expect(rows()).toHaveLength(0);
    expect(document.querySelector(".hk-tag-input-empty")?.textContent).toContain(
      "No matches",
    );
  });

  it("shows emptyText when nothing matches, and offers no custom row without allowCustom", async () => {
    const { container } = mountTagInput({ emptyText: "Nothing here" });
    await openPanel(container);
    await typeSearch("zzz-nothing");
    expect(rows()).toHaveLength(0);
    expect(customRow()).toBeNull();
    expect(document.querySelector(".hk-tag-input-empty")?.textContent).toBe(
      "Nothing here",
    );
  });

  it("allowCustom: Enter in the inline input adds the raw query at the end", async () => {
    const { events, container } = mountTagInput({
      modelValue: ["news"],
      allowCustom: true,
    });
    await typeInline(container, "gitee.com");
    pressKey(inlineInput(container)!, "Enter");
    await settle();
    expect(events.add).toEqual(["gitee.com"]);
    expect(events.modelValue).toEqual([["news", "gitee.com"]]);
    expect(tagTexts(container)).toEqual(["News", "gitee.com"]);
  });

  it("allowCustom: the trailing row adds the query and clears it afterwards", async () => {
    const { events, container } = mountTagInput({ allowCustom: true });
    await openPanel(container);
    await typeSearch("brand-new");
    expect(rowLabels()).toEqual(["Use “brand-new”"]);
    customRow()!.click();
    await settle();
    expect(events.add).toEqual(["brand-new"]);
    expect(events.modelValue).toEqual([["brand-new"]]);
    expect(tagTexts(container)).toEqual(["brand-new"]);
    // The query is consumed, so the custom row is gone and the panel
    // (still open) lists the whole catalog again.
    expect(customRow()).toBeNull();
    expect(searchInput().value).toBe("");
    expect(rows().length).toBe(OPTIONS.length);
  });

  it("allowCustom: an exact option key or label suppresses the custom row", async () => {
    const { container } = mountTagInput({ allowCustom: true });
    await openPanel(container);

    await typeSearch("Technology");
    expect(customRow()).toBeNull();
    expect(rowLabels()).toEqual(["Technology"]);

    await typeSearch("tech");
    expect(customRow()).toBeNull();

    await typeSearch("technology");
    expect(customRow()).toBeNull();

    await typeSearch("Technology two");
    expect(customRow()).not.toBeNull();
  });

  it("allowCustom: a query that repeats an existing custom tag offers no duplicate row", async () => {
    const { events, container } = mountTagInput({
      modelValue: ["gitee.com"],
      allowCustom: true,
    });
    await openPanel(container);
    await typeSearch("gitee.com");
    // Already a tag — there is nothing to add, so no row pretends there is.
    expect(customRow()).toBeNull();
    expect(rows()).toHaveLength(0);
    expect(document.querySelector(".hk-tag-input-empty")).toBeTruthy();
    // Case-insensitive too, and Enter is inert instead of a silent no-op
    // that also swallowed the query.
    await typeSearch("GITEE.com");
    expect(customRow()).toBeNull();
    pressKey(searchInput(), "Enter");
    await settle();
    expect(events.add).toEqual([]);
    expect(events.modelValue).toEqual([]);
    expect(searchInput().value).toBe("GITEE.com");
    expect(tagTexts(container)).toEqual(["gitee.com"]);
  });

  it("Enter toggles the first matching option instead of adding a custom tag", async () => {
    const { events, container } = mountTagInput({ allowCustom: true });
    await openPanel(container);
    await typeSearch("tech");
    pressKey(searchInput(), "Enter");
    await settle();
    expect(events.add).toEqual(["tech"]);
    expect(events.modelValue).toEqual([["tech"]]);
    // Panel stayed open, the query survived, and no custom entry was made
    // (the query now names a selected key, so its custom row is gone).
    expect(rows()).toHaveLength(1);
    expect(rowByLabel("Technology").getAttribute("aria-selected")).toBe("true");
    expect(customRow()).toBeNull();
  });

  it("Enter falls through a disabled top row to the custom row", async () => {
    const { events, container } = mountTagInput({ allowCustom: true });
    await openPanel(container);
    // Only the disabled "Retired" row matches — the typed text becomes
    // the tag instead of being swallowed by an unpickable row.
    await typeSearch("retir");
    expect(rowLabels()).toEqual(["Retired", "Use “retir”"]);
    pressKey(searchInput(), "Enter");
    await settle();
    expect(events.add).toEqual(["retir"]);
    expect(tagTexts(container)).toEqual(["retir"]);
  });

  it("Enter on an empty query picks nothing", async () => {
    const { events, container } = mountTagInput({ allowCustom: true });
    await openPanel(container);
    pressKey(searchInput(), "Enter");
    await settle();
    expect(events.add).toEqual([]);
    expect(events.modelValue).toEqual([]);
    expect(tagTexts(container)).toEqual([]);
  });

  it("ArrowDown while the panel is already open changes nothing", async () => {
    const { events, container } = mountTagInput();
    const input = inlineInput(container)!;
    pressKey(input, "ArrowDown");
    await settle();
    pressKey(input, "ArrowDown");
    await settle();
    expect(events.open).toEqual([true]);
    expect(rows().length).toBe(OPTIONS.length);
  });

  it("Backspace with no tags to remove is inert", async () => {
    const { events, container } = mountTagInput();
    pressKey(inlineInput(container)!, "Backspace");
    await settle();
    expect(events.remove).toEqual([]);
    expect(events.modelValue).toEqual([]);
  });

  it("Backspace on an empty input removes the last tag", async () => {
    const { events, container } = mountTagInput({
      modelValue: ["news", "tech"],
      allowCustom: true,
    });
    pressKey(inlineInput(container)!, "Backspace");
    await settle();
    expect(events.remove).toEqual(["tech"]);
    expect(events.modelValue).toEqual([["news"]]);
    expect(tagTexts(container)).toEqual(["News"]);
  });

  it("Backspace with text in the input only edits the text", async () => {
    const { events, container } = mountTagInput({
      modelValue: ["news"],
      allowCustom: true,
    });
    await typeInline(container, "gi");
    pressKey(inlineInput(container)!, "Backspace");
    await settle();
    expect(events.remove).toEqual([]);
    expect(tagTexts(container)).toEqual(["News"]);
  });

  it("Escape closes the panel and clears the query but never the tags", async () => {
    const { events, container } = mountTagInput({ modelValue: ["news"], allowCustom: true });
    await openPanel(container);
    await typeSearch("tech");
    expect(rows()).toHaveLength(1);

    pressKey(searchInput(), "Escape");
    await settle();
    expect(events.open.at(-1)).toBe(false);
    expect(inlineInput(container)!.getAttribute("aria-expanded")).toBe("false");
    await untilSettled(() => rows().length);
    expect(rows()).toHaveLength(0);
    expect(tagTexts(container)).toEqual(["News"]);

    // Second Escape: the panel is closed, the tags stay committed.
    pressKey(inlineInput(container)!, "Escape");
    await settle();
    expect(tagTexts(container)).toEqual(["News"]);
    expect(events.remove).toEqual([]);

    // Reopening starts from a calm, empty query.
    await openPanel(container);
    expect(searchInput().value).toBe("");
  });

  it("disabled: no inline input, disabled chevron, unremovable tags", async () => {
    const { events, container } = mountTagInput({ modelValue: ["news"], disabled: true });
    expect(inlineInput(container)).toBeNull();
    expect(chevron(container).disabled).toBe(true);
    expect(closeButtons(container)).toHaveLength(0);
    expect(field(container).hasAttribute("data-disabled")).toBe(true);

    chevron(container).click();
    field(container).click();
    await settle();
    expect(rows()).toHaveLength(0);
    expect(events.open).toEqual([]);
  });

  it("maxTags: the inline input gives way to the placeholder and adds stop", async () => {
    const { events, container } = mountTagInput({
      modelValue: ["news", "tech"],
      maxTags: 2,
      placeholder: "Add a tag…",
    });
    expect(inlineInput(container)).toBeNull();
    expect(
      container.querySelector(".hk-tag-input-placeholder")?.textContent,
    ).toBe("Add a tag…");
    expect(field(container).hasAttribute("data-full")).toBe(true);

    await openPanel(container);
    for (const row of rows()) {
      expect(row.hasAttribute("data-disabled")).toBe(true);
    }
    rowByLabel("Germany").click();
    await settle();
    expect(events.add).toEqual([]);
    expect(events.modelValue).toEqual([]);
    expect(tagTexts(container)).toEqual(["News", "Technology"]);

    // Removal stays available through the tag ×.
    closeButtons(container)[0].click();
    await settle();
    expect(events.remove).toEqual(["news"]);
    expect(events.modelValue).toEqual([["tech"]]);
  });

  it("maxTags: a field with room left still types and adds", async () => {
    const { events, container } = mountTagInput({ modelValue: ["news"], maxTags: 2 });
    expect(inlineInput(container)).not.toBeNull();
    await openPanel(container);
    rowByLabel("Technology").click();
    await settle();
    expect(events.modelValue).toEqual([["news", "tech"]]);
  });

  it("maxTags: 1 caps the field at one tag, 0 and undefined stay unlimited", async () => {
    const unlimited = mountTagInput({ modelValue: ["news", "tech"], maxTags: 0 });
    expect(inlineInput(unlimited.container), "0 means unlimited").not.toBeNull();
    expect(field(unlimited.container).hasAttribute("data-full")).toBe(false);
    const full = mountTagInput({ modelValue: ["news"], maxTags: 1 });
    expect(inlineInput(full.container)).toBeNull();
    expect(field(full.container).hasAttribute("data-full")).toBe(true);
    const empty = mountTagInput({ maxTags: 1 });
    expect(inlineInput(empty.container), "a capped but empty field types").not.toBeNull();
    expect(field(empty.container).hasAttribute("data-full")).toBe(false);
    await openPanel(empty.container);
    rowByLabel("News").click();
    await settle();
    expect(empty.events.modelValue).toEqual([["news"]]);
    // Second add is refused at the cap.
    await settle();
    expect(inlineInput(empty.container)).toBeNull();
  });

  it("renders the label, the hint and the placeholder", () => {
    const { container } = mountTagInput({
      label: "Interests",
      hint: "Pick a few topics",
      placeholder: "Type to search",
    });
    expect(container.querySelector(".hk-tag-input-label")?.textContent).toBe("Interests");
    expect(container.querySelector(".hk-tag-input-hint")?.textContent).toBe(
      "Pick a few topics",
    );
    expect(inlineInput(container)!.getAttribute("placeholder")).toBe("Type to search");
  });

  it("keeps host order when a middle tag is removed", async () => {
    const { events, container } = mountTagInput({
      modelValue: ["tech", "news", "de"],
    });
    closeButtons(container)[1].click();
    await settle();
    expect(events.remove).toEqual(["news"]);
    expect(events.modelValue).toEqual([["tech", "de"]]);
    expect(tagTexts(container)).toEqual(["Technology", "Germany"]);
  });

  it("mounts NO inner scroll region — the window owns the one scrollbar", async () => {
    const { container } = mountTagInput({ modelValue: ["news", "tech", "de"] });
    await openPanel(container);
    expect(document.querySelector(".hk-tag-input-list"), "row list renders").toBeTruthy();
    expect(document.querySelector(".hk-tag-input-list .hk-scrollbar-track")).toBeNull();
  });

  it("opens its panel above a modal and toggles rows there", async () => {
    // The first consumer is an admin settings page, which is usually a
    // modal: the panel must stack through the popup manager, not the page.
    const container = document.createElement("div");
    document.body.appendChild(container);
    const Host = defineComponent({
      name: "HkTagInputModalHost",
      setup() {
        const open = ref(true);
        const value = ref<readonly string[]>(["news"]);
        return () =>
          h(
            HkModal,
            {
              modelValue: open.value,
              title: "Settings",
              "onUpdate:modelValue": (v: boolean) => {
                open.value = v;
              },
            },
            {
              default: () =>
                h(HkTagInput, {
                  modelValue: value.value,
                  options: OPTIONS,
                  label: "Interests",
                  "onUpdate:modelValue": (keys: string[]) => {
                    value.value = keys;
                  },
                }),
            },
          );
      },
    });
    const app = createApp(Host);
    app.mount(container);
    mounts.push({ app, container });
    await settle();

    // Modal content is teleported to body.
    const chevron = document.querySelector<HTMLButtonElement>(".hk-tag-input-chevron");
    expect(chevron, "the field renders inside the modal").toBeTruthy();
    chevron!.click();
    await settle();
    expect(rows().length).toBe(OPTIONS.length);

    const host = document.querySelector<HTMLElement>(".hk-select-popout-host");
    const modal = document.querySelector<HTMLElement>(".hk-modal-root");
    const z = (el: HTMLElement | null) => Number(el?.style.zIndex || 0);
    expect(host, "panel host exists").toBeTruthy();
    expect(z(modal)).toBeGreaterThan(0);
    expect(z(host)).toBeGreaterThan(z(modal));

    rowByLabel("Technology").click();
    await settle();
    expect(
      [...document.querySelectorAll(".hk-tag-input-tag-text")].map((n) => n.textContent),
    ).toEqual(["News", "Technology"]);
  });
});
