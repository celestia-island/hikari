// AI-generated: developed with the DeepSeek Harness agent (model DeepSeek V4.1 Flash); human-directed.
import { afterEach, describe, expect, it } from "vitest";
import { createApp, h, nextTick } from "vue";

import HkDateTagDefault, { HkDateTag } from "./HkDateTag";
import { setLocale } from "../i18n/context";

/**
 * HkDateTag — the locale-aware date capsule. These cases pin the
 * COMPONENT contract: the row order follows the ACTIVE hikari locale
 * (year on top for zh-Hans, year LAST for en), the order re-derives
 * live when the host flips the locale, `time` appends the muted
 * fourth row, and unparseable input renders the empty capsule shell.
 */

const mounts: Array<{ app: ReturnType<typeof createApp>; container: HTMLElement }> = [];

// Built in LOCAL time so the calendar fields (2024-10-06 14:30) survive
// every CI time zone; the capsule renders local calendar segments.
const SHIP_DATE = new Date(2024, 9, 6, 14, 30);

function mountTag(props: { value: string | number | Date; time?: boolean }): HTMLElement {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const app = createApp({ render: () => h(HkDateTag, props) });
  app.mount(container);
  mounts.push({ app, container });
  return container;
}

function rowsOf(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>(".hk-date-tag__row")];
}

function capsuleOf(container: HTMLElement): HTMLElement {
  const el = container.querySelector<HTMLElement>(".hk-date-tag");
  expect(el, "capsule renders").toBeTruthy();
  return el!;
}

// setLocale mutates the module-global i18n state — restore the default
// after every case (the HkSolarLocationSetting suite's idiom).
afterEach(async () => {
  for (const { app, container } of mounts.splice(0)) {
    app.unmount();
    container.remove();
  }
  await setLocale("en");
});

describe("HkDateTag locale ordering", () => {
  it("renders year/month/day rows top to bottom for zh-Hans", async () => {
    await setLocale("zh-Hans");
    const container = mountTag({ value: SHIP_DATE });

    const capsule = capsuleOf(container);
    expect(capsule.classList.contains("hk-date-tag")).toBe(true);
    const rows = rowsOf(container);
    expect(rows.map((r) => r.textContent)).toEqual(["2024", "10", "06"]);
    // The year row carries its modifier wherever it lands.
    expect(rows[0].classList.contains("hk-date-tag__row--year")).toBe(true);
    expect(rows[1].classList.contains("hk-date-tag__row--year")).toBe(false);
  });

  it("orders month/day/year for en — the year goes LAST", async () => {
    await setLocale("en");
    const container = mountTag({ value: SHIP_DATE });

    const rows = rowsOf(container);
    expect(rows.map((r) => r.textContent)).toEqual(["10", "06", "2024"]);
    expect(rows[2].classList.contains("hk-date-tag__row--year")).toBe(true);
  });

  it("re-orders the rows live when the locale flips under a mounted capsule", async () => {
    await setLocale("zh-Hans");
    const container = mountTag({ value: SHIP_DATE });
    expect(rowsOf(container).map((r) => r.textContent)).toEqual(["2024", "10", "06"]);

    await setLocale("en");
    await nextTick();
    expect(rowsOf(container).map((r) => r.textContent)).toEqual(["10", "06", "2024"]);

    await setLocale("zh-Hans");
    await nextTick();
    expect(rowsOf(container).map((r) => r.textContent)).toEqual(["2024", "10", "06"]);
  });
});

describe("HkDateTag time row", () => {
  it("appends the muted time row only when asked", async () => {
    await setLocale("zh-Hans");
    const withTime = rowsOf(mountTag({ value: SHIP_DATE, time: true }));
    expect(withTime).toHaveLength(4);
    expect(withTime[3].classList.contains("hk-date-tag__row--time")).toBe(true);
    expect(withTime[3].textContent).toBe("14:30");

    const withoutTime = rowsOf(mountTag({ value: SHIP_DATE }));
    expect(withoutTime).toHaveLength(3);
    expect(withoutTime.some((r) => r.classList.contains("hk-date-tag__row--time"))).toBe(false);
  });

  it("formats the time row for the active locale", async () => {
    await setLocale("en");
    const rows = rowsOf(mountTag({ value: SHIP_DATE, time: true }));
    expect(rows).toHaveLength(4);
    expect(rows[3].textContent).toBe("02:30 PM");
  });
});

describe("HkDateTag value normalization", () => {
  it("accepts epoch milliseconds and date strings like the Date form", async () => {
    await setLocale("en");
    const expected = ["10", "06", "2024"];
    expect(rowsOf(mountTag({ value: SHIP_DATE })).map((r) => r.textContent)).toEqual(expected);
    // A number is epoch MILLISECONDS.
    expect(rowsOf(mountTag({ value: SHIP_DATE.getTime() })).map((r) => r.textContent)).toEqual(expected);
    expect(rowsOf(mountTag({ value: "2024-10-06T14:30:00" })).map((r) => r.textContent)).toEqual(expected);
  });

  it("renders the empty capsule shell for unparseable input", async () => {
    await setLocale("zh-Hans");
    const container = mountTag({ value: "not-a-date" });

    const capsule = capsuleOf(container);
    expect(capsule.children).toHaveLength(0);
    expect(rowsOf(container)).toHaveLength(0);
  });
});

describe("HkDateTag module surface", () => {
  it("exports the same component as the default and named binding", () => {
    expect(HkDateTagDefault).toBe(HkDateTag);
    expect((HkDateTag as unknown as { name: string }).name).toBe("HkDateTag");
  });
});
