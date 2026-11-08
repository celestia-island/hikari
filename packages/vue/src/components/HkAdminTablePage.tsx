import { defineComponent, type Component, type PropType } from "vue";
import { HAlert, HCard, HEmptyState, HSpinner, HTable, useI18n } from "@celestia-island/hikari";
import HkCrossfade from "./HkCrossfade";
import HkScrollProgressDock from "./HkScrollProgressDock";
import { HkPageHeader } from "./HkPageHeader";
import type { HkRowManageGate } from "./HkTable";


/** Column definition passed through to HTable. */
export interface HTableColumn {
  key: string;
  title: string;
  width?: string;
  sortable?: boolean;
  align?: "left" | "center" | "right";
  /** Opt one column out of the click-to-copy layer (see HkTable). */
  copyable?: boolean;
}

/**
 * CRUD table-page scaffold: HkPageHeader + (filter slot) + loading
 * spinner + error alert + empty state + HTable. Slots:
 * - `actions`      — header actions (e.g. a "Create" button)
 * - `filter`       — filter chrome (HkFilterBar) between header and table
 * - `body`         — replaces the default HTable card wholesale (card-list
 *                    rosters, multi-table compounds); loading/error/empty
 *                    states still come from the scaffold
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
    /** Left grip column with drag-to-reorder (forwarded to HTable; the
     *  `reorder` event is forwarded verbatim — indices into `rows`). */
    draggable: { type: Boolean, default: false },
    /** Trailing row-actions column with the standard ⋯ trigger
     *  (forwarded to HTable; see HkTable's `manageable` — pass a
     *  HkRowManageGate to hide/disable the trigger per row). The
     *  `manage` event is forwarded verbatim — (row, opener button). */
    manageable: {
      type: [Boolean, Function] as PropType<HkRowManageGate>,
      default: false,
    },
    /** Authoritative row total the scroll-progress pill uses as its
     *  denominator (the server count behind a paged list — chest's
     *  usePagedTableFetch total). Forwarded to HTable, which
     *  self-registers with the enclosing shell viewport's registrar.
     *  Omitted: the pill falls back to counting the delivered DOM rows.
     *  The SAME number feeds the header's count readout below. */
    total: { type: Number, default: undefined },
    /** Top-right "共 N 条" count readout in the page header (user
     *  direction 2026-11-08: EVERY standard list names its size — the
     *  scaffold owns the wording so pages stop hand-rolling their own
     *  "{n} items" spans). Prefers `total` (the server count behind a
     *  paged list) and falls back to the delivered row count; hidden at
     *  zero so a fresh or empty list shows no "共 0 条" flash. Pages
     *  that render their own count elsewhere set this false. */
    countReadout: { type: Boolean, default: true },
    /** The page's own scroll-progress DOCK (user direction 2026-11-09:
     *  the list large-component uses the dock itself). DEFAULT ON — the
     *  page mounts an HkScrollProgressDock around the body crossfade so
     *  the table (or a body-slot roster) self-registers against it and
     *  the pill floats over the scrolling viewport; the crossfade's
     *  generation swaps happen INSIDE the dock, so the registration
     *  survives every exchange. A page under a shell fallback dock
     *  stands that fallback down automatically (the nested-dock rule);
     *  set `false` to demote the page — lists then fall through to the
     *  nearest enabled dock above, if any. Layering: the shell master
     *  switch (HkFaceShell `scrollProgress`) > this prop > the dock's
     *  own `disabled`. */
    progressDock: { type: Boolean, default: true },
  },
  emits: {
    reorder: (_fromIndex: number, _toIndex: number) => true,
    manage: (_row: Record<string, unknown>, _opener: HTMLElement) => true,
  },
  setup(props, { emit, slots }) {
    return () => {
      const { t } = useI18n();
      const emptyTitle = props.emptyTitle || t("hikari::tablePage.emptyTitle", "No data");
      // The header count readout: the authoritative total when declared,
      // else the delivered rows; hidden at zero (an empty list's empty
      // state already says so — "共 0 条" next to it reads as noise).
      const readoutCount = props.total ?? props.rows.length;
      const countReadout =
        props.countReadout && readoutCount > 0 ? (
          <span
            data-testid="hk-admin-table-page-count"
            style={{
              fontSize: "var(--text-xs, 0.75rem)",
              color: "rgb(var(--color-muted, var(--color-text-secondary)))",
              fontVariantNumeric: "tabular-nums",
              whiteSpace: "nowrap",
            }}
          >
            {t("hikari::tablePage.totalCount", "{n} in total").replace("{n}", String(readoutCount))}
          </span>
        ) : null;
      // Extracted to an identifier: JSX children given as an inline object
      // literal are not normalized to slots the way a bound one is (the
      // chest retrySlots idiom this mirrors relies on the identifier form).
      const emptySlots = slots["empty-action"]
        ? { action: () => slots["empty-action"]?.() }
        : undefined;
      // The readout rides the header's actions row RIGHTMOST — after the
      // page's own actions — and is the band's sole content on a
      // headerless scaffold, so a bare readout never claims a full-width
      // row of its own (the 安全扫描 double-margin report, 2026-11-08).
      const actionsSlot = slots.actions
        ? () => (
            <>
              {slots.actions?.()}
              {countReadout}
            </>
          )
        : countReadout
          ? () => countReadout
          : undefined;
      return (
        <div>
          {props.title ? (
            <HkPageHeader title={props.title} subtitle={props.subtitle} icon={props.icon} dense={props.dense}>
              {{ actions: actionsSlot }}
            </HkPageHeader>
          ) : actionsSlot ? (
            <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: "var(--space-8, 0.5rem)", marginBottom: "var(--space-16, 1rem)" }}>
              {actionsSlot()}
            </div>
          ) : null}
          {slots.filter ? <div class="hk-admin-table-page-filter">{slots.filter()}</div> : null}

          {/* A hard error wins the whole body; the stale banner only rides
           *  above rows that survived a failed refresh, so it must never
           *  render alongside the error branch (its precondition — rows on
           *  screen — is exactly what the error branch removes). */}
          {props.staleError && !props.error ? <HAlert message={props.staleError} /> : null}
          {/* The body is a page slot with three generations — error,
              loading/empty, content (task-4, 2026-10-24): the family
              crossfade owns the exchange, so every admin table page in
              every host dissolves between them instead of popping. The
              key collapses loading-vs-empty into one "placeholder"
              generation: spinner → empty is a data arrival, not a slot
              identity change worth animating.
              The whole exchange rides INSIDE this page's scroll-progress
              dock (default on; `progressDock:false` demotes to a bare
              passthrough): the dock must wrap the CROSSFADE, not sit in
              a generation — a generation-scoped dock would unmount with
              every swap and drop the registration. */}
          <HkScrollProgressDock disabled={!props.progressDock}>
            <HkCrossfade
              swapKey={
                props.error ? "error"
                  : props.loading && !props.rows.length ? "placeholder"
                    : !props.rows.length ? "placeholder"
                      : "content"
              }
            >
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
              ) : slots.body ? (
                <div class="hk-admin-table-page-body">{slots.body()}</div>
              ) : (
                <HCard padded={false}>
                  <HTable
                    columns={props.columns}
                    rows={props.rows}
                    rowKey={props.rowKey}
                    total={props.total}
                    draggable={props.draggable}
                    manageable={props.manageable}
                    onReorder={(from: number, to: number) => emit("reorder", from, to)}
                    onManage={(row: Record<string, unknown>, opener: HTMLElement) =>
                      emit("manage", row, opener)
                    }
                  >
                    {slots}
                  </HTable>
                </HCard>
              )}
            </HkCrossfade>
          </HkScrollProgressDock>
          {slots["create-modal"]?.()}
          {slots["edit-modal"]?.()}
        </div>
      );
    };
  },
});
