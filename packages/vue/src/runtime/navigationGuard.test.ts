import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createPoisonedLocationGuard,
  installNavigationSafetyNet,
  type GuardRoute,
} from "./navigationGuard";

/** Minimal router double: records guards, lets tests drive them. */
function makeRouter() {
  const guards: Array<(to: GuardRoute) => unknown> = [];
  const router = {
    beforeEach: (fn: (to: GuardRoute) => unknown) => { guards.push(fn); },
  };
  return {
    router,
    run: (to: GuardRoute) => {
      expect(guards.length).toBeGreaterThan(0);
      return guards[guards.length - 1](to);
    },
  };
}

describe("createPoisonedLocationGuard", () => {
  it("allows in-app absolute paths through", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const r = makeRouter();
    createPoisonedLocationGuard(r.router);
    expect(r.run({ path: "/backend", fullPath: "/backend#x" })).toBe(true);
    expect(r.run({ path: "/@ws", fullPath: "/@ws" })).toBe(true);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("folds non-slash-rooted paths (the stringified-undefined class)", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const r = makeRouter();
    createPoisonedLocationGuard(r.router);
    expect(r.run({ path: "undefined", fullPath: "undefined" })).toBe("/");
    expect(r.run({ path: "https://evil.example/x", fullPath: "https://evil.example/x" })).toBe("/");
    // A "//evil" PATH is not the open-redirect form once the router
    // composes it (origin + "//evil…" = a same-origin double-slash
    // path); the open-redirect threat lives at the location.assign
    // layer, where safeRedirect-style producers reject it.
    expect(r.run({ path: "//evil.example/x", fullPath: "//evil.example/x" })).toBe(true);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("folds the bare poisoned literals but keeps deeper paths", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const r = makeRouter();
    createPoisonedLocationGuard(r.router);
    expect(r.run({ path: "undefined" })).toBe("/");
    expect(r.run({ path: "null" })).toBe("/");
    expect(r.run({ path: "nan" })).toBe("/");
    // "/undefined" stays a valid (matched-later) in-app path — the
    // catch-all route owns it, same contract as the chest guard.
    expect(r.run({ path: "/undefined" })).toBe(true);
    warn.mockRestore();
  });

  it("honors a custom fallback", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const r = makeRouter();
    createPoisonedLocationGuard(r.router, "/panel/home");
    expect(r.run({ path: "undefined" })).toBe("/panel/home");
    warn.mockRestore();
  });

  it("treats a missing path as poisoned (never trust undefined)", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const r = makeRouter();
    createPoisonedLocationGuard(r.router);
    expect(r.run({ path: undefined as unknown as string, fullPath: "x" })).toBe("/");
    warn.mockRestore();
  });
});

describe("installNavigationSafetyNet", () => {
  const nativePush = History.prototype.pushState;

  afterEach(() => {
    History.prototype.pushState = nativePush;
    sessionStorage.clear();
  });

  it("installs both layers: history patch + router guard", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const r = makeRouter();
    installNavigationSafetyNet({ router: r.router });
    // Router layer folds the poisoned target before history sees it.
    expect(r.run({ path: "undefined" })).toBe("/");
    // History layer still coerces direct off-origin producers.
    expect(() => history.pushState(null, "", "https://evil.example/x")).not.toThrow();
    expect(window.location.pathname).toBe("/");
    warn.mockRestore();
  });

  it("works without a router (history-only install)", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(() => installNavigationSafetyNet({})).not.toThrow();
    expect(() => history.pushState(null, "", "https://evil.example/y")).not.toThrow();
    expect(window.location.pathname).toBe("/");
    warn.mockRestore();
  });
});
