// @vitest-environment node
// AI-generated: developed with the DeepSeek Harness agent (model
// DeepSeek-Flash) and the ZCode agent (model GLM-5.3), directed and reviewed
// by langyo — SySL-1.0 §2.3 disclosure.

import { execFileSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { afterAll, describe, expect, it } from "vitest";

/**
 * The npm install-face regression test for `boot-recovery.mjs`.
 *
 * `bootRecoveryPlugin` runs inside a consumer's `vite.config.*`, loaded from
 * `node_modules`. Two failure modes have bitten hikari before (pinned by
 * `boot-chrome.install.test.ts`, reproduced here for this entry):
 *
 *   1. shipping the plugin as TypeScript → Node refuses type stripping under
 *      `node_modules` (`ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING`);
 *   2. a dynamic `import(...)` from a plugin hook → Vite's
 *      `configLoader: "runner"` has already torn the module runner down
 *      ("Vite module runner has been closed").
 *
 * Vitest transforms TS and keeps a module runner alive, so it can never catch
 * either one. This test copies the published layout into a fake
 * `node_modules` — `src/plugins` ONLY: boot recovery needs no `src/res`
 * asset, which is part of its install face — and imports it from a CHILD
 * `node` process, then builds a consumer through Vite with BOTH config loaders.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const VUE_DIR = resolve(HERE, "../..");
const PACKAGE_JSON = JSON.parse(
  readFileSync(join(VUE_DIR, "package.json"), "utf8"),
) as {
  name: string;
  version: string;
  type: string;
  exports: Record<string, { import: string; types?: string }>;
};

const INSTALL_SUBPATH = "./plugins/boot-recovery";

const temps: string[] = [];

afterAll(() => {
  for (const dir of temps.splice(0)) {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      /* a leftover temp dir must not fail the suite */
    }
  }
});

/** Lay out `node_modules/@celestia-island/hikari` exactly like `npm pack` does. */
function fakeInstall(): string {
  const root = mkdtempSync(join(tmpdir(), "hikari-boot-recovery-install-"));
  temps.push(root);

  const pkgDir = join(root, "node_modules", PACKAGE_JSON.name);
  mkdirSync(join(pkgDir, "src"), { recursive: true });
  // `files: ["src/"]` — the published tarball carries the sources it needs.
  // NOTE: no `src/res` copy on purpose — this plugin has no runtime asset.
  cpSync(join(VUE_DIR, "src/plugins"), join(pkgDir, "src/plugins"), {
    recursive: true,
  });
  writeFileSync(
    join(pkgDir, "package.json"),
    JSON.stringify(
      {
        name: PACKAGE_JSON.name,
        version: PACKAGE_JSON.version,
        private: false,
        type: PACKAGE_JSON.type,
        exports: PACKAGE_JSON.exports,
      },
      null,
      2,
    ),
  );
  writeFileSync(
    join(root, "package.json"),
    JSON.stringify(
      { name: "boot-recovery-install-probe", private: true, type: "module" },
      null,
      2,
    ),
  );
  return root;
}

/** Run any command in a child process, capturing everything. */
function runCommand(
  command: string,
  args: string[],
  cwd: string,
): { code: number; stdout: string; stderr: string } {
  try {
    const stdout = execFileSync(command, args, {
      cwd,
      encoding: "utf8",
      stdio: "pipe",
      timeout: 120_000,
      env: { ...process.env, NO_COLOR: "1" },
    });
    return { code: 0, stdout, stderr: "" };
  } catch (err) {
    const failure = err as { status?: number; stdout?: string; stderr?: string };
    return {
      code: failure.status ?? 1,
      stdout: failure.stdout ?? "",
      stderr: failure.stderr ?? String(err),
    };
  }
}

/** Run one ESM probe in a child `node` (no bundler, no transforms). */
function runProbe(
  root: string,
  source: string,
): { code: number; stdout: string; stderr: string } {
  try {
    const stdout = execFileSync(
      process.execPath,
      ["--input-type=module", "-e", source],
      { cwd: root, encoding: "utf8", stdio: "pipe", timeout: 30_000 },
    );
    return { code: 0, stdout, stderr: "" };
  } catch (err) {
    const failure = err as { status?: number; stdout?: string; stderr?: string };
    return {
      code: failure.status ?? 1,
      stdout: failure.stdout ?? "",
      stderr: failure.stderr ?? String(err),
    };
  }
}

