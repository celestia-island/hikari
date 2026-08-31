import { ref, type Ref } from "vue";

// fontContext.ts — bootstrap-level font facility, distributed like the
// startup hooks (initTheme / applyViewportPolicy): every webui calls
// initFontContext() once at bootstrap and the canonical stacks land as
// inline CSS vars on document.documentElement, so no app has to restate
// font-family literals.

// Apple-style system stack; the CJK tail keeps non-Apple platforms off kai-style last-resort fallbacks.
// Kai/serif faces are deliberately never listed.
export const HIKARI_FONT_SANS = `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif`;
export const HIKARI_FONT_MONO = `ui-monospace, "SF Mono", Menlo, Consolas, "DejaVu Sans Mono", "Liberation Mono", "PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", monospace`;
export const HIKARI_FONT_READING = HIKARI_FONT_SANS;

export interface FontContextOverrides {
  sans?: string;
  mono?: string;
  reading?: string;
}

const STORAGE_KEY = "hikari-font-context";
const MAX_VALUE_LENGTH = 500;
// CSS-injection guard: font-family lists never need these characters.
const FORBIDDEN_CHARS = /[;{}]/;

type FontSlot = keyof FontContextOverrides;

const FONT_VAR: Record<FontSlot, string> = {
  sans: "--font-sans",
  mono: "--font-mono",
  reading: "--font-reading",
};

// Shared singleton state (mirrors useTheme's module-level refs): every
// useFontContext() call in the app sees the same stacks.
const sansRef = ref<string>(HIKARI_FONT_SANS);
const monoRef = ref<string>(HIKARI_FONT_MONO);
const readingRef = ref<string>(HIKARI_FONT_READING);

function slotRef(slot: FontSlot): Ref<string> {
  return slot === "sans" ? sansRef : slot === "mono" ? monoRef : readingRef;
}

function isBrowser(): boolean {
  return typeof document !== "undefined";
}

// Sanitize a candidate value: empty, over-long, or injection-shaped
// values are rejected (the caller falls back to the next source).
function sanitizeFontValue(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_VALUE_LENGTH) return null;
  if (FORBIDDEN_CHARS.test(trimmed)) return null;
  return trimmed;
}

function readStoredOverrides(): FontContextOverrides {
  if (!isBrowser() || typeof localStorage === "undefined") return {};
  let raw: string | null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    return {};
  }
  if (!raw) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Malformed JSON: ignore it; the next setter overwrites the key.
    return {};
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return {};
  const record = parsed as Record<string, unknown>;
  const out: FontContextOverrides = {};
  for (const slot of Object.keys(FONT_VAR) as FontSlot[]) {
    const value = sanitizeFontValue(record[slot]);
    if (value) out[slot] = value;
  }
  return out;
}

function persistOverrides(overrides: FontContextOverrides): void {
  if (!isBrowser() || typeof localStorage === "undefined") return;
  const merged: FontContextOverrides = { ...readStoredOverrides(), ...overrides };
  const hasAny = (Object.keys(FONT_VAR) as FontSlot[]).some((slot) => merged[slot]);
  try {
    if (hasAny) localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage unavailable (private mode etc.): vars still apply inline.
  }
}

// Re-apply the current state as inline CSS vars. Safe to call any time.
export function applyFontContext(): void {
  if (!isBrowser()) return;
  const el = document.documentElement;
  el.style.setProperty(FONT_VAR.sans, sansRef.value);
  el.style.setProperty(FONT_VAR.mono, monoRef.value);
  el.style.setProperty(FONT_VAR.reading, readingRef.value);
  el.setAttribute("data-font-context", "on");
}

let initialized = false;

// Bootstrap hook. Idempotent via a module-level flag like initTheme, BUT
// explicit options on any call (including repeated ones) always win: they
// are merged into the current state and re-applied. Explicit options are
// not persisted — persistence belongs to the useFontContext setters.
export function initFontContext(options?: FontContextOverrides): void {
  if (!isBrowser()) return;
  const explicit: FontContextOverrides = {};
  if (options) {
    for (const slot of Object.keys(FONT_VAR) as FontSlot[]) {
      const value = sanitizeFontValue(options[slot]);
      if (value) explicit[slot] = value;
    }
  }
  if (!initialized) {
    initialized = true;
    const stored = readStoredOverrides();
    sansRef.value = explicit.sans ?? stored.sans ?? HIKARI_FONT_SANS;
    monoRef.value = explicit.mono ?? stored.mono ?? HIKARI_FONT_MONO;
    readingRef.value = explicit.reading ?? stored.reading ?? HIKARI_FONT_READING;
  } else {
    // Repeated call: merge the explicit options over the current state.
    if (explicit.sans) sansRef.value = explicit.sans;
    if (explicit.mono) monoRef.value = explicit.mono;
    if (explicit.reading) readingRef.value = explicit.reading;
  }
  applyFontContext();
}

// Clear the persisted override and restore the built-in defaults.
export function resetFontContext(): void {
  sansRef.value = HIKARI_FONT_SANS;
  monoRef.value = HIKARI_FONT_MONO;
  readingRef.value = HIKARI_FONT_READING;
  if (isBrowser() && typeof localStorage !== "undefined") {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }
  applyFontContext();
}

export function useFontContext() {
  function setSlot(slot: FontSlot, value: string): void {
    const clean = sanitizeFontValue(value);
    if (!clean) return; // rejected: don't persist, don't apply
    slotRef(slot).value = clean;
    persistOverrides({ [slot]: clean });
    applyFontContext();
  }

  return {
    sans: sansRef,
    mono: monoRef,
    reading: readingRef,
    setSans: (value: string) => setSlot("sans", value),
    setMono: (value: string) => setSlot("mono", value),
    setReading: (value: string) => setSlot("reading", value),
    reset: resetFontContext,
  };
}
