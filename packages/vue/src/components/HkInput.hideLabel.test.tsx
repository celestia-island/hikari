import { afterEach, describe, expect, it } from "vitest";
import { createApp, h } from "vue";

import HkInput from "./HkInput";

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

describe("HkInput hideLabel", () => {
  it("renders the caption by default and derives no aria-label", () => {
    const c = mount(h(HkInput, { modelValue: "", label: "Tool" }));
    expect(c.querySelector(".hk-input-label")?.textContent).toContain("Tool");
    expect(c.querySelector<HTMLInputElement>(".hk-input-element")!.getAttribute("aria-label")).toBeNull();
  });

  it("hideLabel drops the caption and names the field element instead (text)", () => {
    const c = mount(h(HkInput, { modelValue: "", label: "Tool", hideLabel: true }));
    expect(c.querySelector(".hk-input-label")).toBeNull();
    expect(c.querySelector<HTMLInputElement>(".hk-input-element")!.getAttribute("aria-label")).toBe("Tool");
  });

  it("hideLabel names the field element instead (textarea)", () => {
    const c = mount(h(HkInput, { modelValue: "", type: "textarea", label: "Notes", hideLabel: true, rows: 2 }));
    expect(c.querySelector(".hk-input-label")).toBeNull();
    expect(c.querySelector<HTMLTextAreaElement>(".hk-input-textarea")!.getAttribute("aria-label")).toBe("Notes");
  });

  it("a caller-provided aria-label wins over the derived one", () => {
    const c = mount(
      h(HkInput, { modelValue: "", label: "Tool", hideLabel: true, "aria-label": "Custom name" }),
    );
    expect(c.querySelector<HTMLInputElement>(".hk-input-element")!.getAttribute("aria-label")).toBe("Custom name");
  });

  it("hideLabel names the password surface's input too", () => {
    const c = mount(
      h(HkInput, { modelValue: "", label: "Passphrase", hideLabel: true, variant: "password" }),
    );
    expect(c.querySelector(".hk-input-label")).toBeNull();
    // The surface forwards its fallthrough attrs onto the native input.
    const input = c.querySelector<HTMLInputElement>('input[type="password"]')!;
    expect(input, "the password surface renders its native input").toBeTruthy();
    expect(input.getAttribute("aria-label")).toBe("Passphrase");
  });

  it("a caller aria-label reaches the password input unchanged when hideLabel is off", () => {
    // The derived aria-label renders `undefined` when hideLabel is off —
    // and because JSX props merge in order, that undefined sits BEFORE
    // the attrs spread so it can never clobber the caller's name (a
    // regression here once silenced every labelled password field).
    const c = mount(
      h(HkInput, { modelValue: "", label: "Passphrase", "aria-label": "Current password", variant: "password" }),
    );
    const input = c.querySelector<HTMLInputElement>('input[type="password"]')!;
    expect(input.getAttribute("aria-label")).toBe("Current password");
  });
});
