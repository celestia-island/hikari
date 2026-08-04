// Static map of highlight.js language id → lazy dynamic import.
//
// Each entry is a LITERAL `import("highlight.js/lib/languages/<id>")` so Vite
// emits it as its own chunk, fetched only when a code block actually requests
// that language. A variable dynamic import (`import(`...languages/${name}`)`)
// does NOT get bundled by Vite for node_modules, so the map must be explicit.
//
// Covers the languages encountered in practice; anything not listed falls
// back to plaintext (per "没加载就是保持不变色"). Extend freely — each added
// entry is just one more on-demand chunk.

import type { LanguageFn } from "highlight.js";

type Loader = () => Promise<{ default: LanguageFn }>;

export const LANGUAGE_LOADERS: Record<string, Loader> = {
  // ── general-purpose programming ──
  javascript: () => import("highlight.js/lib/languages/javascript"),
  typescript: () => import("highlight.js/lib/languages/typescript"),
  python: () => import("highlight.js/lib/languages/python"),
  pythonRepl: () => import("highlight.js/lib/languages/python-repl"),
  java: () => import("highlight.js/lib/languages/java"),
  kotlin: () => import("highlight.js/lib/languages/kotlin"),
  scala: () => import("highlight.js/lib/languages/scala"),
  groovy: () => import("highlight.js/lib/languages/groovy"),
  c: () => import("highlight.js/lib/languages/c"),
  cpp: () => import("highlight.js/lib/languages/cpp"),
  csharp: () => import("highlight.js/lib/languages/csharp"),
  fsharp: () => import("highlight.js/lib/languages/fsharp"),
  go: () => import("highlight.js/lib/languages/go"),
  rust: () => import("highlight.js/lib/languages/rust"),
  ruby: () => import("highlight.js/lib/languages/ruby"),
  php: () => import("highlight.js/lib/languages/php"),
  swift: () => import("highlight.js/lib/languages/swift"),
  objectivec: () => import("highlight.js/lib/languages/objectivec"),
  dart: () => import("highlight.js/lib/languages/dart"),
  elixir: () => import("highlight.js/lib/languages/elixir"),
  erlang: () => import("highlight.js/lib/languages/erlang"),
  clojure: () => import("highlight.js/lib/languages/clojure"),
  lisp: () => import("highlight.js/lib/languages/lisp"),
  scheme: () => import("highlight.js/lib/languages/scheme"),
  haskell: () => import("highlight.js/lib/languages/haskell"),
  elm: () => import("highlight.js/lib/languages/elm"),
  lua: () => import("highlight.js/lib/languages/lua"),
  perl: () => import("highlight.js/lib/languages/perl"),
  r: () => import("highlight.js/lib/languages/r"),
  matlab: () => import("highlight.js/lib/languages/matlab"),
  julia: () => import("highlight.js/lib/languages/julia"),
  nim: () => import("highlight.js/lib/languages/nim"),
  crystal: () => import("highlight.js/lib/languages/crystal"),
  ocaml: () => import("highlight.js/lib/languages/ocaml"),
  vbnet: () => import("highlight.js/lib/languages/vbnet"),
  delphi: () => import("highlight.js/lib/languages/delphi"),
  basic: () => import("highlight.js/lib/languages/basic"),
  fortran: () => import("highlight.js/lib/languages/fortran"),
  coffeescript: () => import("highlight.js/lib/languages/coffeescript"),
  livescript: () => import("highlight.js/lib/languages/livescript"),

  // ── web / markup / templating ──
  xml: () => import("highlight.js/lib/languages/xml"),
  css: () => import("highlight.js/lib/languages/css"),
  scss: () => import("highlight.js/lib/languages/scss"),
  less: () => import("highlight.js/lib/languages/less"),
  json: () => import("highlight.js/lib/languages/json"),
  yaml: () => import("highlight.js/lib/languages/yaml"),
  markdown: () => import("highlight.js/lib/languages/markdown"),
  handlebars: () => import("highlight.js/lib/languages/handlebars"),
  twig: () => import("highlight.js/lib/languages/twig"),
  dust: () => import("highlight.js/lib/languages/dust"),
  haml: () => import("highlight.js/lib/languages/haml"),
  erb: () => import("highlight.js/lib/languages/erb"),
  graphql: () => import("highlight.js/lib/languages/graphql"),
  http: () => import("highlight.js/lib/languages/http"),

  // ── shell / scripting / build ──
  bash: () => import("highlight.js/lib/languages/bash"),
  shell: () => import("highlight.js/lib/languages/shell"),
  powershell: () => import("highlight.js/lib/languages/powershell"),
  dos: () => import("highlight.js/lib/languages/dos"),
  makefile: () => import("highlight.js/lib/languages/makefile"),
  cmake: () => import("highlight.js/lib/languages/cmake"),
  dockerfile: () => import("highlight.js/lib/languages/dockerfile"),
  nginx: () => import("highlight.js/lib/languages/nginx"),
  gradle: () => import("highlight.js/lib/languages/gradle"),
  awk: () => import("highlight.js/lib/languages/awk"),
  tcl: () => import("highlight.js/lib/languages/tcl"),
  vim: () => import("highlight.js/lib/languages/vim"),

  // ── data / config ──
  ini: () => import("highlight.js/lib/languages/ini"),
  toml: () => import("highlight.js/lib/languages/ini"),
  properties: () => import("highlight.js/lib/languages/properties"),
  protobuf: () => import("highlight.js/lib/languages/protobuf"),
  thrift: () => import("highlight.js/lib/languages/thrift"),
  dns: () => import("highlight.js/lib/languages/dns"),

  // ── systems / hardware / other ──
  sql: () => import("highlight.js/lib/languages/sql"),
  pgsql: () => import("highlight.js/lib/languages/pgsql"),
  glsl: () => import("highlight.js/lib/languages/glsl"),
  wasm: () => import("highlight.js/lib/languages/wasm"),
  armasm: () => import("highlight.js/lib/languages/armasm"),
  x86asm: () => import("highlight.js/lib/languages/x86asm"),
  verilog: () => import("highlight.js/lib/languages/verilog"),
  vhdl: () => import("highlight.js/lib/languages/vhdl"),
  latex: () => import("highlight.js/lib/languages/latex"),
  diff: () => import("highlight.js/lib/languages/diff"),
  plaintext: () => import("highlight.js/lib/languages/plaintext"),
};
