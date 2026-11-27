#!/usr/bin/env node
// AI-generated: developed with the DeepSeek Harness agent (model
// DeepSeek-V4.1-Flash) directed and reviewed by langyo — SySL-1.0 §2.3
// disclosure.
//
// Build the standalone error landing page:
//
//   src/errorLandingStandalone/{index.html,main.ts,boot.tsx}
//     ->  src/errorLandingStandalone/error-landing.html   (committed)
//
// WHY A COMMITTED ARTIFACT. This page exists for servers that have no SPA
// shell to serve (the error-landing wave brief, SPEC2 §4 B1): plana's
// `ErrorLanding::standalone()` vendors the committed file verbatim and
// hosts serve it raw, the way `res/*.js` reaches sibling repos today. A
// gitignored output would be a missing asset on any checkout that did not
// run node first, and the vendored copy would silently drift from its
// generator. The file is therefore committed, and the drift test
// `src/errorReporting/errorLandingStandalone.test.ts` re-runs THIS module
// in memory and fails when the committed bytes no longer match — a stale
// artifact is red, and so is a hand edit of the artifact.
//
// USAGE (from packages/vue):
//
//   pnpm run gen:error-landing
//
// Determinism contract: same tree, same bytes. The provenance marker's
// sha comes from the environment (`HIKARI_ERROR_LANDING_SHA8`, full hashes
// are trimmed to 8 characters) and defaults to the `<dev>` placeholder —
// the committed artifact always carries the placeholder so the byte
// comparison never depends on HEAD. A release lane may stamp a real sha
// by exporting the variable before regenerating.
//
// What the build reuses instead of copying: the island reader
// (`src/errorReporting/serverLanding.ts`), the takeover
// (`src/errorReporting/HkErrorReportingOverlay.tsx`), the family card
// (`src/components/HkErrorLanding.tsx`) and the i18n context — the drift
// test pins all three files to the recorded module graph, so swapping any
// of them for a copy is red.
//
// The i18n context normally eager-imports EVERY locale JSON (592 KB). This
// page needs only the copy its bundled components actually read (the
// errors / errorBoundary / toast / jsonTree / clipboard namespaces, 28
// keys), so a transform narrows `import.meta.glob` in context.ts to that
// subset at build time — the module's own merge/fallback logic is untouched
// and runs on the narrowed table. Two loud guards protect the narrowing,
// because a silent miss would render English copy on every non-English
// locale: (1) if the glob call moves or changes shape, the transform
// throws instead of shipping an empty table; (2) after the build, every
// `hikari::<ns>.` literal found in the bundled sources must belong to
// LOCALE_KEY_PREFIXES — a component gaining a new namespace without
// extending the subset fails the build, naming it.

import { readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

import vue from "@vitejs/plugin-vue";
import vueJsx from "@vitejs/plugin-vue-jsx";
import ts from "typescript";
import { build } from "vite";

const HERE = dirname(fileURLToPath(import.meta.url));
/** packages/vue */
const VUE_DIR = resolve(HERE, "..");
const ENTRY_DIR = resolve(VUE_DIR, "src/errorLandingStandalone");
const SHELL_HTML = resolve(ENTRY_DIR, "index.html");
const OUTPUT_PATH = resolve(ENTRY_DIR, "error-landing.html");
const CONTEXT_TS = resolve(VUE_DIR, "src/i18n/context.ts");
const LOCALES_DIR = resolve(VUE_DIR, "src/i18n/locales");

// The artifact must be byte-identical no matter who invokes the builder —
// and the drift test invokes it from vitest workers, whose NODE_ENV=test
// leaks into the child and makes the jsx/vue plugins emit dev-mode code
// (different bytes for the same tree). The artifact generator is a
// production build by definition; pin the environment before vite loads.
process.env.NODE_ENV = "production";

/** The committed artifact (the vendoring source for hosts). */
export const ERROR_LANDING_OUTPUT = OUTPUT_PATH;

/** Island contract version carried by the provenance marker. Kept in step
 *  with `SERVER_ERROR_LANDING_VERSION` (serverLanding.ts) by a drift-test
 *  assertion that pins both to 1. */
const ISLAND_CONTRACT_VERSION = 1;

/** Placeholder written into the committed artifact's provenance marker. */
export const DEV_SHA_PLACEHOLDER = "<dev>";

/**
 * The i18n namespaces the page's bundled components read. The drift test
 * cross-checks this list against the `hikari::<ns>.` literals found in the
 * bundled sources, so a newly added namespace cannot silently miss the
 * subset and fall back to English on every non-English locale.
 */
export const LOCALE_KEY_PREFIXES = Object.freeze([
  "hikari::errors.",
  "hikari::errorBoundary.",
  "hikari::toast.",
  "hikari::jsonTree.",
  "hikari::clipboard.",
]);

/** Namespaces covered by {@link LOCALE_KEY_PREFIXES} (`errors`, `toast`, …). */
const ALLOWED_LOCALE_NAMESPACES = new Set(
  LOCALE_KEY_PREFIXES.map((prefix) => prefix.slice("hikari::".length, -1)),
);

/**
 * Quoted `hikari::<ns>.` literals — the shape every `t("hikari::…")`
 * call has. Applied to STRING-LITERAL text only (see {@link
 * findLocaleNamespaces}), never to raw source: a doc comment that merely
 * quotes an example key must read as nothing.
 */
const LOCALE_NS_RE = /hikari::([A-Za-z0-9_-]+)\./g;

/**
 * Every locale namespace the STRING LITERALS of `code` read
 * (`t("hikari::errors.x")` → `errors`). The literals come from a
 * TypeScript AST walk, so a doc comment quoting an example key
 * (`context.ts` carries one for the flat-key style) reads as nothing —
 * a raw regex over the file would false-positive on exactly that.
 * Pure, so the drift test can drive the same scan the build runs.
 */
export function findLocaleNamespaces(code) {
  const found = new Set();
  const source = ts.createSourceFile("ns-scan.ts", code, ts.ScriptTarget.ES2020, true, ts.ScriptKind.TS);
  const visit = (node) => {
    if (
      ts.isStringLiteral(node) ||
      ts.isNoSubstitutionTemplateLiteral(node)
    ) {
      for (const match of node.text.matchAll(LOCALE_NS_RE)) found.add(match[1]);
    } else if (ts.isTemplateExpression(node)) {
      for (const part of [node.head, ...node.templateSpans.map((span) => span.literal)]) {
        for (const match of part.text.matchAll(LOCALE_NS_RE)) found.add(match[1]);
      }
    }
    node.forEachChild(visit);
  };
  visit(source);
  return [...found];
}

/** The family modules the built page MUST be built from (import identity). */
export const IDENTITY_MODULES = Object.freeze({
  islandReader: resolve(VUE_DIR, "src/errorReporting/serverLanding.ts"),
  takeover: resolve(VUE_DIR, "src/errorReporting/HkErrorReportingOverlay.tsx"),
  card: resolve(VUE_DIR, "src/components/HkErrorLanding.tsx"),
});

/** Flatten one locale JSON the same way `buildLocaleMessages` does:
 *  string leaves at the top level, nested domains Object.assigned in. */
function flattenDomain(domain) {
  const flat = {};
  for (const [key, value] of Object.entries(domain)) {
    if (typeof value === "string") flat[key] = value;
    else if (value !== null && typeof value === "object") Object.assign(flat, value);
  }
  return flat;
}

/**
 * The narrowed locale module table for `import.meta.glob` in context.ts:
 * `{ "./locales/<locale>/<file>.json": { default: { key: string } } }`,
 * covering every locale directory and keeping only the keys the page's
 * components read. Sorted at every level — the emitted bytes must not
 * depend on readdir order.
 */
export function buildLocaleSubset() {
  const modules = {};
  const locales = readdirSync(LOCALES_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  for (const locale of locales) {
    const files = readdirSync(resolve(LOCALES_DIR, locale))
      .filter((name) => name.endsWith(".json"))
      .sort();
    for (const file of files) {
      const flat = flattenDomain(JSON.parse(readFileSync(resolve(LOCALES_DIR, locale, file), "utf8")));
      const subset = {};
      for (const key of Object.keys(flat).sort()) {
        if (LOCALE_KEY_PREFIXES.some((prefix) => key.startsWith(prefix))) {
          subset[key] = flat[key];
        }
      }
      modules[`./locales/${locale}/${file}`] = { default: subset };
    }
  }
  return { modules, locales };
}

/**
 * The vite plugin that swaps the full-catalog glob in context.ts for the
 * subset table. A shape change in the glob call throws — a silent no-op
 * would ship the page with empty message tables (every string falling
 * back to the English literal), which is exactly the failure the 2026-09-08
 * flat-keys incident taught this package to refuse.
 */
function localeSubsetPlugin() {
  const { modules } = buildLocaleSubset();
  const GLOB_RE =
    /import\.meta\.glob\s*<[^>]*>\s*\(\s*(['"])\.\/locales\/\*\*\/\*\.json\1\s*,\s*\{[^}]*\}\s*,?\s*\)/s;
  return {
    name: "hk-error-landing-locale-subset",
    enforce: "pre",
    transform(code, id) {
      if (id.split("?")[0] !== CONTEXT_TS) return null;
      const matches = code.match(new RegExp(GLOB_RE.source, "gs")) ?? [];
      if (matches.length !== 1) {
        throw new Error(
          "error-landing build: expected exactly one import.meta.glob of " +
            "'./locales/**/*.json' in src/i18n/context.ts, found " +
            `${matches.length} — the locale-subset transform must be ` +
            "updated before this page can build",
        );
      }
      return code.replace(GLOB_RE, JSON.stringify(modules));
    },
  };
}

/**
 * Record the import EDGES (importer -> resolved id) that feed the bundle,
 * so the drift test can pin import identity where a copy would show: the
 * entry's own imports. A file merely being IN the graph is not enough —
 * the card reaches the bundle transitively through the takeover, so a
 * boot.tsx that swaps its card import for a hand-rolled copy would keep
 * the real file "in the graph" while the page renders the copy. Edges
 * are recorded as `${importer} -> ${resolved}` strings.
 *
 * The same pass collects every locale namespace the bundled sources READ
 * (quoted `hikari::<ns>.` literals); after the build, {@link
 * buildErrorLandingHtml} refuses the artifact when one falls outside
 * {@link LOCALE_KEY_PREFIXES} — that is the cross-check keeping the i18n
 * subset honest: a component gaining a new namespace without extending
 * the subset would render English copy on every other locale, silently.
 */
function importIdentityPlugin(recorded, nsReads) {
  return {
    name: "hk-error-landing-import-identity",
    enforce: "pre",
    async resolveId(source, importer) {
      if (importer && !importer.includes("node_modules")) {
        const resolved = await this.resolve(source, importer, { skipSelf: true });
        if (resolved && !resolved.external) {
          recorded.add(`${importer.split("?")[0]} -> ${resolved.id.split("?")[0]}`);
        }
      }
      return null;
    },
    transform(code, id) {
      const plain = id.split("?")[0];
      if (plain.includes("node_modules") || /\.(scss|css)\b/.test(plain)) return null;
      for (const ns of findLocaleNamespaces(code)) {
        (nsReads[ns] ??= new Set()).add(plain);
      }
      return null;
    },
  };
}

/** `<meta name="hk-error-landing" content="v1 <version> <sha>">`. */
export function provenanceMeta(version, sha) {
  return `<meta name="hk-error-landing" content="v${ISLAND_CONTRACT_VERSION} ${version} ${sha}">`;
}

function readPackageVersion() {
  return JSON.parse(readFileSync(resolve(VUE_DIR, "package.json"), "utf8")).version;
}

function assertSelfContained(html) {
  // Everything a browser fetches must be inside this one file: strip the
  // inline script/style bodies (bundled code may legitimately mention
  // URLs as DATA — the island serializer's escapes, error strings) and
  // refuse any load-bearing reference in the remaining markup.
  const markup = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, "<script></script>")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/g, "<style></style>");
  const offenses = [];
  if (/\b(src|href)\s*=/i.test(markup)) offenses.push("a src/href attribute");
  if (/<link\b/i.test(markup)) offenses.push("a <link> element");
  if (/https?:\/\//.test(markup)) offenses.push("an absolute http(s) URL");
  if (/url\s*\(/i.test(markup)) offenses.push("a css url() reference");
  if (offenses.length > 0) {
    throw new Error(
      "error-landing build: the artifact is not self-contained — " +
        offenses.join(", ") +
        " survives outside the inline blocks",
    );
  }
}

/**
 * Build the artifact bytes in memory. Pure with respect to the repo tree
 * (nothing is written); the CLI entry below writes and the drift test
 * compares. Returns the html, its gzipped size and the recorded module
 * graph for import-identity assertions.
 *
 * @param {{ version?: string, sha?: string, nsProbe?: { name: string, source: string } }} [options]
 *   `nsProbe` injects one extra virtual module into the graph — the
 *   red-proof channel of the drift test, which needs to run a build that
 *   FAILS on an out-of-subset namespace without touching tracked files.
 *   The probe module passes through the same namespace scan as every
 *   real bundled source; production callers pass nothing.
 * @returns {Promise<{ html: string, gzipBytes: number, recorded: string[] }>}
 */
export async function buildErrorLandingHtml(options = {}) {
  const version = options.version ?? readPackageVersion();
  const rawSha =
    options.sha ?? process.env.HIKARI_ERROR_LANDING_SHA8 ?? DEV_SHA_PLACEHOLDER;
  const sha = rawSha === DEV_SHA_PLACEHOLDER ? rawSha : rawSha.slice(0, 8);
  const recorded = new Set();
  const nsReads = {};

  const plugins = [localeSubsetPlugin(), importIdentityPlugin(recorded, nsReads), vue(), vueJsx()];
  if (options.nsProbe) {
    const probe = options.nsProbe;
    plugins.push({
      name: "hk-error-landing-ns-probe",
      enforce: "pre",
      resolveId(source) {
        return source === probe.name ? `\0hk-error-landing-ns-probe` : null;
      },
      load(id) {
        return id === "\0hk-error-landing-ns-probe" ? probe.source : null;
      },
      // The probe must be REACHABLE or rolldown fetches it — and the
      // scan — never. A side-effect import off the entry does that.
      transform(code, id) {
        if (id.split("?")[0] === resolve(ENTRY_DIR, "main.ts")) {
          return `${code}\nimport "${probe.name}";\n`;
        }
        return null;
      },
    });
  }

  const result = await build({
    root: VUE_DIR,
    mode: "production",
    base: "./",
    configFile: false,
    logLevel: "warn",
    publicDir: false,
    plugins,
    // Runtime-only Vue: no component in this graph carries a template
    // (every family piece is a tsx/ts render function), so the template
    // compiler would be dead weight in a page measured in kilobytes.
    resolve: {
      alias: [
        // The barrel is the whole library (every component + wasm surface);
        // bundled components importing from it would pull all of it in.
        // The shim re-exports the same names from the same real modules.
        { find: /^@celestia-island\/hikari$/, replacement: resolve(ENTRY_DIR, "barrelShim.ts") },
        { find: /^vue$/, replacement: resolve(VUE_DIR, "node_modules/vue/dist/vue.runtime.esm-bundler.js") },
      ],
    },
    define: {
      "process.env.NODE_ENV": JSON.stringify("production"),
      __VUE_OPTIONS_API__: "false",
      __VUE_PROD_DEVTOOLS__: "false",
      __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: "false",
    },
    oxc: false,
    build: {
      write: false,
      outDir: resolve(VUE_DIR, "node_modules/.tmp/error-landing-build"),
      emptyOutDir: true,
      cssCodeSplit: false,
      minify: "oxc",
      target: "es2020",
      cssTarget: "es2020",
      modulePreload: { polyfill: false },
      rollupOptions: {
        input: SHELL_HTML,
        output: {
          entryFileNames: "assets/[name].js",
          chunkFileNames: "assets/[name].js",
          assetFileNames: "assets/[name].[ext]",
        },
      },
    },
  });

  const output = (Array.isArray(result) ? result[0] : result).output;

  // The scan must have collected SOMETHING before the cross-check below
  // may judge it: the bundled graph genuinely reads hikari::<ns>.
  // literals (every family component resolves its labels through them).
  // An empty map means the scan pass stopped running — the cross-check
  // would then pass vacuously on an unseen graph — so fail loudly.
  if (Object.keys(nsReads).length === 0) {
    throw new Error(
      "error-landing build: the locale-namespace scan collected nothing from the " +
        "bundled sources — the scan pass did not run; refusing a vacuous cross-check",
    );
  }

  // The i18n subset cross-check: every namespace the bundled sources read
  // must be covered by LOCALE_KEY_PREFIXES, or the subset would carry no
  // copy for it and every non-English locale would fall back to the
  // English literal at runtime. Fail naming the namespace and the files.
  const unknownNamespaces = Object.keys(nsReads).filter(
    (ns) => !ALLOWED_LOCALE_NAMESPACES.has(ns),
  );
  if (unknownNamespaces.length > 0) {
    const detail = unknownNamespaces
      .map((ns) => `${ns} (read by ${[...nsReads[ns]].map((f) => f.replace(VUE_DIR + "/", "")).join(", ")})`)
      .join("; ");
    throw new Error(
      "error-landing build: bundled sources read locale namespaces outside the " +
        `narrowed subset — extend LOCALE_KEY_PREFIXES in scripts/build-error-landing.mjs ` +
        `so their copy ships: ${detail}`,
    );
  }

  const chunks = output.filter((item) => item.type === "chunk");
  const styles = output.filter((item) => item.type === "asset" && item.fileName.endsWith(".css"));
  const htmlAsset = output.find((item) => item.type === "asset" && item.fileName.endsWith(".html"));
  const otherAssets = output.filter(
    (item) => item.type === "asset" && item !== htmlAsset && !styles.includes(item),
  );
  if (!htmlAsset || chunks.length !== 1 || styles.length !== 1 || otherAssets.length !== 0) {
    throw new Error(
      "error-landing build: expected one html + one js chunk + one css sheet and " +
        `no other assets, got html=${Boolean(htmlAsset)} chunks=${chunks.length} ` +
        `css=${styles.length} other=${otherAssets.length}`,
    );
  }

  let html = htmlAsset.source;
  const js = chunks[0].code;
  const css = styles[0].source;

  // Inline payloads must not be able to terminate their host element: a
  // literal `</script` inside the bundle would cut the module short.
  if (/<\/script/i.test(js)) throw new Error("error-landing build: bundle contains </script");
  if (/<\/style/i.test(css)) throw new Error("error-landing build: stylesheet contains </style>");

  const scriptRe = /<script\b[^>]*\bsrc=[^>]*><\/script>/;
  const styleRe = /<link\b[^>]*rel="stylesheet"[^>]*>/;
  if (!scriptRe.test(html) || !styleRe.test(html)) {
    throw new Error(
      "error-landing build: shell is missing the vite-injected script/link tags — " +
        "the inliner found nothing to replace",
    );
  }
  html = html.replace(scriptRe, () => `<script type="module">\n${js}\n</script>`);
  html = html.replace(styleRe, () => `<style>\n${css}\n</style>`);

  // Provenance, right after the charset declaration so a vendored copy is
  // identifiable from its first screenful.
  const meta = provenanceMeta(version, sha);
  if (!html.includes("<head>")) throw new Error("error-landing build: shell has no <head>");
  html = html.replace("<head>", `<head>\n    ${meta}`);

  // Contract floor: the built page reads the island by the family id.
  if (!js.includes("hk-server-error")) {
    throw new Error("error-landing build: the island reader id is missing from the bundle");
  }
  if (!html.includes(meta)) {
    throw new Error("error-landing build: provenance meta was not injected");
  }
  assertSelfContained(html);
  if (html.includes("/assets/")) {
    throw new Error("error-landing build: an asset reference survived the inlining");
  }

  return {
    html,
    gzipBytes: gzipSync(Buffer.from(html, "utf8"), { level: 9 }).length,
    recorded: [...recorded].sort(),
  };
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  import.meta.url === new URL(`file://${resolve(process.argv[1])}`).href;

if (invokedDirectly) {
  // `HIKARI_ERROR_LANDING_NS_PROBE` (JSON `{name, source}`) injects one
  // virtual module into the graph — the red-proof channel of the drift
  // test's out-of-subset namespace case, which needs a build that fails
  // without touching tracked files. Absent in every real run.
  const probeEnv = process.env.HIKARI_ERROR_LANDING_NS_PROBE;
  const nsProbe = probeEnv ? JSON.parse(probeEnv) : undefined;
  // `--json`: print the build result (html + size + module graph) to
  // stdout without writing anything — the machine-readable channel the
  // drift test consumes. The build runs in this fresh process because
  // vite's sass importer breaks inside vitest worker threads (async dart
  // bindings lose their URL context there); a child process is immune.
  if (process.argv.includes("--json")) {
    const result = await buildErrorLandingHtml({ nsProbe });
    process.stdout.write(JSON.stringify(result));
  } else {
    const { html, gzipBytes } = await buildErrorLandingHtml({ nsProbe });
    const { writeFileSync } = await import("node:fs");
    writeFileSync(OUTPUT_PATH, html, "utf8");
    const kib = (bytes) => `${(bytes / 1024).toFixed(1)} KiB`;
    process.stdout.write(
      `wrote ${OUTPUT_PATH} (${html.length} bytes, gzip ${kib(gzipBytes)})\n`,
    );
  }
}
