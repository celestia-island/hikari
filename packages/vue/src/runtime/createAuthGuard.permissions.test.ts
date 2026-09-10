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

/** Permissions-store double mirroring the real store's semantics:
 *  `fetch()` resolves the set and flips loaded=true; a failing fetch
 *  leaves loaded=false (fail-open). */
function makePermStore(init: { loaded?: boolean; perms?: string[]; failFetch?: boolean } = {}) {
  const state = { loaded: init.loaded ?? false, perms: init.perms ?? [] };
  return {
    get loaded() { return state.loaded; },
    fetch: vi.fn().mockImplementation(async () => {
      if (init.failFetch) return;
      state.perms = init.perms ?? [];
      state.loaded = true;
    }),
    has: (perm: string) => state.perms.includes(perm),
    hasAny: (perms: string[]) => perms.some((p) => state.perms.includes(p)),
  };
}

const baseOpts = {
  loginRoute: "login",
  homeRoute: "demiurge",
  setupRoute: "setup-redirect",
};

describe("createAuthGuard requiresPermission enforcement", () => {
  // Contract: routes declare `requiresPermission` (e.g. /backend with
  // "system.read") and the guard is the enforcement point. The meta used
  // to be declared but never consumed — any authenticated user could
  // open the admin console route and only AdminLayout's own nav filtering
  // hid the views (field report 2026-09).
  it("bounces a user lacking the required permission to the home route", async () => {
    const auth = makeAuthStore({ isAuthenticated: true, user: { username: "momoi" } });
    const perms = makePermStore({ perms: [] });
    const { router, run } = makeRouter();
    createAuthGuard(router, { ...baseOpts, useAuthStore: () => auth, permissions: () => perms });

    const verdict = await run({
      name: "admin",
      fullPath: "/backend",
      meta: { requiresAuth: true, requiresPermission: "system.read" },
    });
    expect(verdict).toEqual({ name: "demiurge" });
    expect(perms.fetch).toHaveBeenCalledOnce();
  });

  it("admits a user holding the required permission", async () => {
    const auth = makeAuthStore({ isAuthenticated: true, user: { username: "demiurge" } });
    const perms = makePermStore({ loaded: true, perms: ["system.read"] });
    const { router, run } = makeRouter();
    createAuthGuard(router, { ...baseOpts, useAuthStore: () => auth, permissions: () => perms });

    const verdict = await run({
      name: "admin",
      fullPath: "/backend",
      meta: { requiresAuth: true, requiresPermission: "system.read" },
    });
    expect(verdict).toBeUndefined();
    // Already-loaded set must not be refetched on every navigation.
    expect(perms.fetch).not.toHaveBeenCalled();
  });

  it("accepts any-of lists via hasAny", async () => {
    const auth = makeAuthStore({ isAuthenticated: true, user: { username: "u" } });
    const perms = makePermStore({ loaded: true, perms: ["industrial.write"] });
    const { router, run } = makeRouter();
    createAuthGuard(router, { ...baseOpts, useAuthStore: () => auth, permissions: () => perms });

    const verdict = await run({
      name: "writer",
      fullPath: "/somewhere",
      meta: { requiresPermission: ["system.read", "industrial.write"] },
    });
    expect(verdict).toBeUndefined();
  });

  it("fails open while the permission set is unloaded (store outage must not brick navigation)", async () => {
    const auth = makeAuthStore({ isAuthenticated: true, user: { username: "u" } });
    const perms = makePermStore({ failFetch: true });
    const { router, run } = makeRouter();
    createAuthGuard(router, { ...baseOpts, useAuthStore: () => auth, permissions: () => perms });

    const verdict = await run({
      name: "admin",
      fullPath: "/backend",
      meta: { requiresAuth: true, requiresPermission: "system.read" },
    });
    expect(verdict).toBeUndefined();
  });

  it("ignores routes without the meta and unwired permission stores", async () => {
    const auth = makeAuthStore({ isAuthenticated: true, user: { username: "u" } });
    const { router, run } = makeRouter();
    createAuthGuard(router, { ...baseOpts, useAuthStore: () => auth });

    const verdict = await run({ name: "demiurge", fullPath: "/@ws", meta: { requiresAuth: true } });
    expect(verdict).toBeUndefined();
  });
});
