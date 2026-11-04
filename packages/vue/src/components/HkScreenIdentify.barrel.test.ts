import { describe, expect, it } from "vitest";

import * as barrel from "../index";
import { asIndexable } from "../utils/typing";

/**
 * Public barrel guard for the screen-identify family (R3 precedent: a
 * forgotten index.ts line keeps the whole suite green because every
 * other test reaches the module directly — only external consumers
 * notice). Same shape as HkFaceShell.barrel.test.ts.
 *
 * This file deliberately does NOT mock "@celestia-island/hikari": the
 * package's self-reference resolves to the very same src/index.ts module
 * as "../index".
 */
describe("the screen-identify family in the public barrel", () => {
  it("exports the card and the once-per-window host under both names", () => {
    const card = asIndexable(barrel.HkScreenIdentifyCard);
    const host = asIndexable(barrel.HkScreenIdentifyHost);
    expect(card, "HkScreenIdentifyCard must be re-exported").toBeTruthy();
    expect(card.name).toBe("HkScreenIdentifyCard");
    expect(host.name).toBe("HkScreenIdentifyHost");
    // The H- alias rides the HCard/HkCard family convention.
    expect(barrel.HScreenIdentifyCard).toBe(barrel.HkScreenIdentifyCard);
    expect(barrel.HScreenIdentifyHost).toBe(barrel.HkScreenIdentifyHost);
  });

  it("exports the ambient HUD layer primitive and its root", () => {
    const layer = asIndexable(barrel.HkAmbientLayer);
    expect(layer.name).toBe("HkAmbientLayer");
    expect(barrel.HAmbientLayer).toBe(barrel.HkAmbientLayer);
    expect(typeof barrel.ensureHudRoot).toBe("function");
    expect(barrel.HUD_ROOT_SELECTOR).toBe("#hk-hud-root");
    expect(barrel.HUD_ROOT_DOCUMENT_Z).toBe(90050);
  });

  it("exports the context that drives the card", () => {
    expect(typeof barrel.useScreenIdentify).toBe("function");
    expect(typeof barrel.showScreenIdentify).toBe("function");
    expect(typeof barrel.dismissScreenIdentify).toBe("function");
    expect(barrel.SCREEN_IDENTIFY_DEFAULT_MS).toBe(3000);
    // The context accessor hands out live refs and the two verbs.
    const identify = barrel.useScreenIdentify();
    expect(identify.active.value).toBe(false);
    expect(typeof identify.show).toBe("function");
    expect(typeof identify.dismiss).toBe("function");
  });
});
