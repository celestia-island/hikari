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
 * control in the idle / loading states ("3 / 19"); in the `end` state
 * the sentence itself carries the 共计 total, so the counter stands
 * down there (user direction 2026-11-08).
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
      // The end sentence CARRIES the count (user direction 2026-11-08:
      // "已全部列出，共计 N 条" — the old terse note made the user count
      // the delivered rows themselves). The known count is the declared
      // total when present, else the delivered rows; with neither the
      // generic note renders.
      const endCount =
        typeof props.total === "number"
          ? props.total
          : typeof props.shown === "number"
            ? props.shown
            : null;
      const endNote =
        endCount !== null && endCount > 0
          ? t("hikari::loadMore.endTotal", "All {n} items listed").replace(
              "{n}",
              String(endCount),
            )
          : t("hikari::loadMore.end", "All items listed");
      return (
        <div class="hk-load-more" data-state={props.state}>
          <span class="hk-load-more-rule" aria-hidden="true" />
          <span class="hk-load-more-core">
            {props.state === "end" ? (
              <span class="hk-load-more-end" role="status">
                {endNote}
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
            {/* The mono counter stays an idle/loading affordance only —
             * in the end state the sentence itself carries 共计, and a
             * second "12 / 12" beside it read as duplication. */}
            {hasCount && props.state !== "end" ? (
              <span class="hk-load-more-count">{props.shown} / {props.total}</span>
            ) : null}
          </span>
          <span class="hk-load-more-rule hk-load-more-rule-end" aria-hidden="true" />
        </div>
      );
    };
  },
});
