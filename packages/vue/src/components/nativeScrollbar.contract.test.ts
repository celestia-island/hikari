import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * Source contract: A NATIVE SCROLLBAR MAY NEVER SHIP FROM HIKARI.
 *
 * hikari's scroll surfaces keep the browser's native scrolling MECHANICS
 * (wheel, touch, keyboard, scroll anchoring, snap) but the platform's own
 * scrollbar must never paint. The library's only sanctioned chrome is the
 * overlay engine in composables/useOverlayScrollbar.ts; its module header
 * states the division of labour verbatim: the element keeps its
 * `overflow: auto|scroll` mechanics, the engine adds the
 * `.hk-scrollbar-track`/`.hk-scrollbar-thumb` overlay, and "the
 * consumer's CSS is responsible for hiding the native bar
 * (`scrollbar-width: none` + `::-webkit-scrollbar { display: none }`)".
 * A sheet that declares native scrolling WITHOUT that suppression pair
 * ships a platform scrollbar through the design system on every host — the
 * 2026-11-08 wowsp battle-heatmap report (a native horizontal bar under a
 * chart) is exactly that leak.
 *
 * No runtime test can catch this: vitest stubs CSS, and happy-dom/jsdom do
 * no layout, so a real scrollbar never materialises in the test DOM. The
 * enforcement mechanism is therefore a STATIC source contract over the
 * shipped sheets, run on every PR. It is split in two groups because the
 * repo ships two stylesheet families with different suppression idioms:
 *
 *  1. SHIPPED VUE SHEETS (`packages/vue/src/**`, the sheets npm consumers
 *     resolve through the package exports). Every
 *     `overflow(-x|-y)?: auto|scroll` declaration must carry, INSIDE ITS
 *     OWN RULE BLOCK, `scrollbar-width: none` AND a nested
 *     `&::-webkit-scrollbar { display: none }` rule — the direct pair
 *     every modern sheet in this repo already uses (HkModal, HkTable,
 *     HkSidebar, …).
 *
 *     The ONE sanctioned owner is HkScrollContainer.scss: its
 *     `.hk-scroll-container-viewport` IS the shared overlay-scrollbar
 *     surface, so per-rule suppression is not demanded for every
 *     descendant selector targeting that element (the horizontal-axis
 *     override re-declares `overflow-x: auto` while the base viewport
 *     rule owns the suppression). The owner is verified POSITIVELY below
 *     (the base rule must still carry the pair) instead of being skipped
 *     silently, so the allowlist cannot decay into a green hole.
 *
 *  2. RUST/WASM COMPILED FAMILY (`packages/components/src/styles`). The
 *     legacy Gen-1 component sheets are NOT dead code: packages/builder/
 *     build.rs compiles `styles/index.scss` into `public/styles/
 *     bundle.css` for the Rust/WASM consumers (`@import`s at lines
 *     771-797 pull in layout/sidebar/code_block/demo_block/
 *     markdown_renderer/search/…), so a leak there ships too. Those
 *     sheets predate the direct pair and hide the native bar through the
 *     theme `scrollbar-hidden` mixin (`@include mix.scrollbar-hidden`),
 *     so the mixin include counts as suppression there — and the mixin's
 *     OWN definition is asserted to still declare both properties, so
 *     the credit is never hollow.
 *
 * EXEMPTIONS: exactly one class of declaration is allowed to use native
 * scrolling without suppression — the `.hk-overflow-auto` /
 * `.hk-overflow-y-auto` HOST UTILITY classes in the compiled aggregate
 * (packages/components/src/styles/index.scss), whose matching Rust
 * `ClassBuilder` vocabulary (packages/palette Overflow/OverflowY) lets a
 * HOST deliberately opt its own element into platform scrolling. Those
 * are host opt-ins, not hikari component chrome, so no component bar is
 * involved. The exemption is keyed on the exact file + exact selector and
 * pinned below, so a component-style overflow cannot ride it; the Vue
 * package ships no such utility at all (asserted), and its aggregate is
 * therefore held to the strict rule with no escape hatch.
 *
 * A note on the heatmap: HkCalendarHeatmap.scss is mid-migration onto
 * HkScrollContainer in the same wave (the sheet's `overflow-x: auto` is
 * being deleted). The pin at the bottom of group 1 is therefore
 * deliberately written as "no BARE declaration", so it accepts either
 * the migration (declaration gone) or a temporary suppression — it must
 * never accept the bare native scroller that caused the report.
 */

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../../../..");
const vueSrcRoot = resolve(repoRoot, "packages/vue/src");
const legacyStylesRoot = resolve(repoRoot, "packages/components/src/styles");

