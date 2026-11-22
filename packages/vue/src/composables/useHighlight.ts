// wasm syntax highlighting — single source of truth, lazily loaded.
//
// The pest-driven Rust wasm component (hikari-wasm-highlight) handles
// all supported languages. The 2.9MB component is code-split by Vite
// via dynamic import() — it loads on the first highlight() call, not
// at bundle initialization. Until loaded, code renders as plain text
// (same UX as the old hljs lazy loading, but with a single Rust wasm
// module instead of 85 JS grammar chunks).
//
// Loading goes through the tairitsu host client's ASYNC door
// (`loadComponent`), not a bare `import()`: the client publishes the
// capability declaration before it evaluates the wrapper, which is an
// ordering a bare import cannot give you (ES imports hoist, so a statement
// in this file can never run earlier than the import it is meant to guard).
// `highlight()` stays synchronous — the load resolves in the background and
// `version` re-runs the render effects, so the visible contract is unchanged.
//
// Measured behaviour this file's comments rely on (each verified by probe, not
// assumed): the first call renders escaped plaintext and starts the load; the
// next call reaches the surface; a failed load leaves plaintext and the
// following call retries; and `version` goes 0 → 1 when the load resolves.

import { ref } from "vue";
import {
  HostClientError,
  loadComponent,
  type HostComponent,
} from "@celestia-island/tairitsu-host-client";
import type { HighlightResult } from "../wasm/highlight/hikari_wasm_highlight.js";

/**
 * The capability declaration this component runs under.
 *
 * Empty is not cosmetic: the highlight artifact has no glue interface (its
 * `interfaces/` are type declarations only) and gets WASI from its own direct
 * `@bytecodealliance/preview2-shim/*` imports. Declaring anything here makes
 * `buildImports` refuse the load before the wrapper is evaluated.
 */
const HIGHLIGHT_CAPABILITIES = { interfaces: [] as string[], wasiModules: [] as string[] } as const;

/** The wrapper's export name. jco names JS exports in the component's own
 *  identifier style; this one is a bare `highlight`, which is also the WIT func
 *  name — unlike scene3d, whose WIT `build-fleet-scene` becomes `buildFleetScene`.
 *  The host client's `pickExport` looks up an exact own property, so this must
 *  match the export exactly. */
const HIGHLIGHT_EXPORT = "highlight";

// Module-level state: the call surface (null until loaded). The surface is the
// host client's synchronous door onto the component — `surface.call("highlight",
// code, lang)` — so the hot path never touches the promise again.
let surface: HostComponent | null = null;
let loadPromise: Promise<HostComponent | null> | null = null;

// Reactive version — bumped when the component finishes loading so
// computed/render effects re-run and replace plain text with color.
const version = ref(0);

/**
 * Load the component on first use through the host client; cached thereafter.
 *
 * A failed load resolves `null` and clears `loadPromise`, which is the existing
 * behaviour: the next `highlight()` call retries, and until one succeeds every
 * call renders plaintext.
 */
function ensureLoaded(): Promise<HostComponent | null> {
  if (surface) return Promise.resolve(surface);
  if (!loadPromise) {
    loadPromise = loadComponent({
      wrapper: "hikari_wasm_highlight.js",
      capabilities: HIGHLIGHT_CAPABILITIES,
      // A RELATIVE SPECIFIER, not a URL built from `import.meta.url`.
      // The client's own fallback is `import(target)`, and a URL derived from
      // `import.meta.url` resolves to the bundler's origin (an `http://` dev
      // server) or to the wrong directory under Node — both of which the ESM
      // loader rejects ("Only URLs with a scheme in: file and data are
      // supported"; measured). A relative specifier is what the previous
      // `import()` used, keeps the artifact in its own chunk, and is resolved
      // by whichever loader is running.
      loaders: {
        // A STATIC-ANALYSABLE import: the specifier is a literal, so Vite still
        // emits the artifact as its own chunk, and the module graph stays
        // replaceable (a `vi.mock` of it still takes effect — without that,
        // `HkDiffViewer.epoch.test.tsx` silently loaded the real component and
        // failed; measured). A `/* @vite-ignore */` on this call broke the
        // second property while fixing nothing.
        importModule: () =>
          import(
            "../wasm/highlight/hikari_wasm_highlight.js"
          ) as Promise<Record<string, unknown>>,
      },
    })
      .then((loaded) => {
        surface = loaded;
        version.value += 1;
        return loaded;
      })
      .catch(() => {
        // Load failed — stay plaintext and let the next call retry.
        loadPromise = null;
        return null;
      });
  }
  return loadPromise;
}

