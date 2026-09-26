import { defineComponent, type Component, type PropType } from "vue";
import { HAlert, HCard, HEmptyState, HSpinner, HTable, useI18n } from "@celestia-island/hikari";
import { HkPageHeader } from "./HkPageHeader";


/** Column definition passed through to HTable. */
export interface HTableColumn {
  key: string;
  title: string;
  width?: string;
  sortable?: boolean;
  align?: "left" | "center" | "right";
}

/**
 * CRUD table-page scaffold: HkPageHeader + (filter slot) + loading
 * spinner + error alert + empty state + HTable. Slots:
 * - `actions`      — header actions (e.g. a "Create" button)
 * - `filter`       — filter chrome (HkFilterBar) between header and table
 * - `cell-<key>`   — per-column cell templates, forwarded to HTable
 * - `empty-action` — action inside the empty state (Retry, …)
 * - `create-modal` — create dialog, rendered after the table
 * - `edit-modal`   — edit dialog, rendered after the table
 *
 * Error model: `error` is the hard failure (no data — replaces the
 * table), while `staleError` renders a banner ABOVE rows that are still
 * on screen after a failed refresh, so a failed reload never hides data
 * the user already had.
 */
export const HkAdminTablePage = defineComponent({
  name: "HkAdminTablePage",
  props: {
    title: { type: String, default: "" },
    /** Forwarded to the page header. */
    subtitle: { type: String, default: undefined },
    /** Forwarded to the page header. */
    icon: { type: [Object, Function] as PropType<Component>, default: undefined },
    /** Compact page header variant. */
    dense: { type: Boolean, default: false },
    loading: { type: Boolean, default: false },
    error: { type: String as PropType<string | undefined>, default: undefined },
    /** Refresh failed while rows are still on screen — banner, not a
     *  replacement of the table. */
    staleError: { type: String as PropType<string | undefined>, default: undefined },
    rows: { type: Array as PropType<Record<string, unknown>[]>, required: true },
    columns: { type: Array as PropType<HTableColumn[]>, required: true },
    rowKey: { type: String, default: "id" },
    emptyTitle: { type: String, default: "" },
    emptyDescription: { type: String as PropType<string | undefined>, default: undefined },
  },
  setup(props, { slots }) {

    return () => {
      const { t } = useI18n();
      const emptyTitle = props.emptyTitle || t("hikari::tablePage.emptyTitle", "No data");
      // Extracted to an identifier: JSX children given as an inline object
      // literal are not normalized to slots the way a bound one is (the
      // chest retrySlots idiom this mirrors relies on the identifier form).
      const emptySlots = slots["empty-action"]
        ? { action: () => slots["empty-action"]?.() }
        : undefined;
      return (
        <div>
          {props.title ? (
            <HkPageHeader title={props.title} subtitle={props.subtitle} icon={props.icon} dense={props.dense}>
              {{ actions: () => slots.actions?.() }}
            </HkPageHeader>
          ) : slots.actions ? (
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "var(--space-16, 1rem)" }}>
              {slots.actions()}
            </div>
          ) : null}
          {slots.filter ? <div class="hk-admin-table-page-filter">{slots.filter()}</div> : null}

          {props.staleError ? <HAlert message={props.staleError} /> : null}
          {props.error ? (
            <HAlert message={props.error} />
          ) : props.loading && !props.rows.length ? (
            <HSpinner center />
          ) : !props.rows.length ? (
            <HEmptyState
              boxed
              title={emptyTitle}
              description={props.emptyDescription}
            >
              {emptySlots}
            </HEmptyState>
          ) : (
            <HCard padded={false}>
              <HTable columns={props.columns} rows={props.rows} rowKey={props.rowKey}>
                {slots}
              </HTable>
            </HCard>
          )}
          {slots["create-modal"]?.()}
          {slots["edit-modal"]?.()}
        </div>
      );
    };
  },
});
