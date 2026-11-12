// AI-generated: developed with the DeepSeek Harness agent (model DeepSeek V4.1 Flash); human-directed.
/**
 * HkCurrencySelect — behavior, a11y and surface-composition contract.
 *
 * Pinned guarantees:
 *  1. The trigger shows the selected currency's symbol + code + localized
 *     name; an empty model shows the placeholder.
 *  2. Rows are rich (symbol, code, localized name) and searchable by code,
 *     name and symbol (multi-token AND).
 *  3. The opened surface IS HkSelectPanel (desktop popout `.hk-select-popout`
 *     / phone sheet `.hk-select-sheet-panel`) — no second overlay: the source
 *     contract asserts the import and the absence of Teleport in this file.
 *  4. Selection emits `update:modelValue` with the code and returns focus to
 *     the trigger; Escape is consumed only while open.
 *  5. Groups render in declared order and unclaimed currencies land in the
 *     trailing "other" band; empty bands disappear.
 *  6. Keyboard: ArrowUp/Down (trigger + panel), Home/End, Enter selects.
 *  7. a11y: label association, listbox/option roles, aria-expanded,
 *     aria-activedescendant, error wiring.
 */
import { afterEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createApp, h, nextTick } from "vue";

import HkCurrencySelect from "./HkCurrencySelect";
import type { HkCurrency } from "../utils/currency";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, "HkCurrencySelect.tsx"), "utf-8");
const scss = readFileSync(join(here, "HkCurrencySelect.scss"), "utf-8");

const USD: HkCurrency = { code: "USD", symbol: "$", name: "US Dollar", decimals: 2 };
const EUR: HkCurrency = { code: "EUR", symbol: "€", decimals: 2 };
const JPY: HkCurrency = { code: "JPY", symbol: "¥", name: "Japanese Yen", decimals: 0 };
const CURRENCIES = [USD, EUR, JPY];

const originalWidth = window.innerWidth;
const mounts: Array<{ app: ReturnType<typeof createApp>; container: HTMLElement }> = [];

function setViewportWidth(px: number) {
  Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: px });
}

afterEach(() => {
  for (const { app, container } of mounts.splice(0)) app.unmount();
  document.body.innerHTML = "";
  setViewportWidth(originalWidth);
});

interface Harness {
  container: HTMLElement;
  trigger: HTMLButtonElement;
  emitted: string[];
  /** Lets the teleported surface land. */
  settle: () => Promise<void>;
}

function mount(props: Record<string, unknown> = {}): Harness {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const emitted: string[] = [];
  const app = createApp({
    render: () =>
      h(HkCurrencySelect, {
        modelValue: "",
        currencies: CURRENCIES,
        "onUpdate:modelValue": (code: string) => {
          emitted.push(code);
        },
        ...props,
      }),
  });
  app.mount(container);
  mounts.push({ app, container });
  const trigger = container.querySelector<HTMLButtonElement>(".hk-currency-select-trigger");
  expect(trigger, "the trigger renders").not.toBeNull();
  return {
    container,
    trigger: trigger!,
    emitted,
    settle: async () => {
      await nextTick();
      await nextTick();
    },
  };
}

function panelRows(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>(".hk-currency-select-option")];
}

async function openPanel(harness: Harness): Promise<void> {
  harness.trigger.click();
  await harness.settle();
}

async function typeSearch(harness: Harness, text: string): Promise<void> {
  const search = document.querySelector<HTMLInputElement>(".hk-currency-select-search")!;
  expect(search, "the search field renders").not.toBeNull();
  search.value = text;
  search.dispatchEvent(new Event("input"));
  await harness.settle();
}

