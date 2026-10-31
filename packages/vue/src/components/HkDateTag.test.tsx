// AI-generated: developed with the DeepSeek Harness agent (model DeepSeek V4.1 Flash); human-directed.
import { afterEach, describe, expect, it } from "vitest";
import { createApp, h, nextTick } from "vue";

import HkDateTagDefault, { HkDateTag } from "./HkDateTag";
import { setLocale } from "../i18n/context";

/**
 * HkDateTag — the locale-aware one-line date pill. These cases pin the
 * COMPONENT contract: the segment order follows the ACTIVE hikari
 * locale (year first for zh-Hans, year LAST for en) with that locale's
 * own separators, the order re-derives live when the host flips the
 * locale, `time` appends the muted trailing segment, and unparseable
 * input renders the empty pill shell.
 */

const mounts: Array<{ app: ReturnType<typeof createApp>; container: HTMLElement }> = [];

// Built in LOCAL time so the calendar fields (2024-10-06 14:30) survive
// every CI time zone; the pill renders local calendar segments.
const SHIP_DATE = new Date(2024, 9, 6, 14, 30);

function mountTag(props: { value: string | number | Date; time?: boolean }): HTMLElement {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const app = createApp({ render: () => h(HkDateTag, props) });
  app.mount(container);
  mounts.push({ app, container });
  return container;
}

function segsOf(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>(".hk-date-tag__seg")];
}

function pillOf(container: HTMLElement): HTMLElement {
  const el = container.querySelector<HTMLElement>(".hk-date-tag");
  expect(el, "pill renders").toBeTruthy();
  return el!;
}

function textOf(container: HTMLElement): string {
  return pillOf(container).textContent ?? "";
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
  it("lays year/month/day segments out on one line for zh-Hans", async () => {
    await setLocale("zh-Hans");
    const container = mountTag({ value: SHIP_DATE });

    const pill = pillOf(container);
    expect(pill.classList.contains("hk-date-tag")).toBe(true);
    // One horizontal run of segments, in the locale's order, joined by
    // the locale's own separators.
    const segs = segsOf(container);
    expect(segs.map((s) => s.textContent)).toEqual(["2024", "10", "06"]);
    expect(textOf(container)).toBe("2024/10/06");
    // The year segment carries its modifier wherever it lands.
    expect(segs[0].classList.contains("hk-date-tag__seg--year")).toBe(true);
    expect(segs[1].classList.contains("hk-date-tag__seg--year")).toBe(false);
  });

  it("orders month/day/year for en — the year goes LAST", async () => {
    await setLocale("en");
    const container = mountTag({ value: SHIP_DATE });

    const segs = segsOf(container);
    expect(segs.map((s) => s.textContent)).toEqual(["10", "06", "2024"]);
    expect(textOf(container)).toBe("10/06/2024");
    expect(segs[2].classList.contains("hk-date-tag__seg--year")).toBe(true);
  });

  it("re-orders the line live when the locale flips under a mounted pill", async () => {
    await setLocale("zh-Hans");
    const container = mountTag({ value: SHIP_DATE });
    expect(segsOf(container).map((s) => s.textContent)).toEqual(["2024", "10", "06"]);

    await setLocale("en");
    await nextTick();
    expect(segsOf(container).map((s) => s.textContent)).toEqual(["10", "06", "2024"]);

    await setLocale("zh-Hans");
    await nextTick();
    expect(segsOf(container).map((s) => s.textContent)).toEqual(["2024", "10", "06"]);
  });
});

describe("HkDateTag time segment", () => {
  it("appends the muted time segment only when asked", async () => {
    await setLocale("zh-Hans");
    const withTimeContainer = mountTag({ value: SHIP_DATE, time: true });
    const withTime = segsOf(withTimeContainer);
    expect(withTime).toHaveLength(4);
    expect(withTime[3].classList.contains("hk-date-tag__seg--time")).toBe(true);
    expect(withTime[3].textContent).toBe("14:30");
    // The blank separator between the date and the time reads as one
    // space in the pill's text.
    expect(textOf(withTimeContainer)).toBe("2024/10/06 14:30");

    const withoutTimeContainer = mountTag({ value: SHIP_DATE });
    const withoutTime = segsOf(withoutTimeContainer);
    expect(withoutTime).toHaveLength(3);
    expect(withoutTime.some((s) => s.classList.contains("hk-date-tag__seg--time"))).toBe(false);
  });

  it("formats the time segment for the active locale", async () => {
    await setLocale("en");
    const container = mountTag({ value: SHIP_DATE, time: true });
    const segs = segsOf(container);
    expect(segs).toHaveLength(4);
    expect(segs[3].textContent).toBe("02:30 PM");
    expect(textOf(container)).toBe("10/06/2024 02:30 PM");
  });
});

describe("HkDateTag value normalization", () => {
  it("accepts epoch milliseconds and date strings like the Date form", async () => {
    await setLocale("en");
    expect(textOf(mountTag({ value: SHIP_DATE }))).toBe("10/06/2024");
    // A number is epoch MILLISECONDS.
    expect(textOf(mountTag({ value: SHIP_DATE.getTime() }))).toBe("10/06/2024");
    expect(textOf(mountTag({ value: "2024-10-06T14:30:00" }))).toBe("10/06/2024");
  });

  it("renders the empty pill shell for unparseable input", async () => {
    await setLocale("zh-Hans");
    const container = mountTag({ value: "not-a-date" });

    const pill = pillOf(container);
    expect(pill.children).toHaveLength(0);
    expect(segsOf(container)).toHaveLength(0);
  });
});

describe("HkDateTag module surface", () => {
  it("exports the same component as the default and named binding", () => {
    expect(HkDateTagDefault).toBe(HkDateTag);
    expect(HkDateTag.name).toBe("HkDateTag");
  });
});
