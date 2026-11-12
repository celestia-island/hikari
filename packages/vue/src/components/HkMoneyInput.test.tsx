// AI-generated: developed with the DeepSeek Harness agent (model DeepSeek V4.1 Flash); human-directed.
/**
 * HkMoneyInput — behavior, a11y and source/style contract.
 *
 * The regression this suite exists for (called out in the component doc):
 * a controlled amount field that rewrites the element from a parsed model on
 * every keystroke turns a typed `1.5` into `5` — the model's canonical form
 * replaces the text under the caret. So the central test is typed-keystroke
 * fidelity: after every keystroke the ELEMENT must still hold exactly what
 * the user typed, while `update:modelValue` carries canonical text
 * (digits + at most one dot, no grouping, no symbol).
 *
 * Pinned guarantees:
 *  1. `type="text"` + `inputmode="decimal"` (never `type="number"`, whose
 *     browser-side rewriting is the bug class) and the currency symbol rides
 *     INSIDE the field as a decorative affix.
 *  2. Typing never coerces the DOM: the draft stays byte-identical while the
 *     event chain runs; garbage input never clears the host model.
 *  3. Blur formats (grouped, fixed precision), focus de-formats back to
 *     canonical text, and both are the only text transforms.
 *  4. `""` is a first-class value ("unset / follow") — never `0`.
 *  5. External model writes land only while the field is UNFOCUSED.
 *  6. `min` / `max` report the localized range message, never clamp.
 *  7. a11y: label association, `aria-invalid`, `aria-describedby` wiring.
 *  8. Contract: no `type="number"` in the source, tabular figures and no
 *     borrowed `hk-input-*` classes in its sheet.
 */
import { afterEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createApp, h, nextTick, ref } from "vue";

import HkMoneyInput from "./HkMoneyInput";
import type { HkCurrency } from "../utils/currency";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, "HkMoneyInput.tsx"), "utf-8");
const scss = readFileSync(join(here, "HkMoneyInput.scss"), "utf-8");

const USD: HkCurrency = { code: "USD", symbol: "$", name: "US Dollar", decimals: 2 };
const JPY: HkCurrency = { code: "JPY", symbol: "¥", name: "Japanese Yen", decimals: 0 };

const mounts: Array<{ app: ReturnType<typeof createApp>; container: HTMLElement }> = [];

afterEach(() => {
  for (const { app, container } of mounts.splice(0)) {
    app.unmount();
    container.remove();
  }
});

interface Harness {
  container: HTMLElement;
  input: HTMLInputElement;
  emitted: string[];
  model: { value: string };
  setModel: (v: string) => void;
}

function mount(opts: { props?: Record<string, unknown>; model?: string } = {}): Harness {
  const model = ref(opts.model ?? "");
  const emitted: string[] = [];
  const container = document.createElement("div");
  document.body.appendChild(container);
  const app = createApp({
    render: () =>
      h(HkMoneyInput, {
        modelValue: model.value,
        "onUpdate:modelValue": (v: string) => {
          model.value = v;
          emitted.push(v);
        },
        ...opts.props,
      }),
  });
  app.mount(container);
  mounts.push({ app, container });
  const input = container.querySelector<HTMLInputElement>(".hk-money-input-field");
  expect(input, "the money field renders an input").not.toBeNull();
  return {
    container,
    input: input!,
    emitted,
    model,
    setModel: (v: string) => {
      model.value = v;
    },
  };
}

/** A real keystroke: the browser has already written the new text, then the
 *  input event fires. */
async function type(input: HTMLInputElement, value: string): Promise<void> {
  input.value = value;
  input.dispatchEvent(new Event("input"));
  await nextTick();
}

async function focus(input: HTMLInputElement): Promise<void> {
  input.dispatchEvent(new Event("focus"));
  await nextTick();
}

async function blur(input: HTMLInputElement): Promise<void> {
  input.dispatchEvent(new Event("blur"));
  await nextTick();
}

describe("HkMoneyInput field shape", () => {
  it("is a decimal text field, never a number input", () => {
    const { input } = mount({ props: { currency: USD } });
    expect(input.type).toBe("text");
    expect(input.getAttribute("inputmode")).toBe("decimal");
    expect(input.getAttribute("spellcheck")).toBe("false");
  });

  it("puts the currency symbol inside the field", () => {
    const { container } = mount({ props: { currency: USD } });
    const affix = container.querySelector(".hk-money-input-prefix");
    expect(affix, "the symbol affix renders").not.toBeNull();
    expect(affix!.textContent).toBe("$");
    // Decorative only: a screen reader reads the label + value, not "$".
    expect(affix!.getAttribute("aria-hidden")).toBe("true");
  });

  it("falls back to the currency code when there is no symbol", () => {
    const { container } = mount({ props: { currency: { code: "eur", decimals: 2 } } });
    expect(container.querySelector(".hk-money-input-prefix")!.textContent).toBe("EUR");
  });

  it("renders no affix without a currency", () => {
    const { container } = mount();
    expect(container.querySelector(".hk-money-input-affix")).toBeNull();
  });

  it("honors the size step, required flag and disabled state", () => {
    const { container, input } = mount({
      props: { size: "lg", required: true, disabled: true, label: "Unit price" },
    });
    expect(container.querySelector(".hk-money-input")!.getAttribute("data-size")).toBe("lg");
    expect(input.disabled).toBe(true);
    expect(input.required).toBe(true);
    expect(container.querySelector(".hk-money-input-required")).not.toBeNull();
  });
});

