// AI-generated: developed with the ZCode agent (model GLM-5.3); human-directed.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, h, nextTick } from "vue";

import { HkSolarLocationSetting, solarOffsetText, solarTimezoneDetectedRows } from "./HkSolarLocationSetting";
import { setLocale } from "../i18n/context";
import {
  SOLAR_LOCATION_STRATEGY_STORAGE_KEY,
  SOLAR_MANUAL_LOCATION_STORAGE_KEY,
  manualLocationOf,
  probeSolarIpInsight,
  resetSolarIpInsight,
  setSolarLocationStrategy,
  setSolarManualLocation,
  solarLocationStrategy,
  solarManualLocation,
  systemTimeZoneId,
  type SolarLocationStrategy,
} from "../theme/useSolarTime";
import { cityKey, sectorForZone, sectorNameKey, standardOffsetHours } from "../theme/solarTimeZones";
import { useTheme } from "../theme/useTheme";

// The locale dictionaries, loaded the same way the locales-coverage suite
// reads them (import.meta.glob; readFileSync resolves wrong under vitest's
// transform) — the same bundles the component renders, so readout
// expectations stay exact on any runtime zone (CI runners sit in UTC; dev
// machines often sit in Asia/Shanghai).
const localeModules = import.meta.glob<{ default: Record<string, Record<string, string>> }>(
  "../i18n/locales/*/platform.json",
  { eager: true },
);

/** The locale's solar strings. platform.json nests legacy domain
 *  sections ("platform", "auth" — same layout the locales-coverage
 *  suite walks); flatten them so dotted `hikari::…` keys read directly. */
function localeBundle(locale: string): Record<string, string> {
  const entry = Object.entries(localeModules).find(([path]) => path.includes(`/${locale}/`));
  expect(entry, `bundle for ${locale} loads`).toBeTruthy();
  return Object.assign({}, ...Object.values(entry![1].default));
}

/**
 * HkSolarLocationSetting — the solar clock's location-strategy card.
 * The strategy engine (theme/useSolarTime.ts) has its own suite; these
 * cases pin the COMPONENT contract: the standard card with the live
 * strategy summary, the secondary HkModal editor (strategy tabs /
 * detected-value readout / time-zone globe / explicit hemisphere), OK
 * applying through setSolarManualLocation → setSolarLocationStrategy →
 * refreshThemeClock with storage evidence, and cancel leaving the
 * engine untouched.
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
  resetSolarIpInsight();
  // The card's Edit gate reads the singleton theme mode; every case starts
  // in AUTO ("system") so the action is enabled by default.
  useTheme().setMode("system");
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

/** The editor's detected-value readout (timezone / ip panes). */
function detectedSection(): HTMLElement {
  const el = document.body.querySelector<HTMLElement>('[data-test="hk-solar-detected"]');
  expect(el, "detected-value readout renders").toBeTruthy();
  return el!;
}

/** Label → value rows of the readout, keyed by their label text. */
function detectedRows(): Map<string, string> {
  const rows = new Map<string, string>();
  for (const row of detectedSection().querySelectorAll<HTMLElement>(".hk-solar-detected-row")) {
    const label = row.querySelector<HTMLElement>(".hk-solar-detected-label")?.textContent?.trim();
    rows.set(label ?? "", row.querySelector<HTMLElement>(".hk-solar-detected-value")?.textContent ?? "");
  }
  return rows;
}

/** Poll budget for the manual pane's defineAsyncComponent globe chunk.
 *  Full-suite runs queue the chunk's transform behind hundreds of other
 *  files, so the wait must tolerate a starved importer (≈ 120 settled
 *  ticks ≈ 3s), not just a warm isolated run. */
const GLOBE_POLL_BUDGET = 120;

/** Picks a zone on the manual pane's globe (the fallback sector list in
 * the test DOM — happy-dom has no WebGL). */
