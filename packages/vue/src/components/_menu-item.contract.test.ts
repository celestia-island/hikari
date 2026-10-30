/**
 * Source contract for the menu-item grammar itself (the ONE row spec in
 * _menu-item.scss) — the same stylesheet-contract style as
 * HkThemeToggle.contract.test.ts. The grammar is the anti-drift device
 * for every menu family (HkMenu rows, HkMenuActionItem, select options,
 * theme rows, chest's s-popup-menu-item), so the wave that added the
 * divider row and the slot wrappers pinned the mechanics here:
 *
 *   - the divider row exists as a MIXIN (never hand-roll a border-top
 *     divider inside a menu again — PlatformSwitcher shipped a drifted
 *     one) and is REGISTERED in the sheet-context list so the sheet
 *     tokens widen it;
 *   - modal-hosted rows ride the sheet geometry through a narrow
 *     max-width block (HkModal docks via media query, not a class);
 *   - HkMenu's header/footer slots and HkThemeToggle's menu-extra ride
 *     the .hk-menu-slot wrapper instead of splicing raw vnodes into the
 *     level (PlatformSwitcher-class drift lived exactly there).
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const grammar = readFileSync(join(here, "_menu-item.scss"), "utf-8");
const menuTsx = readFileSync(join(here, "HkMenu.tsx"), "utf-8");
const themeTsx = readFileSync(join(here, "HkThemePanelContent.tsx"), "utf8");
const adminTokens = readFileSync(join(here, "../styles/admin-tokens.scss"), "utf-8");
const panelScss = readFileSync(join(here, "HkMenuPanel.scss"), "utf-8");

/** One node of a parsed SCSS tree: a rule/at-rule block, the
 *  statements directly in its body, and its nested blocks. */
interface ScssBlock {
  prelude: string;
  statements: string[];
  children: ScssBlock[];
  parent: ScssBlock | null;
}

/** Remove comments so the block parser only sees code. */
function stripScssComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^[ \t]*\/\/.*$/gm, "");
}

/** Parse an SCSS sheet into its block tree. At-rules are blocks like any
 *  other (their prelude starts with "@" and is not a selector). */
function parseScss(source: string): ScssBlock[] {
  const root: ScssBlock = { prelude: "", statements: [], children: [], parent: null };
  const stack: ScssBlock[] = [root];
  let buf = "";
  for (const ch of source) {
    if (ch === "{") {
      const parent = stack[stack.length - 1]!;
      const block: ScssBlock = { prelude: buf.trim(), statements: [], children: [], parent };
      parent.children.push(block);
      stack.push(block);
      buf = "";
    } else if (ch === "}") {
      const block = stack.pop()!;
      if (buf.trim()) block.statements.push(buf.trim());
      buf = "";
    } else if (ch === ";") {
      if (buf.trim()) stack[stack.length - 1]!.statements.push(buf.trim());
      buf = "";
    } else {
      buf += ch;
    }
  }
  return root.children;
}

