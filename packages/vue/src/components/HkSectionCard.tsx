import { defineComponent, type Component, type PropType } from "vue";

import HkAlert from "./HkAlert";
import HkCard from "./HkCard";
import { HkSectionHeader } from "./HkSectionHeader";
import HkSpinner from "./HkSpinner";
import "./HkSectionCard.scss";

/**
 * HkSectionCard — the standard titled SECTION: a heading (with an optional
 * hint line) above ONE card that carries the body.
 *
 * This is the section-level twin of the page-level scaffold
 * (`HkAdminTablePage`): a page whose content is several lists (settings
 * categories, tab panels, dashboards) renders each as an HkSectionCard, so
 * the heading→body rhythm, the hint typography and the body padding come
 * from ONE definition instead of every caller hand-rolling `mt-3`,
 * `p-4`/`padded={false}` wrappers and its own hint classes — the drift the
 * 2026-10-05 audit found between two tabs of the same page (one table flush
 * in the card with its hint above, the other wrapped in a padded div with
 * its hint below).
 *
 * The body states follow `HkAdminTablePage`'s contract: `error` replaces
 * the body with an alert, `loading` with a centred spinner — both inside a
 * PADDED card (a state is content, not a table), while the normal body
 * honours `padded` (default false: tables carry their own cell padding and
 * sit flush in the card). `error` wins when both are set, as on the
 * scaffold.
 *
 * One deliberate difference from the scaffold: `loading` replaces the body
 * whenever it is true, where `HkAdminTablePage` only replaces an EMPTY body
 * (`loading && !rows.length`) and keeps populated rows on screen through a
 * refresh. A section therefore passes `loading` for its FIRST load, not for
 * every refetch — or it blanks a table the user is reading.
 *
 * ```tsx
 * <HkSectionCard title={t("…")} hint={t("…")} loading={loading}>
 *   <HkTable columns={columns} rows={rows} rowKey="id">{…}</HkTable>
 * </HkSectionCard>
 * ```
 */
export const HkSectionCard = defineComponent({
  name: "HkSectionCard",
  props: {
    title: { type: String, required: true },
    /** Explanatory line under the heading — the standard place for the
     *  "what this list is for" copy every section used to spell its own. */
    hint: { type: String, default: undefined },
    icon: { type: [Object, Function] as PropType<Component>, default: undefined },
    level: { type: String as PropType<"h2" | "h3" | "div">, default: "h3" },
    /** Trailing count beside the title (e.g. "3"). */
    count: { type: String, default: undefined },
    /** Tighter header spacing for dense panels. */
    dense: { type: Boolean, default: false },
    /** Hard failure: replaces the body with an alert. */
    error: { type: String, default: undefined },
    /** In-flight: replaces the body with a centred spinner. */
    loading: { type: Boolean, default: false },
    /** Body padding for non-table content (tables stay flush). */
    padded: { type: Boolean, default: false },
    /** Heading level only; visual size is fixed by the header styles. */
  },
  setup(props, { slots }) {
    return () => {
      const state = props.error ? "error" : props.loading ? "loading" : "body";
      // Hoisted to an identifier: the CONDITIONAL inline form
      // (`{slots.actions ? { actions: … } : undefined}` as children) lands in
      // a child array, where the plain object is no longer normalized to
      // slots and the button silently disappears. Hoisting fixes it; the
      // bare inline literal happens to work, which is exactly why the
      // conditional one is a trap.
      const headerSlots =
        slots.actions || slots.description
          ? {
              actions: () => slots.actions?.(),
              description: () => slots.description?.(),
            }
          : undefined;
      return (
        <section class="hk-section-card">
          <HkSectionHeader
            title={props.title}
            description={props.hint}
            icon={props.icon}
            level={props.level}
            count={props.count}
            dense={props.dense}
          >
            {headerSlots}
          </HkSectionHeader>
          <HkCard padded={state === "body" ? props.padded : true}>
            {state === "error" ? (
              <HkAlert message={props.error!} />
            ) : state === "loading" ? (
              <HkSpinner center />
            ) : (
              slots.default?.()
            )}
          </HkCard>
        </section>
      );
    };
  },
});

export default HkSectionCard;
