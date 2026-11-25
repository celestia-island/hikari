// The vars are the RUST DERIVATION's output (packages/palette/src/
// derivation.rs), shipped as this JSON artifact — hikari#1546 Phase 2
// endgame. The TypeScript tokensToCSSVars remains ONLY for runtime-authored
// custom themes, and the drift contract below pins it, key-for-key, to this
// artifact so the two implementations cannot diverge.
import stockVarsJson from "./stock-vars.json";

/**
 * The PRE-RENDERED static form of the stock theme table (hikari#1546).
 *
 * `applyTheme()` injects the whole cssvar set from JS, which is why a
 * phone's first paint used to flash the unthemed default: no JS, no vars.
 * This module composes the SAME `tokensToCSSVars` output the runtime uses
 * into plain CSS blocks keyed on the `data-mode` attribute — the SSR
 * template ships it in `<head>`, and a tiny inline bootstrap only sets
 * `data-theme`/`data-mode` (attribute writes, no computation) before body
 * paint. The cascade picks the block instantly.
 *
 * Selectors are mode-keyed and deliberately NOT theme-keyed: a stored
 * CUSTOM theme id cannot be pre-rendered (user-authored, lives in
 * localStorage), so pre-hydration those users see the stock colors in the
 * right MODE — strictly better than the previous unthemed flash — and
 * `applyTheme()` replaces them the moment the bundle lands. Override
 * mechanics: the runtime writes a managed `<style data-hikari-theme-vars>`
 * block whose selector (`html:root`, 0-1-1) TIES with these `html[data-mode]`
 * blocks — the runtime wins by head ORDER (its block is appended after the
 * SSR sheet), so the static sheet must stay in the SSR head; a late/async
 * -loaded copy would re-tie and could snap the theme back.
 *
 * Phase 2 (de-Vue): the table itself moves to the Rust palette crate
 * (tairitsu lane) and this module consumes generated JSON — the CSS form
 * and the bootstrap contract stay exactly as they are here.
 *
 * Group tokens (shape/radius) are intentionally NOT included: every
 * component reads them with its own CSS fallback (e.g.
 * `var(--hk-radius-sm, 4px)` in HkSkeleton, `var(--hk-z-*)`,
 * `var(--hk-picker-*)`), so the pre-hydration window degrades to identical
 * geometry, and the runtime emission covers them anyway.
 */
/** The typed view of the Rust artifact: the serde BTreeMap arrives as two
 *  string-keyed maps. Declared explicitly because the JSON import's literal
 *  type defeats `stockVarsJson[mode]` under the strict build (vue-tsc
 *  TS7053 — the release lane caught it, the esbuild test transform did not). */
export interface StockVarsArtifact {
  dark: Record<string, string>;
  light: Record<string, string>;
}

const stockVars: StockVarsArtifact = stockVarsJson as StockVarsArtifact;

const MODES = ["dark", "light"] as const;

export function buildThemeVarsCss(): string {
  const chunks: string[] = [
    "/* GENERATED from the Rust palette crate's derivation (packages/palette/",
    " * src/derivation.rs) via the stock-vars.json artifact — do not edit by",
    " * hand. The drift contract pins the TypeScript derivation to these",
    " * values key-for-key; regen is REGEN_STOCK_JSON=1 cargo test",
    " * -p hikari-palette --test stock_snapshot. */",
  ];
  for (const mode of MODES) {
    const vars = stockVars[mode];
    chunks.push(`html[data-mode="${mode}"] {`);
    for (const name of Object.keys(vars)) {
      chunks.push(`  ${name}: ${vars[name]};`);
    }
    chunks.push("}");
  }
  return chunks.join("\n") + "\n";
}

export { stockVars };