describe("HkCurrencySelect trigger", () => {
  it("shows the placeholder when nothing is selected", () => {
    setViewportWidth(1280);
    const { container, trigger } = mount({ placeholder: "Pick one" });
    expect(container.querySelector(".hk-currency-select-placeholder")!.textContent).toBe("Pick one");
    expect(trigger.getAttribute("aria-haspopup")).toBe("listbox");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });

  it("falls back to the localized placeholder", () => {
    setViewportWidth(1280);
    const { container } = mount();
    expect(container.querySelector(".hk-currency-select-placeholder")!.textContent).toBe(
      "Select currency",
    );
  });

  it("shows symbol + code + name for the selected currency", () => {
    setViewportWidth(1280);
    const { container } = mount({ modelValue: "JPY" });
    expect(container.querySelector(".hk-currency-select-value .hk-currency-select-symbol")!.textContent).toBe("¥");
    expect(container.querySelector(".hk-currency-select-value .hk-currency-select-code")!.textContent).toBe("JPY");
    expect(container.querySelector(".hk-currency-select-value .hk-currency-select-name")!.textContent).toBe(
      "Japanese Yen",
    );
  });

  it("renders a code the host has not listed (Intl name)", () => {
    setViewportWidth(1280);
    const { container } = mount({ modelValue: "GBP" });
    expect(container.querySelector(".hk-currency-select-code")!.textContent).toBe("GBP");
    expect(container.querySelector(".hk-currency-select-name")!.textContent!.length).toBeGreaterThan(0);
  });

  it("associates the label with the trigger", () => {
    setViewportWidth(1280);
    const { container, trigger } = mount({ label: "Billing currency", required: true });
    const label = container.querySelector("label")!;
    expect(label.getAttribute("for")).toBe(trigger.id);
    expect(container.querySelector(".hk-currency-select-required")).not.toBeNull();
  });

  it("does not open while disabled", async () => {
    setViewportWidth(1280);
    const harness = mount({ disabled: true });
    await openPanel(harness);
    expect(document.querySelector(".hk-select-popout")).toBeNull();
    expect(harness.trigger.disabled).toBe(true);
  });
});

describe("HkCurrencySelect opened surface", () => {
  it("uses HkSelectPanel's desktop popout on wide viewports", async () => {
    setViewportWidth(1280);
    const harness = mount();
    await openPanel(harness);
    expect(document.querySelector(".hk-select-popout")).not.toBeNull();
    expect(document.querySelector(".hk-select-sheet-panel")).toBeNull();
    expect(document.querySelector(".hk-currency-select-list")!.getAttribute("role")).toBe("listbox");
    expect(panelRows().length).toBe(3);
  });

  it("docks as HkSelectPanel's bottom sheet on phone widths", async () => {
    setViewportWidth(375);
    const harness = mount();
    await openPanel(harness);
    expect(document.querySelector(".hk-select-sheet-panel")).not.toBeNull();
    expect(document.querySelector(".hk-select-popout")).toBeNull();
    expect(panelRows().length).toBe(3);
  });

  it("renders rich rows: symbol, code and localized name", async () => {
    setViewportWidth(1280);
    const harness = mount();
    await openPanel(harness);
    const rows = panelRows();
    expect(rows[0].querySelector(".hk-currency-select-symbol")!.textContent).toBe("$");
    expect(rows[0].querySelector(".hk-currency-select-code")!.textContent).toBe("USD");
    expect(rows[0].querySelector(".hk-currency-select-name")!.textContent).toBe("US Dollar");
    // EUR carries no `name`: the Intl display name fills in.
    expect(rows[1].querySelector(".hk-currency-select-name")!.textContent).toBe("Euro");
    expect(rows[1].getAttribute("role")).toBe("option");
  });

  it("marks the selected row and emits a new code on click", async () => {
    setViewportWidth(1280);
    const harness = mount({ modelValue: "USD" });
    await openPanel(harness);
    const rows = panelRows();
    expect(rows[0].getAttribute("aria-selected")).toBe("true");
    expect(rows[0].querySelector(".hk-currency-select-check")).not.toBeNull();
    expect(rows[1].getAttribute("aria-selected")).toBe("false");

    rows[1].click();
    await harness.settle();
    expect(harness.emitted).toEqual(["EUR"]);
    expect(harness.trigger.getAttribute("aria-expanded")).toBe("false");
    // Focus hands back to the trigger the surface hung off.
    expect(document.activeElement).toBe(harness.trigger);
  });

  it("re-selecting the current code closes without a redundant emit", async () => {
    setViewportWidth(1280);
    const harness = mount({ modelValue: "USD" });
    await openPanel(harness);
    panelRows()[0].click();
    await harness.settle();
    expect(harness.emitted).toEqual([]);
    expect(harness.trigger.getAttribute("aria-expanded")).toBe("false");
  });
});

