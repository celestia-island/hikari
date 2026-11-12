import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Static pins for the chrome-band layer contract (field reports
 * 2026-11-12: opening the chest settings window or the display/tray
 * window dimmed and deadened the ENTIRE drag row under the HkModal
 * veil — the drag region stopped dragging, the gear and the caption
 * cluster went unclickable — because the host-drawn band carried no
 * layer claim while every floating layer paints inside the overlay
 * root). happy-dom has no layout engine, so — windowControlsEdgeInset
 * -style — these read the declarations themselves; reverting any
 * pinned value keeps the rest of the suite green, so each pin below
 * is the only red-if-broken evidence for its contract. A deliberate
 * rewrite is expected to update them.
 *
 * The contract: a host caption band (a drag-region row hosting
 * HkWindowControls — the chest chat face and login strip; the console
 * face through the HkAdminHeader chrome mode) adds .hk-chrome-band and
 * occupies the titlebar layer, the SAME layer HkTitleBar sits on. The
 * overlay-root statement of the global order is the design source:
 * content chrome < floating layers < error landing < window titlebar.
 *
 * Pinned here:
 *   1. the layer ladder still ends titlebar ABOVE every floating band
 *      (overlay-root < error < titlebar — the ascending order the
 *      claim depends on);
 *   2. HkTitleBar claims that layer (the reference caption — if the
 *      layer moves, the band claim moves with it);
 *   3. .hk-chrome-band carries the WEAK relative default (plain
 *      in-flow bands get a position so the z bites; a fixed/sticky
 *      host declaration must out-rank it);
 *   4. .hk-chrome-band.hk-chrome-band carries the STRONG titlebar z
 *      (doubled class: (0,2,0) beats every single-class band z
 *      regardless of sheet load order);
 *   5. HkAdminHeader hangs the band class from the chrome prop (the
 *      in-library caption);
 *   6. HkWindowControls names the class (its doc is where hosts read
 *      the contract — keep the prose home in sync);
 *   7. the GEOMETRY leg exists: both HkModal fixed plates read
 *      --hk-chrome-band-inset on their top edge (the stacking-proof
 *      fallback for hosts whose wrappers trap the band), and so does
 *      every OTHER windowed veil the library ships — the drawer's
 *      overlay and its left/right/top panels, the loading veil, and the
 *      mobile sheet scrims of the popover and the select panel (2026-11-12
 *      extension: the modal got the leg first; a drawer or a blocking
 *      veil covering the caption row again would be the same field
 *      report with a different component).
 */

const here = dirname(fileURLToPath(import.meta.url));

const scale = readFileSync(join(here, "..", "scale.scss"), "utf8");
const adminTokens = readFileSync(join(here, "..", "styles", "admin-tokens.scss"), "utf8");
const adminHeader = readFileSync(join(here, "HkAdminHeader.tsx"), "utf8");
const titleBarScss = readFileSync(join(here, "HkTitleBar.scss"), "utf8");
const windowControls = readFileSync(join(here, "HkWindowControls.tsx"), "utf8");
const modalScss = readFileSync(join(here, "HkModal.scss"), "utf8");
const drawerScss = readFileSync(join(here, "HkDrawer.scss"), "utf8");
const veilScss = readFileSync(join(here, "HkLoadingVeil.scss"), "utf8");
const selectScss = readFileSync(join(here, "HkSelect.scss"), "utf8");
const popoverScss = readFileSync(join(here, "HkPopover.scss"), "utf8");
const titleBarTsx = readFileSync(join(here, "HkTitleBar.tsx"), "utf8");
const tooltipBridge = readFileSync(join(here, "..", "runtime", "tooltipBridge.ts"), "utf8");
const popupBounds = readFileSync(join(here, "..", "runtime", "popupBounds.ts"), "utf8");

/** The numeric value a root z-token declaration carries, or null. */
function rootTokenZ(source: string, token: string): number | null {
  const m = new RegExp(token + "\\s*:\\s*(\\d+)").exec(source);
  return m ? Number(m[1]) : null;
}

/** Brace depth of the code at a character index (0 = top level). */
function braceDepthAt(code: string, at: number): number {
  let depth = 0;
  for (let i = 0; i < at; i += 1) {
    if (code[i] === "{") depth += 1;
    else if (code[i] === "}") depth -= 1;
  }
  return depth;
}

