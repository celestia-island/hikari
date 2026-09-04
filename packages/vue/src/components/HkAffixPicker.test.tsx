import { afterEach, describe, expect, it } from "vitest";
import { createApp, h, nextTick } from "vue";

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
  selected?: string | string[];
  activeKey?: string;
  allowCustom?: boolean;
  searchable?: boolean;
  closeOnSelect?: boolean;
  confirmRemove?: boolean;
  disabled?: boolean;
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
        options: OPTIONS,
        mode: opts.mode ?? "single",
        selected: opts.selected ?? "",
        activeKey: opts.activeKey,
        allowCustom: opts.allowCustom ?? false,
        searchable: opts.searchable ?? true,
        closeOnSelect: opts.closeOnSelect,
        confirmRemove: opts.confirmRemove,
        disabled: opts.disabled ?? false,
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
    // the scrolling list (and its overlay-scrollbar host) unmounts.
    await typeQuery("zzz-none");
    expect(document.querySelector(".hk-affix-empty")).toBeTruthy();
    expect(document.querySelector(".hk-affix-scroll")).toBeNull();
    // Clearing the query remounts a FRESH list — the row list must come
    // back and the overlay host must be remounted for the scrollbar.
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

  it("multi mode renders selected tags and offers only the remaining rows", async () => {
    const { container } = mountPicker({ mode: "multi", selected: ["cn", "jp"], activeKey: "cn" });
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

  it("multi mode keeps the popup open when a row is picked", async () => {
    const { events, container } = mountPicker({ mode: "multi", selected: ["cn"] });
    await openPopup(container);
    // With cn selected, the remaining rows are [cn-main, jp, us]; pick jp.
    rows()[1].click();
    await nextTick();
    expect(events.select.at(-1)).toBe("jp");
    expect(rows().length).toBeGreaterThan(0);
  });

  it("tag × opens a confirm dialog: Cancel keeps the tag, Confirm fires remove", async () => {
    const { events, container } = mountPicker({ mode: "multi", selected: ["cn", "jp"] });
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
    console.log("DBG-cancel openEvents", JSON.stringify(events.open), "tags", tags().length, "box", !!document.body.querySelector(".hk-message-box-text"));
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
    const { events, container } = mountPicker({ mode: "multi", selected: ["cn", "jp"] });
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
});
