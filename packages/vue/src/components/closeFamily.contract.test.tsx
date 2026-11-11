import { afterEach, describe, expect, it } from "vitest";
import { createApp, h, nextTick } from "vue";

import HkAlert from "./HkAlert";
import HkFileField from "./HkFileField";
import HkTag from "./HkTag";
import HkPersistentToast from "./HkPersistentToast";

/**
 * Cross-form contract for the CLOSE-BUTTON FAMILY (2026-11-06 sweep).
 *
 * The exact trap this pins: these three sheets are byte-mirrored into the
 * Rust crate (`vue-mirror/manifest.tsv`), so ONE stylesheet has to serve both
 * renderers. If the Vue half keeps a hand-rolled `<button class="hk-…-close">`
 * while the Rust half renders the standard icon button (or the reverse), the
 * shared sheet can only match one of them — the other form silently loses its
 * box, ink and hover. Recording that as a "documentation delta" (ledger L177)
 * is what let it survive one review round.
 *
 * So the pin is the RENDERED CLASS LIST: every close affordance in this family
 * must carry the standard layers, in the component's documented order
 * (`hk-icon-button`, then the size step, then the variant) followed by the
 * seat class the sheet keys on.
 */
const seats = [
  {
    name: "HkAlert close",
    render: () => h(HkAlert, { message: "m", closable: true }),
    seat: "hk-alert-close",
  },
  {
    // Wave B1: the file field's clear rides the standard button at S24.
    name: "HkFileField clear",
    render: () =>
      h(HkFileField, {
        modelValue: [{ name: "a.txt" }],
      }),
    seat: "hk-file-clear",
    rung: 24,
  },
  {
    // Wave B1: the chip close rides S16 (the 14px bespoke box is retired;
    // 14 -> 16 is the declared density growth).
    name: "HkTag chip close",
    render: () => h(HkTag, { closable: true, closeLabel: "Remove" }),
    seat: "hk-tag-close",
    rung: 16,
  },
  {
    name: "HkPersistentToast dismiss",
    render: () => h(HkPersistentToast, { label: "l", dismissible: true }),
    seat: "hk-persistent-toast__dismiss",
  },
];

const hosts: HTMLElement[] = [];

function mountSeat(render: () => ReturnType<typeof h>): HTMLElement {
  const host = document.createElement("div");
  document.body.appendChild(host);
  hosts.push(host);
  createApp({ render }).mount(host);
  return host;
}

afterEach(() => {
  for (const host of hosts.splice(0)) host.remove();
});

describe("close-button family rides the standard icon button", () => {
  for (const entry of seats) {
    const { name, render, seat } = entry;
    it(`${name} renders the standard class list plus its seat`, async () => {
      const host = mountSeat(render);
      await nextTick();

      const control = host.querySelector<HTMLElement>(`.${seat}`);
      expect(control, `${name} renders .${seat}`).toBeTruthy();
      // The element that carries the seat is the BUTTON itself — a seat on a
      // wrapper would leave the sheet styling the wrong box.
      expect(control!.tagName, `${name} must be a button`).toBe("BUTTON");

      const rung = (entry as typeof entry & { rung?: number }).rung ?? 24;
      const tokens = [...control!.classList];
      expect(tokens, `${name} carries the base layer`).toContain("hk-icon-button");
      expect(tokens, `${name} carries the ${rung}px rung`).toContain(
        `hk-icon-button-${rung}`,
      );
      expect(tokens, `${name} carries the ghost variant`).toContain(
        "hk-icon-button-ghost",
      );
      expect(tokens, `${name} carries its seat`).toContain(seat);
      // Documented order: base, size, variant, seat.
      const base = tokens.indexOf("hk-icon-button");
      const rungAt = tokens.indexOf(`hk-icon-button-${rung}`);
      const ghost = tokens.indexOf("hk-icon-button-ghost");
      expect(base).toBeLessThan(rungAt);
      expect(rungAt).toBeLessThan(ghost);
      expect(tokens.indexOf("hk-icon-button-ghost")).toBeLessThan(
        tokens.indexOf(seat),
      );

      // A raw button would submit an enclosing form; the family never must.
      expect(control!.getAttribute("type"), `${name} is type=button`).toBe("button");
      expect(
        control!.getAttribute("aria-label"),
        `${name} keeps an accessible name`,
      ).toBeTruthy();
      // The glyph arrives through the icon slot, one box per control.
      expect(
        control!.querySelectorAll(".hk-icon-button-icon svg").length,
        `${name} slots exactly one glyph`,
      ).toBe(1);
    });
  }

  it("the token editor has NO clear button in its editor body", () => {
    // Retired 2026-11-11 (user report): the precision editor's dialog
    // chrome already carries the window close ✕, and a second ✕ next to
    // the unit picker read as a duplicate control — clearing the text is
    // the unset gesture. Pinned NEGATIVELY at source level (the editor
    // lives inside an HkAdaptiveDialog slot, no bare mount path) so the
    // button cannot quietly grow back.
    const token = readSource("HkTokenInput.tsx");
    expect(token, "no hk-token-input-clear seat class").not.toContain(
      "hk-token-input-clear",
    );
    expect(token, "no HkIconButton in the editor body").not.toContain(
      "HkIconButton",
    );
  });

  it("sources the toast controls from the standard component too", () => {
    // HkToast is driven by useToast rather than props, so it cannot be
    // mounted bare here; pin the source contract instead — the two controls
    // must be HkIconButton with the seat class and the 24px rung.
    const source = readSource("HkToast.tsx");
    for (const seat of ["hk-toast-close", "hk-toast-copy-btn"]) {
      const tag = new RegExp(
        `<HIconButton[^>]*class="${seat}"[^>]*size=\\{24\\}` +
          `|<HIconButton[\\s\\S]{0,200}?class="${seat}"[\\s\\S]{0,200}?size=\\{24\\}`,
      );
      expect(source, `${seat} rides HkIconButton at 24px`).toMatch(tag);
      expect(source, `${seat} is not a raw button`).not.toMatch(
        new RegExp(`<button[^>]*class="${seat}"`),
      );
    }
  });
});

function readSource(name: string): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { readFileSync } = require("node:fs") as typeof import("node:fs");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { dirname, join } = require("node:path") as typeof import("node:path");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { fileURLToPath } = require("node:url") as typeof import("node:url");
  return readFileSync(join(dirname(fileURLToPath(import.meta.url)), name), "utf-8");
}
