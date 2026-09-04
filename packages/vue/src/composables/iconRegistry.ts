// Shared, tree-shakeable lucide icon registry.
//
// `import * as LucideIcons` (wildcard) defeats tree-shaking and pulls the
// ENTIRE lucide library (~1500 icons, 800KB+) into the bundle. This module
// imports only the icons the app actually uses — plus a small set of common
// status/indicator icons server-pushed badges may reference — keyed by their
// PascalCase lucide export name so dynamic `byName(str)` lookups (breadcrumb
// badges, nav tags) resolve without the wildcard import. Unknown names fall
// back to `Info`, matching the previous `|| LucideIcons.Info` behavior.

import { Activity, ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Battery, Bell, Bot, Box, Brain, Cable, Calendar, ChartBarBig as BarChart3, Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Circle, CircleAlert as AlertCircle, CircleCheck as CheckCircle, CircleCheckBig as CheckCircle2, CircleDot, Clock, Cpu, Database, Dot, Ellipsis as MoreHorizontal, ExternalLink, Eye, FileArchive, FileCode, FileImage, FileText, Flame, FolderOpen, Gauge, Globe, HardDrive, Info, Kanban, Key, Layers, LayoutDashboard, LoaderCircle as Loader2, Lock, Maximize, Maximize2, MessageSquare, Mic, MicOff, Minimize, Monitor, Network, Package, Pause, Pencil, Play, Plug, Plus, Radio, RefreshCw, Search, Send, Server, Settings, Share2, Shield, Star, Table, Tag, Thermometer, Trash2, TriangleAlert as AlertTriangle, Volume2, VolumeX, Webhook, Wind, Workflow, Wrench, X, Zap, ZoomIn, ZoomOut } from "lucide-vue-next";
import type { Component } from "vue";






















































































const REGISTRY: Record<string, Component> = {
  Activity, AlertCircle, AlertTriangle, ArrowDown, ArrowLeft, ArrowRight,
  ArrowUp, BarChart3, Battery, Bell, Bot, Box, Brain, Cable, Calendar,
  Check, CheckCircle, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight,
  ChevronUp, Circle, CircleDot, Clock, Cpu, Database, Dot, ExternalLink, Eye,
  FileArchive, FileCode, FileImage, FileText, Flame,
  FolderOpen, Gauge, Globe, HardDrive, Info, Kanban, Key, Layers,
  LayoutDashboard, Loader2, Lock, Maximize, Maximize2, MessageSquare, Mic,
  MicOff, Minimize, Monitor, MoreHorizontal, Network, Package, Pause, Pencil,
  Play, Plug, Plus, Radio, RefreshCw, Search, Send, Server, Settings, Share2,
  Shield, Star, Table, Tag, Thermometer, Trash2, Volume2, VolumeX, Webhook,
  Wind, Workflow, Wrench, X, Zap, ZoomIn, ZoomOut,
};

/**
 * Resolve a lucide icon by its PascalCase export name (e.g. `"Cpu"`,
 * `"Activity"`). Returns `Info` for unknown / falsy names so callers can
 * always render something.
 */
export function iconByName(name: string | undefined | null): Component {
  if (name) {
    const hit = REGISTRY[name];
    if (hit) return hit;
    // Tolerate lowercase / kebab server strings ("cpu", "check-circle").
    const alt = REGISTRY[name.replace(/(^|[-_])(.)/g, (_m, _s, c: string) => c.toUpperCase())];
    if (alt) return alt;
  }
  return Info;
}

// ------
// Functional icon aliases + host-provided material packs (材质包).
//
// Window chrome renders SEMANTIC names ("close", "back") instead of
// literal lucide names, so a host theme layer can swap the whole glyph
// family at runtime — user direction 2026-09-05. Resolution order in
// functionalIconSvg():
//   1. host material-pack override for the semantic key (raw SVG string,
//      sanitized at render time),
//   2. the semantic alias's default lucide component,
//   3. `Info` (never reached for the built-in keys).
// `registerFunctionalIconPack(null)` clears the pack and restores the
// built-in family. Packs ride the module singleton: applications register
// once at theme-apply time, exactly like the CSS-var publication.
// ------

