import { afterEach, describe, expect, it } from "vitest";
import { createApp, defineComponent, h, nextTick, ref } from "vue";

import HkIconButtonGroup from "./HkIconButtonGroup";

/**
 * HkIconButtonGroup contract tests:
 * - "buttons" mode: no selection state, select fires on every click
 * - "single" mode: radiogroup semantics — v-model update + data-active,
 *   no re-fire on the already-active key
 * - "multiple" mode: toggle set in v-model, aria-pressed mirrors state
 * - tooltips: every labeled item rides an HkTooltip wrapper (label text),
 *   an explicit `tooltip: ""` suppresses it
 * - disabled items / disabled group stay dead
 * - extra attrs (aria-label) fall through onto the root
 *
 * House style: no @vue/test-utils dependency — raw createApp mounts on a
 * shared container list torn down after each case.
 */

const mounts: Array<ReturnType<typeof createApp>> = [];

function mountComp(render: () => ReturnType<typeof h>): HTMLElement {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const app = createApp(defineComponent({ setup: () => render }));
  mounts.push(app);
  app.mount(container);
  return container;
}

afterEach(() => {
  for (const app of mounts.splice(0)) app.unmount();
  for (const popup of [...document.querySelectorAll(".hk-tooltip-popup")]) popup.remove();
});

const options = [
  { key: "totp", label: "验证器 App" },
  { key: "passkey", label: "Passkey" },
];

describe("HkIconButtonGroup", () => {
  it("renders plain action buttons in buttons mode and emits select on every click", async () => {
    const picked: string[] = [];
    const c = mountComp(() =>
      h(HkIconButtonGroup, { options, onSelect: (k: string) => picked.push(k) }),
    );
    const group = c.querySelector<HTMLElement>(".hk-icon-group")!;
    expect(group.getAttribute("role")).toBe("group");
    expect(group.classList.contains("hk-icon-group-buttons")).toBe(true);
    const buttons = c.querySelectorAll<HTMLButtonElement>(".hk-icon-group-item");
    expect(buttons.length).toBe(2);
    expect(group.querySelectorAll(".hk-tooltip-wrapper").length).toBe(2);
    buttons[0]!.click();
    await Promise.resolve();
    buttons[0]!.click();
    await Promise.resolve();
    expect(picked).toEqual(["totp", "totp"]);
    // No selection state exists in buttons mode.
    expect(c.querySelectorAll("[data-active]").length).toBe(0);
  });

  it("updates v-model and marks the active item in single mode", async () => {
    const model = ref<string | null>(null);
    const c = mountComp(() =>
      h(HkIconButtonGroup, {
        options,
        mode: "single",
        modelValue: model.value,
        "onUpdate:modelValue": (v: string | string[]) => {
          model.value = v as string;
        },
      }),
    );
    const group = c.querySelector<HTMLElement>(".hk-icon-group")!;
    expect(group.getAttribute("role")).toBe("radiogroup");
    const buttons = [...c.querySelectorAll<HTMLButtonElement>(".hk-icon-group-item")];
    expect(buttons[0]!.getAttribute("role")).toBe("radio");
    expect(buttons[0]!.getAttribute("aria-checked")).toBe("false");
    buttons[0]!.click();
    await nextTick();
    expect(model.value).toBe("totp");
    expect(buttons[0]!.dataset.active).toBe("true");
    expect(buttons[0]!.getAttribute("aria-checked")).toBe("true");
  });

  it("does not re-fire when the active key is re-clicked in single mode", async () => {
    const events: string[] = [];
    const c = mountComp(() =>
      h(HkIconButtonGroup, {
        options,
        mode: "single",
        modelValue: "totp",
        "onUpdate:modelValue": () => events.push("update"),
        onSelect: (k: string) => events.push(`select:${k}`),
      }),
    );
    const button = c.querySelector<HTMLButtonElement>(".hk-icon-group-item")!;
    expect(button.dataset.active).toBe("true");
    button.click();
    await Promise.resolve();
    expect(events).toEqual([]);
  });

  it("toggles keys into and out of the v-model array in multiple mode", async () => {
    const seen: Array<string | string[]> = [];
    const c = mountComp(() =>
      h(HkIconButtonGroup, {
        options,
        mode: "multiple",
        modelValue: ["passkey"],
        "onUpdate:modelValue": (v: string | string[]) => seen.push(v),
      }),
    );
    const group = c.querySelector<HTMLElement>(".hk-icon-group")!;
    expect(group.getAttribute("role")).toBe("group");
    const buttons = [...c.querySelectorAll<HTMLButtonElement>(".hk-icon-group-item")];
    expect(buttons[1]!.getAttribute("aria-pressed")).toBe("true");
    buttons[0]!.click();
    buttons[1]!.click();
    await Promise.resolve();
    expect(seen).toEqual([["passkey", "totp"], []]);
  });

  it("suppresses the tooltip with an explicit empty override and keeps the label as the a11y name", () => {
    const c = mountComp(() =>
      h(HkIconButtonGroup, {
        options: [
          { key: "a", label: "Alpha" },
          { key: "b", label: "Beta", tooltip: "" },
        ],
      }),
    );
    expect(c.querySelectorAll(".hk-tooltip-wrapper").length).toBe(1);
    const beta = c.querySelectorAll<HTMLButtonElement>(".hk-icon-group-item")[1]!;
    expect(beta.getAttribute("aria-label")).toBe("Beta");
    // The HkTooltip popup owns the hover text — the button carries no title.
    expect(beta.getAttribute("title")).toBeNull();
  });

  it("renders the given icon vnode and falls back to the label initial without one", () => {
    const c = mountComp(() =>
      h(HkIconButtonGroup, {
        options: [
          { key: "a", label: "Alpha", icon: h("span", { class: "glyph" }) },
          { key: "b", label: "Beta" },
        ],
      }),
    );
    const buttons = c.querySelectorAll<HTMLButtonElement>(".hk-icon-group-item");
    expect(buttons[0]!.querySelector(".glyph")).toBeTruthy();
    expect(buttons[1]!.querySelector<HTMLElement>(".hk-icon-group-item-initial")?.textContent).toBe("B");
  });

  it("keeps disabled items and the group-level disable inert", async () => {
    const picked: string[] = [];
    const c = mountComp(() =>
      h(HkIconButtonGroup, {
        options: [
          { key: "a", label: "Alpha", disabled: true },
          { key: "b", label: "Beta" },
        ],
        disabled: true,
        onSelect: (k: string) => picked.push(k),
      }),
    );
    const buttons = [...c.querySelectorAll<HTMLButtonElement>(".hk-icon-group-item")];
    expect(buttons.every((b) => b.disabled)).toBe(true);
    buttons[1]!.click();
    await Promise.resolve();
    expect(picked).toEqual([]);
  });

  it("falls extra attrs through onto the group root", () => {
    const c = mountComp(() =>
      h(HkIconButtonGroup, { options, "aria-label": "验证方式", "data-test": "probe" }),
    );
    const group = c.querySelector<HTMLElement>(".hk-icon-group")!;
    expect(group.getAttribute("aria-label")).toBe("验证方式");
    expect(group.getAttribute("data-test")).toBe("probe");
  });
});
