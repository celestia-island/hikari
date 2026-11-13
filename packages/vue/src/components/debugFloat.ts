// AI-generated: developed with the DeepSeek Harness agent (model GLM-5.3 Flash); human-directed.

// Pure geometry + persistence helpers for HkDebugFloat.
//
// Dependency-free (no Vue, no i18n): everything here is pure and
// unit-testable, per the donutGeometry.ts / barChart.ts house pattern —
// the drag clamp in particular is exported so tests can pin the
// viewport-clamping contract without driving real pointer sequences.

/** Viewport corners HkDebugFloat can anchor to before the user drags it. */
export type HkDebugFloatCorner =
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right";

/**
 * Document-space z band for the debug float. It must stay ABOVE every
 * content-chrome band (`--hk-z-tooltip` is the highest at 6000) and
 * STRICTLY BELOW `--hk-z-overlay-root` (90000) — the elevation that
 * lifts hikari's whole functional popup tree (modals, drawers, toasts,
 * tooltips) — so a debug window can never cover the UI it is measuring.
 * Kept in sync with scale.scss by HkDebugFloat.test.tsx.
 */
export const HK_DEBUG_FLOAT_DOCUMENT_Z = 80000;

/** localStorage namespace: `hk-debug-float:<persistKey>`. */
export const HK_DEBUG_FLOAT_STORAGE_PREFIX = "hk-debug-float:";

/** Shape persisted under a persistKey. `x`/`y` are the window's
 *  top-left offset in viewport pixels (the dragged position); both are
 *  optional but PAIRED — a close before the first drag stores open-state
 *  only, and a drop always stores both. */
export interface HkDebugFloatPersisted {
  open: boolean;
  x?: number;
  y?: number;
}

/**
 * Clamp a dragged/restored top-left position so the window stays inside
 * the viewport. A window bigger than the viewport (degenerate content,
 * zoomed UI) pins to the top-left corner rather than going
 * negative-jumpy; the caller measures the real box so live drags clamp
 * against the rendered size, not the `width` prop alone.
 */
export function clampDebugFloatPosition(
  x: number,
  y: number,
  width: number,
  height: number,
  viewportWidth: number,
  viewportHeight: number,
): { x: number; y: number } {
  const maxX = Math.max(0, viewportWidth - width);
  const maxY = Math.max(0, viewportHeight - height);
  return {
    x: Math.min(Math.max(x, 0), maxX),
    y: Math.min(Math.max(y, 0), maxY),
  };
}

/** The storage key for a persistKey (namespaced, collision-free). */
export function debugFloatStorageKey(persistKey: string): string {
  return `${HK_DEBUG_FLOAT_STORAGE_PREFIX}${persistKey}`;
}

/**
 * The definite top-left position of a persisted record — null when the
 * record predates the first drag (open-state only). This is the one
 * place the "optional but PAIRED" invariant is narrowed for TS.
 */
export function debugFloatPersistedPosition(
  persisted: HkDebugFloatPersisted,
): { x: number; y: number } | null {
  return persisted.x !== undefined && persisted.y !== undefined
    ? { x: persisted.x, y: persisted.y }
    : null;
}

/**
 * Read the persisted state for a persistKey. Returns null when nothing
 * was stored, storage is unavailable (SSR, privacy modes), or the
 * payload is corrupted/mistyped — a broken debug overlay must never
 * break rendering, so every failure degrades to "no persisted state".
 */
export function readDebugFloatPersisted(persistKey: string): HkDebugFloatPersisted | null {
  try {
    const raw = localStorage.getItem(debugFloatStorageKey(persistKey));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (parsed === null || typeof parsed !== "object") return null;
    const rec = parsed as Record<string, unknown>;
    const hasPos = "x" in rec || "y" in rec;
    if (typeof rec.open !== "boolean") return null;
    if (
      hasPos &&
      (typeof rec.x !== "number" ||
        typeof rec.y !== "number" ||
        !Number.isFinite(rec.x) ||
        !Number.isFinite(rec.y))
    ) {
      return null;
    }
    return {
      open: rec.open,
      ...(hasPos ? { x: rec.x as number, y: rec.y as number } : {}),
    };
  } catch {
    return null;
  }
}

/**
 * Write the persisted state for a persistKey. Storage failures
 * (quota, privacy modes) are swallowed: persistence is best-effort by
 * contract, the window still works fully without it.
 */
export function writeDebugFloatPersisted(
  persistKey: string,
  value: HkDebugFloatPersisted,
): void {
  try {
    localStorage.setItem(debugFloatStorageKey(persistKey), JSON.stringify(value));
  } catch {
    // Best-effort by contract.
  }
}
