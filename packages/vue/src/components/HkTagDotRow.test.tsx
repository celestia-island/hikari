import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent } from "vue";

import HkTagDotRow, { type HkTagDot } from "./HkTagDotRow";

/** Mount into a detached div appended to the body — the family's
 *  mount pattern (assertions go through document.querySelectorAll). */
function mountRow(tags: HkTagDot[], onToggle: (key: string) => void, label?: string): void {
  const el = document.createElement("div");
  document.body.appendChild(el);
  createApp(
    defineComponent({
      name: "TagDotRowHost",
      setup() {
        return () => <HkTagDotRow tags={tags} label={label} onToggle={onToggle} />;
      },
    }),
  ).mount(el);
}

const dots = () =>
  Array.from(document.querySelectorAll(".hk-tag-dot")) as HTMLButtonElement[];

const dotByAria = (name: string) =>
  dots().find((b) => b.getAttribute("aria-label") === name);

afterEach(() => {
  dots().forEach((b) => b.remove());
  document.querySelectorAll(".hk-tag-dot-row").forEach((el) => el.remove());
});

describe("HkTagDotRow", () => {
  it("renders one toggle per tag: dot ink, caption, pressed state", () => {
    mountRow(
      [
        { key: "red", color: "#e5484d", label: "Red" },
        { key: "yellow", color: "#ffd400", active: true },
        { key: "purple", color: "#a855f7" },
      ],
      () => {},
      "Tags",
    );
    const row = document.querySelector(".hk-tag-dot-row")!;
    expect(row.getAttribute("role")).toBe("group");
    expect(row.getAttribute("aria-label")).toBe("Tags");

    expect(dots()).toHaveLength(3);
    // Dot ink rides the per-tag custom property on the dot itself…
    const red = dotByAria("Red")!;
    const redDot = red.querySelector(".hk-tag-dot__dot") as HTMLElement;
    expect(redDot.style.getPropertyValue("--hk-tag-color")).toBe("#e5484d");
    expect(red.querySelector(".hk-tag-dot__label")?.textContent).toBe("Red");
    expect(red.getAttribute("aria-pressed")).toBe("false");
    expect(red.hasAttribute("data-active")).toBe(false);

    // …the applied tag carries the selected face and pressed state.
    const yellow = dotByAria("yellow")!;
    expect(yellow.getAttribute("aria-pressed")).toBe("true");
    expect(yellow.hasAttribute("data-active")).toBe(true);
    // A labelless tag falls back to its key for the accessible name
    // and renders no caption span.
    expect(yellow.querySelector(".hk-tag-dot__label")).toBeNull();
  });

  it("emits toggle with the tag key on click", () => {
    const toggled: string[] = [];
    mountRow(
      [
        { key: "red", color: "#e5484d", label: "Red" },
        { key: "purple", color: "#a855f7", label: "Purple" },
      ],
      (key) => toggled.push(key),
    );
    dotByAria("Red")!.click();
    dotByAria("Purple")!.click();
    expect(toggled).toEqual(["red", "purple"]);
  });

  it("keeps a disabled tag inert", () => {
    const toggled = vi.fn();
    mountRow(
      [
        { key: "red", color: "#e5484d", label: "Red", disabled: true },
        { key: "purple", color: "#a855f7", label: "Purple" },
      ],
      toggled,
    );
    const red = dotByAria("Red")!;
    expect(red.disabled).toBe(true);
    red.click(); // happy-dom honors disabled on click dispatch
    expect(toggled).not.toHaveBeenCalled();
    dotByAria("Purple")!.click();
    expect(toggled).toHaveBeenCalledWith("purple");
  });
});
