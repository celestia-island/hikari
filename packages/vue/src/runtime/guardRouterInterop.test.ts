import { describe, expect, it, vi } from "vitest";

import { createPoisonedLocationGuard, type GuardRouter } from "./navigationGuard";
import { createAuthGuard } from "./createAuthGuard";

/**
 * Cast-free interoperability with a REAL vue-router Router shape.
 *
 * Field report e.cw #84: with GuardRouter.beforeEach declared as a
 * PROPERTY function, strictFunctionTypes applies strict parameter
 * contravariance and vue-router's Router (whose beforeEach is
 * method-typed, taking a NavigationGuard with a full RouteNormalized
 * `to`) can never satisfy GuardRouter — every consumer needed an
 * `as GuardRouter` cast. Method syntax (bivariant parameters) is the
 * contract under test here: the assignments below must compile with NO
 * casts, which vue-tsc (the package gate) enforces on every run.
 */

/** Minimal structural mimic of vue-router's method-typed Router —
 *  deliberately NOT GuardRouter-shaped (extra params, richer `to`,
 *  non-void return) so a variance regression fails compilation. */
interface VueRouterLike {
  beforeEach(
    guard: (
      to: { path: string; fullPath: string; name?: string | symbol | null; meta?: Record<string, unknown> },
      from: unknown,
      next: unknown,
    ) => unknown,
  ): () => void;
  onError?(handler: (error: unknown, to: { fullPath: string }) => void): () => void;
}

function makeVueRouterLike(): VueRouterLike {
  type Guard = Parameters<VueRouterLike["beforeEach"]>[0];
  const guards: Guard[] = [];
  return {
    beforeEach(guard: Guard) {
      guards.push(guard);
      return () => { const i = guards.indexOf(guard); if (i >= 0) guards.splice(i, 1); };
    },
    onError() { return () => undefined; },
  };
}

// The contract: both assignments must be cast-free. If GuardRouter ever
// regresses to property-function syntax, vue-tsc rejects these lines.
const routerForGuard: GuardRouter = makeVueRouterLike();
const routerForAuth: Parameters<typeof createAuthGuard>[0] = makeVueRouterLike();

describe("GuardRouter cast-free interop", () => {
  it("registers the poisoned-location guard on a vue-router-shaped router", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    createPoisonedLocationGuard(routerForGuard);
    expect(routerForGuard).toBeDefined();
    warn.mockRestore();
  });

  it("createAuthGuard accepts a vue-router-shaped router cast-free", () => {
    const auth = {
      isAuthenticated: false,
      user: null,
      tryRestoreSession: () => Promise.resolve(),
      checkSetup: () => Promise.resolve({ needs_setup: false }),
      fetchUser: () => Promise.resolve({}),
    };
    createAuthGuard(routerForAuth, {
      loginRoute: "login",
      homeRoute: "home",
      setupRoute: "setup",
      useAuthStore: () => auth,
    });
    expect(routerForAuth).toBeDefined();
  });
});
