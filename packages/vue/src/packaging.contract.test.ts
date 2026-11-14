/**
 * Packaging contract: every package imported at module top level by
 * SHIPPED src/ must be a runtime dependency. The wasm wave shipped
 * src/wasm/{qr,mermaid,scene3d} modules whose generated js imports
 * @bytecodealliance/preview2-shim at top level while the package kept
 * it in devDependencies — hikari's own gates install devDeps and
 * stayed green, while every downstream consumer's resolver failed on
 * the barrel import (0.55.371 field report: chest, 90 test files of
 * ERR_MODULE_NOT_FOUND). The shim now lives in dependencies; this pin
 * keeps it there (mutation: move it back → red).
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

const pkg = JSON.parse(readFileSync(join(here, "..", "package.json"), "utf-8"));

describe("packaging contract", () => {
  it("keeps the wasm shim in dependencies (shipped src imports it)", () => {
    expect(pkg.dependencies?.["@bytecodealliance/preview2-shim"]).toBe("^0.31");
    expect(pkg.devDependencies?.["@bytecodealliance/preview2-shim"]).toBeUndefined();
  });
});