/** Declarations of every rule whose prelude IS the selector given
 *  (whole-prelude match, comments stripped), with whether it sits
 *  inside an at-block. */
function allRuleDeclarations(
  source: string,
  selector: string,
): Array<{ nested: boolean; decls: Array<[string, string]> }> {
  // HkModal.scss carries // line comments INSIDE rule bodies (and a
  // comment colon would glue itself onto the next declaration, losing
  // both) — strip line comments too; no url() in the sheet, so a bare
  // //→EOL strip cannot eat a data URI.
  const code = source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "");
  const out: Array<{ nested: boolean; decls: Array<[string, string]> }> = [];
  for (let at = code.indexOf(selector); at >= 0; at = code.indexOf(selector, at + 1)) {
    const open = code.indexOf("{", at + selector.length);
    if (open < 0) continue;
    if (code.slice(at + selector.length, open).trim() !== "") continue;
    let boundary = at - 1;
    while (boundary >= 0 && !"}{;".includes(code[boundary])) boundary -= 1;
    if (code.slice(boundary + 1, at).replace(/\s+/g, " ").trim() !== "") continue;
    const nested = braceDepthAt(code, at) > 0;
    const body = code.slice(open + 1, code.indexOf("}", open));
    const decls: Array<[string, string]> = [];
    for (const part of body.split(";")) {
      const m = /^\s*([-a-zA-Z]+)\s*:\s*([\s\S]+?)\s*$/.exec(part);
      if (m) decls.push([m[1], m[2].replace(/\s+/g, " ")]);
    }
    out.push({ nested, decls });
  }
  return out;
}

