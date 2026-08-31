import { computed, defineComponent, onBeforeUnmount, onMounted, onUpdated, ref, watch, type PropType } from "vue";
import { ChevronDown, ChevronRight } from "lucide-vue-next";
import { HDivider, useClipboard } from "@celestia-island/hikari";

import type { HToolCallStatus } from "./HkChatTypes";
import { formatTokenCount } from "../utils/format";
import { useI18n } from "../i18n/context";
import { attachOverlayScrollbars, type OverlayScrollbarHandle } from "../composables/useOverlayScrollbar";

import "./HkToolBlock.scss";

export interface HParsedToolCall {
  toolName: string;
  argsJson: string;
  argsObj: Record<string, unknown> | null;
}

/**
 * Parse a chest-style tool call text of the form `"toolName", {...args}`
 * into its parts. Returns null when the text does not match that shape.
 */
export function parseToolCallText(callText: string): HParsedToolCall | null {
  const m = callText.match(/^"(\w+)"\s*,\s*(\{[\s\S]*\})\s*$/);
  if (!m) return null;
  try {
    const v = JSON.parse(m[2]);
    const argsObj = typeof v === "object" && v !== null ? v as Record<string, unknown> : null;
    return { toolName: m[1], argsJson: m[2], argsObj };
  } catch {
    return { toolName: m[1], argsJson: m[2], argsObj: null };
  }
}

/** Block variant — mirrors chest's isExec / isWriteToVar toggles. */
export type HToolBlockVariant = "default" | "exec" | "write_to_var";

function tryParseJson(text: string): unknown | null {
  try {
    const v = JSON.parse(text);
    if (typeof v === "object" && v !== null) return v;
    return null;
  } catch {
    return null;
  }
}

/**
 * Extract the `code` argument from a chest-style exec call: either
 * `"toolName", {"code": "..."}` or a bare JSON object holding `code`.
 */
export function extractExecCode(callText: string): string | null {
  const parsed = parseToolCallText(callText);
  if (parsed?.argsObj && "code" in parsed.argsObj) {
    return String(parsed.argsObj.code);
  }
  const v = tryParseJson(callText);
  if (v && typeof v === "object" && "code" in v) {
    return (v as { code: string }).code;
  }
  return null;
}

