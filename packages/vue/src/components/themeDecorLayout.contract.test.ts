import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * "Content, never placement" — the decor layout contract.
 *
 * A theme decor is a piece of content the HOST places: a tray in a footer, a
 * placeholder inside a card, an empty state in a panel. The moment a decor
 * brings its own `position`, that freedom is gone — an absolutely positioned
 * tray escapes its host slot, a `fixed` backdrop covers the host's own
 * chrome, and the "put it wherever your layout wants" promise silently
 * becomes "put it where the theme decided".
 *
 * So this guard scans the decor sources (component code AND sheets) for a
 * positioning declaration. Notes on its own honesty:
 *
 *  - the target list is explicit and every entry must EXIST and carry the
 *    content it is supposed to carry: a renamed/moved file fails here
 *    instead of quietly scanning nothing;
 *  - the detector is proven against known-bad snippets AND against a shipped
 *    sheet that really does position something (HkBlankCanvas.scss), so it
 *    cannot pass by matching nothing;
 *  - comments are stripped before the scan: prose about `position` is not a
 *    declaration (and a guard that fired on its own explanation would get
 *    deleted rather than fixed);
 *  - HkThemeDecor must have NO sheet at all: a resolver that ships styles is
 *    a wrapper element in disguise, and a wrapper is exactly what would make
 *    the decor stop being a child of the host's slot.
 *
 * The needle deliberately ignores `background-position:` (the character
 * before `position` is a `-`), which is not placement of the element, and it
 * is case-insensitive: CSS property names are (`POSITION: fixed` is valid
 * CSS and would position the decor just the same).
 */

const componentDir = resolve(dirname(fileURLToPath(import.meta.url)));

/** Placement declaration in either dialect: CSS `position: absolute;` or an
 *  inline `position: "absolute"` in TSX. */
const POSITION_DECL = /(?:^|[^-\w])position\s*:/i;

interface Target {
  file: string;
  /** A literal the file must contain — proves the scan read the real file. */
  anchor: string;
}

const TARGETS: Target[] = [
  { file: "HkThemeDecor.tsx", anchor: "HkThemeDecor" },
  { file: "HkStatusTray.tsx", anchor: "s-status-bar-system-tray" },
  { file: "HkStatusTray.scss", anchor: "s-status-bar-system-tray" },
];

function read(file: string): string {
  return readFileSync(resolve(componentDir, file), "utf8");
}

/**
 * Code-only view of a source: block comments always, `//` line comments only
 * in sheets. In TSX a `//` can live inside a string (`https://…`), and
 * cutting there could hide a real declaration later on the same line.
 */
function stripComments(source: string, file: string): string {
  const withoutBlock = source.replace(/\/\*[\s\S]*?\*\//g, "");
  // Line comments are stripped for EVERY scanned file, not just `.scss`: a
  // TSX comment that merely mentions `position:` is prose, and leaving it in
  // made the guard fire on its own explanation (mutation-proven).
  void file;
  return withoutBlock.replace(/^[ \t]*\/\/.*$/gm, "");
}

/** Lines of `file` that declare a position, with their 1-based numbers. */
function positionHits(file: string, source: string): { line: number; text: string }[] {
  return stripComments(source, file)
    .split("\n")
    .map((text, i) => ({ line: i + 1, text }))
    .filter(({ text }) => POSITION_DECL.test(text));
}

describe("theme decor layout contract", () => {
  it("detects a positioning declaration (positive control)", () => {
    expect(positionHits("x.scss", ".x { position: absolute; top: 0; }")).toHaveLength(1);
    expect(positionHits("x.scss", ".x{position:sticky}")).toHaveLength(1);
    expect(positionHits("x.scss", ".x{ position : relative }")).toHaveLength(1);
    expect(positionHits("x.tsx", 'style={{ position: "fixed" }}')).toHaveLength(1);
    // CSS property names are case-insensitive (`POSITION: fixed` is valid).
    expect(positionHits("x.scss", ".x { POSITION: fixed; }")).toHaveLength(1);

    // Not placement: the background origin keyword, a prose mention, and a
    // commented-out declaration.
    expect(positionHits("x.scss", ".x { background-position: center; }")).toEqual([]);
    expect(positionHits("x.tsx", "// the host owns the position of this node")).toEqual([]);
    expect(positionHits("x.scss", "/* position: absolute; */\n.x { color: red; }")).toEqual([]);
    expect(positionHits("x.scss", "// position: fixed\n.x { color: red; }")).toEqual([]);

    // A shipped sheet that really does position things: the scan must fire on
    // real repository content, not just the snippets above.
    expect(positionHits("HkBlankCanvas.scss", read("HkBlankCanvas.scss")).length).toBeGreaterThan(0);
  });

  it("scans existing files that carry the expected content (no empty scan)", () => {
    expect(TARGETS.length).toBeGreaterThan(0);
    for (const { file, anchor } of TARGETS) {
      const path = resolve(componentDir, file);
      expect(existsSync(path), `${file} exists`).toBe(true);
      const source = read(file);
      expect(source.length, `${file} is not empty`).toBeGreaterThan(50);
      expect(source, `${file} carries ${anchor}`).toContain(anchor);
    }
  });

  it("keeps positioning out of the decor components and their sheets", () => {
    for (const { file } of TARGETS) {
      const hits = positionHits(file, read(file));
      expect(hits, `${file} must not position itself: ${JSON.stringify(hits)}`).toEqual([]);
    }
  });

  it("gives HkThemeDecor no stylesheet at all (no wrapper in disguise)", () => {
    // The resolver renders the decor component's own root as its only node.
    // A sheet here would mean a wrapper element, and every decor would stop
    // being a direct child of the host's slot.
    expect(existsSync(resolve(componentDir, "HkThemeDecor.scss"))).toBe(false);
  });
});
