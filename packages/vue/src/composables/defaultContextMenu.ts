/**
 * defaultContextMenu.ts — the app-wide DEFAULT context-menu regime.
 *
 * User direction 2026-11-19: right-click is a GLOBAL concern, not a
 * per-component one — every editable surface deserves the clipboard
 * menu by default, and hosts need a way to contribute their own
 * region defaults without re-implementing the resolution order. The
 * regime itself was proven in shittim-chest's globalContextMenu
 * service (2026-09-22); this module is its upstream home. Resolution
 * order, top to bottom:
 *
 *  1. Element-level bindings (`bindContextMenu` /
 *     `useContextMenuTrigger`, the canvas edge layer) already ran on
 *     the TARGET (bubble phase) — a menu they opened preventDefaults
 *     the event, and the regime's window-level listener yields.
 *  2. Registered default contributors (`registerContextMenuDefault`),
 *     lowest `order` first — the built-in clipboard menu (order 0)
 *     claims editable targets (input / textarea / contenteditable)
 *     with cut / copy / paste / select all, built on the Clipboard +
 *     Selection APIs (execCommand only as the legacy fallback).
 *  3. Everything else: suppressed (`preventDefault`, no menu). The
 *     platform menu never appears — panels own their region menus and
 *     the shell does not fall back to the browser's.
 *
 * The regime LISTENER lives in `HkContextMenuProvider` (prop
 * `defaults`); this module only owns the registry and the built-in
 * contributor, so tests can drive both without a mounted provider.
 *
 * i18n: labels resolve through hikari's own i18n context at BUILD
 * time (menu open), so a locale switch mid-session relabels the next
 * open — contributors stay plain functions, no lifecycle wiring.
 */

import type { ContextMenuRequest, ContextTriggerPoint } from "./useContextMenu";

import { useI18n } from "../i18n/context";
import { useClipboard } from "../runtime/useClipboard";

/** One default-menu contribution. `build` returning a request claims
 *  the event; returning null defers to later contributors (and
 *  ultimately to suppression). */
export interface ContextMenuDefaultContribution {
  /** Stable identity — re-registering an id REPLACES the earlier entry
   *  (HMR / re-mount safety). The returned unregister removes THIS
   *  registration by object identity, so a stale handle can never evict a
   *  newer registration that reused the id. */
  id: string;
  /** Run order, ascending. Equal orders keep registration order.
   *  Default 100; the built-in clipboard menu sits at 0. */
  order?: number;
  build: (point: ContextTriggerPoint) => ContextMenuRequest | null;
}

/** Registration order of contributions — a copy is walked per open, so
 *  a contributor unregistering itself mid-walk cannot skip its
 *  siblings. */
const registry: ContextMenuDefaultContribution[] = [];

/** Register a default-menu contribution. Returns the unregister
 *  function (idempotent). Re-registering an id REPLACES the entry and the
 *  replacement is inserted by `order` again — among equal orders it lands
 *  after its peers (registration order is kept for DISTINCT ids only). */
export function registerContextMenuDefault(
  contribution: ContextMenuDefaultContribution,
): () => void {
  const existing = registry.findIndex((c) => c.id === contribution.id);
  if (existing >= 0) registry.splice(existing, 1);
  const order = contribution.order ?? 100;
  let at = registry.length;
  for (let i = 0; i < registry.length; i += 1) {
    if ((registry[i].order ?? 100) > order) {
      at = i;
      break;
    }
  }
  registry.splice(at, 0, contribution);
  return () => {
    const current = registry.indexOf(contribution);
    if (current >= 0) registry.splice(current, 1);
  };
}

/** Resolve the default request for one trigger point: the first
 *  contributor (order, then registration) that claims it wins; none
 *  does → null (the caller suppresses). */
export function contextMenuDefaultsFor(
  point: ContextTriggerPoint,
): ContextMenuRequest | null {
  for (const contribution of [...registry]) {
    const request = contribution.build(point);
    if (request) return request;
  }
  return null;
}

