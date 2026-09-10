import { describe, expect, it, vi } from "vitest";

import { createAuthGuard } from "./createAuthGuard";

/** Shape the guard's router parameter accepts (a slim slice of
 *  vue-router's Router — the guard only calls beforeEach/onError). */
interface SlimRouter {
  beforeEach: (fn: (to: GuardTo) => unknown) => void;
  onError: (fn: (error: unknown, to: GuardTo) => void) => void;
}

interface GuardTo {
  name?: string | symbol | null;
  fullPath?: string;
  meta?: Record<string, unknown>;
}

/** Minimal router double: records guards, lets tests drive them. */
function makeRouter() {
  const guards: Array<(to: GuardTo) => unknown> = [];
  const router: SlimRouter = {
    beforeEach: (fn) => { guards.push(fn); },
    onError: () => {},
  };
  return {
    router,
    run: (to: GuardTo) => {
      expect(guards.length).toBeGreaterThan(0);
      return guards[guards.length - 1](to);
    },
  };
}

function makeAuthStore(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    isAuthenticated: false,
    user: null,
    tryRestoreSession: vi.fn().mockResolvedValue(undefined),
    checkSetup: vi.fn().mockResolvedValue({ needs_setup: false }),
    fetchUser: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

const baseOpts = {
  loginRoute: "login",
  homeRoute: "demiurge",
  setupRoute: "setup-redirect",
};

/** The lagged-login contract: an identity fetch that fails verification
 *  must redirect to the login route (preserving the redirect target),
 *  never abort the navigation with an unhandled rejection — the old
 *  behavior fed the rejection into router.onError where the lazy-load
 *  retry handler misclassified it as a chunk failure. */
describe("createAuthGuard identity hydration", () => {
  it("redirects to login when the identity fetch fails verification", async () => {
    const auth = makeAuthStore({ isAuthenticated: true });
    // A failed verification logs out inside the real fetchUser — the
    // guard reads the post-fetch flag, so flip it in the mock too.
    auth.fetchUser = vi.fn().mockImplementation(async () => {
      auth.isAuthenticated = false;
      throw new Error("no usable identity");
    });
    const { router, run } = makeRouter();
    createAuthGuard(router, { ...baseOpts, useAuthStore: () => auth });

    const verdict = await run({ name: "demiurge", fullPath: "/@ws123", meta: { requiresAuth: true } });
    expect(verdict).toEqual({ name: "login", query: { redirect: "/@ws123" } });
    expect(auth.fetchUser).toHaveBeenCalledOnce();
  });

  it("keeps the route when the fetch fails but the session stays authenticated", async () => {
    // Transient transport failure: the shell's own safety net retries —
    // the guard must not bounce the user on a blip.
    const auth = makeAuthStore({
      isAuthenticated: true,
      fetchUser: vi.fn().mockRejectedValue(new Error("timed out")),
    });
    const { router, run } = makeRouter();
    createAuthGuard(router, { ...baseOpts, useAuthStore: () => auth });

    const verdict = await run({ name: "demiurge", fullPath: "/@ws123", meta: { requiresAuth: true } });
    expect(verdict).toBeUndefined();
  });

  it("lets a hydrated identity through without refetching", async () => {
    const auth = makeAuthStore({
      isAuthenticated: true,
      user: { username: "demiurge" },
      fetchUser: vi.fn(),
    });
    const { router, run } = makeRouter();
    createAuthGuard(router, { ...baseOpts, useAuthStore: () => auth });

    const verdict = await run({ name: "demiurge", fullPath: "/@ws123", meta: { requiresAuth: true } });
    expect(verdict).toBeUndefined();
    expect(auth.fetchUser).not.toHaveBeenCalled();
  });

  it("retries session restore after a failed attempt instead of memoizing it", async () => {
    // Regression (user report 2026-09-07): a failed restore used to stay
    // memoized for the SPA lifetime, so once the guard's first
    // tryRestoreSession raced a network blip, the only way back in was a
    // manual reload. The memo must reset on failure so the next
    // navigation retries — with valid cookies the retry recovers.
    const auth = makeAuthStore();
    auth.tryRestoreSession = vi
      .fn<() => Promise<void>>()
      .mockImplementationOnce(async () => {
        throw new Error("restore raced a blip");
      })
      .mockImplementationOnce(async () => {
        auth.isAuthenticated = true;
      });
    const { router, run } = makeRouter();
    createAuthGuard(router, { ...baseOpts, useAuthStore: () => auth });

    // First navigation: restore fails → bounced to the login route.
    const first = await run({ name: "demiurge", fullPath: "/@ws123", meta: { requiresAuth: true } });
    expect(first).toEqual({ name: "login", query: { redirect: "/@ws123" } });

    // Second navigation: the restore retries and succeeds → route passes.
    const second = await run({ name: "demiurge", fullPath: "/@ws123", meta: { requiresAuth: true } });
    expect(auth.tryRestoreSession).toHaveBeenCalledTimes(2);
    expect(second).toBeUndefined();
  });
});
