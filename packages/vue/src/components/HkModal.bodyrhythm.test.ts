/**
 * Source contract for the modal body's default vertical rhythm (2026-09-08
 * user direction: window bodies keep a little distance between their
 * elements without every consumer hand-rolling a gap).
 *
 * `.hk-modal-body-inner` spaces its bare stacked children with a
 * host-tunable custom property:
 *   --hk-modal-body-gap  margin between adjacent direct children
 *                        (block layout collapses it with the children's
 *                        own margins, so it never doubles spacing)
 *
 * Pinned here so a refactor cannot silently regress to the
 * padding-only body that left every unstyled window glued together —
 * the same class of "looks fixed but never shipped" failure as the
 * overflow-poll incident.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, "HkModal.scss"), "utf-8");

describe("HkModal body rhythm contract", () => {
  let inner = "";
  beforeAll(() => {
    inner = src.match(/\.hk-modal-body-inner\s*{[\s\S]*?\n}/)?.[0] ?? "";
  });

  it("spaces bare stacked children with --hk-modal-body-gap", () => {
    expect(inner).toContain("& > * + *");
    expect(inner).toMatch(/--hk-modal-body-gap,\s*0\.75rem/);
    expect(inner).toContain("margin-top: var(--hk-modal-body-gap");
  });

  it("keeps the body padding hook unchanged", () => {
    expect(inner).toContain("padding: var(--hk-modal-padding-body");
  });
});
