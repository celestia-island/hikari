/**
 * Behavior + source contract for HkInput's number variant (2026-10-30
 * user request via the wowsp overlay settings): a number field used to
 * carry the browser's NATIVE spin buttons — platform-drawn, unthemeable,
 * the tiny up/down stack WebKit paints inside the field's right edge. The
 * box now hides them (SCSS) and hosts the shared lucide stepper column
 * (HkNumberSteppers) instead: pointer stepping runs through the component,
 * keyboard stepping stays native (the field keeps type="number").
 *
 * Pinned guarantees:
 *  1. type="number" AND variant="number" render the steppers + the box
 *     markers (.hk-input-box-number, data-number-steppers); text and
 *     textarea fields render none.
 *  2. The native spin buttons are killed in SCSS under .hk-input-box-number
 *     (-moz-appearance: textfield + the webkit pseudo-elements).
 *  3. Pointer steps parse the STRING model (Number.parseFloat), honor the
 *     min/max/step ATTRS (the same numbers the DOM input receives through
 *     the spread), and emit the string form without float dust.
 *  4. An unparsable draft restarts from the nearest meaningful bound.
 *  5. The steppers' width folds into --hk-input-affix-end-w (suffix +
 *     steppers SUM) so centered text and the marquee clear them.
 *  6. disabled / readonly grey the column out.
 */
import { afterEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createApp, h, nextTick, ref, type Component } from "vue";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import HkInput from "./HkInput";

const here = dirname(fileURLToPath(import.meta.url));
const scss = readFileSync(join(here, "HkInput.scss"), "utf-8");

const mounts: Array<{ app: ReturnType<typeof createApp>; container: HTMLElement }> = [];

interface NumberHarness {
  container: HTMLElement;
  emitted: string[];
  setModel: (v: string) => void;
}

function mountNumber(
  opts: { props?: Record<string, unknown>; slots?: Record<string, Component>; initial?: string } = {},
): NumberHarness {
  const model = ref(opts.initial ?? "60");
  const emitted: string[] = [];
  const container = document.createElement("div");
  document.body.appendChild(container);
  const app = createApp({
    render: () =>
      h(
        HkInput,
        {
          type: "number",
          placeholder: "Hang",
          modelValue: model.value,
          "onUpdate:modelValue": (v: string) => {
            model.value = v;
            emitted.push(v);
          },
          ...opts.props,
        },
        opts.slots ?? {},
      ),
  });
  app.mount(container);
  mounts.push({ app, container });
  return { container, emitted, setModel: (v: string) => { model.value = v; } };
}

function query<T extends HTMLElement = HTMLElement>(container: HTMLElement, selector: string): T | null {
  return container.querySelector<T>(selector);
}

function click(container: HTMLElement, dir: "up" | "down"): void {
  const el = query(container, `.hk-number-input-step-${dir}`);
  expect(el, `${dir} stepper must render`).not.toBeNull();
  el!.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
}

afterEach(() => {
  for (const { app, container } of mounts.splice(0)) {
    app.unmount();
    container.remove();
  }
  document.body.innerHTML = "";
});

