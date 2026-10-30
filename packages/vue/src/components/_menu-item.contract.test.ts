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

/** Every TOP-LEVEL block of a stylesheet, slice starting after the
 *  previous block's closing brace (comments are stripped by the caller). */
function topLevelBlocks(source: string): string[] {
  const blocks: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        blocks.push(source.slice(start, i + 1));
        start = i + 1;
      }
    }
  }
  return blocks;
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
    // token). The invariant is the RHYTHM: the bottom band must be
    // strictly LARGER than the top band, because the panel already insets
    // the surface above the caption while the bottom band is the
    // separation that says "these are the rows below". Reverting either
    // fallback (top back up, bottom back down) must fail here.
    const body = mixinBody("section-label");
    const top = pxFallback(body, "--hk-menu-section-label-pad-top");
    const bottom = pxFallback(body, "--hk-menu-section-label-pad-bottom");
    expect(top, "caption top band parsed as px").toBeGreaterThan(0);
    expect(
      bottom,
      `caption bottom band (${bottom}px) must be strictly larger than its top band (${top}px) — bottom-heavy rhythm`,
    ).toBeGreaterThan(top);
  });

  it("hangs the caption's inline inset just left of the row content edge", () => {
    // The caption must NOT read as an indented row: its inline inset is a
    // hair smaller than the row grammar's --hk-menu-item-pad-x (plus the
    // rows' reserved 1px border), so it hugs the section edge slightly
    // left of the leading icon column.
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
    // The caption is a sibling band: the rows' token swap never reaches
    // it, so it needs its own entry in EVERY list that registers
    // .hk-menu-divider (the three sheet-panel surfaces and the narrow
    // mobile modal band). A new sheet-context list that widens the rows
    // without widening their caption fails here.
    const blocks = topLevelBlocks(grammar.replace(/\/\*[\s\S]*?\*\//g, "")).filter(
      (block) => block.includes(".hk-menu-divider"),
    );
    expect(blocks.length, "top-level blocks registering .hk-menu-divider").toBe(2);
    for (const block of blocks) {
      const listName = block.trim().split("\n")[0]!.trim();
      expect(
        block,
        `sheet-context list "${listName}" registers .hk-menu-divider but not .hk-menu-section-label`,
      ).toContain(".hk-menu-section-label");
      expect(
        block,
        `sheet-context list "${listName}" must swap the caption's sheet tokens`,
      ).toContain("section-label-sheet-tokens");
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

  it("publishes the section caption globally for host apps via admin-tokens", () => {
    // Hosts render .hk-menu-section / .hk-menu-section-label by hand (the
    // workspace picker does) and cannot import the scss partial, so the
    // global sheet binds the classes to the grammar mixins.
    expect(adminTokens).toMatch(/\.hk-menu-section \{[^}]*@include mi\.section;/);
    expect(adminTokens).toMatch(/\.hk-menu-section-label \{[^}]*@include mi\.section-label;/);
    // The caption's sheet geometry lives in the grammar's sheet-context
    // lists only; re-declaring it in admin-tokens is the drift this
    // grammar exists to prevent.
    const adopterRules = adminTokens.match(/(?:^|\n)\s*\.hk-menu-section-label\s*\{/g) ?? [];
    expect(adopterRules.length, "exactly one global .hk-menu-section-label rule").toBe(1);
  });
});