describe("HkMoneyInput typing fidelity (the 1.5 → 5 regression)", () => {
  it("never rewrites the DOM mid-typing while emitting canonical text", async () => {
    const { input, emitted } = mount();
    await focus(input);

    await type(input, "1");
    expect(input.value, "the element keeps the typed text").toBe("1");
    await type(input, "1.");
    // The parser canonicalizes "1." to "1", but the ELEMENT must stay "1."
    // or the next keystroke lands in the wrong place.
    expect(input.value, "a trailing dot is never stripped under the caret").toBe("1.");
    await type(input, "1.5");
    expect(input.value, "the full draft survives").toBe("1.5");

    expect(emitted, "the model carries canonical text").toEqual(["1", "1.5"]);
  });

  it("keeps a multi-digit amount intact keystroke by keystroke", async () => {
    const { input, emitted } = mount();
    await focus(input);
    for (const value of ["1", "12", "123", "1234", "1234.", "1234.5", "1234.56"]) {
      await type(input, value);
      expect(input.value).toBe(value);
    }
    expect(emitted[emitted.length - 1]).toBe("1234.56");
    expect(emitted.every((v) => v === "" || !v.includes(",")), "no grouping in the model").toBe(true);
  });

  it("normalizes pasted grouping and a comma decimal mark in the MODEL only", async () => {
    const { input, emitted } = mount();
    await focus(input);
    await type(input, "1,234.5");
    expect(input.value, "the pasted text is left alone").toBe("1,234.5");
    expect(emitted[emitted.length - 1]).toBe("1234.5");

    const second = mount();
    await focus(second.input);
    await type(second.input, "1.234,5");
    expect(second.emitted[second.emitted.length - 1]).toBe("1234.5");
  });

  it("never clears the host model on garbage input", async () => {
    const { input, emitted, model } = mount({ model: "12" });
    await focus(input);
    await type(input, "12abc");
    expect(input.value).toBe("12abc");
    expect(emitted, "no canonical text can be derived").toEqual([]);
    expect(model.value, "the last good model survives").toBe("12");
  });

  it("treats the empty string as unset, not zero", async () => {
    const { input, emitted } = mount({ model: "12" });
    await focus(input);
    await type(input, "");
    expect(emitted).toEqual([""]);
    await blur(input);
    expect(input.value, "an empty field stays empty after blur").toBe("");
    expect(emitted[emitted.length - 1]).toBe("");
  });
});

describe("HkMoneyInput formatOnBlur / deformOnFocus", () => {
  it("formats the amount on blur and de-formats on the next focus", async () => {
    const { input, emitted } = mount({ props: { currency: USD } });
    await focus(input);
    await type(input, "1234.5");
    await blur(input);
    expect(input.value, "blur groups and applies the currency precision").toBe("1,234.50");

    await focus(input);
    expect(input.value, "focus hands back canonical text for editing").toBe("1234.5");
    expect(emitted[emitted.length - 1], "focus does not emit").toBe("1234.5");
  });

  it("normalizes a prettified host model on blur (idempotent model)", async () => {
    const { input, emitted } = mount({ model: "1234.50", props: { currency: USD } });
    expect(input.value).toBe("1,234.50");
    await focus(input);
    await blur(input);
    expect(emitted[emitted.length - 1]).toBe("1234.5");
  });

  it("uses the currency's minor-unit digits by default", async () => {
    const { input } = mount({ model: "1234.5", props: { currency: JPY } });
    expect(input.value).toBe("1,235");
  });

  it("honors a higher maxDecimals for per-million rates", async () => {
    const rate = mount({ props: { currency: JPY, maxDecimals: 4 } });
    await focus(rate.input);
    await type(rate.input, "0.00012");
    await blur(rate.input);
    expect(rate.input.value).toBe("0.0001");
    expect(rate.emitted[rate.emitted.length - 1]).toBe("0.0001");

    const precise = mount({ props: { currency: USD, maxDecimals: 4 } });
    await focus(precise.input);
    await type(precise.input, "1.23456");
    await blur(precise.input);
    expect(precise.input.value, "a 4-digit budget rounds, not truncates").toBe("1.2346");
    expect(precise.emitted[precise.emitted.length - 1]).toBe("1.2346");
  });

  it("renders negative amounts with the sign preserved", async () => {
    const { input } = mount();
    await focus(input);
    await type(input, "-2.5");
    await blur(input);
    expect(input.value).toBe("-2.50");
  });
});

