import { afterEach, describe, expect, it } from "vitest";
import { createApp, h } from "vue";

import HkNumberInput from "./HkNumberInput";

/**
 * HkNumberInput's label-association contract (#1206): a bare `label` prop
 * used to render a <label> with NO programmatic association to the field
 * (no `for`, no wrapping), so the number field announced as "spin button"
 * to screen readers. Mirrors HkInput's contract — `for` points at the
 * field id, which is `props.id` when given and a useId() generation
 * otherwise — and follows the repo test convention (raw createApp +
 * document queries, no @vue/test-utils).
 */
const mounts: Array<{ app: ReturnType<typeof createApp>; container: HTMLElement }> = [];

function mountInput(props: Record<string, unknown>): HTMLElement {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const app = createApp({ render: () => h(HkNumberInput, props) });
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

describe("HkNumberInput label association (#1206)", () => {
  it("associates a bare label with the field via for/id", () => {
    const container = mountInput({ label: "Per-phone cap", modelValue: 10 });
    console.log("HTML:", container.innerHTML.slice(0, 300));
    const label = container.querySelector("label.hk-input-label");
    const field = container.querySelector<HTMLInputElement>("input.hk-number-input-field");
    expect(label).not.toBeNull();
    expect(field).not.toBeNull();
    expect(label!.getAttribute("for")).toBe(field!.id);
    expect(field!.id).not.toBe("");
  });

  it("an explicit id prop wins over the generated one", () => {
    const container = mountInput({ label: "Cap", modelValue: 1, id: "cap-field" });
    const label = container.querySelector("label.hk-input-label");
    const field = container.querySelector<HTMLInputElement>("input.hk-number-input-field");
    expect(field!.id).toBe("cap-field");
    expect(label!.getAttribute("for")).toBe("cap-field");
  });

  it("keeps field ids unique among instances of ONE app", () => {
    // useId's counter is PER APP: two separate createApp mounts both start
    // at v-0 (uniqueness is a within-app contract — a real host has one
    // app). Two siblings in the same app must never share an id, or the
    // second label's `for` would point at the FIRST field.
    const container = document.createElement("div");
    document.body.appendChild(container);
    const app = createApp({
      render: () =>
        h("div", [
          h(HkNumberInput, { modelValue: 1, label: "First" }),
          h(HkNumberInput, { modelValue: 2, label: "Second" }),
        ]),
    });
    app.mount(container);
    mounts.push({ app, container });
    const fields = [...container.querySelectorAll<HTMLInputElement>("input.hk-number-input-field")];
    expect(fields).toHaveLength(2);
    const ids = fields.map((f) => f.id);
    expect(new Set(ids).size).toBe(2);
    // Each label's `for` points at ITS OWN field, in document order.
    const labels = [...container.querySelectorAll("label.hk-input-label")];
    expect(labels[0]!.getAttribute("for")).toBe(ids[0]);
    expect(labels[1]!.getAttribute("for")).toBe(ids[1]);
  });
});
