import { readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { compile } from "sass";
import { describe, expect, it } from "vitest";

/**
 * Compiled-stylesheet guard for the three selection controls
 * (HkCheckbox / HkRadio / HkSwitch) and the label sheet they ride
 * (HkLabel).
 *
 * Vitest stubs CSS, so the behavioral suites can never catch a geometry or
 * alignment fact drifting. This guard compiles the four sheets and pins
 * the facts the 2026-09 alignment/size fix introduced:
 *
 *   1. inline-in-text alignment: every control root declares
 *      `vertical-align: middle` (baseline parked the inline-flex's bottom
 *      edge on the text baseline, riding the box ~4–7px above the text's
 *      visual center — measured in headless Chrome).
 *   2. checkbox box scale: the box follows the sm/md/lg size modifiers
 *      (it previously ignored `size` entirely and rendered an md box in
 *      lg rows), matching HkRadio's box scale.
 *   3. switch geometry: the track/thumb grew (md 44×24 track, 20px thumb)
 *      and the checked travel stays exactly `track − 2×inset − thumb` per
 *      size, so the thumb can never detach from either pill edge.
 *   4. interaction faces: hover/press feedback exists on all three
 *      (checkbox hover was missing entirely; radio hover had no press
 *      twin) and the off track is a filled neutral, not a bare surface.
 *   5. label first-line anchoring: checkbox/radio pin the box to the
 *      MIDDLE OF THE LABEL'S FIRST LINE BOX instead of the middle of the
 *      whole label block, so a wrapped option no longer floats its box
 *      between the lines — a host that used to re-align the row with
 *      `align-items: flex-start` (which parked the box on the line's top
 *      edge, 1.5px off at the default step; 2.0 at sm and 1.0 at lg)
 *      no longer has to. The anatomy rides the ITEM (`align-self`) plus one
 *      gated offset per size step, so a foreign `align-items` on the row
 *      cannot undo it. The `align-self` carrier and every offset keep the
 *      `:has(.hk-label:not(:empty))` gate (the `box-sizing` carrier is
 *      deliberately ungated — it has to hold on every engine), so engines
 *      without `:has()` fall back to the previous centering instead of the
 *      bare top edge, and a label-less or empty-label control keeps its old
 *      layout.
 *      See the "label first-line anchoring" block for the three-way
 *      arithmetic this pins.
 *
 * The rules below are parsed out of the COMPILED css (not the .scss
 * source) so a rule that fails to compile can never count as present.
 */

const componentDir = resolve(dirname(fileURLToPath(import.meta.url)));

interface Rule {
  selector: string;
  body: string;
  /** Set for a rule that lives inside an at-rule (`@media`, plus the `@scope` /
   * `@layer` / `@supports` / `@container` preludes the walker also keeps), so
   * `find()`/the selector-set helper keep reading the UNCONDITIONAL anatomy and
   * a scoped copy can never shadow it. */
  media?: string;
}

/** Splitter for the expanded output of these leaf sheets. */
function rules(css: string): Rule[] {
  // Expanded output keeps loud comments, and sheets containing non-ASCII
  // text get a braille-less `@charset "UTF-8";` statement — both would glue
  // onto the next selector and shift every rule pair, so strip them first.
  const bare = css
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/@charset[^;]*;/g, "")
    .trim();
  const out: Rule[] = [];
  // Brace-matching walk, not a flat regex: a rule inside an at-rule must not be
  // parsed as if it were unconditional. `@media (prefers-reduced-motion:
  // reduce) { .hk-checkbox-box { … } }` is exactly that shape, and a flat
  // splitter hands it the same selector as the base rule — `find()` would then
  // read whichever came first while the media copy won at runtime.
  const stack: Array<{ prelude: string; atRule: boolean }> = [];
  let buffer = "";
  for (const char of bare) {
    if (char === "{") {
      const prelude = buffer.trim();
      buffer = "";
      stack.push({ prelude, atRule: prelude.startsWith("@") });
      continue;
    }
    if (char !== "}") {
      buffer += char;
      continue;
    }
    const frame = stack.pop();
    const body = buffer.trim();
    buffer = "";
    if (!frame || frame.atRule || !body) {
      continue;
    }
    // EVERY rule, not just the ones naming a control part: a label rule
    // smuggled in as `[data-theme=dark] .hk-label { line-height: 2 }` — or a
    // bare `*` — used to be dropped here, invisible to every guard below while
    // the browser applied it (the text then sits 2–3px off the box). No sheet
    // in this package emits a rule the assertions below cannot name, so an
    // unclassifiable rule should fail loudly instead of vanishing.
    const media = stack.filter((f) => f.atRule).map((f) => f.prelude).join(" ");
    out.push(media ? { selector: frame.prelude, body, media } : { selector: frame.prelude, body });
  }
  // No `expect` here: this runs at module level, and a describe-level failure
  // aborts collection, which vitest reports as "Tests  no tests" — a real
  // duplicate then looks like a broken harness. The check lives in
  // "compiles each selector at most once" below, where it fails as a test.
  return out;
}

/**
 * Selectors a sheet emits more than once. `find()` returns the FIRST match, so
 * a rule duplicated further down the sheet (appended by a later partial, or
 * re-emitted) would silently shadow the one every assertion reads while
 * winning at runtime. A no-`@media` duplicate counts once per prelude, so a
 * media copy is reported only if the media copy itself repeats.
 */
function duplicateSelectors(all: Rule[]): string[] {
  const seen = new Set<string>();
  const dupes: string[] = [];
  for (const rule of all) {
    const key = `${rule.media ?? ""}|${rule.selector}`;
    if (seen.has(key)) dupes.push(rule.media ? `${rule.media} | ${rule.selector}` : rule.selector);
    seen.add(key);
  }
  return dupes;
}

/**
 * The SUBJECT of a complex selector = its last compound. Combinators are
 * split only OUTSIDE brackets/parens, so `:has(…)` / `:not(…)` arguments can
 * never split a selector. Testing the subject is what keeps the sheet's own
 * idiom inside the guards below: a `selector.endsWith(".hk-checkbox-box")`
 * suffix test silently routes `.hk-checkbox-box[data-checked]` and
 * `.hk-checkbox-box:not([data-indeterminate])` around every assertion (the
 * 2026-11 closing round reproduced the whole reported bug with
 * `…:not([data-indeterminate]) { align-self: center }` and a fully green suite).
 */
/** Split a selector list on `separator` at depth 0 (`:is(a, b)` stays whole). */
function splitTopLevel(selector: string, separator: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < selector.length; i += 1) {
    const char = selector[i]!;
    if (char === "(" || char === "[") depth += 1;
    else if (char === ")" || char === "]") depth -= 1;
    else if (depth === 0 && char === separator) {
      parts.push(selector.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(selector.slice(start));
  return parts.map((part) => part.trim()).filter(Boolean);
}

function subjectSelector(selector: string): string {
  let depth = 0;
  let cut = -1;
  for (let i = 0; i < selector.length; i += 1) {
    const char = selector[i]!;
    if (char === "(" || char === "[") depth += 1;
    else if (char === ")" || char === "]") depth -= 1;
    else if (depth === 0 && (char === " " || char === ">" || char === "+" || char === "~")) cut = i;
  }
  return selector.slice(cut + 1).trim();
}

/**
 * Drops the parenthesised ARGUMENTS that name other elements — `:has()`,
 * `:not()` and the `:nth-*` family — and flattens the wrappers that name the
 * SAME element (`:is()` / `:where()`), so a class inside `:is()` is still read.
 * `withoutParens()` below is the blunter tool the geometry readers use; this
 * one exists because the cross-sheet walk must not lose `:is(.hk-checkbox-box)`.
 */
function withoutForeignArgs(text: string): string {
  const FOREIGN = /^:(?:has|not|nth-child|nth-last-child|nth-of-type|nth-last-of-type)$/i;
  let out = text;
  for (let guard = 0; guard < 16; guard += 1) {
    const group = /\(([^()]*)\)/.exec(out);
    if (!group) break;
    const head = /:[a-z-]+$/i.exec(out.slice(0, group.index))?.[0] ?? "";
    const tail = out.slice(group.index + group[0].length);
    out = FOREIGN.test(head)
      ? `${out.slice(0, group.index - head.length)} ${tail}`
      : `${out.slice(0, group.index)} ${group[1]} ${tail}`;
  }
  return out;
}

/** Drops parenthesised groups (`:has(...)`, `:not(...)`), innermost first. */
function withoutParens(text: string): string {
  let out = text;
  for (let next = out.replace(/\([^()]*\)/g, ""); next !== out; ) {
    out = next;
    next = out.replace(/\([^()]*\)/g, "");
  }
  return out;
}

/** True when `className` names a class in `text` — `(.hk-checkbox-box)` may
 * not match `.hk-checkbox-box-inner`, and a `\w`/`-` continuation blocks it. */
function namesClass(text: string, className: string): boolean {
  // Parenthesised arguments are stripped first: a `:has()` / `:not()` argument
  // names OTHER elements, so `.hk-checkbox:has(.hk-label:not(:empty))` is a
  // rule about the root and must not count as a rule about the label (or as a
  // media-scoped label rule, which is the same reader one filter later).
  // `:is()` / `:where()` are the opposite case — they name the SAME element,
  // so stripping them is a deliberate false negative, sound only because the
  // class-led pin below bans such a subject outright (`:is(.hk-checkbox-box)`
  // does not start with a class). Text reading cannot tell the two wrappers
  // apart, so the ban is what keeps this approximation honest.
  const escaped = className.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`${escaped}(?![\\w-])`).test(withoutParens(text));
}

/** Rules whose SUBJECT names `className` (media-scoped ones included only
 * when `scope` says so — the default reads the unconditional anatomy). */
function subjectRules(all: Rule[], className: string, includeMedia = false): Rule[] {
  return all.filter(
    (r) => (includeMedia || !r.media) && namesClass(subjectSelector(r.selector), className),
  );
}

/**
 * Every class a control root can carry: the bare block plus its size steps.
 * `HkCheckbox.tsx` renders `class="hk-checkbox hk-checkbox-md"`, so a `:has()`
 * rule spelled on `-sm` / `-md` / `-lg` restyles the very same row — and a
 * reader that only knows the bare block files it under "somebody else's rule"
 * and never looks at it (a `.hk-checkbox-md:has(.hk-label:not(:empty))
 * { align-items: center }` restores the reported misalignment on md rows).
 * `HkRadio.tsx` carries the step on `data-size` and never renders those class
 * spellings; they stay in the set so a `.hk-radio-md` rule is still filed as
 * the root's, not as "somebody else's".
 */
function rootClasses(control: string): string[] {
  return [control, `${control}-sm`, `${control}-md`, `${control}-lg`];
}

/**
 * Every class an HkLabel can carry: the bare block, its default size step and
 * the two alternates. `HkLabel.tsx` renders `class={["hk-label",
 * `hk-label-${props.size}`]}`, so `.hk-label-md` IS the label — and a reader
 * that knows only the bare block files its rules under "somebody else's rule".
 * `namesClass`'s `(?![\\w-])` boundary used to make that a hard blind spot:
 * `.hk-label-md { line-height: 2 }` never matched the bare `.hk-label`, so
 * every label assertion stayed green while the text dropped 3.5px against the
 * box. Every label reader below therefore goes through this list.
 */
function labelClasses(): string[] {
  return [".hk-label", ".hk-label-sm", ".hk-label-md", ".hk-label-lg"];
}

/** Rules whose subject names ANY of `classes` — the root has four spellings. */
/**
 * Rules whose selector MENTIONS any of `classes` anywhere — not just as the
 * subject. The label readers need this: `.hk-label a { line-height: 2 }` names
 * the label in the subject only until you read the whole selector, so a
 * subject-only reader files the link's rule under "somebody else's rule" while
 * the browser restyles every labeled row. The generic spelling of the same
 * rule (`a { line-height: 2 }`, no class anywhere) is covered by the mover
 * table instead, because `PHRASING_CONTENT` makes every element a label can
 * contain reachable. Parenthesised arguments are stripped first, so the gate's
 * `:has(.hk-label:not(:empty))` does not count as a mention.
 */
function rulesMentioningAny(all: Rule[], classes: string[], includeMedia = false): Rule[] {
  return all.filter((r) => {
    if (r.media && !includeMedia) return false;
    return classes.some((c) => namesClass(r.selector, c));
  });
}

function rulesNamingAny(all: Rule[], classes: string[], includeMedia = false): Rule[] {
  return all.filter(
    (r) =>
      (includeMedia || !r.media) &&
      classes.some((className) => namesClass(subjectSelector(r.selector), className)),
  );
}

function find(all: Rule[], selector: string): Rule {
  const hit = all.find((r) => !r.media && r.selector === selector);
  expect(hit, `compiled rule for \`${selector}\``).toBeDefined();
  return hit!;
}

/**
 * The R2 adversarial round smuggled a `.hk-switch-md &` override past the
 * per-size assertions (the render picked it up, the tests kept reading the
 * base rule — a 0,2,0 selector beats the 0,1,0 base at runtime). Any
 * geometry face pinned here must therefore pin its WHOLE selector set:
 * a reader can only trust the values below when no unlisted, more
 * specific rule also touches the class.
 */
function expectSelectorSet(all: Rule[], classSuffix: string, expected: string[]) {
  // Subject match, not a suffix match: `.hk-checkbox-box:not([data-x])` and
  // `.hk-checkbox-box[data-checked]` DO touch the class and must show up here
  // (the closing round mutated exactly that shape past a suffix test). Every
  // such spelling is class-led, so the subject scan sees it — an earlier
  // revision filtered `[dir=` scopes out of this set on the theory that the
  // sheets carry rtl mirrors, but neither sheet has ever declared one (and the
  // class-led pin now bans that shape), so the filter only hid a rule from
  // this reader.
  const present = subjectRules(all, classSuffix)
    .map((r) => r.selector)
    .sort();
  expect(present, `selector set touching \`${classSuffix}\``).toEqual(expected.sort());
}

/** `2.25rem` / `14px` / `-1rem` → signed px number (1rem = 16px; bare numbers = rem). */
function toPx(decl: string): number {
  const m = decl.match(/(-?[\d.]+)(rem|px)?$/);
  expect(m, `length in "${decl}"`).not.toBeNull();
  const value = parseFloat(m![1]!);
  return m![2] === "px" ? value : value * 16;
}

/** Last declaration of `prop`, or undefined — the non-asserting reader for
 * values the collection phase needs (an `expect` there aborts the whole file). */
function lastDecl(body: string, prop: string): string | undefined {
  const matches = [...body.matchAll(new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`, "g"))];
  return matches.at(-1)?.[1]?.trim();
}

function valueOf(body: string, prop: string): string {
  // The browser applies the LAST declaration of a property; a reader that
  // takes the first one stays green while the render takes the appended
  // value (an extra `align-items: center` inside the gated rule put the box
  // back on the block middle — +21.75px at three lines — with a green suite).
  const matches = [...body.matchAll(new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`, "g"))];
  expect(matches.length, `declaration \`${prop}\` (declared exactly once)`).toBe(1);
  return matches[0]![1]!.trim();
}

