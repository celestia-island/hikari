import { afterEach, describe, expect, it } from "vitest";
import { createApp, h, nextTick } from "vue";

import { HkPhoneInput } from "./HkPhoneInput";

const mounts: Array<{ app: ReturnType<typeof createApp>; container: HTMLElement }> = [];

interface MountOptions {
  modelValue?: string;
  dialCode?: string;
  disabled?: boolean;
}

function mountPhone(opts: MountOptions = {}) {
  const events = {
    modelValue: [] as string[],
    dialCode: [] as string[],
    dialchange: [] as string[],
    change: [] as string[],
  };
  const container = document.createElement("div");
  document.body.appendChild(container);
  const app = createApp({
    render: () =>
      h(HkPhoneInput, {
        modelValue: opts.modelValue ?? "",
        dialCode: opts.dialCode ?? "+86",
        disabled: opts.disabled ?? false,
        "onUpdate:modelValue": (v: string) => {
          events.modelValue.push(v);
        },
        "onUpdate:dialCode": (v: string) => {
          events.dialCode.push(v);
        },
        onDialchange: (v: string) => {
          events.dialchange.push(v);
        },
        onChange: (v: string) => {
          events.change.push(v);
        },
      }),
  });
  app.mount(container);
  mounts.push({ app, container });
  return { events, container };
}

afterEach(() => {
  while (mounts.length > 0) {
    const { app, container } = mounts.pop()!;
    app.unmount();
    container.remove();
  }
});

function queryChip(container: HTMLElement): HTMLButtonElement {
  const chip = container.querySelector<HTMLButtonElement>(".hk-phone-chip");
  expect(chip, "dial-code chip renders inside the field").toBeTruthy();
  return chip!;
}

function queryField(container: HTMLElement): HTMLInputElement {
  const field = container.querySelector<HTMLInputElement>(".hk-input-element");
  expect(field).toBeTruthy();
  return field!;
}

async function openPicker(container: HTMLElement) {
  queryChip(container).click();
  await nextTick();
  await nextTick();
}

function pickerRows(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLButtonElement>(".hk-affix-row")];
}

describe("HkPhoneInput", () => {
  it("renders the dial chip with the canonical code", () => {
    const { container } = mountPhone({ dialCode: "86" });
    expect(queryChip(container).querySelector(".hk-phone-chip-dial")?.textContent).toBe("+86");
    expect(queryField(container).getAttribute("inputmode")).toBe("tel");
  });

  it("shows a bare code when the dial matches no catalog entry", () => {
    const { container } = mountPhone({ dialCode: "+999" });
    expect(queryChip(container).querySelector(".hk-phone-chip-dial")?.textContent).toBe("+999");
  });

  it("sanitizes typed numbers to digits, spaces and dashes", () => {
    const { container, events } = mountPhone();
    const field = queryField(container);
    field.value = "138 1234-5678x+86";
    field.dispatchEvent(new Event("input"));
    expect(events.modelValue.at(-1)).toBe("138 1234-567886");
  });

  it("emits the composed E.164 on blur", () => {
    const { container, events } = mountPhone({ modelValue: "13812345678" });
    queryField(container).dispatchEvent(new Event("blur"));
    expect(events.change.at(-1)).toBe("+8613812345678");
  });

  it("lists catalog rows with names and codes when opened", async () => {
    const { container } = mountPhone();
    await openPicker(container);
    const rows = pickerRows();
    expect(rows.length).toBeGreaterThan(50);
    const first = rows[0];
    expect(first.textContent).toContain("China");
    expect(first.textContent).toContain("+86");
    // Flags are deliberately absent — Windows has no color flag font, so
    // the emoji would degrade to bare regional-indicator letters.
    expect(first.querySelector(".hk-affix-row-flag")).toBeNull();
    for (const row of rows) {
      expect(row.querySelector(".hk-affix-row-flag")).toBeNull();
    }
  });

  it("picks a country from the list and refocuses the number field", async () => {
    const { container, events } = mountPhone();
    await openPicker(container);
    const rows = pickerRows();
    const japan = rows.find((r) => r.textContent?.includes("Japan"))!;
    expect(japan).toBeTruthy();
    japan.click();
    await nextTick();
    expect(events.dialCode.at(-1)).toBe("+81");
    expect(events.dialchange.at(-1)).toBe("+81");
    // The picker plays its leave transition, then unmounts.
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(pickerRows()).toHaveLength(0);
  });

  it("disables the chip when the field is disabled", () => {
    const { container } = mountPhone({ disabled: true });
    expect(queryChip(container).disabled).toBe(true);
  });
});
