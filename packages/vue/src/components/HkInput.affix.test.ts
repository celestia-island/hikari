/**
 * Source contract for the input affix reservation (2026-08-30 user
 * report: the localized input's language chip sat at the LEFT edge of
 * the field with the scrolling placeholder sliding underneath it).
 *
 * Two coupled guarantees, pinned here so a refactor cannot silently
 * regress them — the same "looks fixed but never shipped" class of
 * failure as the overflow-poll incident:
 *
 *  1. The trailing affix pins to the RIGHT edge (margin-inline-start:
 *     auto) — the input element is absolutely positioned, so a lone
 *     in-flow suffix otherwise sits at flex START.
 *  2. The element's horizontal padding and the placeholder-marquee
 *     window consume the measured affix widths (--hk-input-affix-*-w,
 *     published by HkInput on the box), so text and marquee always end
 *     short of the chip.
 */
import { afterEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createApp, h, nextTick, type Component } from "vue";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import HkInput from "./HkInput";

const here = dirname(fileURLToPath(import.meta.url));
const scss = readFileSync(join(here, "HkInput.scss"), "utf-8");

const mounts: Array<{ app: ReturnType<typeof createApp>; container: HTMLElement }> = [];

function mountInput(opts: { slots?: Record<string, Component> } = {}) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const app = createApp({
    render: () =>
      h(HkInput, { placeholder: "Short name" }, opts.slots ?? {}),
  });
  app.mount(container);
  mounts.push({ app, container });
  return { container };
}

afterEach(() => {
  for (const { app, container } of mounts.splice(0)) {
    app.unmount();
    container.remove();
  }
  document.body.innerHTML = "";
});

describe("HkInput affix reservation contract", () => {
  it("pins the trailing affix to the right edge", () => {
    const rule = scss.match(/\.hk-input-affix\.hk-input-suffix\s*{[^}]*}/)?.[0] ?? "";
    expect(rule, "suffix rule must exist").toContain("margin-inline-start: auto");
  });

  it("sizes the element padding and marquee window from the affix vars", () => {
    const element = scss.slice(
      scss.indexOf(".hk-input-element {"),
      scss.indexOf("&:focus"),
    );
    expect(element).toContain("var(--hk-input-affix-end-w");
    expect(element).toContain("var(--hk-input-affix-start-w");

    const marquee = scss.match(/\.hk-input-box \.hk-placeholder-marquee\s*{[^}]*}/)?.[0] ?? "";
    expect(marquee, "marquee window rule must exist").toContain("var(--hk-input-affix-end-w");
    expect(marquee).toContain("var(--hk-input-affix-start-w");
  });

  it("leaves the textarea variant's padding out of the affix reservation", () => {
    // Textareas are in-flow flex children (not the absolute overlay), so
    // an affix sits beside them in flow — the reservation must stay
    // scoped to the absolutely-positioned input element.
    const textarea = scss.match(/\.hk-input-element\.hk-input-textarea\s*{[^}]*}/)?.[0] ?? "";
    expect(textarea, "textarea override rule must exist").toBeTruthy();
    expect(textarea).not.toContain("--hk-input-affix");
    expect(textarea).toContain("padding: var(--space-8) var(--space-12)");
  });

  it("publishes the measured affix width on the box", async () => {
    // happy-dom lays out nothing — pin the affix width the ref callback
    // would measure in a real browser and read the published custom
    // property back off the box. happy-dom exposes offsetWidth as an
    // accessor on HTMLElement.prototype; blanket-stub it to 96 (the
    // component only reads it for the two affix spans).
    const receiver = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      "offsetWidth",
    );
    expect(receiver, "offsetWidth accessor exists on HTMLElement").toBeTruthy();
    Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
      configurable: true,
      get: () => 96,
    });
    try {
      const { container } = mountInput({
        slots: { suffix: () => h("span", "CHIP") },
      });
      await nextTick();
      const box = container.querySelector<HTMLElement>(".hk-input-box")!;
      expect(box, "input box renders").toBeTruthy();
      expect(box.style.getPropertyValue("--hk-input-affix-end-w")).toBe("96px");
      expect(box.style.getPropertyValue("--hk-input-affix-start-w")).toBe("0px");
    } finally {
      if (receiver) {
        Object.defineProperty(HTMLElement.prototype, "offsetWidth", receiver);
      }
    }
  });

  it("keeps zero widths when no affix slot is provided", async () => {
    const { container } = mountInput();
    await nextTick();
    const box = container.querySelector<HTMLElement>(".hk-input-box")!;
    expect(box.style.getPropertyValue("--hk-input-affix-end-w")).toBe("0px");
    expect(box.style.getPropertyValue("--hk-input-affix-start-w")).toBe("0px");
  });

  it("clears the reservation when the affix is removed while mounted", async () => {
    // Vue fires ref(null) BEFORE detaching the element, so the clearing
    // path must judge detachment after the patch settles — this pins
    // the deferred check (a synchronous isConnected guard was proven
    // dead code in review).
    const receiver = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      "offsetWidth",
    );
    expect(receiver, "offsetWidth accessor exists on HTMLElement").toBeTruthy();
    Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
      configurable: true,
      get: () => 96,
    });
    try {
      const container = document.createElement("div");
      document.body.appendChild(container);
      const app = createApp({
        data: () => ({ show: true }),
        render() {
          return h(
            HkInput,
            { placeholder: "Short name" },
            this.show ? { suffix: () => h("span", "CHIP") } : {},
          );
        },
      });
      app.mount(container);
      mounts.push({ app, container });
      await nextTick();
      const box = container.querySelector<HTMLElement>(".hk-input-box")!;
      expect(box.style.getPropertyValue("--hk-input-affix-end-w")).toBe("96px");
      (app._instance?.proxy as unknown as { show: boolean }).show = false;
      // Three ticks: ① the unmounting patch (ref(null) fires), ② the
      // deferred detachment check clears the tracked width, ③ the box
      // re-renders with the reset custom property.
      await nextTick();
      await nextTick();
      await nextTick();
      expect(box.style.getPropertyValue("--hk-input-affix-end-w")).toBe("0px");
      // The suffix comes back — the reservation must follow it again.
      (app._instance?.proxy as unknown as { show: boolean }).show = true;
      await nextTick();
      await nextTick();
      expect(box.style.getPropertyValue("--hk-input-affix-end-w")).toBe("96px");
    } finally {
      if (receiver) {
        Object.defineProperty(HTMLElement.prototype, "offsetWidth", receiver);
      }
    }
  });
});