/** Declaration names of a rule body, paren-aware (`a: f(x; y)` is one). */
function declarationNames(body: string): string[] {
  const names: string[] = [];
  let depth = 0;
  let buffer = "";
  const flush = () => {
    const declaration = buffer.trim();
    buffer = "";
    const name = declaration.match(/^([-\w]+)\s*:/);
    if (name) names.push(name[1]!);
  };
  for (const char of body) {
    if (char === "(") depth += 1;
    else if (char === ")") depth -= 1;
    if (char === ";" && depth === 0) flush();
    else buffer += char;
  }
  flush();
  return names;
}

/** `var(--token, fallback)` → its two halves; a literal value fails loudly. */
function cssVar(body: string, prop: string): { token: string; fallback: string } {
  const decl = valueOf(body, prop);
  const m = decl.match(/^var\((--[\w-]+),\s*(.+)\)$/);
  expect(m, `\`${prop}: ${decl}\` must read a token with a fallback`).not.toBeNull();
  return { token: m![1]!, fallback: m![2]!.trim() };
}

/**
 * `calc((1.5 * var(--text-base, 0.875rem) - 1.125rem) / 2)` → the four moving
 * parts: the label line-height coefficient, the label font token + fallback,
 * and the box term. Every one of them is checked against its home sheet in
 * "label first-line anchoring" below, so the formula can never drift away
 * from the label typography or the box scale it rides on.
 */
function offsetTerms(body: string): {
  lineHeight: number;
  token: string;
  fallback: string;
  box: string;
} {
  const decl = valueOf(body, "margin-block-start");
  const m = decl.match(
    /^calc\(\(([\d.]+) \* var\((--[\w-]+),\s*([^)]+)\) - ([\d.]+rem)\) \/ 2\)$/,
  );
  expect(
    m,
    `first-line offset \`${decl}\` must stay "(line-height × label font − box) / 2"`,
  ).not.toBeNull();
  return {
    lineHeight: parseFloat(m![1]!),
    token: m![2]!,
    fallback: m![3]!.trim(),
    box: m![4]!,
  };
}

const checkbox = rules(compile(resolve(componentDir, "HkCheckbox.scss"), { style: "expanded" }).css);
const radio = rules(compile(resolve(componentDir, "HkRadio.scss"), { style: "expanded" }).css);
const sw = rules(compile(resolve(componentDir, "HkSwitch.scss"), { style: "expanded" }).css);
const labelSheet = rules(compile(resolve(componentDir, "HkLabel.scss"), { style: "expanded" }).css);

/** Every `.scss` in the package except the four sheets the anatomy owns. */
function foreignSheetPaths(): string[] {
  const ROOT = resolve(componentDir, "..");
  const OWN = new Set(
    ["HkCheckbox", "HkRadio", "HkSwitch", "HkLabel"].map((name) =>
      resolve(componentDir, `${name}.scss`),
    ),
  );
  const sheets: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = resolve(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== "node_modules") walk(full);
      } else if (entry.name.endsWith(".scss") && !OWN.has(full)) {
        sheets.push(full);
      }
    }
  };
  walk(ROOT);
  return sheets;
}

interface CompiledSheet {
  rel: string;
  css: string;
  error?: string;
}

/**
 * Every foreign sheet, compiled ONCE per run: the token scan and the
 * no-token scan below read the same output, so the second reader is free.
 * `$s: "hk-check" + "box"` and the CSS escape `.hk-checkbo\78 -box` only
 * exist after Sass has run, so no source scan can see them; a sheet that
 * cannot compile is REPORTED by the reader, never silently skipped.
 */
let foreignSheetCache: CompiledSheet[] | null = null;
function compiledForeignSheets(): CompiledSheet[] {
  if (!foreignSheetCache) {
    const ROOT = resolve(componentDir, "..");
    foreignSheetCache = foreignSheetPaths().map((file) => {
      const rel = file.slice(ROOT.length + 1);
      try {
        return {
          rel,
          css: compile(file, {
            style: "expanded",
            loadPaths: [ROOT, resolve(componentDir, "../../../theme/styles")],
            logger: { warn() {}, debug() {} },
          }).css,
        };
      } catch (error) {
        return { rel, css: "", error: (error as Error).message.split("\n")[0] };
      }
    });
  }
  return foreignSheetCache;
}

/** The host bundle the Rust builder ships, compiled and parsed once. */
let hostBundleCache: Rule[] | null = null;
function compiledHostBundle(): Rule[] {
  if (!hostBundleCache) {
    hostBundleCache = rules(
      compile(resolve(componentDir, "../../../components/src/styles/index.scss"), {
        style: "expanded",
        loadPaths: [resolve(componentDir, "../../../theme/styles")],
        logger: { warn() {}, debug() {} },
      }).css,
    );
  }
  return hostBundleCache;
}

/**
 * The declarations that can still move a part WITHOUT NAMING one.
 *
 * A rule that names `.hk-checkbox-box` is covered by the scans in the
 * `cross-sheet walk` block. A rule that names nothing — `span:last-child`,
 * `*`, `[data-checked]` — reaches the very same span, and no token scan can
 * see it. Review measured the shipped cost: `span:last-child { line-height: 2 }`
 * pulled the label 3.0/3.5/4.0px off the box and
 * `span:first-child { margin-block-start: 8px !important }` pushed it
 * 4.0/6.5px down, both with every test in this file green.
 *
 * The test is INVERTED on purpose: a declaration counts as a mover unless it
 * only paints. An allowlist of movers was tried first and it had no `border*`,
 * so `span { border-block-start: 8px solid transparent }` — measured: the label
 * 8px below its box, invisible to the delta metric because the label's border
 * box moves with the text — added no row at all. A new geometric property is a
 * future hole in an allowlist; here it is a red test instead.
 *
 * `animation` is not here either: the shorthand names @keyframes and a frame
 * can carry `transform`, so `span:last-child { animation: d1 1s infinite }`
 * with `translateY(8px)` frames moved the label 8px with the gate green.
 * `animation-play-state` is the one animation property that cannot move
 * anything, so pausing the animation engine stays paint-only.
 *
 * `content` is not paint-only either: `span::before { content: url(<40px
 * svg>) }` inserts a replaced box that takes part in the line box and pulled
 * the label 24.5px with the gate green. It generates a box, so it is a mover.
 *
 * Custom properties: a SCOPED one is always a mover — `span:first-of-type
 * { --text-base: 2rem }` in a foreign sheet took the md offset from 1.5px to
 * 15px with the gate green (a literal `line-height` / `font-size` on a part is
 * a class-led rule, and those are banned outright). A GLOBAL one is a mover
 * too unless it is one of the `--text-*` sizes AND its value is a `px`/`rem`
 * length: `:root { --text-base: 2rem }` scales the line box and the offset
 * together (measured 0.000px), while `--text-base: 50%` resolves against the
 * parent font size where the label reads it and against the containing
 * block's WIDTH inside the margin `calc()` (measured: box 33.75px low), and
 * the unitless `0.875` is dropped as a `font-size` but still parsed inside the
 * calc (measured: box 3.0px high). Both were green before the value test.
 */
const PAINTS_ONLY =
  /^(?:color|background|border-(?:color|radius|image|block-color|inline-color)|box-shadow|text-shadow|filter|backdrop-filter|opacity|outline-(?:color|style|width)|text-decoration|caret-color|cursor|pointer-events|user-select|fill|stroke|stop-color|stop-opacity|will-change|visibility|z-index|transition|animation-play-state|scroll-behavior|overflow-style|tap-highlight-color|font-smoothing|text-size-adjust|scroll-snap|overscroll-behavior|touch-action|mask|clip-path|scrollbar-color|scrollbar-width|accent-color|print-color-adjust)(?:-|$)/;

/** The elements a `<label>` may contain: HTML phrasing content, plus custom
 * elements (`x-foo`, the hyphen is the tell). A rule on one of these can
 * restyle the text inside the label, so it is reachable; a rule on a block
 * element cannot — `<label>` accepts phrasing content only and a block inside
 * it is invalid markup. Review measured what the narrow `span|label` set cost:
 * `a { line-height: 2 }` in a foreign sheet pulled the label 3.0/3.5/4.0px off
 * the box with the whole gate green — the exact hazard the comment above
 * names. Widening it to EVERY tag is not an option either: it turns the table
 * from 47 rows into 928 (`p { margin: 0 }`, `ul { padding: 0 }`, …), i.e. a
 * table nobody reads. `img`/`svg`/`input` are deliberately out: a replaced
 * element inside a label is sized by `width`/`height` and its own rules are
 * full of them. */
const PHRASING_CONTENT = new Set([
  "a", "abbr", "b", "bdi", "bdo", "br", "cite", "code", "data", "del", "dfn", "em", "i", "ins",
  "kbd", "label", "mark", "output", "q", "rp", "rt", "ruby", "s", "samp", "slot", "small", "span",
  "strong", "sub", "sup", "time", "u", "var", "wbr",
]);

/** Attributes a selection part actually carries: `data-checked` on the box,
 * `data-size` on the root, … An attribute nothing carries cannot reach a part,
 * so `[data-el=dot]` is not in this set. */
const PART_ATTRS = new Set([
  "class",
  "id",
  "dir",
  "lang",
  "style",
  "title",
  "data-checked",
  "data-indeterminate",
  "data-disabled",
  "data-size",
  "data-type",
  "data-animating",
]);

/**
 * True when a subject compound can BE a selection part, its root, or anything
 * the label's text can contain: the parts are `span`s (box, label, thumb) and
 * the root is a `label`, but a `<span class="hk-label">` may hold any phrasing
 * content (`<a>`, `<code>`, `<em>`, …) and a rule on one of those restyles the
 * row just the same — `a { line-height: 2 }` in a foreign sheet moved the
 * label 3.0/3.5/4.0px with the gate green. The classes a part carries are all
 * `hk-*`, so a compound with no class/id selector, an attribute selector on
 * something a part carries, and a phrasing-content/universal/pseudo-only tag
 * is reachable.
 *
 * The tag is compared LOWERCASED and with any namespace prefix dropped: HTML
 * type selectors are ASCII case-insensitive, so `SPAN { margin-block-start:
 * 8px }` moved the label 8px with the gate green, and `*|span` / `|span` (a
 * namespace) walked through the same comparison.
 */
