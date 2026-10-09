// Unit tests for the context-menu quadrant pick: the pointer's nearest
// halves split the POPUP viewport (the window minus the app-chrome band
// the host configured), so a menu opened over a reserved strip grows
// into the usable space.
//
// AI disclosure: drafted by GLM via the ZCode agent, directed and
// reviewed by langyo — SySL-1.0 §2.3.
import { afterEach, describe, expect, it } from "vitest";

import { configurePopupInsets } from "../runtime/popupBounds";
import { quadrantPlacement } from "./HkContextMenuProvider";

const PREV_INNER = { width: window.innerWidth, height: window.innerHeight };

afterEach(() => {
  configurePopupInsets(null);
  window.innerWidth = PREV_INNER.width;
  window.innerHeight = PREV_INNER.height;
});

describe("quadrantPlacement", () => {
  it("splits the raw window in half when no band is configured", () => {
    window.innerWidth = 800;
    window.innerHeight = 600;
    expect(quadrantPlacement(100, 100)).toBe("bottom-start");
    expect(quadrantPlacement(700, 100)).toBe("bottom-end");
    expect(quadrantPlacement(100, 500)).toBe("top-start");
    expect(quadrantPlacement(700, 500)).toBe("top-end");
    // On the midlines the lower/right halves win (<=), unchanged.
    expect(quadrantPlacement(400, 300)).toBe("bottom-start");
  });

  it("splits the popup viewport when an app-chrome band is configured", () => {
    window.innerWidth = 800;
    window.innerHeight = 600;
    // A 400px title-bar stack: popups live in y 400..600, so the frame
    // midline is y=500 — a pointer at y=550 (raw-window TOP half) now
    // grows UP, staying inside the frame's lower half.
    configurePopupInsets({ top: 400 });
    expect(quadrantPlacement(500, 550)).toBe("top-end");
    expect(quadrantPlacement(100, 450)).toBe("bottom-start");
    expect(quadrantPlacement(700, 450)).toBe("bottom-end");
  });

  it("honors a side band on the horizontal split", () => {
    window.innerWidth = 800;
    window.innerHeight = 600;
    configurePopupInsets({ left: 600 }); // frame x 600..800, midline 700
    expect(quadrantPlacement(650, 100)).toBe("bottom-start");
    expect(quadrantPlacement(750, 100)).toBe("bottom-end");
  });
});