describe("chrome-band layer contract (the host caption stayed under the veil)", () => {
  it("orders the layer ladder: overlay-root < error < titlebar", () => {
    // The band claim only works while the titlebar layer stays above
    // every floating band the library ships. If a value moves, this is
    // the pin that forces the ladder decision to be conscious.
    const overlayRoot = rootTokenZ(scale, "--hk-z-overlay-root");
    const error = rootTokenZ(scale, "--hk-z-error");
    const titlebar = rootTokenZ(scale, "--hk-z-titlebar");
    expect(overlayRoot, "overlay root must declare a z").not.toBeNull();
    expect(error, "error landing must declare a z").not.toBeNull();
    expect(titlebar, "titlebar must declare a z").not.toBeNull();
    expect(titlebar!).toBeGreaterThan(error!);
    expect(error!).toBeGreaterThan(overlayRoot!);
  });

  it("keeps HkTitleBar on the titlebar layer (the reference caption)", () => {
    const rules = allRuleDeclarations(titleBarScss, ".hk-titlebar").filter((r) => !r.nested);
    expect(rules.length, ".hk-titlebar must be declared at top level").toBeGreaterThan(0);
    const joined = rules.flatMap((r) => r.decls);
    expect(joined).toContainEqual(["z-index", "var(--hk-z-titlebar)"]);
  });

  it("gives .hk-chrome-band the weak relative default at top level", () => {
    // Exactly ONE bare .hk-chrome-band rule, and its body carries the
    // position default with NO z — the doubled-class rule must not
    // satisfy this pin, because its specificity is the contract.
    const rules = allRuleDeclarations(adminTokens, ".hk-chrome-band").filter((r) => !r.nested);
    const weak = rules.filter(
      (r) => r.decls.some(([prop]) => prop === "position") && !r.decls.some(([prop]) => prop === "z-index"),
    );
    expect(weak.length, "the weak relative default must exist once").toBe(1);
    expect(weak[0].decls).toContainEqual(["position", "relative"]);
  });

  it("claims the titlebar z through the doubled-class strong rule", () => {
    const rules = allRuleDeclarations(adminTokens, ".hk-chrome-band.hk-chrome-band").filter(
      (r) => !r.nested,
    );
    expect(rules.length, "the strong band rule must exist at top level").toBe(1);
    expect(rules[0].decls).toContainEqual(["z-index", "var(--hk-z-titlebar)"]);
    // The strong rule must stay z-ONLY: forcing a position here would
    // re-flow a fixed/sticky host caption back into the page.
    expect(
      rules[0].decls.some(([prop]) => prop === "position"),
      "the strong rule must not declare a position",
    ).toBe(false);
  });

  it("hangs the band class from the HkAdminHeader chrome prop", () => {
    // Chrome mode IS the caption contract; the prop without the class
    // leaves the console face veiled again — both halves are the pin.
    expect(adminHeader).toMatch(
      /props\.chrome\s*\?\s*"hk-chrome-band"\s*:\s*""/,
    );
  });

  it("yields the modal veil's top edge to --hk-chrome-band-inset", () => {
    // The geometry leg (R1 2026-11-12: chest's #app stacking context
    // voids the z claim there). BOTH fixed plates — dim overlay AND
    // blur plate — must read the token on TOP only: an inset:0
    // shorthand cannot carry the inset, and a missing leg on either
    // plate re-dims or re-blurs the band under an open modal.
    const overlay = allRuleDeclarations(modalScss, ".hk-modal-overlay").filter((r) => !r.nested);
    expect(overlay.length, ".hk-modal-overlay must be declared at top level").toBe(1);
    expect(overlay[0].decls).toContainEqual(["top", "var(--hk-chrome-band-inset, 0px)"]);
    expect(overlay[0].decls).toContainEqual(["right", "0"]);
    expect(overlay[0].decls).toContainEqual(["bottom", "0"]);
    expect(overlay[0].decls).toContainEqual(["left", "0"]);
    const plate = allRuleDeclarations(modalScss, ".hk-modal-blur-plate").filter((r) => !r.nested);
    expect(plate.length, ".hk-modal-blur-plate must be declared at top level").toBe(1);
    expect(plate[0].decls).toContainEqual(["top", "var(--hk-chrome-band-inset, 0px)"]);
  });

  it("names .hk-chrome-band on HkWindowControls (the prose home)", () => {
    expect(windowControls).toContain(".hk-chrome-band");
  });

  it("yields the other windowed veils' top edge to --hk-chrome-band-inset", () => {
    // The geometry leg across the windowed family: every fixed dim/blur
    // curtain (and every panel that would physically cover the band row)
    // starts BELOW the host caption band. A missing leg on any of these
    // re-dims — or re-covers — the caption row on native shells.
    const expectInset = (source: string, selector: string, file: string) => {
      const rules = allRuleDeclarations(source, selector).filter((r) => !r.nested);
      expect(rules.length, selector + " in " + file + " must exist at top level").toBe(1);
      expect(rules[0].decls).toContainEqual(["top", "var(--hk-chrome-band-inset, 0px)"]);
    };
    expectInset(drawerScss, ".hk-drawer-overlay", "HkDrawer.scss");
    expectInset(drawerScss, ".hk-drawer-left", "HkDrawer.scss");
    expectInset(drawerScss, ".hk-drawer-right", "HkDrawer.scss");
    expectInset(drawerScss, ".hk-drawer-top", "HkDrawer.scss");
    expectInset(veilScss, ".hk-loading-veil", "HkLoadingVeil.scss");
    expectInset(selectScss, ".hk-select-sheet-scrim", "HkSelect.scss");
    expectInset(popoverScss, ".hk-popover-scrim", "HkPopover.scss");
    // A BOTTOM-docked drawer still owns its bottom edge — the inset is a
    // top-edge contract only.
    const bottom = allRuleDeclarations(drawerScss, ".hk-drawer-bottom").filter((r) => !r.nested);
    expect(bottom[0].decls).not.toContainEqual(["top", "var(--hk-chrome-band-inset, 0px)"]);
  });

  it("keeps tooltips off the band by default with an explicit exemption", () => {
    // The tooltip leg of the contract (2026-11-12 user direction): the
    // popup frame floors at the band inset + POPUP_BAND_GAP_PX (4) —
    // default NO cover; pinning over the strip is an explicit per-trigger
    // marker or install option, which the caption's OWN buttons carry.
    // Three pins: the floor exists, the bridge reads the marker, and the
    // title bar's buttons carry it.
    expect(popupBounds).toMatch(/bandInset > 0 \? bandInset \+ POPUP_BAND_GAP_PX : 0/);
    expect(popupBounds).toContain("POPUP_BAND_GAP_PX = 4");
    expect(tooltipBridge).toContain('data-hk-tooltip-band-overlap');
    expect(tooltipBridge).toMatch(/el\.hasAttribute\(\"data-hk-tooltip-band-overlap\"\)/);
    // Every caption-row button of the reference title bar opts in —
    // custom actions, minimize, maximize/restore, close.
    const markers = (titleBarTsx.match(/data-hk-tooltip-band-overlap="true"/g) ?? []).length;
    expect(markers, "all four caption buttons must carry the exemption").toBe(4);
  });
});
