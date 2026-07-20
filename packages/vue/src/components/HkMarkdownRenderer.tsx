import { computed, defineComponent, ref, watch } from "vue";
import HkSpinner from "./HkSpinner";
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

  const raw = marked.parse(content, { renderer, async: false });
  const html = typeof raw === "string" ? raw : "";
  return DOMPurify.sanitize(html);
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
        <div class="hk-markdown__body" innerHTML={renderedHtml.value} />
        {props.loading && (
          <div class="hk-markdown__overlay">
            <HkSpinner center />
          </div>
        )}
      </div>
    );
  },
});
