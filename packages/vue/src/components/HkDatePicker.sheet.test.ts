/**
 * Source contract for the date/datetime picker mobile sheet docking
 * (2026-09-08 mobile audit deferred item, family contract completion):
 * HkDatePicker and HkDateTimePicker were the last anchored surfaces that
 * never docked as bottom sheets on phones — on non-native touch hosts
 * (nativeOnMobile=false) their calendars opened as tiny trigger-anchored
 * popovers while every other popover-family window docked. Both pickers
 * must pass sheetOnMobile to HPopover (the native path returns before the
 * popover renders, so this is inherently non-native-touch-only) and cap
 * their panels with the #424 centered-cap pattern inside the sheet.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(join(here, name), "utf-8");
/* Fixed window from the opening tag — a non-greedy `[\s\S]*?>` would stop
 * at the `=>` inside the onUpdate prop's inline arrow. */
const popoverTag = (src: string) => {
  const at = src.indexOf("<HPopover");
  return at < 0 ? "" : src.slice(at, at + 700);
};

describe("date picker mobile sheet family contract", () => {
  it("HkDatePicker opts its calendar popover into mobile sheet docking", () => {
    const popover = popoverTag(read("HkDatePicker.tsx"));
    expect(popover).toContain("sheetOnMobile");
  });

  it("HkDateTimePicker opts its popup popover into mobile sheet docking", () => {
    const popover = popoverTag(read("HkDateTimePicker.tsx"));
    expect(popover).toContain("sheetOnMobile");
  });

  it("HkDatePicker caps the calendar panel with the #424 centered-cap pattern", () => {
    const src = read("HkDatePicker.scss");
    const block = src.match(/\.hk-popover-panel\.hk-is-sheet \.hk-dp-panel\s*\{[^}]*\}/)?.[0] ?? "";
    expect(block).toContain("min-width: 0");
    expect(block).toContain("max-width: min(22rem, 100%)");
    expect(block).toContain("margin-inline: auto");
    expect(block).toContain("width: 100%");
  });

  it("HkDateTimePicker caps the popup panel and lifts the body floor in the sheet", () => {
    const src = read("HkDateTimePicker.scss");
    const popup = src.match(/\.hk-popover-panel\.hk-is-sheet \.hk-dtp-popup\s*\{[^}]*\}/)?.[0] ?? "";
    expect(popup).toContain("min-width: 0");
    expect(popup).toContain("max-width: min(22rem, 100%)");
    expect(popup).toContain("margin-inline: auto");
    expect(popup).toContain("width: 100%");
    const body = src.match(/\.hk-popover-panel\.hk-is-sheet \.hk-dtp\s*\{[^}]*\}/)?.[0] ?? "";
    expect(body).toContain("min-width: 0");
  });
});
