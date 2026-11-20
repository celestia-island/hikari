import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Static pins for the admin header's opt-in brand slot (the lagrange
 * relocation's upstream expansion #1: a host-supplied static site logo
 * in the left wing). happy-dom has no layout engine, so — chromeBand
 * -contract-style — these read the declarations themselves; reverting
 * any pinned value keeps the rest of the suite green, so each pin below
 * is the only red-if-broken evidence for its contract. A deliberate
 * rewrite is expected to update them.
 *
 * The contract (full prose on the brandSrc prop and the brand slot
 * entry of HkAdminHeaderSlots):
 *   1. the slot is declared in the SlotsType aggregate (zero-param —
 *      a static mark has no state to hand down);
 *   2. the desktop face renders the mark through ONE class,
 *      .s-admin-header-brand, and only while avatarAction is "menu"
 *      (the drawer face keeps its avatar trigger — that trigger IS the
 *      drawer path, so the mobile wing is invariant under the props);
 *   3. the mark is NON-INTERACTIVE: rendered through the div variant
 *      of HkLogo (no href ever passed), no button semantics;
 *   4. the face pins the pointer cursor OFF on the mark (HkLogo's
 *      standalone div carries cursor: pointer for its own hosts — a
 *      header identity must not promise a click) and drops the
 *      container rounding (site marks ship their own shape);
 *   5. the mark rides the "sm" HkLogo step — the closest visual weight
 *      to the 28px identity trigger it replaces inside the 48px band.
 */

const here = dirname(fileURLToPath(import.meta.url));

const adminHeader = readFileSync(join(here, "HkAdminHeader.tsx"), "utf8");
const adminTokens = readFileSync(join(here, "..", "styles", "admin-tokens.scss"), "utf8");

describe("admin header brand slot contract", () => {
  it("declares the zero-param brand slot in the SlotsType aggregate", () => {
    expect(adminHeader, "the brand slot entry must stay in the aggregate").toMatch(
      /brand\?: \(\) => VNode\[\];/,
    );
  });

  it("renders the mark on the desktop face only, through the one brand class", () => {
    expect(adminHeader, "the render site must carry the brand class").toContain(
      'class="s-admin-header-brand"',
    );
    // Drawer-face invariance: the face condition lives in ONE computed
    // (brand mounted AND avatarAction "menu") that BOTH the mark render
    // and the trigger suppression read — dropping the computed, or
    // widening it past the menu face, would put a static mark in front
    // of the mobile drawer's only opener (or strand the trigger beside
    // the mark). All three legs pinned.
    expect(adminHeader).toMatch(
      /brandedMenuFace = computed\(\s*\(\) => brandMounted\.value && props\.avatarAction === "menu",?\s*\)/,
    );
    expect(adminHeader).toMatch(
      /brandedMenuFace\.value && \(\s*<span class="s-admin-header-brand">/,
    );
    expect(adminHeader).toMatch(
      /identityMounted\.value && !brandedMenuFace\.value && \(\s*<HkAvatarButton/,
    );
  });

  it("renders the mark non-interactively (div-variant HkLogo, no href)", () => {
    // The fallback channel passes src/alt/size ONLY: an href would turn
    // the identity into a control (anchor semantics, keyboard focus, a
    // navigation promise the header never asked for).
    expect(adminHeader).toMatch(
      /<HkLogo src=\{props\.brandSrc\} alt=\{props\.brandAlt\} size="sm" \/>/,
    );
    expect(adminHeader).not.toMatch(/brandSrc[^>]*href=/);
  });

  it("pins the mark's non-interactive geometry in the header stylesheet", () => {
    // The wing box: fixed flex item, like the trigger box it replaced.
    expect(adminTokens).toMatch(/\.s-admin-header-brand\s*\{[^}]*flex-shrink: 0;/);
    // The identity-not-control pins: HkLogo's standalone div variant
    // ships cursor: pointer (its own hosts click it); a header mark must
    // read static, and its rounding would clip edge-to-edge wordmarks.
    expect(adminTokens).toMatch(
      /\.s-admin-header-brand \.hk-logo\s*\{[^}]*cursor: default;[^}]*\}/,
    );
    expect(adminTokens).toMatch(
      /\.s-admin-header-brand \.hk-logo\s*\{[^}]*border-radius: 0;/,
    );
    // The img carries its OWN radius from HkLogo.scss — the container
    // pin alone leaves a rounded mark (the .hk-logo rule does not reach
    // .hk-logo-img). Both layers pinned.
    expect(adminTokens).toMatch(
      /\.s-admin-header-brand \.hk-logo-img\s*\{[^}]*border-radius: 0;/,
    );
  });
});