/** Common aliases → canonical language ids. */
const ALIASES: Record<string, string> = {
  ts: "typescript", tsx: "typescript", mts: "typescript", cts: "typescript",
  js: "javascript", jsx: "javascript", mjs: "javascript", cjs: "javascript",
  py: "python", python3: "python", ipython: "python",
  sh: "bash", shell: "bash", zsh: "bash", fish: "bash",
  yml: "yaml",
  md: "markdown",
  rs: "rust", golang: "go",
  html: "xml", htm: "xml", svg: "xml", xhtml: "xml", vue: "xml",
  cs: "csharp",
  kt: "kotlin",
  rb: "ruby", pl: "perl",
  ps1: "powershell",
  plaintext: "plaintext", text: "plaintext", txt: "plaintext", log: "plaintext",
};

function normalize(lang: string): string {
  const l = lang.trim().toLowerCase().replace(/^\./, "");
  return ALIASES[l] ?? l;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Adapt the generated wasm record to this module's contract.
 *
 * `string` = highlighted HTML; `null` = "the wasm has no highlighting for
 * this input", which every caller renders as plaintext. The wasm omits
 * `html` (`{ html: undefined }`) whenever it cannot highlight — an
 * unregistered language, or a tokenizer failure on a known one — and an
 * empty string is a real answer, so this is `??` — not `||` — and never
 * the record itself. Split out from `highlight()` so the seam can be
 * pinned table-driven, without the lazy-loading mock in the way.
 */
export function adaptHighlightResult(result: HighlightResult): string | null {
  return result.html ?? null;
}

/** Highlight `code` in `lang`; plain text until the wasm module loads. */
export function highlight(code: string, lang?: string): string {
  // Establish reactivity — re-runs when the module finishes loading.
  void version.value;

  const name = lang ? normalize(lang) : "";
  if (name && surface) {
    const html = adaptHighlightResult(
      surface.call<HighlightResult>(HIGHLIGHT_EXPORT, code, name),
    );
    if (html !== null) return html;
  }
  // Trigger the lazy load (first call only); render plain text for now.
  if (!surface && !loadPromise) {
    void ensureLoaded();
  }
  return escapeHtml(code);
}

/** Whole filenames (lowercased) that carry no useful extension, or whose
 *  dialect is decided by the name: `Dockerfile.dev`, `CMakeLists.txt`. */
const PATH_FILENAME_LANG: Record<string, string> = {
  dockerfile: "dockerfile",
  makefile: "makefile",
  gnumakefile: "makefile",
  "cmakelists.txt": "cmake",
  jenkinsfile: "groovy",
  nginx: "nginx",
  "cargo.lock": "toml",
  ".env": "ini",
  ".gitignore": "ini",
  ".gitattributes": "ini",
  ".gitmodules": "ini",
  ".editorconfig": "ini",
  ".bashrc": "bash",
  ".zshrc": "bash",
  ".profile": "bash",
};

/** Extension (lowercased) → canonical highlight.js language id. Only ids
 *  that exist in LANGUAGE_LOADERS: anything else would render plaintext
 *  anyway, just with a misleading promise attached. */
const EXT_TABLE: Record<string, string> = {
  rs: "rust",
  ts: "typescript", tsx: "typescript", mts: "typescript", cts: "typescript",
  js: "javascript", jsx: "javascript", mjs: "javascript", cjs: "javascript",
  json: "json", jsonc: "json",
  py: "python", pyi: "python", pyw: "python",
  rb: "ruby",
  go: "go",
  java: "java",
  kt: "kotlin", kts: "kotlin",
  scala: "scala", sc: "scala",
  groovy: "groovy", gradle: "groovy",
  c: "c", h: "c",
  cpp: "cpp", cc: "cpp", cxx: "cpp", hpp: "cpp", hh: "cpp", hxx: "cpp",
  cs: "csharp",
  fs: "fsharp", fsx: "fsharp",
  php: "php",
  swift: "swift",
  m: "objectivec", mm: "objectivec",
  dart: "dart",
  ex: "elixir", exs: "elixir",
  erl: "erlang", hrl: "erlang",
  hs: "haskell", lhs: "haskell",
  elm: "elm",
  lua: "lua",
  pl: "perl", pm: "perl",
  r: "r",
  jl: "julia",
  nim: "nim",
  cr: "crystal",
  ml: "ocaml", mli: "ocaml", mll: "ocaml", mly: "ocaml",
  vb: "vbnet",
  pas: "delphi", dpr: "delphi",
  bas: "basic",
  f: "fortran", f90: "fortran", f95: "fortran", f03: "fortran", for: "fortran",
  coffee: "coffeescript",
  ls: "livescript",
  clj: "clojure", cljs: "clojure", cljc: "clojure", edn: "clojure",
  scm: "scheme", ss: "scheme", el: "lisp", lisp: "lisp",
  xml: "xml", html: "xml", htm: "xml", svg: "xml", vue: "xml", xhtml: "xml",
  cshtml: "xml", jsp: "xml", erb: "erb", ejs: "xml",
  hbs: "handlebars", handlebars: "handlebars",
  twig: "twig",
  haml: "haml",
  dust: "dust",
  css: "css", scss: "scss", less: "less",
  yml: "yaml", yaml: "yaml",
  toml: "toml",
  ini: "ini", cfg: "ini", conf: "ini", properties: "properties", env: "ini",
  md: "markdown", markdown: "markdown",
  graphql: "graphql", gql: "graphql",
  http: "http",
  sh: "bash", bash: "bash", zsh: "bash", shell: "bash", fish: "bash",
  ps1: "powershell", psm1: "powershell",
  bat: "dos", cmd: "dos",
  mk: "makefile",
  cmake: "cmake",
  dockerfile: "dockerfile",
  nginx: "nginx",
  awk: "awk",
  tcl: "tcl",
  vim: "vim",
  sql: "sql", psql: "pgsql",
  proto: "protobuf",
  thrift: "thrift",
  glsl: "glsl", vert: "glsl", frag: "glsl", geom: "glsl",
  wasm: "wasm",
  asm: "x86asm",
  v: "verilog", sv: "verilog",
  vhd: "vhdl", vhdl: "vhdl",
  tex: "latex", sty: "latex",
  diff: "diff", patch: "diff",
  txt: "plaintext", text: "plaintext", log: "plaintext",
};

/**
 * A file path → the canonical highlight.js language id for it, or "" when
 * nothing sensible is known (callers pass "" as "no language" and the
 * block renders plaintext or auto-detects). One mapping for every code
 * surface — diff panes, file browsers, markdown fences — so the same
 * path always highlights the same way; aliases are resolved by
 * `normalize()` at highlight time, so the table lists canonical ids.
 */
export function languageForPath(path: string): string {
  const name = path.split("/").pop()?.trim().toLowerCase() ?? "";
  if (!name) return "";
  // Extensionless build scripts: `Dockerfile`, `Jenkinsfile`, `Makefile`.
  const bare = PATH_FILENAME_LANG[name];
  if (bare) return bare;
  // `Dockerfile.dev` / `dockerfile.prod` — the dialect IS the stem.
  if (name.startsWith("dockerfile")) return "dockerfile";
  if (name.startsWith("makefile")) return "makefile";
  const ext = name.includes(".") ? name.split(".").pop()! : "";
  return EXT_TABLE[ext] ?? "";
}


export function useHighlight() {
  return { highlight, version };
}
