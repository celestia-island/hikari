# Table 表格

表格元件用於展示結構化資料。

## 基礎用法

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

| 屬性 | 說明 | 類型 | 預設值 |
|------|------|------|--------|
| columns | 欄位定義 | Vec\<Column\> | - |
| data | 資料來源 | Vec\<T\> | - |

## 可編輯表格

`HkEditableTable` 是**組合在 `HkTable` 之上**的內聯編輯外殼——網格、表頭節奏、懸停、分組帶與結構仍歸 `HkTable`；外殼只增加可編輯儲存格、新增／移除入口與逐列驗證。它是完全**受控**的：宿主擁有列物件與陣列，並自行套用 `add` / `remove(row, index)` 意圖。外殼從不修改任何列，因此復原堆疊或伺服器端草稿始終可行。

```hikari:tsx
<HkEditableTable
  columns={[
    { key: "tier", title: "方案" },
    { key: "price", title: "單價", align: "right" },
  ]}
  rows={rows}
  rowKey="id"
  canAdd
  canRemove={() => rows.length > 1}
  validate={(row) => (row.price ? null : "單價不可為空")}
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
    "row-error": ({ index, error }) => <span>第 {index + 1} 列：{error}</span>,
  }}
</HkEditableTable>
```

插槽契約：`cell-<key>` 渲染欄位的顯示形態（省略時用 `HkTable` 的 `row[key]` 文字），`edit-<key>` 渲染宿主自己的編輯器——啟用狀態下優先，`disabled` 時改用顯示插槽，因此同一張表無須重寫插槽即可變成唯讀；`row-error` 渲染一列的錯誤行（省略時為本地化的「第 N 列：訊息」）。所有儲存格插槽都會收到 `{ row, value, index, error, errorId, disabled }`；把 `errorId` 綁定到編輯器的 `aria-describedby`，驗證訊息就會隨欄位一起被讀出。錯誤行渲染在元件內部（絕不在頁面框架裡），以 `rowKey` 為鍵，並透過禮貌播報區域朗讀。

| 屬性 | 說明 | 類型 | 預設值 |
|------|------|------|--------|
| columns | 欄位定義 | HkEditableColumn[] | — |
| rows | 宿主擁有的列（絕不修改） | Record\<string, unknown\>[] | [] |
| rowKey | 列識別欄位 | string | — |
| validate | 純函式逐列驗證器 | (row, rows) => string \| null | — |
| canAdd / canRemove | 渲染新增帶／逐列移除入口 | bool / (row) => bool | false / — |
| addLabel / emptyText / caption | 本地化文案覆寫 | string | — |
| disabled | 唯讀模式（編輯器回退到顯示插槽） | bool | false |
