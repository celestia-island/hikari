import { afterEach, describe, expect, it } from "vitest";
import { createApp, h, nextTick, ref } from "vue";

import HkSegmentedRadio from "./HkSegmentedRadio";

const mounts: Array<{ app: ReturnType<typeof createApp>; container: HTMLElement }> = [];

function mount(node: ReturnType<typeof h>) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const app = createApp({ render: () => node });
  app.mount(container);
  mounts.push({ app, container });
  return container;
}

afterEach(() => {
  for (const { app, container } of mounts.splice(0)) {
    app.unmount();
    container.remove();
  }
});

const OPTIONS = [
  { value: "active", label: "Active only" },
  { value: "ended", label: "Ended only" },
  { value: "all", label: "Show all" },
];

describe("HkSegmentedRadio", () => {
  it("renders one radio segment per option with radiogroup semantics", () => {
    const c = mount(
      h(HkSegmentedRadio, {
        label: "Node status",
        options: OPTIONS,
        modelValue: "ended",
      }),
    );
    const radios = [...c.querySelectorAll<HTMLButtonElement>(".hk-segmented-radio-option")];
    expect(radios.map((r) => r.textContent?.trim())).toEqual([
      "Active only",
      "Ended only",
      "Show all",
    ]);
    const group = c.querySelector(".hk-segmented-radio")!;
    expect(group.getAttribute("role")).toBe("radiogroup");
    expect(group.getAttribute("aria-label")).toBe("Node status");
    // Radio semantics: aria-checked + roving tabindex on the picked one.
    expect(radios[1].getAttribute("aria-checked")).toBe("true");
    expect(radios[1].getAttribute("tabindex")).toBe("0");
    expect(radios[0].getAttribute("aria-checked")).toBe("false");
    expect(radios[0].getAttribute("tabindex")).toBe("-1");
    expect(radios[1].hasAttribute("data-on")).toBe(true);
    expect(radios[0].hasAttribute("data-on")).toBe(false);
  });

  it("clicking another segment emits exactly its value (host feeds it back)", async () => {
    const emitted: string[] = [];
    // A REACTIVE host: the component is controlled, so the test host
    // must apply what it emits (the real popover does the same).
    const c = mount(
      h({
        setup() {
          const value = ref("active");
          return () =>
            h(HkSegmentedRadio, {
              label: "Node status",
              options: OPTIONS,
              modelValue: value.value,
              "onUpdate:modelValue": (v: string) => {
                emitted.push(v);
                value.value = v;
              },
            });
        },
      }),
    );
    const radios = () => [...c.querySelectorAll<HTMLButtonElement>(".hk-segmented-radio-option")];
    radios()[2].click();
    // Vue re-renders asynchronously: the controlled contract needs the
    // host's modelValue writeback flushed before the next interaction.
    await nextTick();
    radios()[0].click();
    await nextTick();
    expect(emitted).toEqual(["all", "active"]);
    expect(radios()[0].hasAttribute("data-on")).toBe(true);
  });

  it("keyboard arrows move the pick with wrapping and refocus the new segment", async () => {
    const emitted: string[] = [];
    const c = mount(
      h(
        {
          setup() {
            const value = ref("ended");
            return () =>
              h(HkSegmentedRadio, {
                label: "Node status",
                options: OPTIONS,
                modelValue: value.value,
                "onUpdate:modelValue": (v: string) => {
                  emitted.push(v);
                  value.value = v;
                },
              });
          },
        },
      ),
    );
    const group = c.querySelector<HTMLElement>(".hk-segmented-radio")!;
    group.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
    );
    expect(emitted).toEqual(["all"]);
    await nextTick();
    group.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
    );
    await nextTick();
    expect(emitted).toEqual(["all", "active"]);
    // Home/End jump to the ends.
    group.dispatchEvent(new KeyboardEvent("keydown", { key: "End", bubbles: true }));
    await nextTick();
    expect(emitted).toEqual(["all", "active", "all"]);
    group.dispatchEvent(new KeyboardEvent("keydown", { key: "Home", bubbles: true }));
    await nextTick();
    expect(emitted).toEqual(["all", "active", "all", "active"]);
  });

  it("disabled disables every segment and the group carries the mark", () => {
    const emitted: string[] = [];
    const c = mount(
      h(HkSegmentedRadio, {
        label: "Node status",
        options: OPTIONS,
        modelValue: "active",
        disabled: true,
        "onUpdate:modelValue": (v: string) => emitted.push(v),
      }),
    );
    const group = c.querySelector(".hk-segmented-radio")!;
    expect(group.hasAttribute("data-disabled")).toBe(true);
    const radios = [...c.querySelectorAll<HTMLButtonElement>(".hk-segmented-radio-option")];
    for (const r of radios) expect(r.disabled).toBe(true);
    radios[1].click();
    expect(emitted).toEqual([]);
  });

  it("an unpicked model keeps the FIRST segment tabbable (roving entry point)", () => {
    const c = mount(
      h(HkSegmentedRadio, {
        label: "Node status",
        options: OPTIONS,
        modelValue: "",
      }),
    );
    const radios = [...c.querySelectorAll<HTMLButtonElement>(".hk-segmented-radio-option")];
    expect(radios[0].getAttribute("tabindex")).toBe("0");
    expect(radios[1].getAttribute("tabindex")).toBe("-1");
  });

  it("an unpicked model reads honest edges (ArrowLeft → LAST, ArrowRight → FIRST)", async () => {
    // R3 pin: the index === -1 branches had no coverage — a plain modulo
    // wrap would send ArrowLeft-from-unpicked to the MIDDLE option
    // ((-1 - 1 + 3) % 3 === 1), not the honest last edge.
    const press = (root: HTMLElement, key: string) =>
      root
        .querySelector<HTMLElement>(".hk-segmented-radio")!
        .dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
    const host = (push: (v: string) => void) =>
      h({
        setup() {
          const value = ref("");
          return () =>
            h(HkSegmentedRadio, {
              label: "Node status",
              options: OPTIONS,
              modelValue: value.value,
              "onUpdate:modelValue": (v: string) => {
                push(v);
                value.value = v;
              },
            });
        },
      });

    // ArrowLeft from unpicked lands on the LAST option.
    const fromLeft: string[] = [];
    const leftRoot = mount(h(host((v) => fromLeft.push(v))));
    press(leftRoot, "ArrowLeft");
    await nextTick();
    expect(fromLeft).toEqual(["all"]);

    // ArrowRight from unpicked lands on the FIRST option.
    const fromRight: string[] = [];
    const rightRoot = mount(h(host((v) => fromRight.push(v))));
    press(rightRoot, "ArrowRight");
    await nextTick();
    expect(fromRight).toEqual(["active"]);
  });

  it("keyboard nav over duplicate-bearing options walks the DEDUPED list", async () => {
    // Delta-review S2 pin: the onGroupKeydown index math must run over
    // dedupedOptions (raw options with duplicates make the honest-edge
    // math land on a NON-rendered occurrence — ArrowLeft-from-unpicked
    // over [A, A2, B] would emit "A" (hidden), not "B" (visually last)).
    const emitted: string[] = [];
    const c = mount(
      h({
        setup() {
          const value = ref("");
          return () =>
            h(HkSegmentedRadio, {
              label: "Node status",
              options: [
                { value: "active", label: "Active only" },
                { value: "active", label: "Active again (dup)" },
                { value: "all", label: "Show all" },
              ],
              modelValue: value.value,
              "onUpdate:modelValue": (v: string) => {
                emitted.push(v);
                value.value = v;
              },
            });
        },
      }),
    );
    const group = c.querySelector<HTMLElement>(".hk-segmented-radio")!;
    group.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }),
    );
    await nextTick();
    expect(emitted).toEqual(["all"], "the last RENDERED segment, not the hidden duplicate");
  });

  it("duplicate option values collapse to one radio (first wins, one tabbable)", () => {
    // R3 pin: the dedupe filter had no coverage — without it a
    // duplicated value renders two aria-checked radios for one value.
    const c = mount(
      h(HkSegmentedRadio, {
        label: "Node status",
        options: [
          { value: "active", label: "Active only" },
          { value: "ended", label: "Ended only" },
          { value: "active", label: "Active again (dup)" },
        ],
        modelValue: "",
      }),
    );
    const radios = [...c.querySelectorAll<HTMLButtonElement>(".hk-segmented-radio-option")];
    // Exactly two segments render — the duplicate "active" is dropped.
    expect(radios.map((r) => r.textContent?.trim())).toEqual(["Active only", "Ended only"]);
    expect(c.querySelectorAll('[data-option="active"]')).toHaveLength(1);
    // And the roving tabindex stays single (unpicked → first segment only).
    expect(radios.filter((r) => r.getAttribute("tabindex") === "0")).toHaveLength(1);
  });
});
