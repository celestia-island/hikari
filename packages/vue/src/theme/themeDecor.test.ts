import { describe, expect, it, vi } from "vitest";
import { defineComponent, h, type Component } from "vue";

import {
  getThemeDecor,
  isThemeDecorSlot,
  registerThemeDecor,
  registerThemeDecorBuiltin,
  themeDecorSlots,
  themeDecorVersion,
  THEME_DECOR_SLOT_PATTERN,
} from "./themeDecor";

/**
 * The decor registry contract.
 *
 * Everything here is about the RESOLUTION CHAIN and the registry's own
 * discipline — what a theme may register, what wins when several levels are
 * filled, and what happens when the input is not a slot name at all. The
 * rendering side (HkThemeDecor) and the built-in set (standardDecor) have
 * their own suites.
 *
 * Slots are namespaced per case (`probe.*`) so cases cannot shadow each
 * other: the registry is module-level state and `vi.resetModules()` is only
 * used where a clean graph is the point.
 */

function stub(tag: string): Component {
  return defineComponent({
    name: `Stub-${tag}`,
    setup: () => () => h("i", { "data-stub": tag }),
  });
}

describe("themeDecor registry", () => {
  it("registers nothing at import (fresh module graph)", async () => {
    // The zero-side-effect contract standardGroups.ts holds too: importing
    // the module must not populate the registry — only a call does.
    vi.resetModules();
    const fresh = await import("./themeDecor");
    expect(fresh.themeDecorSlots()).toEqual([]);
    expect(fresh.themeDecorVersion.value).toBe(0);
  });

  it("resolves exact theme id → \"*\" → built-in floor, each level distinguishable", () => {
    const slot = "probe.order";
    const floor = stub("floor");
    const wildcard = stub("wildcard");
    const exact = stub("exact");

    // Level 3 only: the built-in floor answers for every theme.
    registerThemeDecorBuiltin({ slot, component: floor });
    expect(getThemeDecor(slot, "alpha")?.component).toBe(floor);
    expect(getThemeDecor(slot, "beta")?.component).toBe(floor);

    // Level 2: a wildcard entry beats the floor for every theme …
    registerThemeDecor({ themeId: "*", slot, component: wildcard });
    expect(getThemeDecor(slot, "alpha")?.component).toBe(wildcard);
    expect(getThemeDecor(slot, "beta")?.component).toBe(wildcard);
    // … and the floor is still underneath it (not lost, just outranked).
    expect(getThemeDecor(slot, "alpha")?.component).not.toBe(floor);

    // Level 1: an exact theme id beats the wildcard for THAT theme only.
    registerThemeDecor({ themeId: "alpha", slot, component: exact });
    expect(getThemeDecor(slot, "alpha")?.component).toBe(exact);
    expect(getThemeDecor(slot, "beta")?.component).toBe(wildcard);
  });

  it("falls through to undefined when nothing is registered for the slot", () => {
    expect(getThemeDecor("probe.unregistered", "alpha")).toBeUndefined();
    // Positive control on the same call shape: a slot that IS registered
    // resolves, so the undefined above is a real miss and not a broken call.
    registerThemeDecor({ themeId: "alpha", slot: "probe.registered", component: stub("r") });
    expect(getThemeDecor("probe.registered", "alpha")).toBeDefined();
  });

  it("re-registering the same (themeId, slot) REPLACES the entry", () => {
    const slot = "probe.override";
    const first = stub("first");
    const second = stub("second");

    registerThemeDecor({ themeId: "alpha", slot, component: first, props: { from: "first" } });
    expect(getThemeDecor(slot, "alpha")?.component).toBe(first);
    const versionAfterFirst = themeDecorVersion.value;

    registerThemeDecor({ themeId: "alpha", slot, component: second, props: { from: "second" } });

    const resolved = getThemeDecor(slot, "alpha");
    expect(resolved?.component).toBe(second);
    expect(resolved?.props).toEqual({ from: "second" });
    // An overwrite is a registration: it bumps the reactive version so a
    // live <HkThemeDecor> re-resolves.
    expect(themeDecorVersion.value).toBe(versionAfterFirst + 1);
    // …and the slot is still listed exactly once.
    expect(themeDecorSlots().filter((s) => s === slot)).toHaveLength(1);
  });

  it("rejects invalid slot names with an explicit error and touches nothing", () => {
    const bad = ["Status.tray", "status_tray", "1status", "", "status tray", ".status", "-status"];
    const versionBefore = themeDecorVersion.value;
    const slotsBefore = themeDecorSlots();

    for (const slot of bad) {
      expect(() => registerThemeDecor({ themeId: "alpha", slot, component: stub("bad") }))
        .toThrow(/invalid slot/);
      expect(() => registerThemeDecorBuiltin({ slot, component: stub("bad") }))
        .toThrow(/invalid slot/);
    }

    // A rejected registration is not a registration: no version bump, no
    // slot entry (so a typo cannot leave a phantom slot in the listing).
    expect(themeDecorVersion.value).toBe(versionBefore);
    expect(themeDecorSlots()).toEqual(slotsBefore);

    // Positive control: the same call shape with valid names does register.
    for (const slot of ["status.tray", "empty", "a", "placeholder.section-2", "x.y-z.9"]) {
      expect(isThemeDecorSlot(slot), slot).toBe(true);
      registerThemeDecor({ themeId: "alpha", slot, component: stub(slot) });
      expect(themeDecorSlots()).toContain(slot);
    }
    for (const slot of bad) expect(isThemeDecorSlot(slot), slot).toBe(false);
    expect(THEME_DECOR_SLOT_PATTERN.source).toBe("^[a-z][a-z0-9.-]*$");
  });

  it("rejects an empty theme id and a missing component", () => {
    const slot = "probe.badinput";
    expect(() => registerThemeDecor({ themeId: "", slot, component: stub("x") }))
      .toThrow(/theme id/);
    expect(() =>
      registerThemeDecor({ themeId: "alpha", slot, component: undefined as unknown as Component }),
    ).toThrow(/without a component/);
    expect(themeDecorSlots()).not.toContain(slot);
  });

  it("lists slots deduplicated and in stable first-registration order", () => {
    registerThemeDecor({ themeId: "alpha", slot: "probe.order.one", component: stub("1") });
    registerThemeDecor({ themeId: "beta", slot: "probe.order.two", component: stub("2") });
    registerThemeDecor({ themeId: "*", slot: "probe.order.two", component: stub("2w") });
    registerThemeDecor({ themeId: "gamma", slot: "probe.order.one", component: stub("1g") });

    const first = themeDecorSlots();
    const second = themeDecorSlots();
    expect(first).toEqual(second);
    expect(new Set(first).size).toBe(first.length);
    expect(first.filter((s) => s.startsWith("probe.order."))).toEqual([
      "probe.order.one",
      "probe.order.two",
    ]);
    // Fresh array per call: a caller cannot corrupt the registry listing.
    first.push("probe.injected");
    expect(themeDecorSlots()).not.toContain("probe.injected");
  });

  it("hands out copies: mutating the result or the input cannot desync the registry", () => {
    const slot = "probe.isolation";
    const props = { variant: "original" };
    registerThemeDecor({ themeId: "alpha", slot, component: stub("iso"), props });

    // Caller mutates the object it registered …
    props.variant = "mutated-after-registration";
    // … and the object it got back.
    const resolved = getThemeDecor(slot, "alpha")!;
    (resolved.props as Record<string, unknown>).variant = "mutated-result";

    expect(getThemeDecor(slot, "alpha")!.props).toEqual({ variant: "original" });
  });

  it("bumps themeDecorVersion on every registration", () => {
    const versionBefore = themeDecorVersion.value;
    registerThemeDecor({ themeId: "alpha", slot: "probe.version", component: stub("v1") });
    expect(themeDecorVersion.value).toBe(versionBefore + 1);
    registerThemeDecorBuiltin({ slot: "probe.version", component: stub("v2") });
    expect(themeDecorVersion.value).toBe(versionBefore + 2);
  });
});
