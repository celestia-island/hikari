/**
 * Source + behavior contract for HkNumberInput affixes (2026-09-08
 * user report via shittim-chest: a "seconds" unit placed as an EXTERNAL
 * sibling span next to a labeled HkNumberInput centered against the
 * root (label row + input), so it sat ABOVE the input box's center
 * axis). The affixes must ride INSIDE the field, and the component now
 * also accepts plain `prefix`/`suffix` string props so consumers never
 * need the external-span pattern again.
 *
 * Pinned guarantees:
 *  1. The affix spans are flex items of the inner row with
 *     align-items: center — the unit text shares the input box's
 *     vertical axis, regardless of the label row above.
 *  2. The inner row order is prefix → input → suffix → steppers, so an
 *     affix always sits between the typed value and the stepper
 *     column (never outside the bordered field).
 *  3. Slots take precedence over the string props; absent both, no
 *     affix span renders (no stray padding).
 */
import { afterEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createApp, h, type Component } from "vue";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import HkNumberInput from "./HkNumberInput";

const here = dirname(fileURLToPath(import.meta.url));
const scss = readFileSync(join(here, "HkNumberInput.scss"), "utf-8");

const mounts: Array<{ app: ReturnType<typeof createApp>; container: HTMLElement }> = [];

function mountNumberInput(
  opts: { slots?: Record<string, Component>; props?: Record<string, unknown> } = {},
) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const app = createApp({
    render: () =>
      h(HkNumberInput, { modelValue: 3, ...opts.props }, opts.slots ?? {}),
  });
  app.mount(container);
  mounts.push({ app, container });
  return { container };
}

function query(container: HTMLElement, selector: string): Element | null {
  return container.querySelector(selector);
}

afterEach(() => {
  for (const { app, container } of mounts.splice(0)) {
    app.unmount();
    container.remove();
  }
  document.body.innerHTML = "";
});

describe("HkNumberInput affix contract", () => {
  it("centers the affix spans on the input box axis (SCSS contract)", () => {
    const rule =
      scss.match(/\.hk-number-input-prefix,\s*\.hk-number-input-suffix\s*{[^}]*}/)?.[0] ?? "";
    expect(rule, "affix rule must exist").toContain("align-items: center");
    expect(rule).toContain("flex-shrink: 0");
  });

  it("stretches the stepper column so height:50% steps and the divider span the box", () => {
    const rule = scss.match(/\.hk-number-input-steppers\s*{[^}]*}/)?.[0] ?? "";
    expect(rule, "steppers rule must exist").toContain("align-self: stretch");
    const steps = scss.match(/\.hk-number-input-step\s*{[^}]*}/)?.[0] ?? "";
    expect(steps).toContain("height: 50%");
  });

  it("self-declares border-box so per-size heights survive hosts without a reset", () => {
    const field = scss.match(/\.hk-number-input-field\s*{[^}]*}/)?.[0] ?? "";
    expect(field, "field rule must exist").toContain("box-sizing: border-box");
  });

  it("keeps the affix font size equal to the field font size in every size variant", () => {
    for (const size of ["sm", "md", "lg"] as const) {
      const field = scss.match(
        new RegExp(`\\.hk-number-input-${size} \\.hk-number-input-field\\s*{[^}]*}`),
      )?.[0];
      expect(field, `${size} field rule must exist`).toBeTruthy();
      const fieldSize = field?.match(/font-size:\s*([^;]+);/)?.[1]?.trim();
      const affix = scss.match(
        new RegExp(
          `\\.hk-number-input-${size} \\.hk-number-input-(?:prefix|suffix),[\\s\\S]*?{[^}]*}`,
        ),
      )?.[0];
      expect(affix, `${size} affix rule must exist`).toBeTruthy();
      expect(affix?.match(/font-size:\s*([^;]+);/)?.[1]?.trim()).toBe(fieldSize);
    }
  });

  it("renders the suffix string prop inside the field, before the steppers", () => {
    const { container } = mountNumberInput({ props: { suffix: "秒" } });
    const suffix = query(container, ".hk-number-input-suffix");
    expect(suffix, "suffix span must render").not.toBeNull();
    expect(suffix?.textContent).toBe("秒");

    const inner = query(container, ".hk-number-input-inner");
    const children = Array.from(inner?.children ?? []).map((el) => el.className);
    expect(children).toEqual([
      "hk-number-input-field",
      "hk-number-input-suffix",
      "hk-number-input-steppers",
    ]);
  });

  it("renders the prefix string prop inside the field, before the input", () => {
    const { container } = mountNumberInput({ props: { prefix: "PT" } });
    const prefix = query(container, ".hk-number-input-prefix");
    expect(prefix, "prefix span must render").not.toBeNull();
    expect(prefix?.textContent).toBe("PT");
    const children = Array.from(
      query(container, ".hk-number-input-inner")?.children ?? [],
    ).map((el) => el.className);
    expect(children[0]).toBe("hk-number-input-prefix");
  });

  it("prefers the named slot over the string prop", () => {
    const { container } = mountNumberInput({
      props: { suffix: "prop-text" },
      slots: { suffix: () => h("span", { class: "slot-marker" }, "slot-text") },
    });
    const suffix = query(container, ".hk-number-input-suffix");
    expect(suffix?.textContent).toBe("slot-text");
    expect(suffix?.querySelector(".slot-marker")).not.toBeNull();
    expect(suffix?.textContent).not.toContain("prop-text");
  });

  it("treats an empty-string affix prop as no affix", () => {
    const { container } = mountNumberInput({ props: { prefix: "", suffix: "" } });
    expect(query(container, ".hk-number-input-prefix")).toBeNull();
    expect(query(container, ".hk-number-input-suffix")).toBeNull();
  });

  it("renders no affix spans without props or slots", () => {
    const { container } = mountNumberInput({});
    expect(query(container, ".hk-number-input-prefix")).toBeNull();
    expect(query(container, ".hk-number-input-suffix")).toBeNull();
  });

  it("still renders the field caption label above the box", () => {
    const { container } = mountNumberInput({ props: { label: "轮播间隔" } });
    const label = query(container, ".hk-input-label");
    expect(label, "label must render").not.toBeNull();
    expect(label?.textContent).toBe("轮播间隔");
  });
});
