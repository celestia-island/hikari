import { computed, defineComponent, ref, watch } from "vue";
import HSpinner from "./HkSpinner";
import "./HkMarkdownRenderer.scss";

let _marked: any = null;
let _DOMPurify: any = null;

async function ensureMarked(): Promise<any> {
  if (_marked) return _marked;
  try {
    // @ts-ignore
    const mod = await import("marked");
    _marked = mod.marked;
    _marked.setOptions({ gfm: true, breaks: true });
    return _marked;
  } catch {
    return null as never;
  }
}

async function ensureDOMPurify() {
  if (_DOMPurify) return _DOMPurify;
  try {
    // @ts-ignore
    const mod = await import("dompurify");
    _DOMPurify = mod.default;
    return _DOMPurify;
  } catch {
    return null;
  }
}

function tryHighlight(code: string, lang?: string): string {
  try {
    const hljs = (globalThis as Record<string, unknown>).hljs as
      | { highlight: (code: string, opts: { language?: string }) => { value: string } }
      | undefined;
    if (hljs?.highlight) {
      const result = hljs.highlight(code, { language: lang });
      return result.value;
    }
  } catch {
    // fall through
  }
  return code.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function renderPlain(content: string): string {
  const escaped = content
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `<pre class="hk-md-plain">${escaped}</pre>`;
}

/**
 * Best-effort rescue of GFM tables that follow a non-blank line.
 *
 * marked (CommonMark) only recognizes a table when the delimiter row
 * (`| --- |`) is separated from the preceding block by a blank line. Agent
 * reports frequently paste a table directly after a prose sentence or a JSON
 * fragment, which makes marked emit the raw `|` lines as a paragraph. This
 * pre-pass inserts a blank line between a non-table, non-blank line and a
 * following line that starts a table (contains `|` and the next line looks
 * like a delimiter row).
 */
function rescueTables(content: string): string {
  const lines = content.split("\n");
  const isTableish = (s: string) => {
    const t = s.trim();
    return t.includes("|") && (t.startsWith("|") || t.endsWith("|"));
  };
  const isDelimiter = (s: string) =>
    /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(s);
  const isFence = (s: string) => /^\s*(`{3,}|~{3,})/.test(s);
  const out: string[] = [];
  // Track fenced code blocks: table-shaped lines inside a fence are literal
  // content and must never be touched.
  let fenceOpen = false;
  let fenceMarker = "";
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (fenceOpen) {
      out.push(line);
      // Closing fence: same character, at least as many, nothing after.
      if (line.trimStart().startsWith(fenceMarker[0].repeat(3))) {
        const t = line.trim();
        if (
          (fenceMarker[0] === "`" && /^`{3,}`*\s*$/.test(t)) ||
          (fenceMarker[0] === "~" && /^~{3,}~*\s*$/.test(t))
        ) {
          fenceOpen = false;
          fenceMarker = "";
        }
      }
      continue;
    }
    if (isFence(line)) {
      fenceMarker = line.trimStart().slice(0, 3);
      fenceOpen = true;
      out.push(line);
      continue;
    }
    const prev = out.length ? out[out.length - 1] : "";
    const prevIsTable = isTableish(prev);
    const curIsTable = isTableish(line);
    const nextIsDelimiter =
      i + 1 < lines.length && isDelimiter(lines[i + 1]);
    if (
      prev.trim() !== "" &&
      !prevIsTable &&
      curIsTable &&
      nextIsDelimiter
    ) {
      out.push("");
    }
    out.push(line);
  }
  return out.join("\n");
}

async function renderMarkdown(content: string): Promise<string> {
  const [marked, DOMPurify] = await Promise.all([ensureMarked(), ensureDOMPurify()]);

  if (!marked || !DOMPurify) {
    return renderPlain(content);
  }

  const renderer = new (marked as unknown as { Renderer: new () => Record<string, unknown> }).Renderer();

  (renderer as Record<string, unknown>).code = function (tok: { text: string; lang?: string }) {
    const highlighted = tryHighlight(tok.text, tok.lang);
    const langAttr = tok.lang ? ` language-${tok.lang}` : "";
    const langLabel = tok.lang ? `<span class="hk-md-code-lang">${tok.lang}</span>` : "";
    return `<div class="hk-md-code">${langLabel}<pre><code class="hljs${langAttr}">${highlighted}</code></pre></div>`;
  };

  // Wrap tables in a horizontally scrollable container so a wide table
  // scrolls inside the card instead of stretching the card past the
  // viewport on mobile. Done as post-processing on the sanitized HTML
  // rather than a renderer override: marked 18's table renderer receives
  // structured cell tokens, and re-implementing cell rendering (inline
  // tokens, alignment) would drift from upstream.
  const raw = marked.parse(rescueTables(content), { renderer, async: false });
  const parsed = typeof raw === "string" ? raw : "";
  const html = DOMPurify.sanitize(parsed);
  const wrapped = html
    .replace(/<table>/g, '<div class="hk-md-table-wrap"><table>')
    .replace(/<\/table>/g, "</table></div>");
  return wrapped;
}

export default defineComponent({
  name: "HkMarkdownRenderer",
  props: {
    content: { type: String, required: true },
    loading: { type: Boolean, default: false },
    plain: { type: Boolean, default: false },
  },
  setup(props) {
    const renderedHtml = ref("");
    const parseError = ref(false);

    async function parse() {
      if (!props.content) {
        renderedHtml.value = "";
        return;
      }
      parseError.value = false;
      try {
        if (props.plain) {
          renderedHtml.value = renderPlain(props.content);
        } else {
          renderedHtml.value = await renderMarkdown(props.content);
        }
      } catch {
        parseError.value = true;
        renderedHtml.value = renderPlain(props.content);
      }
    }

    watch(
      () => [props.content, props.plain],
      () => { void parse(); },
      { immediate: true },
    );

    return () => (
      <div class="hk-markdown" data-plain={props.plain || undefined} data-loading={props.loading}>
        <div class="hk-markdown-body" innerHTML={renderedHtml.value} />
        {props.loading && (
          <div class="hk-markdown-overlay">
            <HSpinner center />
          </div>
        )}
      </div>
    );
  },
});