function couldMatchAPart(compound: string): boolean {
  // The arguments go FIRST. Reading the tag before dropping them turned
  // `span:nth-child(2)` into the tag "span2", i.e. "cannot reach a part", so
  // that rule never formed a row — review measured it moving the label
  // 3.0/3.5/4.0px with the whole gate green. Anything that still has an
  // unbalanced paren after the strip fails CLOSED (counted as reachable).
  const bare = withoutParens(compound.replace(/\[[^\]]*\]/g, ""));
  if (bare.includes("(") || bare.includes(")")) return true;
  if (/[.#]/.test(bare)) return false;
  // A global subject is reachable whatever attributes qualify it: `html`
  // covers every element no matter which theme hook is on it, so
  // `html[data-theme=dark] { --text-base: 50% }` is a real mover (`data-theme`
  // is not something a part carries, so the attribute test below said
  // "unreachable" and the whole rule vanished — measured: box 33.75px low with
  // the gate green).
  const globalBare = bare
    .replace(/::?[-\w]+/g, "")
    .replace(/\s+/g, "")
    .toLowerCase()
    .replace(/^.*\|/, "");
  if (globalBare === "*" || globalBare === "html" || globalBare === "body" || globalBare === ":root") {
    return true;
  }
  const attributes = [...compound.matchAll(/\[\s*([-\w]+)/g)].map((m) => m[1]!.toLowerCase());
  if (attributes.some((name) => !PART_ATTRS.has(name))) return false;
  const tag = bare
    .replace(/::?[-\w]+/g, "")
    .replace(/\*/g, "")
    .replace(/\s+/g, "")
    .trim()
    .toLowerCase()
    .replace(/^.*\|/, "");
  return tag === "" || PHRASING_CONTENT.has(tag) || tag.includes("-");
}

/** Subjects that cover EVERY element (`*`, `:root`, `html`, `body`, their
 * `:where()` spellings) or NO element at all (`*::before`, `*::after` — a
 * custom property set on a pseudo-element inherits nowhere, so it cannot pull
 * anything apart). Every other subject is scoped: review put
 * `span:first-of-type { --text-base: 2rem }` in a foreign sheet and the md
 * offset went 1.5px → 15px (label 13.5px off the box) with the gate green. */
const GLOBAL_SUBJECT = /^(?:\*|\*::[-\w]+|:root|html|body|:where\(\*\)|:where\(\*::[-\w]+\))$/;

/** The tokens the first-line arithmetic reads: the three `--text-*` sizes the
 * offsets are computed from (and that HkLabel sizes itself with). Only these
 * can pull the line box and the offset apart. */
const OFFSET_TOKENS = /^--text-(?:xs|sm|base|md|lg|xl)$/;

/** A token value that means the same thing in `font-size` and in the
 * `calc()`s: an absolute or root-relative length. `50%` resolves against the
 * PARENT font size in one place and the containing block's WIDTH in the other
 * (measured: box 33.75px low), `0.875` is invalid in both and dropped where it
 * lands in `font-size` but not inside the calc (measured: box 3.0px high), and
 * `2em` would resolve against a different element in each place. Colour and
 * font tokens are not offset tokens at all, so they stay exempt: the exemption
 * is keyed on the NAME, not on looking like a length. */
const SAFE_LENGTH = /^-?(?:\d*\.\d+|\d+)(?:px|rem)$/;

/** Every declaration that can move a box, as `name: value` text. The VALUE is
 * part of the row on purpose: a name-only pin read `* { border-width: 0 }` and
 * `* { border-width: 8px }` as the same row (measured: the label 8px low with
 * the table byte-identical), so `padding: 0` → `4px` and `border-width: 0` →
 * `8px` now both turn the table red. */
function movingDeclarations(body: string, scopedCustomProperties = false): string[] {
  const out: string[] = [];
  let depth = 0;
  let buffer = "";
  const flush = () => {
    const declaration = buffer.trim().replace(/\s+/g, " ");
    buffer = "";
    const match = declaration.match(/^([-\w]+)\s*:\s*(.+)$/);
    if (!match) return;
    const name = match[1]!;
    const value = match[2]!.trim();
    const moves = name.startsWith("--")
      ? scopedCustomProperties || (OFFSET_TOKENS.test(name) && !SAFE_LENGTH.test(value))
      : !PAINTS_ONLY.test(name.replace(/^-(?:webkit|moz|ms|o)-/, ""));
    if (!moves) return;
    out.push(`${name}: ${value}`);
  };
  for (const char of body) {
    if (char === "(") depth += 1;
    else if (char === ")") depth -= 1;
    if (char === ";" && depth === 0) flush();
    else buffer += char;
  }
  flush();
  return [...new Set(out)].sort();
}

/** Rules that can reach a part without naming it, one row per complex selector. */
function elementOnlyMovers(label: string, all: Rule[]): string[] {
  const rows: string[] = [];
  for (const rule of all) {
    if (/hk-(?:checkbox|radio|switch|label)(?!\w)/.test(rule.selector)) continue;
    for (const one of splitTopLevel(rule.selector, ",")) {
      const subject = subjectSelector(one);
      if (!couldMatchAPart(subject)) continue;
      const moves = movingDeclarations(rule.body, !GLOBAL_SUBJECT.test(subject.replace(/\s+/g, "")));
      if (moves.length === 0) continue;
      rows.push(`${label} :: ${rule.media ?? "-"} | ${one} | ${moves.join("; ")}`);
    }
  }
  return rows;
}

describe("selection controls inline alignment", () => {
  it.each([
    ["HkCheckbox", checkbox, ".hk-checkbox"],
    ["HkRadio", radio, ".hk-radio"],
    ["HkSwitch", sw, ".hk-switch"],
  ])("%s root declares vertical-align: middle", (_name, all, selector) => {
    expect(valueOf(find(all, selector).body, "vertical-align")).toBe("middle");
  });
});

describe("HkCheckbox box scale follows the size modifier", () => {
  // [name, px, selector] — `%s` in the title reads the number and prints
  // "18px"; a `%i` in the second slot used to read the selector string and
  // name the test "base (md) box is NaNpx".
  const cases: Array<[string, number, string]> = [
    ["base (md)", 18, ".hk-checkbox-box"],
    ["sm", 14, ".hk-checkbox-sm .hk-checkbox-box"],
    ["lg", 22, ".hk-checkbox-lg .hk-checkbox-box"],
  ];
  it.each(cases)("%s box is %spx", (_name, px, selector) => {
    const body = find(checkbox, selector).body;
    expect(toPx(valueOf(body, "width"))).toBe(px);
    expect(toPx(valueOf(body, "height"))).toBe(px);
  });

  it.each([
    ["sm", 11, ".hk-checkbox-sm .hk-checkbox-icon"],
    ["md base", 14, ".hk-checkbox-icon"],
    ["lg", 16, ".hk-checkbox-lg .hk-checkbox-icon"],
  ])("%s check icon is %spx", (_name, px, selector) => {
    const body = find(checkbox, selector).body;
    expect(toPx(valueOf(body, "width"))).toBe(px);
    // Square, like the box and the thumb beside it: a `height: 14px → 30px`
    // edit would otherwise pass the title's own claim.
    expect(toPx(valueOf(body, "height")), "tick height").toBe(px);
  });

  it("hover paints the primary edge on an unchecked box (HkRadio parity)", () => {
    const body = find(
      checkbox,
      ".hk-checkbox:not([data-disabled]):hover .hk-checkbox-box:not([data-checked]):not([data-indeterminate])",
    ).body;
    expect(valueOf(body, "border-color")).toContain("--hi-color-primary");
  });

  it("press squish on the box via the independent scale property", () => {
    const body = find(checkbox, ".hk-checkbox:not([data-disabled]):active .hk-checkbox-box").body;
    expect(valueOf(body, "scale")).toBe("0.9");
    // The squish only composes cleanly if the box transitions `scale`.
    expect(valueOf(find(checkbox, ".hk-checkbox-box").body, "transition")).toContain("scale");
  });
});

describe("HkRadio interaction parity", () => {
  it("press squish on the box via the independent scale property", () => {
    const body = find(radio, ".hk-radio:not([data-disabled]):active .hk-radio-box").body;
    expect(valueOf(body, "scale")).toBe("0.9");
    expect(valueOf(find(radio, ".hk-radio-box").body, "transition")).toContain("scale");
  });
});

describe("label first-line anchoring", () => {
  // HkLabel owns BOTH numbers the offset rides on: the label line box
  // (`line-height`) and the per-size font size. The sheet is compiled at module
  // level with the other three so the cross-sheet walk below can see it too;
  // the pairing is checked against the real label, not a copy of its numbers.
  // Looked up without asserting: a renamed `.hk-label` used to throw here and
  // abort the whole file ("Tests  no tests") instead of failing one test.
  const labelBase = labelSheet.find((r) => !r.media && r.selector === ".hk-label");
  const labelLineHeightRule = labelBase?.body ?? "";
  // A bare number: `line-height: 1.5` is a multiplier of the label's font
  // size, which is what the offset's `1.5 * font-size` term assumes. A px
  // line-height would parse to the same float but mean a different line box.
  // Read without asserting here: an `expect` at describe level aborts
  // collection and reports as "no tests" instead of a failing test, which
  // hides every other assertion in this file (the third closing round hit
  // exactly that when a label mutant looked like a harness failure). The
  // assertions live in the `it` below; this only derives the number the rest
  // of the block needs.
  const labelLineHeightDecl = lastDecl(labelLineHeightRule, "line-height") ?? "";
  const labelLineHeight = parseFloat(labelLineHeightDecl);
  const labelFont = (selector: string) => cssVar(find(labelSheet, selector).body, "font-size");

  it("HkLabel keeps the plain inline box the offsets assume", () => {
    expect(labelBase, "HkLabel.scss must declare `.hk-label`").toBeDefined();
    expect(
      valueOf(labelLineHeightRule, "line-height"),
      `HkLabel line-height "${labelLineHeightDecl}" must be a unitless multiplier`,
    ).toMatch(/^[\d.]+$/);
    // The offset rides the label's FIRST line box, which starts at the label's
    // border-box top: a block-direction margin, padding or border on the label
    // would sit between them and silently shift the text against the box (a
    // `border-block-start: 1px solid transparent` moves the text 1px down with
    // every assertion still green), and a translate/transform does the same
    // from the other side. A `::before` block adds height above the first line
    // box. Every spelling of the label counts (see `labelClasses`).
    for (const rule of rulesMentioningAny(labelSheet, labelClasses(), true)) {
      expect(
        rule.body,
        `the offset assumes a margin/padding/border-free, untransformed label (\`${rule.selector}\`)`,
      ).not.toMatch(
        /(?:^|;)\s*(?:margin|padding|border|translate|transform)(?:-[a-z-]+)?\s*:/,
      );
      expect(
        declarationNames(rule.body).filter((n) => /^(?:content|display)$/.test(n)),
        `\`${rule.selector}\` may not become a block box or take a pseudo-element`,
      ).toEqual(rule.selector === ".hk-label" ? ["display"] : []);
    }
  });

  it.each([
    ["HkCheckbox", checkbox, ".hk-checkbox", ".hk-checkbox-box"],
    ["HkRadio", radio, ".hk-radio", ".hk-radio-box"],
  ])("%s anchors the BOX, keeps the row centered, and falls back whole", (
    _name,
    all,
    selector,
    box,
  ) => {
    // `center` rode the middle of the whole label block (a wrapped option
    // floated its box between the lines); `flex-start` alone parks the box on
    // the line's TOP edge. The contract is `align-self` on the ITEM plus the
    // gated offsets — deliberately not `align-items` on the row, because a
    // row-level switch can be undone by any later sheet naming the control
    // (a comma list, an attribute spelling, a `label` type selector,
    // `!important`) while every per-part guard still reads a clean sheet.
    // `align-self` on the item outranks the container's `align-items` under
    // every specificity and source order, so the anatomy is immune.
    expect(valueOf(find(all, selector).body, "align-items")).toBe("center");
    expect(valueOf(find(all, `${selector}:has(.hk-label:not(:empty)) ${box}`).body, "align-self")).toBe(
      "flex-start",
    );
  });

  // Each row pairs the offset rule with the label size it reads and the box
  // it centers; the box size is read from the box's OWN rule, so changing the
  // box scale without updating the offset fails here.
  const rows: Array<[string, Rule[], string, string, string]> = [
    ["checkbox md", checkbox, ".hk-checkbox:has(.hk-label:not(:empty)) .hk-checkbox-box", ".hk-label", ".hk-checkbox-box"],
    [
      "checkbox sm",
      checkbox,
      ".hk-checkbox-sm:has(.hk-label:not(:empty)) .hk-checkbox-box",
      ".hk-label.hk-label-sm",
      ".hk-checkbox-sm .hk-checkbox-box",
    ],
    [
      "checkbox lg",
      checkbox,
      ".hk-checkbox-lg:has(.hk-label:not(:empty)) .hk-checkbox-box",
      ".hk-label.hk-label-lg",
      ".hk-checkbox-lg .hk-checkbox-box",
    ],
    ["radio md", radio, ".hk-radio:has(.hk-label:not(:empty)) .hk-radio-box", ".hk-label", "[data-size=md] .hk-radio-box"],
    [
      "radio sm",
      radio,
      ".hk-radio[data-size=sm]:has(.hk-label:not(:empty)) .hk-radio-box",
      ".hk-label.hk-label-sm",
      "[data-size=sm] .hk-radio-box",
    ],
    [
      "radio lg",
      radio,
      ".hk-radio[data-size=lg]:has(.hk-label:not(:empty)) .hk-radio-box",
      ".hk-label.hk-label-lg",
      "[data-size=lg] .hk-radio-box",
    ],
  ];

  it.each(rows)(
    "%s offset is half of (one label line − box), in the label's own units",
    (_name, all, offsetSelector, labelSelector, boxSelector) => {
      const terms = offsetTerms(find(all, offsetSelector).body);
      const font = labelFont(labelSelector);
      const boxBody = find(all, boxSelector).body;
      const boxPx = toPx(valueOf(boxBody, "width"));
      expect(toPx(valueOf(boxBody, "height")), "box stays square").toBe(boxPx);

      // The formula and the sheets it serves must agree on every input.
      expect(terms.lineHeight, "line-height coefficient mirrors HkLabel").toBe(labelLineHeight);
      expect(terms.token, "label font token").toBe(font.token);
      expect(terms.fallback, "label font token fallback").toBe(font.fallback);
      expect(toPx(terms.box), "box term mirrors the box's own width").toBe(boxPx);

      // Structure: the offset is HALF the leftover between one line box and
      // the box, i.e. the box midline lands on the line midline — exactly
      // where `align-items: center` put it for a single-line label. Dropping
      // the `/ 2` (box top on the line top) or over-correcting fails here.
      const lineBoxPx = labelLineHeight * toPx(font.fallback);
      const declaredOffset = (terms.lineHeight * toPx(terms.fallback) - toPx(terms.box)) / 2;
      expect(declaredOffset).toBeCloseTo((lineBoxPx - boxPx) / 2, 6);
      expect(declaredOffset, "box must be shorter than one line box").toBeGreaterThan(0);
    },
  );

  it.each([
    ["checkbox", checkbox, ".hk-checkbox-box", [
      ".hk-checkbox:has(.hk-label:not(:empty)) .hk-checkbox-box",
      ".hk-checkbox-sm:has(.hk-label:not(:empty)) .hk-checkbox-box",
      ".hk-checkbox-lg:has(.hk-label:not(:empty)) .hk-checkbox-box",
    ]],
    ["radio", radio, ".hk-radio-box", [
      ".hk-radio:has(.hk-label:not(:empty)) .hk-radio-box",
      ".hk-radio[data-size=sm]:has(.hk-label:not(:empty)) .hk-radio-box",
      ".hk-radio[data-size=lg]:has(.hk-label:not(:empty)) .hk-radio-box",
    ]],
  ])(
    "%s box only moves on a label-gated offset",
    (_name, all, box, expected) => {
      // (a) every vertical-shift declaration on the box is one of the three
      // offset rules and carries the `:has(.hk-label:not(:empty))` gate — a
      // label-less (or empty-label) control has no line box to ride and must
      // keep its old footprint; (b) nothing else in the sheet can move the
      // box: a smuggled `margin-*`, `padding-*`, `translate`, `transform`,
      // `align-self` or `top`/`bottom`/`inset` lands in this set and fails the
      // exact toEqual. `transform` is in the set because a `translateY()`
      // inside it moves the box exactly like `translate` does (this sheet
      // already animates the switch with transforms).
      // The parser keeps every rule that names a control part, it rejects
      // duplicate selectors, and the match reads the SUBJECT of each complex
      // selector (not its suffix), so a rule can neither hide outside the
      // filter behind `[data-…]`/`:not(…)` nor shadow the rule this test reads.
      const shiftRules = subjectRules(all, box).filter((r) =>
        /(?:^|;)\s*(?:margin(?:-[a-z-]+)?|padding(?:-[a-z-]+)?|translate|transform|align-self|top|bottom|inset(?:-[a-z-]+)?)\s*:/.test(
          r.body,
        ),
      );
      expect(shiftRules.map((r) => r.selector).sort()).toEqual([...expected].sort());
      for (const rule of shiftRules) {
        expect(rule.selector).toContain(":has(.hk-label:not(:empty))");
      }
    },
  );

  it.each([
    ["checkbox", checkbox, ".hk-checkbox-box"],
    ["radio", radio, ".hk-radio-box"],
  ])("%s box declares the sizing its offset reads", (_name, all, box) => {
    // The offset reads the box's width as a BORDER-BOX height (`width` and
    // `height` are equal, the box is square but its 1px border is added on
    // top of a content-box). Under a host reset that is border-box and
    // everything agrees; a consumer that imports this sheet without one would
    // inflate the box by 2px and land the offset 1px low, so the sheet
    // declares the sizing itself.
    expect(valueOf(find(all, box).body, "box-sizing")).toBe("border-box");
  });

  // The subject sets below are the R2 defence applied to the boxes: each one
  // names EVERY rule whose subject is that part, so a new or widened rule
  // (`.hk-checkbox[data-type=radio] .hk-checkbox-box`, a `:not(…)` tail, a
  // size step that re-emits the box) has to be added here on purpose instead
  // of silently taking part in the rendering the assertions above describe.
  it.each([
    [
      "checkbox",
      checkbox,
      ".hk-checkbox-box",
      [
        ".hk-checkbox-box",
        ".hk-checkbox-box[data-checked]",
        ".hk-checkbox-box[data-indeterminate]",
        ".hk-checkbox-box:has(.hk-checkbox-input:focus-visible)",
        ".hk-checkbox-sm .hk-checkbox-box",
        ".hk-checkbox-lg .hk-checkbox-box",
        ".hk-checkbox:has(.hk-label:not(:empty)) .hk-checkbox-box",
        ".hk-checkbox-sm:has(.hk-label:not(:empty)) .hk-checkbox-box",
        ".hk-checkbox-lg:has(.hk-label:not(:empty)) .hk-checkbox-box",
        ".hk-checkbox:not([data-disabled]):active .hk-checkbox-box",
        ".hk-checkbox:not([data-disabled]):hover .hk-checkbox-box:not([data-checked]):not([data-indeterminate])",
        ".hk-checkbox[data-type=radio] .hk-checkbox-box",
        ".hk-checkbox[data-animating] .hk-checkbox-box",
      ],
    ],
    [
      "radio",
      radio,
      ".hk-radio-box",
      [
        ".hk-radio-box",
        ".hk-radio-box[data-checked]",
        ".hk-radio-box:has(.hk-radio-input:focus-visible)",
        "[data-size=sm] .hk-radio-box",
        "[data-size=md] .hk-radio-box",
        "[data-size=lg] .hk-radio-box",
        ".hk-radio:has(.hk-label:not(:empty)) .hk-radio-box",
        ".hk-radio[data-size=sm]:has(.hk-label:not(:empty)) .hk-radio-box",
        ".hk-radio[data-size=lg]:has(.hk-label:not(:empty)) .hk-radio-box",
        ".hk-radio:not([data-disabled]):hover .hk-radio-box:not([data-checked])",
        ".hk-radio:not([data-disabled]):active .hk-radio-box",
      ],
    ],
  ])("%s box is only ever the subject of the rules pinned here", (
    _name,
    all,
    box,
    expected,
  ) => {
    expectSelectorSet(all, box, expected);
  });

  it.each([
    ["checkbox", checkbox, ".hk-checkbox-box", [
      ".hk-checkbox-box",
      ".hk-checkbox-sm .hk-checkbox-box",
      ".hk-checkbox-lg .hk-checkbox-box",
    ]],
    ["radio", radio, ".hk-radio-box", [
      "[data-size=sm] .hk-radio-box",
      "[data-size=md] .hk-radio-box",
      "[data-size=lg] .hk-radio-box",
    ]],
  ])("%s box owes its width/height to the size steps and nothing else", (
    _name,
    all,
    box,
    expected,
  ) => {
    // A state face that grows the box (`.hk-checkbox-box[data-checked]
    // { width: 2rem }`) keeps the offset aimed at an 18px box while the
    // rendered box is 32px — green suite, +7px off. The offset reads the
    // base/size-step box, so those must be the only rules sizing it.
    const sized = subjectRules(all, box)
      .filter((r) => /(?:^|;)\s*(?:width|height)\s*:/.test(r.body))
      .map((r) => r.selector)
      .sort();
    expect(sized, `rules sizing \`${box}\``).toEqual([...expected].sort());
  });

  it.each([
    ["checkbox", checkbox, ".hk-checkbox-box"],
    ["radio", radio, ".hk-radio-box"],
  ])("%s box has no media-scoped geometry besides the reduced-motion copy", (
    _name,
    all,
    box,
  ) => {
    // The parsers above read the UNCONDITIONAL anatomy, so a media-scoped
    // duplicate is invisible to them: `@media (min-width: 1px) {
    // .hk-checkbox-box { box-sizing: content-box } }` would win at runtime
    // with the suite green (+1px). The one sanctioned copy is the
    // reduced-motion transition kill, and it must stay a transition kill.
    const mediaRules = subjectRules(all, box, true).filter((r) => r.media);
    expect(mediaRules.map((r) => `${r.media} | ${r.selector}`).sort()).toEqual([
      `@media (prefers-reduced-motion: reduce) | ${box}`,
    ]);
    expect(mediaRules[0]!.body.replace(/\s+/g, "")).toBe("transition:none;");
  });

  it.each([
    ["checkbox", checkbox],
    ["radio", radio],
  ])("%s labels carry no media-scoped rule at all", (_name, all) => {
    // Same hole on the other half of the pair: a media-scoped `.hk-label`
    // rule changes the line box the offset rides.
    const mediaLabel = rulesMentioningAny(all, labelClasses(), true).filter((r) => r.media);
    expect(mediaLabel.map((r) => `${r.media} | ${r.selector}`)).toEqual([]);
  });

  it.each([
    ["checkbox", checkbox, ".hk-checkbox"],
    ["radio", radio, ".hk-radio"],
  ])("%s re-aligns the row only on the gate", (_name, all, control) => {
    // `align-items` is the other half of the contract. On a `:has()` engine a
    // second rule on the control root (`.hk-checkbox[class] { align-items:
    // flex-start }`) is INERT, not merely out-ranked: the box carries its own
    // `align-self`, and an item's alignment is not a specificity contest
    // against the row's `align-items` — that is exactly why the anatomy moved
    // to the item, and review measured 0.000 under every foreign spelling,
    // `!important` included. It must still not be there, because the fallback
    // engines have no gate and therefore no `align-self`: there the extra rule
    // is the only alignment and it parks the box on the line's top edge. All
    // four root spellings count (see `rootClasses`).
    const carriers = rulesNamingAny(all, rootClasses(control), true)
      .filter((r) => /(?:^|;)\s*align-items\s*:/.test(r.body))
      .map((r) => `${r.selector} → ${valueOf(r.body, "align-items")}`)
      .sort();
    expect(carriers, `align-items carriers on \`${control}\``).toEqual([`${control} → center`]);
  });

  it.each([
    ["checkbox", checkbox, ".hk-checkbox-box"],
    ["radio", radio, ".hk-radio-box"],
  ])("%s box declares box-sizing once, and on the box itself", (_name, all, box) => {
    // A second carrier — an `[dir=rtl]` scope, a media copy, a state face —
    // wins at runtime while the base rule (the one every assertion reads)
    // still says border-box (a `[dir=rtl] .hk-checkbox-box
    // { box-sizing: content-box }` lands the box +1px low in rtl only).
    const carriers = subjectRules(all, box, true)
      .filter((r) => declarationNames(r.body).includes("box-sizing"))
      .map((r) => r.selector);
    expect(carriers, `box-sizing carriers on \`${box}\``).toEqual([box]);
  });

  it("HkSwitch stays block-centred — no label gate, no item alignment", () => {
    // The switch is deliberately OUT of the first-line anatomy: its md track is
    // 24px, taller than the 21px line box, so the same arithmetic would need a
    // NEGATIVE offset and hang the track outside the row. That rationale lives
    // in a comment today; nothing executed it, so copying the two gated rules
    // into HkSwitch.scss (`align-items: flex-start` on a labeled switch, or an
    // `align-self` on the track with a naive 1.5rem offset) would move the
    // track off the row (measured back then: 1.5px; the copied offset with
    // the 24px track is −1.5px, hanging it above the row) while every
    // assertion in this file stayed green. Pin the
    // negative: one carrier, value `center`, and no item alignment at all.
    const carriers = rulesMentioningAny(sw, [".hk-switch"], true)
      .filter((r) => /(?:^|;)\s*align-items\s*:/.test(r.body))
      .map((r) => `${r.selector} → ${valueOf(r.body, "align-items")}`)
      .sort();
    expect(carriers, "align-items carriers in HkSwitch.scss").toEqual([".hk-switch → center"]);
    const selfAligned = sw
      .filter((r) => declarationNames(r.body).includes("align-self"))
      .map((r) => r.selector);
    expect(selfAligned, "HkSwitch rules declaring align-self").toEqual([]);
    const gated = sw.filter((r) => /:has\(\.hk-label/.test(r.selector)).map((r) => r.selector);
    expect(gated, "HkSwitch rules gated on a label").toEqual([]);
  });

  it.each([
    [
      "checkbox",
      checkbox,
      ".hk-checkbox-box",
      [
        "align-items",
        "align-self",
        "background",
        "border",
        "border-color",
        "border-radius",
        "box-shadow",
        "box-sizing",
        "display",
        "flex-shrink",
        "height",
        "justify-content",
        "margin-block-start",
        "position",
        "scale",
        "transition",
        "width",
        "will-change",
      ],
    ],
    [
      "radio",
      radio,
      ".hk-radio-box",
      [
        "align-items",
        "align-self",
        "background",
        "border",
        "border-color",
        "border-radius",
        "box-shadow",
        "box-sizing",
        "display",
        "flex-shrink",
        "height",
        "justify-content",
        "margin-block-start",
        "position",
        "scale",
        "transition",
        "width",
      ],
    ],
  ])("%s box may only declare the properties pinned here", (_name, all, box, allowed) => {
    // A property WHITELIST, because a blacklist is always one spelling short:
    // `margin-block` next to the calc, `block-size` instead of `width`,
    // `min-height`, `top` beside a whitelisted `position`, or a
    // `--text-base:` override on the box that retargets the calc itself —
    // each of those moved the box and left every reader green. This covers
    // state faces, media copies and rtl scopes too (`subjectRules(…, true)`).
    const declared = new Set<string>();
    for (const rule of subjectRules(all, box, true)) {
      for (const name of declarationNames(rule.body)) declared.add(name);
    }
    expect([...declared].sort(), `properties declared on \`${box}\``).toEqual([...allowed].sort());
  });

  it.each([
    ["checkbox", checkbox, ".hk-checkbox", ".hk-checkbox-box"],
    ["radio", radio, ".hk-radio", ".hk-radio-box"],
  ])("%s keeps the two boxes the anatomy rides on", (_name, all, control, box) => {
    // The whitelists above pin NAMES, so the two properties that decide
    // whether the offset can work at all can still be swapped for a legal
    // value: `display: inline-flex → inline` drops the flex row (−21.5px md,
    // −25px lg — worse than the reported defect) and `position: relative →
    // absolute` takes the box out of the flow, so the label starts where the
    // box used to be. One line each, and only these two are read by value.
    for (const selector of rootClasses(control)) {
      const rule = all.find((r) => !r.media && r.selector === selector);
      if (!rule) continue; // `-sm` / `-md` / `-lg` are only rules when a sheet declares them
      expect(valueOf(rule.body, "display"), `\`${selector}\` display`).toBe("inline-flex");
    }
    expect(valueOf(find(all, control).body, "display"), `\`${control}\` display`).toBe(
      "inline-flex",
    );
    const boxBody = find(all, box).body;
    // `display: flex → block` collapses the box's own centring of the tick and
    // is the declaration that makes the next two pins mean anything.
    expect(valueOf(boxBody, "display"), `\`${box}\` display`).toBe("flex");
    expect(valueOf(boxBody, "position"), `\`${box}\` position`).toBe("relative");
    expect(valueOf(boxBody, "align-items"), `\`${box}\` align-items`).toBe("center");
    expect(valueOf(boxBody, "justify-content"), `\`${box}\` justify-content`).toBe("center");
  });

  it("HkSwitch keeps the three faces its parts are stacked on", () => {
    // The per-rule table above pins NAMES, so the properties that decide
    // whether the stack exists at all can still be swapped for a legal value:
    // `.hk-switch-track { position: relative → static }` detached the thumb
    // 58px and `overflow: hidden` then clipped it away — the switch rendered
    // as an empty pill with every test in this file green (measured in
    // review). The checkbox/radio box had its `position` read by value; the
    // switch never did.
    const track = find(sw, ".hk-switch-track").body;
    expect(valueOf(track, "position"), "`.hk-switch-track` position").toBe("relative");
    expect(valueOf(track, "overflow"), "`.hk-switch-track` overflow").toBe("hidden");
    for (const part of [".hk-switch-thumb", ".hk-switch-content"]) {
      expect(valueOf(find(sw, part).body, "position"), `\`${part}\` position`).toBe("absolute");
    }
  });

  it.each([
    ["HkCheckbox", checkbox],
    ["HkRadio", radio],
    ["HkSwitch", sw],
  ])("%s compiles each selector at most once", (_name, all) => {
    expect(duplicateSelectors(all), "duplicate compiled selectors").toEqual([]);
  });

  it.each([
    ["HkCheckbox", checkbox],
    ["HkRadio", radio],
    ["HkSwitch", sw],
  ])("%s declares each property once per rule", (_name, all) => {
    // The duplicate-selector guard does not see this: a second declaration
    // INSIDE an already-pinned rule wins at runtime (CSS cascade) while every
    // reader keeps the first value.
    const duplicates = all
      .map((r) => ({ selector: r.selector, names: declarationNames(r.body) }))
      .filter((r) => r.names.length !== new Set(r.names).size)
      .map((r) => `${r.selector} → ${r.names.join(",")}`);
    expect(duplicates, "rules declaring a property twice").toEqual([]);
  });

  it.each([
    ["checkbox", checkbox],
    ["radio", radio],
  ])("%s sheet uses no comma-list selector", (_name, all) => {
    // Each reader resolves ONE subject per rule, so a rule that applies to the
    // box through a comma list (`…box, …icon { translate: 0 4px }`) is
    // invisible to it while the browser shifts the box 4px. Neither anchoring
    // sheet uses one; the switch's shared `.hk-switch-thumb, .hk-switch-content`
    // block sits outside the anchoring contract.
    const lists = all
      .filter((r) => splitTopLevel(r.selector, ",").length > 1)
      .map((r) => r.selector);
    expect(lists, "comma-list selectors").toEqual([]);
  });

  it.each([
    ["checkbox", checkbox, ".hk-checkbox"],
    ["radio", radio, ".hk-radio"],
  ])("%s root may only declare the properties pinned here", (_name, all, control) => {
    // `place-items: start` re-aligns the row exactly like `align-items`, while
    // the carrier test looks for the longhand — so a shotgunned shorthand would
    // win every run with the `align-items` carrier set still at two. A root
    // whitelist closes the whole family instead of the one spelling.
    const declared = new Set<string>();
    for (const rule of rulesNamingAny(all, rootClasses(control), true)) {
      for (const name of declarationNames(rule.body)) declared.add(name);
    }
    expect([...declared].sort(), `properties declared on \`${control}\``).toEqual([
      "-webkit-user-select",
      "align-items",
      "cursor",
      "display",
      "gap",
      "opacity",
      "user-select",
      "vertical-align",
    ]);
  });

  it.each([
    [
      "checkbox",
      checkbox,
      ".hk-checkbox",
      [".hk-checkbox", ".hk-checkbox[data-disabled]"],
    ],
    [
      "radio",
      radio,
      ".hk-radio",
      [".hk-radio", ".hk-radio[data-disabled]"],
    ],
  ])("%s root is the subject of exactly the rules pinned here", (
    _name,
    all,
    control,
    expected,
  ) => {
    // The whitelist above constrains WHICH properties a root rule may declare,
    // never WHICH root rules exist — and every one of those properties is legal
    // somewhere. So a new face declares nothing exotic and still reshapes the
    // row: `.hk-checkbox[data-disabled] { display: block }` stacks a disabled
    // row (the box lands 21.5px above its one-line place), `.hk-checkbox-md:has(
    // .hk-label:not(:empty)) { align-items: center }` puts the reported
    // misalignment back on every md row. Pin the set of root rules.
    const present = rulesNamingAny(all, rootClasses(control), true)
      .map((r) => (r.media ? `${r.media} | ${r.selector}` : r.selector))
      .sort();
    expect(present, `rules whose subject names \`${control}\``).toEqual(expected.sort());
  });

  /**
   * Every class a control part is matched by in the TSX — the domains the
   * per-rule table and the two domain pins are keyed by.
   */
  const PARTS = {
  checkbox: [
    ".hk-checkbox",
    ".hk-checkbox-box",
    ".hk-checkbox-icon",
    ".hk-checkbox-dot",
    ".hk-checkbox-indeterminate",
    ".hk-checkbox-input",
  ],
  radio: [".hk-radio", ".hk-radio-box", ".hk-radio-dot", ".hk-radio-input"],
  switch: [
    ".hk-switch",
    ".hk-switch-input",
    ".hk-switch-track",
    ".hk-switch-thumb",
    ".hk-switch-content",
    ".hk-switch-content-off",
    ".hk-switch-content-on",
  ],
} as const;

  it.each([
    [
      "checkbox",
      checkbox,
      PARTS.checkbox,
      [
        // one row per compiled rule of a control part, in selector order
        ".hk-checkbox → -webkit-user-select, align-items, cursor, display, gap, user-select, vertical-align",
        ".hk-checkbox-box → align-items, background, border, border-radius, box-sizing, display, flex-shrink, height, justify-content, position, transition, width",
        ".hk-checkbox-box:has(.hk-checkbox-input:focus-visible) → box-shadow",
        ".hk-checkbox-box[data-checked] → background, border-color",
        ".hk-checkbox-box[data-indeterminate] → background, border-color",
        ".hk-checkbox-dot → background, border-radius, height, width, z-index",
        ".hk-checkbox-icon → color, height, position, width, z-index",
        ".hk-checkbox-indeterminate → background, border-radius, height, width, z-index",
        ".hk-checkbox-input → height, opacity, pointer-events, position, width",
        ".hk-checkbox-lg .hk-checkbox-box → height, width",
        ".hk-checkbox-lg .hk-checkbox-dot → height, width",
        ".hk-checkbox-lg .hk-checkbox-icon → height, width",
        ".hk-checkbox-lg .hk-checkbox-indeterminate → width",
        ".hk-checkbox-lg:has(.hk-label:not(:empty)) .hk-checkbox-box → margin-block-start",
        ".hk-checkbox-sm .hk-checkbox-box → height, width",
        ".hk-checkbox-sm .hk-checkbox-dot → height, width",
        ".hk-checkbox-sm .hk-checkbox-icon → height, width",
        ".hk-checkbox-sm .hk-checkbox-indeterminate → width",
        ".hk-checkbox-sm:has(.hk-label:not(:empty)) .hk-checkbox-box → margin-block-start",
        ".hk-checkbox:has(.hk-label:not(:empty)) .hk-checkbox-box → align-self, margin-block-start",
        ".hk-checkbox:not([data-disabled]):active .hk-checkbox-box → scale",
        ".hk-checkbox:not([data-disabled]):hover .hk-checkbox-box:not([data-checked]):not([data-indeterminate]) → border-color",
        ".hk-checkbox[data-animating] .hk-checkbox-box → will-change",
        ".hk-checkbox[data-disabled] → cursor, opacity",
        ".hk-checkbox[data-type=radio] .hk-checkbox-box → border-radius",
        "@media (prefers-reduced-motion: reduce) | .hk-checkbox-box → transition",
      ],
    ],
    [
      "radio",
      radio,
      PARTS.radio,
      [
        ".hk-radio → -webkit-user-select, align-items, cursor, display, gap, user-select, vertical-align",
        ".hk-radio-box → align-items, background, border, border-radius, box-sizing, display, flex-shrink, justify-content, position, transition",
        ".hk-radio-box:has(.hk-radio-input:focus-visible) → box-shadow",
        ".hk-radio-box[data-checked] → background, border-color",
        ".hk-radio-dot → background, border-radius, height, width, z-index",
        ".hk-radio-input → height, opacity, pointer-events, position, width",
        ".hk-radio:has(.hk-label:not(:empty)) .hk-radio-box → align-self, margin-block-start",
        ".hk-radio:not([data-disabled]):active .hk-radio-box → scale",
        ".hk-radio:not([data-disabled]):hover .hk-radio-box:not([data-checked]) → border-color",
        ".hk-radio[data-disabled] → cursor, opacity",
        ".hk-radio[data-size=lg]:has(.hk-label:not(:empty)) .hk-radio-box → margin-block-start",
        ".hk-radio[data-size=sm]:has(.hk-label:not(:empty)) .hk-radio-box → margin-block-start",
        "@media (prefers-reduced-motion: reduce) | .hk-radio-box → transition",
        "[data-size=lg] .hk-radio-box → height, width",
        "[data-size=lg] .hk-radio-dot → height, width",
        "[data-size=md] .hk-radio-box → height, width",
        "[data-size=sm] .hk-radio-box → height, width",
        "[data-size=sm] .hk-radio-dot → height, width",
      ],
    ],
    [
      "switch",
      sw,
      PARTS.switch,
      [
        // The switch is the control that must NOT anchor: review (R9 SV-3)
        // moved its track +4.000px with `.hk-switch-track { margin-block-start:
        // 8px }`, +4.000px through a gate spelled `:has([class~="hk-label"])`,
        // and `.hk-switch { place-items: start }` moved it +1.0/+1.5/+2.0px
        // (+2.0/2.5/3.0 without the global `box-sizing: border-box` reset, which
        // is why the reset-free number is the one quoted elsewhere) — every one
        // green, because the negative pin above only forbade two literal rules
        // and this control had no rule-by-rule table. It has one now, so the
        // whole surface is explicit: a new rule shows up as a new row, and a
        // new property on an old rule as a changed row.
        ".hk-switch → -webkit-user-select, align-items, cursor, display, gap, user-select, vertical-align",
        ".hk-switch-input → height, opacity, pointer-events, position, width",
        ".hk-switch-input:focus-visible ~ .hk-switch-track → box-shadow",
        ".hk-switch-lg .hk-switch-content → font-size",
        ".hk-switch-lg .hk-switch-content-off → inset-inline-start",
        ".hk-switch-lg .hk-switch-content-on → inset-inline-end",
        ".hk-switch-lg .hk-switch-thumb → height, width",
        ".hk-switch-lg .hk-switch-track → height, width",
        ".hk-switch-lg[data-checked] .hk-switch-thumb → transform",
        ".hk-switch-md .hk-switch-thumb → height, width",
        ".hk-switch-md .hk-switch-track → height, width",
        ".hk-switch-md[data-checked] .hk-switch-thumb → transform",
        ".hk-switch-sm .hk-switch-content → font-size",
        ".hk-switch-sm .hk-switch-content-off → inset-inline-start",
        ".hk-switch-sm .hk-switch-content-on → inset-inline-end",
        ".hk-switch-sm .hk-switch-thumb → height, width",
        ".hk-switch-sm .hk-switch-track → height, width",
        ".hk-switch-sm[data-checked] .hk-switch-thumb → transform",
        ".hk-switch-content → font-size, font-weight, line-height, position, transition, white-space, z-index",
        ".hk-switch-content-off → color, inset-inline-start",
        ".hk-switch-content-on → color, inset-inline-end",
        ".hk-switch-danger[data-checked] .hk-switch-track → background, border-color",
        ".hk-switch-primary[data-checked] .hk-switch-track → background, border-color",
        ".hk-switch-secondary[data-checked] .hk-switch-track → background, border-color",
        ".hk-switch-thumb → background, border-radius, box-shadow, inset-inline-start, position, transition, z-index",
        ".hk-switch-track → align-items, background, border, border-radius, display, flex-shrink, overflow, position, transition",
        ".hk-switch-warning[data-checked] .hk-switch-track → background, border-color",
        ".hk-switch[data-disabled] → cursor, opacity",
        ".hk-switch:not([data-disabled])[data-checked]:hover .hk-switch-track → filter",
        ".hk-switch:not([data-disabled]):active .hk-switch-thumb → scale",
        ".hk-switch:not([data-disabled]):not([data-checked]):hover .hk-switch-track → background, border-color",
        "@media (prefers-reduced-motion: reduce) | .hk-switch-thumb, .hk-switch-content → transition",
        "[dir=rtl] .hk-switch-lg[data-checked] .hk-switch-thumb → transform",
        "[dir=rtl] .hk-switch-md[data-checked] .hk-switch-thumb → transform",
        "[dir=rtl] .hk-switch-sm[data-checked] .hk-switch-thumb → transform",
      ],
    ],
  ] as const)("%s parts declare exactly the properties pinned here, rule by rule", (
    _name,
    all,
    parts,
    expected,
  ) => {
    // The whitelists and the selector sets above constrain each domain in one
    // dimension. Neither says WHICH rule may carry WHICH whitelisted property,
    // so a pinned face can grow a legal-but-wrong declaration and move the
    // box: `.hk-checkbox-box[data-checked] { display: none }` deletes every
    // checked box, `.hk-checkbox-icon { translate: 0 4px }` drops the tick 4px
    // below the box centre, `scale: 1.6` in the base box rule inflates it out
    // of the line. This table pins the whole surface — rule → the declaration
    // names it carries, media scopes included — so adding or removing a
    // declaration on a control part has to be made here on purpose. It pins
    // NAMES, not values: a `height: 14px → 30px` edit on the tick, or a
    // `display: flex → block` on the box, passes this table. Those are the
    // surfaces the anchoring does not read (the tick is decoration inside the
    // box), and the declarations that DO move the box are pinned by value
    // elsewhere in this file; the table's job is to make the surface explicit
    // so a value edit is a visible, reviewable diff rather than a silent one.
    const called = (subject: string) =>
      (parts as readonly string[]).some((part) => namesClass(subject, part));
    const pinned = all
      .filter((r) => called(subjectSelector(r.selector)))
      .map(
        (r) =>
          // `replace(/\s+/g, " ")`: one media rule in the switch sheet is a
          // comma list, and the compiled prelude carries the newline+indent.
          `${r.media ? `${r.media} | ` : ""}${r.selector.replace(/\s+/g, " ")} → ${declarationNames(
            r.body,
          )
            .sort()
            .join(", ")}`,
      )
      .sort();
    expect(pinned, "declarations of the control parts, rule by rule").toEqual(
      [...expected].sort(),
    );
  });

  it.each([
    ["HkCheckbox", checkbox],
    ["HkRadio", radio],
    ["HkSwitch", sw],
  ])("%s rules never end in a subject that does not start with a class", (_name, all) => {
    // Every reader in this file decides "does this rule touch the box / the
    // root / the label?" by looking for that class NAME in the subject text.
    // A subject that can match the element without spelling its class is
    // therefore invisible to all of them while the browser applies it:
    // `…:has(.hk-label) > :first-child` and `span.hk-label` reach it
    // positionally, `[class="hk-checkbox-box"]`, `[class*="hk-checkbox-box"]`,
    // `[data-checked]` and `[dir=rtl].hk-label` reach it by attribute. The
    // parts are matched by class in the TSX and nothing else, so a class-led
    // subject name is the invariant that makes the readers sound: pin it.
    const odd = all
      .filter((r) => !subjectSelector(r.selector).startsWith("."))
      .map((r) => r.selector);
    expect(odd, "subjects that do not start with a class name").toEqual([]);
  });

  it.each([
    ["HkCheckbox.scss", checkbox, ".hk-checkbox"],
    ["HkRadio.scss", radio, ".hk-radio"],
    ["HkSwitch.scss", sw, ".hk-switch"],
    ["HkLabel.scss", labelSheet, ".hk-label"],
  ])("%s only styles its own parts", (_name, all, own) => {
    // Every reader above is per-sheet, but no consumer ever sees a sheet: the
    // Rust host imports all four into ONE stylesheet (styles/index.scss:
    // checkbox, radio, switch, label), so a later sheet wins at equal
    // specificity whatever component it names. A `.hk-checkbox-box { width:
    // 2.5rem; height: 2.5rem }` copied into HkRadio.scss therefore moved the md
    // checkbox box by 11px with all of the above green — the sm/lg boxes keep
    // their own (0,2,0) size rules, which out-rank an (0,1,0) rule in a later
    // sheet; the sheet that owns `.hk-checkbox-box` never sees the rule, and
    // the sheet that carries it is never asked about checkbox parts. Those
    // mirror sheets ("House parity (HkCheckbox)") are exactly where such a copy
    // comes from, so walk each sheet's subjects: a rule may name only its own
    // component's parts.
    //
    // The walk reads class TOKENS. A foreign part spelled as an attribute
    // inside `:is()` — `.y:is([class*="hk-checkbox-box"])` — passes it; that
    // shape only bites if the part itself carries a host class, which nothing
    // in the TSX does, so a token scan is the right depth today.
    // A comma list is one rule with several subjects: `.hk-checkbox-box,
    // .hk-switch-thumb { width: 2.5rem }` in HkSwitch.scss names the box in the
    // first compound, and a subject-only reader that stops at the last
    // compound (or at the comma) never sees it — that was the sixth door. The
    // switch keeps its one shared list (`.hk-switch-thumb, .hk-switch-content`
    // inside the reduced-motion block); reading one complex selector at a time
    // is what makes that legal rather than invisible.
    const foreign: string[] = [];
    for (const rule of all) {
      for (const one of splitTopLevel(rule.selector, ",")) {
        const subject = withoutForeignArgs(subjectSelector(one));
        for (const token of subject.match(/\.hk-[a-z0-9-]+/g) ?? []) {
          if (token !== own && !token.startsWith(`${own}-`)) foreign.push(`${rule.selector} -> ${token}`);
        }
      }
    }
    expect(foreign, "rules that name another component's part").toEqual([]);
  });

  it.each([
    ["checkbox", checkbox, PARTS.checkbox],
    ["radio", radio, PARTS.radio],
    ["switch", sw, PARTS.switch],
  ])("%s rules that move or lay out a part name the part they touch", (_name, all, parts) => {
    // The class-led pin makes the subject visible to the readers; it does not
    // make the readers see every ELEMENT. The icon and the dot carry classes
    // from whichever component renders them (lucide stamps `lucide-check` on
    // the svg), so a class-led rule can still move a rendered part without
    // naming a `.hk-` class: `.lucide-check { translate: 0 4px }` shifts the
    // tick exactly like an attribute-spelled subject would. Any rule that
    // declares motion or spacing must therefore name the part it moves.
    // Size is the third: `width`/`height` on the box is what the offsets
    // divide by, and it is the one property a reader reaches through
    // `:is()`/`:where()` (parens stripped) without naming the part. Layout is
    // the other half of "move": the box sits where it sits because
    // the row is a flex row with `center`/`flex-start`, so a rule that flips
    // `display`, `align-items` or `position` moves it just as surely as a
    // margin does. This is also the reader that sees a subject reaching the row
    // through a tail-position `:is()`/`:not()`: `namesClass` strips parens, so
    // `.row:is(.hk-checkbox):is(.hk-checkbox) { align-items: center }` tied the
    // gate's specificity and restored the defect with every other assertion
    // green.
    const moves = (body: string) =>
      declarationNames(body).some((name) =>
        /^(?:margin|padding|inset|top|bottom|left|right|translate|transform|scale|rotate|align-self|order|display|align-items|place-items|place-content|justify-content|position|box-sizing|width|height|min-width|min-height|max-width|max-height|block-size|inline-size)(?:-|$)/.test(
          name,
        ),
      );
    // Every complex selector in a comma list is checked: `subjectSelector()`
    // reads one subject, so `.hk-switch-thumb, .hk-checkbox-box { width: 2.5rem }`
    // in HkSwitch.scss used to name the thumb and never be asked about the box.
    const stray = all
      .flatMap((r) => splitTopLevel(r.selector, ",").map((one) => ({ rule: r, one: one.trim() })))
      .filter(({ rule }) => moves(rule.body))
      // HkRadioGroup is a different component: its rules lay out the group,
      // not the row, and the wrapper has no `.hk-` part to name.
      .filter(({ one }) => !/^\.hk-radio-group(?:$|[-.:])/.test(subjectSelector(one)))
      .filter(({ one }) => !(parts as readonly string[]).some((p) => namesClass(subjectSelector(one), p)))
      .map(({ rule }) => rule.selector);
    expect(stray, "rules that move or lay out a part without naming one").toEqual([]);
  });

  // Everything above compiles four sheets by hand. The browser gets whatever
  // the bundle happens to include: a Vue consumer pulls in each component's
  // sheet through its TSX side-effect import, while the Rust host ships two
  // artefacts — each component's own `scss!` sheet, and the builder's single
  // bundle entry `styles/index.scss`, which imports all 159 mirrors. So the fourth door was simply "write the
  // foreign rule in a sheet the guard never reads" — `.hk-checkbox-box { width:
  // 2.5rem; height: 2.5rem }` appended to HkSelectionGrid.scss moves the box
  // 11px with every test in this file green (HkSelectionGrid is imported 30
  // lines after HkLabel). Scan the whole directory instead of the four files,
  // and pin the host's import order so dropping one import cannot silently
  // delete the anatomy either.
  it("no other sheet in the package names a selection part", () => {
    // Every `.scss` under `src/` can ship — the component sheets through their
    // TSX side-effect imports, `styles/*` and `overlay/*` through the theme
    // entry — so a `.hk-checkbox-box` rule is only harmless in the four sheets
    // that own it. Walking `components/` alone still left `reset.scss` (the
    // file that already sets the global `box-sizing`) outside the net.
    // The token, not the class spelling: no leading dot, so an attribute
    // selector (`[class~="hk-checkbox"]`), a Sass variable holding the name
    // (`$c: "hk-checkbox"`) or a string-built selector is caught by the same
    // scan. `(?!\w)` and not `(?![\w-])` keeps the parts in: they ARE the
    // suffix (`.hk-checkbox-box`), so rejecting a trailing hyphen would only
    // match the bare root and let the very rule this test exists for through.
    // A name assembled from two halves (`"hk-check" + "box"`) or written with
    // a CSS escape (`.hk-checkbo\78 -box`) still slips through a SOURCE scan —
    // and it does not merely resize a part: a foreign rule can also feed the
    // offset (`margin-block-start`), and a pure resize moves the box by
    // `Δheight/2` because the offset's `-1.125rem` is a literal while the box
    // height is not. Measured in review: +4.000px at one line, +6.500px on a
    // three-line md row, +11.000px for the resize form, all green. The next
    // test compiles every foreign sheet instead, which closes the language
    // rather than the spelling.
    const SELECTION = /hk-(?:checkbox|radio|switch|label)(?!\w)/g;
    const ROOT = resolve(componentDir, "..");
    const sheets = foreignSheetPaths();
    expect(sheets.length, "owed sheets: every other stylesheet in the package").toBeGreaterThan(100);
    const mentions: string[] = [];
    for (const file of sheets) {
      const source = readFileSync(file, "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, " ")
        .replace(/(^|[^:])\/\/.*$/gm, "$1");
      for (const hit of source.match(SELECTION) ?? []) {
        mentions.push(`${file.slice(ROOT.length + 1)} -> ${hit}`);
      }
    }
    expect(mentions, "sheets outside the selection controls naming one").toEqual([]);
  });

  it("no other sheet in the package COMPILES a rule that names a selection part", () => {
    // The scan above reads SOURCE, so a name that only exists after Sass has
    // run walks straight past it: `$s: "hk-check" + "box"` and the CSS escape
    // `.hk-checkbo\78 -box` both compile to `.hk-checkbox-box`. Review
    // measured the shipped cost of that hole: +4.000px at one line, +6.500px
    // on a three-line md row (a foreign rule feeding `margin-block-start`),
    // +11.000px for the resize form — with every test in this file green.
    // Compiling is the fix, not a longer regex: an escape shell (`\78 `) or a
    // `@use`d variable can assemble the className at compile time, and no
    // reader of the source can enumerate those. Compile it instead.
    //
    // EVERY sheet is compiled. This test used to prefilter on
    // `source.includes("hk-")` to stay around 2s, and review walked through
    // that filter in one line: `$_s: "." + "h" + "k" + "-checkbox-box"` plus
    // `#{$_s} { margin-block-start: 8px !important }` spells no token in the
    // source, and moved the box +4.0px (one line) / +6.5px (three-line md)
    // with the guard green. Any prefilter is a spelling, and the whole point of
    // compiling is to stop matching spellings: all 195 sheets cost ~1.6s.
    const sheets = compiledForeignSheets();
    const broke = sheets.flatMap((sheet) =>
      sheet.error ? [`${sheet.rel} -> ${sheet.error}`] : [],
    );
    const offenders: string[] = [];
    for (const sheet of sheets) {
      // Compiled, not source: `#{…}`, escapes and variables are resolved, so
      // the only spelling that can still hide is one the browser cannot apply
      // either — except for a rule that carries NO token at all, which the
      // `no rule that names no part can move one` test below covers.
      // The BARE token, not `.hk-`: compiled output can spell the part through
      // an attribute selector (`[class~="hk-checkbox-box"]`), which a dot
      // anchor misses while the browser applies it. `(?!\w)` keeps the parts
      // in: `.hk-checkbox-box` ends the token at the hyphen on purpose.
      // Custom-property names are the one bare-token false positive —
      // `--hk-checkbox-box: 18px` DEFINES a value, it does not restyle a part —
      // so they are blanked before the match.
      const bare = sheet.css.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/--[\w-]+/g, "--");
      for (const hit of bare.match(/hk-(?:checkbox|radio|switch|label)(?!\w)/g) ?? []) {
        offenders.push(`${sheet.rel} -> ${hit}`);
      }
    }
    expect(broke, "foreign sheets this guard could not compile (so it cannot vouch for them)").toEqual(
      [],
    );
    expect(offenders, "sheets outside the selection controls compiling a selection part").toEqual([]);
  });

  it("the host stylesheet imports the four sheets in the documented order", () => {
    // `packages/components/src/styles/index.scss` is the Rust host's single
    // entry; a dropped `@import` deletes the anatomy from every Rust consumer
    // with this whole file still green.
    const host = readFileSync(
      resolve(componentDir, "../../../components/src/styles/index.scss"),
      "utf8",
    );
    // `[\w-]+`, not `[\w]+`: `window-close.scss` is hyphenated, and the
    // narrower class silently read 158 of the 159 imports while this comment
    // claimed all of them were pinned.
    const imported = [
      ...host.matchAll(/@import\s+['"]\.\/vue-mirror\/components\/([\w-]+)\.scss['"]/g),
    ].map((m) => m[1]);
    expect(imported.length, "mirror imports the regex reads").toBe(159);
    expect(imported.length, "mirror imports in the host stylesheet").toBeGreaterThan(100);
    const at = (name: string) => imported.indexOf(name);
    for (const name of ["HkCheckbox", "HkRadio", "HkSwitch", "HkLabel"]) {
      expect(at(name), `${name} is imported by the host stylesheet`).toBeGreaterThanOrEqual(0);
    }
    expect(at("HkCheckbox")).toBeLessThan(at("HkRadio"));
    expect(at("HkRadio")).toBeLessThan(at("HkSwitch"));
    expect(at("HkSwitch")).toBeLessThan(at("HkLabel"));
  });

  it("the host bundle ships no selection rule the four sheets do not declare", () => {
    // `index.scss` is the Rust host's single entry, and it imports 35
    // `components/*.scss` besides the 159 mirrors. Review put
    // `.hk-checkbox-box { margin-block-start: 8px !important }` in one of those
    // and moved the box +4.000px (one line) and +6.500px (three-line md) with
    // every guard green: the tests above read the four sheets and the host's
    // import ORDER, never the rest of what the host ships. Compiling the
    // bundle the way `builder` does and requiring its selection-scoped rules
    // to be exactly the four sheets' own closes the whole surface — a rule
    // added anywhere reachable from this entry changes the set.
    const hostDir = resolve(componentDir, "../../../components");
    const mirrorDir = resolve(hostDir, "src/styles/vue-mirror/components");
    const silent = { warn() {}, debug() {} };
    const options = { style: "expanded" as const, logger: silent };
    // Compiled and parsed once per run: the no-token scan below reads the same
    // bundle, and this entry is the most expensive compile in the file.
    const bundle = compiledHostBundle();
    // Selector-scoped, not selector-textual: `:has(.hk-label…)` on a foreign
    // rule must land in the set too, so the test is the token anywhere in the
    // selector.
    const SELECTION = /hk-(?:checkbox|radio|switch|label)(?!\w)/;
    const key = (rule: Rule) =>
      `${rule.media ?? "-"} | ${rule.selector.replace(/\s+/g, " ")} | ${rule.body.replace(/\s+/g, " ")}`;
    const scoped = (all: Rule[]) =>
      all
        .filter((rule) => SELECTION.test(rule.selector))
        .map(key)
        .sort();
    const declared = ["HkCheckbox", "HkRadio", "HkSwitch", "HkLabel"].flatMap((name) =>
      rules(compile(resolve(mirrorDir, `${name}.scss`), options).css),
    );
    const inBundle = scoped(bundle);
    const inSheets = scoped(declared);
    expect(inSheets.length, "selection-scoped rules the four sheets declare").toBeGreaterThan(50);
    expect(inBundle, "selection-scoped rules reachable from the host entry").toEqual(inSheets);
  });

  it("no rule that names no part can move one", () => {
    // Source and compiled scans both look for the TOKEN, so the one spelling
    // neither can see is a rule that carries no token at all. Both shipped
    // surfaces are walked: the host bundle (the 159 mirrors plus the host's own
    // sheets) and every foreign sheet on its own (the host does not import all
    // of them). Review measured six shapes through this hole — element,
    // pseudo, attribute, link-inside-the-label, `content`-generated box and a
    // global custom property carrying a non-length — and each moved the box
    // with this file green.
    //
    // The rows pinned below are what remains, and each one pins the
    // declaration TEXT (`name: value`), not just the name: a name-only pin read
    // `* { border-width: 0 }` and `* { border-width: 8px }` as the same row
    // (measured: the label 8px low with this table byte-identical), and the
    // same went for `:where(*) { padding: 0 }` → `4px`.
    //
    // The 47 rows fall into four shapes, and the count of each is part of the
    // claim, so a new shape cannot slip in unnoticed:
    //
    // * NINE universals — `*`, `*::before`, `*::after` in the reset, the theme
    //   entry and the host entry, plus the three `:where(…)` spellings. They
    //   reach the box directly; harmless AT THESE VALUES because they carry
    //   only `box-sizing` / `border-style` / `border-width` / `margin: 0` /
    //   `padding: 0` and the gated offset is (0,4,0) and compiles after them.
    // * EIGHT inherited root rows — `html`, `body` (and the one
    //   `html::-webkit-scrollbar`): everything inside the label inherits
    //   `line-height` / `font-size` from them, so `html { line-height: 2 }`
    //   would move the text the same way a `span` rule does. This is also why
    //   `html { writing-mode: vertical-rl }` is now a red test instead of a
    //   recorded limitation.
    // * NINETEEN direct-parent rows (`.hk-row > *`, `.s-auth-form > *`, …).
    //   They translate or size the control inside that row and never touch the
    //   box's own offset — but two re-shape the control itself:
    //   `.s-auth-form > *` (`display: flex; flex-direction: column`) and
    //   `.s-about-modal-backdrop > *` (`height: 100%`), so a control placed
    //   DIRECTLY under either parent loses the first-line anchoring. The
    //   package renders none there (see the migration notes).
    // * ELEVEN descendant rows on phrasing content — `code`, `.hk-markdown
    //   code`, `.hk-menu-item a`, `.icon-grid small`,
    //   `.hk-diff-viewer__hunk-stats em`, … — plus the
    //   `label:where(:not([class^=hk-])…)` host reset. These are the rows that
    //   make `a { line-height: 2 }` impossible to ship silently: a label may
    //   hold a link, so a rule on a link moves the row.
    //
    // Change any value and this table goes red, which is exactly what a row is
    // for. Over-reporting is deliberate: `html { font-size: 18px }` is a red
    // row even though it scales the line box and the offset together, because
    // a row is cheaper than a proof.
    const rows = [
      ...elementOnlyMovers("bundle", compiledHostBundle()),
      ...compiledForeignSheets().flatMap((sheet) => elementOnlyMovers(sheet.rel, rules(sheet.css))),
    ].sort();
    expect(rows, "rules that move a part without naming one").toEqual([
      "bundle :: - | .hk-calendar-heatmap-markers > span | white-space: nowrap",
      "bundle :: - | .hk-calendar-heatmap-rail > span | white-space: nowrap",
      "bundle :: - | .hk-diff-viewer__hunk-stats em | font-style: normal; font-weight: 600",
      "bundle :: - | .hk-draggable-list-content > :only-child | flex: 1; min-width: 0",
      "bundle :: - | .hk-glow-wrapper > * | position: relative",
      "bundle :: - | .hk-glow-wrapper-block > * | position: relative",
      "bundle :: - | .hk-layout > * | position: relative",
      "bundle :: - | .hk-markdown a:focus-visible | outline-offset: 2px; outline: 2px solid var(--hi-color-primary, #7aa2f7)",
      "bundle :: - | .hk-markdown code | font-family: var(--font-mono, ui-monospace, \"SF Mono\", Menlo, Consolas, \"DejaVu Sans Mono\", \"Liberation Mono\", \"PingFang SC\", \"Microsoft YaHei\", \"Noto Sans CJK SC\", monospace); font-size: 0.85em; padding: 0.15em 0.35em",
      "bundle :: - | .hk-menu-item a | align-items: center; display: flex; gap: 1rem; height: 100%; width: 100%",
      "bundle :: - | .hk-modal-body-inner > * + * | margin-top: var(--hk-modal-body-gap, 0.75rem)",
      "bundle :: - | .hk-row > * | margin: 0 0.5rem",
      "bundle :: - | .hk-sidebar-item-content a | align-items: center; bottom: -0.75rem; display: flex; gap: 0.875rem; left: -1.5rem; padding-left: 1.5rem; position: absolute; right: -1rem; top: -0.75rem",
      "bundle :: - | .hk-sidebar-leaf-content > a | align-items: center; display: flex; gap: 0.875rem; height: 100%; margin: -0.625rem -1rem -0.625rem -2.5rem; padding-left: 2.5rem; padding: inherit; width: 100%",
      "bundle :: - | .s-about-modal-backdrop > * | height: 100%; width: 100%",
      "bundle :: - | .s-auth-form > * | display: flex; flex-direction: column; gap: var(--space-16, 1rem)",
      "bundle :: - | :where(*) | box-sizing: border-box; margin: 0; padding: 0",
      "bundle :: - | :where(*::after) | box-sizing: border-box; margin: 0; padding: 0",
      "bundle :: - | :where(*::before) | box-sizing: border-box; margin: 0; padding: 0",
      "bundle :: - | body | -moz-osx-font-smoothing: grayscale; font-family: -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"PingFang SC\", \"Hiragino Sans GB\", \"Microsoft YaHei\", \"Noto Sans CJK SC\", sans-serif; font-size: 1rem; line-height: 1.5",
      "bundle :: - | code | font-family: ui-monospace, \"SF Mono\", Menlo, Consolas, \"DejaVu Sans Mono\", \"Liberation Mono\", \"PingFang SC\", \"Microsoft YaHei\", \"Noto Sans CJK SC\", monospace; font-size: 0.9em; padding: 0.2em 0.4em",
      "bundle :: - | html | font-size: 16px",
      "bundle :: - | html::-webkit-scrollbar | display: none",
      "bundle :: - | label:where(:not([class^=hk-]):not([class*=\" hk-\"])) | display: block; font-weight: 500; margin-bottom: 0.25rem",
      "components/HkAboutModal.scss :: - | .s-about-modal-backdrop > * | height: 100%; width: 100%",
      "components/HkCalendarHeatmap.scss :: - | .hk-calendar-heatmap-markers > span | white-space: nowrap",
      "components/HkCalendarHeatmap.scss :: - | .hk-calendar-heatmap-rail > span | white-space: nowrap",
      "components/HkDiffViewer.scss :: - | .hk-diff-viewer__hunk-stats em | font-style: normal; font-weight: 600",
      "components/HkDraggableList.scss :: - | .hk-draggable-list-content > :only-child | flex: 1; min-width: 0",
      "components/HkMarkdownRenderer.scss :: - | .hk-markdown a:focus-visible | outline-offset: 2px; outline: 2px solid var(--hi-color-primary, #7aa2f7)",
      "components/HkMarkdownRenderer.scss :: - | .hk-markdown code | font-family: var(--font-mono, ui-monospace, \"SF Mono\", Menlo, Consolas, \"DejaVu Sans Mono\", \"Liberation Mono\", \"PingFang SC\", \"Microsoft YaHei\", \"Noto Sans CJK SC\", monospace); font-size: 0.85em; padding: 0.15em 0.35em",
      "components/HkModal.scss :: - | .hk-modal-body-inner > * + * | margin-top: var(--hk-modal-body-gap, 0.75rem)",
      "components/HkScrollContainer.scss :: - | .hk-scroll-container[data-dock-tail=true] > .hk-scroll-container-viewport > * | flex-shrink: 0",
      "demo.scss :: - | .icon-grid small | font-size: 0.625rem",
      "demo.scss :: - | body | font-family: var(--font-sans, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"PingFang SC\", \"Hiragino Sans GB\", \"Microsoft YaHei\", \"Noto Sans CJK SC\", sans-serif); margin: 0; padding: 2rem",
      "styles/admin-tokens.scss :: - | .s-auth-form > * | display: flex; flex-direction: column; gap: var(--space-16, 1rem)",
      "styles/index.scss :: - | * | border-style: solid; border-width: 0; box-sizing: border-box",
      "styles/index.scss :: - | *::after | border-style: solid; border-width: 0; box-sizing: border-box",
      "styles/index.scss :: - | *::before | border-style: solid; border-width: 0; box-sizing: border-box",
      "styles/index.scss :: - | .s-auth-form > * | display: flex; flex-direction: column; gap: var(--space-16, 1rem)",
      "styles/index.scss :: - | body | font-family: var(--font-sans, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"PingFang SC\", \"Hiragino Sans GB\", \"Microsoft YaHei\", \"Noto Sans CJK SC\", sans-serif); margin: 0",
      "styles/index.scss :: - | html | line-height: 1.5",
      "styles/reset.scss :: - | * | border-style: solid; border-width: 0; box-sizing: border-box",
      "styles/reset.scss :: - | *::after | border-style: solid; border-width: 0; box-sizing: border-box",
      "styles/reset.scss :: - | *::before | border-style: solid; border-width: 0; box-sizing: border-box",
      "styles/reset.scss :: - | body | font-family: var(--font-sans, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"PingFang SC\", \"Hiragino Sans GB\", \"Microsoft YaHei\", \"Noto Sans CJK SC\", sans-serif); margin: 0",
      "styles/reset.scss :: - | html | line-height: 1.5",
    ]);
  });

  it("HkLabel pins the line box on its base rule and leaves the first line alone", () => {
    // The offset rides HkLabel's line box, so every rule that can change it
    // has to be visible here: a media copy, a per-size line-height, or a
    // label rule smuggled into a control sheet all shift the text against the
    // box by 0.6–3px with the coefficient assertions still green.
    const labelRules = rulesMentioningAny(labelSheet, labelClasses(), true);
    expect(
      labelRules.map((r) => `${r.media ?? "-"} | ${r.selector}`).sort(),
      "every HkLabel rule (media scopes included)",
    ).toEqual([
      "- | .hk-label",
      "- | .hk-label a",
      "- | .hk-label a:focus-visible",
      "- | .hk-label a:hover",
      "- | .hk-label.hk-label-lg",
      "- | .hk-label.hk-label-sm",
    ]);
    const withLineHeight = labelRules
      .filter((r) => declarationNames(r.body).includes("line-height"))
      .map((r) => r.selector);
    expect(withLineHeight, "line-height carriers").toEqual([".hk-label"]);
    // Descendant rules are the label's too. `.hk-label a { line-height: 2 }`
    // restyles every labeled row (measured −3.5px md), and a link rule is the
    // sheet's own sanctioned shape — HkLabel documents links as the one rich
    // element a label may hold. Pin the whole rule list with its declarations,
    // names only: a link may say `color`/`cursor`/`font-weight`, never
    // `line-height`, `margin`, `padding`, `translate` or `display: block`.
    expect(
      labelRules
        .map((r) => `${r.selector} → ${[...declarationNames(r.body)].sort().join(", ")}`)
        .sort((a, b) => (a.split(" → ")[0]! < b.split(" → ")[0]! ? -1 : 1)),
      "HkLabel's rules, subject and descendants",
    ).toEqual([
      ".hk-label → color, display, font-size, line-height",
      ".hk-label a → color, cursor, font-weight, text-decoration",
      ".hk-label a:focus-visible → outline, outline-offset",
      ".hk-label a:hover → text-decoration",
      ".hk-label.hk-label-lg → font-size",
      ".hk-label.hk-label-sm → font-size",
    ]);
    // And no rule on this sheet may reach the label through another spelling:
    // `*` or `[class~="hk-label"]` is exactly the round-3 hole, one file over.
    expect(duplicateSelectors(labelSheet), "duplicate compiled selectors").toEqual([]);
    const leadSubjects = labelSheet.map((r) => r.selector).filter((sel) => !sel.startsWith(".hk-label"));
    expect(
      leadSubjects,
      "HkLabel.scss rules whose subject is not a label spelling (a bare `*`, an attribute selector, a reordered compound)",
    ).toEqual([]);
    // Font size is the other half of the line box, so each step is read by
    // value: a `font-size: 20px` on a size step moves the target the offset
    // aims at without changing a single declaration name.
    expect(labelFont(".hk-label"), "label md font size").toEqual({
      token: "--text-base",
      fallback: "0.875rem",
    });
    expect(labelFont(".hk-label.hk-label-sm"), "label sm font size").toEqual({
      token: "--text-xs",
      fallback: "0.75rem",
    });
    expect(labelFont(".hk-label.hk-label-lg"), "label lg font size").toEqual({
      token: "--text-md",
      fallback: "1rem",
    });
    expect(declarationNames(find(labelSheet, ".hk-label").body).sort()).toEqual([
      "color",
      "display",
      "font-size",
      "line-height",
    ]);
    // The name is not enough for the two declarations the offset cannot
    // survive: `display: none` removes the label from every control (the gate
    // still matches the element — it is in the DOM — so the box takes its
    // offset onto an empty row) and a changed `line-height` moves the target
    // the offset aims at. Both are read by value below and above.
    expect(valueOf(find(labelSheet, ".hk-label").body, "display"), "label display").toBe(
      "inline",
    );
    expect(
      valueOf(find(labelSheet, ".hk-label").body, "line-height"),
      "label line-height (unitless multiplier)",
    ).toBe("1.5");
    for (const size of ["sm", "lg"]) {
      expect(
        declarationNames(find(labelSheet, `.hk-label.hk-label-${size}`).body),
        `\`.hk-label-${size}\` may only restyle the font size`,
      ).toEqual(["font-size"]);
    }
  });

  it.each([
    ["checkbox", checkbox],
    ["radio", radio],
    ["switch", sw],
  ])("%s sheets declare no .hk-label rule of their own", (_name, all) => {
    // `namesClass`, like every other reader — `startsWith` would miss a
    // leading attribute compound such as `[dir=rtl].hk-label` (the class-led
    // pin above bans it first, but the reader should not depend on that).
    const labelRules = rulesMentioningAny(all, labelClasses(), true).map((r) => r.selector);
    expect(labelRules, "label rules inside a control sheet").toEqual([]);
  });

  it("checkbox size offsets appear in md → sm → lg order (an equal-specificity tie)", () => {
    // All three checkbox offsets are 0,4,0, and a `-sm` / `-lg` control also
    // matches the plain `.hk-checkbox` rule (its class list contains both), so
    // the source order IS the tie-break: the base md offset has to come first,
    // because wherever it lands after a size rule it wins that control's tie
    // and hands it the md offset (sm 1.5 instead of 2.0 → box 0.5px high,
    // lg 1.5 instead of 1.0 → 0.5px low). Radio's size steps carry
    // `[data-size=…]` and win on specificity (0,5,0).
    const offsets = [
      ".hk-checkbox:has(.hk-label:not(:empty)) .hk-checkbox-box",
      ".hk-checkbox-sm:has(.hk-label:not(:empty)) .hk-checkbox-box",
      ".hk-checkbox-lg:has(.hk-label:not(:empty)) .hk-checkbox-box",
    ];
    const order = offsets.map((selector) => {
      const index = checkbox.findIndex((r) => r.selector === selector);
      expect(index, `compiled rule for \`${selector}\``).toBeGreaterThanOrEqual(0);
      return index;
    });
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });
});

describe("HkSwitch geometry", () => {
  const geometry: Array<[string, number, number, number]> = [
    // [size, track width, track height, thumb width]
    ["sm", 36, 20, 16],
    ["md", 44, 24, 20],
    ["lg", 52, 28, 24],
  ];

  it.each(geometry)("%s track is %ipx wide", (size, w, h) => {
    const body = find(sw, `.hk-switch-${size} .hk-switch-track`).body;
    expect(toPx(valueOf(body, "width"))).toBe(w);
    expect(toPx(valueOf(body, "height"))).toBe(h);
  });

  it.each(geometry.map(([size, , , thumb]) => [size, thumb]))("%s thumb is %ipx", (size, thumb) => {
    const body = find(sw, `.hk-switch-${size} .hk-switch-thumb`).body;
    expect(toPx(valueOf(body, "width"))).toBe(thumb);
    expect(toPx(valueOf(body, "height"))).toBe(thumb);
  });

  it.each(geometry)(
    "%s checked travel keeps the thumb inside both pill edges",
    (size, trackW, _trackH, thumb) => {
      const body = find(sw, `.hk-switch-${size}[data-checked] .hk-switch-thumb`).body;
      const inset = toPx(valueOf(find(sw, ".hk-switch-thumb").body, "inset-inline-start"));
      const border = toPx(valueOf(find(sw, ".hk-switch-track").body, "border").split(" ")[0]!);
      const travel = toPx(valueOf(body, "transform").replace("translateX(", "").replace(")", ""));
      // travel = track − 2×(border + inset) − thumb: inset-inline-start
      // resolves against the padding box, so the 1px border counts on BOTH
      // sides — the checked gap then equals the resting gap (3px) exactly.
      expect(travel).toBe(trackW - 2 * (border + inset) - thumb);
    },
  );

  it.each(geometry)(
    "%s off/on content anchors clear of the covering thumb",
    (size, trackW, _trackH, thumb) => {
      // md carries the base declaration; sm/lg get size overrides.
      const scoped = (base: string) =>
        find(sw, `.hk-switch-${size} ${base}`.replace(".hk-switch-md ", "")).body;
      const offBody = scoped(".hk-switch-content-off");
      const onBody = scoped(".hk-switch-content-on");
      // off face: starts after the resting thumb (2px inset + thumb + 2px gap).
      expect(toPx(valueOf(offBody, "inset-inline-start"))).toBe(2 + thumb + 2);
      // on face: ends before the checked thumb — the checked thumb starts
      // `2 + travel` from the padding-box start, i.e. (track−2−travel) from
      // the end, plus the 2px gap.
      const travel = toPx(
        valueOf(find(sw, `.hk-switch-${size}[data-checked] .hk-switch-thumb`).body, "transform")
          .replace("translateX(", "").replace(")", ""),
      );
      expect(toPx(valueOf(onBody, "inset-inline-end"))).toBe(trackW - 2 - travel);
    },
  );

  it("pins the whole selector set of each caption face (R2 M7 blind spot)", () => {
    // A more specific override (e.g. `.hk-switch-md .hk-switch-content-off`)
    // wins at runtime but is invisible to the per-size assertions above,
    // which read the base rule — the ONLY sanctioned scoped faces are the
    // sm/lg ones; anything else must fail here first.
    for (const face of [".hk-switch-content-off", ".hk-switch-content-on"]) {
      expectSelectorSet(sw, face, [
        face,
        `.hk-switch-sm ${face}`,
        `.hk-switch-lg ${face}`,
      ]);
    }
  });

  it("resting off track is a filled neutral, not a bare surface", () => {
    const body = find(sw, ".hk-switch-track").body;
    expect(valueOf(body, "background")).toContain("color-mix");
    expect(valueOf(body, "border")).toContain("color-mix");
  });

  it("hover recolors the off track and brightens the checked track", () => {
    expect(
      valueOf(
        find(sw, ".hk-switch:not([data-disabled]):not([data-checked]):hover .hk-switch-track").body,
        "background",
      ),
    ).toContain("color-mix");
    expect(
      valueOf(find(sw, ".hk-switch:not([data-disabled])[data-checked]:hover .hk-switch-track").body, "filter"),
    ).toContain("brightness");
  });

  it("press squish on the thumb via the independent scale property", () => {
    const body = find(sw, ".hk-switch:not([data-disabled]):active .hk-switch-thumb").body;
    expect(valueOf(body, "scale")).toBe("0.88");
    expect(valueOf(find(sw, ".hk-switch-thumb").body, "transition")).toContain("scale");
  });

  it("rtl mirrors the checked slide for every size", () => {
    for (const size of ["sm", "md", "lg"]) {
      const ltr = toPx(
        valueOf(find(sw, `.hk-switch-${size}[data-checked] .hk-switch-thumb`).body, "transform").replace(
          "translateX(",
          "",
        ).replace(")", ""),
      );
      const rtl = find(sw, `[dir=rtl] .hk-switch-${size}[data-checked] .hk-switch-thumb`).body;
      expect(toPx(valueOf(rtl, "transform").replace("translateX(", "").replace(")", ""))).toBe(-ltr);
    }
  });

  it.each([
    ["HkCheckbox", "HkCheckbox", ".hk-checkbox-box"],
    ["HkRadio", "HkRadio", ".hk-radio-box"],
    ["HkSwitch", "HkSwitch", ".hk-switch-thumb"],
  ])("%s press feedback is disabled under prefers-reduced-motion", (_name, sheet, selector) => {
    // Parse ONLY the reduced-motion block (the flat splitter would read the
    // base rule and make this pass vacuously).
    const css = compile(resolve(componentDir, `${sheet}.scss`), { style: "expanded" }).css;
    const marker = css.match(/@media[^{]*prefers-reduced-motion[^{]*{/);
    expect(marker, `reduced-motion block in ${sheet}.scss`).not.toBeNull();
    const blockRules = rules(css.slice(marker!.index! + marker![0]!.length));
    // The switch block groups `.hk-switch-thumb, .hk-switch-content` in one
    // rule — compare per selector in the list, whitespace-normalized.
    const hit = blockRules.find((r) =>
      r.selector.replace(/\s+/g, " ").split(", ").includes(selector),
    );
    expect(hit, `${selector} inside the reduced-motion block`).toBeDefined();
    expect(valueOf(hit!.body, "transition")).toBe("none");
  });
});
