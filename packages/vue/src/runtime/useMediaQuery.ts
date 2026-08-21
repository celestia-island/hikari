/**
 * Zero-dependency `useMediaQuery` — a reactive `matchMedia` ref.
 *
 * Downstream apps (chest webui) previously pulled `useMediaQuery` from
 * `@vueuse/core` while the sibling apps had no media-query composable at
 * all, so viewport logic forked between "has vueuse" and "hand-rolled
 * listeners". This is the shared replacement: one `MediaQueryList`
 * subscription per query string (shared across callers), a readonly
 * `Ref<boolean>`.
 *
 * SSR-safe: falls back to a static `false` when `window` is absent.
 */
import { readonly, ref, type Ref } from "vue";

interface Entry {
  mql: MediaQueryList;
  listener: (e: MediaQueryListEvent) => void;
  count: number;
  value: Ref<boolean>;
}

const registry = new Map<string, Entry>();

/**
 * Reactive media query. The returned ref is shared for identical query
 * strings and read-only for consumers.
 *
 * Example: `const isMobile = useMediaQuery("(max-width: 767px)")`
 */
export function useMediaQuery(query: string): Readonly<Ref<boolean>> {
  const existing = registry.get(query);
  if (existing) {
    existing.count += 1;
    return readonly(existing.value);
  }
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    // SSR / test fallback: static ref, never subscribed, never released.
    return readonly(ref(false));
  }
  const mql = window.matchMedia(query);
  const value = ref(mql.matches);
  const listener = (e: MediaQueryListEvent) => {
    value.value = e.matches;
  };
  if (typeof mql.addEventListener === "function") {
    mql.addEventListener("change", listener);
  } else {
    // Ancient Safari fallback.
    const legacy = mql as MediaQueryList & {
      addListener?: (l: (e: MediaQueryListEvent) => void) => void;
    };
    legacy.addListener?.(listener);
  }
  registry.set(query, { mql, listener, count: 1, value });
  return readonly(value);
}

/**
 * Drop one reference to a query's shared subscription; the underlying
 * `MediaQueryList` listener is removed when the last consumer releases.
 * Pair with {@link useMediaQuery} in `onUnmounted` when the consumer is a
 * component (module-level callers may keep it for the app lifetime).
 */
export function releaseMediaQuery(query: string): void {
  const entry = registry.get(query);
  if (!entry) return;
  entry.count -= 1;
  if (entry.count > 0) return;
  registry.delete(query);
  if (typeof entry.mql.removeEventListener === "function") {
    entry.mql.removeEventListener("change", entry.listener);
  } else {
    const legacy = entry.mql as MediaQueryList & {
      removeListener?: (l: (e: MediaQueryListEvent) => void) => void;
    };
    legacy.removeListener?.(entry.listener);
  }
}

/** Test/teardown hook — drops every subscription. Not for app code. */
export function __teardownMediaQueries(): void {
  for (const [query, entry] of registry) {
    if (typeof entry.mql.removeEventListener === "function") {
      entry.mql.removeEventListener("change", entry.listener);
    }
    void query;
  }
  registry.clear();
}