describe("HkMoneyInput external model writes", () => {
  it("follows an external model while unfocused (formatted)", async () => {
    const { container, input, setModel } = mount({ props: { currency: USD } });
    setModel("99");
    await nextTick();
    expect(input.value).toBe("99.00");
    expect(container.querySelector(".hk-money-input-box")).not.toBeNull();
  });

  it("never overwrites the caret from an external write while focused", async () => {
    const { input, setModel } = mount({ props: { currency: USD } });
    await focus(input);
    await type(input, "1.");
    setModel("500");
    await nextTick();
    expect(input.value, "a host rerender must not rewrite the focused draft").toBe("1.");
  });
});

describe("HkMoneyInput min / max reporting", () => {
  it("reports below-min without clamping the value", async () => {
    const { container, input, emitted } = mount({ props: { min: 10, currency: USD } });
    await focus(input);
    await type(input, "5");
    await blur(input);
    const error = container.querySelector(".hk-money-input-error");
    expect(error, "the range message renders").not.toBeNull();
    expect(error!.textContent).toContain("10.00");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.getAttribute("aria-describedby")).toBe(error!.id);
    // Never clamps: the host decides what an out-of-range amount means.
    expect(emitted[emitted.length - 1]).toBe("5");
  });

  it("reports above-max and clears the message once in range", async () => {
    const { container, input } = mount({ props: { max: 100, currency: USD } });
    await focus(input);
    await type(input, "500");
    await blur(input);
    expect(container.querySelector(".hk-money-input-error")!.textContent).toContain("100.00");

    await focus(input);
    await type(input, "50");
    await blur(input);
    expect(container.querySelector(".hk-money-input-error")).toBeNull();
  });

  it("reports an unparsable draft on blur and keeps the typed text", async () => {
    const { container, input } = mount();
    await focus(input);
    await type(input, "12abc");
    await blur(input);
    expect(input.value, "the invalid draft is never rewritten").toBe("12abc");
    expect(container.querySelector(".hk-money-input-error")).not.toBeNull();
    expect(input.getAttribute("aria-invalid")).toBe("true");
  });
});

describe("HkMoneyInput error + a11y wiring", () => {
  it("associates the label with the field without caller effort", () => {
    const { container, input } = mount({ props: { label: "Unit price" } });
    const label = container.querySelector("label")!;
    expect(label.getAttribute("for")).toBe(input.id);
    expect(input.id).not.toBe("");
  });

  it("generates unique ids for sibling fields", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const app = createApp({
      render: () => [
        h(HkMoneyInput, { modelValue: "", label: "One" }),
        h(HkMoneyInput, { modelValue: "", label: "Two" }),
      ],
    });
    app.mount(container);
    mounts.push({ app, container });
    const inputs = [...container.querySelectorAll<HTMLInputElement>(".hk-money-input-field")];
    expect(inputs).toHaveLength(2);
    expect(inputs[0].id).not.toBe(inputs[1].id);
  });

  it("surfaces the host error through aria-invalid + aria-describedby", () => {
    const { container, input } = mount({ props: { label: "Unit price", error: "Required" } });
    const error = container.querySelector(".hk-money-input-error")!;
    expect(error.textContent).toBe("Required");
    expect(error.getAttribute("role")).toBe("alert");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.getAttribute("aria-describedby")).toBe(error.id);
    expect(input.id).not.toBe(error.id);
  });

  it("stays clean (no aria-invalid) without an error", () => {
    const { input } = mount({ props: { label: "Unit price" } });
    expect(input.getAttribute("aria-invalid")).toBeNull();
    expect(input.getAttribute("aria-describedby")).toBeNull();
  });

  it("marks a provided aria-label through the attribute spread", () => {
    const { input } = mount({ props: { "aria-label": "Amount per million" } });
    expect(input.getAttribute("aria-label")).toBe("Amount per million");
  });

  it("accepts an explicit id", () => {
    const { container, input } = mount({ props: { id: "price-field", label: "Price" } });
    expect(input.id).toBe("price-field");
    expect(container.querySelector("label")!.getAttribute("for")).toBe("price-field");
  });
});

describe("HkMoneyInput source + sheet contract", () => {
  it("never instantiates a native number input", () => {
    expect(source).not.toContain('type="number"');
    expect(source).toContain('inputmode="decimal"');
  });

  it("ships its own field chrome instead of borrowing HkInput classes", () => {
    expect(scss).not.toMatch(/\.hk-input-/);
    expect(source).not.toMatch(/hk-input-/);
    expect(scss).toContain(".hk-money-input-box");
    expect(scss).toContain(".hk-money-input-error");
  });

  it("keeps amounts tabular so columns of figures line up", () => {
    expect(scss).toContain("font-variant-numeric: tabular-nums");
  });
});
