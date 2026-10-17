import { defineComponent, type PropType } from "vue";

import "./HkQuote.scss";

/** The tone grammar of the quote's accent bar. */
export type HkQuoteTone = "primary" | "neutral" | "danger" | "warning" | "success";

/**
 * HkQuote — the Markdown-blockquote-style info block.
 *
 * The house grammar for "this surface has something to SAY, not
 * something to show": a vertical accent bar in the tone color on the
 * inline-start edge, the message set as quoted prose beside it — the
 * same visual language a Markdown `>` blockquote renders with, promoted
 * to a first-class component with tone and centering. The bar hugs the
 * prose (the block sizes to its content, like a real blockquote); the
 * OUTER box centers that block inside the host.
 *
 * Deliberately NOT an empty-state card: there is no icon, no boxed
 * surface, no chrome of its own — hosts that want the message centered
 * in an otherwise empty body pass `fit="fill"` (the block centers
 * itself in the host) or `fit="page"` (a standalone, width-capped,
 * horizontally centered block). The optional `action` slot renders a
 * quiet row of buttons under the prose (e.g. "Edit panel", "Retry") —
 * affordances belong to the host's story, never chrome bolted onto the
 * quote.
 *
 * ```tsx
 * // A panel that was never generated: quote it, don't card it.
 * <HkQuote tone="primary" fit="fill"
 *   title={t("viewPanel.empty.panelNoContent")}
 *   description={t("viewPanel.empty.panelNoContentDesc")}>
 *   {{ action: () => <HkButton size="sm" onClick={edit}>Edit panel</HkButton> }}
 * </HkQuote>
 * ```
 *
 * A11y: the block is a `role="note"` region by default; pass
 * `role="alert"` (or any other attrs) from the call site for error
 * tones — attrs land on the root element.
 */
export default defineComponent({
  name: "HkQuote",
  props: {
    /** Lead line — the quoted statement itself. Bold, primary text. */
    title: { type: String, default: undefined },
    /** Follow-up prose — context or the way out. Muted, smaller. */
    description: { type: String, default: undefined },
    /** The accent bar's color grammar. Default: the primary tone. */
    tone: {
      type: String as PropType<HkQuoteTone>,
      default: "primary",
    },
    /** page = standalone, centered, width-capped block; fill = the
     *  block centers itself inside its host (panels, split views). */
    fit: {
      type: String as PropType<"page" | "fill">,
      default: "fill",
    },
  },
  setup(props, { slots }) {
    return () => (
      <div
        class={[
          "hk-quote",
          `hk-quote--${props.tone}`,
          props.fit === "fill" ? "hk-quote--fill" : "hk-quote--page",
        ]}
        role="note"
      >
        <div class="hk-quote-mark">
          <div class="hk-quote-body">
            {props.title ? <p class="hk-quote-title">{props.title}</p> : null}
            {props.description ? (
              <p class="hk-quote-desc">{props.description}</p>
            ) : null}
            {slots.default?.()}
          </div>
          {slots.action ? (
            <div class="hk-quote-action">{slots.action()}</div>
          ) : null}
        </div>
      </div>
    );
  },
});
