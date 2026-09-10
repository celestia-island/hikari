import { describe, expect, it } from "vitest";
import { Info } from "lucide-vue-next";

import { iconByName } from "./iconRegistry";

// Glyph-expansion contract (2026-09-10): downstream audits (chest / e.cw /
// erp.cw icon waves) found these icon-prop names silently rendering the
// `Info` fallback because the lucide exports were missing from the
// tree-shakeable registry. Each entry must resolve to its real glyph —
// asserted against the unknown-name fallback, not just against `Info`,
// so a future fallback swap cannot silently pass this suite.
const NEW_GLYPH_KEBAB = [
  "log-out", "sparkles", "upload", "camera", "flag", "download", "image",
  "video", "save", "braces", "history", "rotate-cw", "key-round",
  "scan-search", "ban", "filter",
] as const;

const NEW_GLYPH_PASCAL = [
  "LogOut", "Sparkles", "Upload", "Camera", "Flag", "Download", "Image",
  "Video", "Save", "Braces", "History", "RotateCw", "KeyRound",
  "ScanSearch", "Ban", "Filter",
] as const;

describe("icon registry glyph expansion", () => {
  const fallback = iconByName("totally-unknown-name");

  it("resolves unknown names to the Info fallback", () => {
    expect(fallback).toBe(Info);
  });

  it("keeps the kebab-case lookup distinct from the fallback for every new glyph", () => {
    for (const kebab of NEW_GLYPH_KEBAB) {
      const resolved = iconByName(kebab);
      expect(resolved, `iconByName(${kebab}) hit the fallback`).not.toBe(fallback);
      expect(resolved).not.toBe(Info);
    }
  });

  it("resolves the PascalCase export names directly", () => {
    for (const pascal of NEW_GLYPH_PASCAL) {
      const resolved = iconByName(pascal);
      expect(resolved, `iconByName(${pascal}) hit the fallback`).not.toBe(fallback);
      expect(resolved).not.toBe(Info);
    }
  });

  it("maps kebab-case and PascalCase spellings to the same glyph", () => {
    for (const [kebab, pascal] of NEW_GLYPH_KEBAB.map((k, i) => [k, NEW_GLYPH_PASCAL[i]] as const)) {
      expect(iconByName(kebab)).toBe(iconByName(pascal));
    }
  });

  it("still resolves the Info fallback for unknown names after the expansion", () => {
    expect(iconByName("no-such-glyph-at-all")).toBe(fallback);
  });
});
