// wasm syntax highlighting — single source of truth, lazily loaded.
//
// The pest-driven Rust wasm component (hikari-wasm-highlight) handles
// all supported languages. The 2.9MB component is code-split by Vite
// via dynamic import() — it loads on the first highlight() call, not
// at bundle initialization. Until loaded, code renders as plain text
// (same UX as the old hljs lazy loading, but with a single Rust wasm
// module instead of 85 JS grammar chunks).

import { ref } from "vue";

type WasmHighlightFn = (code: string, language: string) => string | null;

// Module-level state: the loaded wasm function (null until loaded).
let wasmFn: WasmHighlightFn | null = null;
let loadPromise: Promise<WasmHighlightFn> | null = null;

// Reactive version — bumped when the module finishes loading so
// computed/render effects re-run and replace plain text with color.
const version = ref(0);

/** Load the wasm module on first use; cached thereafter. */
function ensureLoaded(): Promise<WasmHighlightFn> {
  if (wasmFn) return Promise.resolve(wasmFn);
  if (!loadPromise) {
    loadPromise = import("../wasm/highlight/hikari_wasm_highlight.js")
      .then((mod) => {
        wasmFn = mod.highlight as WasmHighlightFn;
        version.value += 1;
        return wasmFn;
      })
      .catch(() => {
        // Module failed to load — stay plaintext forever.
        loadPromise = null;
        return null as unknown as WasmHighlightFn;
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

/** Highlight `code` in `lang`; plain text until the wasm module loads. */
export function highlight(code: string, lang?: string): string {
  // Establish reactivity — re-runs when the module finishes loading.
  void version.value;

  const name = lang ? normalize(lang) : "";
  if (name && wasmFn) {
    const result = wasmFn(code, name);
    if (result !== null) return result;
  }
  // Trigger the lazy load (first call only); render plain text for now.
  if (!wasmFn && !loadPromise) {
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
