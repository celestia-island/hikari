import { describe, expect, it } from "vitest";

import StatusTrayDecor from "../../../default_theme/src/StatusTrayDecor";
// The one-import contract under test: importing the package index IS the
// mount (README: `import "@celestia-island/default-theme"` — CSS + decor).
import "../../../default_theme/src/index";
import { getThemeDecor } from "../theme/themeDecor";

/**
 * @celestia-island/default-theme's delivery mechanism: a bare import of the
 * package mounts the tray decor on the "*" wildcard via registerThemeDecor,
 * so every theme (and themeless hosts) resolve it without any host glue.
 *
 * This pin lives in the vue suite because default_theme ships no runner of
 * its own — the vue suite is the only vitest root (CI: ci-hosted.yml) — and
 * the registry it asserts against is hikari's own. It goes red if the
 * side-effect call disappears from the package index (the "explicit
 * mountDefaultTheme()" escape hatch is a replacement, not a supplement).
 */
describe("@celestia-island/default-theme side-effect mount", () => {
  it("a bare import of the package mounts the tray on the '*' wildcard", () => {
    const resolved = getThemeDecor("status.tray", "any-theme-id");
    expect(resolved, "status.tray resolves after the bare import").toBeDefined();
    // And it is THE decor component — not merely some entry — so the
    // wildcard registration cannot silently drift to another component.
    expect(resolved?.component).toBe(StatusTrayDecor);
  });

  it("outranks the builtin floor without touching it (the override path)", () => {
    // The builtin floor for status.tray is deliberately empty (pinned in
    // standardDecor.test.ts); the wildcard entry is the ONLY reason the
    // slot resolves. Same lookup through the star id lands on it too.
    expect(getThemeDecor("status.tray", "*")?.component).toBe(StatusTrayDecor);
  });
});
