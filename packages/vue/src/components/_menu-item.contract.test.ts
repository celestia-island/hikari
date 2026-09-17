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
const themeTsx = readFileSync(join(here, "HkThemeToggle.tsx"), "utf-8");
const adminTokens = readFileSync(join(here, "../styles/admin-tokens.scss"), "utf-8");

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
});