export interface HHighlightedLine {
  num: string;
  html: string;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Lightweight syntax highlighting. Uses `globalThis.hljs` when the host
 * app registered it (same convention as hikari's HMarkdownRenderer), and
 * falls back to HTML-escaped plain text otherwise — no bundled dependency.
 */
function highlightBlock(code: string, language: string): string {
  try {
    const hljs = (globalThis as Record<string, unknown>).hljs as
      | { highlight: (code: string, opts: { language?: string }) => { value: string } }
      | undefined;
    if (hljs?.highlight) {
      const result = hljs.highlight(code, { language });
      return result.value;
    }
  } catch {
    // fall through to the escaped plain-text pass
  }
  return escapeHtml(code);
}

/** Split highlighted code into numbered rows for the line-numbered table. */
export function buildHighlightedLines(code: string, language: string): HHighlightedLine[] {
  const highlighted = highlightBlock(code, language);
  const rawLines = highlighted.split("\n");
  const padLen = String(rawLines.length).length;
  return rawLines.map((html, i) => ({
    num: String(i + 1).padStart(padLen, " "),
    html,
  }));
}

function truncateContent(text: string, maxLines: number, maxChars: number): { lines: string[]; truncated: boolean; totalChars: number } {
  const allLines = text.split("\n");
  const totalChars = text.length;
  let charAcc = 0;
  const result: string[] = [];
  for (const line of allLines) {
    if (result.length >= maxLines || charAcc + line.length > maxChars) {
      return { lines: result, truncated: true, totalChars };
    }
    charAcc += line.length;
    result.push(line);
  }
  return { lines: result, truncated: false, totalChars };
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
 * Build the interactive JSON tree for a parsed result value. Returns null
 * when the value is not a container (no tree needed). Node ids are unique
 * within the returned tree.
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
 * HkToolBlock — collapsible tool call / result block.
 * (Upstreamed from shittim-chest's plana-legacy layer.)
 *
 * Renders a tool call header (title + status badge), the call arguments
 * and the result, plus an estimated token/duration footer. Ports chest's
 * deferred capabilities as optional props:
 * - `variant` — "exec" shows the extracted code block (line numbers +
 *   highlight.js colors when `globalThis.hljs` is registered by the host
 *   app), "write_to_var" renders the nested content block and a
 *   "variable written" result line.
 * - `highlightCode` — syntax-colors the plain call block too.
 * - `jsonTree` — renders JSON results as an interactive expandable tree
 *   (default on, matching chest).
 */
export const HkToolBlock = defineComponent({
  name: "HkToolBlock",
  props: {
    toolName: { type: String, required: true },
    agentType: { type: String, default: "" },
    status: { type: String as PropType<HToolCallStatus>, required: true },
    callText: { type: String, default: "" },
    resultText: { type: String, default: "" },
    durationMs: { type: Number, default: undefined },
    defaultExpanded: { type: Boolean, default: true },
    collapsible: { type: Boolean, default: true },
    variant: { type: String as PropType<HToolBlockVariant>, default: "default" },
    varName: { type: String, default: "" },
    highlightCode: { type: Boolean, default: false },
    jsonTree: { type: Boolean, default: true },
  },
  setup(props) {
    const { t } = useI18n();
    const clipboard = useClipboard();
    const expanded = ref(props.defaultExpanded);
    const jsonExpanded = ref(new Set<number>());

    // Overlay scrollbars (shared chrome) on the code panes. The panes
    // mount/unmount with expansion + status, so the set is reconciled
    // after every render: handles whose pane left the DOM detach (which
    // also removes the track from the pane's parent), new panes attach.
    const rootRef = ref<HTMLElement>();
    const paneScrollbars: Array<{ el: HTMLElement; handle: OverlayScrollbarHandle }> = [];

    function syncCodePanes() {
      for (let i = paneScrollbars.length - 1; i >= 0; i--) {
        if (!paneScrollbars[i].el.isConnected) {
          paneScrollbars[i].handle.detach();
          paneScrollbars.splice(i, 1);
        }
      }
      for (const el of rootRef.value?.querySelectorAll<HTMLElement>(".s-tool-code, .s-tool-code-block, .s-tool-json-tree") ?? []) {
        if (paneScrollbars.some((p) => p.el === el)) continue;
        paneScrollbars.push({ el, handle: attachOverlayScrollbars(el, { axis: "both" }) });
      }
    }

    onMounted(syncCodePanes);
    onUpdated(syncCodePanes);
    onBeforeUnmount(() => {
      for (const p of paneScrollbars) p.handle.detach();
      paneScrollbars.length = 0;
    });

    watch(() => props.status, (newStatus) => {
      if (newStatus === "done") expanded.value = true;
    });

    const displayTitle = computed(() => {
      if (props.variant === "exec") return t("hikari::tools.exec", "Exec");
      if (props.variant === "write_to_var") {
        const base = t("hikari::tools.writeToVar", "Write to var");
        return props.varName ? `${base}: ${props.varName}` : base;
      }
      return props.agentType ? `${props.agentType} :: ${props.toolName}` : props.toolName;
    });

    const statusLabel = computed(() => {
      switch (props.status) {
        case "pending": return t("hikari::tools.pending", "Pending");
        case "running": return t("hikari::tools.running", "Running");
        case "done": return t("hikari::tools.done", "Done");
        case "error": return t("hikari::tools.error", "Error");
      }
    });

    const callTokens = computed(() => Math.ceil((props.callText?.length ?? 0) / 4));
    const resultTokens = computed(() => Math.ceil((props.resultText?.length ?? 0) / 4));

    const blockClass = computed(() => [
      "s-tool-block",
      props.status === "error" ? "is-error" : "",
      props.status === "running" ? "is-running" : "",
      props.status === "done" ? "is-success" : "",
    ].filter(Boolean).join(" "));

    function toggleExpand() {
      if (!props.collapsible) return;
      expanded.value = !expanded.value;
    }

    /* ── exec variant ────────────────────────────────────────────── */
    const execCodeRaw = computed(() => {
      if (props.variant !== "exec" || !props.callText) return null;
      return extractExecCode(props.callText) ?? props.callText;
    });

    const execCodeLines = computed(() => {
      if (!execCodeRaw.value) return null;
      return buildHighlightedLines(execCodeRaw.value, "javascript");
    });

    /* ── write_to_var variant ────────────────────────────────────── */
    const wtvContent = computed(() => {
      if (props.variant !== "write_to_var" || !props.callText) return null;
      const parsed = tryParseJson(props.callText);
      if (parsed && typeof parsed === "object" && "content" in (parsed as object)) {
        return truncateContent((parsed as { content: string }).content, 16, 2000);
      }
      return null;
    });

    const wtvResultText = computed(() => {
      if (props.variant !== "write_to_var" || !props.resultText) return null;
      const bytes = new TextEncoder().encode(props.resultText).length;
      return t("hikari::tools.varWritten", "Variable written ({bytes} bytes)").replace("{bytes}", String(bytes));
    });

    /* ── highlighted plain call block ────────────────────────────── */
    const callHighlighted = computed(() => {
      if (props.variant !== "default" || !props.highlightCode || !props.callText) return null;
      const language = tryParseJson(props.callText) ? "json" : "plaintext";
      return buildHighlightedLines(props.callText, language);
    });

    /* ── result: JSON tree or plain text ─────────────────────────── */
    const resultJsonRoot = computed(() => {
      if (!props.resultText || !props.jsonTree) return null;
      const parsed = tryParseJson(props.resultText);
      if (!parsed) return null;
      const root = buildJsonTree(parsed);
      if (!root) return null;
      jsonExpanded.value = initialExpandedSet(root);
      return root;
    });

    const resultPlain = computed(() => {
      if (!props.resultText || resultJsonRoot.value) return null;
      return truncateContent(props.resultText, 8, 800);
    });

    function toggleJsonNode(id: number) {
      const next = new Set(jsonExpanded.value);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      jsonExpanded.value = next;
    }

    function copyText(text: string) {
      void clipboard.copy(text);
    }

    function copyTitle() {
      copyText(displayTitle.value);
    }

    function copyExecCode() {
      if (execCodeRaw.value) copyText(execCodeRaw.value);
    }

    function copyJsonTree() {
      if (props.resultText) copyText(props.resultText);
    }

    /* ── JSON tree renderers (ported from chest) ─────────────────── */
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

      const isOpen = jsonExpanded.value.has(node.id);
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
      const isOpen = jsonExpanded.value.has(node.id);

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

    return () => (
      <div ref={rootRef} class={blockClass.value}>
        <div class="s-tool-header" onClick={toggleExpand}>
          <span class="s-tool-header-title" onClick={(e) => { e.stopPropagation(); copyTitle(); }}>{displayTitle.value}</span>
          <span class={`s-tool-header-badge is-${props.status}`}>{statusLabel.value}</span>
          {props.collapsible && (
            <span class="s-tool-header-expand">
              {expanded.value ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </span>
          )}
        </div>

        {expanded.value && (
          <div class="s-tool-body">
            {props.status === "pending" && (
              <div class="s-tool-params">
                <div class="s-tool-param-line is-muted-italic">{t("hikari::tools.waitingArgs", "Waiting for arguments…")}</div>
              </div>
            )}

            {props.status === "running" && !props.callText && (
              <div class="s-tool-params">
                <div class="s-tool-param-line is-muted-italic" style={{ color: "rgb(var(--color-primary))" }}>
                  {t("hikari::tools.executing", "Executing…")}
                </div>
              </div>
            )}

            {execCodeLines.value && (
              <div class="s-tool-code-block-wrap">
                <div class="s-tool-code-block hljs" onClick={copyExecCode}>
                  <table class="s-tool-code-table">
                    {execCodeLines.value.map((line, i) => (
                      <tr key={i}>
                        <td class="s-tool-code-num"><span>{line.num}</span></td>
                        <td class="s-tool-code-content" innerHTML={line.html} />
                      </tr>
                    ))}
                  </table>
                </div>
              </div>
            )}

            {wtvContent.value && (
              <div class="s-tool-nested-block">
                {wtvContent.value.lines.map((line, i) => (
                  <div key={i} class="s-tool-param-line">{line}</div>
                ))}
                {wtvContent.value.truncated && (
                  <div class="s-tool-truncation">... ({wtvContent.value.totalChars} chars)</div>
                )}
              </div>
            )}

            {props.variant === "default" && props.callText && (
              callHighlighted.value ? (
                <div class="s-tool-code-block-wrap">
                  <div class="s-tool-code-block hljs">
                    <table class="s-tool-code-table">
                      {callHighlighted.value.map((line, i) => (
                        <tr key={i}>
                          <td class="s-tool-code-num"><span>{line.num}</span></td>
                          <td class="s-tool-code-content" innerHTML={line.html} />
                        </tr>
                      ))}
                    </table>
                  </div>
                </div>
              ) : (
                <div class="s-tool-call">
                  <pre class="s-tool-code" data-role="call">{props.callText}</pre>
                </div>
              )
            )}

            {props.callText && props.resultText && (
              <HDivider variant="dashed" tone="faint" spacing="sm" />
            )}

            {resultJsonRoot.value && (
              <div class={`s-tool-result ${props.status === "error" ? "is-error" : ""}`}>
                <div class="s-tool-json-tree" onClick={(e) => {
                  const target = e.target as HTMLElement;
                  if (target.closest(".s-jt-row[data-parent]")) return;
                  e.stopPropagation();
                  copyJsonTree();
                }}>
                  {renderJsonNode(resultJsonRoot.value)}
                </div>
              </div>
            )}

            {wtvResultText.value && (
              <div class="s-tool-result">
                <div class="s-tool-result-line">{wtvResultText.value}</div>
              </div>
            )}

            {!wtvResultText.value && resultPlain.value && (
              <div class={`s-tool-result ${props.status === "error" ? "is-error" : ""}`}>
                {resultPlain.value.lines.map((line, i) => (
                  <div key={i} class="s-tool-result-line">{line}</div>
                ))}
                {resultPlain.value.truncated && (
                  <div class="s-tool-truncation">... ({resultPlain.value.totalChars} chars)</div>
                )}
              </div>
            )}
          </div>
        )}

        {expanded.value && (props.durationMs != null || callTokens.value > 0 || resultTokens.value > 0) && (
          <div class="s-tool-footer">
            {callTokens.value > 0 && (
              <span class="s-tool-stat">
                <span class="s-tool-stat-arrow is-in">↑</span>
                <span class="s-tool-stat-value">{formatTokenCount(callTokens.value)}</span>
              </span>
            )}
            {resultTokens.value > 0 && (
              <span class="s-tool-stat">
                <span class="s-tool-stat-arrow is-out">↓</span>
                <span class="s-tool-stat-value">{formatTokenCount(resultTokens.value)}</span>
              </span>
            )}
            {props.durationMs != null && (
              <span class="s-tool-stat">
                <span class="s-tool-stat-label">{props.durationMs}ms</span>
              </span>
            )}
          </div>
        )}
      </div>
    );
  },
});
