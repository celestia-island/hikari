import { afterEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createApp, defineComponent, h, nextTick, ref } from "vue";

import HkModal from "./HkModal";
import HkSelectPanel from "./HkSelectPanel";
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

/** HkListTransition keeps a leaving element mounted until its squeeze-out
 *  ends (`variant="reveal"`), and happy-dom never signals that end — so a
 *  node on its way out is still in the DOM. It is no longer part of the
 *  list (the CSS even takes its pointer events away), so every list query
 *  here reads the LIVING elements only. */
function isLeaving(el: Element): boolean {
  return el.classList.contains("hk-list-reveal-leave-active");
}

function tags(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>(".hk-tag")].filter(
    (tag) => !isLeaving(tag),
  );
}

function tagTexts(container: HTMLElement): string[] {
  return tags(container).map(
    (tag) => tag.querySelector(".hk-tag-input-tag-text")?.textContent ?? "",
  );
}

function closeButtons(container: HTMLElement): HTMLButtonElement[] {
  return tags(container)
    .map((tag) => tag.querySelector<HTMLButtonElement>(".hk-tag-close"))
    .filter((button): button is HTMLButtonElement => button != null);
}

/** Rows live in the teleported panel, so they are queried on body. */
function rows(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>(".hk-tag-input-row")].filter(
    (row) => !isLeaving(row),
  );
}

/** The rows a panel drag may move: the selected ones, which carry both the
 *  strip marker and their grip handle. */