/** Split a selector list on the commas that are NOT inside parentheses. */
function splitSelectors(prelude: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of prelude) {
    if (ch === "(") depth += 1;
    else if (ch === ")") depth = Math.max(0, depth - 1);
    if (ch === "," && depth === 0) {
      out.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  out.push(current.trim());
  return out.filter(Boolean);
}

/** Resolved selector list of a block: its ancestor chain joined with
 *  spaces, comma lists expanded (at-rules are not selectors). */
function resolvedSelectors(block: ScssBlock): string[] {
  const groups: string[][] = [];
  for (let cur: ScssBlock | null = block; cur; cur = cur.parent) {
    if (!cur.prelude || cur.prelude.startsWith("@")) continue;
    groups.unshift(splitSelectors(cur.prelude));
  }
  let resolved = [""];
  for (const group of groups) {
    resolved = resolved.flatMap((prefix) =>
      group.map((sel) => (prefix ? `${prefix} ${sel}` : sel)),
    );
  }
  return resolved;
}

/** Resolved PARENT-selector prefixes of a block (ancestors only). */
function parentPrefixes(block: ScssBlock): string[] {
  const groups: string[][] = [];
  for (let cur = block.parent; cur; cur = cur.parent) {
    if (!cur.prelude || cur.prelude.startsWith("@")) continue;
    groups.unshift(splitSelectors(cur.prelude));
  }
  let resolved = [""];
  for (const group of groups) {
    resolved = resolved.flatMap((prefix) =>
      group.map((sel) => (prefix ? `${prefix} ${sel}` : sel)),
    );
  }
  return resolved;
}

/** Depth-first flatten of a block tree. */
function flattenBlocks(blocks: ScssBlock[]): ScssBlock[] {
  return blocks.flatMap((block) => [block, ...flattenBlocks(block.children)]);
}

/** The px fallback a grammar custom property carries through the shared
 *  scale: the `4px` in `var(--token, var(--space-4, 4px))`. */
function pxFallback(body: string, token: string): number {
  const match = body.match(
    new RegExp(`var\\(${token},\\s*var\\(--space-\\d+,\\s*(\\d+)px\\)\\)`),
  );
  expect(
    match,
    `${token} must fall back through a shared --space-* token to px`,
  ).toBeTruthy();
  return Number(match![1]);
}

/** The body of `@mixin <name> { ... }` (single level, mixes are flat). */
function mixinBody(name: string): string {
  const match = grammar.match(new RegExp(`@mixin ${name} \\{([^}]*)\\}`));
  expect(match, `@mixin ${name} must exist in _menu-item.scss`).toBeTruthy();
  return match![1]!;
}

describe("menu-item grammar contract", () => {
  it("declares the divider row as a mixin reading the grammar tokens", () => {
    expect(grammar).toContain("@mixin divider");
    // The divider insets itself with the row padding tokens, so sheet
    // registration widens it without a second definition.
    expect(grammar).toMatch(/@mixin divider[^}]*--hk-menu-item-pad-y/);
    expect(grammar).toMatch(/@mixin divider[^}]*--hk-menu-item-pad-x/);
  });

  it("registers the divider row for the sheet token context", () => {
    const block = grammar.match(
      /\.hk-select-sheet-panel,[^{]*\{[^}]*\}/,
    )?.[0];
    expect(block).toBeTruthy();
    expect(block).toContain(".hk-menu-divider");
  });

  it("keeps modal content out of the always-on sheet context", () => {
    // The docked modal is the same element on every viewport: listing it
    // in the always-on context would put 44px sheet rows on desktop
    // modals. It may only appear inside the narrow mobile scope.
    const block = grammar.match(
      /\.hk-select-sheet-panel,[^{]*\{[^}]*\}/,
    )?.[0];
    expect(block).toBeTruthy();
    expect(block).not.toContain(".hk-modal-content");
  });

  it("reaches modal-hosted rows through a narrow mobile scope", () => {
    // HkModal docks via a media query, so the token swap must be scoped
    // to one too — a bare .hk-modal-content entry in the always-on list
    // would put 44px sheet geometry on desktop modals.
    expect(grammar).toMatch(
      /@media \(max-width: 767px\) \{\s*\.hk-modal-content \{/,
    );
  });

  it("wraps HkMenu's header/footer slots in the standard slot hooks", () => {
    // The shared slotWrapper builds .hk-menu-slot--<kind> and renders
    // only when the slot has content (headerless surfaces must gain no
    // phantom flex gap) — both properties are pinned.
    expect(menuTsx).toContain("hk-menu-slot--${kind}");
    expect(menuTsx).toContain('slotWrapper("head", head)');
    expect(menuTsx).toContain('slotWrapper("foot", foot)');
    expect(menuTsx).toContain('slotWrapper("head", slots.header?.() ?? [])');
  });

  it("wraps the theme menu's extra slot in the standard hook", () => {
    expect(themeTsx).toContain("hk-menu-slot--extra");
    expect(themeTsx).toContain('slots["menu-extra"]?.() ?? []');
    expect(themeTsx).toContain("extra.length ?");
  });

  it("publishes the divider globally for host apps via admin-tokens", () => {
    expect(adminTokens).toContain(".hk-menu-divider {");
    // Host apps cannot read the grammar's token declarations, so the
    // global rule carries the spec numbers as fallbacks.
    expect(adminTokens).toMatch(/\.hk-menu-divider \{[^}]*--hk-menu-item-pad-y, 6px/);
    expect(adminTokens).toMatch(/\.hk-menu-divider \{[^}]*--hk-menu-item-pad-x, 12px/);
  });

  it("lands the identity header on the rows' content edge inside HkMenu surfaces", () => {
    // The account identity block (`.s-user-header` — the admin header's
    // dropdown header slot and every consumer's HkMenu header slot) shares
    // its container with the menu rows, so its inline padding must BE the
    // rows' content edge: their 1px transparent border plus pad-x, in the
    // grammar's own px units. A fixed rem value read 1px off at the
    // default root, 4.5px at a 20px root, and 3px the other way on sheets
    // (measured 2026-09-17): pin both scoped rules and their branch values.
    expect(adminTokens).toMatch(
      /\.hk-select-popout-host \.s-user-header \{[^}]*padding-inline: calc\(1px \+ var\(--hk-menu-item-pad-x, 12px\)\)/,
    );
    expect(adminTokens).toMatch(
      /\.hk-select-sheet-panel \.s-user-header \{[^}]*padding-inline: calc\(1px \+ var\(--hk-menu-item-pad-x, 16px\)\)/,
    );
    // The sheet branch value must follow the sheet tokens, not the popout's.
    expect(adminTokens).not.toMatch(
      /\.hk-select-sheet-panel \.s-user-header \{[^}]*--hk-menu-item-pad-x, 12px/,
    );
    // Bare surfaces (no rows beside the block) keep the block's own value.
    expect(adminTokens).toMatch(
      /\.s-user-header \{[^}]*padding: var\(--space-10\) var\(--space-14\) var\(--space-12\)/,
    );
  });

  it("spends the italic overhang cushion in the label mixin only", () => {
    // Italic final strokes lean past the last glyph's advance and the
    // label's overflow:hidden clips at the padding edge — an italic row
    // label (host-styled sentinel rows) loses its trailing stroke
    // (reported from the field: wowsp's all-clients sentinel row). The
    // cushion is declared once with the grammar tokens and spent by the
    // label mixin only — it is clipping room for the truncation box, not
    // row spacing, so the item/icon mixins must stay cushion-free.
    expect(grammar).toMatch(/--hk-menu-item-label-cushion: 0\.2em/);
    expect(grammar).toMatch(
      /@mixin label[^}]*padding-inline-end: var\(--hk-menu-item-label-cushion\)/,
    );
    expect(grammar.match(/var\(--hk-menu-item-label-cushion\)/g)?.length).toBe(1);
  });

  it("gives the section caption a bottom-heavy band (never glued to the first row)", () => {
    // Field report: the caption above a run of rows sat almost flush
    // against the first row (four hand-rolled bands, 2/4/6/8px, no shared
    // token). The rhythm is pinned EXACTLY, not merely ordered: a bare
    // `bottom > top` check lets a top revert (4px → 6px) pass — and the
    // top band moving back down is the "move UP" half of the user
    // direction. Pin both numbers, then pin the order.
    const body = mixinBody("section-label");
    const top = pxFallback(body, "--hk-menu-section-label-pad-top");
    const bottom = pxFallback(body, "--hk-menu-section-label-pad-bottom");
    expect(
      top,
      `caption top band is ${top}px; the shipped value is 4px (the band must sit tight/UP under the panel inset)`,
    ).toBe(4);
    expect(
      bottom,
      `caption bottom band is ${bottom}px; the shipped value is 8px (the clear gap under the caption)`,
    ).toBe(8);
    expect(
      bottom,
      `caption bottom band (${bottom}px) must be strictly larger than its top band (${top}px) — bottom-heavy rhythm`,
    ).toBeGreaterThan(top);
  });

  it("declares the caption's bands as exactly three token declarations", () => {
    // Presence-based pins survive a LATER override (R3 P7: appending
    // `padding-inline: 16px; padding-block-end: 2px;` after the tokens
    // re-created the field defect 4/16/2 while every value pin stayed
    // green). The padding set must be EXACTLY the three grammar
    // declarations — a fourth declaration, a bare shorthand or a literal
    // added later fails here.
    const body = mixinBody("section-label");
    const paddingDecls = [...body.matchAll(/\bpadding[\w-]*\s*:[^;]+;/g)].map((match) =>
      match[0].replace(/\s+/g, " ").trim(),
    );
    expect(paddingDecls, "exactly the three grammar padding declarations").toEqual([
      "padding-block-start: var(--hk-menu-section-label-pad-top, var(--space-4, 4px));",
      "padding-inline: var(--hk-menu-section-label-pad-x, var(--space-6, 6px));",
      "padding-block-end: var(--hk-menu-section-label-pad-bottom, var(--space-8, 8px));",
    ]);
    expect(
      body,
      "no bare padding shorthand (it would override the token bands)",
    ).not.toMatch(/(^|[;{\s])padding\s*:/);
    expect(body, "capitalization stays the translator's").not.toContain("text-transform");
  });

  it("keeps the caption's desktop typography on the grammar tokens", () => {
    const body = mixinBody("section-label");
    expect(body).toMatch(
      /font-size:\s*var\(--hk-menu-section-label-font,\s*var\(--text-2xs,\s*0\.625rem\)\)/,
    );
    expect(body).toMatch(
      /letter-spacing:\s*var\(--hk-menu-section-label-tracking,\s*0\.02em\)/,
    );
    expect(body).toMatch(/user-select:\s*none/);
  });

  it("hangs the caption's inline inset just left of the row content edge", () => {
    // The caption must NOT read as an indented row: its inline inset is a
    // hair smaller than the row grammar's --hk-menu-item-pad-x, so it
    // hugs the section edge slightly left of the leading icon column.
    // SCOPE of that guarantee: the menu row grammar and HkMenuSection —
    // a one-off adopter with its own smaller padding (HkTemplateField's
    // .hk-tpl-row is 4px 8px) lands only a couple of px left, so the
    // shared token keeps the two bands related, not pixel-identical
    // everywhere.
    const body = mixinBody("section-label");
    expect(
      body,
      "caption inline inset must follow the shared --space-6 scale token",
    ).toMatch(/var\(--hk-menu-section-label-pad-x,\s*var\(--space-6,\s*6px\)\)/);
    const inline = pxFallback(body, "--hk-menu-section-label-pad-x");
    const rowPadX = Number(
      grammar.match(/@mixin item-tokens[\s\S]*?--hk-menu-item-pad-x:\s*(\d+)px/)?.[1],
    );
    expect(rowPadX, "row grammar pad-x parsed from item-tokens").toBeGreaterThan(0);
    expect(
      inline,
      `caption inline inset (${inline}px) must stay smaller than the row pad-x (${rowPadX}px)`,
    ).toBeLessThan(rowPadX);
  });

  it("registers the caption in every sheet-context list that registers the row band", () => {
    // Resolved-selector scan, not a top-level block count: for every block
    // that swaps the ROW sheet tokens we resolve its parent selector
    // prefix and require an exactly matching caption block that swaps the
    // CAPTION sheet tokens. A sheet-context list nested inside an existing
    // block (a third context added under the panel list) therefore fails
    // even though a depth-0 scan would never see it.
    const blocks = flattenBlocks(parseScss(stripScssComments(grammar)));
    const ruleIndex = blocks.flatMap((block) =>
      resolvedSelectors(block).map((selector) => ({ selector, block })),
    );
    const rowSwaps = blocks.filter((block) =>
      block.statements.some((stmt) => stmt.includes("@include item-sheet-tokens")),
    );
    // Extraction sanity (never trust a 0-hit scan): the shipped sheet
    // lists do swap row tokens somewhere.
    expect(rowSwaps.length, "row sheet-token swaps found").toBeGreaterThan(0);

    const contexts = new Set<string>();
    for (const rowSwap of rowSwaps) {
      const prefixes = parentPrefixes(rowSwap);
      expect(prefixes.length, "a row token swap has a selector ancestor").toBeGreaterThan(0);
      for (const prefix of prefixes) {
        contexts.add(prefix);
        const captionSelector = `${prefix} .hk-menu-section-label`;
        const captionBlock = ruleIndex.find(
          (entry) => entry.selector === captionSelector,
        )?.block;
        expect(
          captionBlock,
          `sheet context "${prefix}" widens the rows but has no "${captionSelector}" caption block`,
        ).toBeTruthy();
        expect(
          captionBlock!.statements.some((stmt) =>
            stmt.includes("@include section-label-sheet-tokens"),
          ),
          `sheet context "${prefix}" must swap the caption's sheet tokens`,
        ).toBe(true);
      }
    }

    // The shipped sheet surfaces are all covered (dropping one from a
    // context list fails here, not just for the panel-shaped ones).
    for (const context of [
      ".hk-select-sheet-panel",
      ".hk-popover-panel.hk-is-sheet",
      ".hk-drawer-panel",
      ".hk-modal-content",
    ]) {
      expect(
        [...contexts],
        `sheet surface ${context} must widen the rows (and therefore be checked for a caption)`,
      ).toContain(context);
    }
  });

  it("widens the caption to the touch geometry inside sheets", () => {
    // Sheet values are the touch band: 6px top / 8px inline / 12px bottom
    // and the 12px caption font. A drifted sheet entry would leave the
    // caption at desktop rhythm inside a bottom sheet.
    const body = mixinBody("section-label-sheet-tokens");
    expect(body).toMatch(/--hk-menu-section-label-pad-top:\s*var\(--space-6,\s*6px\)/);
    expect(body).toMatch(/--hk-menu-section-label-pad-x:\s*var\(--space-8,\s*8px\)/);
    expect(body).toMatch(/--hk-menu-section-label-pad-bottom:\s*var\(--space-12,\s*12px\)/);
    expect(body).toMatch(/--hk-menu-section-label-font:\s*var\(--text-xs,\s*0\.75rem\)/);
  });

  it("never uppercases the caption (translators own casing)", () => {
    // The HkTemplateField rule: caption strings are host i18n strings;
    // text-transform would fight locales whose casing rules differ.
    expect(mixinBody("section-label")).not.toContain("text-transform");
  });

  it("publishes the section caption globally and only binds it to the grammar", () => {
    // Hosts render .hk-menu-section / .hk-menu-section-label by hand (the
    // workspace picker does) and cannot import the scss partial, so the
    // global sheet binds the classes to the grammar mixins. EVERY rule
    // whose selector mentions the section classes may contain NOTHING but
    // that binding: an adopter that adds a later padding declaration
    // (R3 P5) or a scoped duplicate that restates the band (R3 P8) must
    // fail — a "one global rule" count missed both.
    const blocks = flattenBlocks(parseScss(stripScssComments(adminTokens)));
    const sectionRules = blocks.flatMap((block) =>
      resolvedSelectors(block)
        .filter((selector) => selector.includes("hk-menu-section"))
        .map((selector) => ({ selector, block })),
    );
    // Extraction sanity (never trust a 0-hit scan): the two global
    // adopters are found.
    expect(
      sectionRules.map((entry) => entry.selector),
      "the two global section adopters",
    ).toEqual(expect.arrayContaining([".hk-menu-section", ".hk-menu-section-label"]));

    for (const { selector, block } of sectionRules) {
      const statements = block.statements.map((stmt) => stmt.replace(/\s+/g, " ").trim());
      expect(
        statements,
        `section rule "${selector}" must bind the grammar only, got: ${statements.join("; ")}`,
      ).toHaveLength(1);
      expect(
        statements[0],
        `section rule "${selector}" must be an @include of the grammar mixin`,
      ).toMatch(/^@include mi\.(?:section|section-label)$/);
      expect(
        statements.join("; "),
        `section rule "${selector}" must not declare padding`,
      ).not.toMatch(/\bpadding/);
    }

    // The exact binding per class (nothing else, no later override).
    const statementsFor = (selector: string) => {
      const block = sectionRules.find((entry) => entry.selector === selector)?.block;
      expect(block, `the global ${selector} adopter rule`).toBeTruthy();
      return block!.statements.map((stmt) => stmt.replace(/\s+/g, " ").trim());
    };
    expect(statementsFor(".hk-menu-section")).toEqual(["@include mi.section"]);
    expect(statementsFor(".hk-menu-section-label")).toEqual(["@include mi.section-label"]);
  });

  it("keeps the grammar's own section rules to the sheet token swap only", () => {
    // The grammar must not style the band directly: @mixin section-label
    // owns the metrics (pinned separately), and a direct
    // .hk-menu-section-label rule is ONLY the sheet-context token swap.
    // R4 appended (a) an unconditional
    //   .hk-menu-section-label { @include section-label-sheet-tokens; }
    // — touch geometry on desktop — and (b) a later
    //   .hk-menu-section-label { padding-block-end: 2px; }
    // and every pin stayed green.
    const blocks = flattenBlocks(parseScss(stripScssComments(grammar)));
    // Derive the allowlist from the registration lists themselves: only a
    // context that swaps the ROW sheet tokens may scope a caption rule
    // (.hk-select-sheet-panel / .hk-popover-panel.hk-is-sheet /
    // .hk-drawer-panel, plus the narrow mobile .hk-modal-content band).
    const rowSwaps = blocks.filter((block) =>
      block.statements.some((stmt) => stmt.includes("@include item-sheet-tokens")),
    );
    expect(rowSwaps.length, "row sheet-token swaps found").toBeGreaterThan(0);
    const sheetContexts = new Set(rowSwaps.flatMap((rowSwap) => parentPrefixes(rowSwap)));

    const sectionBlocks = blocks.flatMap((block) =>
      resolvedSelectors(block)
        .filter((selector) => selector.includes(".hk-menu-section"))
        .map((selector) => ({ selector, block })),
    );
    // Extraction sanity (never trust a 0-hit scan): the shipped sheet
    // entries are found.
    expect(sectionBlocks.length, "grammar caption sheet-token entries found").toBeGreaterThan(0);
    for (const { selector, block } of sectionBlocks) {
      // A grammar rule for the band may only be scoped by a REGISTERED
      // sheet context: an unconditional rule puts the sheet geometry on
      // desktop, and any other ancestor (.hk-menu-level, .hk-menu-list)
      // would be a stray desktop restyle.
      const scoped = selector.match(/^(.+) \.hk-menu-section-label$/);
      expect(
        scoped,
        `grammar section rule "${selector}" must be sheet-scoped, not unconditional`,
      ).toBeTruthy();
      expect(
        [...sheetContexts],
        `grammar section rule "${selector}" is scoped by "${scoped?.[1]}", which is not a registered sheet context`,
      ).toContain(scoped![1]);
      for (const statement of block.statements) {
        const normalized = statement.replace(/\s+/g, " ").trim();
        expect(
          normalized,
          `grammar section rule "${selector}" may only swap the caption's sheet tokens, got: ${normalized}`,
        ).toMatch(
          /^(?:@include section-label-sheet-tokens|--hk-menu-section-label-[\w-]+\s*:\s*[^;]+)$/,
        );
      }
    }
  });

  it("pins the wrapper to the level rhythm and publishes the list's own rhythm", () => {
    // Rows declare no margins: the inter-row rhythm IS the parent's flex
    // gap (.hk-menu-level 2px, .hk-menu-list 4px). A group box therefore
    // takes over that rhythm, its default must mirror the level's 2px,
    // and .hk-menu-list must publish its own 4px. The declarations are
    // collected through the block parser (including the nested `& + &`
    // block): a regex over the raw mixin text stopped at the first `}`,
    // so a later `gap: 0;` after the stack rule re-introduced the S1
    // defect with every pin green (R5 mutation A).
    const sectionMixin = flattenBlocks(parseScss(stripScssComments(grammar))).find(
      (block) => block.prelude === "@mixin section",
    );
    expect(sectionMixin, "@mixin section must exist").toBeTruthy();
    const declarations = flattenBlocks([sectionMixin!]).flatMap((block) =>
      block.statements.map((statement) => statement.replace(/\s+/g, " ").trim()),
    );
    const spacingDecls = declarations.filter((declaration) =>
      /^(?:gap|margin[\w-]*)\s*:/.test(declaration),
    );
    expect(spacingDecls, "exactly the wrapper's two spacing declarations").toEqual([
      "gap: var(--hk-menu-section-gap, var(--space-2, 2px))",
      "margin-block-start: var(--hk-menu-section-stack, var(--space-6, 6px))",
    ]);
    // The one shipped surface with a different row rhythm publishes it.
    expect(
      panelScss,
      ".hk-menu-list must publish its 4px row rhythm for a captioned run",
    ).toMatch(/\.hk-menu-list\s*\{[^}]*--hk-menu-section-gap:\s*var\(--space-4,\s*4px\)/s);
  });
});
