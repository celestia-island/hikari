import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h, ref } from "vue";

import HkHeaderPicker, { type HkPickerOption } from "./HkHeaderPicker";

/**
 * HkHeaderPicker — the header-centre selector (the button group's
 * sibling). These pins hold the standardized contract: trigger chrome,
 * selection, and the per-row verbs (rename / delete / reorder) that
 * "manage a dynamic set" pages hang on this one component. (Repo test
 * convention: raw createApp + container queries; the panel teleports
 * to body, so row queries go through document.)
 */

const OPTIONS: HkPickerOption[] = [
  { value: "hub-1", label: "Hub One", editable: true, removable: true },
  { value: "hub-2", label: "Hub Two", removable: true, locked: true },
  { value: "hub-3", label: "Hub Three" },
];

const mounts: Array<{ app: ReturnType<typeof createApp>; container: HTMLElement }> = [];

function mountPicker(overrides: Record<string, unknown>, handlers: Record<string, unknown> = {}) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const Host = defineComponent({
    setup() {
      const model = ref((overrides.modelValue as string) ?? "hub-1");
      return () =>
        h(HkHeaderPicker, {
          modelValue: model.value,
          "onUpdate:modelValue": (v: string) => {
            model.value = v;
            (handlers.onUpdateModelValue as ((v: string) => void) | undefined)?.(v);
          },
          options: OPTIONS,
          panelTitle: "Pick a hub",
          ariaLabel: "Hub picker",
          ...overrides,
          ...handlers,
        });
    },
  });
  const app = createApp({ render: () => h(Host) });
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

describe("HkHeaderPicker", () => {
  it("renders the family dropdown trigger reading the current choice", () => {
    const c = mountPicker({}, {});
    const trigger = c.querySelector("button.hk-select-trigger")!;
    expect(trigger, "family trigger chrome must render").not.toBeNull();
    expect(trigger.className).toContain("hk-header-picker-trigger");
    expect(trigger.textContent).toContain("Hub One");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });

  it("opens the panel on trigger click and selects a row", async () => {
    const selected: string[] = [];
    const c = mountPicker({}, { onUpdateModelValue: (v: string) => selected.push(v) });
    (c.querySelector("button.hk-select-trigger") as HTMLElement).click();
    await vi.waitFor(() => {
      expect(document.querySelectorAll(".hk-header-picker-option").length).toBe(3);
    });
    const rows = Array.from(document.querySelectorAll(".hk-header-picker-option"));
    (rows[2] as HTMLElement).click();
    expect(selected).toEqual(["hub-3"]);
  });

  it("emits edit and remove for the standardized row verbs without selecting", async () => {
    const onEdit = vi.fn();
    const onRemove = vi.fn();
    const selected: string[] = [];
    const c = mountPicker({}, {
      onEdit,
      onRemove,
      onUpdateModelValue: (v: string) => selected.push(v),
    });
    (c.querySelector("button.hk-select-trigger") as HTMLElement).click();
    await vi.waitFor(() => {
      expect(document.querySelectorAll(".hk-header-picker-option").length).toBe(3);
    });
    const rows = Array.from(document.querySelectorAll(".hk-header-picker-option"));
    // Row 0 carries BOTH verbs (editable + removable); row 1 only remove;
    // row 2 declares neither flag — no verbs at all.
    const editBtn = rows[0].querySelector('button[aria-label="Rename"]');
    const removeBtn0 = rows[0].querySelector('button[aria-label="Delete"]');
    const removeBtn1 = rows[1].querySelector('button[aria-label="Delete"]');
    expect(editBtn).not.toBeNull();
    expect(removeBtn0).not.toBeNull();
    expect(removeBtn1).not.toBeNull();
    expect(rows[2].querySelector('button[aria-label="Delete"]')).toBeNull();
    (editBtn as HTMLElement).click();
    (removeBtn1 as HTMLElement).click();
    expect(onEdit).toHaveBeenCalledWith("hub-1");
    expect(onRemove).toHaveBeenCalledWith("hub-2");
    // A verb press must NOT double as a row selection.
    expect(selected).toEqual([]);
  });

  it("mounts the rows on a draggable list when reorderable", async () => {
    const onReorder = vi.fn();
    const c = mountPicker({ reorderable: true }, { onReorder });
    (c.querySelector("button.hk-select-trigger") as HTMLElement).click();
    await vi.waitFor(() => {
      expect(document.querySelector(".hk-draggable-list")).not.toBeNull();
    });
    // The locked row (hub-2) marks its grip data-hidden (lane reserved)
    // while the other two rows keep draggable grips.
    const grips = document.querySelectorAll(".hk-draggable-list-handle");
    expect(grips.length).toBe(3);
    expect(document.querySelectorAll('.hk-draggable-list-handle[data-hidden]').length).toBe(1);
  });

  it("declares the placement prop with the top-down default (mirror-of-bottom contract)", () => {
    // The panel is teleported to body, so the through-wiring is pinned at
    // the contract level: the prop exists, defaults to the header's
    // downward growth, and the render passes it straight through
    // (`placement={props.placement}` in HkHeaderPicker.tsx).
    expect(HkHeaderPicker.props!.placement).toBeDefined();
    expect((HkHeaderPicker.props!.placement as { default: string }).default).toBe("bottom-start");
  });

  it("disables the trigger when disabled", () => {
    const c = mountPicker({ disabled: true }, {});
    expect(
      (c.querySelector("button.hk-select-trigger") as HTMLButtonElement).disabled,
    ).toBe(true);
  });
});
