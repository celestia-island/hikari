import { reportError, type HkReportedError } from "./state";

/**
 * Server error landing handoff — the contract between a family SERVER and
 * the SPA it serves, for the errors a browser reaches by NAVIGATION.
 *
 * `createErrorReporting` catches what happens after the app is running. It
 * cannot catch the failure that never lets the app start: a server that
 * answers a top-level navigation with a bare `{"error": …}` body (an OAuth
 * callback whose token exchange failed, a revoked share link, a 502 from a
 * restart window) shows the visitor raw JSON in the tab — no landing, no
 * way back, nothing to copy but what the viewport holds (the 2026-11-26
 * res.celestia.world report).
 *
 * The handoff closes that gap with the page itself as the carrier. The
 * server answers with the SPA's own `index.html` at the REAL status code,
 * with one JSON data island injected:
 *
 * ```html
 * <script type="application/json" id="hk-server-error">
 *   {"v":1,"status":502,"code":"identity_provider_unreachable",
 *    "message":"identity provider unreachable: …","raw":{"error":"…"}}
 * </script>
 * ```
 *
 * `createErrorReporting().install` reads the island (once — the element is
 * consumed) and raises the same takeover a runtime error gets, with the
 * HTTP status and the server's raw payload on the card. A data block is
 * never executed, so it passes a `script-src 'self'` policy untouched, and
 * {@link serializeServerErrorLanding} escapes the few characters that could
 * let the payload close the island or read as markup.
 *
 * The island is the WHOLE contract: nothing here knows a URL scheme, a
 * header name or a service, so any server facing a browser can produce it
 * (the Rust side lives in plana's `plana-error-landing`).
 */

/** Element id of the JSON island a server injects into its index.html. */
export const SERVER_ERROR_LANDING_ID = "hk-server-error";

/** The only island shape this build understands (`v` in the payload). */
export const SERVER_ERROR_LANDING_VERSION = 1;

/** Lowest status a handoff may carry: the error classes, nothing below. */
const MIN_HANDOFF_STATUS = 400;
const MAX_HANDOFF_STATUS = 599;

/** A validated server handoff: what the card shows, plus the raw body. */
export interface HkServerErrorLanding {
  /** The HTTP status the server ANSWERED with — shown as the `HTTP <n>` chip. */
  readonly status: number;
  /** Wire error code shown as the code chip (`unknown_provider`). Empty
   *  falls back to `http_<status>`. */
  readonly code: string;
  /** The server's human-readable explanation — the card's description. */
  readonly message: string;
  /** The response body the server would have sent as JSON (an object, an
   *  array, a string …). Rendered in the raw-details pane; absent when the
   *  server had nothing to hand over. */
  readonly raw?: unknown;
}

/**
 * The error object a server handoff is reported through — the counterpart
 * of the runtime errors the window hooks catch. `name` is the code chip, so
 * it reads as the wire code when the server sent one and as `http_<status>`
 * when it did not; `status` and `details` ride the report onto the card.
 * `reportError` copies both off ANY object reported with the `server`
 * source (duck-typed), so a host's own subclass can carry them without
 * importing this one; a runtime error is never inspected for them.
 */
export class HkServerErrorLandingError extends Error {
  readonly status: number;
  readonly code: string;
  readonly raw: unknown;
  readonly landing: HkServerErrorLanding;

  constructor(landing: HkServerErrorLanding) {
    super(landing.message);
    // Trimmed here too, not only in the parser: a host constructing this
    // class by hand gets the same chip a parsed island would.
    this.name = landing.code.trim() || `http_${landing.status}`;
    this.status = landing.status;
    this.code = landing.code.trim();
    this.raw = landing.raw;
    this.landing = landing;
  }

  /** The wire field under the name the report carries (`reportError` reads
   *  `details`, whatever class the error is). Same value as `raw`. */
  get details(): unknown {
    return this.raw;
  }
}

/**
 * Validate an island's text into a handoff, or `null` for anything this
 * build must not render: a JSON syntax error, a non-object, another
 * `v` (a future shape — ignored rather than half-rendered), a status
 * outside the error classes. Unknown keys are ignored, so a newer server
 * can add fields without breaking an older SPA.
 */
export function parseServerErrorLanding(text: string): HkServerErrorLanding | null {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (record.v !== SERVER_ERROR_LANDING_VERSION) return null;
  const status = record.status;
  if (
    typeof status !== "number" ||
    !Number.isInteger(status) ||
    status < MIN_HANDOFF_STATUS ||
    status > MAX_HANDOFF_STATUS
  ) {
    return null;
  }
  const landing: { status: number; code: string; message: string; raw?: unknown } = {
    status,
    code: typeof record.code === "string" ? record.code.trim() : "",
    message: typeof record.message === "string" ? record.message : "",
  };
  if (record.raw !== undefined) landing.raw = record.raw;
  return landing;
}

/**
 * Serialize a handoff as island text. Besides `v`, the output differs from
 * plain `JSON.stringify` in one way that matters: `<`, `>` and `&` leave as
 * `\u003c`-style escapes, so no payload — however hostile — can close the
 * `<script>` element or be read as markup by a parser that never sees the
 * island as a data block (`JSON.parse` turns the escapes back).
 */
export function serializeServerErrorLanding(landing: HkServerErrorLanding): string {
  const body =
    landing.raw === undefined
      ? { v: SERVER_ERROR_LANDING_VERSION, status: landing.status, code: landing.code, message: landing.message }
      : {
          v: SERVER_ERROR_LANDING_VERSION,
          status: landing.status,
          code: landing.code,
          message: landing.message,
          raw: landing.raw,
        };
  return JSON.stringify(body)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

/**
 * Read the handoff out of the document — once. The island is REMOVED on the
 * first read, valid or not: a reinstall (HMR, a second app instance on the
 * same document) must not re-raise a landing the visitor already saw or
 * dismissed, and a malformed island must not be retried on every install.
 * `null` when the document carries no island or the island is unusable.
 */
export function readServerErrorLanding(root: ParentNode = document): HkServerErrorLanding | null {
  const island = root.querySelector<HTMLScriptElement>(
    `script#${SERVER_ERROR_LANDING_ID}[type="application/json"]`,
  );
  if (!island) return null;
  island.remove();
  return parseServerErrorLanding(island.textContent ?? "");
}

/**
 * Raise the global error landing for a server handoff — the navigation-time
 * counterpart of `reportGlobalError`. Goes through the same acceptance
 * (`shouldReport`, first-error-wins, `onError`) as every other source, so
 * a host filters or logs it exactly like a runtime error.
 */
export function reportServerErrorLanding(landing: HkServerErrorLanding): HkReportedError | null {
  return reportError(new HkServerErrorLandingError(landing), "server");
}
