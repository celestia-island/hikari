import { afterEach, describe, expect, it } from "vitest";
import { createApp, defineComponent, h, nextTick, type App } from "vue";

import HkThemeDecor from "../components/HkThemeDecor";
import HkWallpaperBackdrop from "../components/HkWallpaperBackdrop";
import { registerStandardThemeDecor, STANDARD_THEME_DECOR_SLOTS } from "./standardDecor";
import { getThemeDecor, registerThemeDecor } from "./themeDecor";

/**
 * The `backdrop` decor slot is the wallpaper stack's mount point, and its
 * ownership is the point of this file.
 *
 * hikari deliberately does NOT fill it. `registerThemeDecor` has no
 * unregister, and the built-in floor (level 3 of the resolution order) sits
 * BELOW both an exact theme id and the `"*"` wildcard — so a floor entry is
 * "a component the host cannot configure away", which is exactly what a
 * page-covering backdrop must not be. `standardDecor.ts` records the gap;
 * this test holds both halves of it:
 *
 *   1. before a host registers anything, `getThemeDecor("backdrop", …)` is
 *      `undefined` for EVERY theme id — and stays that way after
 *      `registerStandardThemeDecor()` has run, so the floor cannot quietly
 *      acquire a backdrop;
 *   2. a host registering its own component on `"*"` gets ITS component
 *      resolved for every theme (hikari's wallpaper stack does not shadow
 *      it), and registering HkWallpaperBackdrop there is the documented way
 *      to opt into the shared stack.
 */

const mounts: Array<{ app: App; container: HTMLElement }> = [];

function mountDecor(slot: string) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const app = createApp({ render: () => h(HkThemeDecor, { slot }) });
  mounts.push({ app, container });
  app.mount(container);
  return container;
}

afterEach(() => {
  while (mounts.length > 0) {
    const entry = mounts.pop()!;
    entry.app.unmount();
    entry.container.remove();
  }
});

describe("backdrop decor slot — host-owned", () => {
  it("resolves to nothing until a host registers one (the recorded gap)", () => {
    // First read of the module graph in this file: nothing has registered.
    expect(getThemeDecor("backdrop", "sc")).toBeUndefined();
    expect(getThemeDecor("backdrop", "*")).toBeUndefined();

    registerStandardThemeDecor();

    // The floor still has no backdrop: every theme id keeps resolving to
    // undefined, which is the "no backdrop configured" state.
    for (const themeId of ["sc", "default", "custom-anything", "*"]) {
      expect(getThemeDecor("backdrop", themeId), themeId).toBeUndefined();
    }
    expect(STANDARD_THEME_DECOR_SLOTS).not.toContain("backdrop");
  });

  it("renders nothing for the slot while no host has registered one", async () => {
    registerStandardThemeDecor();
    const container = mountDecor("backdrop");
    await nextTick();
    // Unregistered ⇒ no element at all (Vue's empty-render comment node is
    // the whole content).
    expect(container.children).toHaveLength(0);
    expect(container.textContent).toBe("");
  });

  it("resolves the HOST's component from the wildcard, for every theme id", () => {
    registerStandardThemeDecor();
    const HostBackdrop = defineComponent({ name: "HostBackdrop", render: () => null });

    registerThemeDecor({ themeId: "*", slot: "backdrop", component: HostBackdrop });

    for (const themeId of ["sc", "default", "custom-anything"]) {
      const resolved = getThemeDecor("backdrop", themeId);
      expect(resolved?.component, themeId).toBe(HostBackdrop);
      expect(resolved?.component).not.toBe(HkWallpaperBackdrop);
    }
  });

  it("lets an exact theme id beat the host wildcard (level 1 vs level 2)", () => {
    const HostBackdrop = defineComponent({ name: "HostBackdrop", render: () => null });
    const ThemeBackdrop = defineComponent({ name: "ThemeBackdrop", render: () => null });
    registerThemeDecor({ themeId: "*", slot: "backdrop", component: HostBackdrop });
    registerThemeDecor({ themeId: "sc", slot: "backdrop", component: ThemeBackdrop });

    expect(getThemeDecor("backdrop", "sc")?.component).toBe(ThemeBackdrop);
    expect(getThemeDecor("backdrop", "other")?.component).toBe(HostBackdrop);
  });

  it("mounts the resolved host component through HkThemeDecor", async () => {
    const HostBackdrop = defineComponent({
      name: "HostBackdrop",
      render: () => h("div", { class: "host-backdrop" }),
    });
    registerThemeDecor({ themeId: "*", slot: "backdrop", component: HostBackdrop });

    const container = mountDecor("backdrop");
    await nextTick();
    expect(container.querySelector(".host-backdrop")).not.toBeNull();
  });

  it("mounts hikari's own wallpaper stack when the host opts in", async () => {
    registerThemeDecor({ themeId: "*", slot: "backdrop", component: HkWallpaperBackdrop });
    // A theme id no earlier test registered an exact entry for: the
    // wildcard is what resolves.
    expect(getThemeDecor("backdrop", "opt-in")?.component).toBe(HkWallpaperBackdrop);

    const container = mountDecor("backdrop");
    await nextTick();
    // The component's own root, and no layer written into document.body.
    expect(container.querySelector(".hk-wallpaper-backdrop")).not.toBeNull();
    for (const child of Array.from(document.body.children)) {
      expect(["IMG", "VIDEO", "CANVAS"]).not.toContain(child.tagName);
    }
  });
});
