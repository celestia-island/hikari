// AI-generated: developed with the ZCode agent (model GLM-5.3); human-directed.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, h, nextTick } from "vue";

import { HkSolarLocationSetting } from "./HkSolarLocationSetting";
import { setLocale } from "../i18n/context";
import {
  SOLAR_LOCATION_STRATEGY_STORAGE_KEY,
  SOLAR_MANUAL_LOCATION_STORAGE_KEY,
  listTimeZones,
  manualLocationOf,
  setSolarLocationStrategy,
  setSolarManualLocation,
  solarLocationStrategy,
  solarManualLocation,
  systemTimeZoneId,
  type SolarLocationStrategy,
} from "../theme/useSolarTime";

/**
 * HkSolarLocationSetting — the solar clock's location-strategy row.
 * The strategy engine (theme/useSolarTime.ts) has its own suite; these
 * cases pin the COMPONENT contract: the live summary row, the secondary
 * HkModal editor (strategy tabs / IANA zone select / explicit
 * hemisphere), OK applying through setSolarManualLocation →
 * setSolarLocationStrategy → refreshThemeClock with storage evidence,
 * and cancel leaving the engine untouched.
 */

const mounts: Array<{ app: ReturnType<typeof createApp>; container: HTMLElement }> = [];
const appliedEvents: SolarLocationStrategy[] = [];

const ORIGINAL_WIDTH = window.innerWidth;

function setViewportWidth(px: number): void {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    writable: true,
    value: px,
  });
}

function resetEngineState(): void {
  // Back to the offline default; manual config cleared. The setters are
  // the engine's own reset surface (they heal refs AND storage).
  setSolarLocationStrategy("timezone");
  setSolarManualLocation(null);
}

function mountSetting(): HTMLElement {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const app = createApp({
    render: () =>
      h(HkSolarLocationSetting, {
        onApplied: (strategy: SolarLocationStrategy) => {
          appliedEvents.push(strategy);
        },
      }),
  });
  app.mount(container);
  mounts.push({ app, container });
  return container;
}

async function settle(): Promise<void> {
  await nextTick();
  // Surface transitions (modal enter/leave, tab swaps) resolve through
  // short macrotask windows in happy-dom.
  await new Promise((resolve) => setTimeout(resolve, 20));
  await nextTick();
}

function rowSummary(container: HTMLElement): HTMLElement {
  const el = container.querySelector<HTMLElement>(".hk-solar-summary");
  expect(el, "summary row renders").toBeTruthy();
  return el!;
}

function editButton(container: HTMLElement): HTMLButtonElement {
  const btn = container.querySelector<HTMLButtonElement>(".hk-solar-edit");
  expect(btn, "edit button renders").toBeTruthy();
  return btn!;
}

/** The modal chrome teleports to document.body (HkModal Teleport). */
function modalHeader(): HTMLElement | null {
  return document.body.querySelector<HTMLElement>(".hk-modal-header");
}

function strategyTriggers(): HTMLButtonElement[] {
  // The strategy strip is the DIRECT child group of the editor body —
  // scoped so the hemisphere strip never pollutes the query.
  return [
    ...document.body.querySelectorAll<HTMLButtonElement>(
      ".hk-solar-editor > .hk-tabs .hk-tabs-trigger",
    ),
  ];
}

function hemisphereTriggers(): HTMLButtonElement[] {
  return [
    ...document.body.querySelectorAll<HTMLButtonElement>(
      ".hk-solar-hemisphere .hk-tabs-trigger",
    ),
  ];
}

function activeStrategyOf(triggers: HTMLButtonElement[]): string | undefined {
  return triggers.find((b) => b.hasAttribute("data-active"))?.textContent ?? undefined;
}

function footerButton(label: string): HTMLButtonElement {
  const btn = [...document.body.querySelectorAll<HTMLButtonElement>(".hk-modal-footer button")]
    .find((b) => b.textContent?.trim() === label);
  expect(btn, `footer button "${label}" renders`).toBeTruthy();
  return btn!;
}

function clickStrategyTab(label: string): void {
  const trigger = strategyTriggers().find((b) => b.textContent?.trim() === label);
  expect(trigger, `strategy tab "${label}" renders`).toBeTruthy();
  trigger!.click();
}

function clickStrategy(key: "timezone" | "ip" | "manual"): void {
  clickStrategyTab({ timezone: "Time zone", ip: "IP location", manual: "Manual" }[key]);
}

/** Opens the manual pane's IANA zone select and picks a zone. */
async function pickTimeZone(zone: string): Promise<void> {
  const trigger = document.body.querySelector<HTMLButtonElement>(".hk-select-trigger");
  expect(trigger, "zone select trigger renders").toBeTruthy();
  trigger!.click();
  await settle();
  const option = [...document.body.querySelectorAll<HTMLElement>(".hk-select-option")]
    .find((el) => el.textContent?.trim() === zone);
  expect(option, `zone option "${zone}" renders`).toBeTruthy();
  option!.click();
  await settle();
}

