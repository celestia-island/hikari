// installHkImageFallback — document-level "invalid image" rendering.
//
// A broken <img> (404, dead data URI, offline blob) otherwise renders the
// browser's raw broken-image glyph, which is exactly the kind of
// unpolished detail the design system exists to prevent (user direction
// 2026-09-13: ship the invalid-image re-render as a global hook, the same
// way the tooltip bridge replaces native tooltips). Mechanics:
//
//   error (capture-phase delegated — resource errors do NOT bubble)
//     → the img gains the `hk-img-broken` class (muted surface treatment
//       in imageFallback.scss)
//     → its src swaps to the bundled inline-SVG placeholder (a quiet
//       broken-image glyph on a rounded muted tile), keeping the element,
//       its layout box and its alt text intact — no DOM surgery, no
//       layout shift
//   load (capture-phase delegated)
//     → a previously-broken img whose src later resolves (retry, upload
//       finished, URL repaired) drops the class and renders normally.
//
// The swap is one-shot per element (`data-hk-img-fallback`): a fallback
// that itself fails (hostile custom fallbackSrc) can never loop.
//
// Escape hatches:
//   - `[data-hk-img-native]` keeps the raw browser broken-image rendering
//   - `selector` / `exclude` options scope the hook further
//   - `fallbackSrc` overrides the bundled placeholder ("" = class only,
//     no src swap — for hosts that style the class themselves)
import "./imageFallback.scss";

export interface HkImageFallbackOptions {
  /** Which images are covered. Default: `img`. */
  selector?: string;
  /** Images matching this keep raw browser rendering. */
  exclude?: string;
  /** Placeholder src override. `""` marks the img but keeps its src. */
  fallbackSrc?: string;
}

/** The bundled placeholder: quiet broken-image glyph on a muted tile. */
const PLACEHOLDER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" role="img" aria-hidden="true">
  <rect width="48" height="48" rx="8" fill="#888f9b" fill-opacity="0.14"/>
  <g fill="none" stroke="#888f9b" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.85">
    <rect x="12" y="10" width="24" height="28" rx="3"/>
    <circle cx="20" cy="18" r="2.5"/>
    <path d="M15 33l7-8 5 6 3.5-3.5L36 33"/>
    <path d="M9 39L39 9"/>
  </g>
</svg>`;

const DEFAULT_FALLBACK_SRC = `data:image/svg+xml,${encodeURIComponent(PLACEHOLDER_SVG)}`;

const APPLIED_FLAG = "hkImgFallback" as const;

interface FallbackState {
  root: Document;
  listeners: Array<[type: string, fn: EventListener]>;
  selector: string;
  exclude: string;
  fallbackSrc: string;
}

const INSTALLS = new WeakMap<Document, FallbackState>();

function onError(state: FallbackState, e: Event) {
  const target = e.target;
  if (!target || !(target instanceof HTMLImageElement)) return;
  if (!target.matches(state.selector)) return;
  if (state.exclude && target.matches(state.exclude)) return;
  if (target.dataset[APPLIED_FLAG] === "1") return; // already marked — never loop
  target.dataset[APPLIED_FLAG] = "1";
  target.classList.add("hk-img-broken");
  if (state.fallbackSrc && target.getAttribute("src") !== state.fallbackSrc) {
    target.src = state.fallbackSrc;
  }
}

function onLoad(state: FallbackState, e: Event) {
  const target = e.target;
  if (!target || !(target instanceof HTMLImageElement)) return;
  if (!target.classList.contains("hk-img-broken")) return;
  // The swapped placeholder fires its own load — the class comes off only
  // for an image that RESOLVED with real content again (src repaired,
  // retry succeeded). A load OF the placeholder keeps the treatment.
  if (state.fallbackSrc && target.getAttribute("src") === state.fallbackSrc) return;
  target.classList.remove("hk-img-broken");
  delete target.dataset[APPLIED_FLAG]; // a later breakage can re-mark it
}

function uninstall(state: FallbackState) {
  if (INSTALLS.get(state.root) === state) INSTALLS.delete(state.root);
  for (const [type, fn] of state.listeners.splice(0)) {
    state.root.removeEventListener(type, fn, true);
  }
}

/**
 * Install the document-level broken-image re-render. Returns the
 * uninstaller (removes listeners; already-marked images keep their
 * placeholder). Idempotent per document.
 */
export function installHkImageFallback(options: HkImageFallbackOptions = {}): () => void {
  if (typeof document === "undefined") return () => undefined;
  const existing = INSTALLS.get(document);
  if (existing) return () => uninstall(existing);

  const state: FallbackState = {
    root: document,
    listeners: [],
    selector: options.selector ?? "img",
    exclude: options.exclude ?? "[data-hk-img-native]",
    fallbackSrc: options.fallbackSrc !== undefined ? options.fallbackSrc : DEFAULT_FALLBACK_SRC,
  };

  // Resource errors never bubble — capture phase is the only delegation
  // point that sees them from the document.
  const on = (type: string, fn: EventListener) => {
    document.addEventListener(type, fn, true);
    state.listeners.push([type, fn]);
  };
  on("error", (e) => onError(state, e));
  on("load", (e) => onLoad(state, e));

  INSTALLS.set(document, state);
  return () => uninstall(state);
}
