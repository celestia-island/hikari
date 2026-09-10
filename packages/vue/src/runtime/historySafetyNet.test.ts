import { afterEach, describe, expect, it, vi } from "vitest";

import { installHistorySafetyNet, sanitizeHistoryUrl } from "./historySafetyNet";

/**
 * The field bug this net closes (chest #754 lineage): some producer
 * hands the history layer a URL that resolves off-origin — classically
 * `origin + "undefined"` — pushState throws SecurityError, and
 * vue-router's fallback performs a full-page location.assign onto
 * "https://demo.dev.celestia.worldundefined/". The net must fold every
 * off-origin / poisoned target while leaving legitimate same-origin
 * URLs bit-for-bit untouched.
 */

describe("sanitizeHistoryUrl", () => {
  it("passes through nullish and empty (no-op calls stay no-ops)", () => {
    expect(sanitizeHistoryUrl(null)).toBe(null);
    expect(sanitizeHistoryUrl(undefined)).toBe(undefined);
    expect(sanitizeHistoryUrl("")).toBe("");
  });

  it("passes through same-origin absolute URLs untouched", () => {
    const origin = window.location.origin;
    expect(sanitizeHistoryUrl(`${origin}/backend#providers`)).toBe(`${origin}/backend#providers`);
    expect(sanitizeHistoryUrl(`${origin}/@ws?box=b#think`)).toBe(`${origin}/@ws?box=b#think`);
  });

  it("passes through in-app relative targets untouched", () => {
    expect(sanitizeHistoryUrl("/backend")).toBe("/backend");
    expect(sanitizeHistoryUrl("/@uuid?mode=reports#think")).toBe("/@uuid?mode=reports#think");
    expect(sanitizeHistoryUrl("#think")).toBe("#think");
    expect(sanitizeHistoryUrl("?redirect=/backend")).toBe("?redirect=/backend");
  });

  it("folds the cross-origin concatenated-undefined class onto the fallback", () => {
    expect(sanitizeHistoryUrl("https://demo.dev.celestia.worldundefined")).toBe("/");
    expect(sanitizeHistoryUrl("https://demo.dev.celestia.worldundefined/")).toBe("/");
    expect(sanitizeHistoryUrl("https://evil.example/steal")).toBe("/");
    expect(sanitizeHistoryUrl("//evil.example/x")).toBe("/");
  });

  it("honors a custom fallback (apps whose landing route is not /)", () => {
    expect(sanitizeHistoryUrl("https://evil.example/x", "/panel/home")).toBe("/panel/home");
    expect(sanitizeHistoryUrl("undefined", "/panel/home")).toBe("/panel/home");
  });

  it("folds bare poisoned literals onto the fallback", () => {
    expect(sanitizeHistoryUrl("undefined")).toBe("/");
    expect(sanitizeHistoryUrl("null")).toBe("/");
    expect(sanitizeHistoryUrl("NaN")).toBe("/");
  });

  it("folds unparseable garbage onto the fallback", () => {
    expect(sanitizeHistoryUrl("http://")).toBe("/");
  });
});

describe("installHistorySafetyNet", () => {
  const nativePush = History.prototype.pushState;
  const nativeReplace = History.prototype.replaceState;

  afterEach(() => {
    History.prototype.pushState = nativePush;
    History.prototype.replaceState = nativeReplace;
    sessionStorage.clear();
    // The installer detects the restored (unpatched) prototype and
    // re-patches on the next call — that self-healing path is exercised
    // by every test after the first restore.
  });

  it("coerces a cross-origin pushState target instead of throwing", () => {
    installHistorySafetyNet();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(() => history.pushState(null, "", "https://demo.dev.celestia.worldundefined/")).not.toThrow();
    expect(window.location.pathname).toBe("/");
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("leaves same-origin pushState untouched", () => {
    installHistorySafetyNet();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    history.pushState(null, "", "/backend");
    expect(window.location.pathname).toBe("/backend");
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("passes the 2-argument call shape through untouched (backStack / vue-router beforeUnload)", () => {
    // Production shape: window.history.pushState(state, "") — no url
    // argument at all. A wrapper-level regression that folded undefined
    // here would break every modal/back-guard push, so pin it at the
    // wrapper level, not just the pure function.
    installHistorySafetyNet();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(() => window.history.pushState({ marker: 1 }, "")).not.toThrow();
    expect(window.history.state).toEqual({ marker: 1 });
    expect(() => window.history.replaceState(null, "")).not.toThrow();
    expect(window.history.state).toBeNull();
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("passes vue-router's real production shape (same-origin ABSOLUTE url) untouched", () => {
    // changeLocation always composes protocol+'//'+host+base+to — pin
    // that exact shape so an over-eager origin comparison cannot ever
    // fold a legitimate router push.
    installHistorySafetyNet();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const abs = `${window.location.origin}/@ws?mode=reports#think`;
    history.pushState(null, "", abs);
    expect(window.location.href).toBe(abs);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("records a bounded sessionStorage evidence trail", () => {
    installHistorySafetyNet();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    for (let i = 0; i < 12; i++) {
      history.replaceState(null, "", `https://evil.example/${i}`);
    }
    const trail = JSON.parse(sessionStorage.getItem("hikari:historyNet") || "[]") as string[];
    expect(trail.length).toBeLessThanOrEqual(8);
    expect(trail[trail.length - 1]).toContain("evil.example/11");
    vi.restoreAllMocks();
  });

  it("reports through the onCoercion sink and honors evidenceKey: false", () => {
    const seen: string[] = [];
    installHistorySafetyNet({ evidenceKey: false, onCoercion: (info) => seen.push(info.raw) });
    vi.spyOn(console, "warn").mockImplementation(() => {});
    history.pushState(null, "", "https://evil.example/a");
    history.pushState(null, "", "https://evil.example/b");
    expect(seen).toEqual(["https://evil.example/a", "https://evil.example/b"]);
    expect(sessionStorage.getItem("hikari:historyNet")).toBeNull();
    vi.restoreAllMocks();
  });
});