async function openEditor(container: HTMLElement): Promise<void> {
  editButton(container).click();
  await settle();
  expect(modalHeader(), "modal opened with a header").toBeTruthy();
}

beforeEach(() => {
  // Hermetic geo: apply flows through refreshThemeClock, whose IP leg
  // must never reach the network in tests.
  vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ ok: false })));
  // Desktop geometry: the zone select opens as an anchored popout.
  setViewportWidth(1280);
  appliedEvents.length = 0;
  resetEngineState();
});

afterEach(async () => {
  for (const { app, container } of mounts.splice(0)) {
    app.unmount();
    container.remove();
  }
  setViewportWidth(ORIGINAL_WIDTH);
  vi.unstubAllGlobals();
  localStorage.clear();
  await setLocale("en");
});

describe("HkSolarLocationSetting row", () => {
  it("renders the live summary with the strategy icon and the edit button", async () => {
    const container = mountSetting();
    await settle();

    const summary = rowSummary(container);
    expect(summary.getAttribute("data-strategy")).toBe("timezone");
    // Offline default: the summary names the strategy AND the live
    // system zone id (systemTimeZoneId), so the row is self-explaining.
    expect(summary.textContent).toContain("Time zone");
    expect(summary.textContent).toContain(systemTimeZoneId());
    expect(summary.querySelector("svg"), "strategy glyph renders").toBeTruthy();

    const btn = editButton(container);
    expect(btn.textContent?.trim()).toBe("Edit");
    // No editor in the DOM before the first open.
    expect(document.body.querySelector(".hk-solar-editor")).toBeNull();
  });

  it("reflects the manual strategy in the row once applied", async () => {
    setSolarManualLocation({ timeZone: "Australia/Sydney", hemisphere: "south" });
    setSolarLocationStrategy("manual");
    const container = mountSetting();
    await settle();

    const summary = rowSummary(container);
    expect(summary.getAttribute("data-strategy")).toBe("manual");
    expect(summary.textContent).toContain("Australia/Sydney");
    expect(summary.textContent).toContain("Southern");
  });
});

