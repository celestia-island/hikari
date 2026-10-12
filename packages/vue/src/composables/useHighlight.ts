// Lazy highlight.js integration.
//
// highlight.js bundles ~190 language grammars (≈946KB). Importing the
// top-level `highlight.js` pulls them ALL into the entry. Instead we ship the
// small `lib/core` runtime and register each grammar on demand: when a code
// block declares `lang=python`, only that language's chunk is fetched. Until
// the grammar resolves, the block renders as plain (uncolored) text — per
// the product requirement "没加载就是保持不变色".
//
// Reactivity: `highlight()` reads the module-level `version` ref, so any
// computed / render that calls it re-runs once the requested grammar
// finishes registering (the plaintext pass is then replaced by the colored
// one). No manual wiring needed at call sites.

import hljs from "highlight.js/lib/core";
import { ref } from "vue";

import { LANGUAGE_LOADERS } from "./highlightLanguages";

// Bumped each time a grammar registers; read inside highlight() so reactive
// callers re-run and re-color once the language they needed is available.
const version = ref(0);
const loaded = new Set<string>();
const loading = new Map<string, Promise<void>>();

// Languages used for auto-detection (code blocks with no language hint).
// Loaded once on the first auto-detect request so highlightAuto has something
// to work against; arbitrary other languages still load on explicit demand.
const AUTO_LANGS = ["javascript", "typescript", "python", "bash", "json", "xml", "css", "yaml", "markdown"];

// Common aliases → canonical highlight.js language ids.
const ALIASES: Record<string, string> = {
  ts: "typescript", tsx: "typescript", mts: "typescript", cts: "typescript",
  js: "javascript", jsx: "javascript", mjs: "javascript", cjs: "javascript",
  node: "javascript",
  py: "python", python3: "python", ipython: "python",
  sh: "bash", shell: "bash", zsh: "bash", fish: "bash",
  yml: "yaml",
  md: "markdown",
  rs: "rust", golang: "go",
  html: "xml", htm: "xml", svg: "xml", xhtml: "xml", vue: "xml",
  cs: "csharp", fs: "fsharp",
  kt: "kotlin", scala3: "scala",
  rb: "ruby", pl: "perl",
  objectivec: "objectivec", objc: "objectivec",
  ps1: "powershell",
  conf: "ini", cfg: "ini", properties: "properties",
  dockerfile: "dockerfile",
  sql: "sql", psql: "pgsql",
  gles: "glsl", hlsl: "glsl",
  plaintext: "plaintext", text: "plaintext", txt: "plaintext", log: "plaintext",
};

function normalize(lang: string): string {
  const l = lang.trim().toLowerCase().replace(/^\./, "");
  return ALIASES[l] ?? l;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function loadLanguage(rawLang: string): void {
  const name = normalize(rawLang);
  if (!name || loaded.has(name) || loading.has(name)) return;
  const loader = LANGUAGE_LOADERS[name];
  if (!loader) return; // unsupported language — stay plaintext
  const p = loader()
    .then((mod) => {
      hljs.registerLanguage(name, mod.default);
      loaded.add(name);
      version.value += 1;
    })
    .catch(() => {
      // Grammar failed to load — leave plaintext, no error UI.
    })
    .finally(() => {
      loading.delete(name);
    });
  loading.set(name, p);
}

function ensureAutoLangs(): void {
  for (const l of AUTO_LANGS) loadLanguage(l);
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

/**
 * Highlight `code` for the given language (or auto-detect when omitted).
 * Returns highlight.js HTML when the grammar is ready, otherwise an
 * HTML-escaped plaintext string and kicks off an async load that will
 * re-color the caller once registered (reactive callers re-run via the
 * internal `version` ref).
 */
export function highlight(code: string, lang?: string): string {
  // Establish reactivity for the calling effect/computed/render.
  void version.value;

  const name = lang ? normalize(lang) : "";
  if (name) {
    if (loaded.has(name)) {
      try {
        return hljs.highlight(code, { language: name }).value;
      } catch {
        return escapeHtml(code);
      }
    }
    loadLanguage(name);
    return escapeHtml(code);
  }
  // Auto-detect only meaningful once some grammars are registered.
  if (loaded.size > 0) {
    try {
      return hljs.highlightAuto(code).value;
    } catch {
      return escapeHtml(code);
    }
  }
  ensureAutoLangs();
  return escapeHtml(code);
}

export function useHighlight() {
  return { highlight, version };
}