/** Elements the built-in clipboard menu applies to. Same set the
 *  upstream-downported chest regime used. */
const EDITABLE_SELECTOR =
  "input, textarea, [contenteditable='true'], [contenteditable='']";

/** Input types whose `value` is free text. Everything else (file, date,
 *  checkbox, range, …) rejects an arbitrary string — `field.value = text`
 *  throws `InvalidStateError` on a file input — and its own picker owns
 *  the interaction, so the clipboard menu declines it. */
const TEXT_INPUT_TYPES = new Set([
  "", "text", "search", "url", "tel", "email", "password", "number",
]);

/** A `<input type="number">` accepts the clipboard menu (copy / cut / select
 *  all are fine) but NOT paste: HTML value-sanitization turns arbitrary text
 *  into "", so a paste would dispatch `input` with an EMPTY value and the
 *  host model would commit the wipe — native paste inserts nothing instead. */
function acceptsPaste(el: HTMLElement): boolean {
  return !(el instanceof HTMLInputElement && el.type === "number");
}

function isTextLikeInput(el: HTMLInputElement): boolean {
  return TEXT_INPUT_TYPES.has((el.getAttribute("type") ?? "").toLowerCase());
}

function closestEditable(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) return null;
  return target.closest<HTMLElement>(EDITABLE_SELECTOR);
}

/**
 * The built-in clipboard contributor (order 0): editable targets get
 * the localized cut / copy / paste / select-all menu.
 *
 * The menu moves focus to its rows, which would collapse the live
 * selection before any item handler reads it — so the selection is
 * SNAPSHOTTED at build time and restored before acting. Handlers never
 * re-read the (by then collapsed) selection.
 *
 * OWNERSHIP BOUNDARY: the contributor claims every `input` / `textarea` /
 * `[contenteditable]` target. A model-driven rich editor (ProseMirror /
 * TipTap class) must own its own menu — registering a contributor at a
 * lower `order` (or binding `bindContextMenu` on the editor element)
 * claims the point first; leaving it to the default means `execCommand`
 * edits its DOM behind the editor's model. Shadow-DOM editables are the
 * mirror case: `event.target` is retargeted at the window listener, so
 * the selector does not reach them and they get suppression only.
 */
