/**
 * Site meta — the ONE place the family reads deployment-injected site
 * metadata (GA measurement id boot tag, compliance/beian footer lines).
 *
 * Hosts used to duplicate this logic per repo (erp
 * `packages/webui/src/analytics.ts`, chest `packages/webui/src/analytics.ts`,
 * chest `packages/chest-app/src/static_files.rs`, erp
 * `packages/core/src/routes/auth.rs`); the user ruling (2026-11-27) lifted
 * the shared, cross-host site variables into hikari — names and parsing are
 * defined once here.
 *
 * This module is pure functions/constants only (no Vue reactivity, no
 * loader injection) — the `useSiteMeta` composable builds on it in a later
 * slice.
 */

/**
 * DOM id of the JSON boot tag carrying the GA4 measurement id. Both hosts
 * inject `<script type="application/json" id="celestia-ga-measurement-id">`
 * into the served SPA shell (erp: `CELESTIA_GA_MEASUREMENT_ID` via
 * `packages/core/src/main.rs`; chest: `CHEST_GA_MEASUREMENT_ID` via
 * `packages/chest-app/src/static_files.rs`) — the constant is the
 * intersection of both repos' `GA_TAG_ID` and is the single definition now.
 */
export const GA_TAG_ID = "celestia-ga-measurement-id";

/**
 * Strict GA4 measurement-id shape: `G-` prefix + 1..=32 uppercase
 * alphanumerics. Rule sourced from chest
 * `packages/chest-app/src/static_files.rs` (`G-` + 1..=32 A-Z0-9), which
 * matches the erp core gate on `CELESTIA_GA_MEASUREMENT_ID`; both webui
 * `analytics.ts` copies implement the identical regex. Defensive by design:
 * the value is echoed back into served HTML, so anything outside the issued
 * shape counts as absent.
 */
export function isValidGaMeasurementId(raw: string): boolean {
  return raw.startsWith("G-") && /^[A-Z0-9]{1,32}$/.test(raw.slice(2));
}

/**
 * Read the GA measurement id from the served document's boot tag. Returns
 * null on every failure mode (tag missing, empty/whitespace content,
 * envsubst leftover `$VAR` / `__VAR__` placeholder, malformed id) — every
 * failure means "tracking disabled", never a throw.
 *
 * Read/placeholder semantics mirror the two hosts' `resolveMeasurementId`
 * (their common intersection): `textContent` is trimmed, and a raw `$…` or
 * `__…` prefix means the injection channel never ran. A malformed
 * non-placeholder value silently returns null so a misconfigured deployment is
 * discoverable in the console without polluting the page.
 */
export function readGaMeasurementId(doc: Document = document): string | null {
  let raw: string | null;
  try {
    raw = doc.getElementById(GA_TAG_ID)?.textContent?.trim() ?? null;
  } catch {
    return null; // doc-less context (prerender / workers)
  }
  if (raw === null || raw.length === 0 || raw.startsWith("$") || raw.startsWith("__")) {
    return null;
  }
  if (!isValidGaMeasurementId(raw)) {
    // Silent, exactly like both hosts' analytics.ts: the boot tag is our own
    // deployment's payload, so an invalid id is a deploy-time mistake that
    // other signals already surface — per-call warnings here would only spam
    // re-renders.
    return null;
  }
  return raw;
}

/** One compliance footer line: a title and an optional http(s) link. */
export interface SiteBeianLine {
  title: string;
  url?: string;
}

