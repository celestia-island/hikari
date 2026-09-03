import { computed, defineComponent, ref, watch } from "vue";
import { ChevronDown, ChevronRight } from "lucide-vue-next";
import { useClipboard } from "@celestia-island/hikari";

import "./HkJsonTree.scss";

/**
 * Parse a JSON text into a container value (object or array). Returns null
 * for primitives, unparseable text, and empty input — mirroring the tool
 * block's semantics where only containers get the tree treatment.
 * (Shared with HkToolBlock, which uses it for its exec/write_to_var paths.)
 */
export function tryParseJson(text: string): unknown | null {
  try {
    const v = JSON.parse(text);
    if (typeof v === "object" && v !== null) return v;
    return null;
  } catch {
    return null;
  }
}

const STR_PREVIEW_LEN = 72;
const JT_TOGGLE = 14;
const JT_INDENT = JT_TOGGLE;
const JT_GUIDE_OFFSET = Math.floor(JT_TOGGLE / 2);

/** One node of the interactive JSON result tree. */
export interface HJsonNode {
  id: number;
  key: string | null;
  value: unknown;
  depth: number;
  isContainer: boolean;
  isLongString: boolean;
  stringValue: string;
  childCount: number;
  children: HJsonNode[];
  preview: string;
}

function truncateStr(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max) + "…";
}

function buildObjectPreview(val: unknown, isArr: boolean): string {
  if (isArr) {
    const arr = val as unknown[];
    const parts = arr.slice(0, 3).map(v => jsonInlineValue(v));
    const suffix = arr.length > 3 ? ", …" : "";
    return `[${parts.join(", ")}${suffix}]`;
  }
  const entries = Object.entries(val as Record<string, unknown>);
  const parts = entries.slice(0, 3).map(([k, v]) => `${k}: ${jsonInlineValue(v)}`);
  const suffix = entries.length > 3 ? ", …" : "";
  return `{${parts.join(", ")}${suffix}}`;
}

function jsonInlineValue(v: unknown): string {
  if (v === null) return "null";
  if (v === undefined) return "undefined";
  if (typeof v === "boolean" || typeof v === "number") return String(v);
  if (typeof v === "string") return `"${truncateStr(v, 20)}"`;
  if (Array.isArray(v)) return `Array(${v.length})`;
  return `{${Object.keys(v as object).length}}`;
}

function buildJsonNode(
  value: unknown,
  key: string | null,
  depth: number,
  maxDepth: number,
  idSeq: { n: number },
): HJsonNode {
  const isContainer = value !== null && typeof value === "object";
  const isLongString = typeof value === "string" && (value as string).length > STR_PREVIEW_LEN;
  let childCount = 0;
  const children: HJsonNode[] = [];
  let preview = "";

  if (isContainer) {
    const entries = Array.isArray(value)
      ? (value as unknown[]).map((v, i) => [String(i), v] as [string, unknown])
      : Object.entries(value as Record<string, unknown>);
    childCount = entries.length;
    preview = buildObjectPreview(value, Array.isArray(value));
    if (depth < maxDepth) {
      for (const [k, v] of entries) {
        children.push(buildJsonNode(v, k, depth + 1, maxDepth, idSeq));
      }
    }
  }

  const nid = idSeq.n;
  idSeq.n += 1;
  return {
    id: nid,
    key,
    value,
    depth,
    isContainer,
    isLongString: !!isLongString,
    stringValue: typeof value === "string" ? value : "",
    childCount,
    children,
    preview,
  };
}

/**
 * Build the interactive JSON tree for a parsed value. Returns null when the
 * value is not a container (no tree needed). Node ids are unique within the
 * returned tree.
 */
export function buildJsonTree(value: unknown, maxDepth = 8): HJsonNode | null {
  if (value === null || typeof value !== "object") return null;
  return buildJsonNode(value, null, 0, maxDepth, { n: 0 });
}

function initialExpandedSet(root: HJsonNode): Set<number> {
  const set = new Set<number>();
  set.add(root.id);
  for (const child of root.children) {
    set.add(child.id);
  }
  return set;
}

/**
 * HkJsonTree — the interactive expandable JSON tree.
 *
 * This is the exact renderer the chat card flow uses for tool results
 * (extracted verbatim from HkToolBlock, same DOM and `s-jt-*` stylesheet, so
 * the two can never drift). Feed it either pre-parsed `value` or a raw JSON
 * `text`; non-container input renders nothing.
 *
 * The root keeps the legacy `s-tool-json-tree` class: hosts (including
 * HkToolBlock's deferred scrollbar pass) target it, and the pane chrome
 * (mono font, capped height, hidden native scrollbars) lives there.
 */