function reorderableRows(): HTMLElement[] {
  return rows().filter((row) => row.hasAttribute("data-reorder"));
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

/** The row the keyboard cursor currently sits on (none = null). */
function activeRow(): HTMLElement | null {
  return rows().find((row) => row.hasAttribute("data-active")) ?? null;
}

function customRow(): HTMLElement | null {
  return rows().find((row) => row.getAttribute("data-custom") === "true") ?? null;
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

function pressKey(el: Element, key: string, init: KeyboardEventInit = {}): void {
  el.dispatchEvent(
    new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...init }),
  );
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
    // Opening is the whole job of that first press: the cursor is not
    // placed on a row until the next arrow (the APG combobox step).
    expect(activeRow()).toBeNull();
  });

  it("ArrowUp on the closed field opens the panel as well", async () => {
    const { events, container } = mountTagInput();
    const input = inlineInput(container)!;
    pressKey(input, "ArrowUp");
    await settle();
    expect(events.open).toEqual([true]);
    expect(activeRow()).toBeNull();
    pressKey(input, "ArrowUp");
    await settle();
    expect(activeRow()).toBe(rows().at(-1));
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

  it("aria-controls resolves even when the filter matches nothing", async () => {
    const { container } = mountTagInput({ emptyText: "Nothing here" });
    await openPanel(container);
    await typeSearch("zzz-nothing");
    expect(rows()).toHaveLength(0);

    // The reference is not allowed to dangle: the listbox element stays
    // mounted while the panel is open, even with nothing to list.
    const id = inlineInput(container)!.getAttribute("aria-controls");
    expect(id, "the input names a listbox id").toBeTruthy();
    const list = document.getElementById(id!);
    expect(list, "the referenced element exists").toBeTruthy();
    expect(list!.getAttribute("role")).toBe("listbox");
    expect([...list!.children].filter((child) => !isLeaving(child))).toHaveLength(0);

    // …and the message itself is NOT owned by the listbox: a listbox may
    // only own options/groups (aria-required-children), so it sits beside.
    const empty = document.querySelector(".hk-tag-input-empty")!;
    expect(empty.textContent).toBe("Nothing here");
    expect(list!.contains(empty)).toBe(false);
    expect(empty.parentElement?.contains(list!)).toBe(true);
  });

  it("lists EVERY option — selected ones stay visible with a check glyph", async () => {
    const { container } = mountTagInput({ modelValue: ["news", "tech"] });
    await openPanel(container);
    // Group-strict: the two selected rows come first, in the HOST's order
    // ("news" before "tech" — not the catalog's), then the unselected ones
    // in catalog order.
    expect(rowLabels()).toEqual([
      "News",
      "Technology",
      "中华人民共和国",
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

  it("ArrowDown opens the panel once and then walks the rows", async () => {
    const { events, container } = mountTagInput();
    const input = inlineInput(container)!;
    pressKey(input, "ArrowDown");
    await settle();
    pressKey(input, "ArrowDown");
    await settle();
    expect(events.open).toEqual([true]);
    expect(rows().length).toBe(OPTIONS.length);
    // The second press moved the cursor instead of reopening anything.
    expect(activeRow()).toBe(rows()[0]);
  });

  it("ArrowDown / ArrowUp walk the rows, wrap at both ends, and publish aria-activedescendant", async () => {
    const { container } = mountTagInput();
    const input = inlineInput(container)!;
    input.focus();
    await openPanel(container);
    expect(input.getAttribute("aria-activedescendant"), "nothing active on open").toBeNull();

    // From nothing active, ArrowDown lands on the FIRST row.
    pressKey(input, "ArrowDown");
    await settle();
    expect(activeRow()).toBe(rows()[0]);
    expect(rows()[0].id, "the active row is addressable").toBeTruthy();
    expect(input.getAttribute("aria-activedescendant")).toBe(rows()[0].id);

    // One step down, then wrapping off both ends.
    pressKey(input, "ArrowDown");
    await settle();
    expect(activeRow()).toBe(rows()[1]);
    expect(rows()[0].hasAttribute("data-active")).toBe(false);
    pressKey(input, "ArrowUp");
    await settle();
    expect(activeRow()).toBe(rows()[0]);
    pressKey(input, "ArrowUp");
    await settle();
    expect(activeRow()).toBe(rows().at(-1));
    expect(input.getAttribute("aria-activedescendant")).toBe(rows().at(-1)!.id);
    pressKey(input, "ArrowDown");
    await settle();
    expect(activeRow()).toBe(rows()[0]);

    // The activedescendant pattern: focus never left the field.
    expect(document.activeElement).toBe(input);
  });

  it("the panel search field drives the same cursor and keeps its focus", async () => {
    const { container } = mountTagInput();
    await openPanel(container);
    const search = searchInput();
    search.focus();

    pressKey(search, "ArrowDown");
    await settle();
    expect(rows()[0].hasAttribute("data-active")).toBe(true);
    expect(search.getAttribute("aria-activedescendant")).toBe(rows()[0].id);
    expect(document.activeElement, "focus stays in the search field").toBe(search);

    // A query edit re-filters the list, so the cursor is dropped with it.
    await typeSearch("Technology");
    expect(rows()).toHaveLength(1);
    expect(activeRow()).toBeNull();
    expect(search.getAttribute("aria-activedescendant")).toBeNull();
  });

  it("arrow keys pressed on a row itself still walk the cursor", async () => {
    // Clicking a row leaves focus on it (rows are tabindex="-1"), so the
    // panel surface forwards those arrows too — handled once, not twice.
    const { container } = mountTagInput();
    await openPanel(container);
    const row = rowByLabel("News");
    row.focus();
    expect(document.activeElement).toBe(row);

    pressKey(row, "ArrowDown");
    await settle();
    expect(activeRow()).toBe(rows()[0]);
    expect(document.activeElement, "the row keeps its own focus").toBe(row);
  });

  it("Enter activates the ACTIVE row instead of the first match", async () => {
    const { events, container } = mountTagInput({ allowCustom: true });
    await openPanel(container);
    const search = searchInput();
    search.focus();
    // "e" matches four rows: News, Technology, Germany, Retired.
    await typeSearch("e");
    expect(rowLabels()).toEqual(["News", "Technology", "Germany", "Retired", "Use “e”"]);

    pressKey(search, "ArrowDown");
    pressKey(search, "ArrowDown");
    await settle();
    expect(activeRow()).toBe(rowByLabel("Technology"));
    pressKey(search, "Enter");
    await settle();
    // The SECOND row was activated — not the top one, which is what the
    // no-cursor fallback would have picked.
    expect(events.add).toEqual(["tech"]);
    expect(events.modelValue).toEqual([["tech"]]);
  });

  it("the custom row is the LAST stop and wraps back to the first row", async () => {
    const { events, container } = mountTagInput({ allowCustom: true });
    await openPanel(container);
    const search = searchInput();
    search.focus();
    await typeSearch("e");
    expect(customRow()).not.toBeNull();

    // ArrowUp from nothing active walks to the LAST stop — the custom row.
    pressKey(search, "ArrowUp");
    await settle();
    expect(activeRow()).toBe(customRow());
    pressKey(search, "ArrowUp");
    await settle();
    expect(activeRow()).toBe(rowByLabel("Retired"));
    pressKey(search, "ArrowDown");
    await settle();
    expect(activeRow()).toBe(customRow());

    pressKey(search, "Enter");
    await settle();
    expect(events.add).toEqual(["e"]);
    expect(events.modelValue).toEqual([["e"]]);
    // The query was consumed, so the custom row is gone and the cursor
    // has nothing left to sit on.
    expect(customRow()).toBeNull();
    expect(search.value).toBe("");
    expect(activeRow()).toBeNull();
  });

  it("Enter on an INERT active row is a no-op, not a fall-through", async () => {
    const { events, container } = mountTagInput({ allowCustom: true });
    await openPanel(container);
    const search = searchInput();
    search.focus();
    await typeSearch("retir");
    // "Retired" cannot be toggled on, and with no cursor the same Enter
    // falls through to the custom row (the test above). Once the user has
    // explicitly parked the cursor on it, the key must not silently act on
    // a DIFFERENT row than the highlighted one.
    pressKey(search, "ArrowDown");
    await settle();
    expect(activeRow()).toBe(rowByLabel("Retired"));

    pressKey(search, "Enter");
    await settle();
    expect(events.add).toEqual([]);
    expect(events.modelValue).toEqual([]);
    expect(search.value).toBe("retir");
  });

  it("closing clears the cursor and reopening starts with none", async () => {
    const { container } = mountTagInput();
    await openPanel(container);
    pressKey(inlineInput(container)!, "ArrowDown");
    await settle();
    expect(activeRow()).not.toBeNull();

    pressKey(searchInput(), "Escape");
    await settle();
    await untilSettled(() => rows().length);
    await openPanel(container);
    expect(activeRow()).toBeNull();
    expect(inlineInput(container)!.getAttribute("aria-activedescendant")).toBeNull();
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

  it("disabled: no label dangles and the field box carries the caption", () => {
    const { container } = mountTagInput({ label: "Interests", disabled: true });
    const label = container.querySelector<HTMLLabelElement>(".hk-tag-input-label")!;
    // A `for` with nothing behind it is worse than none: the caption moves
    // onto the box as the group's name instead.
    expect(label.getAttribute("for")).toBeNull();
    expect(inlineInput(container)).toBeNull();
    expect(field(container).getAttribute("aria-label")).toBe("Interests");
    expect(field(container).getAttribute("role")).toBe("group");
  });

  it("disabled without a label: the box still carries the default caption", () => {
    const { container } = mountTagInput({ disabled: true });
    expect(field(container).getAttribute("aria-label")).toBe("Tags");
  });

  it("disabled while the panel is open marks the custom row inert like the option rows", async () => {
    // A live `disabled` flip — the panel is already open with a query typed.
    const container = document.createElement("div");
    document.body.appendChild(container);
    const value = ref<readonly string[]>([]);
    const disabled = ref(false);
    const added: string[] = [];
    const Host = defineComponent({
      name: "HkTagInputDisabledFlipHost",
      setup() {
        return () =>
          h(HkTagInput, {
            modelValue: value.value,
            options: OPTIONS,
            allowCustom: true,
            disabled: disabled.value,
            "onUpdate:modelValue": (keys: string[]) => {
              value.value = keys;
            },
            onAdd: (key: string) => added.push(key),
          });
      },
    });
    const app = createApp(Host);
    app.mount(container);
    mounts.push({ app, container });
    await settle();

    chevron(container).click();
    await settle();
    await typeSearch("Tec");
    const custom = customRow()!;
    expect(custom, "the custom row is offered").toBeTruthy();
    expect(custom.hasAttribute("data-disabled")).toBe(false);

    disabled.value = true;
    await settle();

    // The custom row reads inert on exactly the same flag as the option
    // rows — same ARIA, same visual hook — instead of being a silent no-op.
    const option = rowByLabel("Technology");
    expect(option.getAttribute("aria-disabled")).toBe("true");
    expect(custom.getAttribute("aria-disabled")).toBe(
      option.getAttribute("aria-disabled"),
    );
    expect(custom.hasAttribute("data-disabled")).toBe(option.hasAttribute("data-disabled"));
    expect(custom.hasAttribute("data-disabled")).toBe(true);

    custom.click();
    await settle();
    expect(added).toEqual([]);
    expect(value.value).toEqual([]);
  });

  it("maxTags: the inline input stays put as a readOnly field and adds stop", async () => {
    const { events, container } = mountTagInput({
      modelValue: ["news", "tech"],
      maxTags: 2,
      placeholder: "Add a tag…",
    });
    // The element is not swapped for placeholder text: it is the same
    // field, readOnly, and the placeholder is its own.
    const capped = inlineInput(container);
    expect(capped).not.toBeNull();
    expect(capped!.readOnly).toBe(true);
    expect(capped!.placeholder).toBe("Add a tag…");
    expect(container.querySelector(".hk-tag-input-placeholder")).toBeNull();
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
    // Back under the cap the same element types again.
    expect(inlineInput(container)!.readOnly).toBe(false);
  });

  it("maxTags: reaching the cap keeps the FOCUSED field focused", async () => {
    const { events, container } = mountTagInput({
      modelValue: ["news"],
      maxTags: 2,
      placeholder: "Add a tag…",
    });
    const input = inlineInput(container)!;
    input.focus();
    expect(document.activeElement).toBe(input);

    // The real keyboard path to the cap: type, commit with Enter. (A row
    // `.click()` would not prove much — jsdom never moves focus on click,
    // while a browser focuses the row and the field would lose it anyway.)
    await typeInto(input, "tech");
    pressKey(input, "Enter");
    await settle();

    expect(events.modelValue).toEqual([["news", "tech"]]);
    expect(field(container).hasAttribute("data-full")).toBe(true);
    // Same element, still focused: reaching the cap used to unmount it and
    // drop activeElement back to <body>.
    const capped = inlineInput(container);
    expect(capped).toBe(input);
    expect(capped!.readOnly).toBe(true);
    expect(document.activeElement).toBe(capped);
    expect(container.querySelector(".hk-tag-input-placeholder")).toBeNull();
  });

  it("maxTags: Backspace on the readOnly capped field frees a slot", async () => {
    const { events, container } = mountTagInput({
      modelValue: ["news", "tech"],
      maxTags: 2,
    });
    // Backspace-on-empty is the same code path an editable field uses;
    // at the cap it is the keyboard route to a free slot.
    pressKey(inlineInput(container)!, "Backspace");
    await settle();
    expect(events.remove).toEqual(["tech"]);
    expect(events.modelValue).toEqual([["news"]]);
    // Back under the cap, the very same element edits text again.
    expect(inlineInput(container)!.readOnly).toBe(false);
  });

  it("maxTags: Enter and the custom row stay inert for a readOnly capped field", async () => {
    const { events, container } = mountTagInput({
      modelValue: ["news"],
      maxTags: 1,
      allowCustom: true,
    });
    const input = inlineInput(container)!;
    expect(input.readOnly).toBe(true);

    await openPanel(container);
    await typeSearch("brand-new");
    const custom = customRow()!;
    expect(custom, "the custom row is offered").toBeTruthy();
    expect(custom.getAttribute("aria-disabled")).toBe("true");
    custom.click();
    pressKey(input, "Enter");
    await settle();
    expect(events.add).toEqual([]);
    expect(events.modelValue).toEqual([]);
    expect(tagTexts(container)).toEqual(["News"]);
  });

  it("associates the label with a field that exists at the cap", () => {
    const { container } = mountTagInput({
      label: "Interests",
      modelValue: ["news"],
      maxTags: 1,
    });
    const label = container.querySelector<HTMLLabelElement>(".hk-tag-input-label")!;
    const id = label.getAttribute("for");
    expect(id, "the capped field is still named by the label").toBeTruthy();
    // There IS an element behind that `for` — the capped (readOnly) input,
    // not a dangling reference to the unmounted element of the old shape.
    const capped = inlineInput(container);
    expect(capped, "the capped field still renders an input").not.toBeNull();
    expect(document.getElementById(id!)).toBe(capped);
    expect(label.control).toBe(capped);
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
    expect(inlineInput(full.container)?.readOnly, "capped, not gone").toBe(true);
    expect(field(full.container).hasAttribute("data-full")).toBe(true);
    const empty = mountTagInput({ maxTags: 1 });
    expect(inlineInput(empty.container), "a capped but empty field types").not.toBeNull();
    expect(field(empty.container).hasAttribute("data-full")).toBe(false);
    await openPanel(empty.container);
    rowByLabel("News").click();
    await settle();
    expect(empty.events.modelValue).toEqual([["news"]]);
    // Second add is refused at the cap — the field is still there, inert.
    await settle();
    expect(inlineInput(empty.container)?.readOnly).toBe(true);
    expect(field(empty.container).hasAttribute("data-full")).toBe(true);
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

/** Pin an item strip's rects: happy-dom ships no layout engine, so the
 *  items a drag measures are placed by hand (the HkSlider pinRect
 *  pattern). `size` is the item's extent along the axis. */
function pinStrip(items: HTMLElement[], size: number, axis: "x" | "y"): void {
  items.forEach((el, index) => {
    const start = index * size;
    const box =
      axis === "x"
        ? { left: start, right: start + size, top: 0, bottom: size, width: size, height: size, x: start, y: 0 }
        : { left: 0, right: size, top: start, bottom: start + size, width: size, height: size, x: 0, y: start };
    Object.defineProperty(el, "getBoundingClientRect", {
      configurable: true,
      value: () => box as DOMRect,
    });
  });
}

/** Press `on` and move to `to`, WITHOUT releasing — for observing a held
 *  drag (auto-scroll, drop markers) before the drop. Moves and releases are
 *  window events: the drag listens at the window, because a real pointer
 *  leaves the item it started on. `buttons` models the held button (1 for
 *  the whole press, 0 on release), which is how the drag tells a live
 *  gesture from one whose release the page never saw. */
function holdPointer(
  from: { x: number; y: number },
  to: { x: number; y: number },
  on: HTMLElement,
  pointerType: "mouse" | "touch" = "mouse",
): void {
  on.dispatchEvent(
    new PointerEvent("pointerdown", {
      bubbles: true,
      cancelable: true,
      pointerId: 1,
      pointerType,
      button: 0,
      buttons: 1,
      clientX: from.x,
      clientY: from.y,
    }),
  );
  window.dispatchEvent(
    new PointerEvent("pointermove", {
      bubbles: true,
      pointerId: 1,
      pointerType,
      buttons: 1,
      clientX: to.x,
      clientY: to.y,
    }),
  );
}

function releasePointer(
  to: { x: number; y: number },
  pointerType: "mouse" | "touch" = "mouse",
): void {
  window.dispatchEvent(
    new PointerEvent("pointerup", {
      bubbles: true,
      pointerId: 1,
      pointerType,
      buttons: 0,
      clientX: to.x,
      clientY: to.y,
    }),
  );
}

/** A full gesture: press, move, release. */
function dragPointer(
  from: { x: number; y: number },
  to: { x: number; y: number },
  on: HTMLElement,
  pointerType: "mouse" | "touch" = "mouse",
): void {
  holdPointer(from, to, on, pointerType);
  releasePointer(to, pointerType);
}

/** Wait out `count` animation frames — auto-scroll steps one per frame. */
async function frames(count: number): Promise<void> {
  for (let i = 0; i < count; i += 1) {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  }
}

/** Pin a scrollable band and place its drag rows relative to the band's own
 *  scroll offset — what a browser does to the content a scroll moves under
 *  the pointer (happy-dom has no layout, so the geometry is stated). */
function pinScrollBand(
  surface: HTMLElement,
  height: number,
  rows: HTMLElement[],
  rowSize = 40,
): void {
  Object.defineProperty(surface, "getBoundingClientRect", {
    configurable: true,
    value: () =>
      ({ left: 0, right: 40, top: 0, bottom: height, width: 40, height, x: 0, y: 0 }) as DOMRect,
  });
  rows.forEach((row, index) => {
    Object.defineProperty(row, "getBoundingClientRect", {
      configurable: true,
      value: () => {
        const start = index * rowSize - surface.scrollTop;
        return {
          left: 0,
          right: 40,
          top: start,
          bottom: start + rowSize,
          width: 40,
          height: rowSize,
          x: 0,
          y: start,
        } as DOMRect;
      },
    });
  });
}

/** The row the live drag would land on (the drop marker), or null. */
function dropRow(): HTMLElement | null {
  return rows().find((row) => row.hasAttribute("data-drop")) ?? null;
}

function grip(row: HTMLElement): HTMLElement {
  const handle = row.querySelector<HTMLElement>(".hk-tag-input-grip");
  expect(handle, "the selected row carries a drag handle").toBeTruthy();
  return handle!;
}

function rowText(row: HTMLElement): string {
  return row.querySelector(".hk-tag-input-row-label")?.textContent ?? "";
}

describe("HkTagInput panel geometry and drag reordering", () => {
  it("hugs its own measure instead of the field's width, capped by maxHeight", async () => {
    const { container } = mountTagInput({ modelValue: ["news"] });
    // A full-width settings column (880px): far wider than the panel's
    // designed 13–19rem measure, which is exactly the reported defect.
    Object.defineProperty(field(container), "getBoundingClientRect", {
      configurable: true,
      value: () =>
        ({ left: 0, right: 880, top: 0, bottom: 40, width: 880, height: 40, x: 0, y: 0 }) as DOMRect,
    });
    await openPanel(container);

    const host = document.querySelector<HTMLElement>(".hk-select-popout-host")!;
    expect(host, "the popout host renders").toBeTruthy();
    // No anchor-width match: nothing pins the popout to the 880px field.
    expect(host.style.minWidth).toBe("");

    // The surface cap rides the panel through the SCSS hook, so a long
    // catalog scrolls inside 18rem/45dvh instead of growing to 36rem.
    const popout = document.querySelector<HTMLElement>(".hk-select-popout")!;
    expect(popout.style.getPropertyValue("--hk-select-panel-max-height")).toBe(
      "min(18rem, 45dvh)",
    );
  });

  it("leaves the shared panel exactly as it was when the cap is not passed", async () => {
    // The `maxHeight` prop is ADDITIVE, pinned at the DOM level rather than
    // in source text: a panel mounted with no cap renders no hook and no
    // inline max-height, i.e. the historic popout geometry.
    const anchor = document.createElement("div");
    document.body.appendChild(anchor);
    const container = document.createElement("div");
    document.body.appendChild(container);
    const app = createApp({
      render: () =>
        h(
          HkSelectPanel,
          { open: true, anchorRef: anchor, title: "Pick" },
          { default: () => h("div", { class: "probe-row" }, "row") },
        ),
    });
    app.mount(container);
    mounts.push({ app, container });
    await settle();

    const popout = document.querySelector<HTMLElement>(".hk-select-popout");
    expect(popout, "the popout renders").toBeTruthy();
    expect(popout!.style.getPropertyValue("--hk-select-panel-max-height")).toBe("");
    expect(popout!.style.maxHeight).toBe("");
    expect(popout!.hasAttribute("style"), "no inline style at all").toBe(false);
  });

  it("regroups the rows: selected first in host order, then catalog order", async () => {
    // The host order is "de" then "news" — deliberately NOT the catalog's
    // (news precedes de there), so the assertion pins the host's order.
    const { container } = mountTagInput({ modelValue: ["de", "news"] });
    await openPanel(container);
    expect(rowLabels()).toEqual([
      "Germany",
      "News",
      "中华人民共和国",
      "Technology",
      "Retired",
    ]);
    // Only the selected rows are drag items — they carry the marker.
    expect(reorderableRows().map(rowText)).toEqual(["Germany", "News"]);
  });

  it("filters WITHIN each group and never merges them", async () => {
    const { container } = mountTagInput({
      modelValue: ["tech", "news"],
      allowCustom: true,
    });
    await openPanel(container);
    // "e" matches News, Technology, Germany and Retired: the two selected
    // rows keep the host order and stay ahead of the unselected ones.
    await typeSearch("e");
    expect(rowLabels()).toEqual([
      "Technology",
      "News",
      "Germany",
      "Retired",
      "Use “e”",
    ]);

    // A query matching only unselected rows leaves the selected group
    // empty — the groups do not collapse into one catalog order.
    await typeSearch("retir");
    expect(rowLabels()).toEqual(["Retired", "Use “retir”"]);
  });

  it("walks the keyboard stops in the RENDERED order", async () => {
    const { container } = mountTagInput({ modelValue: ["de", "news"], allowCustom: true });
    await openPanel(container);
    const search = searchInput();
    search.focus();
    await typeSearch("e");

    const walked: string[] = [];
    for (let i = 0; i < 5; i += 1) {
      pressKey(search, "ArrowDown");
      await settle();
      walked.push(rowText(activeRow()!));
    }
    // The cursor follows the regrouped rows, custom row last…
    expect(walked).toEqual(["Germany", "News", "Technology", "Retired", "Use “e”"]);
    // …and wraps back to the first rendered row.
    pressKey(search, "ArrowDown");
    await settle();
    expect(activeRow()).toBe(rowByLabel("Germany"));
  });

  it("drags a chip by its body and emits the host's new order", async () => {
    const { events, container } = mountTagInput({ modelValue: ["news", "tech", "de"] });
    const strip = tags(container);
    expect(strip).toHaveLength(3);
    pinStrip(strip, 60, "x");

    // Press the first chip and pull the pointer past every midpoint: it
    // lands in the last slot.
    dragPointer({ x: 10, y: 10 }, { x: 200, y: 10 }, strip[0]);
    await settle();

    expect(events.modelValue.at(-1)).toEqual(["tech", "de", "news"]);
    expect(tagTexts(container)).toEqual(["Technology", "Germany", "News"]);
    // A reorder is not an edit: nothing was added or removed.
    expect(events.add).toEqual([]);
    expect(events.remove).toEqual([]);
  });

  it("drags a selected row by its grip and emits the host's new order", async () => {
    const { events, container } = mountTagInput({ modelValue: ["news", "tech", "de"] });
    await openPanel(container);
    const selected = reorderableRows();
    expect(selected.map(rowText)).toEqual(["News", "Technology", "Germany"]);
    pinStrip(selected, 40, "y");

    dragPointer({ x: 10, y: 10 }, { x: 10, y: 130 }, grip(selected[0]));
    await settle();

    expect(events.modelValue.at(-1)).toEqual(["tech", "de", "news"]);
    expect(events.add).toEqual([]);
    expect(events.remove).toEqual([]);
    // The panel and the field agree on the new order.
    expect(rowLabels().slice(0, 3)).toEqual(["Technology", "Germany", "News"]);
  });

  it("clamps a row drag to the selected group", async () => {
    const { events, container } = mountTagInput({ modelValue: ["news", "tech"] });
    await openPanel(container);
    const selected = reorderableRows();
    expect(selected.map(rowText)).toEqual(["News", "Technology"]);
    // EVERY row is measured, not just the drag items: a strip that wrongly
    // included the unselected rows would otherwise resolve against
    // unmeasured (all-zero) rects and slip through this test.
    pinStrip(rows(), 40, "y");

    // Aim far BELOW the group, deep into the unselected rows: the drop
    // still lands on the last SELECTED slot, never inside that region.
    dragPointer({ x: 10, y: 10 }, { x: 10, y: 600 }, grip(selected[0]));
    await settle();

    expect(events.modelValue.at(-1)).toEqual(["tech", "news"]);
    expect(rowLabels()).toEqual([
      "Technology",
      "News",
      "中华人民共和国",
      "Germany",
      "Retired",
    ]);
  });

  it("keeps unselected rows out of the drag space entirely", async () => {
    const { events, container } = mountTagInput({ modelValue: ["news"] });
    await openPanel(container);
    const selected = reorderableRows();
    expect(selected).toHaveLength(1);
    expect(grip(selected[0])).toBeTruthy();

    // An unselected row carries neither the drag marker nor a handle…
    const unselected = rowByLabel("Germany");
    expect(unselected.hasAttribute("data-reorder")).toBe(false);
    expect(unselected.querySelector(".hk-tag-input-grip")).toBeNull();

    // …and a press on it starts nothing, however far the pointer travels.
    pinStrip([selected[0], unselected], 40, "y");
    dragPointer({ x: 10, y: 70 }, { x: 10, y: 600 }, unselected);
    await settle();
    expect(events.modelValue).toEqual([]);
  });

  it("moves a panel row by key, so a custom tag in the array survives", async () => {
    const { events, container } = mountTagInput({
      modelValue: ["news", "gitee.com", "tech"],
    });
    await openPanel(container);
    const selected = reorderableRows();
    // Only the two catalog entries have rows; the custom key does not.
    expect(selected.map(rowText)).toEqual(["News", "Technology"]);
    pinStrip(selected, 40, "y");

    dragPointer({ x: 10, y: 10 }, { x: 10, y: 70 }, grip(selected[0]));
    await settle();

    // "news" lands on "tech"'s host position; the custom key was neither
    // dropped nor duplicated by a row drag it had no row in.
    expect(events.modelValue.at(-1)).toEqual(["gitee.com", "tech", "news"]);
    expect(tagTexts(container)).toEqual(["gitee.com", "Technology", "News"]);
  });

  it("lifts the dragged chip and drops the lift on release", async () => {
    const { events, container } = mountTagInput({ modelValue: ["news", "tech", "de"] });
    const strip = tags(container);
    pinStrip(strip, 60, "x");

    // Mid-gesture (still held): exactly the item being moved carries the
    // drag state — the hook the stylesheet lifts — and the slot it would
    // land in keeps its own ring. Nothing else is marked.
    holdPointer({ x: 10, y: 10 }, { x: 200, y: 10 }, strip[0]);
    await nextTick();
    const dragging = tags(container).filter((t) =>
      t.classList.contains("hk-tag-input-tag-dragging"),
    );
    expect(dragging).toHaveLength(1);
    expect(dragging[0]).toBe(strip[0]);
    expect(tags(container).filter((t) => t.classList.contains("hk-tag-input-tag-drop"))).toHaveLength(
      1,
    );

    releasePointer({ x: 200, y: 10 });
    await settle();
    // The lift is a LIVE-drag state: the release clears it in both lists.
    expect(container.querySelectorAll(".hk-tag-input-tag-dragging")).toHaveLength(0);
    expect(container.querySelectorAll(".hk-tag-input-tag-drop")).toHaveLength(0);
    expect(events.modelValue.at(-1)).toEqual(["tech", "de", "news"]);
  });

  it("drops the chip's lift when the gesture is cancelled without a drop", async () => {
    const { events, container } = mountTagInput({ modelValue: ["news", "tech"] });
    pinStrip(tags(container), 60, "x");

    holdPointer({ x: 10, y: 10 }, { x: 200, y: 10 }, tags(container)[0]);
    await nextTick();
    expect(container.querySelectorAll(".hk-tag-input-tag-dragging")).toHaveLength(1);

    // The browser takes the gesture back (a vertical scroll on touch): the
    // drag is abandoned — no reorder, and no lift left behind.
    window.dispatchEvent(
      new PointerEvent("pointercancel", { bubbles: true, pointerId: 1, pointerType: "touch" }),
    );
    await settle();
    expect(container.querySelectorAll(".hk-tag-input-tag-dragging")).toHaveLength(0);
    expect(container.querySelectorAll(".hk-tag-input-tag-drop")).toHaveLength(0);
    expect(events.modelValue).toEqual([]);
  });

  it("lifts the dragged panel row too, and drops the lift on release", async () => {
    const { events, container } = mountTagInput({ modelValue: ["news", "tech", "de"] });
    await openPanel(container);
    const selected = reorderableRows();
    pinStrip(selected, 40, "y");

    // The row face of the same lift is the data attribute the stylesheet
    // keys off (rows carry no classes of their own).
    holdPointer({ x: 10, y: 10 }, { x: 10, y: 130 }, grip(selected[0]));
    await nextTick();
    const draggingRows = rows().filter((row) => row.hasAttribute("data-dragging"));
    expect(draggingRows).toHaveLength(1);
    expect(draggingRows[0]).toBe(selected[0]);
    expect(rows().filter((row) => row.hasAttribute("data-drop"))).toHaveLength(1);

    releasePointer({ x: 10, y: 130 });
    await settle();
    expect(rows().filter((row) => row.hasAttribute("data-dragging"))).toHaveLength(0);
    expect(rows().filter((row) => row.hasAttribute("data-drop"))).toHaveLength(0);
    expect(events.modelValue.at(-1)).toEqual(["tech", "de", "news"]);
  });

  it("hands a disabled field's chips to text selection instead of a drag", async () => {
    const { events, container } = mountTagInput({ modelValue: ["news", "tech"], disabled: true });

    // The stylesheet restores selection (and drops the grab cursor) through
    // the box's OWN disabled hook — happy-dom has no layout, so the pin is
    // on that attribute, which is exactly what the rule keys off.
    expect(field(container).hasAttribute("data-disabled")).toBe(true);
    expect(tags(container)).toHaveLength(2);

    // Nothing can be reordered here, so a press that travels the whole strip
    // must not be spent on a drag: no state, no emission, no lifted chip.
    pinStrip(tags(container), 60, "x");
    dragPointer({ x: 10, y: 10 }, { x: 200, y: 10 }, tags(container)[0]);
    await settle();
    expect(events.modelValue).toEqual([]);
    expect(container.querySelectorAll(".hk-tag-input-tag-dragging")).toHaveLength(0);
  });

  it("keeps a sub-threshold press a click — and never drags from the ×", async () => {
    const { events, container } = mountTagInput({ modelValue: ["news", "tech"] });
    pinStrip(tags(container), 60, "x");

    // The × is a control: its press starts no drag at all, however far the
    // pointer then travels — on touch just as on a mouse.
    dragPointer({ x: 10, y: 10 }, { x: 200, y: 10 }, closeButtons(container)[0], "touch");
    await settle();
    expect(events.modelValue).toEqual([]);

    // …and the click it does own still removes its tag.
    closeButtons(container)[0].click();
    await settle();
    expect(events.remove).toEqual(["news"]);
    expect(events.modelValue.at(-1)).toEqual(["tech"]);

    // A press on the chip body that stays under the ~6px threshold is a
    // click too — no reorder, no swallowed click.
    const remaining = tags(container);
    pinStrip(remaining, 60, "x");
    dragPointer({ x: 10, y: 10 }, { x: 13, y: 10 }, remaining[0]);
    await settle();
    expect(events.modelValue.at(-1)).toEqual(["tech"]);
    expect(tagTexts(container)).toEqual(["Technology"]);
  });

  it("swallows the click a real chip drag would deliver to the field", async () => {
    const { events, container } = mountTagInput({ modelValue: ["news", "tech"] });
    const strip = tags(container);
    pinStrip(strip, 60, "x");

    dragPointer({ x: 10, y: 10 }, { x: 200, y: 10 }, strip[0]);
    // The gesture ended inside the field, so the browser delivers its click
    // to the box: the drag owns it — the panel must not pop open behind
    // the drop.
    field(container).dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await settle();

    expect(events.modelValue.at(-1)).toEqual(["tech", "news"]);
    expect(events.open).toEqual([]);
  });

  it("does not let a row drag's trailing click toggle the dragged row", async () => {
    const { events, container } = mountTagInput({ modelValue: ["news", "tech"] });
    await openPanel(container);
    const selected = reorderableRows();
    pinStrip(selected, 40, "y");
    dragPointer({ x: 10, y: 10 }, { x: 10, y: 70 }, grip(selected[0]));
    // The pointer started and ended on the SAME row (a short drag), so the
    // browser delivers its click there right after the release: the drag
    // owns that click — otherwise the row the user just moved would toggle
    // itself back OFF against the model it was moved in.
    grip(selected[0]).dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await settle();

    expect(events.remove).toEqual([]);
    expect(events.modelValue.at(-1)).toEqual(["tech", "news"]);
  });

  it("never lets a blind Enter remove a tag the query matches", async () => {
    const { events, container } = mountTagInput({ modelValue: ["tech"], allowCustom: true });
    await openPanel(container);
    const search = searchInput();
    search.focus();

    // "e" matches the SELECTED Technology first (group-strict order), then
    // News / Germany / Retired. Enter with no cursor is the "type to add"
    // gesture, so it takes the first row the field can still take instead of
    // toggling the tag the user is looking at back off.
    await typeSearch("e");
    expect(rowLabels()[0]).toBe("Technology");
    pressKey(search, "Enter");
    await settle();
    expect(events.add).toEqual(["news"]);
    expect(events.remove).toEqual([]);
    expect(events.modelValue.at(-1)).toEqual(["tech", "news"]);

    // A query naming ONLY what the field already carries has nothing to add
    // and nothing to remove — the same no-op rule a selected custom key
    // already had; the row stays for a deliberate toggle.
    await typeSearch("Technology");
    expect(rowLabels()).toEqual(["Technology"]);
    pressKey(search, "Enter");
    await settle();
    expect(events.modelValue.at(-1)).toEqual(["tech", "news"]);
    expect(events.remove).toEqual([]);
    expect(rowByLabel("Technology").getAttribute("aria-selected")).toBe("true");
  });

  it("keeps a tap on the grip from toggling its row", async () => {
    const { events, container } = mountTagInput({ modelValue: ["news"] });
    await openPanel(container);
    const row = reorderableRows()[0];
    expect(rowText(row)).toBe("News");

    // No drag happened (no movement): the press is the handle's, not the
    // row's — a handle that erased its tag on a tap would be a trap.
    grip(row).dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await settle();
    expect(events.remove).toEqual([]);
    expect(events.modelValue).toEqual([]);
    expect(rowByLabel("News").getAttribute("aria-selected")).toBe("true");
  });

  it("names the grip handle after the entry it moves", async () => {
    const { container } = mountTagInput({ modelValue: ["news", "tech"] });
    await openPanel(container);
    // The handle's name is the localized `hikari::tagInput.reorder`
    // template with the row's own label interpolated — the i18n key and
    // its `{label}` placeholder are part of the contract.
    const handle = grip(reorderableRows()[0]);
    expect(rowText(reorderableRows()[0])).toBe("News");
    expect(handle.getAttribute("aria-label")).toBe("Reorder News");
    expect(handle.getAttribute("title")).toBe("Reorder News");
    expect(handle.getAttribute("role")).toBe("button");
    expect(handle.getAttribute("tabindex"), "pointer-only affordance").toBe("-1");
  });

  it("never lets a leaving row keep the id the field publishes", async () => {
    // A catalog edit (an async reload) drops the row the cursor sits on: the
    // row leaves through the list transition while the cursor stays on its
    // index, where a DIFFERENT option now lives. An index-derived id would
    // be worn by two nodes at once, so `aria-activedescendant` could resolve
    // to the ghost; the ids are keyed, so the published one belongs to
    // exactly one LIVING row.
    const container = document.createElement("div");
    document.body.appendChild(container);
    const value = ref<readonly string[]>(["news", "tech", "de"]);
    const options = ref<readonly HkTagOption[]>(OPTIONS);
    const Host = defineComponent({
      name: "HkTagInputCatalogShrinkHost",
      setup() {
        return () =>
          h(HkTagInput, {
            modelValue: value.value,
            options: options.value,
            "onUpdate:modelValue": (keys: string[]) => {
              value.value = keys;
            },
          });
      },
    });
    const app = createApp(Host);
    app.mount(container);
    mounts.push({ app, container });
    await settle();

    chevron(container).click();
    await settle();
    pressKey(inlineInput(container)!, "ArrowDown");
    await settle();
    expect(activeRow()).toBe(rowByLabel("News"));

    options.value = OPTIONS.filter((option) => option.key !== "news");
    await nextTick();

    const published = inlineInput(container)!.getAttribute("aria-activedescendant");
    expect(published, "the field still publishes a row").toBeTruthy();
    const matches = document.querySelectorAll(`[id="${published}"]`);
    expect(matches, "the published id is worn by one row only").toHaveLength(1);
    const live = matches[0] as HTMLElement;
    expect(live.classList.contains("hk-list-reveal-leave-active")).toBe(false);
    expect(live.getAttribute("role")).toBe("option");
    expect(rowText(live)).toBe("Technology");
  });

  it("carries a panel drag past the visible band by scrolling the popout", async () => {
    const { events, container } = mountTagInput({
      modelValue: ["news", "cn-main", "tech", "de", "retired"],
    });
    await openPanel(container);
    const selected = reorderableRows();
    expect(selected.map(rowText)).toEqual([
      "News",
      "中华人民共和国",
      "Technology",
      "Germany",
      "Retired",
    ]);

    // A two-row visible band (80px) over the five-row strip: the last row is
    // only reachable by scrolling the surface — no new scroll region, the
    // popout that already owns the one scrollbar.
    const popout = document.querySelector<HTMLElement>(".hk-select-popout")!;
    expect(popout).toBeTruthy();
    pinScrollBand(popout, 80, selected);

    // Press the first row and hold near the bottom edge.
    holdPointer({ x: 10, y: 10 }, { x: 10, y: 78 }, grip(selected[0]));
    await nextTick();
    expect(dropRow(), "before any scrolling the slot is inside the band").toBe(
      rowByLabel("中华人民共和国"),
    );

    for (let i = 0; i < 40 && popout.scrollTop < 120; i += 1) await frames(1);
    expect(popout.scrollTop, "the surface is pulled along").toBeGreaterThanOrEqual(120);
    expect(dropRow(), "the slot follows the scrolled content").toBe(
      rowByLabel("Retired"),
    );

    releasePointer({ x: 10, y: 78 });
    await settle();
    // The dragged key landed last, which is what the scroll bought.
    expect(events.modelValue.at(-1)).toEqual(["cn-main", "tech", "de", "retired", "news"]);
    expect(tagTexts(container).at(-1)).toBe("News");

    // Nothing scrolls without a live drag.
    const settled = popout.scrollTop;
    await frames(3);
    expect(popout.scrollTop).toBe(settled);
  });

  it("scrolls the mobile sheet's own list band, not the popout", async () => {
    const original = window.innerWidth;
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      writable: true,
      value: 375,
    });
    try {
      const { container } = mountTagInput({ modelValue: ["news", "tech", "de"] });
      await openPanel(container);
      // Phone width: the sheet is the surface, and the band that scrolls is
      // its list — resolved at drag time, not assumed.
      expect(document.querySelector(".hk-select-popout")).toBeNull();
      const band = document.querySelector<HTMLElement>(".hk-select-sheet-list");
      expect(band, "the sheet list renders").toBeTruthy();
      const selected = reorderableRows();
      pinScrollBand(band!, 80, selected);

      holdPointer({ x: 10, y: 10 }, { x: 10, y: 78 }, grip(selected[0]));
      await nextTick();
      for (let i = 0; i < 40 && band!.scrollTop < 80; i += 1) await frames(1);
      expect(band!.scrollTop, "the sheet band is pulled along").toBeGreaterThanOrEqual(80);
      releasePointer({ x: 10, y: 78 });
      await settle();
    } finally {
      Object.defineProperty(window, "innerWidth", {
        configurable: true,
        writable: true,
        value: original,
      });
    }
  });

  it("keeps a leaving chip out of the drag strip", async () => {
    const { events, container } = mountTagInput({ modelValue: ["news", "tech", "de"] });
    // Measure the whole strip BEFORE the removal: the removed chip keeps
    // its rect while it squeezes out, so a drag that counted it would
    // resolve a different slot.
    pinStrip(tags(container), 60, "x");
    closeButtons(container)[0].click();
    await nextTick();

    const live = tags(container);
    expect(live.map((tag) => tag.textContent)).toEqual(["Technology", "Germany"]);
    expect(
      container.querySelectorAll(".hk-tag").length,
      "the removed chip is still mounted (its leave)",
    ).toBe(3);

    // Drag the FIRST LIVING chip to the end. Counting the ghost would take
    // the press for index 1 and emit the unchanged order instead.
    dragPointer({ x: 70, y: 10 }, { x: 300, y: 10 }, live[0]);
    await settle();
    expect(events.modelValue.at(-1)).toEqual(["de", "tech"]);
    expect(tagTexts(container)).toEqual(["Germany", "Technology"]);
  });

  it("keeps a leaving row out of the panel drag strip", async () => {
    const { events, container } = mountTagInput({
      modelValue: ["news", "tech", "de", "cn-main"],
    });
    await openPanel(container);
    expect(reorderableRows().map(rowText)).toEqual([
      "News",
      "Technology",
      "Germany",
      "中华人民共和国",
    ]);
    // Measure every row up front — the row about to leave keeps its rect.
    pinStrip(rows(), 40, "y");

    // "e" hides the selected 中华人民共和国: its row starts leaving and is
    // still in the DOM for the leave window, while the OTHER three remain
    // the drag strip. (One tick, not `settle()`: the ghost is guaranteed to
    // be there the moment the patch lands — which is when a real drag would
    // start — while later timers may already have swept it away.)
    const search = searchInput();
    search.value = "e";
    search.dispatchEvent(new Event("input", { bubbles: true }));
    await nextTick();
    expect(reorderableRows().map(rowText)).toEqual(["News", "Technology", "Germany"]);
    expect(
      document.querySelectorAll('.hk-tag-input-row[data-reorder="true"]').length,
      "the hidden row is still mounted (its leave)",
    ).toBe(4);

    dragPointer({ x: 10, y: 10 }, { x: 10, y: 200 }, grip(reorderableRows()[0]));
    await settle();
    expect(events.modelValue.at(-1)).toEqual(["tech", "de", "news", "cn-main"]);
    expect(rowLabels().slice(0, 3)).toEqual(["Technology", "Germany", "News"]);
  });

  it("moves the ACTIVE selected row with Alt+Arrow, and stops at the edges", async () => {
    const { events, container } = mountTagInput({ modelValue: ["news", "tech", "de"] });
    await openPanel(container);
    const search = searchInput();
    search.focus();
    const edits = () => events.modelValue.length;

    // Park the cursor on the middle selected row.
    pressKey(search, "ArrowDown");
    await settle();
    pressKey(search, "ArrowDown");
    await settle();
    expect(activeRow()).toBe(rowByLabel("Technology"));

    // Alt+ArrowUp moves it one slot up inside the selected group.
    pressKey(search, "ArrowUp", { altKey: true });
    await settle();
    expect(events.modelValue.at(-1)).toEqual(["tech", "news", "de"]);
    expect(events.add).toEqual([]);
    expect(events.remove).toEqual([]);
    expect(rowLabels().slice(0, 3)).toEqual(["Technology", "News", "Germany"]);
    // The cursor followed the row it moved, it was not left behind.
    expect(activeRow()).toBe(rowByLabel("Technology"));

    // It is the group's first row now: another Alt+ArrowUp is a hard stop.
    pressKey(search, "ArrowUp", { altKey: true });
    await settle();
    expect(edits()).toBe(1);

    // An UNSELECTED row has no place in the order — the chord does nothing.
    // Rows are [Technology, News, Germany, 中华人民共和国, Retired] now, and
    // the third of those is the first the field does not carry.
    pressKey(search, "ArrowDown");
    await settle();
    pressKey(search, "ArrowDown");
    await settle();
    pressKey(search, "ArrowDown");
    await settle();
    expect(activeRow()).toBe(rowByLabel("中华人民共和国"));
    expect(rowByLabel("中华人民共和国").hasAttribute("data-selected")).toBe(false);
    pressKey(search, "ArrowDown", { altKey: true });
    await settle();
    expect(edits()).toBe(1);

    // …and with no row active at all there is nothing to move.
    pressKey(search, "Escape");
    await settle();
    await untilSettled(() => rows().length);
    await openPanel(container);
    expect(activeRow()).toBeNull();
    pressKey(searchInput(), "ArrowDown", { altKey: true });
    await settle();
    expect(edits()).toBe(1);
  });

  it("reorders at the maxTags cap — the cap freezes adds, not the order", async () => {
    const { events, container } = mountTagInput({ modelValue: ["news", "tech"], maxTags: 2 });
    await openPanel(container);
    const search = searchInput();
    search.focus();
    pressKey(search, "ArrowDown");
    await settle();
    pressKey(search, "ArrowDown");
    await settle();
    expect(activeRow()).toBe(rowByLabel("Technology"));

    pressKey(search, "ArrowUp", { altKey: true });
    await settle();
    expect(events.modelValue.at(-1)).toEqual(["tech", "news"]);
    expect(events.add).toEqual([]);
    expect(tagTexts(container)).toEqual(["Technology", "News"]);
  });

  it("keeps every chip and row a DIRECT child of its container", async () => {
    // The FLIP groups render as fragments: no wrapper element may appear
    // between the box and its chips, or between the listbox and its rows.
    const { container } = mountTagInput({ modelValue: ["news", "tech"] });
    const box = field(container);
    for (const chip of tags(container)) expect(chip.parentElement).toBe(box);
    expect(inlineInput(container)!.parentElement).toBe(box);

    await openPanel(container);
    const list = document.querySelector<HTMLElement>(".hk-tag-input-list")!;
    expect(list.getAttribute("role")).toBe("listbox");
    expect(rows()).toHaveLength(OPTIONS.length);
    for (const row of rows()) expect(row.parentElement).toBe(list);
  });

  it("caps the mobile sheet too — on the band that scrolls", async () => {
    const original = window.innerWidth;
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      writable: true,
      value: 375,
    });
    try {
      const { container } = mountTagInput({ modelValue: ["news"] });
      await openPanel(container);
      // Phone width: the sheet replaces the popout, and the same cap lands
      // on the sheet's scrolling list (the surface the user actually drags).
      expect(document.querySelector(".hk-select-popout-host")).toBeNull();
      const list = document.querySelector<HTMLElement>(".hk-select-sheet-list");
      expect(list, "the sheet list renders").toBeTruthy();
      expect(list!.style.getPropertyValue("--hk-select-panel-max-height")).toBe(
        "min(18rem, 45dvh)",
      );
    } finally {
      Object.defineProperty(window, "innerWidth", {
        configurable: true,
        writable: true,
        value: original,
      });
    }
  });

  it("leaves a removed chip through the list-transition leave", async () => {
    // Both lists are HkListTransition groups (FLIP `move` + the reveal
    // squeeze): a removal squeezes the chip out instead of vanishing, and
    // the logical list is short immediately.
    const { container } = mountTagInput({ modelValue: ["news", "tech"] });
    closeButtons(container)[0].click();
    await nextTick();
    expect(container.querySelectorAll(".hk-tag.hk-list-reveal-leave-active")).toHaveLength(1);
    expect(tagTexts(container)).toEqual(["Technology"]);
  });
});

/* The stylesheet half of the states asserted above: happy-dom has no layout
 * engine, so the DOM tests can only pin the HOOKS — these assertions pin
 * what those hooks actually buy (the lift, the selection restore, and the
 * reduced-motion handling), the way the sibling contract tests in this
 * directory pin the scroll and panel-geometry contracts. */
const scss = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "HkTagInput.scss"), "utf-8");

/** The declaration block of the rule whose selector list starts at the
 *  FIRST `selector` occurrence — braces balanced, so a nested block cannot
 *  let properties appended after it evade the pin. */
function styleBlock(selector: string): string {
  const at = scss.indexOf(selector);
  expect(at, `${selector} is styled`).toBeGreaterThanOrEqual(0);
  const open = scss.indexOf("{", at);
  let depth = 0;
  for (let i = open; i < scss.length; i += 1) {
    if (scss[i] === "{") depth += 1;
    else if (scss[i] === "}") {
      depth -= 1;
      if (depth === 0) return scss.slice(open, i + 1);
    }
  }
  return "";
}

describe("HkTagInput drag feedback and text selection", () => {
  it("lifts the dragged item in both lists instead of only dimming it", () => {
    const lift = styleBlock(".hk-tag-input-tag-dragging,");
    // ONE rule body serves both lists: the chip's class and the row's data
    // attribute — the very hooks the DOM tests above assert.
    expect(scss).toMatch(
      /\.hk-tag-input-tag-dragging,\s*\n\.hk-tag-input-row\[data-dragging\]\s*\{/,
    );
    expect(lift).toMatch(/box-shadow:/);
    // Subtle dimming on purpose: the lifted item must stay readable as the
    // one being moved, not fade away (the pre-wave 0.55 did).
    expect(lift).toMatch(/opacity:\s*0\.85/);
    // The lift is a state, never layout: no width/height/margin edits, and
    // no isotropic scale smuggled into the shared body.
    expect(lift).not.toMatch(/(^|[^-])(width|height|margin|padding)\s*:/);
    expect(lift).not.toMatch(/transform\s*:/);
  });

  it("scales each list ALONG its drag axis and never across it", () => {
    // The drop slot is resolved from the items' live rects
    // (usePointerReorder.indexAt): the item's midpoint on the drag axis
    // picks the slot, and every item's span on the axis ACROSS it decides
    // which line the pointer is on. A scale is symmetric about the centre,
    // so scaling along the drag axis changes neither — while growing across
    // it widens the dragged item's band, and a pointer a few pixels outside
    // the strip would then match that item alone: every sibling falls out of
    // the line filter and the drag silently collapses to a no-op. CSS is the
    // only place this can regress, so each hook's own transform is pinned.
    const axisTransform = (hook: string): string | undefined =>
      scss.match(
        new RegExp(`${hook.replace(/[[\]]/g, "\\$&")}\\s*\\{\\s*transform:\\s*([^;]+);`),
      )?.[1];
    expect(axisTransform(".hk-tag-input-tag-dragging"), "the chip strip is horizontal").toBe(
      "scaleX(1.03)",
    );
    expect(axisTransform(".hk-tag-input-row[data-dragging]"), "the row list is vertical").toBe(
      "scaleY(1.03)",
    );
  });

  it("keeps the lift's state marker under reduced motion and drops only its ramp", () => {
    const reduce = scss.slice(scss.indexOf("@media (prefers-reduced-motion: reduce)"));
    expect(reduce, "the reduced-motion block exists").toContain(".hk-tag-input-tag-dragging");
    expect(reduce).toContain(".hk-tag-input-row[data-dragging]");
    expect(reduce).toMatch(/transition:\s*none/);
    // The scale and the shadow survive — a reduced-motion user gets the
    // same affordance, just without the 0.12s motion.
    expect(reduce).not.toMatch(/transform:\s*none/);
    expect(reduce).not.toMatch(/box-shadow:\s*none/);
  });

  it("restores text selection on a disabled field's chips only", () => {
    const disabled = styleBlock(".hk-tag-input-box[data-disabled] .hk-tag-input-tag");
    expect(disabled).toContain("user-select: text");
    expect(disabled).toContain("-webkit-user-select: text");
    expect(disabled).toContain("cursor: default");
    // The editable chip keeps the gesture reservation: its press is the
    // reorder gesture, so it stays non-selectable (the documented trade-off).
    const chip = styleBlock(".hk-tag-input-tag {");
    expect(chip).toContain("user-select: none");
    expect(chip).toContain("cursor: grab");
    // The panel rows' LABELS are never selection-blocked — only the grip,
    // which is the drag handle, reserves the gesture.
    expect(styleBlock(".hk-tag-input-grip {")).toContain("user-select: none");
    const row = styleBlock(".hk-tag-input-row {");
    expect(row).not.toMatch(/user-select/);
  });
});
