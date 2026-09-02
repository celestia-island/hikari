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
 * The label column is auto-sized: after mount (and whenever the label set
 * or the document fonts change) the component measures the widest label
 * text and publishes it as `--auth-methods-label-width` on its wrapper,
 * so the aligned text region hugs the longest label instead of a blind
 * hardcoded width. Consumers can still override the var explicitly.
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

    /** Measure the widest label text and publish it as the label-column
     *  width custom property. Each span is momentarily set to
     *  `max-content` while reading: a plain `scrollWidth` on the fixed
     *  column would report `max(textWidth, columnWidth)` and the column
     *  could never shrink below its fallback. All reads happen inside one
     *  synchronous task, so no intermediate paint is observable. */
    function measure() {
      const root = listRef.value;
      if (!root) return;
      let widest = 0;
      for (const label of root.querySelectorAll<HTMLElement>(".s-auth-methods-label")) {
        const previous = label.style.width;
        label.style.width = "max-content";
        widest = Math.max(widest, label.scrollWidth);
        label.style.width = previous;
      }
      if (widest > 0) root.style.setProperty("--auth-methods-label-width", `${widest}px`);
    }

    onMounted(() => {
      void nextTick(measure);
      // Webfonts change text metrics after first paint; re-measure when
      // they finish loading (no-op in environments without document.fonts).
      if (typeof document !== "undefined" && document.fonts?.ready) {
        void document.fonts.ready.then(measure).catch(() => {});
      }
    });
    onBeforeUnmount(() => {
      listRef.value?.style.removeProperty("--auth-methods-label-width");
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