/**
 * Parse the `beian_lines` setting (a JSON array of `{title, url?}`) into
 * footer lines. Semantics aligned line-by-line with erp
 * `packages/core/src/routes/auth.rs::sanitize_beian_lines` (the only
 * backend that ships beian lines; chest's `CHEST_FOOTER_EXTRA` is a
 * different shape and NOT handled here):
 *
 * - Non-JSON input, JSON that is not an array (`"null"`, objects, …) → `[]`.
 * - An entry survives only as an object with a non-empty string `title`
 *   after trim; the title is capped at 64 characters (code points).
 * - `url` absent or JSON null → plain-text line (`url` undefined).
 * - A present string `url` is trimmed; empty after trim → plain-text line;
 *   otherwise it must start with `https://` or `http://` — a present but
 *   malformed url (relative, `javascript:`) drops the WHOLE entry, per the
 *   erp contract (half-rendered filing lines are worse than absent ones).
 * - A non-string `url` drops the entry.
 * - Output is capped at the first 4 surviving entries.
 */
export function parseBeianLines(raw: string): Array<SiteBeianLine> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const lines: Array<SiteBeianLine> = [];
  for (const entry of parsed) {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) continue;
    const record = entry as Record<string, unknown>;
    const titleRaw = record["title"];
    if (typeof titleRaw !== "string") continue;
    const title = titleRaw.trim();
    if (title.length === 0 || [...title].length > 64) continue;
    const urlRaw = record["url"];
    let url: string | undefined;
    if (urlRaw !== undefined && urlRaw !== null) {
      if (typeof urlRaw !== "string") continue;
      const trimmed = urlRaw.trim();
      if (trimmed.length === 0) {
        url = undefined;
      } else if (trimmed.startsWith("https://") || trimmed.startsWith("http://")) {
        url = trimmed;
      } else {
        continue; // present-but-malformed url drops the whole entry
      }
    }
    const line: SiteBeianLine = { title };
    if (url !== undefined) line.url = url;
    lines.push(line);
    if (lines.length === 4) break;
  }
  return lines;
}

/**
 * DOM id of the JSON boot tag carrying the raw `beian_lines` value (the
 * JSON array `parseBeianLines` consumes). Hosts that ship a build-time
 * pipeline inject it as `<script type="application/json" id="…">`; hosts
 * that resolve the setting server-side (erp serves the already-parsed array
 * on `/api/auth/login-methods`) simply never emit it — absence reads as an
 * empty footer, never as an error.
 */
export const BEIAN_TAG_ID = "celestia-beian-lines";

/**
 * Read the beian lines from the served document's boot tag. Every failure
 * mode (no document, tag absent, empty/whitespace content, envsubst
 * leftovers `$…` / `__…`) reads as "no compliance lines"; a present but
 * malformed JSON array also reads as `[]` rather than throwing, because a
 * misconfigured deployment must not break the shell's footer render.
 */
export function readBeianLines(doc: Document = document): Array<SiteBeianLine> {
  let raw: string | null;
  try {
    raw = doc.getElementById(BEIAN_TAG_ID)?.textContent?.trim() ?? null;
  } catch {
    return []; // doc-less context (prerender / workers)
  }
  if (raw === null || raw.length === 0 || raw.startsWith("$") || raw.startsWith("__")) {
    return [];
  }
  return parseBeianLines(raw);
}

/** What one site's deployment injected: the GA id and the compliance lines. */
export interface SiteMeta {
  /** GA4 measurement id, or null when this deployment ships no tracking. */
  gaMeasurementId: string | null;
  /** Compliance/beian footer lines, already sanitized; empty when absent. */
  beianLines: Array<SiteBeianLine>;
}

/**
 * Read every host-injected site variable in one call. Deliberately NOT a
 * Vue composable: nothing here is reactive (the boot tags are written once
 * into the served document before any script runs, and never change for
 * the life of the page), so wrapping it in `ref`s would only add weight.
 * Hosts call it once at boot — erp/chest pass the result into their
 * analytics + footer, static sites read it in the same place.
 *
 * `doc` is injectable so tests (and prerender contexts) never touch the
 * ambient `document`.
 */
export function readSiteMeta(doc: Document = document): SiteMeta {
  return {
    gaMeasurementId: readGaMeasurementId(doc),
    beianLines: readBeianLines(doc),
  };
}
