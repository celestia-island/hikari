import { afterEach, describe, expect, it } from "vitest";
import { createApp, h, nextTick, ref } from "vue";
import { dirname, join } from "node:path";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import HkAffixPicker, { type HkAffixOption } from "./HkAffixPicker";

/** Regional-indicator flag pair for an ISO 3166-1 alpha-2 code, built
 * from code points (same derivation as data/dialCodes flagEmoji) so the
 * fixture source itself carries no literal emoji. */
const flagOf = (iso: string): string =>
  String.fromCodePoint(
    ...Array.from(iso.toUpperCase(), (c) => 0x1f1e6 + c.charCodeAt(0) - 65),
  );

const OPTIONS: HkAffixOption[] = [
  { key: "cn", label: "China", meta: "+86", flag: flagOf("cn"), keywords: "zhongguo 中国 0086" },
  { key: "cn-main", label: "中华人民共和国", meta: "+86", flag: flagOf("cn") },
  { key: "jp", label: "Japan", meta: "+81", flag: flagOf("jp") },
  { key: "us", label: "United States", meta: "+1", flag: flagOf("us") },
];

const mounts: Array<{ app: ReturnType<typeof createApp>; container: HTMLElement }> = [];

interface MountOptions {
  mode?: "single" | "multi";
  layout?: "rows" | "tags";
  selected?: string | string[];
  activeKey?: string;
  allowCustom?: boolean;
  searchable?: boolean;
  closeOnSelect?: boolean;
  confirmRemove?: boolean;
  disabled?: boolean;
  tagValues?: Record<string, string>;
  options?: HkAffixOption[];
}

function mountPicker(opts: MountOptions = {}) {
  const events = {
    select: [] as string[],
    remove: [] as string[],
    custom: [] as string[],
    open: [] as boolean[],
  };
  const container = document.createElement("div");
  document.body.appendChild(container);
  const app = createApp({
    render: () =>
      h(HkAffixPicker, {
        options: opts.options ?? OPTIONS,
        mode: opts.mode ?? "single",
        layout: opts.layout,
        selected: opts.selected ?? "",
        activeKey: opts.activeKey,
        allowCustom: opts.allowCustom ?? false,
        searchable: opts.searchable ?? true,
        closeOnSelect: opts.closeOnSelect,
        confirmRemove: opts.confirmRemove,
        disabled: opts.disabled ?? false,
        tagValues: opts.tagValues,
        onSelect: (key: string) => events.select.push(key),
        onRemove: (key: string) => events.remove.push(key),
        onCustom: (q: string) => events.custom.push(q),
        "onUpdate:open": (v: boolean) => events.open.push(v),
      }),
  });
  app.mount(container);
  mounts.push({ app, container });
  return { events, container };
}

function queryChip(container: HTMLElement): HTMLButtonElement {
  const chip = container.querySelector<HTMLButtonElement>(".hk-affix-chip");
  expect(chip, "affix chip renders").toBeTruthy();
  return chip!;
}

async function openPopup(container: HTMLElement) {
  queryChip(container).click();
  await nextTick();
  await nextTick();
}

function rows(): HTMLButtonElement[] {
  return [...document.querySelectorAll<HTMLButtonElement>(".hk-affix-row")];
}

function tags(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>(".hk-affix-tag")];
}

function tag(label: string): HTMLElement | undefined {
  return tags().find(
    (t) => (t.querySelector(".hk-affix-tag-text")?.textContent ?? "") === label,
  );
}

function searchInput(): HTMLInputElement {
  const input = document.querySelector<HTMLInputElement>(".hk-affix-search input");
  expect(input, "search field renders").toBeTruthy();
  return input!;
}

async function typeQuery(value: string) {
  const input = searchInput();
  input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  await nextTick();
  await nextTick();
  // The rows ride HkListTransition: a filtered-out row LEAVES (ghost in
  // the DOM for the transition window) rather than vanishing on the
  // patch — wait the ghosts out so `rows()` reads the settled list.
  await untilSettled(() => document.querySelectorAll(".hk-affix-row.hk-list-pop-leave-active").length);
}

