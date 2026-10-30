import { afterEach, describe, expect, it } from "vitest";
import { createApp, h } from "vue";

import HkMenuSection from "./HkMenuSection";

/**
 * HkMenuSection contract tests:
 *
 * - GROUP: the wrapper is `role="group"` named by the `label` prop (the
 *   HkTemplateField a11y precedent), so a captioned row run is announced
 *   as one named group inside a menu surface.
 * - CAPTION: the visible band carries the label text, is `aria-hidden`
 *   (the wrapper already announced the name) and uses the grammar's
 *   class names — the global adopter rules in styles/admin-tokens style
 *   them, the component imports no scss.
 * - SLOT OVERRIDE: the `label` slot replaces the visible text while the
 *   accessible name stays the `label` prop.
 * - ROWS: the default slot renders inside the group, after the caption.
 */

const mounts: Array<{ app: ReturnType<typeof createApp>; container: HTMLElement }> = [];

function mount(render: () => unknown): HTMLElement {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const app = createApp({ render });
  app.mount(container);
  mounts.push({ app, container });
  return container;
}

afterEach(() => {
  for (const { app, container } of mounts) {
    app.unmount();
    container.remove();
  }
  mounts.length = 0;
});

describe("HkMenuSection", () => {
  it("renders a role=group named by label, with a visible aria-hidden caption", () => {
    const c = mount(() => h(HkMenuSection, { label: "Temp spaces" }));

    const group = c.querySelector<HTMLElement>(".hk-menu-section");
    expect(group, ".hk-menu-section renders").toBeTruthy();
    expect(group!.getAttribute("role")).toBe("group");
    expect(group!.getAttribute("aria-label")).toBe("Temp spaces");

    const caption = group!.querySelector<HTMLElement>(".hk-menu-section-label");
    expect(caption, "the visible caption band renders").toBeTruthy();
    expect(caption!.textContent).toBe("Temp spaces");
    // The band repeats the wrapper's accessible name visually only.
    expect(caption!.getAttribute("aria-hidden")).toBe("true");
    // It is the group's first child: caption above the rows.
    expect(group!.firstElementChild).toBe(caption);
  });

  it("keeps the accessible name on the label prop when the label slot overrides the band", () => {
    const c = mount(() =>
      h(
        HkMenuSection,
        { label: "Temp spaces" },
        {
          label: () => [h("span", { class: "section-count" }, "3")],
          default: () => [
            h("button", { type: "button", class: "hk-menu-action-item" }, "Scratch"),
          ],
        },
      ),
    );

    const group = c.querySelector<HTMLElement>(".hk-menu-section")!;
    // Rich visible content never changes the announced group name.
    expect(group.getAttribute("aria-label")).toBe("Temp spaces");
    const caption = group.querySelector<HTMLElement>(".hk-menu-section-label")!;
    expect(caption.textContent).toBe("3");
    expect(caption.querySelector(".section-count")).toBeTruthy();
    expect(caption.getAttribute("aria-hidden")).toBe("true");
  });

  it("renders the default slot's rows inside the group, after the caption", () => {
    const c = mount(() =>
      h(
        HkMenuSection,
        { label: "Temp spaces" },
        {
          default: () => [
            h("button", { type: "button", class: "hk-menu-action-item" }, "Scratch"),
            h("button", { type: "button", class: "hk-menu-action-item" }, "Long-term"),
          ],
        },
      ),
    );

    const group = c.querySelector<HTMLElement>(".hk-menu-section")!;
    const rows = group.querySelectorAll(".hk-menu-action-item");
    expect(Array.from(rows).map((row) => row.textContent)).toEqual(["Scratch", "Long-term"]);
    // caption + the two rows, in that ORDER (rows must never precede the
    // band that names them).
    expect(group.children).toHaveLength(3);
    expect(group.querySelector(".hk-menu-section-label")!.nextElementSibling).toBe(rows[0]);
  });
});
