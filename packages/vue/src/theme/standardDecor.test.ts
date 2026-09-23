import { describe, expect, it, vi } from "vitest";
import { defineComponent, h } from "vue";

import HkDivider from "../components/HkDivider";
import HkEmptyState from "../components/HkEmptyState";
import HkSkeleton from "../components/HkSkeleton";
import HkSplash from "../components/HkSplash";
import HkStatusTray from "../components/HkStatusTray";
import { registerStandardThemeDecor, STANDARD_THEME_DECOR_SLOTS } from "./standardDecor";
import {
  getThemeDecor,
  registerThemeDecor,
  themeDecorSlots,
  themeDecorVersion,
} from "./themeDecor";

/**
 * hikari's own decor defaults.
 *
 * Two things matter here: the built-ins sit on the registry's FLOOR (so a
 * theme's implementation and a host's `"*"` both outrank them without an
 * unregister step), and the gap where `backdrop` is not registered is a
 * decision on record rather than a missing line someone will "fix" later.
 */

describe("registerStandardThemeDecor", () => {
  it("registers nothing at import, then fills the five standard slots", async () => {
    // A fresh module graph, so this proves the registration happens in the
    // call and not in an earlier case of this file. The component is
    // imported from the SAME fresh graph: module identity is per graph, so
    // comparing against the file-level import would be a false negative.
    vi.resetModules();
    const themeDecor = await import("./themeDecor");
    const standardDecor = await import("./standardDecor");
    const freshTray = (await import("../components/HkStatusTray")).default;

    // Importing this module is not a side effect (same contract as
    // standardGroups): only the call populates the registry.
    expect(themeDecor.themeDecorSlots()).toEqual([]);

    standardDecor.registerStandardThemeDecor();

    expect([...themeDecor.themeDecorSlots()].sort()).toEqual(
      [...STANDARD_THEME_DECOR_SLOTS].sort(),
    );
    expect(themeDecor.getThemeDecor("status.tray", "any-theme")?.component).toBe(freshTray);
  });

  it("resolves every built-in for any theme id (floor level, and the declared list matches)", () => {
    registerStandardThemeDecor();

    const expected: [string, unknown][] = [
      ["status.tray", HkStatusTray],
      ["placeholder.screen", HkSplash],
      ["placeholder.section", HkSkeleton],
      ["empty", HkEmptyState],
      ["divider", HkDivider],
    ];
    // The exported slot list and the registrations cannot drift apart.
    expect([...STANDARD_THEME_DECOR_SLOTS].sort()).toEqual(expected.map(([slot]) => slot).sort());

    for (const [slot, component] of expected) {
      for (const themeId of ["default", "endfield", "some-custom-theme", "*"]) {
        expect(getThemeDecor(slot, themeId)?.component, `${slot} under ${themeId}`).toBe(component);
      }
    }
  });

  it("leaves `backdrop` unregistered on purpose (deliberate gap, not an oversight)", () => {
    registerStandardThemeDecor();

    // A screen backdrop resolves into the wallpaper/shader stack, which is
    // its own PR: registering a placeholder now would pre-empt that design
    // with a component hosts could not configure away. Until then the slot
    // resolves to nothing, and <HkThemeDecor slot="backdrop" /> renders
    // empty — the correct "no backdrop configured" state.
    expect(getThemeDecor("backdrop", "default")).toBeUndefined();
    expect(getThemeDecor("backdrop", "*")).toBeUndefined();
    expect(themeDecorSlots()).not.toContain("backdrop");
    expect(STANDARD_THEME_DECOR_SLOTS).not.toContain("backdrop");
    // Positive control on the same call: a registered slot DOES resolve, so
    // the undefined above is a real gap and not a broken lookup.
    expect(getThemeDecor("empty", "default")).toBeDefined();
  });

  it("is idempotent and never clobbers what a theme or host registered", () => {
    registerStandardThemeDecor();
    const versionAfterFirst = themeDecorVersion.value;

    registerStandardThemeDecor();
    registerStandardThemeDecor();
    expect(themeDecorVersion.value).toBe(versionAfterFirst);

    // A theme's own implementation wins over the built-in …
    const themed = defineComponent({ name: "ThemedTray", setup: () => () => h("i") });
    registerThemeDecor({ themeId: "endfield", slot: "status.tray", component: themed });
    registerStandardThemeDecor();
    expect(getThemeDecor("status.tray", "endfield")?.component).toBe(themed);
    expect(getThemeDecor("status.tray", "other")?.component).toBe(HkStatusTray);

    // … and so does a host-wide `"*"` registration.
    const hostWide = defineComponent({ name: "HostTray", setup: () => () => h("i") });
    registerThemeDecor({ themeId: "*", slot: "status.tray", component: hostWide });
    registerStandardThemeDecor();
    expect(getThemeDecor("status.tray", "other")?.component).toBe(hostWide);
  });

  it("lands in the registry via initTheme() (and not before)", async () => {
    vi.resetModules();
    const themeDecor = await import("./themeDecor");
    const freshTray = (await import("../components/HkStatusTray")).default;
    const useTheme = await import("./useTheme");
    expect(themeDecor.getThemeDecor("status.tray", "default")).toBeUndefined();

    useTheme.initTheme();

    expect(themeDecor.getThemeDecor("status.tray", "default")?.component).toBe(freshTray);
    // initTheme starts the solar theme clock; stop it so this file leaves no
    // timer behind.
    useTheme.stopThemeClock();
  });
});
