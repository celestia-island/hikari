import { computed, defineComponent, nextTick, onBeforeUnmount, ref, watch } from "vue";
import type { Renderer, Tokens } from "marked";
import HSpinner from "./HkSpinner";
import { attachOverlayScrollbars, type OverlayScrollbarHandle } from "../composables/useOverlayScrollbar";
import { asIndexable } from "../utils/typing";
import "./HkMarkdownRenderer.scss";

// `marked` and `dompurify` are loaded on first non-plain render so a bundle
// that never shows markdown does not pay for two renderers. The lazy
// singletons are typed from the modules themselves instead of `any`: the
// `marked` namespace type carries `.parse`, `.Renderer` and `.setOptions`
// alongside the callable signature, so the renderer wiring below needs no
// assertion at all.
type MarkedModule = typeof import("marked");
type Marked = MarkedModule["marked"];
type Purifier = (typeof import("dompurify"))["default"];

let _marked: Marked | null = null;
let _DOMPurify: Purifier | null = null;

async function ensureMarked(): Promise<Marked | null> {
  if (_marked) return _marked;
  try {
    const mod: MarkedModule = await import("marked");
    mod.marked.setOptions({ gfm: true, breaks: true });
    _marked = mod.marked;
    return _marked;
  } catch {
    return null;
  }
}

async function ensureDOMPurify(): Promise<Purifier | null> {
  if (_DOMPurify) return _DOMPurify;
  try {
    const mod = await import("dompurify");
    _DOMPurify = mod.default;
    return _DOMPurify;
  } catch {
    return null;
  }
}

function tryHighlight(code: string, lang?: string): string {
  try {
    // `hljs` is a host-installed global (the consumer may ship highlight.js
    // or not), so it is read off `globalThis` through the indexable view
    // rather than `window`, which does not declare it.
    const hljs = asIndexable(globalThis).hljs as
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

  // `marked` drives its output by calling `renderer.code(token)` /
  // `renderer.table(token)` with the renderer as `this`, so the overrides are
  // plain instance methods carrying the upstream token types. Overriding the
  // instance (not the prototype) keeps the shared `Renderer` class intact for
  // every other instance in the page.
  const renderer = new marked.Renderer();

  renderer.code = function ({ text, lang }: Tokens.Code): string {
    const highlighted = tryHighlight(text, lang);
    // Audit hikari-R1-5: whitelist the language tag before interpolation
    // (depth-in-defence — the final DOMPurify pass remains the primary
    // guard, but this keeps the raw template injection safe on its own).
    const safeLang = lang && /^[a-zA-Z0-9+#._-]{1,32}$/.test(lang) ? lang : "";
    const langAttr = safeLang ? ` language-${safeLang}` : "";
    const langLabel = safeLang ? `<span class="hk-md-code-lang">${safeLang}</span>` : "";
    return `<div class="hk-md-code-wrap"><div class="hk-md-code">${langLabel}<pre><code class="hljs${langAttr}">${highlighted}</code></pre></div></div>`;
  };

  renderer.table = function (this: Renderer, token: Tokens.Table): string {
    // Tables size to their content: a wide one (many columns, or a single
    // unbreakable cell) pushes every ancestor's min-content width past its
    // box, and clipping hosts (modal reading region, chat bubbles, report
    // cards) leave the far columns unreachable. Same two-level shape as the
    // code override above: `.hk-md-table-wrap` is the rail HOST (a plain
    // positioned box wrapping only the scroller — the engine anchors the
    // track in the viewport's parent), `.hk-md-table-scroll` is the
    // viewport that actually rails. Rail the TABLE itself — normal tables
    // keep their full-width layout; only a genuinely overflowing one grows
    // the horizontal scroll (see .hk-md-table-scroll).
    const inner = marked.Renderer.prototype.table.call(this, token);
    return `<div class="hk-md-table-wrap"><div class="hk-md-table-scroll">${inner}</div></div>`;
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

    // Overlay scrollbars (shared chrome) on the markdown blocks that can
    // rail horizontally: code blocks and table scrollers. The body is
    // innerHTML-rendered and fully replaced on every parse, so the
    // attachment set is reconciled after each render pass: handles whose
    // block left the DOM detach, fresh blocks attach.
    const bodyRef = ref<HTMLElement>();
    const overlayScrollbars: Array<{ el: HTMLElement; handle: OverlayScrollbarHandle }> = [];

    function syncOverlayScrollbars() {
      for (let i = overlayScrollbars.length - 1; i >= 0; i--) {
        if (!overlayScrollbars[i].el.isConnected) {
          overlayScrollbars[i].handle.detach();
          overlayScrollbars.splice(i, 1);
        }
      }
      for (const el of bodyRef.value?.querySelectorAll<HTMLElement>(".hk-md-code, .hk-md-table-scroll") ?? []) {
        if (overlayScrollbars.some((c) => c.el === el)) continue;
        overlayScrollbars.push({ el, handle: attachOverlayScrollbars(el, { axis: "horizontal" }) });
      }
    }

    watch(renderedHtml, () => {
      void nextTick(syncOverlayScrollbars);
    });

    onBeforeUnmount(() => {
      for (const c of overlayScrollbars) c.handle.detach();
      overlayScrollbars.length = 0;
    });

    return () => (
      <div class="hk-markdown" data-plain={props.plain || undefined} data-loading={props.loading}>
        <div ref={bodyRef} class="hk-markdown-body" innerHTML={renderedHtml.value} />
        {props.loading && (
          <div class="hk-markdown-overlay">
            <HSpinner center />
          </div>
        )}
      </div>
    );
  },
});
