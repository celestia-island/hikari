# Table

Table component for displaying structured data.

## Basic Usage

```hikari
rsx! {
    div { style: "padding:1rem;",
        table { style: "border-collapse:collapse;width:100%;font-size:14px;",
            thead { tr { th { style: "border:1px solid #e2e2ea;padding:8px;background:#f7f7fa;text-align:left;", "Name" }
                         th { style: "border:1px solid #e2e2ea;padding:8px;background:#f7f7fa;text-align:left;", "Status" } } }
            tbody { tr { td { style: "border:1px solid #e2e2ea;padding:8px;", "Task A" }
                         td { style: "border:1px solid #e2e2ea;padding:8px;color:#22c55e;", "Done" } } }
        }
    }
}
```

## API

| Property | Description | Type | Default |
|----------|-------------|------|---------|
| columns | Column definitions | Vec\<Column\> | - |
| data | Data source | Vec\<T\> | - |

## Editable Table

`HkEditableTable` is an inline-editing shell **composed on `HkTable`** — the grid, header rhythm, hover, section bands and structure stay in `HkTable`; the shell adds editable cells, the add/remove affordances and per-row validation. It is fully **controlled**: the host owns the row objects and the array and applies the `add` / `remove(row, index)` intents itself. The shell never mutates a row, so an undo stack or a server draft stays possible.

```hikari:tsx
<HkEditableTable
  columns={[
    { key: "tier", title: "Tier" },
    { key: "price", title: "Unit price", align: "right" },
  ]}
  rows={rows}
  rowKey="id"
  canAdd
  canRemove={() => rows.length > 1}
  validate={(row) => (row.price ? null : "Unit price is required")}
  onAdd={() => rows.push(draftRow())}
  onRemove={(row) => rows.splice(rows.indexOf(row), 1)}
>
  {{
    "cell-tier": ({ row }) => <span>{row.tier}</span>,
    "edit-price": ({ row, error, errorId }) => (
      <HkMoneyInput
        currency={usd}
        error={error ?? undefined}
        aria-describedby={errorId ?? undefined}
        modelValue={row.price}
        onUpdate:modelValue={(next: string) => (row.price = next)}
      />
    ),
    "row-error": ({ index, error }) => <span>Row {index + 1}: {error}</span>,
  }}
</HkEditableTable>
```

Slot contract: `cell-<key>` renders a column's display (omitted: `HkTable`'s `row[key]` text), `edit-<key>` renders the host's editor — it wins while the table is enabled, and with `disabled` the display slot is used, so the same grid becomes read-only without re-slotting anything — and `row-error` renders one invalid row's line (omitted: the localized "Row N: message"). Every cell slot receives `{ row, value, index, error, errorId, disabled }`; bind `errorId` to the editor's `aria-describedby` so the message is read with the field. The error lines live inside the component (never in page chrome), keyed by `rowKey`, announced in a polite live region.

| Property | Description | Type | Default |
|----------|-------------|------|---------|
| columns | Column definitions | HkEditableColumn[] | — |
| rows | Host-owned rows (never mutated) | Record\<string, unknown\>[] | [] |
| rowKey | Row identity field | string | — |
| validate | Pure per-row validator | (row, rows) => string \| null | — |
| canAdd / canRemove | Render the add band / the per-row remove affordance | bool / (row) => bool | false / — |
| addLabel / emptyText / caption | Localized copy overrides | string | — |
| disabled | Read-only mode (editors fall back to display slots) | bool | false |
