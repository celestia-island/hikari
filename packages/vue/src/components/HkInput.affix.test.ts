/**
 * Source contract for the input affix reservation (2026-08-30 user
 * report: the localized input's language chip sat at the LEFT edge of
 * the field with the scrolling placeholder sliding underneath it;
 * 2026-09-01 user report: a lone prefix icon pushed the CENTERED text
 * line half an icon toward the far side on the sign-in card).
 *
 * Three coupled guarantees, pinned here so a refactor cannot silently
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
 *  3. The CENTERED default reserves the clearance SYMMETRICALLY (max
 *     of both affix widths on each side), so icons never shift where
 *     the centered line sits; only an explicit data-align="start"/
 *     "end" (HkInput's `align` prop) restores the per-side
 *     reservation.
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

function mountInput(
  opts: { slots?: Record<string, Component>; props?: Record<string, unknown> } = {},
) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const app = createApp({
    render: () =>
      h(HkInput, { placeholder: "Short name", ...opts.props }, opts.slots ?? {}),
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

  it("reserves the centered clearance symmetrically so icons never shift the line", () => {
    // The centered base rule must reserve the SAME clearance on both
    // sides (max of the two affix widths) — a lone prefix icon would
    // otherwise push the text-align:center content box half an affix
    // toward the far side (2026-09-01 sign-in card report).
    const symmetric =
      "max(var(--hk-input-affix-start-w, 0px), var(--hk-input-affix-end-w, 0px))";
    const element = scss.slice(
      scss.indexOf(".hk-input-element {"),
      scss.indexOf("&:focus"),
    );
    expect(element).toContain("text-align: center");
    expect(element).toContain("padding-inline");
    expect(element).toContain(symmetric);
    expect(element).not.toContain("padding-inline-start");
    expect(element).not.toContain("padding-inline-end");

    const marquee = scss.match(/\.hk-input-box \.hk-placeholder-marquee\s*{[^}]*}/)?.[0] ?? "";
    expect(marquee, "marquee window rule must exist").toContain(symmetric);
  });

  it("restores the per-side reservation only for explicit edge alignments", () => {
    const shared = scss.match(
      /\.hk-input-box\[data-align="start"\] \.hk-input-element:not\(\.hk-input-textarea\),\s*\.hk-input-box\[data-align="end"\] \.hk-input-element:not\(\.hk-input-textarea\)\s*{[^}]*}/,
    )?.[0] ?? "";
    expect(shared, "edge-align padding rule must exist").toContain(
      "padding-inline-start: calc(var(--space-12) + var(--hk-input-affix-start-w, 0px))",
    );
    expect(shared).toContain(
      "padding-inline-end: calc(var(--space-12) + var(--hk-input-affix-end-w, 0px))",
    );

    // The standalone text-align rules must have text-align as the very
    // first declaration — anchoring the match there skips the shared
    // rule whose second selector line carries the same prefix.
    expect(
      scss.match(/\.hk-input-box\[data-align="start"\] \.hk-input-element:not\(\.hk-input-textarea\)\s*\{\s*text-align:\s*start/),
      "start alignment rule must exist",
    ).toBeTruthy();
    expect(
      scss.match(/\.hk-input-box\[data-align="end"\] \.hk-input-element:not\(\.hk-input-textarea\)\s*\{\s*text-align:\s*end/),
      "end alignment rule must exist",
    ).toBeTruthy();

    // The scrolling window tracks the (off-center) content box too.
    const marqueeEdge = scss.match(
      /\.hk-input-box\[data-align="start"\] \.hk-placeholder-marquee,\s*\.hk-input-box\[data-align="end"\] \.hk-placeholder-marquee\s*{[^}]*}/,
    )?.[0] ?? "";
    expect(marqueeEdge, "edge-align marquee rule must exist").toContain(
      "inset-inline-start: calc(var(--space-12) + var(--hk-input-affix-start-w, 0px))",
    );
  });

  it("marks the box with data-align only for non-centered alignment", async () => {
    const centered = mountInput();
    await nextTick();
    expect(centered.container.querySelector(".hk-input-box")!.getAttribute("data-align")).toBeNull();

    const start = mountInput({ props: { align: "start" } });
    await nextTick();
    expect(start.container.querySelector(".hk-input-box")!.getAttribute("data-align")).toBe("start");

    const end = mountInput({ props: { align: "end" } });
    await nextTick();
    expect(end.container.querySelector(".hk-input-box")!.getAttribute("data-align")).toBe("end");

    // Textarea boxes never carry the marker — their element is excluded
    // by :not() and a textarea-scoped marquee must keep the symmetric
    // window insets.
    const ta = mountInput({ props: { align: "start", type: "textarea" } });
    await nextTick();
    expect(ta.container.querySelector(".hk-input-box")!.getAttribute("data-align")).toBeNull();
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
