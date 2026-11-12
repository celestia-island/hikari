# Table 表格

表格组件用于展示结构化数据。

## 基础用法

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

| 属性 | 说明 | 类型 | 默认值 |
|------|------|------|--------|
| columns | 列定义 | Vec\<Column\> | - |
| data | 数据源 | Vec\<T\> | - |

## 可编辑表格

`HkEditableTable` 是**组合在 `HkTable` 之上**的内联编辑外壳——网格、表头节奏、悬停、分组带与结构仍归 `HkTable`；外壳只增加可编辑单元格、增删入口与逐行校验。它是完全**受控**的：宿主拥有行对象与数组，并自行应用 `add` / `remove(row, index)` 意图。外壳从不修改任何行，因此撤销栈或服务端草稿始终可行。

```hikari:tsx
<HkEditableTable
  columns={[
    { key: "tier", title: "档位" },
    { key: "price", title: "单价", align: "right" },
  ]}
  rows={rows}
  rowKey="id"
  canAdd
  canRemove={() => rows.length > 1}
  validate={(row) => (row.price ? null : "单价不能为空")}
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
    "row-error": ({ index, error }) => <span>第 {index + 1} 行：{error}</span>,
  }}
</HkEditableTable>
```

插槽契约：`cell-<key>` 渲染列的展示形态（省略时用 `HkTable` 的 `row[key]` 文本），`edit-<key>` 渲染宿主自己的编辑器——启用状态下它优先，`disabled` 时改用展示插槽，因此同一张表无需重写插槽即可变成只读；`row-error` 渲染一行的错误行（省略时为本地化的「第 N 行：消息」）。所有单元格插槽都会收到 `{ row, value, index, error, errorId, disabled }`；把 `errorId` 绑定到编辑器的 `aria-describedby`，校验信息就会随字段一起被读出。错误行渲染在组件内部（绝不在页面框架里），以 `rowKey` 为键，并通过礼貌播报区域朗读。

| 属性 | 说明 | 类型 | 默认值 |
|------|------|------|--------|
| columns | 列定义 | HkEditableColumn[] | — |
| rows | 宿主拥有的行（绝不修改） | Record\<string, unknown\>[] | [] |
| rowKey | 行标识字段 | string | — |
| validate | 纯函数逐行校验器 | (row, rows) => string \| null | — |
| canAdd / canRemove | 渲染新增带 / 逐行删除入口 | bool / (row) => bool | false / — |
| addLabel / emptyText / caption | 本地化文案覆盖 | string | — |
| disabled | 只读模式（编辑器回退到展示插槽） | bool | false |
