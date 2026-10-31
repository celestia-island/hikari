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
 *     level (PlatformSwitcher-class drift lived exactly there);
 *   - BAND wrappers (slots, .hk-menu-body, .hk-menu-section) stay
 *     geometry-neutral — the surface's inset is the one horizontal inset
 *     a row receives, so every row family's highlight reads the same
 *     width in one panel (2026-10-31: the workspace picker's padded body
 *     wrapper made 「添加工作区」 run ~12px wider than the selected row);
 *   - the foot action band owns its divider-grade top separation
 *     (HkMenu.scss), consumers pad nothing.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const grammar = readFileSync(join(here, "_menu-item.scss"), "utf-8");
const menuTsx = readFileSync(join(here, "HkMenu.tsx"), "utf-8");
const menuScss = readFileSync(join(here, "HkMenu.scss"), "utf-8");
const affixScss = readFileSync(join(here, "HkAffixPicker.scss"), "utf-8");
const tagInputScss = readFileSync(join(here, "HkTagInput.scss"), "utf-8");
const tplScss = readFileSync(join(here, "HkTemplateField.scss"), "utf-8");
const userPickerScss = readFileSync(join(here, "HkUserPicker.scss"), "utf-8");
const tagInputTsx = readFileSync(join(here, "HkTagInput.tsx"), "utf-8");
const userPickerTsx = readFileSync(join(here, "HkUserPicker.tsx"), "utf-8");
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
    // The drawer is the third hosting surface (.hk-drawer-panel is one of
    // the grammar's sheet contexts) — its twin carries the SHEET pad-x.
    // Without it a drawer identity block kept the bare 14px while the
    // drawer rows around it rode 1px + 16px (2026-10-31 audit finding 9).
    expect(adminTokens).toMatch(
      /\.hk-drawer-panel \.s-user-header \{[^}]*padding-inline: calc\(1px \+ var\(--hk-menu-item-pad-x, 16px\)\)/,
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
    // Authored through styles/polyfill.scss (its mixin owns the
    // -webkit-/standard pair).
    expect(body).toMatch(/@include user-select\(\s*none\s*\)/);
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
      const context = scoped![1]!;
      expect(
        [...sheetContexts],
        `grammar section rule "${selector}" is scoped by "${context}", which is not a registered sheet context`,
      ).toContain(context);
      if (context === ".hk-modal-content") {
        // .hk-modal-content exists at EVERY viewport (HkModal docks via a
        // media query — the element itself is always there): a sheet swap
        // scoped by it OUTSIDE the narrow band puts touch geometry on
        // DESKTOP modals. The legitimate rule is nested in the band, and
        // resolvedSelectors drops at-rule preludes, so walk the parent
        // chain for the @media (max-width: 767px) ancestor explicitly.
        let mobileBand = false;
        for (let ancestor = block.parent; ancestor; ancestor = ancestor.parent) {
          if (/^@media\s*\(max-width:\s*767px\)$/.test(ancestor.prelude.trim())) {
            mobileBand = true;
            break;
          }
        }
        expect(
          mobileBand,
          `grammar section rule "${selector}" scopes .hk-modal-content OUTSIDE the @media (max-width: 767px) band — its sheet geometry would land on desktop modals`,
        ).toBe(true);
      }
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
    expect(
      declarations,
      "the wrapper must be a flex box (the gap is inert otherwise)",
    ).toContain("display: flex");
    expect(
      declarations,
      "the wrapper's children must stack vertically, never in a row",
    ).toContain("flex-direction: column");
    // The 6px stack margin belongs to the SIBLING rule (`& + &`), so only
    // the SECOND and later sections are separated. Moving it into the mixin
    // body would push 6px above the very first section too.
    const stackOwners = flattenBlocks([sectionMixin!]).filter((block) =>
      block.statements.some((statement) =>
        statement.replace(/\s+/g, " ").trim().startsWith("margin-block-start:"),
      ),
    );
    expect(
      stackOwners.map((block) => block.prelude),
      "the stack margin must live in the `& + &` block only",
    ).toEqual(["& + &"]);
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

  it("declares the consumer body band as exactly two neutral declarations", () => {
    // The WIDTH invariant (2026-10-31 field report): a padded band insets
    // only ITS rows, so their highlight stops matching the foot action
    // band's — the workspace picker's 「添加工作区」 ran ~12px wider than
    // the 「个人空间」 row. @mixin body is therefore pinned to EXACTLY the
    // two neutral declarations; a padding/margin/border sneaking in fails
    // here even though every value pin elsewhere stays green.
    const body = mixinBody("body");
    const decls = body
      .split(";")
      .map((stmt) => stmt.replace(/\s+/g, " ").trim())
      .filter(Boolean);
    expect(decls, "@mixin body is display:block + min-width:0, nothing else").toEqual([
      "display: block",
      "min-width: 0",
    ]);
    expect(body, "the body band never pads").not.toMatch(/\bpadding/);
    expect(body, "the body band never margins").not.toMatch(/\bmargin/);
    expect(body, "the body band never draws chrome").not.toMatch(/\bborder/);
  });

  it("publishes the body band globally and only binds it to the grammar", () => {
    // Hosts render .hk-menu-body by hand beside their own class (the
    // workspace picker does) and cannot import the scss partial — same
    // rule shape as the section band above: the global sheet BINDS the
    // class to @mixin body, every rule mentioning the class carries
    // nothing but that binding.
    const blocks = flattenBlocks(parseScss(stripScssComments(adminTokens)));
    const bodyRules = blocks.flatMap((block) =>
      resolvedSelectors(block)
        .filter((selector) => selector.includes("hk-menu-body"))
        .map((selector) => ({ selector, block })),
    );
    expect(
      bodyRules.map((entry) => entry.selector),
      "the one global body adopter",
    ).toContain(".hk-menu-body");
    for (const { selector, block } of bodyRules) {
      // The binding must be TOP-LEVEL: resolvedSelectors drops at-rule
      // preludes, so a media-scoped duplicate would resolve to the same
      // selector string here — walk the parent chain explicitly and fail
      // on any at-rule ancestor (the modal-sheet test sets the precedent).
      for (let cur = block.parent; cur; cur = cur.parent) {
        expect(
          cur.prelude.startsWith("@"),
          `the body binding for "${selector}" must be a top-level rule, found inside at-rule "${cur.prelude}" (a scoped binding is not the global contract)`,
        ).toBe(false);
      }
      const statements = block.statements.map((stmt) => stmt.replace(/\s+/g, " ").trim());
      expect(statements, `body rule "${selector}" binds the grammar only`).toEqual([
        "@include mi.body",
      ]);
    }
  });

  it("keeps every band wrapper geometry-neutral (rows own the level width)", () => {
    // Every rule in the sheets that style band classes today — the
    // grammar, HkMenu.scss and admin-tokens (a repo-wide grep is the
    // reviewer's periodic check that this list is still the whole world) —
    // must declare NO padding for a BAND class: the slot hooks, the
    // consumer body band, the section wrapper. The surface's inset is the
    // one horizontal inset a row receives; a band that pads itself
    // re-creates the field defect with its own rows reading wider than
    // the neighbours. Comments stripped, block-parsed, resolved selectors
    // (a context-scoped band rule fails here too).
    const blocks = [
      ...flattenBlocks(parseScss(stripScssComments(grammar))),
      ...flattenBlocks(parseScss(stripScssComments(menuScss))),
      ...flattenBlocks(parseScss(stripScssComments(adminTokens))),
    ];
    const isBandSelector = (selector: string) =>
      selector.includes("hk-menu-slot") ||
      selector.includes("hk-menu-body") ||
      (/hk-menu-section(?!-label)/.test(selector));
    const bandRules = blocks.flatMap((block) =>
      resolvedSelectors(block)
        .filter(isBandSelector)
        .map((selector) => ({ selector, block })),
    );
    // Extraction sanity (never trust a 0-hit scan): the shipped bands are
    // all found — slot hooks, the body band, the section wrapper.
    const found = new Set(bandRules.map((entry) => entry.selector));
    expect(found.has(".hk-menu-slot"), ".hk-menu-slot band found").toBe(true);
    expect(found.has(".hk-menu-slot--foot"), ".hk-menu-slot--foot band found").toBe(true);
    expect(found.has(".hk-menu-body"), ".hk-menu-body band found").toBe(true);
    expect(found.has(".hk-menu-section"), ".hk-menu-section band found").toBe(true);
    for (const { selector, block } of bandRules) {
      const padding = block.statements.filter((stmt) =>
        /(^|[\s;])padding/.test(stmt.replace(/\s+/g, " ").trim()),
      );
      expect(padding, `band rule "${selector}" must not pad itself`).toEqual([]);
    }
  });

  it("separates the foot action band at the divider grade, band-owned", () => {
    // The foot band is an ACTION band (the picker's "add workspace"), not
    // a run of selectable rows — its separation from the list is the
    // divider's 6px grade, owned by the band (consumers pad nothing).
    // Pinned EXACTLY so a later restyle cannot silently retune it; head
    // and extra stay geometry-neutral (no symmetric creep: identity
    // blocks own their rhythm via the .s-user-header pins).
    const blocks = flattenBlocks(parseScss(stripScssComments(menuScss)));
    const foot = blocks.find((block) => block.prelude.trim() === ".hk-menu-slot--foot");
    expect(foot, ".hk-menu-slot--foot rule lives in HkMenu.scss").toBeTruthy();
    const decls = foot!.statements.map((stmt) =>
      stmt.replace(/\s+/g, " ").trim().replace(/;$/, ""),
    );
    expect(decls, "the foot band carries exactly its top separation").toEqual([
      "margin-block-start: var(--hk-menu-foot-gap, var(--space-6, 6px))",
    ]);
    // Head/extra stay BARE DOM hooks — no rhythm rules may exist for them
    // at all (not merely margin-free ones): the identity blocks own their
    // rhythm through the .s-user-header pins, and the theme menu's extra
    // slot rides the plain row rhythm. A rule appearing here at all is
    // the symmetric-creep attempt, so its EXISTENCE fails — a
    // margin-free-but-present rule would still be a forked band.
    for (const kind of ["--head", "--extra"]) {
      const band = blocks.find((block) =>
        resolvedSelectors(block).includes(`.hk-menu-slot${kind}`),
      );
      expect(
        band,
        `the ${kind} band must stay a bare DOM hook with no rule of its own (its rhythm is owned elsewhere by design)`,
      ).toBeUndefined();
    }
  });

  it("keeps the modal list in parity with the panel sheet list (plus modal-hosted rows)", () => {
    // The 2026-10-31 audit found the ≤767px .hk-modal-content list four
    // classes behind the three-surface list — a row family registered in
    // one but not the other keeps desktop geometry on whichever surface
    // the audit missed, and nothing failed. The modal list must ALWAYS
    // be a superset of the panel list (modal-hosted rows like
    // .hk-user-picker-row add on top); a registration added to one list
    // without the other fails here.
    const grammarBlocks = flattenBlocks(parseScss(stripScssComments(grammar)));
    const swapBlocks = grammarBlocks.filter((block) =>
      block.statements.some((stmt) => stmt.includes("@include item-sheet-tokens")),
    );
    const rowsOf = (block: ScssBlock): string[] =>
      block.prelude
        .split(",")
        .map((sel) => sel.trim())
        .filter((sel) => sel.startsWith("."));
    const lists = swapBlocks.map(rowsOf).filter((rows) => rows.length > 2);
    // Extraction sanity: both shipped lists are found (the panel list and
    // the modal list are the only >2-selector token-swap preludes).
    expect(lists.length, "two registration lists found").toBe(2);
    const missing = lists[0]!.filter((row) => !lists[1]!.includes(row));
    expect(
      missing,
      "every row class registered in the panel sheet list must also be registered in the modal list",
    ).toEqual([]);
  });

  it("keeps the catalog chooser bands block-axis-only (no second inline inset)", () => {
    // The catalog list bands (affix / tag-input / tpl vocabulary) used to
    // pad themselves 2-6px INLINE on top of the surface's own inset — the
    // WIDTH-invariant anti-pattern one component family at a time. Each
    // band may declare BLOCK-axis rhythm only: a padding shorthand or a
    // padding-inline here re-stacks the second inset.
    const sources: Array<[string, string]> = [
      [".hk-affix-list", affixScss],
      [".hk-tag-input-list", tagInputScss],
      [".hk-tpl-rows", tplScss],
      [".hk-tpl-editor-rows", tplScss],
    ];
    for (const [selector, sheet] of sources) {
      // The tpl band shares ONE prelude with its sibling
      // (`.hk-tpl-rows, .hk-tpl-editor-rows`), so match on the selector
      // LIST, not on a prefix.
      const block = flattenBlocks(parseScss(stripScssComments(sheet))).find(
        (candidate) =>
          candidate.prelude
            .trim()
            .split(",")
            .map((sel) => sel.trim())
            .includes(selector),
      );
      expect(block, `${selector} rule exists`).toBeTruthy();
      const offenders = block!.statements
        .map((stmt) => stmt.replace(/\s+/g, " ").trim())
        .filter((stmt) => /^padding\s*:/.test(stmt) || /^padding-inline/.test(stmt));
      expect(
        offenders,
        `${selector} pads the block axis only (no shorthand, no padding-inline) — an inline term is a second horizontal inset on top of the surface's own`,
      ).toEqual([]);
    }
  });

  it("keeps the adopted row families on the mixin's geometry (no local padding/min-height)", () => {
    // The 2026-10-31 adoption gave four hand-rolled row families
    // @include mi.item — the mixin OWNS their padding and min-height
    // (6×12 desktop / 10×16 sheet via the registration lists). A local
    // padding or min-height declaration in the family's own rule
    // overrides the mixin at the same specificity and silently forks
    // that family off the grammar again (the pre-adoption stock was
    // exactly such a fork). Layout-axis restatements (flex direction,
    // justify, text-align, color) are content decisions and stay legal.
    const sources: Array<[string, string]> = [
      [".hk-affix-row", affixScss],
      [".hk-tag-input-row", tagInputScss],
      [".hk-tpl-row", tplScss],
      [".hk-user-picker-row", userPickerScss],
    ];
    for (const [selector, sheet] of sources) {
      const block = flattenBlocks(parseScss(stripScssComments(sheet))).find(
        (candidate) =>
          candidate.prelude
            .trim()
            .split(",")
            .map((sel) => sel.trim())
            .includes(selector),
      );
      expect(block, `${selector} rule exists`).toBeTruthy();
      const offenders = block!.statements
        .map((stmt) => stmt.replace(/\s+/g, " ").trim())
        .filter((stmt) => /^(padding|min-height)\s*[:]/.test(stmt));
      expect(
        offenders,
        `${selector} declares NO padding/min-height of its own — @mixin item owns the row box (a local declaration forks the family off the grammar)`,
      ).toEqual([]);
    }
  });

  it("keeps the grammar's data-checked emission beside the legacy state attrs", () => {
    // The sharpest honest gap of the adoption R3: TagInput/UserPicker
    // rows carry BOTH the legacy state (data-selected / .is-selected —
    // tests and hosts key on those) and the grammar's data-checked (the
    // face + the hover guard). A tsx-only revert of the emission keeps
    // every test green while the checked face silently dies to the
    // hover rule — so the emission itself is pinned at source level.
    expect(
      tagInputTsx,
      "HkTagInput must emit data-checked beside its legacy data-selected (the grammar's checked face and hover guard key on it)",
    ).toMatch(/data-checked=\{selected \|\| undefined\}/);
    expect(
      userPickerTsx,
      "HkUserPicker must emit data-checked for the multi-mode draft pick beside the legacy .is-selected class",
    ).toMatch(/data-checked=\{props\.mode === "multi" && inDraft\(user\.uid\) \|\| undefined\}/);
  });

  it("sizes the tag-input grip to the adopted row's content box", () => {
    // The grip is fixed-size inside a flex-auto row: taller than the
    // content box and every selected+reorderable row grows past the
    // grammar min-height while siblings stay on it (the 2026-10-31 R2
    // S1 — 28px grip in a 22px box). Pinned at source level: the grip
    // height must equal 34px − 2×6px.
    const grip = flattenBlocks(parseScss(stripScssComments(tagInputScss))).find(
      (block) => block.prelude.trim() === ".hk-tag-input-grip",
    );
    expect(grip, ".hk-tag-input-grip rule exists").toBeTruthy();
    const height = grip!.statements.find((stmt) => stmt.includes("height:"));
    expect(height, "the grip declares a height").toBeTruthy();
    expect(
      height!.replace(/\s+/g, " ").trim(),
      "grip height = 22px (the 34px row's content box: 34 − 2×6px)",
    ).toBe("height: 1.375rem");
  });
});