/** Rows that are actually staying (not mid-leave ghosts). */
function liveRows(): HTMLButtonElement[] {
  return rows().filter((r) => !r.classList.contains("hk-list-pop-leave-active"));
}

function divider(): HTMLElement | null {
  return document.querySelector<HTMLElement>(".hk-affix-divider");
}

function rowLabels(): string[] {
  return liveRows().map((r) => r.querySelector(".hk-affix-row-label")?.textContent ?? "");
}

async function untilSettled(check: () => number): Promise<void> {
  const deadline = Date.now() + 800;
  while (check() > 0 && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 10));
    await nextTick();
  }
}

/** Let the message box mount (own app) and its promise chain settle. */
async function flush() {
  await nextTick();
  await nextTick();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

function confirmButton(): HTMLButtonElement {
  const btn = document.body.querySelector<HTMLButtonElement>(".hk-message-box-confirm");
  expect(btn, "message box confirm button renders").toBeTruthy();
  return btn!;
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

describe("HkAffixPicker", () => {
  it("renders the default chip content with the selected option's label", () => {
    const { container } = mountPicker({ selected: "jp" });
    expect(queryChip(container).textContent).toContain("Japan");
  });

  it("single mode lists every option, marks the active one, closes on pick", async () => {
    const { events, container } = mountPicker({ selected: "cn" });
    await openPopup(container);
    expect(rows()).toHaveLength(4);
    expect(rows()[0].hasAttribute("data-active")).toBe(true);
    rows()[2].click();
    await nextTick();
    expect(events.select.at(-1)).toBe("jp");
    // Single mode closes after the pick (leave transition may linger).
    await untilSettled(() => rows().length);
    expect(rows()).toHaveLength(0);
  });

  it("filters rows by label, meta and keywords", async () => {
    const { container } = mountPicker();
    await openPopup(container);
    await typeQuery("+81");
    expect(rows().map((r) => r.textContent)).toEqual([expect.stringContaining("Japan")]);
    await typeQuery("0086");
    expect(rows().map((r) => r.textContent)).toEqual([expect.stringContaining("China")]);
    await typeQuery("zzz");
    expect(rows()).toHaveLength(0);
    expect(document.querySelector(".hk-affix-empty")?.textContent).toContain("No matches");
  });

  it("fuzzy fallback finds a renamed CJK label by in-order subsequence", async () => {
    const { container } = mountPicker();
    await openPopup(container);
    // 中国 is NOT a substring of 中华人民共和国 — only the in-order
    // subsequence fallback (中 at 0, 国 at 6) can surface the cn-main
    // row the substring pass misses.
    await typeQuery("中国");
    const labels = rows().map((r) => r.textContent);
    // Both the China row (keyword substring match) and the renamed
    // cn-main row (fuzzy subsequence) surface.
    expect(labels).toContain(`${flagOf("cn")}China+86`);
    expect(labels.some((l) => l.includes("中华人民共和国"))).toBe(true);
  });

  it("order-violating query does not fuzzy-match the CJK label", async () => {
    const { container } = mountPicker();
    await openPopup(container);
    // 国民 is out of order in 中华人民共和国 (国 comes after 民) — the
    // subsequence pass must NOT surface the row.
    await typeQuery("国民");
    expect(rows()).toHaveLength(0);
    expect(document.querySelector(".hk-affix-empty")?.textContent).toContain("No matches");
  });

  it("re-attaches the row list when the empty-state query is cleared", async () => {
    const { container } = mountPicker();
    await openPopup(container);
    // A no-match query swaps the default slot to the empty branch —
    // the list block unmounts.
    await typeQuery("zzz-none");
    expect(document.querySelector(".hk-affix-empty")).toBeTruthy();
    expect(document.querySelector(".hk-affix-scroll")).toBeNull();
    // Clearing the query remounts a FRESH list — the row list must come
    // back inside its width container.
    await typeQuery("");
    expect(document.querySelector(".hk-affix-empty")).toBeNull();
    expect(rows().map((r) => r.textContent)).toEqual([
      expect.stringContaining("China"),
      expect.stringContaining("中华人民共和国"),
      expect.stringContaining("Japan"),
      expect.stringContaining("United States"),
    ]);
    expect(document.querySelector(".hk-affix-scroll")).toBeTruthy();
    expect(document.querySelector(".hk-affix-list")).toBeTruthy();
    // Re-filtering after the remount keeps working on the live list.
    await typeQuery("+86");
    // Both +86 rows match by substring (the cn-main row via its meta) —
    // the original fixtured "China" row is still surfaced.
    expect(rows().map((r) => r.textContent)).toEqual([
      expect.stringContaining("China"),
      expect.stringContaining("中华人民共和国"),
    ]);
  });

  it("tag layout renders selected tags and offers only the remaining rows", async () => {
    const { container } = mountPicker({ mode: "multi", layout: "tags", selected: ["cn", "jp"], activeKey: "cn" });
    await openPopup(container);
    expect(tags().map((t) => t.querySelector(".hk-affix-tag-text")?.textContent)).toEqual([
      "China",
      "Japan",
    ]);
    // The active key's tag carries the dot.
    expect(tags()[0].querySelector(".hk-affix-tag-dot")).toBeTruthy();
    expect(tags()[1].querySelector(".hk-affix-tag-dot")).toBeNull();
    // Rows exclude the already-selected keys.
    expect(rows().map((r) => r.textContent)).toEqual([
      expect.stringContaining("中华人民共和国"),
      expect.stringContaining("United States"),
    ]);
  });

  it("tag layout keeps the popup open when a row is picked", async () => {
    const { events, container } = mountPicker({ mode: "multi", layout: "tags", selected: ["cn"] });
    await openPopup(container);
    // With cn selected, the remaining rows are [cn-main, jp, us]; pick jp.
    rows()[1].click();
    await nextTick();
    expect(events.select.at(-1)).toBe("jp");
    expect(rows().length).toBeGreaterThan(0);
  });

  it("tag × opens a confirm dialog: Cancel keeps the tag, Confirm fires remove", async () => {
    const { events, container } = mountPicker({ mode: "multi", layout: "tags", selected: ["cn", "jp"] });
    await openPopup(container);
    // One tap never erases: the dialog names the entry instead.
    tags()[0].querySelector<HTMLButtonElement>(".hk-affix-tag-x")!.click();
    // The dialog mounts over several transition frames; wait for the
    // settled state (box open, tag untouched) before asserting.
    await untilBoxOpen('Remove "China"');
    expect(events.remove).toHaveLength(0);
    expect(tag("China")).toBeTruthy();
    // Cancel keeps everything as it was.
    [...document.body.querySelectorAll<HTMLButtonElement>(".hk-message-box-actions button")]
      .find((b) => !b.classList.contains("hk-message-box-confirm"))!
      .click();
    await flush();
    expect(events.remove).toHaveLength(0);
    expect(tag("China")).toBeTruthy();
    // Second pass: the dialog's Confirm is what erases.
    tags()[0].querySelector<HTMLButtonElement>(".hk-affix-tag-x")!.click();
    await untilBoxOpen('Remove "China"');
    confirmButton().click();
    const deadline = Date.now() + 1500;
    while (events.remove.length === 0 && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 10));
      await nextTick();
    }
    expect(events.remove).toEqual(["cn"]);
    expect(events.select).toHaveLength(0);
  });

  it("confirmRemove=false lets the × fire remove immediately, no dialog", async () => {
    const { events, container } = mountPicker({
      mode: "multi",
      layout: "tags",
      selected: ["cn"],
      confirmRemove: false,
    });
    await openPopup(container);
    tags()[0].querySelector<HTMLButtonElement>(".hk-affix-tag-x")!.click();
    await flush();
    expect(events.remove).toEqual(["cn"]);
    expect(document.body.querySelector(".hk-message-box-text")).toBeNull();
  });

  /** Poll until the confirm dialog is mounted AND shows the given body
   *  text — the box rides HkModal's multi-frame open transition. */
  async function untilBoxOpen(fragment: string): Promise<void> {
    const deadline = Date.now() + 1500;
    while (Date.now() < deadline) {
      const text = document.body.querySelector(".hk-message-box-text")?.textContent ?? "";
      if (text.includes(fragment)) {
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
      `confirm dialog showing "${fragment}"`,
    ).toContain(fragment);
  }

  it("tag body click emits select; close-on-select default keeps multi open", async () => {
    const { events, container } = mountPicker({ mode: "multi", layout: "tags", selected: ["cn", "jp"] });
    await openPopup(container);
    tags()[1].querySelector<HTMLButtonElement>(".hk-affix-tag-body")!.click();
    await nextTick();
    expect(events.select.at(-1)).toBe("jp");
    expect(rows().length).toBeGreaterThan(0);
  });

  it("allowCustom offers a Use-row for unmatched queries and suppresses it on exact matches", async () => {
    const { events, container } = mountPicker({ allowCustom: true });
    await openPopup(container);
    await typeQuery("gitee.com");
    const custom = document.querySelector<HTMLButtonElement>('.hk-affix-row[data-custom="true"]');
    expect(custom?.textContent).toContain('Use "gitee.com"');
    custom!.click();
    await nextTick();
    expect(events.custom).toEqual(["gitee.com"]);
    // Single mode closed on the custom pick — wait out the leave ghost,
    // then reopen for the exact-match phase.
    await untilSettled(() => rows().length);
    await openPopup(container);
    await typeQuery("Japan");
    expect(document.querySelector('.hk-affix-row[data-custom="true"]')).toBeNull();
    expect(rows().map((r) => r.textContent)).toEqual([expect.stringContaining("Japan")]);
  });

  it("Enter in the search picks the first row, or the custom row when nothing matches", async () => {
    const { events, container } = mountPicker({ allowCustom: true });
    await openPopup(container);
    await typeQuery("uni");
    searchInput().dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    await nextTick();
    expect(events.select.at(-1)).toBe("us");
    // Single mode closed on the pick — reopen before the custom phase.
    await untilSettled(() => rows().length);
    await openPopup(container);
    await typeQuery("gitee.com");
    searchInput().dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    await nextTick();
    expect(events.custom.at(-1)).toBe("gitee.com");
  });

  it("disables the chip and ignores interaction while disabled", async () => {
    const { container } = mountPicker({ disabled: true });
    expect(queryChip(container).disabled).toBe(true);
    await openPopup(container);
    expect(rows()).toHaveLength(0);
  });

  it("tagValues swaps the tag primary text to each key's value", async () => {
    const { container } = mountPicker({
      mode: "multi",
      layout: "tags",
      selected: ["cn", "jp"],
      tagValues: { cn: "China's stored text", jp: "  " },
    });
    await openPopup(container);
    const texts = tags().map(
      (t) => t.querySelector(".hk-affix-tag-text")?.textContent,
    );
    // cn carries its stored value; jp (whitespace-only = unfilled) shows
    // the italic unset placeholder.
    expect(texts).toEqual(["China's stored text", "Not set"]);
    expect(tags()[0].querySelector(".hk-affix-tag-text")?.hasAttribute("data-unset")).toBe(false);
    expect(tags()[1].querySelector(".hk-affix-tag-text")?.hasAttribute("data-unset")).toBe(true);
    // The autonym survives as the tag's identity in the title (and the
    // confirm dialog / aria naming, asserted in the dialog tests).
    expect(
      tags()[0].querySelector<HTMLButtonElement>(".hk-affix-tag-body")?.title,
    ).toContain("China");
    // The pick rows are untouched — they keep the autonym labels.
    expect(rows().map((r) => r.textContent)).toEqual([
      expect.stringContaining("中华人民共和国"),
      expect.stringContaining("United States"),
    ]);
  });

  it("a tagValues key missing from the map renders the unset placeholder", async () => {
    const { container } = mountPicker({
      mode: "multi",
      layout: "tags",
      selected: ["us"],
      tagValues: {},
    });
    await openPopup(container);
    const text = tags()[0].querySelector(".hk-affix-tag-text")!;
    expect(text.textContent).toBe("Not set");
    expect(text.hasAttribute("data-unset")).toBe(true);
  });

  it("without tagValues the tags keep the autonym labels (no unset state)", async () => {
    const { container } = mountPicker({ mode: "multi", layout: "tags", selected: ["cn"] });
    await openPopup(container);
    const text = tags()[0].querySelector(".hk-affix-tag-text")!;
    expect(text.textContent).toBe("China");
    expect(text.hasAttribute("data-unset")).toBe(false);
  });

  it("mounts NO inner scroll region — the window owns the one scrollbar", async () => {
    const { container } = mountPicker({
      mode: "multi",
      selected: ["cn", "jp", "us"],
    });
    await openPopup(container);
    expect(
      document.querySelector<HTMLElement>(".hk-affix-list"),
      "row list renders",
    ).toBeTruthy();
    // No overlay-scroll chrome of the list's own inside the popup — the
    // CSS/text half of the contract is pinned by the contract test.
    expect(document.querySelector(".hk-affix-list .hk-scrollbar-track")).toBeNull();
  });

  it("caps its popup surface with the tag editor's own measure", async () => {
    const { container } = mountPicker({ mode: "multi", selected: ["cn"] });
    await openPopup(container);

    // The picker renders through HkMenu, which forwards a cap to the shared
    // panel surface: the popup scrolls inside min(18rem, 45dvh) instead of
    // stretching to the panel's 36rem ceiling — the same measure HkTagInput
    // uses, so the two sibling chip pickers read consistently.
    const popout = document.querySelector<HTMLElement>(".hk-select-popout");
    expect(popout, "the popup renders as the shared popout").toBeTruthy();
    expect(popout!.style.getPropertyValue("--hk-select-panel-max-height")).toBe(
      "min(18rem, 45dvh)",
    );
    // The cap is the SURFACE's: the popout carries the hook and no inline
    // max-height of its own…
    expect(popout!.style.maxHeight).toBe("");
    // …and the picker still opts out of matching the chip's width.
    expect(document.querySelector<HTMLElement>(".hk-select-popout-host")!.style.minWidth).toBe(
      "",
    );

    // The popup's designed measure is untouched: the content wrapper stays a
    // plain width container with no cap or scroll region of its own.
    const content = document.querySelector<HTMLElement>(".hk-affix-scroll");
    expect(content, "the content wrapper renders").toBeTruthy();
    expect(content!.hasAttribute("style"), "no inline style on the content").toBe(false);
    expect(document.querySelector(".hk-affix-list .hk-scrollbar-track")).toBeNull();
  });
});

/** The rows layout (2026-11-27 user direction): a multi picker builds
 *  NOTHING in front of the search field for its selection — the checked
 *  rows wear the leading check and float to the top in catalog order
 *  behind a divider, and a tap toggles. */
describe("HkAffixPicker rows layout (multi default)", () => {
  it("is the default multi layout: every option stays a row, no tags", async () => {
    const { container } = mountPicker({ mode: "multi", selected: ["jp"] });
    await openPopup(container);
    expect(tags()).toHaveLength(0);
    expect(rowLabels()).toEqual(["Japan", "China", "中华人民共和国", "United States"]);
  });

  it("floats checked rows to the top in CATALOG order behind a divider", async () => {
    const { container } = mountPicker({ mode: "multi", selected: ["us", "cn"] });
    await openPopup(container);
    // Catalog order cn < jp < us: the selected run keeps it (cn, us), the
    // rest keeps it too (cn-main, jp) — never selection order.
    expect(rowLabels()).toEqual(["China", "United States", "中华人民共和国", "Japan"]);
    const d = divider();
    expect(d, "the boundary divider renders").toBeTruthy();
    expect(d!.getAttribute("role")).toBe("separator");
    // …between the last checked row and the first unchecked one, as a
    // direct child of the keyed list host.
    const kids = [...document.querySelector(".hk-affix-list")!.children];
    expect(kids.map((k) => k.classList.contains("hk-affix-divider") ? "|" : (k.querySelector(".hk-affix-row-label")?.textContent ?? "?")))
      .toEqual(["China", "United States", "|", "中华人民共和国", "Japan"]);
  });

  it("wears the leading check only on checked rows (aria-pressed toggle buttons)", async () => {
    const { container } = mountPicker({ mode: "multi", selected: ["jp"] });
    await openPopup(container);
    const checked = liveRows().filter((r) => r.hasAttribute("data-checked"));
    expect(checked).toHaveLength(1);
    expect(checked[0].textContent).toContain("Japan");
    expect(checked[0].getAttribute("aria-pressed")).toBe("true");
    expect(checked[0].querySelector(".hk-affix-check svg")).toBeTruthy();
    const unchecked = liveRows().filter((r) => !r.hasAttribute("data-checked"));
    for (const r of unchecked) {
      expect(r.getAttribute("aria-pressed")).toBe("false");
      // The cell is RESERVED on every row (labels align), empty when off.
      expect(r.querySelector(".hk-affix-check")).toBeTruthy();
      expect(r.querySelector(".hk-affix-check svg")).toBeNull();
    }
    // The check cell leads: it precedes the flag/badge/label inside the row.
    const first = liveRows()[0];
    expect(first.firstElementChild?.classList.contains("hk-affix-check")).toBe(true);
  });

  it("a tap toggles: unchecked → select, checked → remove (no confirm dialog)", async () => {
    const { events, container } = mountPicker({ mode: "multi", selected: ["cn"], confirmRemove: true });
    await openPopup(container);
    liveRows().find((r) => r.textContent?.includes("Japan"))!.click();
    await nextTick();
    expect(events.select).toEqual(["jp"]);
    expect(events.remove).toEqual([]);
    // Unchecking the already-selected China fires remove directly — the
    // confirm gate guards erasing a typed VALUE in the tag layout, not a
    // one-tap reversible check.
    liveRows().find((r) => r.textContent?.includes("China"))!.click();
    await nextTick();
    expect(events.remove).toEqual(["cn"]);
    expect(document.body.querySelector(".hk-message-box-text")).toBeNull();
    // Multi stays open on both edges.
    expect(events.open.at(-1)).toBe(true);
  });

  it("draws no divider when nothing is checked — and stays in catalog order when everything is", async () => {
    // Two different facts. The FIRST is a real boundary case: no selected
    // run at all, so there is no boundary to draw.
    //
    // The "everything checked" half is NOT a divider case and is not claimed
    // as one: `rowNodes` only inserts at `index === selectedRunLength`, and
    // an index never reaches `rows.length`, so the `run < rows.length` clause
    // is unreachable by construction (recorded as S3 in the 2026-11-27 R3
    // round — kept as belt, not as a covered branch). What this half DOES
    // pin is the ranking under a full selection: with all four keys selected
    // the order must still be the catalog's, not selection order.
    const none = mountPicker({ mode: "multi", selected: [] });
    await openPopup(none.container);
    expect(rowLabels()).toEqual(["China", "中华人民共和国", "Japan", "United States"]);
    expect(divider()).toBeNull();
    const all = mountPicker({ mode: "multi", selected: ["us", "cn-main", "jp", "cn"] });
    await openPopup(all.container);
    expect(rowLabels(), "catalog order survives a FULL selection").toEqual([
      "China",
      "中华人民共和国",
      "Japan",
      "United States",
    ]);
    expect(divider(), "no boundary when there is no unselected run").toBeNull();
  });

  it("ranks the FILTERED rows: a query matching only unchecked options shows no divider", async () => {
    const { container } = mountPicker({ mode: "multi", selected: ["cn"] });
    await openPopup(container);
    await typeQuery("sta");
    expect(rowLabels()).toEqual(["United States"]);
    expect(divider()).toBeNull();
    // A query spanning both groups keeps the ranking and the boundary:
    // "8" matches +86 (China, checked) and +86/+81 (the other two).
    await typeQuery("8");
    expect(rowLabels()).toEqual(["China", "中华人民共和国", "Japan"]);
    expect(divider()).toBeTruthy();
  });

  it("runs the rows through HkListTransition with the move track on (FLIP, never a remount)", async () => {
    // A host that really stores the selection (the event-recording rig
    // keeps `selected` static, so nothing would re-rank).
    const selected = ref<string[]>([]);
    const container = document.createElement("div");
    document.body.appendChild(container);
    const app = createApp({
      render: () =>
        h(HkAffixPicker, {
          options: OPTIONS,
          mode: "multi",
          selected: selected.value,
          onSelect: (k: string) => { selected.value = [...selected.value, k]; },
          onRemove: (k: string) => { selected.value = selected.value.filter((x) => x !== k); },
        }),
    });
    app.mount(container);
    mounts.push({ app, container });
    await openPopup(container);
    const list = document.querySelector<HTMLElement>(".hk-affix-list");
    expect(list, "the list host renders").toBeTruthy();
    const jp = liveRows().find((r) => r.textContent?.includes("Japan"))!;
    jp.click();
    await nextTick();
    // The same DOM node moved to the head of the list (keyed, not rebuilt).
    const after = liveRows();
    expect(after[0]).toBe(jp);
    expect(after[0].textContent).toContain("Japan");
    expect(after[0].hasAttribute("data-checked")).toBe(true);
    expect(document.querySelector(".hk-affix-list.hk-list-move-disabled"), "move track is NOT disabled").toBeNull();
  });
});

/** The PINNED search head (2026-11-27 user direction): the filter field is
 *  chrome outside the scroll region on both form factors, so a long
 *  catalog scrolls under it instead of taking it along. */
describe("HkAffixPicker pinned search head", () => {
  it("desktop popout: the search sits in the pinned band, the rows in the scrolling body", async () => {
    const { container } = mountPicker({ mode: "multi", selected: ["cn"] });
    await openPopup(container);
    const popout = document.querySelector<HTMLElement>(".hk-select-popout")!;
    expect(popout.classList.contains("is-pinned-header")).toBe(true);
    const pinned = document.querySelector(".hk-select-popout-pinned");
    const body = document.querySelector(".hk-select-popout-body");
    expect(pinned, "pinned band renders").toBeTruthy();
    expect(body, "body renders").toBeTruthy();
    expect(pinned!.querySelector(".hk-affix-search input"), "search is in the pinned band").toBeTruthy();
    expect(body!.querySelector(".hk-affix-search"), "search is NOT in the scrolling body").toBeNull();
    expect(body!.querySelector(".hk-affix-list"), "rows are in the scrolling body").toBeTruthy();
    expect(body!.closest(".hk-select-popout-body-host"), "the rail host wraps the body").toBeTruthy();
    // Single mode pins the search exactly the same way.
    const single = mountPicker();
    await openPopup(single.container);
    expect(document.querySelector(".hk-select-popout-pinned .hk-affix-search")).toBeTruthy();
  });

  it("mobile sheet: the search sits between the title row and the list band", async () => {
    window.innerWidth = 390;
    window.dispatchEvent(new Event("resize"));
    try {
      const { container } = mountPicker({ mode: "multi", selected: ["cn"] });
      await openPopup(container);
      const band = document.querySelector(".hk-select-sheet-pinned");
      const list = document.querySelector(".hk-select-sheet-list");
      expect(band, "pinned band renders").toBeTruthy();
      expect(band!.querySelector(".hk-affix-search input"), "search is in the pinned band").toBeTruthy();
      expect(list!.querySelector(".hk-affix-search"), "search is NOT inside the scrolling list").toBeNull();
      expect(list!.querySelector(".hk-affix-row"), "rows are inside the scrolling list").toBeTruthy();
      // Band order inside the panel: header → pinned → body.
      const panel = document.querySelector(".hk-select-sheet-panel")!;
      const order = [...panel.children].map((c) => c.className);
      expect(order.indexOf("hk-select-sheet-header")).toBeLessThan(order.indexOf("hk-select-sheet-pinned"));
      expect(order.indexOf("hk-select-sheet-pinned")).toBeLessThan(order.indexOf("hk-select-sheet-body"));
    } finally {
      window.innerWidth = 1200;
      window.dispatchEvent(new Event("resize"));
    }
  });

  it("tag layout pins the tag list together with the search (the whole head)", async () => {
    const { container } = mountPicker({ mode: "multi", layout: "tags", selected: ["cn"] });
    await openPopup(container);
    const pinned = document.querySelector(".hk-select-popout-pinned")!;
    expect(pinned.querySelector(".hk-affix-tags")).toBeTruthy();
    expect(pinned.querySelector(".hk-affix-search")).toBeTruthy();
    expect(document.querySelector(".hk-select-popout-body .hk-affix-tags"), "tags are not in the scrolling body").toBeNull();
  });
});

describe("affix side → popup placement contract", () => {
  it("anchors side=suffix popups to the bottom-end edge", () => {
    // The suffix side hosts unit pickers (e.g. KiB/MiB/GiB chips on a
    // number field — shittim-chest quota editor): the popup must anchor
    // to the END edge so it opens toward the viewport instead of off
    // the field's right edge. The mapping is one expression in the
    // component; this source contract pins it against silent edits.
    const src = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "HkAffixPicker.tsx"),
      "utf-8",
    );
    expect(src).toContain(
      'props.side === "suffix" ? "bottom-end" : "bottom-start"',
    );
  });
});