describe("HkSolarLocationSetting editor", () => {
  it("opens the secondary modal with the three strategy tabs and the offline-first hint", async () => {
    const container = mountSetting();
    await openEditor(container);

    expect(modalHeader()!.textContent).toContain("Sun clock location");
    const triggers = strategyTriggers();
    expect(triggers).toHaveLength(3);
    expect(triggers.map((b) => b.textContent?.trim())).toEqual([
      "Time zone",
      "IP location",
      "Manual",
    ]);
    expect(activeStrategyOf(triggers)).toBe("Time zone");
    // Every tab carries its lucide glyph (Clock / Globe2 / MapPin).
    for (const trigger of triggers) {
      expect(trigger.querySelector("svg")).toBeTruthy();
    }

    const editor = document.body.querySelector<HTMLElement>(".hk-solar-editor");
    expect(editor!.textContent).toContain("No network request, no permission prompt");
    // Manual controls stay hidden while the draft is not manual.
    expect(document.body.querySelector(".hk-solar-manual")).toBeNull();
  });

  it("switching strategies swaps the hint and reveals the manual pane", async () => {
    const container = mountSetting();
    await openEditor(container);

    clickStrategy("ip");
    await settle();
    expect(document.body.querySelector<HTMLElement>(".hk-solar-editor")!.getAttribute("data-strategy")).toBe("ip");
    expect(document.body.querySelector<HTMLElement>(".hk-solar-editor")!.textContent)
      .toContain("IP lookup");

    clickStrategy("manual");
    await settle();
    const editor = document.body.querySelector<HTMLElement>(".hk-solar-editor")!;
    expect(editor.getAttribute("data-strategy")).toBe("manual");
    expect(document.body.querySelector(".hk-solar-manual")).toBeTruthy();
    expect(document.body.querySelector<HTMLButtonElement>(".hk-select-trigger")).toBeTruthy();
    const hemi = hemisphereTriggers();
    expect(hemi.map((b) => b.textContent?.trim())).toEqual(["Northern", "Southern"]);
    // Draft default: the system zone, northern hemisphere (explicit
    // pick — never inferred).
    expect(activeStrategyOf(hemi)).toBe("Northern");
  });

  it("keeps the hemisphere explicit when the zone changes; the resolved readout follows the engine", async () => {
    const container = mountSetting();
    await openEditor(container);
    clickStrategy("manual");
    await settle();

    await pickTimeZone("Australia/Sydney");
    // The zone moved to the southern hemisphere's side of the globe,
    // but the hemisphere knob is the USER's pick — it must NOT move.
    expect(activeStrategyOf(hemisphereTriggers())).toBe("Northern");

    hemisphereTriggers()[1].click();
    await settle();
    expect(activeStrategyOf(hemisphereTriggers())).toBe("Southern");

    const resolved = document.body.querySelector<HTMLElement>('[data-test="hk-solar-resolved"]');
    expect(resolved, "resolved-coordinates readout renders").toBeTruthy();
    const geo = manualLocationOf({ timeZone: "Australia/Sydney", hemisphere: "south" });
    expect(resolved!.textContent).toContain(geo.lat.toFixed(1));
    expect(resolved!.textContent).toContain(geo.lng.toFixed(1));
  });

  it("OK applies the manual draft: engine refs, storage, inline summary, applied emit", async () => {
    const container = mountSetting();
    await openEditor(container);
    clickStrategy("manual");
    await settle();
    await pickTimeZone("Australia/Sydney");
    hemisphereTriggers()[1].click();
    await settle();

    footerButton("Apply").click();
    await settle();

    // Engine state moved.
    expect(solarLocationStrategy.value).toBe("manual");
    expect(solarManualLocation.value).toEqual({
      timeZone: "Australia/Sydney",
      hemisphere: "south",
    });
    // Persistence evidence — the exact keys the engine owns.
    expect(localStorage.getItem(SOLAR_LOCATION_STRATEGY_STORAGE_KEY)).toBe("manual");
    expect(JSON.parse(localStorage.getItem(SOLAR_MANUAL_LOCATION_STORAGE_KEY) ?? "null")).toEqual({
      timeZone: "Australia/Sydney",
      hemisphere: "south",
    });
    // The row summary reflects the new strategy IMMEDIATELY.
    const summary = rowSummary(container);
    expect(summary.getAttribute("data-strategy")).toBe("manual");
    expect(summary.textContent).toContain("Australia/Sydney");
    expect(summary.textContent).toContain("Southern");
    // The host was notified.
    expect(appliedEvents).toEqual(["manual"]);
  });

  it("OK applies the timezone strategy with no manual payload written", async () => {
    const container = mountSetting();
    await openEditor(container);
    clickStrategy("timezone");
    await settle();
    footerButton("Apply").click();
    await settle();

    expect(solarLocationStrategy.value).toBe("timezone");
    expect(localStorage.getItem(SOLAR_LOCATION_STRATEGY_STORAGE_KEY)).toBe("timezone");
    expect(localStorage.getItem(SOLAR_MANUAL_LOCATION_STORAGE_KEY)).toBeNull();
    expect(appliedEvents).toEqual(["timezone"]);
  });

  it("cancel discards the draft and leaves the engine untouched", async () => {
    const container = mountSetting();
    await openEditor(container);
    clickStrategy("ip");
    await settle();
    footerButton("Cancel").click();
    await settle();

    expect(solarLocationStrategy.value).toBe("timezone");
    expect(localStorage.getItem(SOLAR_LOCATION_STRATEGY_STORAGE_KEY)).not.toContain("ip");
    expect(appliedEvents).toEqual([]);
    expect(rowSummary(container).getAttribute("data-strategy")).toBe("timezone");
  });
});

describe("HkSolarLocationSetting i18n", () => {
  it("flows zh-Hans messages through the row and the editor", async () => {
    await setLocale("zh-Hans");
    const container = mountSetting();
    await settle();

    const summary = rowSummary(container);
    expect(summary.textContent).toContain("时区");
    expect(editButton(container).textContent?.trim()).toBe("编辑");

    await openEditor(container);
    expect(modalHeader()!.textContent).toContain("太阳钟定位");
    expect(strategyTriggers().map((b) => b.textContent?.trim())).toEqual([
      "时区",
      "IP 定位",
      "手动",
    ]);

    clickStrategyTab("手动");
    await settle();
    expect(hemisphereTriggers().map((b) => b.textContent?.trim())).toEqual([
      "北半球",
      "南半球",
    ]);
  });

  it("seeds the zone list from the engine's listTimeZones catalog", async () => {
    const container = mountSetting();
    await openEditor(container);
    clickStrategy("manual");
    await settle();

    const trigger = document.body.querySelector<HTMLButtonElement>(".hk-select-trigger");
    trigger!.click();
    await settle();

    const rendered = [...document.body.querySelectorAll<HTMLElement>(".hk-select-option")]
      .map((el) => el.textContent?.trim());
    const catalog = listTimeZones();
    expect(rendered.length).toBe(catalog.length);
    expect(rendered).toContain("Asia/Shanghai");
    // A catalog-present zone on every ICU: "UTC" itself is NOT part of
    // Intl.supportedValuesOf("timeZone") on some ICU builds.
    expect(rendered).toContain("Australia/Sydney");
  });
});
