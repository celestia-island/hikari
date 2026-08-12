



import { FileArchive, FileCode, FileImage, FileText } from "lucide-vue-next";
import type { LucideIcon } from "lucide-vue-next";

const CODE_EXT: Record<string, string> = {
  js: "javascript",
  jsx: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  ts: "typescript",
  tsx: "typescript",
  json: "json",
  css: "css",
  scss: "scss",
  less: "less",
  html: "html",
  htm: "html",
  xml: "xml",
  svg: "xml",
  rs: "rust",
  py: "python",
  go: "go",
  java: "java",
  kt: "kotlin",
  c: "c",
  h: "c",
  cpp: "cpp",
  hpp: "cpp",
  cc: "cpp",
  cxx: "cpp",
  cs: "csharp",
  rb: "ruby",
  php: "php",
  swift: "swift",
  sh: "bash",
  bash: "bash",
  zsh: "bash",
  yml: "yaml",
  yaml: "yaml",
  toml: "ini",
  ini: "ini",
  sql: "sql",
  vue: "xml",
  dart: "dart",
  lua: "lua",
  r: "r",
  scala: "scala",
  clj: "clojure",
  ex: "elixir",
  exs: "elixir",
  gradle: "groovy",
  groovy: "groovy",
};

const ARCHIVE_EXT = new Set([
  "zip", "gz", "tar", "tgz", "rar", "7z", "bz2", "xz", "iso", "dmg", "lz",
]);

const TEXT_EXT = new Set([
  "txt", "log", "csv", "tsv", "md", "markdown", "rst", "cfg", "conf",
  "env", "props", "gitignore", "npmignore", "editorconfig",
]);

export function extOf(name: string): string {
  const base = name.split("/").pop() ?? name;
  const i = base.lastIndexOf(".");
  if (i < 0) return "";
  return base.slice(i + 1).toLowerCase();
}

export function isImageFile(type: string): boolean {
  return type.startsWith("image/");
}

export function isAudioFile(type: string): boolean {
  return type.startsWith("audio/");
}

export function codeLanguage(name: string): string | undefined {
  const base = name.split("/").pop()?.toLowerCase() ?? "";
  if (base === "dockerfile") return "dockerfile";
  if (base === "makefile") return "makefile";
  return CODE_EXT[extOf(name)];
}

export function isCodeFile(name: string): boolean {
  return codeLanguage(name) !== undefined;
}

export function isArchiveFile(name: string): boolean {
  return ARCHIVE_EXT.has(extOf(name));
}

export function isTextFile(name: string, type: string): boolean {
  if (type.startsWith("text/")) return true;
  if (type === "application/json" || type === "application/xml") return true;
  if (type === "image/svg+xml") return true;
  if (isCodeFile(name)) return true;
  if (type === "" && TEXT_EXT.has(extOf(name))) return true;
  return false;
}

export function fileIcon(type: string, name: string): LucideIcon {
  if (type.startsWith("image/")) return FileImage;
  if (type.startsWith("video/")) return FileText;
  if (type.startsWith("audio/")) return FileText;
  if (isCodeFile(name)) return FileCode;
  if (isArchiveFile(name)) return FileArchive;
  return FileText;
}

const IMG_EXT = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".bmp", ".avif"]);
const VID_EXT = new Set([".mp4", ".webm", ".mov", ".mkv", ".avi", ".ogv"]);
const AUD_EXT = new Set([".mp3", ".wav", ".ogg", ".flac", ".m4a", ".opus", ".aac"]);

/** Media kind by file extension (no MIME available). */
export function mediaKindOf(name: string): "image" | "video" | "audio" | "text" | "other" {
  const ext = extOf(name).toLowerCase();
  if (IMG_EXT.has(ext)) return "image";
  if (VID_EXT.has(ext)) return "video";
  if (AUD_EXT.has(ext)) return "audio";
  if (isTextFile(name, "")) return "text";
  return "other";
}
