import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  listCssAnimations,
  registerCssAnimation,
  setCssAnimationsEnabled,
  isCssAnimationsEnabled,
} from "./registerAnimations";
import { setReducedMotion } from "../runtime/animationBus";

const srcDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Recursively collect SCSS/TS/TSX sources under src/, skipping the
 * animation registrar's own directory (it is the thing under test, not
 * an animation-owning component). */
function collectSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (p === path.resolve(srcDir, "animation")) continue;
      out.push(...collectSourceFiles(p));
    } else if (/\.(scss|ts|tsx)$/.test(entry.name)) {
      out.push(p);
    }
  }
  return out;
}

/** Names of every `@keyframes` actually declared in the source tree.
 * Full-line `//` comments are stripped first so commented-out keyframes
 * (see HkBreadcrumb.scss) are not counted. */
function declaredKeyframeNames(): string[] {
  const names = new Set<string>();
  for (const file of collectSourceFiles(srcDir)) {
    const stripped = readFileSync(file, "utf-8").replace(/^[ \t]*\/\/.*$/gm, "");
    for (const m of stripped.matchAll(/@keyframes\s+([A-Za-z0-9_-]+)/g)) {
      names.add(m[1]);
    }
  }
  return [...names].sort();
}

describe("registerAnimations", () => {
  it("registers exactly the keyframes declared in the source tree", () => {
    const declared = declaredKeyframeNames();
    expect(declared.length).toBeGreaterThanOrEqual(12);
    const registered = listCssAnimations().map((a) => a.name);
    expect([...registered].sort()).toEqual(declared);
  });

  it("marks looping animations as infinite and one-shots as finite", () => {
    const byName = new Map(listCssAnimations().map((a) => [a.name, a]));
    expect(byName.get("hk-spinner-rotate")?.infinite).toBe(true);
    expect(byName.get("hk-toast-spin")?.infinite).toBe(true);
    expect(byName.get("hk-skeleton-shimmer")?.infinite).toBe(true);
    expect(byName.get("hk-progress-indeterminate")?.infinite).toBe(true);
    expect(byName.get("hk-status-pill-pulse")?.infinite).toBe(true);
    expect(byName.get("hk-pwd-breathe")?.infinite).toBe(true);
    expect(byName.get("s-nav-item-badge-pulse")?.infinite).toBe(true);
    expect(byName.get("s-auth-card-in")?.infinite).toBe(false);
    expect(byName.get("hk-rolling-number-up")?.infinite).toBe(false);
    expect(byName.get("hk-modal-breadcrumb-in")?.infinite).toBe(false);
    expect(byName.get("hk-pwd-flash")?.infinite).toBe(false);
  });

  it("flips the html dataset attribute in both directions", () => {
    setCssAnimationsEnabled(false);
    expect(document.documentElement.dataset.cssAnimations).toBe("0");
    expect(isCssAnimationsEnabled()).toBe(false);
    setCssAnimationsEnabled(true);
    expect(document.documentElement.dataset.cssAnimations).toBe("1");
    expect(isCssAnimationsEnabled()).toBe(true);
  });

  it("suspends CSS animations together with the reduced-motion bus", () => {
    setReducedMotion(true);
    expect(document.documentElement.dataset.cssAnimations).toBe("0");
    expect(isCssAnimationsEnabled()).toBe(false);
    setReducedMotion(false);
    expect(document.documentElement.dataset.cssAnimations).toBe("1");
    expect(isCssAnimationsEnabled()).toBe(true);
  });

  it("re-registers idempotently and keeps the list sorted", () => {
    registerCssAnimation("hk-spinner-rotate", { infinite: true });
    const names = listCssAnimations().map((a) => a.name);
    expect(names.indexOf("hk-spinner-rotate")).toBe(names.lastIndexOf("hk-spinner-rotate"));
    expect(names).toEqual([...names].sort());
  });
});
