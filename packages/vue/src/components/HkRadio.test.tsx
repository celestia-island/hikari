import { afterEach, describe, expect, it } from "vitest";
import { createApp, defineComponent, h, nextTick, ref } from "vue";

import HkRadio, { type HkRadioOption } from "./HkRadio";

/**
 * HkRadio contract tests:
 * - option selection semantics: the model value matches option VALUES
 *   (strict, type-preserving — a numeric option emits a number), and the
 *   checked markers (box data-checked, dot, native radio checked) follow
 *   the matching option only
 * - direction / size group modifiers
 * - each option is a real <label> wrapping its native radio input, so
 *   clicking an option's TEXT selects it; re-activating the already
 *   selected option fires no platform change (and thus no emit)
 * - disabled: whole group or per option; disabled inputs swallow clicks
 *
 * The component wires no custom keyboard handlers (no roving tabindex /
 * arrow-key code exists) — keyboard behavior is whatever the native
 * inputs provide, so no keyboard case is asserted here.
 *
 * House style: raw createApp mounts on a shared container list torn
 * down after each case; DOM assertions via document queries.
 */

const mounts: Array<{ app: ReturnType<typeof createApp>; container: HTMLElement }> = [];

function mount(node: ReturnType<typeof h>) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const app = createApp({ render: () => node });
  app.mount(container);
  mounts.push({ app, container });
  return container;
}

const OPTS = [
  { value: "a", label: "Alpha" },
  { value: "b", label: "Beta" },
];

const NUM_OPTS = [
  { value: 1, label: "One" },
  { value: 2, label: "Two" },
];

/** v-model harness: mirrors consumer usage, records every emitted value. */
function mountVModel(initial: string | number | null, props: Record<string, unknown> = {}) {
  const model = ref<string | number | null>(initial);
  const emitted: Array<string | number> = [];
  const container = document.createElement("div");
  document.body.appendChild(container);
  const app = createApp(defineComponent({
    setup: () => () =>
      h(HkRadio, {
        ...props,
        modelValue: model.value as string | number,
        "onUpdate:modelValue": (v: string | number) => {
          model.value = v;
          emitted.push(v);
        },
      } as never),
  }));
  app.mount(container);
  mounts.push({ app, container });
  const group = () => container.querySelector<HTMLElement>(".hk-radio-group")!;
  const items = () => Array.from(container.querySelectorAll<HTMLElement>("label.hk-radio"));
  const inputs = () => Array.from(container.querySelectorAll<HTMLInputElement>("input"));
  return { container, model, emitted, group, items, inputs };
}

afterEach(() => {
  for (const { app, container } of mounts.splice(0)) {
    app.unmount();
    container.remove();
  }
});

describe("HkRadio group shell", () => {
  it("renders the horizontal/md group by default with one option per label", () => {
    const c = mount(h(HkRadio, { options: OPTS }));
    const group = c.querySelector<HTMLElement>(".hk-radio-group")!;
    expect(group).not.toBeNull();
    expect(group.className).toBe("hk-radio-group hk-radio-group-horizontal hk-radio-group-md");
    const items = c.querySelectorAll("label.hk-radio");
    expect(items.length).toBe(2);
    // Option labels render through the HkLabel shell.
    const labels = Array.from(c.querySelectorAll<HTMLElement>(".hk-label"));
    expect(labels.map((l) => l.textContent)).toEqual(["Alpha", "Beta"]);
    const inputs = c.querySelectorAll("input");
    expect(inputs.length).toBe(2);
    expect(Array.from(inputs).every((i) => i.type === "radio")).toBe(true);
  });

  it("maps direction and size props to group modifiers", () => {
    const c = mount(h(HkRadio, { options: OPTS, direction: "vertical", size: "lg" }));
    const cls = c.querySelector(".hk-radio-group")!.className;
    expect(cls).toContain("hk-radio-group-vertical");
    expect(cls).toContain("hk-radio-group-lg");
    expect(cls).not.toContain("hk-radio-group-horizontal");
    expect(c.querySelector("label.hk-radio")!.getAttribute("data-size")).toBe("lg");
  });

  it("lets the label slot override the option text", () => {
    const c = mount(h(HkRadio, {
      options: OPTS,
    }, {
      label: ({ option }: { option: HkRadioOption }) => h("span", { class: "custom-opt" }, `#${option.label}`),
    }));
    const customs = Array.from(c.querySelectorAll<HTMLElement>(".custom-opt"));
    expect(customs.map((el) => el.textContent)).toEqual(["#Alpha", "#Beta"]);
  });
});