describe("published install face (boot recovery)", () => {
  it("declares a resolvable ESM subpath with types", () => {
    const entry = PACKAGE_JSON.exports[INSTALL_SUBPATH];
    expect(entry, INSTALL_SUBPATH + " must be exported").toBeTruthy();
    expect(entry.import).toBe("./src/plugins/boot-recovery.mjs");
    expect(entry.types).toBe("./src/plugins/boot-recovery.d.mts");
    expect(existsSync(join(VUE_DIR, entry.import))).toBe(true);
    expect(existsSync(join(VUE_DIR, entry.types!))).toBe(true);
  });

  it("imports and runs from node_modules in a plain child node process", { timeout: 60_000 }, () => {
    const root = fakeInstall();
    const probe = [
      "// Plain Node: no type stripping of node_modules, no Vite module runner.",
      'const mod = await import("' + PACKAGE_JSON.name + '/plugins/boot-recovery");',
      "const script = mod.bootRecoveryScript();",
      'if (!script.includes("http://tauri.localhost")) {',
      '  console.error("NO_SCRIPT");',
      "  process.exit(3);",
      "}",
      'if (!script.startsWith("(function () {")) {',
      '  console.error("NOT_AN_IIFE");',
      "  process.exit(4);",
      "}",
      "const plugin = mod.bootRecoveryPlugin();",
      'if (!plugin || plugin.name !== "hikari-boot-recovery") {',
      '  console.error("NO_FACTORY");',
      "  process.exit(5);",
      "}",
      'const tags = plugin.transformIndexHtml("", { filename: "/app/index.html" });',
      "if (",
      "  !Array.isArray(tags) ||",
      "  tags.length !== 1 ||",
      '  tags[0].tag !== "script" ||',
      '  tags[0].injectTo !== "head" ||',
      '  tags[0].attrs["data-hk-boot-recovery"] !== "" ||',
      "  tags[0].children !== script",
      ") {",
      '  console.error("NO_TAG");',
      "  process.exit(6);",
      "}",
      "const healOnly = mod.bootRecoveryScript({ loadingScreen: false });",
      'if (healOnly.includes("setTimeout(")) {',
      '  console.error("HEAL_ONLY_BROKEN");',
      "  process.exit(7);",
      "}",
      'console.log("INSTALL_OK " + script.length);',
    ].join("\n");
    const result = runProbe(root, probe);

    expect(
      result.stderr,
      "child node stderr (type-strip / runner failures show up here):\n" +
        result.stderr,
    ).not.toMatch(
      /ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING|module runner has been closed|Cannot find module/,
    );
    expect(result.code, "child exited " + result.code + ": " + result.stderr).toBe(0);
    expect(result.stdout).toContain("INSTALL_OK");
  });

  it("builds a consumer through vite with BOTH config loaders", { timeout: 120_000 }, () => {
    // The R2 scenario: a consumer whose vite.config imports the plugin from its
    // own node_modules. The DEFAULT loader fails on a TypeScript entry; the
    // `runner` loader additionally fails on a dynamic import from a hook. Both
    // loader modes are exercised so a future Vite bump gets caught.
    const root = fakeInstall();
    writeFileSync(
      join(root, "index.html"),
      '<!doctype html><html><head><meta charset="UTF-8"><title>App</title></head>' +
        '<body><div id="loading-screen"><span>Loading...</span></div>' +
        '<div id="app"></div><script type="module" src="/main.js"></script></body></html>',
    );
    writeFileSync(join(root, "main.js"), 'document.getElementById("app");');
    writeFileSync(
      join(root, "vite.config.mjs"),
      [
        'import { bootRecoveryPlugin } from "' +
          PACKAGE_JSON.name +
          '/plugins/boot-recovery";',
        "export default {",
        "  plugins: [bootRecoveryPlugin()],",
        '  build: { outDir: "dist", emptyOutDir: true },',
        "};",
      ].join("\n"),
    );

    // Resolve the repo's own vite binary: the fake install has no toolchain,
    // and the point is what a consumer's build does with the published files.
    const viteEntry = createRequire(import.meta.url).resolve("vite");
    const viteBin = resolve(dirname(viteEntry), "../../bin/vite.js");
    for (const loader of ["default", "runner"]) {
      const args = [viteBin, "build"];
      if (loader === "runner") args.push("--configLoader", "runner");
      const result = runCommand(process.execPath, args, root);
      expect(
        result.code,
        "vite build (" + loader + " config loader) failed:\n" +
          (result.stderr || result.stdout),
      ).toBe(0);
      const html = readFileSync(join(root, "dist", "index.html"), "utf8");
      expect(html).toContain("data-hk-boot-recovery");
      expect(html).toContain("(function () {");
      // Inline, not an external asset the install would have had to ship.
      expect(html).not.toMatch(/<script[^>]*data-hk-boot-recovery[^>]*\ssrc=/);
    }
  });

  it("keeps the runtime module free of dynamic imports and TypeScript", () => {
    // Enforce the properties the failure modes above come from: a refactor back
    // to a dynamic import or a .ts implementation is caught without a full
    // build. Comments mention the banned forms (they explain why), so only
    // real code is checked.
    const source = readFileSync(
      join(VUE_DIR, "src/plugins/boot-recovery.mjs"),
      "utf8",
    );
    const code = source
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    expect(code).not.toMatch(/\bimport\s*\(/);
    expect(code).not.toMatch(/\bfrom\s+["'][^"']*\.ts["']/);
    // Static imports only — and only the one Node builtin it needs.
    expect(code).toMatch(/from "node:path"/);
    // No runtime asset: the plugin is pure string generation.
    expect(code).not.toMatch(/res\//);
    expect(code).not.toContain("readFileSync");
  });
});