async function pickTimeZone(zone: string): Promise<void> {
  // The picker is a defineAsyncComponent chunk — wait it in.
  let option: HTMLButtonElement | undefined;
  for (let i = 0; i < GLOBE_POLL_BUDGET && !option; i++) {
    option = document.body.querySelector<HTMLButtonElement>(
      '[data-test="hk-timezone-globe-option"][data-zone="' + zone + '"]',
    ) ?? undefined;
    if (!option) await settle();
  }
  expect(option, `globe sector for "${zone}" renders`).toBeTruthy();
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

describe("HkSolarLocationSetting card", () => {
  it("renders the standardized summary with the strategy icon and the edit button", async () => {
    const container = mountSetting();
    await settle();

    const summary = rowSummary(container);
    expect(summary.getAttribute("data-strategy")).toBe("timezone");
    // Offline default: the summary names the POLICY in a fixed shape —
    // no zone id in the summary (that lives in the editor's readout).
    expect(summary.textContent).toContain("Auto · By time zone");
    expect(summary.textContent).not.toContain(systemTimeZoneId());
    expect(summary.querySelector("svg"), "strategy glyph renders").toBeTruthy();

    // The Edit affordance is an ICON-ONLY HkIconButton (ghost/28) — the
    // square matches the row's 28px cross size; the accessible name and
    // the tooltip carry the action (the wrapper owns the title because a
    // disabled button loses pointer events).
    const btn = editButton(container);
    expect(btn.classList.contains("hk-icon-button")).toBe(true);
    expect(btn.classList.contains("hk-icon-button-28")).toBe(true);
    expect(btn.classList.contains("hk-icon-button-ghost")).toBe(true);
    expect(btn.querySelector(".hk-icon-button-icon svg"), "pencil glyph renders").toBeTruthy();
    expect(btn.textContent?.trim(), "no text label in the icon button").toBe("");
    expect(btn.getAttribute("aria-label")).toBe("Edit");
    expect(btn.disabled, "auto mode enables the editor").toBe(false);
    expect(btn.closest(".hk-solar-edit-wrap")?.getAttribute("title")).toBe("Edit");
    // No editor in the DOM before the first open.
    expect(document.body.querySelector(".hk-solar-editor")).toBeNull();
  });

  it("grays the edit action outside auto mode and re-enables it in auto", async () => {
    const { setMode } = useTheme();
    setMode("light");
    const container = mountSetting();
    await settle();

    const btn = editButton(container);
    expect(btn.disabled, "manual modes disable the solar editor").toBe(true);
    expect(btn.getAttribute("aria-label")).toBe("Edit");
    expect(btn.closest(".hk-solar-edit-wrap")?.getAttribute("title")).toBe(
      "Switch to Auto mode to change the daylight location",
    );

    // A disabled native button cannot open the editor.
    btn.click();
    await settle();
    expect(modalHeader(), "disabled edit never opens the modal").toBeNull();

    // Back to auto: the SAME mounted card re-enables on the live mode ref.
    setMode("system");
    await settle();
    expect(editButton(container).disabled).toBe(false);
    expect(editButton(container).closest(".hk-solar-edit-wrap")?.getAttribute("title")).toBe(
      "Edit",
    );

    // Dark is just another manual side of the same gate.
    setMode("dark");
    await settle();
    expect(editButton(container).disabled).toBe(true);
  });

  it("is a standard hikari card: localized default title, overridable, hideable", async () => {
    const container = mountSetting();
    await settle();

    const card = container.querySelector<HTMLElement>(".hk-card.hk-solar-setting");
    expect(card, "the row renders as an HkCard").toBeTruthy();
    const title = card!.querySelector<HTMLElement>(".hk-card-title");
    expect(title?.textContent?.trim()).toBe("Daylight location");

    // An explicit title replaces the default; an empty string hides the
    // header (hosts that label their own section around the card).
    for (const [titleProp, expectedHeader] of [
      ["Custom title", "Custom title"],
      ["", null],
    ] as const) {
      const host = document.createElement("div");
      document.body.appendChild(host);
      const app = createApp({
        render: () => h(HkSolarLocationSetting, { title: titleProp }),
      });
      app.mount(host);
      mounts.push({ app, container: host });
      await settle();
      const header = host.querySelector(".hk-card-header");
      if (expectedHeader === null) {
        expect(header, "empty title hides the header").toBeNull();
      } else {
        expect(header?.textContent?.trim()).toBe(expectedHeader);
      }
    }
  });

  it("reflects the manual strategy in the row once applied", async () => {
    setSolarManualLocation({ timeZone: "Australia/Sydney", hemisphere: "south" });
    setSolarLocationStrategy("manual");
    const container = mountSetting();
    await settle();

    const summary = rowSummary(container);
    expect(summary.getAttribute("data-strategy")).toBe("manual");
    expect(summary.textContent).toContain("Manual · Australia/Sydney · Southern");
  });

  it("never probes on mount or on the timezone pane — the offline-first contract", async () => {
    // The strategy card's own promise: a fresh environment must not
    // issue a network request (nor touch permissions) until the user
    // deliberately enters the IP pane (or applies the ip strategy).
    const fetchMock = vi.mocked(globalThis.fetch);
    const container = mountSetting();
    await settle();
    expect(fetchMock, "mounting the card stays offline").not.toHaveBeenCalled();

    await openEditor(container);
    await settle();
    expect(fetchMock, "opening the editor on the timezone pane stays offline").not.toHaveBeenCalled();

    // Switching away and back (timezone ⇄ manual) never probes either.
    clickStrategy("manual");
    await settle();
    clickStrategy("timezone");
    await settle();
    expect(fetchMock, "timezone ⇄ manual switches stay offline").not.toHaveBeenCalled();
  });
});

describe("solarTimezoneDetectedRows + solarOffsetText (pure builders)", () => {
  const en = localeBundle("en");
  const translate = (key: string): string => en[key] ?? key;

  function rowOf(rows: ReturnType<typeof solarTimezoneDetectedRows>, label: string): string | undefined {
    return rows.find((row) => row.label === label)?.badges[0]?.text;
  }

  it("bands + example cities only for zones whose offset IS a wheel sector", () => {
    const rows = solarTimezoneDetectedRows("Asia/Shanghai", translate);
    expect(rowOf(rows, "Time zone ID")).toBe("Asia/Shanghai");
    expect(rowOf(rows, "Time zone")).toBe(en["hikari::theme.solar.sector.p8"]);
    expect(rowOf(rows, "Example cities")).toContain(en["hikari::theme.solar.city.shanghai"]);
  });

  it("falls back to the exact offset outside the wheel — never a mislabeled band", () => {
    // Half-hour zone: no whole-hour band.
    const kolkata = solarTimezoneDetectedRows("Asia/Kolkata", translate);
    expect(rowOf(kolkata, "UTC offset")).toBe("UTC+05:30");
    // Whole-hour zones OUTSIDE the −11…+12 wheel: +13 (Samoa/Tonga/Line
    // Islands) and POSIX-inverted Etc/GMT+12 (standard −12) must not
    // borrow the nearest sector's band or cities.
    for (const zone of ["Pacific/Apia", "Pacific/Kiritimati", "Etc/GMT+12"]) {
      const rows = solarTimezoneDetectedRows(zone, translate);
      expect(rows.find((row) => row.label === "Time zone"), zone).toBeUndefined();
      expect(rows.find((row) => row.label === "Example cities"), zone).toBeUndefined();
      expect(rowOf(rows, "UTC offset"), zone).toMatch(/^UTC[+-]\d{2}:\d{2}$/);
    }
    expect(rowOf(solarTimezoneDetectedRows("Pacific/Apia", translate), "UTC offset")).toBe("UTC+13:00");
    expect(rowOf(solarTimezoneDetectedRows("Etc/GMT+12", translate), "UTC offset")).toBe("UTC-12:00");
    expect(rowOf(solarTimezoneDetectedRows("Pacific/Kiritimati", translate), "UTC offset")).toBe("UTC+14:00");
  });

  it("offsetText pins the exact sign and fraction formatting", () => {
    expect(solarOffsetText(0)).toBe("UTC");
    expect(solarOffsetText(8)).toBe("UTC+08:00");
    expect(solarOffsetText(5.5)).toBe("UTC+05:30");
    expect(solarOffsetText(5.75)).toBe("UTC+05:45");
    expect(solarOffsetText(12.75)).toBe("UTC+12:45");
    expect(solarOffsetText(-3.5)).toBe("UTC-03:30");
    expect(solarOffsetText(-12)).toBe("UTC-12:00");
  });
});

describe("HkSolarLocationSetting editor", () => {
  it("opens the secondary modal with the three strategy tabs, the principle hint, and the detected readout", async () => {
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
    expect(editor!.textContent).toContain("no network request and no permission prompt");
    // Manual controls stay hidden while the draft is not manual.
    expect(document.body.querySelector(".hk-solar-manual")).toBeNull();

    // The detected-value readout: one info item per line, each value a
    // copyable badge — the device zone id, then the translated band and
    // example cities (whole-hour zones) or the exact UTC offset
    // (half-hour zones, which have no whole-hour band).
    const zone = systemTimeZoneId();
    const sector = sectorForZone(zone);
    const en = localeBundle("en");
    const rows = detectedRows();
    expect(rows.get("Time zone ID")).toContain(zone);
    if (sector && sector.offset === standardOffsetHours(zone)) {
      expect(rows.get("Time zone")).toContain(en[sectorNameKey(sector.offset)]!);
      expect(rows.get("Example cities")).toContain(en[cityKey(sector.cities[0]!)]!);
    } else {
      expect(rows.get("UTC offset")).toMatch(/UTC[+-]\d{2}:\d{2}/);
      expect(rows.has("Example cities")).toBe(false);
    }
    for (const badge of detectedSection().querySelectorAll<HTMLElement>(".hk-badge.hk-copy-badge")) {
      expect(badge.getAttribute("role"), "values are copyable tag buttons").toBe("button");
    }
    expect(detectedSection().querySelector(".hk-solar-detected-status")).toBeNull();
  });

  it("the ip pane probes on entry, shows a retry affordance on failure, and lists the insight", async () => {
    const container = mountSetting();
    await openEditor(container);
    clickStrategy("ip");
    await settle();

    // The suite's fetch stub answers { ok: false } — the probe fails.
    await vi.waitFor(() => {
      expect(detectedSection().querySelector('[data-state="failed"]')).toBeTruthy();
    });
    const retry = detectedSection().querySelector<HTMLButtonElement>(".hk-solar-detected-retry");
    expect(retry, "the failed probe offers a retry").toBeTruthy();
    expect(retry!.textContent?.trim()).toBe("Retry");

    // A successful re-probe fills the readout: one valid info item per
    // line, all copyable.
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({
        ip: "203.0.113.7",
        asn: "AS4134",
        org: "Chinanet",
        country_name: "China",
        region: "Shanghai",
        city: "Shanghai",
        timezone: "Asia/Shanghai",
      }),
    })));
    retry!.click();
    await settle();
    await vi.waitFor(() => {
      expect(detectedSection().querySelector('[data-state="failed"]')).toBeNull();
    });
    const rows = detectedRows();
    expect(rows.get("IP address")).toContain("203.0.113.7");
    expect(rows.get("Autonomous system")).toContain("AS4134");
    expect(rows.get("Organization")).toContain("Chinanet");
    expect(rows.get("Network region")).toContain("China · Shanghai · Shanghai");
    expect(rows.get("IP time zone")).toContain("Asia/Shanghai");
    // Long prose values render as soft-wrapping chips (not pills).
    const regionBadge = [...detectedSection().querySelectorAll<HTMLElement>(".hk-badge")]
      .find((badge) => badge.textContent?.includes("China · Shanghai"));
    expect(regionBadge?.getAttribute("data-pill")).toBe("false");

    // A failed REFRESH keeps the last known values on the rows — the
    // status copy must say "refresh failed", not contradict them with
    // the first-probe failure text. (With state=ok the readout shows no
    // status line at all; the forced engine probe is exactly what the
    // retry button would drive.)
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false })));
    await probeSolarIpInsight(true);
    await vi.waitFor(() => {
      expect(detectedSection().querySelector('[data-state="failed"]')).toBeTruthy();
    });
    expect(detectedSection().textContent).toContain("Refresh failed — showing the last known values");
    expect(detectedRows().get("IP address")).toContain("203.0.113.7");
    expect(detectedSection().querySelector(".hk-solar-detected-retry")).toBeTruthy();
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
    // The globe is a defineAsyncComponent chunk — wait it in.
    let globe: HTMLElement | null = null;
    for (let i = 0; i < GLOBE_POLL_BUDGET && !globe; i++) {
      globe = document.body.querySelector<HTMLElement>('[data-test="hk-timezone-globe"]');
      if (!globe) await settle();
    }
    expect(globe, "globe picker renders in the manual pane").toBeTruthy();
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
  it("flows zh-Hans messages through the card and the editor", async () => {
    await setLocale("zh-Hans");
    const container = mountSetting();
    await settle();

    // The card's localized default title and the standardized summary.
    const card = container.querySelector<HTMLElement>(".hk-card.hk-solar-setting");
    expect(card?.querySelector(".hk-card-title")?.textContent?.trim()).toBe("日照位置");
    const summary = rowSummary(container);
    expect(summary.textContent).toContain("自动 · 基于时区");
    // The icon button localizes its accessible name/tooltip, not a text label.
    expect(editButton(container).getAttribute("aria-label")).toBe("编辑");
    expect(editButton(container).closest(".hk-solar-edit-wrap")?.getAttribute("title")).toBe("编辑");

    await openEditor(container);
    expect(modalHeader()!.textContent).toContain("太阳钟定位");
    expect(strategyTriggers().map((b) => b.textContent?.trim())).toEqual([
      "时区",
      "IP 定位",
      "手动",
    ]);
    // The detected readout in zh-Hans: the translated band and example
    // cities (whole-hour zones) or the exact offset (half-hour zones).
    const zone = systemTimeZoneId();
    const sector = sectorForZone(zone);
    const zh = localeBundle("zh-Hans");
    const rows = detectedRows();
    expect(rows.get("时区 ID")).toContain(zone);
    if (sector && sector.offset === standardOffsetHours(zone)) {
      expect(rows.get("时区")).toContain(zh[sectorNameKey(sector.offset)]!);
      expect(rows.get("代表城市")).toContain(zh[cityKey(sector.cities[0]!)]!);
    } else {
      expect(rows.get("UTC 偏移")).toMatch(/UTC[+-]\d{2}:\d{2}/);
    }

    clickStrategyTab("手动");
    await settle();
    expect(hemisphereTriggers().map((b) => b.textContent?.trim())).toEqual([
      "北半球",
      "南半球",
    ]);
  });

  it("picks from the globe's 24-sector wheel, not the raw IANA catalog", async () => {
    const container = mountSetting();
    await openEditor(container);
    clickStrategy("manual");
    await settle();

    await pickTimeZone("Australia/Sydney");

    const rendered = [...document.body.querySelectorAll<HTMLButtonElement>('[data-test="hk-timezone-globe-option"]')]
      .map((el) => el.dataset.zone);
    // 24 representative zones — NOT the hundreds-of-ids IANA catalog
    // the picker replaced.
    expect(rendered).toHaveLength(24);
    expect(new Set(rendered).size).toBe(24);
    expect(rendered).toContain("Asia/Shanghai");
    expect(rendered).toContain("Australia/Sydney");
    // The draft (and its resolved readout) carries the picked zone id.
    const resolved = document.body.querySelector<HTMLElement>('[data-test="hk-solar-resolved"]');
    const geo = manualLocationOf({ timeZone: "Australia/Sydney", hemisphere: "north" });
    expect(resolved!.textContent).toContain(geo.lng.toFixed(1));
  });
});
