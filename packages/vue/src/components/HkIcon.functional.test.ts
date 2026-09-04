import { afterEach, describe, expect, it } from "vitest";
import { createApp, defineComponent, h } from "vue";
import { ChevronLeft, X } from "lucide-vue-next";

import HkIcon from "./HkIcon";
import {
  functionalIconComponent,
  functionalIconSvg,
  hasFunctionalIconOverride,
  registerFunctionalIconPack,
  sanitizeSvg,
} from "../composables/iconRegistry";

const mounts: Array<ReturnType<typeof createApp>> = [];

function mountIcon(name: string): HTMLElement {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const app = createApp(
    defineComponent({ setup: () => () => h(HkIcon, { name, size: 16 }) }),
  );
  mounts.push(app);
  app.mount(container);
  return container;
}

afterEach(() => {
  for (const app of mounts.splice(0)) app.unmount();
  registerFunctionalIconPack(null);
});

describe("functional icon aliases and material packs", () => {
  it("maps the semantic keys to the built-in family by default", () => {
    // Identity with the lucide entries the aliases point at (lucide
    // components carry no `.name` — identity is the honest check).
    expect(functionalIconComponent("close")).toBe(X);
    expect(functionalIconComponent("back")).toBe(ChevronLeft);
    expect(hasFunctionalIconOverride("close")).toBe(false);
    expect(functionalIconSvg("close")).toBeNull();
  });

  it("renders the alias glyph through HkIcon without a pack", () => {
    const c = mountIcon("close");
    // lucide X renders as .lucide-x inside the .hk-icon wrapper.
    expect(c.querySelector(".lucide-x")).not.toBeNull();
  });

  it("renders a registered material-pack override instead of the alias", () => {
    registerFunctionalIconPack({
      close: '<svg viewBox="0 0 24 24" class="pack-close-mark"><path d="M4 4h16v16H4z"/></svg>',
    });
    expect(hasFunctionalIconOverride("close")).toBe(true);
    const c = mountIcon("close");
    expect(c.querySelector(".pack-close-mark")).not.toBeNull();
    expect(c.querySelector(".lucide-x")).toBeNull();
  });

  it("leaves back untouched when the pack only carries close", () => {
    registerFunctionalIconPack({
      close: "<svg/>",
    });
    expect(hasFunctionalIconOverride("back")).toBe(false);
    const c = mountIcon("back");
    expect(c.querySelector(".lucide-chevron-left")).not.toBeNull();
  });

  it("sanitizes scripts and inline handlers out of pack markup", () => {
    const dirty =
      '<svg onload="alert(1)" onclick="x()"><script>alert(2)</script><path d="M4 4" onmouseover="y()"/></svg>';
    const clean = sanitizeSvg(dirty);
    expect(clean).not.toContain("script");
    expect(clean).not.toContain("onload");
    expect(clean).not.toContain("onclick");
    expect(clean).not.toContain("onmouseover");
    expect(clean).toContain("<path");
    // sanitize applies on the functional render path too.
    registerFunctionalIconPack({ close: dirty });
    const c = mountIcon("close");
    expect(c.querySelector("script")).toBeNull();
  });

  // Round-2 review vectors (slash separators, unquoted schemes, SMIL).
  it("neutralizes the round-2 evasion vectors", () => {
    expect(sanitizeSvg("<svg/onload=alert(1)>")).not.toContain("onload");
    expect(sanitizeSvg('<svg onload=alert(1)>')).not.toContain("onload");
    expect(sanitizeSvg('<a href=javascript:alert(1)>t</a>')).not.toContain("javascript:");
    expect(sanitizeSvg('<a href="javascript:alert(1)">t</a>')).not.toContain("javascript:");
    expect(sanitizeSvg('<animate attributeName="href" values="javascript:alert(1)"/>')).not.toContain("animate");
    expect(sanitizeSvg('<set attributeName="onmouseover" to="alert(1)"/>')).not.toContain("set");
    expect(sanitizeSvg('<iframe src="javascript:alert(1)"></iframe>')).not.toContain("iframe");
    expect(sanitizeSvg('<foreignObject><body onload="x()"></body></foreignObject>')).not.toContain("foreignObject");
  });

  it("clearing the pack restores the built-in family", () => {
    registerFunctionalIconPack({ close: '<svg class="pack"/><svg class="pack"/>' });
    registerFunctionalIconPack(null);
    expect(hasFunctionalIconOverride("close")).toBe(false);
    const c = mountIcon("close");
    expect(c.querySelector(".lucide-x")).not.toBeNull();
  });
});