export const HkJsonTree = defineComponent({
  name: "HkJsonTree",
  props: {
    /** Raw JSON text; parsed internally (containers only). */
    text: { type: String, default: "" },
    /** Pre-parsed value; takes precedence over `text` when provided. */
    value: { type: null, default: undefined },
    maxDepth: { type: Number, default: 8 },
    ariaLabel: { type: String, default: "" },
  },
  setup(props) {
    const clipboard = useClipboard();
    const expanded = ref(new Set<number>());

    const root = computed<HJsonNode | null>(() => {
      if (props.value !== undefined) {
        return buildJsonTree(props.value, props.maxDepth);
      }
      if (props.text) {
        const parsed = tryParseJson(props.text);
        return parsed ? buildJsonTree(parsed, props.maxDepth) : null;
      }
      return null;
    });

    // Reset expansion whenever the tree is rebuilt (fresh node ids).
    watch(root, (r) => {
      expanded.value = r ? initialExpandedSet(r) : new Set<number>();
    }, { immediate: true });

    function toggleJsonNode(id: number) {
      const next = new Set(expanded.value);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      expanded.value = next;
    }

    function copyTree() {
      const raw = props.value !== undefined
        ? JSON.stringify(props.value, null, 2)
        : props.text;
      if (raw) void clipboard.copy(raw);
    }

    /* ── JSON tree renderers (verbatim from HkToolBlock) ─────────── */
    function renderJsonValue(value: unknown) {
      if (value === null) return <><span class="s-jv-null">null</span><span class="s-jt-type">null</span></>;
      if (value === undefined) return <><span class="s-jv-null">undefined</span><span class="s-jt-type">undefined</span></>;
      if (typeof value === "boolean") return <><span class="s-jv-bool">{String(value)}</span><span class="s-jt-type">boolean</span></>;
      if (typeof value === "number") return <><span class="s-jv-num">{String(value)}</span><span class="s-jt-type">number</span></>;
      if (typeof value === "string") return <><span class="s-jv-str">{JSON.stringify(value)}</span><span class="s-jt-type">string</span></>;
      return null;
    }

    function renderJsonNode(node: HJsonNode) {
      const indent = node.depth * JT_INDENT;

      if (node.isLongString && !node.isContainer) {
        return renderLongString(node, indent);
      }

      if (!node.isContainer) {
        return (
          <div class="s-jt-row" style={{ paddingLeft: `${indent}px` }}>
            <span class="s-jt-toggle">
              <span class="s-jt-leaf" />
            </span>
            {node.key !== null && <span class="s-jt-key">{node.key}</span>}
            {node.key !== null && <span class="s-jt-colon">: </span>}
            {renderJsonValue(node.value)}
          </div>
        );
      }

      const isOpen = expanded.value.has(node.id);
      const isArr = Array.isArray(node.value);

      if (!isOpen) {
        return (
          <div class="s-jt-row" data-parent style={{ paddingLeft: `${indent}px` }} onClick={() => toggleJsonNode(node.id)}>
            <span class="s-jt-toggle" data-parent>
              <ChevronRight size={10} class="s-jt-chevron" />
            </span>
            {node.key !== null && <span class="s-jt-key">{node.key}</span>}
            {node.key !== null && <span class="s-jt-colon">: </span>}
            <span class="s-jt-preview">{node.preview}</span>
          </div>
        );
      }

      return (
        <div class="s-jt-group">
          <div class="s-jt-row" data-parent style={{ paddingLeft: `${indent}px` }} onClick={() => toggleJsonNode(node.id)}>
            <span class="s-jt-toggle" data-parent>
              <ChevronDown size={10} class="s-jt-chevron" />
            </span>
            {node.key !== null && <span class="s-jt-key">{node.key}</span>}
            {node.key !== null && <span class="s-jt-colon">: </span>}
            <span class="s-jt-badge is-open">{isArr ? `Array(${node.childCount})` : `{${node.childCount}}`}</span>
          </div>
          <div class="s-jt-children" style={{ "--guide-left": `${indent + JT_GUIDE_OFFSET}px` }}>
            {node.children.map(child => renderJsonNode(child))}
          </div>
        </div>
      );
    }

    function renderLongString(node: HJsonNode, indent: number) {
      const isOpen = expanded.value.has(node.id);

      if (!isOpen) {
        return (
          <div class="s-jt-row" data-parent style={{ paddingLeft: `${indent}px` }} onClick={() => toggleJsonNode(node.id)}>
            <span class="s-jt-toggle" data-parent>
              <ChevronRight size={10} class="s-jt-chevron" />
            </span>
            {node.key !== null && <span class="s-jt-key">{node.key}</span>}
            {node.key !== null && <span class="s-jt-colon">: </span>}
            <span class="s-jv-str">"{truncateStr(node.stringValue, STR_PREVIEW_LEN)}"</span>
            <span class="s-jt-type">string ({node.stringValue.length})</span>
          </div>
        );
      }

      const lines = node.stringValue.split("\n");
      return (
        <div class="s-jt-group">
          <div class="s-jt-row" data-parent style={{ paddingLeft: `${indent}px` }} onClick={() => toggleJsonNode(node.id)}>
            <span class="s-jt-toggle" data-parent>
              <ChevronDown size={10} class="s-jt-chevron" />
            </span>
            {node.key !== null && <span class="s-jt-key">{node.key}</span>}
            {node.key !== null && <span class="s-jt-colon">: </span>}
            <span class="s-jt-badge is-open">string ({node.stringValue.length})</span>
          </div>
          <div class="s-jt-children" style={{ "--guide-left": `${indent + JT_GUIDE_OFFSET}px` }}>
            {lines.map((line, li) => (
              <div key={li} class="s-jt-row" style={{ paddingLeft: `${(node.depth + 1) * JT_INDENT}px` }}>
                <span class="s-jt-toggle">
                  <span class="s-jt-leaf" />
                </span>
                <span class="s-jv-str-raw">{line || " "}</span>
              </div>
            ))}
          </div>
        </div>
      );
    }

    return () => {
      if (!root.value) return null;
      return (
        <div
          class="s-tool-json-tree"
          aria-label={props.ariaLabel || undefined}
          role="tree"
          onClick={(e) => {
            const target = e.target as HTMLElement;
            if (target.closest(".s-jt-row[data-parent]")) return;
            e.stopPropagation();
            copyTree();
          }}
        >
          {renderJsonNode(root.value)}
        </div>
      );
    };
  },
});
