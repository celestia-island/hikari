// Mobile viewport policy hook — the upstream half of the "mobile web UX"
// contract (2026-08-30 wave, user-reported: webuis on phones refused zoom).
//
// Consuming apps call `applyViewportPolicy()` once during bootstrap (before
// first paint), and hikari guarantees the document's viewport meta:
//
//   1. `width=device-width` is present (added when missing).
//   2. Zoom is never refused: `user-scalable=no`, `maximum-scale` caps and
//      `minimum-scale>=1` blockers are stripped and an explicit
//      `user-scalable=yes` is written back. Desktop-first layouts can then be
//      pinch-zoomed both ways (with `allowZoomOut` we also pin
//      `minimum-scale` so iOS — which clamps zoom-out at minimum-scale —
//      can fit a wide dashboard on screen).
//   3. Everything else on the meta (`initial-scale`, `viewport-fit`,
//      `interactive-widget`, vendor keys) is preserved verbatim.
//
// The hook is idempotent and cheap: re-running produces the same string, so
// layouts may call it defensively on every mount without thrashing the DOM.

/** Options for {@link applyViewportPolicy}. */
export interface ApplyViewportPolicyOptions {
  /**
   * Guarantee that pinch zoom stays available (default `true`). When set,
   * zoom-blocking keys (`user-scalable=no`, `maximum-scale`, blocking
   * `minimum-scale`) are stripped and `user-scalable=yes` is written.
   */
  allowZoom?: boolean;
  /**
   * Allow zooming OUT below the initial scale — needed by desktop-first
   * layouts on iOS, which clamps zoom-out at `minimum-scale`.
   * - `true` → pin `minimum-scale=0.25` (fits a ~4× device-width layout).
   * - number → pin that exact scale (clamped to `(0, 1]`).
   * - `false`/`undefined` → leave any existing `minimum-scale` alone unless
   *   it blocks zooming (>= 1), which is then dropped.
   */
  allowZoomOut?: boolean | number;
}

/** Result of applying the viewport policy. */
export interface ViewportPolicyResult {
  /** The `<meta name="viewport">` element (created when absent). */
  meta: HTMLMetaElement;
  /** The content attribute after normalization. */
  content: string;
  /** Raw `key=value` pairs dropped by the policy, in original order. */
  removed: string[];
}

interface ViewportEntry {
  key: string;
  value: string | null;
}

/** Parse a viewport content string into ordered key/value entries. */
export function parseViewportContent(content: string): ViewportEntry[] {
  return content
    .split(",")
    .map((raw) => raw.trim())
    .filter((raw) => raw.length > 0)
    .map((raw) => {
      const eq = raw.indexOf("=");
      if (eq === -1) return { key: raw.toLowerCase(), value: null };
      return {
        key: raw.slice(0, eq).trim().toLowerCase(),
        value: raw.slice(eq + 1).trim(),
      };
    });
}

/** Serialize entries back to a canonical `key=value, …` content string. */
function serializeEntries(entries: ViewportEntry[]): string {
  return entries
    .map((e) => (e.value === null ? e.key : `${e.key}=${e.value}`))
    .join(", ");
}

function clampOutScale(scale: number): string {
  const clamped = Math.min(1, Math.max(0.05, scale));
  // Trim float noise (0.25 → "0.25", 1 → "1").
  return String(Number(clamped.toFixed(4)));
}

/**
 * Normalize the document's viewport meta so mobile browsers never refuse
 * user zoom. Idempotent; safe to call during app bootstrap before mount.
 *
 * The tap-highlight half of the mobile UX contract lives in the stylesheet
 * foundation (`foundation.scss` clears `-webkit-tap-highlight-color`
 * globally) and needs no JS.
 */
export function applyViewportPolicy(
  options: ApplyViewportPolicyOptions = {},
): ViewportPolicyResult {
  const { allowZoom = true, allowZoomOut = false } = options;

  // Non-DOM environments (mini-program JS cores, SSR passes) have no
  // viewport meta to normalize — no-op instead of crashing the boot.
  if (typeof document === "undefined") {
    return { meta: null as unknown as HTMLMetaElement, content: "", removed: [] };
  }

  let meta = document.head.querySelector<HTMLMetaElement>(
    'meta[name="viewport"], meta[name=viewport]',
  );
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = "viewport";
    meta.content = "";
    document.head.appendChild(meta);
  }

  const entries = parseViewportContent(meta.content);
  const removed: string[] = [];
  const kept: ViewportEntry[] = [];
  let sawWidth = false;

  const drop = (entry: ViewportEntry) => {
    removed.push(entry.value === null ? entry.key : `${entry.key}=${entry.value}`);
  };

  for (const entry of entries) {
    if (allowZoom && entry.key === "user-scalable") {
      drop(entry); // re-added explicitly below
      continue;
    }
    if (allowZoom && entry.key === "maximum-scale") {
      drop(entry); // any cap refuses pinch-in for accessibility
      continue;
    }
    if (allowZoom && entry.key === "minimum-scale") {
      if (allowZoomOut !== false) {
        drop(entry); // re-pinned below
        continue;
      }
      const min = Number(entry.value);
      if (entry.value !== null && Number.isFinite(min) && min >= 1) {
        drop(entry); // >= 1 blocks zoom-out entirely
        continue;
      }
    }
    if (entry.key === "width") sawWidth = true;
    kept.push(entry);
  }

  if (!sawWidth) kept.unshift({ key: "width", value: "device-width" });
  if (allowZoom) kept.push({ key: "user-scalable", value: "yes" });
  if (allowZoom && allowZoomOut !== false) {
    kept.push({
      key: "minimum-scale",
      value: clampOutScale(allowZoomOut === true ? 0.25 : allowZoomOut),
    });
  }

  const content = serializeEntries(kept);
  if (meta.content !== content) meta.content = content;
  return { meta, content, removed };
}
