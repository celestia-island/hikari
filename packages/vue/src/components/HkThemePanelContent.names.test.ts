/**
 * HkThemePanelContent × theme-name i18n (2026-11-25 user direction:
 * theme names are i18n citizens on every host). The row name resolves
 * through THREE answers — the theme's own nameI18n map (authored in the
 * scheme editor's localized-name input), the message-key convention
 * (the stock preset ships `hikari::theme.defaultThemeName`), then the
 * raw name. The negative direction is pinned because it is the silent
 * English leak the user reported: a face switched to 简体中文 must not
 * show "Default".
 */
import { afterEach, describe, expect, it } from "vitest";
import { createApp, defineComponent, h, nextTick } from "vue";

import { HkThemePanelContent } from "./HkThemePanelContent";
import { setLocale } from "../i18n/context";
import { useTheme, themePresets, type ThemeSchemeTokens } from "../theme";

const mounts: Array<{ app: ReturnType<typeof createApp>; container: HTMLElement }> = [];

async function settle(): Promise<void> {
  await nextTick();
  await new Promise((resolve) => setTimeout(resolve, 20));
  await nextTick();
}

function rowNames(): string[] {
  return [
    ...document.body.querySelectorAll<HTMLElement>(
      ".s-theme-menu .s-theme-item-row .s-theme-item-name",
    ),
  ].map((el) => el.textContent?.trim() ?? "");
}

function mountPanel(): HTMLElement {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const Host = defineComponent({
    name: "NamesPanelHost",
    setup() {
      return () => h(HkThemePanelContent, { externalCustomize: true });
    },
  });
  const app = createApp(Host);
  app.mount(container);
  mounts.push({ app, container });
  return container;
}

afterEach(async () => {
  for (const { app, container } of mounts.splice(0)) {
    app.unmount();
    container.remove();
  }
  // Custom themes live in localStorage — wipe what a test added.
  for (const id of ["names-i18n", "names-keyed"]) {
    useTheme().removeCustomTheme(id);
  }
  await setLocale("en");
});

describe("HkThemePanelContent theme-name i18n", () => {
  it("shows the per-locale name of a custom theme and follows locale switches", async () => {
    useTheme().addCustomTheme({
      id: "names-i18n",
      name: "Midnight",
      nameI18n: { en: "Midnight", "zh-Hans": "午夜" },
      dark: themePresets.default.dark as ThemeSchemeTokens,
      light: themePresets.default.light as ThemeSchemeTokens,
    });
    await setLocale("en");
    mountPanel();
    await settle();
    expect(rowNames()).toContain("Midnight");

    await setLocale("zh-Hans");
    await settle();
    expect(rowNames()).toContain("午夜");
    expect(rowNames()).not.toContain("hikari::");
  });

  it("localizes the stock default row on a non-English face", async () => {
    // The stock preset's name IS the catalog key (2026-11-25): under
    // zh-Hans the factory row reads 默认, never the bare English word.
    await setLocale("zh-Hans");
    mountPanel();
    await settle();
    const names = rowNames();
    expect(names).toContain("默认");
    expect(names).not.toContain("Default");
  });
});
