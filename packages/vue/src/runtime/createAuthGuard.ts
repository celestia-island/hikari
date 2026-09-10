/**
 * Shared auth route guard (family runtime).
 *
 * Upstreamed from shittim-chest (its copy was the most evolved form:
 * setupWizardRoute split, permissions-store factory, session-restore
 * retry, fetchUser failure semantics) to replace the per-repo forks —
 * easy-hydro-erp carried an older vendored copy under
 * `src/vendor/plana-ui/`. Structurally typed: no vue-router or pinia
 * dependency, so hikari stays UI-library-scoped and any router-shaped
 * object works.
 */

export interface AuthGuardOptions {
  loginRoute: string;
  homeRoute: string;
  setupRoute: string;
  /**
   * Optional distinct wizard route that actually performs initial setup.
   * Some apps split the flow into a redirect/landing page (`setupRoute`,
   * e.g. locale detection) and the wizard itself (`setupWizardRoute`). When
   * `needs_setup` is true the guard must allow BOTH, otherwise the landing
   * page can never navigate into the wizard (infinite redirect loop).
   */
  setupWizardRoute?: string;
  registerRoute?: string;
  useAuthStore: () => {
    isAuthenticated: boolean;
    user: unknown;
    tryRestoreSession: () => Promise<void>;
    checkSetup: () => Promise<{ needs_setup: boolean; registration_enabled?: boolean }>;
    // The guard only awaits the call — the store's `User` result is unused.
    fetchUser: () => Promise<unknown>;
  };
  onLazyLoadError?: (error: Error, target: string) => void;
  /**
   * Permissions store factory; optional — skipped when omitted. A factory
   * (not an instance) because pinia is installed after this module
   * evaluates: the router is created at module scope, so an eager
   * `usePermissionsStore()` here would run without an active pinia.
   */
  permissions?: () => {
    loaded: boolean;
    fetch: () => Promise<void>;
    has: (perm: string) => boolean;
    hasAny: (perms: string[]) => boolean;
  } | undefined;
}

interface GuardRoute {
  name?: string | symbol | null;
  fullPath?: string;
  meta?: Record<string, unknown>;
}

interface GuardRouter {
  // Accepts any guard signature (vue-router's NavigationGuard takes extra
  // args; slimmer routers take fewer) — the callback just inspects `to`.
  // The guard callback receives the route; vue-router also passes from/next
  // which we ignore. `never`-parameter variance keeps both sides assignable.
  beforeEach: (fn: (to: GuardRoute, ...rest: unknown[]) => unknown) => void;
  onError?: (fn: (error: unknown, to: GuardRoute) => void) => void;
}

export function createAuthGuard(router: GuardRouter, opts: AuthGuardOptions) {
  let sessionRestorePromise: Promise<void> | null = null;
  let setupChecked = false;

  router.beforeEach(async (to: GuardRoute) => {
    const auth = opts.useAuthStore();
    const permStore = opts.permissions?.();

    if (!auth.isAuthenticated) {
      if (!sessionRestorePromise) {
        sessionRestorePromise = auth.tryRestoreSession().catch(() => {
          // A failed restore must not stay memoized for the SPA
          // lifetime: the cookies may be perfectly valid and the first
          // attempt may just have raced a network blip. Nulling here
          // lets the next navigation (e.g. the login page's silent
          // restore, or simply clicking another route) retry.
          sessionRestorePromise = null;
        });
      }
      await sessionRestorePromise;
    }

    if (!setupChecked && !auth.isAuthenticated) {
      setupChecked = true;
      try {
        const result = await auth.checkSetup();
        const setupAllowed = [opts.setupRoute, opts.setupWizardRoute].filter(Boolean);
        if (result.needs_setup && !setupAllowed.includes(to.name as string)) {
          return { name: opts.setupRoute };
        }
        if (!result.needs_setup && to.name === opts.setupRoute) {
          return { name: opts.loginRoute };
        }
        if (
          !result.registration_enabled &&
          opts.registerRoute &&
          to.name === opts.registerRoute
        ) {
          return { name: opts.loginRoute };
        }
      } catch {
        // ignore
      }
    }

    if (to.meta?.requiresAuth !== false && !auth.isAuthenticated) {
      const redirect = to.fullPath && to.fullPath !== "/" ? to.fullPath : undefined;
      return { name: opts.loginRoute, query: redirect ? { redirect } : undefined };
    }

    if (auth.isAuthenticated && permStore && !permStore.loaded) {
      await permStore.fetch();
    }

    const publicRoutes = [opts.loginRoute, opts.setupRoute];
    if (opts.registerRoute) publicRoutes.push(opts.registerRoute);
    if (publicRoutes.includes(to.name as string) && auth.isAuthenticated) {
      return "/";
    }

    if (auth.isAuthenticated && !auth.user) {
      // Identity hydration on a session-restored client. The fetch's
      // own failure path already clears the local session (see
      // useAuthBase — deliberately NOT a cookie-clearing logout), so the
      // only job here is to not let the rejection kill the navigation
      // — an aborted guard is reported to router.onError, where it was
      // misclassified as a lazy-load chunk failure and retried in a
      // loop. Redirect to the login page instead; if the fetch
      // succeeded the route renders with a real identity.
      try {
        await auth.fetchUser();
      } catch {
        if (!auth.isAuthenticated) {
          const redirect = to.fullPath && to.fullPath !== "/" ? to.fullPath : undefined;
          return { name: opts.loginRoute, query: redirect ? { redirect } : undefined };
        }
        // Transient failure while still authenticated: let the route
        // through — the shell's own authed-watch retries hydration.
      }
    }

    // Enforce meta-declared route permissions (`requiresPermission`). The
    // meta has been declared since the admin console landed (/backend with
    // "system.read") but was never consumed — AdminLayout hides its own
    // nav for callers lacking the permission, yet the route itself rendered
    // for ANY authenticated user (field report 2026-09: a non-admin opened
    // the console route from the user menu and got a broken half-page).
    // Deny only when a permission set is actually loaded; a store outage
    // (fetch failed, loaded=false) fails open exactly like before instead
    // of bricking navigation.
    const required = to.meta?.requiresPermission as string | string[] | undefined;
    if (
      auth.isAuthenticated &&
      permStore &&
      required !== undefined &&
      permStore.loaded &&
      !(Array.isArray(required) ? permStore.hasAny(required) : permStore.has(required))
    ) {
      return { name: opts.homeRoute };
    }
  });

  if (opts.onLazyLoadError) {
    router.onError?.((error: unknown, to: GuardRoute) => {
      opts.onLazyLoadError!(error as Error, to.fullPath ?? "");
    });
  }
}
