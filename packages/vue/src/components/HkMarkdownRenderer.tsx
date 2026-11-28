import { computed, createApp, defineComponent, nextTick, onBeforeUnmount, ref, watch, type App } from "vue";
import type { Renderer, Tokens } from "marked";
import HSpinner from "./HkSpinner";
import HkMermaidDiagram from "./HkMermaidDiagram";
import { applyInlineChipsToBody } from "./inlineChips";
import { attachOverlayScrollbars, type OverlayScrollbarHandle } from "../composables/useOverlayScrollbar";
import { getMermaidEngine } from "../mermaid/engine";
import { isDangerousHref, openHyperlink } from "../runtime/hyperlink";
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

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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
  return escapeHtml(code);
}

function renderPlain(content: string): string {
  return `<pre class="hk-md-plain">${escapeHtml(content)}</pre>`;
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
    // Mermaid fences become carrier blocks; the mounted
    // HkMermaidDiagram sub-apps replace them after the DOM settles (see
    // syncMermaidBlocks). The carrier is a PRE (never a wrapper DIV):
    // a div leading the sanitized string is not universally kept by the
    // sanitize pass, while pre/code survive every observed shape — the
    // mount swaps the carrier for a fresh host div via replaceWith,
    // which never passes through the sanitizer at all.
    // Without a registered engine the fence renders as the ordinary
    // code block below — the exact economy the hljs convention gives
    // syntax highlighting.
    if (lang === "mermaid" && getMermaidEngine()) {
      return `<pre class="hk-md-mermaid-src" data-mermaid="pending"><code>${escapeHtml(text)}</code></pre>`;
    }
    const highlighted = tryHighlight(text, lang);
    // Audit hikari-R1-5: whitelist the language tag before interpolation
    // (depth-in-defence — the final DOMPurify pass remains the primary
    // guard, but this keeps the raw template injection safe on its own).
    const safeLang = lang && /^[a-zA-Z0-9+#._-]{1,32}$/.test(lang) ? lang : "";
    const langAttr = safeLang ? ` language-${safeLang}` : "";
    const langLabel = safeLang ? `<span class="hk-md-code-lang">${safeLang}</span>` : "";
    return `<div class="hk-md-code-wrap"><div class="hk-md-code">${langLabel}<pre><code class="hljs${langAttr}">${highlighted}</code></pre></div></div>`;
  };

  // SECURITY (perfsec follow-up, 2026-11-15): the anchor's HREF attribute
  // must never carry a script scheme — DOMPurify is the primary guard in
  // real browsers, but the delegated click only covers plain activation;
  // middle-click / "open in new tab" reads the attribute directly, and the
  // sanitizer is unreliable under some environments (happy-dom strips odd
  // things — see the mermaid tests). A dangerous href renders as an inert
  // span with NO href at all: nothing to intercept, nothing to open, no
  // dependency on the sanitize pass. Legit custom protocols (vscode:, …)
  // keep their attribute — the coordinator decides on click, same as
  // #1321.
  renderer.link = function (this: Renderer, token: Tokens.Link): string {
    if (isDangerousHref(token.href)) {
      const text = this.parser.parseInline(token.tokens);
      return `<span class="hk-md-link-neutralized" title="link removed: unsafe scheme">${text}</span>`;
    }
    return marked.Renderer.prototype.link.call(this, token);
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
  return sweepDangerousUrlAttributes(DOMPurify.sanitize(html));
}

/**
 * SECURITY (perfsec follow-up, 2026-11-15, review S1): the renderer.link
 * override only sees marked's LINK tokens — raw HTML written straight into
 * the markdown (`<a href="javascript:…">`) rides renderer.html into the
 * sanitize pass, which is exactly the environment-unreliable half this
 * guard exists for. This post-sanitize DOM sweep is the braces: every
 * anchor href and image src in the FINAL html is checked, whatever path
 * produced it (link token, autolink, raw HTML, image token). Dangerous
 * values drop the attribute entirely — the element stays (text/link
 * label visible), the navigation face does not.
 */
function sweepDangerousUrlAttributes(html: string): string {
  if (typeof window === "undefined" || typeof DOMParser === "undefined") return html;
  try {
    const doc = new DOMParser().parseFromString(html, "text/html");
    let swept = false;
    for (const a of [...doc.querySelectorAll("a[href], area[href]")]) {
      if (isDangerousHref(a.getAttribute("href") ?? "")) {
        a.removeAttribute("href");
        swept = true;
      }
    }
    for (const img of [...doc.querySelectorAll("img[src]")]) {
      if (isDangerousHref(img.getAttribute("src") ?? "")) {
        img.removeAttribute("src");
        swept = true;
      }
    }
    if (!swept) return html;
    return doc.body.innerHTML;
  } catch {
    return html;
  }
}

/**
 * Streaming coalescing window, in ms.
 *
 * A streamed reply (chat delta, agent trace, report being assembled) lands
 * one chunk per token batch — many chunks per animation frame — and every
 * chunk used to run the WHOLE pipeline: marked.parse over the entire body,
 * DOMPurify, the DOMParser URL sweep, an innerHTML replacement of a node
 * the browser then re-lays-out, plus a full mermaid re-mount. At n chunks
 * over a body of length L that is O(n·L) parse work for O(L) of visible
 * text, and the DOM writes land far faster than the eye (or the compositor)
 * can use them.
 *
 * Chunks arriving inside one window collapse into a single parse against
 * the LATEST props: the leading edge renders immediately when the renderer
 * is idle (first paint, a settled body), and a change that lands inside the
 * window defers to the window's end. The timer is armed once per window,
 * never re-armed by later chunks — a debounce would starve the render
 * entirely under a chunk every 40ms, and the trailing edge guarantees the
 * final chunk is always rendered.
 */
const STREAM_COALESCE_MS = 50;

export default defineComponent({
  name: "HkMarkdownRenderer",
  props: {
    content: { type: String, required: true },
    loading: { type: Boolean, default: false },
    plain: { type: Boolean, default: false },
    /**
     * Opt-in inline chip pass: fill-template tokens (`{{ name }}`) and
     * asset references (`@level/name`, bare `@name`) inside the
     * rendered prose chip up as `.hk-tpl-chip` spans (refs carry
     * `data-ref`, the muted variant). Applied AFTER sanitize, as pure
     * DOM surgery with `textContent` only — the pass cannot introduce
     * markup, and `code`/`pre`/`a` subtrees are skipped so literal
     * code and link text stay verbatim. Off by default: every existing
     * consumer renders exactly as before.
     */
    inlineChips: { type: Boolean, default: false },
    /**
     * Opaque per-surface tag carried on every link activation this body
     * fires — the host coordinator scopes its resolution with it (the
     * chest tags vendored protocol docs so their relative links map to
     * the docs site). Never interpreted by hikari itself.
     */
    linkContext: { type: String, default: undefined },
  },
  setup(props) {
    const renderedHtml = ref("");
    const parseError = ref(false);
    // Monotonic parse counter: `renderedHtml` does not change when the
    // SAME body is re-parsed for a prop flip, so a watch on it would never
    // fire — and the chip pass mutates the DOM in place, leaving chips
    // behind after `inlineChips` goes back to false.
    const parseSeq = ref(0);

    let coalesceTimer: ReturnType<typeof setTimeout> | null = null;
    let parsePending = false;
    let lastParseStartedAt = Number.NEGATIVE_INFINITY;
    // Monotonic token: a coalesced parse can still overlap the previous one
    // (the marked/DOMPurify imports resolve on their own schedule), and the
    // older one must never overwrite the newer body when it finishes last.
    let parseToken = 0;
    // Parse memo. `renderedHtml` is a pure function of (content, plain) — the
    // sanitize configuration is module-fixed, so nothing else can change the
    // markup. Remembers the source the CURRENT html came from, which lets an
    // `inlineChips` flip (same body, different chrome) re-seat the existing
    // markup instead of paying a second marked+sanitize pass for it.
    let parsedSourceKey: string | null = null;

    function nowMs(): number {
      return typeof performance !== "undefined" && typeof performance.now === "function"
        ? performance.now()
        : Date.now();
    }

    function parseSourceKey(content: string, plain: boolean): string {
      return plain ? `plain\u0000${content}` : `md\u0000${content}`;
    }

    async function parse() {
      const token = (parseToken += 1);
      lastParseStartedAt = nowMs();
      const content = props.content;
      if (!content) {
        renderedHtml.value = "";
        parseError.value = false;
        parsedSourceKey = null;
        // Re-seat the body even when empty: the DOM pass is what prunes the
        // sub-apps and the overlay handles the now-gone content owned.
        parseSeq.value += 1;
        return;
      }
      const plain = props.plain;
      const sourceKey = parseSourceKey(content, plain);
      if (sourceKey === parsedSourceKey) {
        // Same body, different chrome: the markup is already in hand. Bump
        // the sequence so the chip pass re-runs from the pristine html.
        parseSeq.value += 1;
        return;
      }
      parseError.value = false;
      let html: string;
      try {
        html = plain ? renderPlain(content) : await renderMarkdown(content);
      } catch {
        parseError.value = true;
        html = renderPlain(content);
      }
      if (token !== parseToken) return; // a newer parse already owns the body
      renderedHtml.value = html;
      parsedSourceKey = sourceKey;
      parseSeq.value += 1;
    }

    /** @see STREAM_COALESCE_MS — coalesced entry for streaming content. */
    function scheduleParse(): void {
      parsePending = true;
      if (coalesceTimer !== null) return;
      const elapsed = nowMs() - lastParseStartedAt;
      if (elapsed >= STREAM_COALESCE_MS) {
        // Idle leading edge: start now, on the same tick the unfixed
        // renderer always did (first paint, SSR/hydration, a settled body
        // receiving one edit). The window exists only to collect a burst.
        parsePending = false;
        void parse();
        return;
      }
      coalesceTimer = setTimeout(() => {
        coalesceTimer = null;
        if (!parsePending) return;
        parsePending = false;
        void parse();
      }, STREAM_COALESCE_MS - elapsed);
    }

    /** Immediate entry for one-shot prop flips (drop a pending coalesce). */
    function parseNow(): void {
      if (coalesceTimer !== null) {
        clearTimeout(coalesceTimer);
        coalesceTimer = null;
      }
      parsePending = false;
      void parse();
    }

    // Content is the streaming dimension: coalesced (see scheduleParse).
    // `flush: "post"` keeps the parse behind any prop update that landed in
    // the same tick, so it always reads the settled props.
    watch(
      () => props.content,
      () => { scheduleParse(); },
      { immediate: true, flush: "post" },
    );

    // Chrome flips are deliberate one-shot actions, not a stream: render at
    // once (the memo turns an `inlineChips` flip into a DOM re-seat).
    watch(
      () => [props.plain, props.inlineChips],
      () => { parseNow(); },
      { flush: "post" },
    );

    // Overlay scrollbars (shared chrome) on the markdown blocks that can
    // rail horizontally: code blocks and table scrollers. The body is
    // innerHTML-rendered and fully replaced on every parse, so the
    // attachment set is reconciled after each render pass: handles whose
    // block left the DOM detach, fresh blocks attach.
    const bodyRef = ref<HTMLElement>();
    const overlayScrollbars: Array<{ el: HTMLElement; handle: OverlayScrollbarHandle }> = [];

    // Mounted mermaid sub-apps. Each diagram placeholder gets its own
    // createApp instance (the body is innerHTML, not vdom — a sub-app is
    // the only way to mount a component inside it); they are tracked so
    // a re-parse (body replaced wholesale) and the final unmount never
    // leak an app on a detached node.
    //
    // `source` is kept alongside the node so a re-parse can RECOGNISE a
    // diagram whose fence text did not change and hand the existing node
    // (with its live sub-app, board and canvas) into the new slot: the
    // mount is the expensive half of a mermaid block (engine layout), and
    // while streaming every chunk that grows a LATER part of the body
    // re-emits the fences above it byte-identically.
    const mermaidApps: Array<{ el: HTMLElement; app: App; source: string }> = [];

    function syncMermaidBlocks(body: HTMLElement): void {
      const carriers = [...body.querySelectorAll<HTMLElement>('.hk-md-mermaid-src[data-mermaid="pending"]')];
      // Reuse pool: mounted hosts grouped by fence source, in document
      // order, so identical fences pair up one-to-one and predictably.
      const spare = new Map<string, Array<{ el: HTMLElement; app: App; source: string }>>();
      for (const mounted of mermaidApps) {
        const list = spare.get(mounted.source);
        if (list) list.push(mounted);
        else spare.set(mounted.source, [mounted]);
      }
      const kept = new Set<{ el: HTMLElement; app: App; source: string }>();
      if (getMermaidEngine()) {
        for (const carrier of carriers) {
          const source = carrier.querySelector("code")?.textContent ?? "";
          const reuse = spare.get(source)?.shift();
          if (reuse) {
            // Same fence text → the same rendered diagram: splice the live
            // node into the re-seated body instead of unmounting it here
            // and mounting a byte-identical one a millisecond later.
            carrier.replaceWith(reuse.el);
            kept.add(reuse);
            continue;
          }
          const host = document.createElement("div");
          host.className = "hk-md-mermaid";
          host.dataset.mermaid = "mounted";
          carrier.replaceWith(host);
          // Report contexts are narrow reading panes: the minimap is noise,
          // so this host opts out of the overview AND its fit reserve. It still
          // inherits the shared readable viewport policy deliberately (40vh
          // auto cap, linear zoom, fitCap 1) rather than the old unbounded
          // suggested height and 1.25 fit ceiling.
          const app = createApp(HkMermaidDiagram, { source, minimap: false, interactive: true });
          app.mount(host);
          kept.add({ el: host, app, source });
        }
      }
      // Everything not carried into this pass belongs to a fence that is
      // gone from the body (or to a render with no engine): retire it.
      for (const mounted of mermaidApps) {
        if (!kept.has(mounted)) mounted.app.unmount();
      }
      mermaidApps.length = 0;
      mermaidApps.push(...kept);
    }

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

    watch(parseSeq, () => {
      void nextTick(() => {
        const body = bodyRef.value;
        if (!body) return;
        // Re-seat the DOM on the pristine rendered HTML first: the chip
        // pass mutates it in place, so a prop flip must start from the
        // un-chipped markup (assigning the string Vue already patched is
        // idempotent; when the body did not change it is the only write).
        body.innerHTML = renderedHtml.value;
        // The chip pass runs BEFORE the overlay scan: it splits text
        // nodes, so the scan must reconcile against the final DOM.
        if (props.inlineChips) applyInlineChipsToBody(body);
        syncOverlayScrollbars();
        // Mermaid mounts last: it replaces its carrier subtrees
        // wholesale, which would orphan anything attached inside them.
        syncMermaidBlocks(body);
      });
    });

    onBeforeUnmount(() => {
      // A stream can still be mid-flight at teardown: the pending coalesce
      // must not fire a parse (and a body write) on an unmounted component.
      if (coalesceTimer !== null) {
        clearTimeout(coalesceTimer);
        coalesceTimer = null;
      }
      parsePending = false;
      parseToken += 1;
      for (const c of overlayScrollbars) c.handle.detach();
      overlayScrollbars.length = 0;
      for (const m of mermaidApps) m.app.unmount();
      mermaidApps.length = 0;
    });

    // THE link path (runtime/hyperlink.ts): every anchor this body
    // renders activates through the coordinator — a plain browser opens a
    // new tab, the native shell hands the URL to the system browser, and
    // the webview itself NEVER navigates (the 2026-11-12 protocol-modal
    // 404 was exactly an anchor left to its default behavior). All
    // modifier combos intercept too: ctrl/middle-click on the desktop
    // would otherwise navigate the app window the same way.
    function onBodyClick(event: MouseEvent): void {
      const target = event.target as HTMLElement | null;
      const anchor = target?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor) return;
      event.preventDefault();
      void openHyperlink(anchor.getAttribute("href") ?? "", {
        source: "markdown",
        ...(props.linkContext !== undefined ? { linkContext: props.linkContext } : {}),
      });
    }

    return () => (
      <div class="hk-markdown" data-plain={props.plain || undefined} data-loading={props.loading}>
        <div
          ref={bodyRef}
          class="hk-markdown-body"
          innerHTML={renderedHtml.value}
          onClick={onBodyClick}
        />
        {props.loading && (
          <div class="hk-markdown-overlay">
            <HSpinner center />
          </div>
        )}
      </div>
    );
  },
});