describe("HkCurrencySelect search", () => {
  it("filters by code, name and symbol", async () => {
    setViewportWidth(1280);
    const harness = mount();
    await openPanel(harness);

    await typeSearch(harness, "jpy");
    expect(panelRows().map((row) => row.getAttribute("id"))).toHaveLength(1);
    expect(panelRows()[0].querySelector(".hk-currency-select-code")!.textContent).toBe("JPY");

    await typeSearch(harness, "euro");
    expect(panelRows()).toHaveLength(1);
    expect(panelRows()[0].querySelector(".hk-currency-select-code")!.textContent).toBe("EUR");

    await typeSearch(harness, "$");
    expect(panelRows()).toHaveLength(1);
    expect(panelRows()[0].querySelector(".hk-currency-select-code")!.textContent).toBe("USD");
  });

  it("shows the empty state when nothing matches", async () => {
    setViewportWidth(1280);
    const harness = mount();
    await openPanel(harness);
    await typeSearch(harness, "zzzz");
    expect(panelRows()).toHaveLength(0);
    expect(document.querySelector(".hk-currency-select-empty")!.textContent).toBe(
      "No currencies found",
    );
  });

  it("hides the search field when searchable is off", async () => {
    setViewportWidth(1280);
    const harness = mount({ searchable: false });
    await openPanel(harness);
    expect(document.querySelector(".hk-currency-select-search")).toBeNull();
    expect(panelRows()).toHaveLength(3);
  });
});

describe("HkCurrencySelect keyboard", () => {
  it("opens on ArrowDown with the first row active and selects on Enter", async () => {
    setViewportWidth(1280);
    const harness = mount();
    harness.trigger.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true }),
    );
    await harness.settle();

    const list = document.querySelector<HTMLElement>(".hk-currency-select-list")!;
    expect(harness.trigger.getAttribute("aria-expanded")).toBe("true");
    expect(list.getAttribute("aria-activedescendant")).toBe(panelRows()[0].id);

    panelRows()[0].dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true }),
    );
    await harness.settle();
    expect(list.getAttribute("aria-activedescendant")).toBe(panelRows()[1].id);

    panelRows()[1].dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }),
    );
    await harness.settle();
    expect(harness.emitted).toEqual(["EUR"]);
  });

  it("supports Home and End and wraps the arrows", async () => {
    setViewportWidth(1280);
    const harness = mount();
    await openPanel(harness);
    const list = document.querySelector<HTMLElement>(".hk-currency-select-list")!;
    const press = async (key: string) => {
      panelRows()[0].dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
      await harness.settle();
    };

    await press("End");
    expect(list.getAttribute("aria-activedescendant")).toBe(panelRows()[2].id);
    await press("ArrowDown");
    expect(list.getAttribute("aria-activedescendant"), "the ring wraps").toBe(panelRows()[0].id);
    await press("Home");
    expect(list.getAttribute("aria-activedescendant")).toBe(panelRows()[0].id);
  });

  it("closes on Escape and consumes the key only while open", async () => {
    setViewportWidth(1280);
    const harness = mount();

    // Nothing open: the key is left completely alone (a hosting dialog's
    // own Escape semantics must survive), so the event is not cancelled.
    const idle = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
    harness.trigger.dispatchEvent(idle);
    expect(idle.defaultPrevented, "a closed trigger leaves Escape untouched").toBe(false);

    await openPanel(harness);
    expect(harness.trigger.getAttribute("aria-expanded")).toBe("true");

    // Open: the press closes THIS surface and is consumed, so one press can
    // never also close the dialog the field sits in.
    const closing = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
    harness.trigger.dispatchEvent(closing);
    await harness.settle();
    expect(closing.defaultPrevented, "an open trigger consumes Escape").toBe(true);
    expect(harness.trigger.getAttribute("aria-expanded")).toBe("false");
  });
});