/** The shared overlay-scrollbar surface — see the header comment. */
const OWNER_SURFACE = "packages/vue/src/components/HkScrollContainer.scss";

interface RuleBlock {
  /** Offset of the rule's opening `{`. */
  open: number;
  /** Offset of the rule's closing `}`. */
  close: number;
  /** The rule's prelude (selector / at-rule), whitespace-collapsed. */
  selector: string;
}

interface ScrollDeclaration {
  /** Repo-relative sheet path, forward slashes (also the exemption key). */
  file: string;
  /** 1-based line of the declaration in the sheet source. */
  line: number;
  /** Selector prelude of the innermost rule containing the declaration. */
  selector: string;
  /** The enclosing rule's DIRECT declarations only (child rule bodies are
   *  cut out), so a suppression nested under a modifier class cannot green
   *  the base selector: `&.scrollbar-hidden { scrollbar-width: none }`
   *  hides the bar only in that state, never on the element itself. */
  ruleFlat: string;
  /** The enclosing rule's direct child rules (prelude + brace body). */
  ruleChildren: Array<{ prelude: string; body: string }>;
  /** The declaration as written, e.g. "overflow-y: auto". */
  text: string;
}

interface Sheet {
  /** Repo-relative path, forward slashes. */
  file: string;
  /** Source with SCSS comments blanked (length-preserving: offsets hold). */
  cleaned: string;
  declarations: ScrollDeclaration[];
}

/**
 * Blank SCSS comments while keeping every offset (and line break) stable,
 * so declaration line numbers and brace spans keep pointing at the real
 * source. Commented-out suppression (a real failure mode: the theme
 * partials document the pair in comments) must never count, and a
 * commented-out `overflow: auto` must never be mistaken for a scroll
 * surface. Strings are preserved verbatim — this repo's sheets only carry
 * quoted url() values, whose `//` must not read as a line comment.
 */
function stripComments(source: string): string {
  let out = "";
  let i = 0;
  let quote: string | null = null;
  while (i < source.length) {
    const ch = source[i]!;
    const next = source[i + 1] ?? "";
    if (quote) {
      out += ch;
      if (ch === "\\") {
        out += next;
        i += 2;
        continue;
      }
      if (ch === quote) quote = null;
      i += 1;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      out += ch;
      i += 1;
      continue;
    }
    if (ch === "/" && next === "/") {
      while (i < source.length && source[i] !== "\n") {
        out += " ";
        i += 1;
      }
      continue;
    }
    if (ch === "/" && next === "*") {
      out += "  ";
      i += 2;
      while (i < source.length && !(source[i] === "*" && source[i + 1] === "/")) {
        out += source[i] === "\n" ? "\n" : " ";
        i += 1;
      }
      if (i < source.length) {
        out += "  ";
        i += 2;
      }
      continue;
    }
    out += ch;
    i += 1;
  }
  return out;
}

