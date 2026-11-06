/**
 * Behavioral contract for the DESKTOP modal open/close choreography — run
 * against the COMPILED stylesheet, not the source text.
 *
 * User direction 2026-11-06 (supersedes the 2026-11-05 content-only ride):
 * the window's own HEIGHT rides the open/close — the frame settles
 * `translate(…) scaleY(0.9) → translate(…) scaleY(1)` about its center, so
 * the box grows symmetrically and anything centered in it (the content
 * region above all) stays horizontally AND vertically centered at every t;
 * the translate prefix is byte-identical in every state so the ride can
 * never re-seat the frame. `.hk-modal-body` keeps a ride of its own:
 * `scale(0.95, 1) → scale(1, 1)` — the horizontal factor starts slightly
 * NARROW and spreads out to fill the window (user direction 2026-11-06,
 * revising the first cut: a 1.1 overshoot read as uglier than a slight
 * pinch), while its vertical factor stays 1 because the body's Y already
 * rides the frame's scaleY (own 0.9 would compound to 0.81). The retired
 * grammars: the 2026-11-04 whole-frame `scale(1, 0.9)`, the 2026-11-05
 * body-only uniform `scale(0.9)`, and the 2026-11-06 `scale(1.1, 1)`
 * overshoot.
 *
 * Why compile: a source-text scanner can be dodged by a later duplicate
 * rule, a block comment, SCSS interpolation, `@extend` or an `@use`d
 * partial, and it cannot see the cascade. This contract compiles
 * `HkModal.scss` with the repo's own sass, parses the emitted CSS into
 * ordered rules with their media context, and then asks the real cascade
 * question for each moment of the ride: which declaration WINS for the
 * frame, the chrome and the content region?
 */
import { describe, expect, it } from "vitest";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { compile } from "sass";

const here = dirname(fileURLToPath(import.meta.url));

const css = compile(join(here, "HkModal.scss"), {
  loadPaths: [here, join(here, "..", "styles")],
  style: "expanded",
}).css;

// ── a very small CSS reader ────────────────────────────────────────────────

interface CssRule {
  /** Active media conditions (outermost first), e.g. "(min-width: 768px)". */
  media: string[];
  /** One selector-list part (comma lists are split into separate rules). */
  selector: string;
  declarations: Map<string, string>;
  /** Properties declared with `!important` (they outrank everything). */
  important: Set<string>;
  /** Source order in the compiled sheet — the cascade tie-break. */
  order: number;
}

/** Strip comments from a CSS fragment (compiled output carries none, but
 *  be explicit so a future sass change cannot leak prose into the model). */
const stripComments = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, "");

/** Split a grouped selector list on top-level commas. */
function normalizeMedia(m: string): string {
  // Canonicalise the query forms an author may legitimately reach for:
  // a media-type prefix, rem units, the modern range syntax and the
  // prefer-reduced-motion compat gate.
  return m
    .replace(/\s+/g, " ")
    .replace(/^(-?only\s+)?(screen|all)\s+and\s+/i, "")
    .replace(/\(\s*width\s*>=\s*([0-9.]+)px\s*\)/g, "(min-width: $1px)")
    .replace(/\(\s*width\s*<=\s*([0-9.]+)px\s*\)/g, "(max-width: $1px)")
    .replace(/\s+and\s+\(prefers-reduced-motion:\s*no-preference\)/i, "")
    .replace(/(-?\d*\.?\d+)rem\b/g, (_, n: string) => `${Number(n) * 16}px`)
    .trim();
}

