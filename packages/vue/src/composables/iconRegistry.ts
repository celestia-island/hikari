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