describe("HkAffixPicker badge capsule", () => {
  /** Provider-roster fixture (the shape GroupEditModal ships): a
   *  textual ordinal rides `badge` — the standard capsule slot — and
   *  never the emoji-font `flag` glyph slot (2026-11-20 user report:
   *  `flag: "#1"` rendered bare unstyled text). */
  const BADGED: HkAffixOption[] = [
    { key: "llama-local", label: "llama-local", badge: "#1", keywords: "llama-local" },
    { key: "deepseek", label: "deepseek", badge: "#2", keywords: "deepseek" },
    { key: "bare", label: "bare provider" },
  ];

  it("renders the badge as a standard capsule before the label; flag slot stays empty", async () => {
    const { container } = mountPicker({ options: BADGED, selected: "llama-local" });
    await openPopup(container);
    const badges = [...document.querySelectorAll<HTMLElement>(".hk-affix-row-badge")];
    expect(badges.map((b) => b.textContent)).toEqual(["#1", "#2"]);
    // The capsule IS the standard badge chrome — primary wash, mono face,
    // small size, squared pill — not just any span wearing the class
    // (R2: a props-degraded mutant must turn red here).
    for (const b of badges) {
      expect(b.classList.contains("hk-badge-primary")).toBe(true);
      expect(b.dataset.size).toBe("sm");
      expect(b.dataset.mono).toBe("");
      expect(b.dataset.pill).toBe("false");
    }
    // Textual ordinals must not leak into the emoji-flag glyph span.
    expect(document.querySelector(".hk-affix-row-flag")).toBeNull();
    // Capsule precedes the label inside its row (the row grammar's own
    // 8px menu-item gap provides the spacing — no hand-tuned margins).
    const row = rows()[0];
    const badgeEl = row.querySelector(".hk-affix-row-badge");
    const labelEl = row.querySelector(".hk-affix-row-label");
    expect(
      badgeEl &&
        labelEl &&
        !!(badgeEl.compareDocumentPosition(labelEl) & Node.DOCUMENT_POSITION_FOLLOWING),
    ).toBe(true);
  });

  it("tag layout keeps the badge on selected tags and remaining rows alike", async () => {
    const { container } = mountPicker({
      options: BADGED,
      mode: "multi",
      layout: "tags",
      selected: ["deepseek"],
    });
    await openPopup(container);
    const t = tag("deepseek");
    expect(t, "selected tag renders").toBeTruthy();
    expect(t!.querySelector(".hk-affix-tag-badge")?.textContent).toBe("#2");
    // The not-yet-selected rows keep their capsules; a badge-less row
    // (bare) renders no badge node at all.
    expect(
      rows().map((r) => r.querySelector(".hk-affix-row-badge")?.textContent),
    ).toEqual(["#1", undefined]);
  });

  it("options without a badge render no badge nodes", async () => {
    // MULTI + tag layout on purpose (R2: single mode and the rows layout
    // never render tags, so a `.hk-affix-tag-badge` assertion there is
    // vacuous): both surfaces — remaining rows AND selected tags — must
    // stay badge-free for a badge-less option.
    const { container } = mountPicker({
      options: BADGED,
      mode: "multi",
      layout: "tags",
      selected: ["bare"],
    });
    await openPopup(container);
    const t = tag("bare provider");
    expect(t, "selected tag renders").toBeTruthy();
    expect(t!.querySelector(".hk-affix-tag-badge")).toBeNull();
    // The remaining rows are the two BADGED options — theirs render.
    expect(
      rows().map((r) => r.querySelector(".hk-affix-row-badge")?.textContent),
    ).toEqual(["#1", "#2"]);
  });
});