/** Whitespace-collapse a prelude for stable selector comparisons/messages. */
function collapse(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** The prelude before an opening brace — the text since the previous rule
 *  boundary. Nested property blocks are not used in this repo's sheets. */
function preludeAt(cleaned: string, open: number): string {
  let start = open - 1;
  while (
    start >= 0
    && cleaned[start] !== "}"
    && cleaned[start] !== "{"
    && cleaned[start] !== ";"
  ) {
    start -= 1;
  }
  return collapse(cleaned.slice(start + 1, open));
}

/**
 * Every balanced `{…}` block in the comment-blanked sheet, with its
 * prelude. Quote-aware so `content: "}"` cannot corrupt the brace
 * matching (none today, but a silent off-by-one here would hollow the
 * whole contract).
 */
function ruleBlocks(cleaned: string): RuleBlock[] {
  const blocks: RuleBlock[] = [];
  const stack: number[] = [];
  let quote: string | null = null;
  for (let i = 0; i < cleaned.length; i += 1) {
    const ch = cleaned[i]!;
    if (quote) {
      if (ch === "\\") {
        i += 1;
        continue;
      }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (ch === "{") {
      stack.push(i);
      continue;
    }
    if (ch === "}") {
      const open = stack.pop();
      if (open === undefined) continue;
      blocks.push({ open, close: i, selector: preludeAt(cleaned, open) });
    }
  }
  return blocks;
}

/**

 * A rule's DIRECT content: the text at the rule's own nesting level with
 * every direct child rule body cut out, plus those child rules. The
 * distinction is load-bearing: layout.scss's `.hk-layout-aside-content`
 * nests its pair under `&.scrollbar-hidden` (a JS-toggled modifier), so a
 * naive block-text check would read the base scroller as suppressed even
 * though the native bar paints whenever that class is absent.
 */
function directContent(
  cleaned: string,
  block: RuleBlock,
  blockByOpen: Map<number, RuleBlock>,
): { flat: string; children: Array<{ prelude: string; body: string }> } {
  let flat = "";
  const children: Array<{ prelude: string; body: string }> = [];
  let quote: string | null = null;
  let i = block.open + 1;
  while (i < block.close) {
    const ch = cleaned[i]!;
    if (quote) {
      flat += ch;
      if (ch === "\\") {
        flat += cleaned[i + 1] ?? "";
        i += 2;
        continue;
      }
      if (ch === quote) quote = null;
      i += 1;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      flat += ch;
      i += 1;
      continue;
    }
    if (ch === "{") {
      const child = blockByOpen.get(i);
      if (!child) {
        i += 1;
        continue;
      }
      children.push({
        prelude: collapse(preludeAt(cleaned, i)),
        body: cleaned.slice(i, child.close + 1),
      });
      i = child.close + 1;
      continue;
    }
    flat += ch;
    i += 1;
  }
  return { flat, children };
}

/** 1-based line of an offset (comment blanking preserves newlines). */
function lineAt(source: string, offset: number): number {
  let line = 1;
  for (let i = 0; i < offset; i += 1) {
    if (source[i] === "\n") line += 1;
  }
  return line;
}

/** Native scrolling declarations under the contract. `hidden`/`visible`
 *  are not scroll surfaces; `overlay` (legacy non-standard) is not used. */
const OVERFLOW_DECLARATION = /\boverflow(?:-x|-y)?\s*:\s*(?:auto|scroll)\b/g;

function findDeclarations(file: string, cleaned: string): ScrollDeclaration[] {
  const blocks = ruleBlocks(cleaned);
  const blockByOpen = new Map(blocks.map((block) => [block.open, block]));
  const found: ScrollDeclaration[] = [];
  for (const match of cleaned.matchAll(OVERFLOW_DECLARATION)) {
    const offset = match.index ?? 0;
    let enclosing: RuleBlock | null = null;
    for (const block of blocks) {
      if (block.open < offset && offset < block.close) {
        if (enclosing === null || block.open > enclosing.open) enclosing = block;
      }
    }
    const content = enclosing
      ? directContent(cleaned, enclosing, blockByOpen)
      : { flat: "", children: [] };
    found.push({
      file,
      line: lineAt(cleaned, offset),
      selector: enclosing?.selector ?? "(top level)",
      ruleFlat: content.flat,
      ruleChildren: content.children,
      text: collapse(match[0]),
    });
  }
  return found;
}

function loadSheet(fullPath: string): Sheet {
  const cleaned = stripComments(readFileSync(fullPath, "utf8"));
  const file = relative(repoRoot, fullPath).split(sep).join("/");
  return { file, cleaned, declarations: findDeclarations(file, cleaned) };
}

/** Recursive SCSS discovery (the Vue package ships everything under src/). */
function collectSheets(dir: string): Sheet[] {
  const sheets: Sheet[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) sheets.push(...collectSheets(full));
    else if (entry.name.endsWith(".scss")) sheets.push(loadSheet(full));
  }
  return sheets.sort((a, b) => a.file.localeCompare(b.file));
}

/** The suppression pair the overlay engine's header demands. */
const DIRECT_SCROLLBAR_HIDE = /scrollbar-width\s*:\s*none\b/;
const WEBKIT_SCROLLBAR_HIDE = /::-webkit-scrollbar[^{]*\{[^}]*display\s*:\s*none\b/;

/** The legacy family's equivalent idiom: packages/theme/styles/mixins.scss
 *  emits exactly the direct pair (asserted below before it is credited). */
const THEME_MIXIN_HIDE = /@include\s+(?:mix\.)?scrollbar-hidden\s*;/;

type SuppressionMode = "pair" | "pair-or-mixin";

function isSuppressed(
  declaration: ScrollDeclaration,
  mode: SuppressionMode = "pair",
): boolean {
  if (mode === "pair-or-mixin" && THEME_MIXIN_HIDE.test(declaration.ruleFlat)) return true;
  if (!DIRECT_SCROLLBAR_HIDE.test(declaration.ruleFlat)) return false;
  // The webkit half must be a DIRECT child rule on the SAME element
  // (`&::-webkit-scrollbar`); a nested `&.modifier { &::-webkit-scrollbar }`
  // is state-scoped and must not count.
  return declaration.ruleChildren.some(
    (child) =>
      /^&::-webkit-scrollbar\b/.test(child.prelude)
      && /display\s*:\s*none\b/.test(child.body),
  );
}

/**
 * The documented host opt-ins: ClassBuilder utility classes whose WHOLE
 * POINT is to let a host choose platform scrolling for its own element
 * (packages/palette `Overflow::Auto.as_class()` → `.hk-overflow-auto`).
 * The exemption is deliberately file+selector keyed (never file-wide, so
 * a component rule added to the aggregate cannot inherit it) and pinned
 * to real declarations by the test below.
 */
const HOST_UTILITY_EXEMPTIONS = [
  {
    file: "packages/components/src/styles/index.scss",
    selector: ".hk-overflow-auto",
    reason: "host opt-in: ClassBuilder Overflow::Auto on the host's own element",
  },
  {
    file: "packages/components/src/styles/index.scss",
    selector: ".hk-overflow-y-auto",
    reason: "host opt-in: ClassBuilder OverflowY::Auto on the host's own element",
  },
] as const;

function isExempt(declaration: ScrollDeclaration): boolean {
  return HOST_UTILITY_EXEMPTIONS.some(
    (exemption) =>
      exemption.file === declaration.file && exemption.selector === declaration.selector,
  );
}

function describeDeclaration(declaration: ScrollDeclaration): string {
  return `${declaration.file}:${declaration.line}  ${declaration.selector} { ${declaration.text} }`;
}

function findSheet(sheets: Sheet[], file: string): Sheet {
  const sheet = sheets.find((candidate) => candidate.file === file);
  expect(sheet, `the shipped sheet ${file} must exist`).toBeDefined();
  return sheet!;
}

const vueSheets = collectSheets(vueSrcRoot);
const vueDeclarations = vueSheets.flatMap((sheet) => sheet.declarations);

/** The one sanctioned owner: the shared overlay surface's viewport rules. */
function isOwnerSurface(declaration: ScrollDeclaration): boolean {
  return (
    declaration.file === OWNER_SURFACE
    && declaration.selector.includes(".hk-scroll-container-viewport")
  );
}

describe("native-scrollbar invariant — shipped Vue sheets", () => {
  it("scans the shipped sheet tree (zero-yield positive controls)", () => {
    // A broken walk/regex would silently green every assertion below; pin
    // the scale this contract actually covers (the package ships ~200
    // sheets and ~22 native-scrolling declarations today).
    expect(vueSheets.length).toBeGreaterThanOrEqual(180);
    expect(vueDeclarations.length).toBeGreaterThanOrEqual(15);
    expect(new Set(vueDeclarations.map((declaration) => declaration.file)).size)
      .toBeGreaterThanOrEqual(10);
  });

  it("detects the suppression pair on a known-good sheet (detector control)", () => {
    // HkModal's body scroll is the reference shape: overflow-y mechanics,
    // pair nested in the same rule. If the detector regressed to
    // always-false this test (not the offender scan) turns red first.
    const modal = findSheet(vueSheets, "packages/vue/src/components/HkModal.scss");
    const body = modal.declarations.filter(
      (declaration) => declaration.selector === ".hk-modal-body-scroll",
    );
    expect(body, "HkModal's body scroller must stay under the contract").toHaveLength(1);
    expect(isSuppressed(body[0]!), "HkModal's body scroller must read as suppressed").toBe(true);
  });

  it("the shared overlay surface owns native scrolling AND keeps the pair", () => {
    // The owner allowlist must stay a real surface, not a stale exemption:
    // the base viewport rule must still declare native overflow (it is
    // the overlay engine's scroller) and still hide the native bar. The
    // [data-axis] override re-declaring overflow is covered by this same
    // element's base suppression.
    const container = findSheet(vueSheets, OWNER_SURFACE);
    const viewport = container.declarations.filter(
      (declaration) => declaration.selector === ".hk-scroll-container-viewport",
    );
    expect(viewport, "the shared viewport must still be a native scroller").toHaveLength(1);
    expect(viewport[0]!.text).toMatch(/^overflow:\s*(?:auto|scroll)$/);
    expect(
      isSuppressed(viewport[0]!),
      "HkScrollContainer's viewport must hide the native bar itself",
    ).toBe(true);
  });

  it("no shipped Vue sheet declares native scrolling without hiding the bar", () => {
    const offenders = vueDeclarations.filter(
      (declaration) =>
        !isOwnerSurface(declaration)
        && !isExempt(declaration)
        && !isSuppressed(declaration),
    );
    expect(
      offenders.map(describeDeclaration),
      "a native scrollbar would paint from these declarations — add the "
        + "scrollbar-width/::-webkit-scrollbar pair beside the overflow rule "
        + "(or route the surface through HkScrollContainer)",
    ).toEqual([]);
  });

  it("the Vue package ships no host overflow utility (nothing rides the exemption)", () => {
    // The exempt ClassBuilder utilities are hosted by the Rust/WASM
    // aggregate (group 2); the Vue aggregate declares none. Keeping this
    // empty means the Vue group above has NO escape hatch at all.
    expect(vueDeclarations.filter(isExempt).map(describeDeclaration)).toEqual([]);
  });

  it("HkCalendarHeatmap.scss carries no bare native scroller (2026-11-08 report)", () => {
    // The battle heatmap's native horizontal bar. The sheet is migrating
    // onto HkScrollContainer (its overflow-x declaration is deleted); this
    // pin accepts the deletion OR a suppressed remnant, never a bare one.
    const heatmap = findSheet(
      vueSheets,
      "packages/vue/src/components/HkCalendarHeatmap.scss",
    );
    const bare = heatmap.declarations.filter((declaration) => !isSuppressed(declaration));
    expect(
      bare.map(describeDeclaration),
      "the heatmap scroll surface must use the hikari overlay scrollbar, "
        + "never a native bar",
    ).toEqual([]);
  });
});

/**
 * The Rust/WASM family. `vue-mirror/*` is deliberately NOT scanned: those
 * sheets are byte-copies generated from the Vue sheets by
 * scripts/sync-vue-mirror.py (never hand-edited; the Rust drift suite
 * rejects hand edits), and group 1 above already governs their source.
 */
const legacyAvailable = existsSync(legacyStylesRoot);

function collectLegacyFamilySheets(): Sheet[] {
  const sheets: Sheet[] = [loadSheet(join(legacyStylesRoot, "index.scss"))];
  const componentsDir = join(legacyStylesRoot, "components");
  for (const entry of readdirSync(componentsDir, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith(".scss")) {
      sheets.push(loadSheet(join(componentsDir, entry.name)));
    }
  }
  return sheets.sort((a, b) => a.file.localeCompare(b.file));
}

const legacySheets = legacyAvailable ? collectLegacyFamilySheets() : [];
const legacyDeclarations = legacySheets.flatMap((sheet) => sheet.declarations);

describe.skipIf(!legacyAvailable)(
  "native-scrollbar invariant — Rust/WASM compiled family sheets",
  () => {
    it("scans the sheets the compiled bundle is built from (scope control)", () => {
      // Evidence the scan is not over dead files: packages/builder/build.rs
      // compiles packages/components/src/styles/index.scss into
      // public/styles/bundle.css, and these sheets are @import'ed by it.
      expect(legacySheets.length).toBeGreaterThanOrEqual(30);
      expect(legacyDeclarations.length).toBeGreaterThanOrEqual(10);
      const index = readFileSync(join(legacyStylesRoot, "index.scss"), "utf8");
      for (const sheet of [
        "layout.scss",
        "sidebar.scss",
        "code_block.scss",
        "demo_block.scss",
        "markdown_renderer.scss",
        "search.scss",
      ]) {
        expect(index, `${sheet} must still be imported into the compiled bundle`)
          .toContain(`./components/${sheet}`);
      }
    });

    it("the theme scrollbar-hidden mixin really declares both suppressions", () => {
      // The legacy sheets hide the bar through this mixin; crediting the
      // include without pinning the mixin would let a future edit hollow
      // the whole family group.
      const mixins = stripComments(
        readFileSync(resolve(repoRoot, "packages/theme/styles/mixins.scss"), "utf8"),
      );
      const block = ruleBlocks(mixins).find(
        (candidate) => candidate.selector === "@mixin scrollbar-hidden",
      );
      expect(block, "the theme scrollbar-hidden mixin must exist").toBeDefined();
      const text = mixins.slice(block!.open, block!.close + 1);
      expect(text).toMatch(DIRECT_SCROLLBAR_HIDE);
      expect(text).toMatch(WEBKIT_SCROLLBAR_HIDE);
    });

    it("detects the mixin suppression on a known legacy scroller (detector control)", () => {
      const aside = findSheet(
        legacySheets,
        "packages/components/src/styles/components/aside.scss",
      );
      const content = aside.declarations.filter(
        (declaration) => declaration.selector === ".hk-aside-content",
      );
      expect(content, "the legacy aside content stays a scroller").toHaveLength(1);
      expect(isSuppressed(content[0]!, "pair-or-mixin")).toBe(true);
    });

    it("every compiled family scroller hides the native bar (mixin or pair)", () => {
      const offenders = legacyDeclarations.filter(
        (declaration) => !isExempt(declaration) && !isSuppressed(declaration, "pair-or-mixin"),
      );
      expect(
        offenders.map(describeDeclaration),
        "a native scrollbar would paint from the Rust/WASM bundle — add "
          + "@include mix.scrollbar-hidden beside the overflow rule",
      ).toEqual([]);
    });

    it("the only exempt declarations are the two pinned host utilities", () => {
      const exempt = legacyDeclarations
        .filter(isExempt)
        .map((declaration) => `${declaration.file} ${declaration.selector}`)
        .sort();
      const pinned = HOST_UTILITY_EXEMPTIONS
        .map((exemption) => `${exemption.file} ${exemption.selector}`)
        .sort();
      // Exact equality pins BOTH directions: the documented utilities must
      // exist, and no other declaration may ride the exemption.
      expect(exempt).toEqual(pinned);
    });
  },
);