function splitSelectorList(head: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of head) {
    if (ch === "[" || ch === "(") depth += 1;
    if (ch === "]" || ch === ")") depth -= 1;
    if (ch === "," && depth === 0) {
      if (current.trim()) parts.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

interface Frame {
  head: string;
  kind: "media" | "atrule" | "rule";
  /** `property\u0000value` pairs collected inside a rule frame. */
  chunks: string[];
}

function parseRules(source: string): CssRule[] {
  const rules: CssRule[] = [];
  const frames: Frame[] = [];
  let media: string[] = [];
  let buffer = "";
  let order = 0;

  const flush = (text: string): void => {
    const decl = stripComments(text).trim();
    if (!decl) return;
    const cut = decl.indexOf(":");
    if (cut <= 0) return;
    const top = frames[frames.length - 1];
    if (top?.kind !== "rule") return;
    const prop = decl.slice(0, cut).trim().toLowerCase();
    const value = decl.slice(cut + 1).trim();
    top.chunks.push(`${prop}\u0000${value}`);
  };

  for (const ch of source) {
    if (ch === "{") {
      const head = stripComments(buffer).trim();
      buffer = "";
      if (head.startsWith("@")) {
        const kind = head.startsWith("@media") ? "media" : "atrule";
        frames.push({ head, kind, chunks: [] });
        if (kind === "media") {
          media = [...media, normalizeMedia(head.replace(/^@media/, ""))];
        }
      } else {
        frames.push({ head, kind: "rule", chunks: [] });
      }
      continue;
    }
    if (ch === ";") {
      flush(buffer);
      buffer = "";
      continue;
    }
    if (ch === "}") {
      // A block may end with a declaration that has no trailing `;`.
      flush(buffer);
      buffer = "";
      const frame = frames.pop();
      if (!frame) continue;
      if (frame.kind === "media") {
        media = media.slice(0, -1);
      } else if (frame.kind === "rule") {
        const declarations = new Map<string, string>();
        const important = new Set<string>();
        for (const chunk of frame.chunks) {
          const [prop, rawValue] = chunk.split("\u0000");
          if (/!important$/i.test(rawValue)) important.add(prop);
          declarations.set(prop, rawValue.replace(/\s*!important$/i, "").trim());
        }
        const ord = order++;
        for (const part of splitSelectorList(frame.head)) {
          rules.push({ media: [...media], selector: part, declarations, important, order: ord });
        }
      }
      continue;
    }
    buffer += ch;
  }
  return rules;
}

const RULES = parseRules(stripComments(css));

// ── selector matching against a simulated DOM ─────────────────────────────

interface MockElement {
  classes: string[];
  attributes: string[];
  parent: MockElement | null;
}

const el = (classes: string[], parent: MockElement | null = null): MockElement => ({
  classes,
  attributes: [],
  parent,
});

/** One compound matches when its classes/attributes are all present and it
 *  has no state pseudo-class the simulated element cannot satisfy. */
function compoundMatches(compound: string, element: MockElement): boolean {
  // Pseudo-classes/pseudo-elements are stateful (`:hover`, `:active`,
  // `::before`) — never active in the simulated ride.
  if (/::|:(hover|active|focus|focus-within|has\(|not\()/.test(compound)) return false;
  const classes = compound.match(/\.[A-Za-z0-9_-]+/g) ?? [];
  const attrs = compound.match(/\[[^\]]+\]/g) ?? [];
  const bareType = compound.replace(/\.[A-Za-z0-9_-]+/g, "").replace(/\[[^\]]+\]/g, "").trim();
  if (bareType.length > 0 && !/^(html|body|\*)$/.test(bareType)) return false;
  for (const cls of classes) {
    if (!element.classes.includes(cls.slice(1))) return false;
  }
  for (const attr of attrs) {
    const name = attr.slice(1, -1).split(/[~|^$*]?=/)[0].trim();
    if (!element.attributes.includes(name)) return false;
  }
  return true;
}

function selectorMatches(selector: string, element: MockElement): boolean {
  // Tokenise combinators so `>` is modelled (a child-qualified duplicate
  // rule outranks the shipped one exactly like a descendant one). Sibling
  // combinators are not modelled; a rule using them simply does not match
  // here (the chrome sweep above is combinator-blind and still catches
  // chrome cases).
  const tokens = selector
    .replace(/\s*>\s*/g, " > ")
    .replace(/\s*[+~]\s*/g, " + ")
    .split(/\s+/)
    .filter(Boolean);
  if (tokens.length === 0) return false;
  if (tokens.some((t) => t === "+")) return false;
  let index = tokens.length - 1;
  if (!compoundMatches(tokens[index], element)) return false;
  index -= 1;
  let current: MockElement | null = element.parent;
  while (index >= 0) {
    const token = tokens[index];
    if (token === ">") {
      const previous = tokens[index - 1];
      if (!previous || !current || !compoundMatches(previous, current)) return false;
      current = current.parent;
      index -= 2;
      continue;
    }
    while (current && !compoundMatches(token, current)) current = current.parent;
    if (!current) return false;
    current = current.parent;
    index -= 1;
  }
  return true;
}

/** Specificity (ids, classes/attrs/pseudo-classes, elements) of a compiled
 *  selector part. */
function specificity(selector: string): [number, number, number] {
  const ids = (selector.match(/#[A-Za-z0-9_-]+/g) ?? []).length;
  const classes =
    (selector.match(/\.[A-Za-z0-9_-]+/g) ?? []).length +
    (selector.match(/\[[^\]]+\]/g) ?? []).length +
    (selector.match(/:(?!:)[A-Za-z0-9_-]+(?:\([^)]*\))?/g) ?? []).length;
  const elements = (selector.match(/::[A-Za-z0-9_-]+/g) ?? []).length;
  return [ids, classes, elements];
}

interface Environment {
  /** Active media conditions; a rule applies only if ALL of its media
   *  queries are active. */
  media: string[];
  element: MockElement;
}

type Score = [number, number, number];

interface Candidate {
  score: Score;
  order: number;
  value: string;
  important: boolean;
}

/** Cascade order: higher specificity wins, then later source order. */
function preferred(a: Candidate, b: Candidate | null): boolean {
  if (!b) return true;
  if (a.important !== b.important) return a.important;
  for (let i = 0; i < 3; i += 1) {
    if (a.score[i] !== b.score[i]) return a.score[i] > b.score[i];
  }
  return a.order > b.order;
}

/** The declaration that WINS for `property` on `element` in the given
 *  media environment — the real cascade question, asked of the compiled
 *  sheet. */
function winner(
  element: MockElement,
  property: string,
  activeMedia: string[],
): string | undefined {
  let best: Candidate | null = null;
  for (const rule of RULES) {
    const value = rule.declarations.get(property);
    if (value === undefined) continue;
    if (rule.media.some((m) => !activeMedia.includes(normalizeMedia(m)))) continue;
    if (!selectorMatches(rule.selector, element)) continue;
    const candidate: Candidate = {
      score: specificity(rule.selector),
      order: rule.order,
      value,
      important: rule.important.has(property),
    };
    if (preferred(candidate, best)) best = candidate;
  }
  return best?.value.replace(/\s+/g, " ").trim();
}

const DESKTOP = ["(min-width: 768px)"];
const MOBILE = ["(max-width: 767px)"];
const DESKTOP_REDUCED = ["(min-width: 768px)", "(prefers-reduced-motion: reduce)"];
const MOBILE_REDUCED = ["(max-width: 767px)", "(prefers-reduced-motion: reduce)"];

/** A frame carrying one ride state (plus the shared -active pair). */
function frameWith(...stateClasses: readonly string[]): MockElement {
  return el(["hk-modal-content", ...stateClasses]);
}

/** Same frame, but the opt-in `draggable` flag is on: attribute-qualified
 *  host/author rules must be exercised against the same invariants. */
function draggableFrameWith(...stateClasses: readonly string[]): MockElement {
  const frame = el(["hk-modal-content", ...stateClasses]);
  frame.attributes.push("data-draggable");
  return frame;
}

const RIDE = [
  { name: "enter-from", classes: ["hk-modal-content-enter-from", "hk-modal-content-enter-active"] },
  { name: "enter-to", classes: ["hk-modal-content-enter-to", "hk-modal-content-enter-active"] },
  { name: "leave-from", classes: ["hk-modal-content-leave-from", "hk-modal-content-leave-active"] },
  { name: "leave-to", classes: ["hk-modal-content-leave-to", "hk-modal-content-leave-active"] },
] as const;

const child = (parent: MockElement, cls: string): MockElement => el([cls], parent);

const CENTERING =
  "translate(calc(-50% + var(--hk-modal-shift-x, 0px)), calc(-50% + var(--hk-modal-shift-y, 0px)))";

/** Frame ride states: the centering translate is a PERMANENT prefix and
 *  only the appended scaleY changes (2026-11-06: the window's height rides
 *  the open/close about its center). */
const FRAME_FROM = `${CENTERING} scaleY(0.9)`;
const FRAME_TO = `${CENTERING} scaleY(1)`;

/** Exact compiled transition values (winner()-normalized) — pinned whole,
 *  not by prefix: an embedded fourth time value (delay) or a smuggled extra
 *  segment must fail, because the surface machine reads duration only and a
 *  delay would desync the fade from the height ride.
 *  R2 finding 2026-11-06 (S1): prefix `toContain` let both survive. */
const ENTER_TRANSITION =
  "opacity var(--hk-modal-duration, 0.42s) var(--hk-modal-ease-out, cubic-bezier(0.33, 1, 0.68, 1)), " +
  "transform var(--hk-modal-duration, 0.42s) var(--hk-modal-ease-out, cubic-bezier(0.33, 1, 0.68, 1))";
const LEAVE_TRANSITION =
  "opacity var(--hk-modal-duration, 0.32s) var(--hk-modal-ease-in, cubic-bezier(0.45, 0, 0.55, 1)), " +
  "transform var(--hk-modal-duration, 0.32s) var(--hk-modal-ease-in, cubic-bezier(0.45, 0, 0.55, 1))";
const BODY_ENTER_TRANSITION =
  "transform var(--hk-modal-duration, 0.42s) var(--hk-modal-ease-out, cubic-bezier(0.33, 1, 0.68, 1))";
const BODY_LEAVE_TRANSITION =
  "transform var(--hk-modal-duration, 0.32s) var(--hk-modal-ease-in, cubic-bezier(0.45, 0, 0.55, 1))";

describe("HkModal desktop open/close contract (compiled cascade, user direction 2026-11-05)", () => {
  it("compiles into a stylesheet with the ride rules present (known-positive)", () => {
    // Guard against a vacuous suite: the compiled sheet must really contain
    // the frame rule, the body rule and the reduced-motion flatten.
    expect(RULES.length).toBeGreaterThan(40);
    const selectors = RULES.map((r) => r.selector);
    expect(selectors.some((s) => s.includes(".hk-modal-body"))).toBe(true);
    expect(selectors.some((s) => s.includes("hk-modal-content-enter-from"))).toBe(true);
  });

  it("rides the frame height as scaleY appended to the byte-identical centering translate", () => {
    // 2026-11-06: the window's own height moves with the open/close. The
    // translate prefix must be byte-identical in EVERY state (rest too) so
    // the ride can never re-seat the frame or drop a dragged window's
    // shift; only the appended scaleY flips 0.9 → 1.
    expect(winner(frameWith(...RIDE[0].classes), "transform", DESKTOP), RIDE[0].name).toBe(FRAME_FROM);
    expect(winner(frameWith(...RIDE[1].classes), "transform", DESKTOP), RIDE[1].name).toBe(FRAME_TO);
    expect(winner(frameWith(...RIDE[2].classes), "transform", DESKTOP), RIDE[2].name).toBe(FRAME_TO);
    expect(winner(frameWith(...RIDE[3].classes), "transform", DESKTOP), RIDE[3].name).toBe(FRAME_FROM);
    // …and the same with the opt-in draggable flag on, where an
    // attribute-qualified frame rule could otherwise slip past the mocks
    // (R2 finding 2026-11-06 (S2): the body had this loop, the frame
    // didn't — the repo's own [data-draggable] block is the natural next
    // mutation site).
    for (const state of RIDE) {
      const expected = state.name === "enter-from" || state.name === "leave-to" ? FRAME_FROM : FRAME_TO;
      expect(
        winner(draggableFrameWith(...state.classes), "transform", DESKTOP),
        `draggable frame ${state.name}`,
      ).toBe(expected);
    }
    // …and at rest, too: the settled frame carries the translate only.
    expect(winner(frameWith(), "transform", DESKTOP)).toBe(CENTERING);
    expect(winner(draggableFrameWith(), "transform", DESKTOP)).toBe(CENTERING);
  });

  it("never lets a transform longhand creep onto the frame", () => {
    // A frame-level `scale:` / `zoom:` / `translate:` / `rotate:` longhand
    // (or an origin override) would ride the chrome on its own grammar
    // instead of the contracted translate+scaleY list.
    for (const state of RIDE) {
      const frame = frameWith(...state.classes);
      for (const prop of ["scale", "zoom", "translate", "rotate", "transform-origin"]) {
        expect(winner(frame, prop, DESKTOP), `${state.name} frame ${prop}`).toBeUndefined();
      }
      // …and the same at rest, where a duplicate frame rule would re-seat it.
      const rest = frameWith();
      for (const prop of ["scale", "zoom", "translate", "rotate", "transform-origin"]) {
        expect(winner(rest, prop, DESKTOP), `rest frame ${prop}`).toBeUndefined();
      }
    }
  });

  it("fades the frame and rides its height on one shared token pair per direction", () => {
    // Pinned WHOLE (winner() normalizes whitespace), not by prefix: a
    // fourth time value (transition-delay) or an extra smuggled segment
    // must fail — the surface machine measures duration only, so a delay
    // would start the scaleY ride late and the measured deadline would cut
    // it short (R2 finding 2026-11-06 (S1): `toContain` prefixes let both
    // survive).
    const enter = winner(
      frameWith("hk-modal-content-enter-from", "hk-modal-content-enter-active"),
      "transition",
      DESKTOP,
    );
    expect(enter).toBe(ENTER_TRANSITION);

    const leave = winner(
      frameWith("hk-modal-content-leave-to", "hk-modal-content-leave-active"),
      "transition",
      DESKTOP,
    );
    expect(leave).toBe(LEAVE_TRANSITION);

    const enterWill = winner(
      frameWith("hk-modal-content-enter-from", "hk-modal-content-enter-active"),
      "will-change",
      DESKTOP,
    );
    expect(enterWill).toBe("opacity, transform");
    // The close direction promotes the same pair of layers.
    const leaveWill = winner(
      frameWith("hk-modal-content-leave-to", "hk-modal-content-leave-active"),
      "will-change",
      DESKTOP,
    );
    expect(leaveWill).toBe("opacity, transform");
  });

  it("rides the content region X 0.95→1 with Y pinned at 1, about its center", () => {
    // 2026-11-06 (revised): the content starts slightly NARROW (95% of the
    // window width) and spreads to 100%; the vertical factor stays 1 — the
    // body's Y already rides the frame's scaleY, so its own 1 keeps the
    // compound at exactly 0.9→1.
    const expect_ = (state: string, value: string) => {
      const frame = frameWith(...RIDE.find((r) => r.name === state)!.classes);
      const body = child(frame, "hk-modal-body");
      expect(winner(body, "transform", DESKTOP), state).toBe(value);
      // `center center` / `center` / `50%` all compute to the same origin.
      const origin = (winner(body, "transform-origin", DESKTOP) ?? "")
        .replace(/\bcenter\b/g, "50%")
        .split(/\s+/)
        .filter(Boolean);
      const [x = "50%", y = "50%"] = origin;
      expect([x, y], state).toEqual(["50%", "50%"]);
    };
    expect_("enter-from", "scale(0.95, 1)");
    expect_("leave-to", "scale(0.95, 1)");
    expect_("enter-to", "scale(1, 1)");
    expect_("leave-from", "scale(1, 1)");
    // …and the same with the opt-in draggable flag on, where an
    // attribute-qualified rule could otherwise slip past the mocks.
    for (const state of RIDE) {
      const frame = draggableFrameWith(...state.classes);
      const body = child(frame, "hk-modal-body");
      const expected =
        state.name === "enter-from" || state.name === "leave-to" ? "scale(0.95, 1)" : "scale(1, 1)";
      expect(winner(body, "transform", DESKTOP), `draggable ${state.name}`).toBe(expected);
    }
    // At rest the body carries no transform at all.
    expect(winner(child(frameWith(), "hk-modal-body"), "transform", DESKTOP)).toBeUndefined();
  });

  it("rides the content scale on the family timing tokens", () => {
    const body = (state: string, prop: string) => {
      const frame = frameWith(...RIDE.find((r) => r.name === state)!.classes);
      return winner(child(frame, "hk-modal-body"), prop, DESKTOP);
    };
    // Whole-value pins, same rationale as the frame transitions above.
    expect(body("enter-from", "transition")).toBe(BODY_ENTER_TRANSITION);
    expect(body("leave-to", "transition")).toBe(BODY_LEAVE_TRANSITION);
    expect(body("enter-from", "will-change")).toBe("transform");
  });

  it("never transforms the chrome: title bar, sub-header, footer, close button, title glyph", () => {
    for (const state of RIDE) {
      const frame = frameWith(...state.classes);
      const header = child(frame, "hk-modal-header");
      // The real tree nests the title inside the header and the scroll
      // wrapper inside the body — a selector qualified by those ancestors
      // must be matched against the same shape, or it sails past.
      const title = child(header, "hk-modal-title");
      const body = child(frame, "hk-modal-body");
      const scroll = child(body, "hk-modal-body-scroll");
      const inner = child(scroll, "hk-modal-body-inner");
      const surfaces: Array<[string, MockElement]> = [
        ["hk-modal-header", header],
        ["hk-modal-subheader", child(frame, "hk-modal-subheader")],
        ["hk-modal-footer", child(frame, "hk-modal-footer")],
        ["hk-modal-title (inside the header)", title],
        ["hk-modal-body-scroll", scroll],
        ["hk-modal-body-inner (inside the body)", inner],
      ];
      for (const [name, element] of surfaces) {
        for (const prop of ["transform", "transform-origin", "scale", "zoom", "translate"]) {
          expect(winner(element, prop, DESKTOP), `${state.name} ${name} ${prop}`).toBeUndefined();
        }
      }
    }
  });

  it("flattens the content scale under prefers-reduced-motion", () => {
    const frame = frameWith("hk-modal-content-enter-from", "hk-modal-content-enter-active");
    const body = child(frame, "hk-modal-body");
    expect(winner(body, "transform", DESKTOP_REDUCED)).toBe("none");
    expect(winner(body, "transition", DESKTOP_REDUCED)).toBe("none");
    expect(winner(body, "will-change", DESKTOP_REDUCED)).toBe("auto");
    expect(winner(frame, "transition", DESKTOP_REDUCED)).toBe("none");
    // The frame's height ride flattens too: the ride states fall back to
    // the bare centering translate (no appended scaleY) — same specificity
    // as the desktop state rules, later in the sheet, so the flatten wins
    // by source order. Both ride directions pin (R2 finding 2026-11-06
    // (S3): the body flatten used to pin enter-from only).
    expect(winner(frame, "transform", DESKTOP_REDUCED)).toBe(CENTERING);
    const leaveEnd = frameWith("hk-modal-content-leave-to", "hk-modal-content-leave-active");
    expect(winner(leaveEnd, "transform", DESKTOP_REDUCED)).toBe(CENTERING);
    const leaveBody = child(leaveEnd, "hk-modal-body");
    expect(winner(leaveBody, "transform", DESKTOP_REDUCED)).toBe("none");
    // Phones flatten too: the media-independent reduce block also wins over
    // the ≤767px sheet's translateY(100%) — a reduced-motion phone falls
    // back to the bare translate (one opacity-0 frame hides the flip)
    // instead of a full-height slide flash.
    expect(winner(frame, "transform", MOBILE_REDUCED)).toBe(CENTERING);
    expect(winner(leaveEnd, "transform", MOBILE_REDUCED)).toBe(CENTERING);
  });

  it("keeps the mobile sheet's translateY choreography untouched", () => {
    const frame = frameWith("hk-modal-content-enter-from", "hk-modal-content-enter-active");
    expect(winner(frame, "transform", MOBILE)).toBe("translateY(100%)");
    // The close direction rides the same downward slide (R2 finding
    // 2026-11-06 (S2): leave-to wasn't pinned — splitting the shared rule
    // and flipping it to translateY(-100%) used to stay green).
    const leaveEnd = frameWith("hk-modal-content-leave-to", "hk-modal-content-leave-active");
    expect(winner(leaveEnd, "transform", MOBILE)).toBe("translateY(100%)");
    // Settled states: no ride transform at either end of the sheet ride.
    expect(winner(frameWith("hk-modal-content-enter-to", "hk-modal-content-enter-active"), "transform", MOBILE)).toBe("none");
    expect(winner(frameWith("hk-modal-content-leave-from", "hk-modal-content-leave-active"), "transform", MOBILE)).toBe("none");
    const resting = frameWith();
    expect(winner(resting, "transform", MOBILE)).toBe("none");
    // No content-region scale in the sheet layout.
    const body = child(frame, "hk-modal-body");
    expect(winner(body, "transform", MOBILE)).toBeUndefined();
    expect(winner(child(leaveEnd, "hk-modal-body"), "transform", MOBILE)).toBeUndefined();
  });

  it("never lets ANY rule put a transform on a chrome surface", () => {
    // Fail-closed sweep: selector-level and media-independent, so a chrome
    // transform is caught whatever the combinator, grouping, attribute
    // gate or media query — `.hk-modal-header`, `:is(...)`,
    // `> .hk-modal-title`, `[data-draggable]`, `screen and (...)`, a
    // 769px query, `.hk-modal-body-inner` double-scales, all of it.
    const CHROME = /hk-modal-(header|subheader|title|footer|close|body-scroll|body-inner)\b/;
    const TRANSFORM_FAMILY = /^(transform|transform-origin|translate|scale|rotate|zoom|perspective)$/;
    const offenders: string[] = [];
    for (const rule of RULES) {
      if (!CHROME.test(rule.selector)) continue;
      for (const prop of rule.declarations.keys()) {
        if (TRANSFORM_FAMILY.test(prop)) offenders.push(`${rule.selector} { ${prop} }`);
      }
    }
    expect(offenders, "chrome must never carry a transform").toEqual([]);
  });

  it("lets the ride states declare only the animation properties", () => {
    // A layout declaration smuggled beside the scale (height/max-width/
    // padding) breaks the geometry contract without touching any scale
    // token, and a `transition-delay` desyncs the surface machine's
    // measured deadline (it reads duration only). Both must be impossible:
    // the ride rules may carry nothing but the animation properties.
    const MATRIX_ALLOWED = new Set([
      "transform",
      "transform-origin",
      "transition",
      "will-change",
      "opacity",
    ]);
    // Chrome ride states now also carry `transform` (the 2026-11-06 frame
    // height ride) — but nothing else beyond opacity/transition/will-change.
    const CHROME_ALLOWED = new Set(["opacity", "transition", "will-change", "transform"]);
    // The contracted transform values a ride rule may carry. Frame: the
    // three translate+scaleY states (reduced-motion flatten included);
    // body: the two two-arg scales.
    const LEGAL_FRAME = new Set([CENTERING, FRAME_FROM, FRAME_TO]);
    const LEGAL_BODY = new Set(["scale(0.95, 1)", "scale(1, 1)"]);
    const offenders: string[] = [];
    // Media-independent on purpose: a ride selector declared at top level
    // (no media query) applies at every width, so it must obey the same
    // allowlist as the desktop block. And UNANCHORED on purpose (R2 finding
    // 2026-11-06 (S2): the previous scan matched `^selector$`, so a
    // `[data-draggable] .hk-modal-content-enter-from`-style duplicate —
    // anything the cascade mock cannot match, like `:not()`/type-qualified/
    // pseudo-element rules — sailed past it): ANY rule whose selector
    // carries a ride class must obey the allowlist, wherever it sits.
    for (const rule of RULES) {
      // The ≤767px sheet has its own choreography (translateY + height), and
      // the mobile assertions below cover it; this allowlist is the desktop
      // contract.
      if (rule.media.some((m) => m.includes("max-width"))) continue;
      if (!/hk-modal-content-(enter|leave)-(from|to|active)/.test(rule.selector)) continue;
      const isBodyRide = rule.selector.trim().endsWith(".hk-modal-body");
      const allowed = isBodyRide ? MATRIX_ALLOWED : CHROME_ALLOWED;
      for (const prop of rule.declarations.keys()) {
        if (!allowed.has(prop) && !prop.startsWith("--")) {
          offenders.push(`${rule.selector} { ${prop} }`);
        }
        if (prop.startsWith("transition-")) {
          offenders.push(`${rule.selector} { ${prop} (transition longhand) }`);
        }
      }
      // …and any transform such a rule carries must be one of the
      // contracted ride values, verbatim (normalized whitespace only).
      const raw = rule.declarations.get("transform");
      if (raw !== undefined) {
        const value = raw.replace(/\s+/g, " ").trim();
        const legal = isBodyRide ? LEGAL_BODY : LEGAL_FRAME;
        if (!legal.has(value)) {
          offenders.push(`${rule.selector} { transform: ${value} (not a contracted ride value) }`);
        }
      }
    }
    expect(offenders, "ride rules must carry only animation properties").toEqual([]);
  });

  it("keeps the contracted per-axis grammar (no alternate syntax escapes)", () => {
    // 2026-11-06 grammar: the frame rides `translate(…) scaleY(s)`; the
    // body rides two-arg `scale(x, 1)`. Any other expression of the same
    // idea — single-arg scale on the frame list, per-axis longhand
    // functions, scale3d, a computed matrix, or the independent transform
    // properties — would break the contracted interpolation shape and must
    // be impossible.
    const BODY_ESCAPES = /scale[XYZ]\(|scale3d\(|matrix[23]d?\(/;
    const FRAME_ESCAPES = /scale\([^)]*,|scaleX\(|scale3d\(|matrix[23]d?\(|\brotate\(/;
    for (const state of RIDE) {
      const frame = frameWith(...state.classes);
      const body = child(frame, "hk-modal-body");
      const bodyTransform = winner(body, "transform", DESKTOP) ?? "";
      expect(bodyTransform, `body ${state.name}`).toMatch(/^scale\(([\d.]+), 1\)$/);
      expect(bodyTransform, `body ${state.name}`).not.toMatch(BODY_ESCAPES);
      expect(winner(body, "scale", DESKTOP), `body ${state.name}`).toBeUndefined();
      expect(winner(body, "translate", DESKTOP), `body ${state.name}`).toBeUndefined();
      expect(winner(body, "zoom", DESKTOP), `body ${state.name}`).toBeUndefined();

      const frameTransform = winner(frame, "transform", DESKTOP) ?? "";
      const centeringRe = CENTERING.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      expect(frameTransform, `frame ${state.name}`).toMatch(
        new RegExp(`^${centeringRe} scaleY\\((0\\.9|1)\\)$`),
      );
      expect(frameTransform, `frame ${state.name}`).not.toMatch(FRAME_ESCAPES);
      expect(winner(frame, "scale", DESKTOP), `frame ${state.name}`).toBeUndefined();
      expect(winner(frame, "zoom", DESKTOP), `frame ${state.name}`).toBeUndefined();
    }
  });
});
