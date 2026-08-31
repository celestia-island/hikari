import { beforeEach, describe, expect, it, vi } from "vitest";

// The module keeps singleton state (initialized flag + refs), so every
// test gets a fresh module instance via vi.resetModules + dynamic import.
type FontContextModule = typeof import("./fontContext");

describe("fontContext", () => {
  let fc: FontContextModule;

  const el = () => document.documentElement;
  const applied = (name: string) => el().style.getPropertyValue(name);

  beforeEach(async () => {
    vi.resetModules();
    localStorage.clear();
    el().style.cssText = "";
    el().removeAttribute("data-font-context");
    fc = await import("./fontContext");
  });

  it("init applies the default stacks as inline vars and sets data-font-context", () => {
    fc.initFontContext();
    expect(applied("--font-sans")).toBe(fc.HIKARI_FONT_SANS);
    expect(applied("--font-mono")).toBe(fc.HIKARI_FONT_MONO);
    expect(applied("--font-reading")).toBe(fc.HIKARI_FONT_READING);
    expect(el().getAttribute("data-font-context")).toBe("on");
  });

  it("is idempotent: a repeated bare init does not fall back to defaults", () => {
    localStorage.setItem(
      "hikari-font-context",
      JSON.stringify({ sans: '"Stored Sans", sans-serif' }),
    );
    fc.initFontContext();
    fc.initFontContext();
    fc.initFontContext();
    expect(applied("--font-sans")).toBe('"Stored Sans", sans-serif');
  });

  it("applies localStorage overrides", () => {
    localStorage.setItem(
      "hikari-font-context",
      JSON.stringify({
        sans: '"A Sans", sans-serif',
        mono: '"A Mono", monospace',
        reading: '"A Reading", serif',
      }),
    );
    fc.initFontContext();
    expect(applied("--font-sans")).toBe('"A Sans", sans-serif');
    expect(applied("--font-mono")).toBe('"A Mono", monospace');
    expect(applied("--font-reading")).toBe('"A Reading", serif');
  });

  it("explicit options beat stored overrides on first init", () => {
    localStorage.setItem(
      "hikari-font-context",
      JSON.stringify({ sans: '"Stored Sans", sans-serif' }),
    );
    fc.initFontContext({ sans: '"Explicit Sans", sans-serif' });
    expect(applied("--font-sans")).toBe('"Explicit Sans", sans-serif');
  });

  it("merges explicit options from a repeated init", () => {
    fc.initFontContext();
    fc.initFontContext({ mono: '"Later Mono", monospace' });
    expect(applied("--font-mono")).toBe('"Later Mono", monospace');
    expect(applied("--font-sans")).toBe(fc.HIKARI_FONT_SANS);
  });

  it("rejects injection-shaped values and falls back to the next source", () => {
    localStorage.setItem(
      "hikari-font-context",
      JSON.stringify({
        sans: 'evil; } { --',
        mono: "",
        reading: "x".repeat(501),
      }),
    );
    fc.initFontContext({ sans: '"Also; Evil", sans-serif' });
    // sans: explicit rejected → stored rejected → default.
    expect(applied("--font-sans")).toBe(fc.HIKARI_FONT_SANS);
    // mono/reading: stored rejected → default.
    expect(applied("--font-mono")).toBe(fc.HIKARI_FONT_MONO);
    expect(applied("--font-reading")).toBe(fc.HIKARI_FONT_READING);
  });

  it("explicit options rejected by sanitization fall through to the stored override", () => {
    localStorage.setItem(
      "hikari-font-context",
      JSON.stringify({ sans: '"Good Sans", sans-serif' }),
    );
    fc.initFontContext({ sans: '"Bad; Sans"' });
    expect(applied("--font-sans")).toBe('"Good Sans", sans-serif');
  });

  it("ignores malformed stored JSON", () => {
    localStorage.setItem("hikari-font-context", "{not json");
    fc.initFontContext();
    expect(applied("--font-sans")).toBe(fc.HIKARI_FONT_SANS);
  });

  it("exposes refs whose setters persist and re-apply", () => {
    fc.initFontContext();
    const ctx = fc.useFontContext();
    ctx.setSans('"My Sans", sans-serif');
    expect(ctx.sans.value).toBe('"My Sans", sans-serif');
    expect(applied("--font-sans")).toBe('"My Sans", sans-serif');
    const stored = JSON.parse(localStorage.getItem("hikari-font-context") ?? "{}");
    expect(stored.sans).toBe('"My Sans", sans-serif');
  });

  it("setter rejects unsanitizable values without persisting", () => {
    fc.initFontContext();
    const ctx = fc.useFontContext();
    ctx.setSans('"Bad; Sans"');
    expect(ctx.sans.value).toBe(fc.HIKARI_FONT_SANS);
    expect(applied("--font-sans")).toBe(fc.HIKARI_FONT_SANS);
    expect(localStorage.getItem("hikari-font-context")).toBeNull();
  });

  it("reset clears storage and restores the built-in defaults", () => {
    fc.initFontContext();
    const ctx = fc.useFontContext();
    ctx.setMono('"My Mono", monospace');
    expect(applied("--font-mono")).toBe('"My Mono", monospace');
    ctx.reset();
    expect(localStorage.getItem("hikari-font-context")).toBeNull();
    expect(applied("--font-mono")).toBe(fc.HIKARI_FONT_MONO);
    expect(ctx.mono.value).toBe(fc.HIKARI_FONT_MONO);
    expect(el().getAttribute("data-font-context")).toBe("on");
  });

  it("applyFontContext re-applies the current state over DOM mutations", () => {
    fc.initFontContext();
    el().style.setProperty("--font-sans", "junk");
    fc.applyFontContext();
    expect(applied("--font-sans")).toBe(fc.HIKARI_FONT_SANS);
  });

  it("is a safe no-op in non-browser environments", () => {
    vi.stubGlobal("document", undefined);
    try {
      expect(() => fc.initFontContext({ sans: '"X", sans-serif' })).not.toThrow();
      expect(() => fc.applyFontContext()).not.toThrow();
      expect(() => fc.resetFontContext()).not.toThrow();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("default stacks lead with the Apple-style system heads", () => {
    expect(fc.HIKARI_FONT_SANS.startsWith("-apple-system, BlinkMacSystemFont")).toBe(true);
    expect(fc.HIKARI_FONT_MONO.startsWith(`ui-monospace, "SF Mono"`)).toBe(true);
  });

  it("default stacks carry the required CJK UI faces", () => {
    const required = ["PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC"];
    for (const stack of [fc.HIKARI_FONT_SANS, fc.HIKARI_FONT_MONO]) {
      for (const face of required) {
        expect(stack.toLowerCase()).toContain(face.toLowerCase());
      }
    }
  });

  it("default stacks never name a kai or serif face", () => {
    const banned = ["KaiTi", "STKaiti", "Kaiti SC", "SimSun", "Songti", "Noto Serif", "Source Han Serif"];
    for (const stack of [fc.HIKARI_FONT_SANS, fc.HIKARI_FONT_MONO, fc.HIKARI_FONT_READING]) {
      for (const face of banned) {
        // Assert absence of the whole quoted family name, case-insensitively.
        expect(stack.toLowerCase()).not.toContain(`"${face.toLowerCase()}"`);
      }
    }
  });

  it("reading defaults to the UI sans stack", () => {
    expect(fc.HIKARI_FONT_READING).toBe(fc.HIKARI_FONT_SANS);
  });
});
