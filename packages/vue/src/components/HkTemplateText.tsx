import { computed, defineComponent, type PropType } from "vue";

import {
  formatTokenDisplay,
  parseTemplate,
  templateTokenIndex,
  type HkTemplateTokenDef,
} from "./templateGrammar";
import "./HkTemplateField.scss";

/**
 * HkTemplateText — the read-only half of the fill-template surfaces.
 *
 * Renders a `{{ token }}` template with each token as an inline chip
 * (the same chip style the HkTemplateField editor types into), so a
 * stored template reads the same in a row, a card or a detail view as
 * it does in the editor that produced it. Pure display: the accessible
 * text content IS the raw template (screen readers read the exact
 * value), the chips only style it.
 *
 * - tokens outside the host vocabulary still chip up, marked
 *   `data-unknown` (a renderer must not silently hide a value it does
 *   not understand);
 * - `tokens` descriptions become the chip `title`, so a rendered row
 *   still explains itself on hover;
 * - `multiline` swaps inline flow for a wrapping block (long URLs in
 *   narrow columns).
 */
export const HkTemplateText = defineComponent({
  name: "HkTemplateText",
  props: {
    /** The raw template string, verbatim from storage. */
    content: { type: String, required: true },
    /** Vocabulary for descriptions / unknown marking. Optional. */
    tokens: {
      type: Array as PropType<readonly HkTemplateTokenDef[]>,
      default: () => [],
    },
    /** Wrap as a block (long URLs) instead of one inline run. */
    multiline: { type: Boolean, default: false },
  },
  setup(props) {
    const segments = computed(() => parseTemplate(props.content));
    const index = computed(() => templateTokenIndex(props.tokens));

    return () => (
      <span class="hk-template-text" data-multiline={props.multiline || undefined}>
        {segments.value.map((seg, i) =>
          seg.kind === "text" ? (
            <span key={i} class="hk-template-text-run">{seg.text}</span>
          ) : (
            <span
              key={i}
              class="hk-tpl-chip"
              data-unknown={index.value.has(seg.token) ? undefined : ""}
              data-static=""
              title={index.value.get(seg.token)?.description || undefined}
            >
              {formatTokenDisplay(seg.token)}
            </span>
          ),
        )}
      </span>
    );
  },
});

export default HkTemplateText;
