/**
 * Last-line safety net over the History API (family runtime).
 *
 * Upstreamed from shittim-chest #754, where the field class was first
 * sealed app-locally: a navigation producer whose target stringifies
 * without a leading "/" (the classic being an interpolated `undefined`)
 * makes vue-router's HTML5 history compose `origin + base + to` into a
 * CROSS-ORIGIN URL; the native pushState then throws a SecurityError
 * and vue-router's catch branch performs a FULL-PAGE
 * `location.assign(url)` onto the broken host — observed in the field
 * as `https://<host>undefined/`. Guards ABOVE the router only protect
 * navigations that flow through them; a stale-tab mixed module graph,
 * a future call site, or any direct `history.pushState(garbage)` all
 * bypass them. This net sits BELOW everything: it patches
 * `History.prototype.pushState/replaceState` so an off-origin URL (or
 * a bare poisoned literal, or unparseable garbage) is folded onto the
 * app landing BEFORE the native call — with the throw gone, the
 * full-page fallback for this class is structurally unreachable.
 *
 * Every coercion logs a console warning carrying the producer stack
 * trace and appends to a bounded sessionStorage evidence trail so the
 * next field occurrence can be attributed.
 */

/** Bare literals that read as a producer bug, never a real target. */
const POISONED_LITERALS = new Set(["undefined", "null", "nan"]);

/** sessionStorage evidence budget: keep the newest N coerced targets. */
const EVIDENCE_MAX = 8;
const DEFAULT_EVIDENCE_KEY = "hikari:historyNet";

export interface HistorySafetyNetOptions {
  /** Where coerced targets fold to. Must be an in-app absolute path.
   *  Defaults to `"/"`. */
  fallback?: string;
  /** sessionStorage key for the evidence trail. Pass `false` to
   *  disable persistence (the console trail always stays). */
  evidenceKey?: string | false;
  /** Extra sink for coercions (app telemetry, tests). */
  onCoercion?: (info: HistoryCoercion) => void;
}

export interface HistoryCoercion {
  method: "pushState" | "replaceState";
  raw: string;
  foldedTo: string;
}

/** Coerce a would-be history URL onto a safe same-origin target.
 *
 *  - `null`-ish / empty passes through untouched (no-ops stay no-ops);
 *  - same-origin resolutions pass through untouched;
 *  - anything that resolves off-origin (the `origin + "undefined"`
 *    concatenation class, absolute foreign URLs) folds to the
 *    fallback;
 *  - bare poisoned literals ("undefined") fold too — as relative URLs
 *    they would stay same-origin, but they are always producer bugs
 *    and deserve the same hard stop.
 */
export function sanitizeHistoryUrl(
  raw: string | URL | null | undefined,
  fallback = "/",
): string | URL | null {
  if (raw == null || raw === "") return raw as string | URL | null;
  const asUrl = raw instanceof URL ? raw : null;
  const s = asUrl ? asUrl.href : String(raw);
  const trimmed = s.trim();
  if (POISONED_LITERALS.has(trimmed.toLowerCase())) return fallback;
  let resolved: URL;
  try {
    resolved = new URL(s, window.location.href);
  } catch {
    return fallback;
  }
  return resolved.origin === window.location.origin ? (raw as string | URL) : fallback;
}

/** Marker stamped on patched methods so re-install stays a no-op while
 *  a genuine overwrite (another lib restoring the prototype, or a test
 *  harness) is detected and re-patched. */
const PATCH_MARKER = "__hikariHistoryNet";

/** Patch History.prototype. Safe to call multiple times: already-
 *  patched methods are left alone, but a method overwritten back to a
 *  foreign implementation is patched again (self-healing). */
export function installHistorySafetyNet(options: HistorySafetyNetOptions = {}): void {
  const fallback = options.fallback ?? "/";
  const evidenceKey = options.evidenceKey === undefined ? DEFAULT_EVIDENCE_KEY : options.evidenceKey;
  for (const method of ["pushState", "replaceState"] as const) {
    const current: unknown = (History.prototype as unknown as Record<string, unknown>)[method];
    if (
      typeof current === "function" &&
      (current as { [PATCH_MARKER]?: boolean })[PATCH_MARKER] === true
    ) {
      continue;
    }
    const native = current as (this: History, state: unknown, title: string, url?: string | URL | null) => unknown;
    if (typeof native !== "function") continue;
    const patched = function (this: History, state: unknown, title: string, url?: string | URL | null) {
      const safe = sanitizeHistoryUrl(url, fallback);
      if (safe !== url) {
        const info: HistoryCoercion = { method, raw: String(url ?? ""), foldedTo: fallback };
        reportCoercion(info, evidenceKey, options);
      }
      return native.call(this, state as never, title, safe as never);
    };
    (patched as { [PATCH_MARKER]?: boolean })[PATCH_MARKER] = true;
    try {
      Object.defineProperty(History.prototype, method, {
        value: patched,
        writable: true,
        // Match the WebIDL shape of native prototype operations
        // (enumerable) so Object.keys/for...in keep seeing the methods.
        enumerable: true,
        configurable: true,
      });
    } catch {
      // Non-configurable prototype (locked-down environment) — the
      // layers above (router guard, sanitized producers) still hold.
    }
  }
}

/** Log loudly and keep a bounded sessionStorage trail for attribution. */
function reportCoercion(
  info: HistoryCoercion,
  evidenceKey: string | false,
  options: HistorySafetyNetOptions,
): void {
  console.warn(
    `[HistoryNet] Blocked off-origin history ${info.method} target ${JSON.stringify(info.raw)} — folded to ${JSON.stringify(info.foldedTo)}`,
    new Error("producer stack").stack,
  );
  options.onCoercion?.(info);
  if (evidenceKey === false) return;
  const entry = `${new Date().toISOString()} ${info.method}: ${JSON.stringify(info.raw)} -> ${info.foldedTo}`;
  try {
    const prev = JSON.parse(sessionStorage.getItem(evidenceKey) || "[]");
    // A corrupted/non-array payload must not kill the trail forever —
    // start a fresh list instead of skipping every future write.
    const list = Array.isArray(prev) ? prev : [];
    list.push(entry);
    sessionStorage.setItem(evidenceKey, JSON.stringify(list.slice(-EVIDENCE_MAX)));
  } catch { /* storage unavailable — the console trail is enough */ }
}
