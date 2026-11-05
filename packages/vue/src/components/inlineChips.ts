/**
 * inlineChips — the read-only chip pass for markdown-embedded prompt
 * text (`HkMarkdownRenderer`'s opt-in `inlineChips` mode).
 *
 * Prompt assets (entelecheia's five prompt levels) embed two reference
 * forms in their prose:
 *   - fill-template tokens `{{ name }}` — the shared fill-template
 *     grammar (`templateGrammar.ts` parses them; only bare
 *     `[A-Za-z0-9_]+` identifiers are tokens, everything richer stays
 *     literal);
 *   - asset references `@level/name` (`@system/permission-mode`) and
 *     bare `@name` handles — the engine's cross-asset mention form.
 *
 * This module splits a plain-text run into literal text and chip
 * segments; the caller renders chips as `.hk-tpl-chip` spans (the
 * family's chip look). The accessible text is preserved byte-exactly:
 * tokens render the canonical `{{ name }}` spelling (whatever spacing
 * the source holds — same rule HkTemplateText applies) and refs render
 * their exact raw text, so copy-out still round-trips the source.
 *
 * Boundary guards (an `@` must NOT chip):
 *   - preceded by a word character (`foo@bar.com` — emails stay text);
 *   - preceded by another `@` (`user@@host` stays text);
 * refs never absorb trailing punctuation (`.`/`'`/`,` are not in the
 * charset) and never match inside `code`/`pre`/links — the renderer's
 * DOM walk skips those subtrees.
 */

import { parseTemplate, formatTokenDisplay } from "./templateGrammar";

export interface HkInlineChipTextSegment {
  kind: "text";
  text: string;
}

export interface HkInlineChipTokenSegment {
  kind: "token";
  /** The bare identifier (`container_badge`). */
  token: string;
}

export interface HkInlineChipRefSegment {
  kind: "ref";
  /** The exact raw matched text (`@system/permission-mode`). */
  raw: string;
}

export type HkInlineChipSegment =
  | HkInlineChipTextSegment
  | HkInlineChipTokenSegment
  | HkInlineChipRefSegment;

/** `@ref` grammar: `@` (not preceded by a word char or another `@`),
 *  one path segment, then `/segment` repeats. Punctuation ends the
 *  match naturally (dot and quote are outside the charset). */
const REF_RE = /(?<![A-Za-z0-9_@])@[A-Za-z0-9][A-Za-z0-9_-]*(?:\/[A-Za-z0-9][A-Za-z0-9_-]*)*/g;

/** Split literal text runs into text + `@ref` segments (tokens are
 *  already extracted by the template pass before this runs). */
function splitRefs(text: string, push: (seg: HkInlineChipSegment) => void): void {
  let cursor = 0;
  REF_RE.lastIndex = 0;
  for (let m = REF_RE.exec(text); m; m = REF_RE.exec(text)) {
    if (m.index > cursor) {
      push({ kind: "text", text: text.slice(cursor, m.index) });
    }
    push({ kind: "ref", raw: m[0] });
    cursor = m.index + m[0].length;
  }
  if (cursor < text.length) {
    push({ kind: "text", text: text.slice(cursor) });
  }
}

/**
 * Split a plain-text run into literal text, `{{ token }}` and `@ref`
 * segments, in source order. The empty string parses to an empty list;
 * a run with no chip forms round-trips as one text segment.
 */
export function parseInlineChips(text: string): HkInlineChipSegment[] {
  const out: HkInlineChipSegment[] = [];
  const push = (seg: HkInlineChipSegment) => {
    // Merge adjacent text runs so the caller can cheaply detect the
    // "nothing to chip" case (one text segment).
    const last = out[out.length - 1];
    if (seg.kind === "text" && last?.kind === "text") {
      last.text += seg.text;
      return;
    }
    out.push(seg);
  };
  for (const seg of parseTemplate(text)) {
    if (seg.kind === "token") {
      push({ kind: "token", token: seg.token });
    } else {
      splitRefs(seg.text, push);
    }
  }
  return out;
}

/** The canonical chip text for a segment (tokens spell `{{ name }}`,
 *  refs keep their raw form — both copy back to the source). */
export function inlineChipDisplay(seg: HkInlineChipTokenSegment | HkInlineChipRefSegment): string {
  return seg.kind === "token" ? formatTokenDisplay(seg.token) : seg.raw;
}

/** Subtrees the chip pass must never enter: literal code (the token is
 *  documentation there, not a live form), links (the `@` may be part of
 *  a URL or handle path the anchor already contextualizes) and chips
 *  themselves (idempotency — a second pass must not re-chip). */
const CHIP_SKIP_SELECTOR = "code, pre, a, script, style, textarea, .hk-tpl-chip";

/**
 * Walk `root`'s text nodes and wrap chip forms in `.hk-tpl-chip`
 * spans. Pure DOM surgery on already-sanitized markup: the only nodes
 * created are spans + text, built with `textContent` (no HTML
 * parsing), so the pass cannot reintroduce markup. Tokens get the
 * canonical `{{ name }}` spelling; refs carry `data-ref` (the muted
 * chip variant) and their exact raw text.
 *
 * Returns the number of chips created (0 when the mode is off or the
 * body carries no chip forms) — a cheap assertion hook for tests.
 */
export function applyInlineChipsToBody(root: HTMLElement | null | undefined): number {
  if (!root) return 0;
  const walker = document.createTreeWalker(root, 4 /* NodeFilter.SHOW_TEXT */);
  const targets: Text[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const value = node.nodeValue ?? "";
    // Cheap prefilter: chips only ever introduce `{` or `@`.
    if (!/[{@]/.test(value)) continue;
    const parent = (node as Text).parentElement;
    if (parent?.closest?.(CHIP_SKIP_SELECTOR)) continue;
    targets.push(node as Text);
  }
  let chips = 0;
  for (const node of targets) {
    const segments = parseInlineChips(node.nodeValue ?? "");
    if (segments.length === 0 || segments.every((seg) => seg.kind === "text")) continue;
    const frag = document.createDocumentFragment();
    for (const seg of segments) {
      if (seg.kind === "text") {
        frag.append(seg.text);
        continue;
      }
      chips += 1;
      const chip = document.createElement("span");
      chip.className = "hk-tpl-chip";
      chip.setAttribute("data-static", "");
      chip.textContent = inlineChipDisplay(seg);
      if (seg.kind === "ref") chip.setAttribute("data-ref", "");
      frag.append(chip);
    }
    node.replaceWith(frag);
  }
  return chips;
}
