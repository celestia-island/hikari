/**
 * Storage access that survives an environment without DOM storage.
 *
 * Two failure modes are covered, both of which used to reach the caller as a
 * hard crash:
 *
 * - **SSR / non-DOM hosts** — `localStorage` is not defined at all, so a bare
 *   reference throws `ReferenceError`. Every read degrades to "nothing
 *   stored" and every write becomes a no-op, which is exactly the semantics a
 *   server render wants (the client re-reads after hydration).
 * - **Storage that exists but refuses** — Safari private mode and
 *   quota-exhausted origins throw on `setItem`, and some embedded webviews
 *   throw on the property access itself. Reads also degrade, writes no-op.
 *
 * Deliberately NOT a cache: each call re-resolves the global, so tests (and
 * hosts) that replace `localStorage` between calls — or that spy on it — see
 * the object they installed, not one captured at import time.
 */

function storage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    // Accessing the property itself can throw (locked-down webviews).
    return null;
  }
}

/** Whether a usable localStorage object is reachable right now. */
export function hasStorage(): boolean {
  return storage() !== null;
}

export function readStorageItem(key: string): string | null {
  try {
    return storage()?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

export function writeStorageItem(key: string, value: string): void {
  try {
    storage()?.setItem(key, value);
  } catch {
    // Quota / private mode: persisting is best-effort, never fatal.
  }
}

export function removeStorageItem(key: string): void {
  try {
    storage()?.removeItem(key);
  } catch {
    // Best-effort, same as writeStorageItem.
  }
}
