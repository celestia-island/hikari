// @vitest-environment node
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { afterAll, describe, expect, it } from "vitest";

/**
 * The npm install-face regression test — THE most important guard in this PR.
 *
 * `bootChromePlugin` runs inside a consumer's `vite.config.*`, loaded from
 * `node_modules`. Two ways that has broken in the past, both reproduced with
 * the packed package before this test existed:
 *
 *   1. shipping the plugin as TypeScript → Node refuses to strip types under
 *      `node_modules` (`ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING`), so the
 *      config cannot even be loaded;
 *   2. a dynamic `import("node:fs")` inside plugin hooks → under Vite's
 *      `configLoader: "runner"` the module runner is already closed when a hook
 *      runs, and the build dies with "Vite module runner has been closed".
 *
 * Vitest transforms TS and keeps a module runner alive, so it can never catch
 * either one. This test therefore copies the published layout into a fake
 * `node_modules`, then imports it from a CHILD `node` process — no bundler, no
 * type stripping, nothing kept alive for us.
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

const INSTALL_SUBPATH = "./plugins/boot-chrome";

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
  const root = mkdtempSync(join(tmpdir(), "hikari-install-face-"));
  temps.push(root);

  const pkgDir = join(root, "node_modules", PACKAGE_JSON.name);
  mkdirSync(join(pkgDir, "src"), { recursive: true });
  // `files: ["src/"]` — the published tarball carries the sources it needs.
  cpSync(join(VUE_DIR, "src/plugins"), join(pkgDir, "src/plugins"), {
    recursive: true,
  });
  cpSync(join(VUE_DIR, "src/res"), join(pkgDir, "src/res"), { recursive: true });
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
      { name: "boot-chrome-install-probe", private: true, type: "module" },
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

describe("published install face (S1-1)", () => {
  it("declares a resolvable ESM subpath with types", () => {
    const entry = PACKAGE_JSON.exports[INSTALL_SUBPATH];
    expect(entry, `${INSTALL_SUBPATH} must be exported`).toBeTruthy();
    expect(entry.import).toBe("./src/plugins/boot-chrome.mjs");
    expect(entry.types).toBe("./src/plugins/boot-chrome.d.mts");
    expect(existsSync(join(VUE_DIR, entry.import))).toBe(true);
    expect(existsSync(join(VUE_DIR, entry.types!))).toBe(true);
  });

  it("imports and runs from node_modules in a plain child node process", { timeout: 60_000 }, () => {
    const root = fakeInstall();
    const result = runProbe(
      root,
      `
        // Plain Node: no type stripping of node_modules, no Vite module runner.
        const mod = await import("${PACKAGE_JSON.name}/plugins/boot-chrome");
        const plugin = mod.bootChromePlugin({ title: "Install Face" });
        if (!plugin || plugin.name !== "hikari-boot-chrome") {
          console.error("NO_FACTORY");
          process.exit(3);
        }
        const tags = plugin.transformIndexHtml("", { filename: "/app/index.html" });
        if (!Array.isArray(tags) || tags.length !== 1) {
          console.error("NO_TAG");
          process.exit(4);
        }
        if (tags[0].attrs["data-hk-title"] !== "Install Face") {
          console.error("NO_ATTRS");
          process.exit(5);
        }
        const emitted = [];
        plugin.buildStart.call({});
        plugin.generateBundle.call(
          { emitFile: (file) => emitted.push(file) },
          {},
          {},
        );
        const asset = emitted[0];
        if (
          emitted.length !== 1 ||
          asset.fileName !== "hk-boot-chrome.js" ||
          !String(asset.source).includes("__TAURI_INTERNALS__")
        ) {
          console.error("NO_ASSET");
          process.exit(6);
        }
        console.log("INSTALL_OK " + asset.source.length);
      `,
    );

    expect(
      result.stderr,
      `child node stderr (type-strip / runner failures show up here):\n${result.stderr}`,
    ).not.toMatch(/ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING|module runner has been closed|Cannot find module/);
    expect(result.code, `child exited ${result.code}: ${result.stderr}`).toBe(0);
    expect(result.stdout).toContain("INSTALL_OK");
  });

  it("builds a consumer through vite with BOTH config loaders", { timeout: 120_000 }, () => {
    // The R2 scenario: a consumer whose vite.config imports the plugin from its
    // own node_modules. The DEFAULT loader fails on a TypeScript entry (Node
    // refuses type stripping under node_modules), which is what this test
    // pins. The `runner` loader additionally fails on a lazy
    // `import("node:fs")` ("Vite module runner has been closed") — observed on
    // Vite 8.3.2; the repo's 8.2.0 keeps the runner alive long enough that the
    // mutated build still passes, so the dynamic-import ban has its own static
    // assertion below (`keeps the runtime module free of dynamic imports`).
    // Both loader modes are exercised here so a future Vite bump gets caught.
    const root = fakeInstall();
    writeFileSync(
      join(root, "index.html"),
      '<!doctype html><html><body><div id="app"></div><script type="module" src="/main.js"></script></body></html>',
    );
    writeFileSync(join(root, "main.js"), 'document.getElementById("app");');
    writeFileSync(
      join(root, "vite.config.mjs"),
      [
        'import { bootChromePlugin } from "' +
          PACKAGE_JSON.name +
          '/plugins/boot-chrome";',
        "export default {",
        '  plugins: [bootChromePlugin({ title: "Install Face" })],',
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
        `vite build (${loader} config loader) failed:\n${result.stderr || result.stdout}`,
      ).toBe(0);
      const html = readFileSync(join(root, "dist", "index.html"), "utf8");
      expect(html).toContain('src="/hk-boot-chrome.js"');
      expect(existsSync(join(root, "dist", "hk-boot-chrome.js"))).toBe(true);
    }
  });

  it("keeps the runtime module free of dynamic imports and TypeScript", () => {
    // Enforce the two properties the failure modes above come from, so a
    // refactor back to `import("node:fs")` or a .ts implementation is caught
    // without a full consumer build.
    const source = readFileSync(
      join(VUE_DIR, "src/plugins/boot-chrome.mjs"),
      "utf8",
    );
    // Comments mention the banned forms (they explain why they are banned), so
    // only real code is checked.
    const code = source
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    expect(code).not.toMatch(/\bimport\s*\(/);
    expect(code).not.toMatch(/\bfrom\s+["'][^"']*\.ts["']/);
    expect(code).toMatch(/from "node:fs"/);
    expect(code).toMatch(/from "node:url"/);
  });
});
