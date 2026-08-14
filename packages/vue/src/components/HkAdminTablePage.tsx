import { defineComponent, type PropType } from "vue";
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
 * CRUD table-page scaffold: HkPageHeader + loading spinner + error alert +
 * empty state + HTable. Slots:
 * - `actions`      — header actions (e.g. a "Create" button)
 * - `cell-<key>`   — per-column cell templates, forwarded to HTable
 * - `create-modal` — create dialog, rendered after the table
 * - `edit-modal`   — edit dialog, rendered after the table
 */
export const HkAdminTablePage = defineComponent({
  name: "HkAdminTablePage",
  props: {
    title: { type: String, default: "" },
    loading: { type: Boolean, default: false },
    error: { type: String as PropType<string | undefined>, default: undefined },
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
      return (
        <div>
          {props.title ? (
            <HkPageHeader title={props.title}>
              {{ actions: () => slots.actions?.() }}
            </HkPageHeader>
          ) : slots.actions ? (
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "var(--space-16, 1rem)" }}>
              {slots.actions()}
            </div>
          ) : null}
          {props.error ? (
            <HAlert message={props.error} />
          ) : props.loading && !props.rows.length ? (
            <HSpinner center />
          ) : !props.rows.length ? (
            <HEmptyState title={emptyTitle} description={props.emptyDescription} />
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