describe("HkCurrencySelect groups", () => {
  it("renders declared bands in order and buckets the rest", async () => {
    setViewportWidth(1280);
    const harness = mount({
      groups: [
        { key: "common", label: "Common", codes: ["usd"] },
        { key: "empty", label: "Empty band" },
      ],
    });
    await openPanel(harness);
    const labels = [...document.querySelectorAll(".hk-currency-select-group-label")].map(
      (node) => node.textContent,
    );
    expect(labels).toEqual(["Common", "Other currencies"]);
    expect(panelRows().map((row) => row.querySelector(".hk-currency-select-code")!.textContent)).toEqual([
      "USD",
      "EUR",
      "JPY",
    ]);
  });

  it("files a currency by its own group field", async () => {
    setViewportWidth(1280);
    const harness = mount({
      currencies: [{ ...USD, group: "asia" } as HkCurrency, EUR],
      groups: [{ key: "asia", label: "Asia" }],
    });
    await openPanel(harness);
    const labels = [...document.querySelectorAll(".hk-currency-select-group-label")].map(
      (node) => node.textContent,
    );
    expect(labels).toEqual(["Asia", "Other currencies"]);
  });

  it("renders one flat list without groups", async () => {
    setViewportWidth(1280);
    const harness = mount();
    await openPanel(harness);
    expect(document.querySelectorAll(".hk-currency-select-group-label")).toHaveLength(0);
    expect(panelRows()).toHaveLength(3);
  });
});

describe("HkCurrencySelect error + a11y wiring", () => {
  it("surfaces the host error through aria-invalid + aria-describedby", () => {
    setViewportWidth(1280);
    const { container, trigger } = mount({ label: "Currency", error: "Pick a currency" });
    const error = container.querySelector(".hk-currency-select-error")!;
    expect(error.textContent).toBe("Pick a currency");
    expect(error.getAttribute("role")).toBe("alert");
    expect(trigger.getAttribute("aria-invalid")).toBe("true");
    expect(trigger.getAttribute("aria-describedby")).toBe(error.id);
  });

  it("keeps aria-expanded in sync with the surface", async () => {
    setViewportWidth(1280);
    const harness = mount();
    expect(harness.trigger.getAttribute("aria-expanded")).toBe("false");
    await openPanel(harness);
    expect(harness.trigger.getAttribute("aria-expanded")).toBe("true");
  });
});

describe("HkCurrencySelect surface composition contract", () => {
  it("delegates the opened surface to HkSelectPanel", () => {
    expect(source).toContain('from "./HkSelectPanel"');
    // No hand-rolled overlay: no Teleport, no overlay-root plumbing here.
    expect(source).not.toMatch(/Teleport/);
    expect(source).not.toMatch(/ensureOverlayRoot/);
    expect(source).not.toMatch(/usePopupManager/);
  });

  it("keeps the teleported row styles top-level (a nested selector would die)", () => {
    expect(scss).toMatch(/^\.hk-currency-select-list/m);
    expect(scss).toMatch(/^\.hk-currency-select-option/m);
    expect(scss).not.toMatch(/^\.hk-currency-select\s+\.hk-currency-select-list/m);
  });
});
