import { defineComponent, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import HkButton from "./HkButton";
import "./HkAuthMethodList.scss";

/**
 * HkAuthMethodList — full-width stacked third-party sign-in buttons for
 * auth cards (the ERP login's provider-button grammar, componentized).
 *
 * Every button renders [icon | label] with a FIXED icon column and a FIXED
 * label column, so the icons and the label text start at the same x on
 * every row regardless of label length; because every content block is
 * then the same width, the row can stay centered like any HkButton
 * without the columns drifting.
 *
 * The label column is auto-sized: after mount (and whenever the label set,
 * the document fonts, the browser zoom, or the container size change) the
 * component measures the widest label text and publishes it as
 * `--auth-methods-label-width` on its wrapper, so the aligned text region
 * hugs the longest label instead of a blind hardcoded width. The measured
 * fraction is rounded UP with a 1px margin — the column is always strictly
 * wider than the longest label, so the text can never overflow into an
 * ellipsis. Labels are centered within that shared column, keeping every
 * row's text on the same vertical center line. Consumers can still
 * override the var explicitly.
 *
 * The wrapper is `display: contents`: the component keeps a DOM node for
 * measurement and CSS-var inheritance while the buttons remain direct
 * layout children of HkAuthCard's `.s-auth-methods` slot container.
 */
export default defineComponent({
  name: "HkAuthMethodList",
  props: {
    /** Optional divider text rendered above the buttons, e.g. "其他方式登录".
     *  Consumer-localized on purpose: hikari ships no dictionary dependency
     *  onto hosts here. */
    divider: { type: String, default: "" },
    /** Provider entries, in render order. */
    methods: {
      type: Array as unknown as () => Array<{
        key: string;
        label: string;
        /** Prebuilt icon vnode (brand SVG, <img>, …) — `null` renders an
         *  empty fixed-width column so the labels still align. Typed loose
         *  on purpose (same as HkAltSignIn entries): hosts materialize
         *  hikari against their own vue store, and a hard VNode type
         *  breaks typecheck whenever the host's vue minor differs. The
         *  value renders as-is inside the fixed-size column. */
        icon?: unknown;
        disabled?: boolean;
      }>,
      required: true,
    },
  },
  emits: {
    /** A method button was clicked. */
    select: (_key: string) => true,
  },
  setup(props, { emit, expose }) {
    const listRef = ref<HTMLDivElement | null>(null);

    let resizeObserver: ResizeObserver | undefined;
    const onResize = () => void nextTick(measure);
    const onFontsReady = () => measure();

    /** Measure the widest label text and publish it as the label-column
     *  width custom property. Each span is momentarily set to
     *  `max-content` while reading: a plain `scrollWidth` on the fixed
     *  column would report `max(textWidth, columnWidth)` and the column
     *  could never shrink below its fallback. All reads happen inside one
     *  synchronous task, so no intermediate paint is observable.
     *
     *  Precision: the widest width is read as a fractional
     *  `getBoundingClientRect()` (not the integer `scrollWidth`) and
     *  rounded UP with a 1px margin before publishing. An integer read can
     *  round the longest label DOWN (some engines floor it), pinning its
     *  column exactly on the glyph boundary — then any sub-pixel
     *  font-metric difference (zoom, DPR, engine) makes that one label
     *  overflow and render an ellipsis while the shorter rows stay fine.
     *  The headroom keeps the longest label strictly inside its column. */
    function measure() {
      const root = listRef.value;
      if (!root) return;
      let widest = 0;
      for (const label of root.querySelectorAll<HTMLElement>(".s-auth-methods-label")) {
        const previous = label.style.width;
        label.style.width = "max-content";
        widest = Math.max(widest, label.getBoundingClientRect().width);
        label.style.width = previous;
      }
      // Guard: only publish when real text metrics were observed, so a
      // hidden / zero-size frame keeps the CSS `max-content` fallback
      // instead of collapsing the column to a clipping 1px.
      if (widest > 0) {
        root.style.setProperty("--auth-methods-label-width", `${Math.ceil(widest) + 1}px`);
      }
      // Keep observing every rendered row so a layout change (the panel
      // becoming visible, a container width change) re-measures. Rows are
      // full-width `.hk-btn-block`, so publishing the column width never
      // resizes them (no feedback loop into the observer).
      if (resizeObserver) {
        for (const button of root.querySelectorAll<HTMLElement>(".hk-btn")) {
          resizeObserver.observe(button);
        }
      }
    }

    onMounted(() => {
      void nextTick(measure);
      // Webfonts change text metrics after first paint; re-measure when
      // they finish loading (no-op in environments without document.fonts).
      if (typeof document !== "undefined" && document.fonts) {
        void document.fonts.ready.then(measure).catch(() => {});
        document.fonts.addEventListener?.("loadingdone", onFontsReady);
      }
      // Browser zoom and container-width changes reflow the text; without a
      // re-measure the published column goes stale and the longest label
      // overflows into the ellipsis. `resize` covers page zoom; the
      // ResizeObserver covers the panel appearing / the container resizing.
      if (typeof window !== "undefined") {
        window.addEventListener("resize", onResize);
        if (!resizeObserver && typeof ResizeObserver !== "undefined") {
          resizeObserver = new ResizeObserver(onResize);
        }
      }
    });
    onBeforeUnmount(() => {
      listRef.value?.style.removeProperty("--auth-methods-label-width");
      resizeObserver?.disconnect();
      resizeObserver = undefined;
      if (typeof window !== "undefined") {
        window.removeEventListener("resize", onResize);
      }
      if (typeof document !== "undefined" && document.fonts) {
        document.fonts.removeEventListener?.("loadingdone", onFontsReady);
      }
    });
    watch(
      () => props.methods.map((method) => method.label).join("\u0000"),
      () => {
        void nextTick(measure);
      },
    );

    expose({ measure });

    return () => (
      <div class="s-auth-methods-list" ref={listRef}>
        {props.divider && (
          <div class="s-auth-methods-divider">
            <span>{props.divider}</span>
          </div>
        )}
        {props.methods.map((method) => (
          <HkButton
            key={method.key}
            variant="outline"
            size="md"
            block
            disabled={method.disabled === true}
            onClick={() => emit("select", method.key)}
          >
            <span class="s-auth-methods-icon">{method.icon}</span>
            <span class="s-auth-methods-label">{method.label}</span>
          </HkButton>
        ))}
      </div>
    );
  },
});
