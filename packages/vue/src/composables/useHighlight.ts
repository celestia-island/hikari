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
