import { afterEach, describe, expect, it } from "vitest";
import { createApp, h, nextTick } from "vue";

import { registerTokenGroup, type TokenGroupDefinition } from "../theme";
import { setLocale } from "../i18n/context";
import { HColorSchemeDialog } from "./HkColorSchemeDialog";

// Fresh file = fresh registry module instance: no groups are registered
// until a test registers one, mirroring an app that registers late.
const DIALOG_GROUP: TokenGroupDefinition = {
  id: "dialog-wires",
  label: "Dialog wires",
  slots: [
    {
      key: "a",
      label: "A",
      defaults: { dark: { r: 1, g: 2, b: 3 }, light: { r: 4, g: 5, b: 6 } },
    },
    {
      key: "b",
      label: "B",
      defaults: { dark: { r: 7, g: 8, b: 9 }, light: { r: 10, g: 11, b: 12 } },
      pairWith: "a",
    },
  ],
};

// Sectioned group with localized labels, the config-file shape.
const SECTIONED_GROUP: TokenGroupDefinition = {
  id: "dialog-sectioned",
  label: { en: "Sectioned palette", "zh-Hans": "分区调色板" },
  sections: [
    {
      key: "power",
      label: { en: "Electrical power", "zh-Hans": "电力" },
      slots: [
        {
          key: "l1",
          label: { en: "Phase L1 (yellow)", "zh-Hans": "L1 相（黄）" },
          defaults: { dark: { r: 234, g: 179, b: 8 }, light: { r: 161, g: 98, b: 7 } },
          hueClamp: { center: 45, range: 20 },
        },
        {
          key: "l2",
          label: { en: "Phase L2 (green)", "zh-Hans": "L2 相（绿）" },
          defaults: { dark: { r: 34, g: 197, b: 94 }, light: { r: 21, g: 128, b: 61 } },
        },
      ],
    },
    {
      key: "media",
      label: { en: "Process media", "zh-Hans": "工艺介质" },
      slots: [
        {
          key: "h2",
          label: { en: "Hydrogen", "zh-Hans": "氢气" },
          defaults: { dark: { r: 20, g: 184, b: 166 }, light: { r: 15, g: 118, b: 110 } },
        },
      ],
    },
  ],
};

const mounts: Array<{ app: ReturnType<typeof createApp>; container: HTMLElement }> = [];

function mountDialog() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const app = createApp({
    render: () => h(HColorSchemeDialog, { modelValue: true }),
  });
  app.mount(container);
  mounts.push({ app, container });
}

afterEach(() => {
  for (const { app, container } of mounts.splice(0)) {
    app.unmount();
    container.remove();
  }
});

describe("HkColorSchemeDialog extension groups", () => {
  it("renders the extension section reactively when a group is registered after mount", async () => {
    mountDialog();
    await nextTick();
    // Zero-cost for consumers that register nothing.
    expect(document.body.querySelector(".s-scheme-groups")).toBeNull();

    // Late registration (after the dialog is already rendered): the
    // registry's reactive version invalidates the computed and the
    // section appears without a remount.
    registerTokenGroup(DIALOG_GROUP);
    await nextTick();

    const section = document.body.querySelector(".s-scheme-groups");
    expect(section).toBeTruthy();
    // Un-sectioned group: one expansion panel, all slots on its grid.
    expect(section!.querySelectorAll(".hk-expansion-panel")).toHaveLength(1);
    const grid = section!.querySelector(".s-scheme-group-grid");
    expect(grid).toBeTruthy();
    expect(grid!.querySelectorAll(".hk-color-picker")).toHaveLength(2);
  });

  it("renders one expansion panel per section of a sectioned group", async () => {
    registerTokenGroup(SECTIONED_GROUP);
    mountDialog();
    await nextTick();

    // The module-level registry keeps groups from earlier tests in this
    // file, so scope by the sectioned group's own titles.
    const panelByTitle = (title: string) =>
      [...document.body.querySelectorAll<HTMLElement>(".hk-expansion-panel")].find(
        (p) => p.querySelector(".hk-expansion-panel-title")?.textContent === title,
      );
    const power = panelByTitle("Electrical power");
    const media = panelByTitle("Process media");
    expect(power).toBeTruthy();
    expect(media).toBeTruthy();
    // Each section's slots live on their own grid inside the panel body.
    expect(power!.querySelectorAll(".hk-color-picker")).toHaveLength(2);
    expect(media!.querySelectorAll(".hk-color-picker")).toHaveLength(1);
    // Dense grids use the row-layout pickers (full names, ellipsis).
    const gridPickers = [
      ...power!.querySelectorAll<HTMLElement>(".hk-color-picker"),
      ...media!.querySelectorAll<HTMLElement>(".hk-color-picker"),
    ];
    gridPickers.forEach((picker) => expect(picker.getAttribute("data-layout")).toBe("row"));
  });

  it("resolves localized labels for the active locale", async () => {
    await setLocale("zh-Hans");
    registerTokenGroup(SECTIONED_GROUP);
    mountDialog();
    await nextTick();

    const panelByTitle = (title: string) =>
      [...document.body.querySelectorAll<HTMLElement>(".hk-expansion-panel")].find(
        (p) => p.querySelector(".hk-expansion-panel-title")?.textContent === title,
      );
    expect(panelByTitle("电力")).toBeTruthy();
    expect(panelByTitle("工艺介质")).toBeTruthy();
    const labels = [...document.body.querySelectorAll(".hk-color-picker-label")].map(
      (el) => el.textContent,
    );
    expect(labels).toContain("L1 相（黄）");
    expect(labels).toContain("L2 相（绿）");
    expect(labels).toContain("氢气");

    await setLocale("en");
  });

  it("renders flat slots of a mixed group after its sections", async () => {
    registerTokenGroup({
      id: "dialog-mixed",
      label: "Mixed group",
      sections: [
        {
          key: "core",
          label: "Core",
          slots: [
            { key: "one", label: "One", defaults: { dark: { r: 1, g: 1, b: 1 }, light: { r: 2, g: 2, b: 2 } } },
          ],
        },
      ],
      slots: [
        { key: "extra", label: "Extra", defaults: { dark: { r: 3, g: 3, b: 3 }, light: { r: 4, g: 4, b: 4 } } },
      ],
    });
    mountDialog();
    await nextTick();

    const panels = [...document.body.querySelectorAll<HTMLElement>(".hk-expansion-panel")];
    const mixed = panels.filter((p) =>
      ["Mixed group", "Core"].includes(p.querySelector(".hk-expansion-panel-title")?.textContent ?? ""),
    );
    expect(mixed).toHaveLength(2);
    // Flat panel is titled with the group label and carries its slots.
    const flat = mixed.find(
      (p) => p.querySelector(".hk-expansion-panel-title")?.textContent === "Mixed group",
    );
    expect(flat!.querySelectorAll(".hk-color-picker")).toHaveLength(1);
  });

  it("re-resolves config-file labels after a runtime locale switch", async () => {
    await setLocale("en");
    registerTokenGroup(SECTIONED_GROUP);
    mountDialog();
    await nextTick();

    const titleByText = () =>
      [...document.body.querySelectorAll<HTMLElement>(".hk-expansion-panel-title")].map(
        (el) => el.textContent,
      );
    expect(titleByText()).toContain("Electrical power");
    await setLocale("zh-Hans");
    await nextTick();
    expect(titleByText()).toContain("电力");
    await setLocale("en");
  });
});
