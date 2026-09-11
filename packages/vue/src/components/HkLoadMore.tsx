import { defineComponent, type PropType } from "vue";

import "./HkLoadMore.scss";
import { useI18n } from "../i18n/context";
import HButton from "./HkButton";

/**
 * The unified bottom indicator for dynamically loaded lists — one look
 * for every consumer (cruise panels, tables, feeds), three states:
 *
 * - `idle`: a ghost load-more button; clicking emits `loadMore`.
 * - `loading`: the SAME button with its built-in spinner (HkButton
 *   swaps in an HSpinner while loading) — no second spinner here, the
 *   affordance morphs in place at a stable height.
 * - `end`: a muted "reached the end" note replacing the button.
 *
 * Optional `shown`/`total` render a tabular mono counter next to the
 * control in every state ("3 / 19"), giving users the delivery
 * progress without each app inventing its own wording.
 */
export default defineComponent({
  name: "HkLoadMore",
  props: {
    state: { type: String as PropType<"idle" | "loading" | "end">, default: "idle" },
    /** Delivered item count (with `total`, renders the progress counter). */
    shown: { type: Number, default: undefined },
    /** Full item count behind the windowed list. */
    total: { type: Number, default: undefined },
  },
  emits: ["loadMore"],
  setup(props, { emit }) {
    const { t } = useI18n();
    return () => {
      const hasCount =
        typeof props.shown === "number" && typeof props.total === "number";
      const loading = props.state === "loading";
      return (
        <div class="hk-load-more" data-state={props.state}>
          <span class="hk-load-more-rule" aria-hidden="true" />
          <span class="hk-load-more-core">
            {props.state === "end" ? (
              <span class="hk-load-more-end" role="status">
                {t("hikari::loadMore.end", "You've reached the end")}
              </span>
            ) : (
              <HButton
                variant="ghost"
                size="sm"
                icon="ChevronDown"
                loading={loading}
                aria-label={
                  loading
                    ? t("hikari::loadMore.loading", "Loading…")
                    : t("hikari::loadMore.more", "Load more")
                }
                onClick={() => emit("loadMore")}
              >
                {loading
                  ? t("hikari::loadMore.loading", "Loading…")
                  : t("hikari::loadMore.more", "Load more")}
              </HButton>
            )}
            {hasCount ? (
              <span class="hk-load-more-count">{props.shown} / {props.total}</span>
            ) : null}
          </span>
          <span class="hk-load-more-rule hk-load-more-rule-end" aria-hidden="true" />
        </div>
      );
    };
  },
});