describe("HkRadio selection semantics", () => {
  it("marks only the option whose value matches the model", () => {
    const c = mount(h(HkRadio, { options: OPTS, modelValue: "b" }));
    const boxes = Array.from(c.querySelectorAll<HTMLElement>(".hk-radio-box"));
    expect(boxes[0]!.hasAttribute("data-checked")).toBe(false);
    expect(boxes[1]!.getAttribute("data-checked")).toBe("");
    // The dot renders in the selected option only.
    expect(c.querySelectorAll(".hk-radio-dot").length).toBe(1);
    expect(boxes[1]!.querySelector(".hk-radio-dot")).not.toBeNull();
    const inputs = Array.from(c.querySelectorAll<HTMLInputElement>("input"));
    expect(inputs[0]!.checked).toBe(false);
    expect(inputs[1]!.checked).toBe(true);
  });

  it("emits the clicked option's value and moves the selection", async () => {
    const t = mountVModel("a", { options: OPTS });
    t.inputs()[1]!.click();
    await nextTick();
    expect(t.emitted).toEqual(["b"]);
    expect(t.model.value).toBe("b");
    // Selection moved: dot and data-checked follow the new option.
    const boxes = Array.from(t.container.querySelectorAll<HTMLElement>(".hk-radio-box"));
    expect(boxes[0]!.hasAttribute("data-checked")).toBe(false);
    expect(boxes[1]!.getAttribute("data-checked")).toBe("");
  });

  it("emits the option value type-preserving (number stays number)", async () => {
    const t = mountVModel(1, { options: NUM_OPTS });
    t.inputs()[1]!.click();
    await nextTick();
    expect(t.emitted).toEqual([2]);
    expect(t.emitted[0]).toBe(2);
    expect(typeof t.emitted[0]).toBe("number");
    // Strict matching against the numeric model still selects.
    expect(
      Array.from(t.container.querySelectorAll<HTMLInputElement>("input"))[1]!.checked,
    ).toBe(true);
  });

  it("selects through the option label text (native label→input forwarding)", async () => {
    const t = mountVModel("a", { options: OPTS });
    (t.container.querySelectorAll(".hk-label")[1] as HTMLElement).click();
    await nextTick();
    expect(t.emitted).toEqual(["b"]);
    expect(t.inputs()[1]!.checked).toBe(true);
  });

  it("fires no emit when re-activating the already selected option", async () => {
    const t = mountVModel("a", { options: OPTS });
    t.inputs()[0]!.click(); // already checked: the platform fires no change
    await nextTick();
    expect(t.emitted).toEqual([]);
    expect(t.model.value).toBe("a");
  });

  it("leaves every option unselected with a null model", () => {
    const c = mount(h(HkRadio, { options: OPTS }));
    expect(c.querySelector(".hk-radio-dot")).toBeNull();
    expect(Array.from(c.querySelectorAll(".hk-radio-box")).every((b) => !b.hasAttribute("data-checked"))).toBe(true);
  });
});

describe("HkRadio disabled", () => {
  it("disables every option from the group prop", () => {
    const c = mount(h(HkRadio, { options: OPTS, disabled: true }));
    const items = Array.from(c.querySelectorAll<HTMLElement>("label.hk-radio"));
    expect(items.every((el) => el.getAttribute("data-disabled") === "")).toBe(true);
    expect(Array.from(c.querySelectorAll<HTMLInputElement>("input")).every((i) => i.disabled)).toBe(true);
  });

  it("disables a single option without touching its siblings", () => {
    const c = mount(h(HkRadio, {
      options: [{ value: "a", label: "Alpha" }, { value: "b", label: "Beta", disabled: true }],
    }));
    const items = Array.from(c.querySelectorAll<HTMLElement>("label.hk-radio"));
    expect(items[0]!.hasAttribute("data-disabled")).toBe(false);
    expect(items[1]!.getAttribute("data-disabled")).toBe("");
    const inputs = Array.from(c.querySelectorAll<HTMLInputElement>("input"));
    expect(inputs[0]!.disabled).toBe(false);
    expect(inputs[1]!.disabled).toBe(true);
  });

  it("swallows clicks on a disabled option", async () => {
    const t = mountVModel("a", {
      options: [{ value: "a", label: "Alpha" }, { value: "b", label: "Beta", disabled: true }],
    });
    t.inputs()[1]!.click();
    await nextTick();
    expect(t.emitted).toEqual([]);
    expect(t.model.value).toBe("a");
  });
});