export const clipboardContextMenuDefault: ContextMenuDefaultContribution = {
  id: "hk.clipboard",
  order: 0,
  build(point) {
    const editable = closestEditable(point.target);
    if (!editable) return null;
    if (editable instanceof HTMLInputElement && !isTextLikeInput(editable)) return null;
    const { t } = useI18n();

    const isField =
      editable instanceof HTMLInputElement ||
      editable instanceof HTMLTextAreaElement;
    const field = isField ? (editable as HTMLInputElement | HTMLTextAreaElement) : null;
    const isReadOnly = field
      ? field.readOnly || field.disabled
      : editable.isContentEditable === false;
    const canPaste = typeof navigator !== "undefined"
      && typeof navigator.clipboard?.readText === "function"
      && acceptsPaste(editable);

    // ── Snapshot the selection NOW ──────────────────────────────────
    const sel = document.getSelection();
    let selText = "";
    let range: Range | null = null;
    if (field) {
      const start = field.selectionStart ?? field.value.length;
      const end = field.selectionEnd ?? start;
      selText = field.value.slice(start, end);
    } else if (sel && sel.rangeCount > 0) {
      const r = sel.getRangeAt(0);
      if (editable.contains(r.commonAncestorContainer)) {
        range = r.cloneRange();
        selText = r.toString();
      }
    }
    const hasSelection = selText.length > 0;

    /** The menu can outlive its target (the field unmounts while the menu
     *  is open, e.g. a dialog closes under it): every mutating handler
     *  refuses a detached target instead of writing into removed DOM and
     *  re-adding a detached Range to the live selection. */
    const stillAttached = (): boolean => editable.isConnected;

    /** Focus the editable again and restore the snapshotted selection. */
    const restore = () => {
      if (!stillAttached()) return;
      editable.focus();
      if (field) {
        // Nothing to restore without a snapshot — leave the caret alone.
        return;
      }
      if (range && sel) {
        sel.removeAllRanges();
        sel.addRange(range);
      }
    };

    // Copy rides the app's ONE clipboard implementation (`runtime/
    // useClipboard`): it already handles the insecure-context fallback and
    // — the trap a hand-rolled path hits — treats `execCommand("copy")`
    // returning false as a FAILURE instead of reporting a write that never
    // landed. Readable outside setup (no inject), so a contributor can use
    // it directly.
    const copyText = useClipboard().copy;

    const doCopy = async (): Promise<boolean> => {
      if (!selText) return false;
      return copyText(selText);
    };
    const doCut = async () => {
      if (!stillAttached()) return;
      if (!(await doCopy())) return; // never delete text that was not copied
      if (isReadOnly || !stillAttached()) return; // the target may have left while copying
      if (field) {
        const start = field.selectionStart ?? 0;
        const end = field.selectionEnd ?? 0;
        field.value = field.value.slice(0, start) + field.value.slice(end);
        field.dispatchEvent(new Event("input", { bubbles: true }));
        field.selectionStart = field.selectionEnd = start;
      } else {
        restore();
        document.execCommand("delete");
      }
    };
    const doPaste = async () => {
      if (!stillAttached()) return;
      let text: string;
      try {
        text = await navigator.clipboard.readText();
      } catch {
        return; // clipboard-read denied (some webviews): shortcut still works
      }
      if (!text) return;
      if (!stillAttached()) return; // the target may have left while reading
      restore();
      if (field) {
        const start = field.selectionStart ?? field.value.length;
        const end = field.selectionEnd ?? start;
        field.value = field.value.slice(0, start) + text + field.value.slice(end);
        field.dispatchEvent(new Event("input", { bubbles: true }));
        field.selectionStart = field.selectionEnd = start + text.length;
      } else {
        document.execCommand("insertText", false, text);
      }
    };
    const doSelectAll = () => {
      if (!stillAttached()) return;
      editable.focus();
      if (field) {
        field.select();
      } else {
        const r = document.createRange();
        r.selectNodeContents(editable);
        const s = document.getSelection();
        s?.removeAllRanges();
        s?.addRange(r);
      }
    };

    return {
      x: point.x,
      y: point.y,
      title: t("hikari::contextmenu.title", "Edit"),
      items: [
        { key: "copy", label: t("hikari::contextmenu.copy", "Copy"), disabled: !hasSelection },
        { key: "cut", label: t("hikari::contextmenu.cut", "Cut"), disabled: !hasSelection || isReadOnly },
        {
          key: "paste",
          label: t("hikari::contextmenu.paste", "Paste"),
          // Clipboard READS need both the API and permission: where the API
          // is absent (a plain-HTTP LAN deployment) the row is disabled —
          // an enabled row that silently does nothing is a dead key.
          disabled: isReadOnly || !canPaste,
        },
        { key: "selectAll", label: t("hikari::contextmenu.selectAll", "Select all") },
      ],
      onSelect: (key) => {
        if (key === "copy") void doCopy();
        else if (key === "cut") void doCut();
        else if (key === "paste") void doPaste();
        else if (key === "selectAll") doSelectAll();
      },
    };
  },
};

/** The built-in regime is registered at MODULE SCOPE: turning the
 *  provider's `defaults` on is the only wiring a host does, and the
 *  clipboard menu comes with it. The registry is inert until a defaults
 *  listener consults it, so a bare import never changes behavior. A
 *  host that genuinely wants the clipboard default GONE unregisters
 *  `clipboardContextMenuDefault` (exported for exactly that); there is
 *  deliberately no install/uninstall API on top — a re-registration's
 *  unregister removes the entry by id, and handing that out for the
 *  built-in would let one redundant install permanently evict it. */
registerContextMenuDefault(clipboardContextMenuDefault);
