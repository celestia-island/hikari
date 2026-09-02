import { afterEach, describe, expect, it } from "vitest";
import { createApp, h, nextTick } from "vue";

import HkAffixPicker, { type HkAffixOption } from "./HkAffixPicker";

const OPTIONS: HkAffixOption[] = [
  { key: "cn", label: "China", meta: "+86", flag: "🇨🇳", keywords: "zhongguo 中国 0086" },
  { key: "jp", label: "Japan", meta: "+81", flag: "🇯🇵" },
  { key: "us", label: "United States", meta: "+1", flag: "🇺🇸" },
];

const mounts: Array<{ app: ReturnType<typeof createApp>; container: HTMLElement }> = [];

interface MountOptions {
  mode?: "single" | "multi";
  selected?: string | string[];
  activeKey?: string;
  allowCustom?: boolean;
  searchable?: boolean;
  closeOnSelect?: boolean;
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

afterEach(() => {
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
    expect(rows()).toHaveLength(3);
    expect(rows()[0].hasAttribute("data-active")).toBe(true);
    rows()[1].click();
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
    expect(rows().map((r) => r.textContent)).toEqual([expect.stringContaining("United States")]);
  });

  it("multi mode keeps the popup open when a row is picked", async () => {
    const { events, container } = mountPicker({ mode: "multi", selected: ["cn"] });
    await openPopup(container);
    rows()[0].click();
    await nextTick();
    expect(events.select.at(-1)).toBe("jp");
    expect(rows().length).toBeGreaterThan(0);
  });

  it("two-step tag delete: × arms, × again confirms; body click disarms", async () => {
    const { events, container } = mountPicker({ mode: "multi", selected: ["cn", "jp"] });
    await openPopup(container);
    const x = tags()[0].querySelector<HTMLButtonElement>(".hk-affix-tag-x")!;
    x.click();
    await nextTick();
    expect(tags()[0].hasAttribute("data-armed")).toBe(true);
    expect(events.remove).toHaveLength(0);
    // Second activation confirms — the tag leaves the list.
    x.click();
    await nextTick();
    expect(events.remove).toEqual(["cn"]);
    // Body click on an ARMED tag disarms it instead of picking.
    const jpBody = tag("Japan")!.querySelector<HTMLButtonElement>(".hk-affix-tag-body")!;
    tag("Japan")!.querySelector<HTMLButtonElement>(".hk-affix-tag-x")!.click();
    await nextTick();
    expect(tag("Japan")?.hasAttribute("data-armed")).toBe(true);
    jpBody.click();
    await nextTick();
    expect(tag("Japan")?.hasAttribute("data-armed")).toBe(false);
    expect(events.select).toHaveLength(0);
  });

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
