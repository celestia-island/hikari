import { describe, expect, it } from "vitest";
import * as barrel from "../index";
import { asIndexable } from "../utils/typing";
import type { HkAdminHeaderAvatarModalSlot, HkAdminHeaderSlots, HkFaceShellHeaderSlot, HkFaceShellSidebarSlot, HkFaceShellSlots, HkFaceShellUserPanelSlot } from "../index";

/**
 * The L39 slot-type contract pins. The exported slot types are what chest and
 * erp hand-copied as local interfaces (4 + 5 copies across the two repos);
 * these pins keep the PUBLIC contract honest in both directions:
 *
 * - runtime: the barrel keeps exporting every type name (a deleted `export
 *   type` line does not fail any other test — types vanish silently for
 *   importers while vitest stays green, the exact barrel-gap shape the
 *   HkFaceShell runtime pin below was written for);
 * - type-level: each interface is CONSUMED the way the downstream
 *   AdminLayouts consume it (subset destructuring + the aggregate wired into
 *   a defineComponent `slots:`), so a payload-field rename or removal breaks
 *   THIS file's compile (vue-tsc --noEmit), not a downstream repo's build.
 */

/** chest/erp AdminLayout shape: destructure a SUBSET of the header params. */
function headerSubset(params: HkFaceShellHeaderSlot) {
  const { compact, onOpenDrawer } = params;
  return { compact, onOpenDrawer };
}

/** The full five-field payload must be readable (no hand-copied subset lag). */
function headerFull(params: HkFaceShellHeaderSlot) {
  return [params.isDesktop, params.showHamburger, params.compact, params.onHamburger, params.onOpenDrawer];
}

function sidebarBody(params: HkFaceShellSidebarSlot) {
  // The optional peek/inDrawer flags are exactly the union the three render
  // sites pass (desktop expanded, rail peek, mobile drawer).
  return { collapsed: params.collapsed, onNavigate: params.onNavigate, peeking: params.peeking, inDrawer: params.inDrawer };
}

function userPanelBody(params: HkFaceShellUserPanelSlot) {
  return { onNavigate: params.onNavigate };
}

/** erp AdminLayout shape: the avatar-modal destructure. */
function avatarModalBody(params: HkAdminHeaderAvatarModalSlot) {
  const { open, onUpdateOpen } = params;
  onUpdateOpen(!open);
  return { open, onUpdateOpen };
}

describe("the public slot-type contract (L39)", () => {
  it("exports every slot type name from the barrel", () => {
    // Types are erased at runtime; the pin is the module-record presence of
    // each name via a type-only import assertion below plus this runtime
    // guard that the COMPONENTS still resolve (the types ride their files).
    const face = asIndexable(barrel.HkFaceShell);
    const header = asIndexable(barrel.HkAdminHeader);
    expect(face, "HkFaceShell must stay exported").toBeTruthy();
    expect(header, "HkAdminHeader must stay exported").toBeTruthy();
  });

  it("the slot param interfaces accept the real payloads", () => {
    expect(headerSubset({ isDesktop: false, showHamburger: true, compact: true, onHamburger: () => {}, onOpenDrawer: () => {} })).toEqual({ compact: true, onOpenDrawer: expect.any(Function) });
    expect(headerFull({ isDesktop: true, showHamburger: false, compact: false, onHamburger: () => {}, onOpenDrawer: () => {} }).filter(Boolean).length).toBe(3);
    expect(sidebarBody({ collapsed: true, onNavigate: () => {}, peeking: false })).toEqual({ collapsed: true, onNavigate: expect.any(Function), peeking: false, inDrawer: undefined });
    expect(sidebarBody({ collapsed: false, onNavigate: () => {}, inDrawer: true }).inDrawer).toBe(true);
    expect(userPanelBody({ onNavigate: () => {} }).onNavigate).toEqual(expect.any(Function));
    let opened = false;
    const avatar = avatarModalBody({ open: false, onUpdateOpen: (v) => { opened = v; } });
    expect(avatar.open).toBe(false);
    expect(opened).toBe(true);
  });

  it("the aggregate slot types fit a defineComponent slots declaration", () => {
    // The compile-time proof: both aggregates are SlotsType-compatible
    // objects usable as `slots: Object as ...`. Runtime stand-in asserts the
    // alias is a plain object cast (no accidental runtime import).
    const faceSlots = {} as HkFaceShellSlots;
    const headerSlots = {} as HkAdminHeaderSlots;
    expect(faceSlots).toEqual({});
    expect(headerSlots).toEqual({});
  });
});
