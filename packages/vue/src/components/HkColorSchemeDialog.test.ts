import { afterEach, describe, expect, it } from "vitest";
import { createApp, h, nextTick } from "vue";

import { registerTokenGroup, type TokenGroupDefinition } from "../theme/tokenGroups";
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
    // pairWith slots share one combined row carrying both pickers.
    expect(section!.querySelectorAll(".hk-color-picker")).toHaveLength(2);
    expect(section!.querySelector(".s-scheme-group-row")).toBeTruthy();
  });
});
