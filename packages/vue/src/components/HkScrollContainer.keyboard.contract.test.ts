/**
 * Source contract for the keyboard-scrollable viewport (WCAG 2.1.1): a
 * scrollable region a keyboard user cannot reach is a compliance defect,
 * so the viewport takes tabindex=0 + arrows/PageUp/PageDown/Home/End.
 *
 * Pinned here:
 *   - the three props exist with the documented defaults (keyboardScroll
 *     default TRUE — a11y is the default posture, not an opt-in);
 *   - the viewport element carries tabindex / role / aria-label /
 *     onKeydown ONLY through the keyboardScroll gate (a consumer that
 *     opts out renders exactly the pre-feature chrome);
 *   - the handler bails on modifier keys and on events whose target is an
 *     inner element (inputs/buttons keep their native keys);
 *   - the focus indicator rides :focus-visible with a documented token
 *     fallback, so pointer users never see a ring.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, "HkScrollContainer.tsx"), "utf-8");
const scss = readFileSync(join(here, "HkScrollContainer.scss"), "utf-8");

describe("HkScrollContainer keyboard scroll contract", () => {
  it("declares the keyboard props with a11y-default posture", () => {
    expect(src).toMatch(/keyboardScroll: \{ type: Boolean, default: true \}/);
    expect(src).toMatch(/scrollRole: \{ type: String, default: undefined \}/);
    expect(src).toMatch(/scrollLabel: \{ type: String, default: undefined \}/);
  });

  it("binds tabindex/role/label/keydown on the viewport through the gate", () => {
    expect(src).toContain("tabindex={props.keyboardScroll ? 0 : undefined}");
    expect(src).toContain("role={props.scrollRole || undefined}");
    expect(src).toContain("aria-label={props.scrollLabel || undefined}");
    expect(src).toContain("onKeydown={props.keyboardScroll ? onViewportKeydown : undefined}");
  });

  it("handler bails on modifiers and inner targets; Page/Home/End preventDefault", () => {
    const handler = src.slice(src.indexOf("function onViewportKeydown"), src.indexOf("function onScroll"));
    expect(handler).toContain("if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;");
    expect(handler).toContain("if (target instanceof HTMLElement && target !== viewportRef.value) return;");
    for (const key of ['"ArrowDown"', '"ArrowUp"', '"PageDown"', '"PageUp"', '"Home"', '"End"']) {
      expect(handler).toContain(key);
    }
    expect(handler.match(/event\.preventDefault\(\)/g)?.length).toBeGreaterThanOrEqual(3);
  });

  it("focus indicator is :focus-visible with the canonical standalone fallback", () => {
    expect(scss).toContain(".hk-scroll-container-viewport:focus-visible");
    // The standalone-render fallback must be the canonical literal (the
    // token-inventory guard catches non-canonical values — verified by
    // negative control), and the indicator follows the focus-ring mixin's
    // box-shadow convention rather than dead custom knobs.
    expect(scss).toContain("box-shadow: 0 0 0 2px var(--hi-color-primary, #7aa2f7)");
    expect(scss).not.toContain("--hk-focus-width");
    expect(scss).not.toContain("--hk-focus-color");
  });
});
