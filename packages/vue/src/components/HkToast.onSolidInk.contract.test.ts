/**
 * Source contract: every tinted toast band (error / success / info /
 * loading) re-pins the copy/close controls' standard icon-button ink to
 * the band's on-solid color. The 2026-11-06 HkIconButton sweep left the
 * controls riding the ghost ink — the page's secondary text color — so
 * the glyphs rendered near-black on the saturated bands (2026-11-12 user
 * report: black copy/close glyphs on the red CSRF error toast). Pinned
 * here so a refactor cannot drop the per-band re-pin again.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

const TINTED_VARIANTS = ["error", "success", "info", "loading"] as const;
const CONTROL_CLASSES = ["hk-toast-copy-btn", "hk-toast-close"] as const;
const BRIDGE_DECLS = [
  "--hi-icon-button-icon-color:",
  "--hi-icon-button-icon-color-active:",
  "--hi-icon-button-bg-hover:",
  "--hi-icon-button-bg-active:",
] as const;

describe("toast tinted-band icon ink contract", () => {
  const css = readFileSync(join(here, "HkToast.scss"), "utf-8");

  // Each `.hk-toast-<variant> .<control>` selector must sit inside a rule
  // that re-pins the icon-button bridge vars: the ghost variant declares
  // its ink ON the button element, so an inherited or ancestor-level
  // custom property can never beat it — the re-pin must share that seat.
  it("re-pins the icon-button bridge on every tinted-band control", () => {
    const blocks =
      css.match(/\.hk-toast-[a-z]+ \.hk-toast-(?:copy-btn|close)[^{}]*\{[^{}]*\}/g) ?? [];
    for (const variant of TINTED_VARIANTS) {
      for (const control of CONTROL_CLASSES) {
        const block = blocks.find((b) => b.includes(`.hk-toast-${variant} .${control}`));
        expect(
          block,
          `.hk-toast-${variant} .${control} must carry a bridge re-pin`,
        ).toBeDefined();
        for (const decl of BRIDGE_DECLS) {
          expect(
            block,
            `.hk-toast-${variant} .${control} block must declare ${decl}`,
          ).toContain(decl);
        }
      }
    }
  });

  it("tinted-band ink rides the on-solid token; warning keeps its dark ink", () => {
    const tintedBlock =
      css.match(/\.hk-toast-error \.hk-toast-copy-btn[^{}]*\{[^{}]*\}/)?.[0] ?? "";
    expect(tintedBlock).toContain("var(--hi-color-text-on-solid, #ffffff)");
    expect(tintedBlock).not.toContain("#1c1c1e");
    // The washes must ride the pinned ink (currentColor), not a literal
    // polarity: the ink is theme-following, so a hardcoded white wash
    // would go invisible on pale-band schemes (the default dark Nord
    // preset ships pale bands with near-black on-solid ink).
    expect(tintedBlock).toContain(
      "color-mix(in srgb, currentColor 14%, transparent)",
    );
    expect(tintedBlock).toContain(
      "color-mix(in srgb, currentColor 20%, transparent)",
    );

    const warnBlock =
      css.match(/\.hk-toast-warning \.hk-toast-copy-btn[^{}]*\{[^{}]*\}/)?.[0] ?? "";
    expect(warnBlock).toContain("#1c1c1e");
    expect(warnBlock).not.toContain("--hi-color-text-on-solid");
  });

  it("leaves no tinted-band control riding the page-surface ghost ink", () => {
    // The regression shape: a tinted-band control block consuming the
    // ghost default (page secondary ink) instead of re-pinning the band's
    // own on-solid color.
    for (const variant of TINTED_VARIANTS) {
      const block =
        css
          .match(
            new RegExp(
              `\\.hk-toast-${variant} \\.hk-toast-(?:copy-btn|close)[^{}]*\\{[^{}]*\\}`,
              "g",
            ),
          )
          ?.join("\n") ?? "";
      expect(
        block,
        `${variant} band controls must not ride the page ink`,
      ).not.toContain("--hi-color-text-secondary");
    }
  });
});