describe("HkInput number variant — stepper column", () => {
  it("renders the steppers for type=number and variant=number, none for other types", async () => {
    const typed = mountNumber();
    await nextTick();
    expect(query(typed.container, ".hk-number-input-steppers")).not.toBeNull();
    const box = query(typed.container, ".hk-input-box")!;
    expect(box.classList.contains("hk-input-box-number")).toBe(true);
    expect(box.getAttribute("data-number-steppers")).toBe("true");
    // The field stays native — keyboard stepping and validation untouched.
    expect(query<HTMLInputElement>(typed.container, ".hk-input-element")!.type).toBe("number");

    const variant = mountNumber({ props: { type: "text", variant: "number" }, initial: "3" });
    await nextTick();
    expect(query(variant.container, ".hk-number-input-steppers")).not.toBeNull();

    const text = mountNumber({ props: { type: "text" }, initial: "abc" });
    await nextTick();
    expect(query(text.container, ".hk-number-input-steppers")).toBeNull();
    expect(query(text.container, ".hk-input-box-number")).toBeNull();

    const ta = mountNumber({ props: { type: "textarea" } });
    await nextTick();
    expect(query(ta.container, ".hk-number-input-steppers")).toBeNull();
  });

  it("steps the parsed string model and clears float dust", async () => {
    const harness = mountNumber({ initial: "60" });
    await nextTick();
    click(harness.container, "up");
    await nextTick(); // props (the model) settle before the next parse
    click(harness.container, "down");
    expect(harness.emitted).toEqual(["61", "60"]);

    const dust = mountNumber({ initial: "0.2", props: { step: "0.1" } });
    await nextTick();
    click(dust.container, "up");
    expect(dust.emitted).toEqual(["0.3"]);
  });

  it("honors the min/max/step attrs the DOM input also receives", async () => {
    const harness = mountNumber({ initial: "60", props: { min: "60", max: "240", step: "10" } });
    await nextTick();
    const up = query<HTMLButtonElement>(harness.container, ".hk-number-input-step-up")!;
    const down = query<HTMLButtonElement>(harness.container, ".hk-number-input-step-down")!;
    expect(down.disabled, "at the min bound the down stepper greys out").toBe(true);
    expect(up.disabled).toBe(false);

    click(harness.container, "down");
    expect(harness.emitted, "a dead stepper must not emit").toEqual([]);

    click(harness.container, "up");
    expect(harness.emitted).toEqual(["70"]);

    harness.setModel("240");
    await nextTick();
    expect(up.disabled, "at the max bound the up stepper greys out").toBe(true);
    expect(down.disabled).toBe(false);
  });

  it("restarts an unparsable draft from the nearest meaningful bound", async () => {
    const harness = mountNumber({ initial: "", props: { min: "2", max: "5" } });
    await nextTick();
    click(harness.container, "up");
    expect(harness.emitted).toEqual(["2"]);
    harness.setModel("garbage");
    await nextTick();
    click(harness.container, "down");
    expect(harness.emitted).toEqual(["2", "5"]);
  });

  it("greys the column out while disabled or readonly", async () => {
    const disabled = mountNumber({ props: { disabled: true } });
    await nextTick();
    expect(query<HTMLButtonElement>(disabled.container, ".hk-number-input-step-up")!.disabled).toBe(true);
    expect(query<HTMLButtonElement>(disabled.container, ".hk-number-input-step-down")!.disabled).toBe(true);

    const readonly = mountNumber({ props: { readonly: true } });
    await nextTick();
    expect(query<HTMLButtonElement>(readonly.container, ".hk-number-input-step-up")!.disabled).toBe(true);
  });

  it("folds the stepper width into the end-side affix reservation", async () => {
    const receiver = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetWidth");
    expect(receiver, "offsetWidth accessor exists on HTMLElement").toBeTruthy();
    Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
      configurable: true,
      get: () => 96,
    });
    try {
      // suffix slot (96) + steppers column (96) — the end var is the SUM.
      const both = mountNumber({ slots: { suffix: () => h("span", "px") } });
      await nextTick();
      const box = query(both.container, ".hk-input-box")!;
      expect(box.style.getPropertyValue("--hk-input-affix-end-w")).toBe("192px");

      const steppersOnly = mountNumber();
      await nextTick();
      expect(
        query(steppersOnly.container, ".hk-input-box")!.style.getPropertyValue("--hk-input-affix-end-w"),
      ).toBe("96px");
    } finally {
      if (receiver) {
        Object.defineProperty(HTMLElement.prototype, "offsetWidth", receiver);
      }
    }
  });
});

describe("HkInput number variant — SCSS contract", () => {
  it("kills the native spin buttons under the number box", () => {
    const rule = scss.match(/\.hk-input-box-number \.hk-input-element\s*{[^}]*}/)?.[0] ?? "";
    expect(rule, "number element rule must exist").toContain("-moz-appearance: textfield");
    expect(rule).toContain("::-webkit-inner-spin-button");
    expect(rule).toContain("::-webkit-outer-spin-button");
    expect(rule).toContain("-webkit-appearance: none");
    expect(rule).toContain("margin: 0");
  });

  it("parks the suffix next to the steppers via the box marker", () => {
    const rule =
      scss.match(
        /\.hk-input-box\[data-number-steppers\] \.hk-input-affix\.hk-input-suffix\s*{[^}]*}/,
      )?.[0] ?? "";
    expect(rule, "suffix park rule must exist").toContain("margin-inline-start: 0");

    const column = scss.match(/\.hk-input-box \.hk-number-input-steppers\s*{[^}]*}/)?.[0] ?? "";
    expect(column, "stepper column context rule must exist").toContain("margin-inline-start: auto");
    expect(column).toContain("z-index: 1");
  });
});