/** Semantic key → default lucide component for the built-in family. */
const FUNCTIONAL_ALIASES: Record<string, Component> = {
  close: X,
  back: ChevronLeft,
};

let functionalPack: Record<string, string> | null = null;

/**
 * Install (or clear with `null`) the host's material pack: semantic key →
 * raw SVG markup. The SVG string is sanitized when rendered (script blocks
 * and event-handler attributes stripped); callers own upload validation.
 */
export function registerFunctionalIconPack(
  pack: Record<string, string> | null,
): void {
  functionalPack = pack && Object.keys(pack).length > 0 ? pack : null;
}

/** True when a material pack carries an override for `key`. */
export function hasFunctionalIconOverride(key: string): boolean {
  return !!functionalPack && !!functionalPack[key];
}

/**
 * Hardened sanitizer for host-provided SVG markup (render path is v-html).
 *
 * Deterministic + synchronous by design — the render path cannot await a
 * lazy DOMPurify chunk. Hardened against the classic evasion classes
 * (round-2 review vectors): slash-separated event attributes
 * (`<svg/onload=…>`), unquoted `javascript:` URLs, dangerous element
 * families (script/iframe/object/embed/foreignObject/animate/set/base/
 * meta/form) and SMIL attribute-mutation primitives. NOT an HTML/SVG
 * allowlist parser: material packs are user-local configuration today —
 * if they ever become shareable files, switch to the DOMPurify allowlist
 * (the dependency already ships for HkMarkdownRenderer) before doing so.
 */
const SVG_DENIED_TAGS =
  /<(\/?)(script|iframe|object|embed|foreignObject|animate|set|base|meta|form)\b[^>]*>/gi;
const SVG_SCRIPT_BLOCKS = /<script\b[\s\S]*?<\/script\s*>/gi;
// Value groups deliberately STOP at their own closing quote — a greedy
// any-char alternation would swallow the rest of the tag and let later
// event attributes survive.
const SVG_EVENT_ATTRS =
  /[\s/]on[a-z-]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi;
const SVG_SCHEME_ATTRS =
  /(\s(?:xlink:)?(?:href|src)\s*=\s*)("[^"]*"|'[^']*'|[^\s>]+)/gi;
const SVG_DANGEROUS_SCHEME = /^\s*(?:javascript|vbscript|data:text\/html)/i;

export function sanitizeSvg(svg: string): string {
  // 1. Script blocks and whole dangerous element families are removed
  //    (SMIL mutation primitives like <animate>/<set> included).
  // 2. Event handler attributes — slash separators included — are renamed
  //    to an inert attribute; the handler can never fire again.
  // 3. URL-carrying attributes with script-ish schemes are dropped whole.
  let out = svg
    .replace(SVG_SCRIPT_BLOCKS, "")
    .replace(SVG_DENIED_TAGS, "<$1nothing>");
  out = out.replace(SVG_EVENT_ATTRS, (_m, value: string) => ` data-stripped=${value}`);
  out = out.replace(SVG_SCHEME_ATTRS, (match, _prefix: string, value: string) =>
    SVG_DANGEROUS_SCHEME.test(value.replace(/^["']/, "").replace(/["']$/, ""))
      ? ""
      : match,
  );
  return out;
}

/**
 * Render payload for a functional icon key: a raw-SVG string when the
 * material pack overrides it, `null` when the caller should fall back to
 * the alias's lucide component.
 */
export function functionalIconSvg(key: string): string | null {
  if (functionalPack && functionalPack[key]) {
    return sanitizeSvg(functionalPack[key]);
  }
  return null;
}

/** Default lucide component for a functional key (alias lookup). */
export function functionalIconComponent(key: string): Component {
  return FUNCTIONAL_ALIASES[key] ?? Info;
}
