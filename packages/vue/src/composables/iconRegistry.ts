// Shared, tree-shakeable lucide icon registry.
//
// `import * as LucideIcons` (wildcard) defeats tree-shaking and pulls the
// ENTIRE lucide library (~1500 icons, 800KB+) into the bundle. This module
// imports only the icons the app actually uses — plus a small set of common
// status/indicator icons server-pushed badges may reference — keyed by their
// PascalCase lucide export name so dynamic `byName(str)` lookups (breadcrumb
// badges, nav tags) resolve without the wildcard import. Unknown names fall
// back to `Info`, matching the previous `|| LucideIcons.Info` behavior.

import type { Component } from "vue";

import Activity from "lucide-vue-next/dist/esm/icons/activity";
import AlertCircle from "lucide-vue-next/dist/esm/icons/circle-alert";
import AlertTriangle from "lucide-vue-next/dist/esm/icons/triangle-alert";
import ArrowDown from "lucide-vue-next/dist/esm/icons/arrow-down";
import ArrowLeft from "lucide-vue-next/dist/esm/icons/arrow-left";
import ArrowRight from "lucide-vue-next/dist/esm/icons/arrow-right";
import ArrowUp from "lucide-vue-next/dist/esm/icons/arrow-up";
import BarChart3 from "lucide-vue-next/dist/esm/icons/chart-bar-big";
import Battery from "lucide-vue-next/dist/esm/icons/battery";
import Bell from "lucide-vue-next/dist/esm/icons/bell";
import Bot from "lucide-vue-next/dist/esm/icons/bot";
import Box from "lucide-vue-next/dist/esm/icons/box";
import Brain from "lucide-vue-next/dist/esm/icons/brain";
import Cable from "lucide-vue-next/dist/esm/icons/cable";
import Calendar from "lucide-vue-next/dist/esm/icons/calendar";
import Check from "lucide-vue-next/dist/esm/icons/check";
import CheckCircle from "lucide-vue-next/dist/esm/icons/circle-check";
import CheckCircle2 from "lucide-vue-next/dist/esm/icons/circle-check-big";
import ChevronDown from "lucide-vue-next/dist/esm/icons/chevron-down";
import ChevronLeft from "lucide-vue-next/dist/esm/icons/chevron-left";
import ChevronRight from "lucide-vue-next/dist/esm/icons/chevron-right";
import ChevronUp from "lucide-vue-next/dist/esm/icons/chevron-up";
import Circle from "lucide-vue-next/dist/esm/icons/circle";
import CircleDot from "lucide-vue-next/dist/esm/icons/circle-dot";
import Clock from "lucide-vue-next/dist/esm/icons/clock";
import Cpu from "lucide-vue-next/dist/esm/icons/cpu";
import Database from "lucide-vue-next/dist/esm/icons/database";
import Dot from "lucide-vue-next/dist/esm/icons/dot";
import ExternalLink from "lucide-vue-next/dist/esm/icons/external-link";
import Eye from "lucide-vue-next/dist/esm/icons/eye";
import FileArchive from "lucide-vue-next/dist/esm/icons/file-archive";
import FileCode from "lucide-vue-next/dist/esm/icons/file-code";
import FileImage from "lucide-vue-next/dist/esm/icons/file-image";
import FileText from "lucide-vue-next/dist/esm/icons/file-text";
import Flame from "lucide-vue-next/dist/esm/icons/flame";
import FolderOpen from "lucide-vue-next/dist/esm/icons/folder-open";
import Gauge from "lucide-vue-next/dist/esm/icons/gauge";
import Globe from "lucide-vue-next/dist/esm/icons/globe";
import HardDrive from "lucide-vue-next/dist/esm/icons/hard-drive";
import Info from "lucide-vue-next/dist/esm/icons/info";
import Kanban from "lucide-vue-next/dist/esm/icons/kanban";
import Key from "lucide-vue-next/dist/esm/icons/key";
import Layers from "lucide-vue-next/dist/esm/icons/layers";
import LayoutDashboard from "lucide-vue-next/dist/esm/icons/layout-dashboard";
import Loader2 from "lucide-vue-next/dist/esm/icons/loader-circle";
import Lock from "lucide-vue-next/dist/esm/icons/lock";
import Maximize from "lucide-vue-next/dist/esm/icons/maximize";
import Maximize2 from "lucide-vue-next/dist/esm/icons/maximize-2";
import MessageSquare from "lucide-vue-next/dist/esm/icons/message-square";
import Mic from "lucide-vue-next/dist/esm/icons/mic";
import MicOff from "lucide-vue-next/dist/esm/icons/mic-off";
import Minimize from "lucide-vue-next/dist/esm/icons/minimize";
import Monitor from "lucide-vue-next/dist/esm/icons/monitor";
import MoreHorizontal from "lucide-vue-next/dist/esm/icons/ellipsis";
import Network from "lucide-vue-next/dist/esm/icons/network";
import Package from "lucide-vue-next/dist/esm/icons/package";
import Pause from "lucide-vue-next/dist/esm/icons/pause";
import Pencil from "lucide-vue-next/dist/esm/icons/pencil";
import Play from "lucide-vue-next/dist/esm/icons/play";
import Plug from "lucide-vue-next/dist/esm/icons/plug";
import Plus from "lucide-vue-next/dist/esm/icons/plus";
import Radio from "lucide-vue-next/dist/esm/icons/radio";
import RefreshCw from "lucide-vue-next/dist/esm/icons/refresh-cw";
import Search from "lucide-vue-next/dist/esm/icons/search";
import Send from "lucide-vue-next/dist/esm/icons/send";
import Server from "lucide-vue-next/dist/esm/icons/server";
import Settings from "lucide-vue-next/dist/esm/icons/settings";
import Share2 from "lucide-vue-next/dist/esm/icons/share-2";
import Shield from "lucide-vue-next/dist/esm/icons/shield";
import Star from "lucide-vue-next/dist/esm/icons/star";
import Table from "lucide-vue-next/dist/esm/icons/table";
import Tag from "lucide-vue-next/dist/esm/icons/tag";
import Thermometer from "lucide-vue-next/dist/esm/icons/thermometer";
import Trash2 from "lucide-vue-next/dist/esm/icons/trash-2";
import Volume2 from "lucide-vue-next/dist/esm/icons/volume-2";
import VolumeX from "lucide-vue-next/dist/esm/icons/volume-x";
import Webhook from "lucide-vue-next/dist/esm/icons/webhook";
import Wind from "lucide-vue-next/dist/esm/icons/wind";
import Workflow from "lucide-vue-next/dist/esm/icons/workflow";
import Wrench from "lucide-vue-next/dist/esm/icons/wrench";
import X from "lucide-vue-next/dist/esm/icons/x";
import Zap from "lucide-vue-next/dist/esm/icons/zap";
import ZoomIn from "lucide-vue-next/dist/esm/icons/zoom-in";
import ZoomOut from "lucide-vue-next/dist/esm/icons/zoom-out";

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
