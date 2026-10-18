// installHkTapHighlight — document-level policy for the UA tap highlight.
//
// Blink/WebKit paint a platform-owned translucent overlay over the tapped
// node (Android Chrome measures rgba(51, 181, 229, 0.4) in mobile
// emulation). The canonical host reset (styles/reset.scss) already clears
// it at the root and exposes two declarative knobs:
//
//   --hk-tap-highlight-color: transparent   → no overlay (the default)
//   --hk-tap-highlight-color: <CSS color>   → keep the feedback, tint it
//   html[data-hk-tap-highlight="native"]    → restore the UA default
//
// This hook is the runtime policy layer on top of that contract. It also
// enables `:active` on iOS Safari: WebKit only applies the pseudo-class
// when a touch listener exists (WebKit bug 138816), so clearing the UA
// overlay must not leave taps without a pressed state.
//
// Lifecycle mirrors installHkImageFallback: idempotent per document,
// returns the uninstaller, restores the previous inline token/attribute,
// and reports itself to the runtime registry.

import { reportHkRuntime } from "./registry";
import type { HkRuntimeHandle } from "./registry";

export type HkTapHighlightColor = "none" | "native" | (string & {});

export interface HkTapHighlightOptions {
  /**
   * "none" clears the UA overlay (the app convention); "native" restores
   * the browser default; any other valid CSS color keeps the feedback but
   * tints it — e.g. `rgb(var(--color-primary) / 12%)`.
   */
  color?: HkTapHighlightColor;
  /**
   * Enable `:active` on iOS Safari with a passive document touchstart
   * listener (default true). Removing the UA highlight makes the pressed
   * state the only feedback, so this is on by default; hosts with their
   * own touch handling may opt out.
   */
  enableActiveState?: boolean;
}

const TOKEN = "--hk-tap-highlight-color";
const NATIVE_ATTR = "data-hk-tap-highlight";
const TRANSPARENT = "transparent";

interface TapHighlightState {
  doc: Document;
  root: HTMLElement;
  previousToken: string;
  previousNative: string | null;
  enableActiveState: boolean;
  onTouchStart: EventListener;
  installedColor: HkTapHighlightColor;
  requestedColor: HkTapHighlightColor;
  runtime?: HkRuntimeHandle;
}

const INSTALLS = new WeakMap<Document, TapHighlightState>();

function noop(): void {}

function normalizeColor(color: HkTapHighlightColor | undefined): {
  token: string | null;
  native: boolean;
  effective: HkTapHighlightColor;
} {
  if (color === undefined || color === "none") {
    return { token: TRANSPARENT, native: false, effective: "none" };
  }
  if (color === "native") {
    return { token: null, native: true, effective: "native" };
  }
  // Validate against the property so a bad host value cannot become an
  // "invalid at computed-value time" flash of the UA default colour.
  const supported =
    typeof CSS === "undefined" ||
    typeof CSS.supports !== "function" ||
    CSS.supports("-webkit-tap-highlight-color", color);
  return supported
    ? { token: color, native: false, effective: color }
    : { token: TRANSPARENT, native: false, effective: "none" };
}

function uninstall(state: TapHighlightState): void {
  // A teardown from a previous install must not clear the policy that
  // replaced it (uninstall → reinstall → call the old uninstaller).
  if (INSTALLS.get(state.doc) !== state) return;
  INSTALLS.delete(state.doc);
  if (state.enableActiveState) {
    state.doc.removeEventListener("touchstart", state.onTouchStart);
  }
  if (state.previousToken) {
    state.root.style.setProperty(TOKEN, state.previousToken);
  } else {
    state.root.style.removeProperty(TOKEN);
  }
  if (state.previousNative === null) {
    state.root.removeAttribute(NATIVE_ATTR);
  } else {
    state.root.setAttribute(NATIVE_ATTR, state.previousNative);
  }
  state.runtime?.dispose();
}

/**
 * Install the document-level tap-highlight policy. Returns the
 * uninstaller; idempotent per document (a second call returns the
 * existing teardown). No-op outside a DOM.
 */
export function installHkTapHighlight(
  options: HkTapHighlightOptions = {},
): () => void {
  if (typeof document === "undefined") return () => undefined;
  const doc = document;
  const existing = INSTALLS.get(doc);
  if (existing) return () => uninstall(existing);

  const root = doc.documentElement;
  const { token, native, effective } = normalizeColor(options.color);
  const enableActiveState = options.enableActiveState ?? true;
  const requestedColor = options.color ?? "none";
  const state: TapHighlightState = {
    doc,
    root,
    previousToken: root.style.getPropertyValue(TOKEN),
    previousNative: root.getAttribute(NATIVE_ATTR),
    enableActiveState,
    onTouchStart: noop,
    installedColor: effective,
    requestedColor,
  };

  if (token === null) {
    root.style.removeProperty(TOKEN);
  } else {
    root.style.setProperty(TOKEN, token);
  }
  if (native) {
    root.setAttribute(NATIVE_ATTR, "native");
  } else {
    root.removeAttribute(NATIVE_ATTR);
  }

  if (enableActiveState) {
    doc.addEventListener("touchstart", state.onTouchStart, { passive: true });
  }

  state.runtime = reportHkRuntime("tapHighlight", {
    kind: "hook",
    description:
      "Document-level mobile tap-highlight policy: clears or tints the UA overlay and enables :active on iOS.",
    meta: {
      color: state.installedColor,
      requestedColor: state.requestedColor,
      activeState: enableActiveState,
      native,
    },
    read: () => ({
      installed: true,
      color: state.installedColor,
      requestedColor: state.requestedColor,
      activeState: enableActiveState,
      native,
    }),
  });

  INSTALLS.set(doc, state);
  return () => uninstall(state);
}
