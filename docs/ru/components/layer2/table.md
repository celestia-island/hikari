# Table

Компонент таблицы для отображения структурированных данных.

## Базовое использование

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

| Свойство | Описание | Тип | По умолчанию |
|----------|----------|-----|--------------|
| columns | Определения столбцов | Vec\<Column\> | - |
| data | Источник данных | Vec\<T\> | - |

## Редактируемая таблица

`HkEditableTable` — оболочка встроенного редактирования, **собранная на `HkTable`**: сетка, ритм заголовка, наведение, полосы секций и структура остаются в `HkTable`; оболочка добавляет редактируемые ячейки, средства добавления/удаления и построчную проверку. Компонент полностью **контролируемый**: строки и массив принадлежат хосту, и он сам применяет намерения `add` / `remove(row, index)`. Оболочка никогда не изменяет строку, поэтому стек отмены или серверный черновик остаются возможными.

```hikari:tsx
<HkEditableTable
  columns={[
    { key: "tier", title: "Тариф" },
    { key: "price", title: "Цена за единицу", align: "right" },
  ]}
  rows={rows}
  rowKey="id"
  canAdd
  canRemove={() => rows.length > 1}
  validate={(row) => (row.price ? null : "Цена за единицу обязательна")}
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
    "row-error": ({ index, error }) => <span>Строка {index + 1}: {error}</span>,
  }}
</HkEditableTable>
```

Контракт слотов: `cell-<key>` показывает столбец (если слот не задан — текст `row[key]` из `HkTable`), `edit-<key>` монтирует редактор хоста — он имеет приоритет, пока таблица активна, а при `disabled` используется слот отображения, так что та же сетка становится доступной только для чтения без переписывания слотов; `row-error` выводит строку ошибки для недопустимой строки (если не задан — локализованное «Строка N: сообщение»). Каждый слот ячейки получает `{ row, value, index, error, errorId, disabled }`; свяжите `errorId` с `aria-describedby` редактора, чтобы сообщение читалось вместе с полем. Строки ошибок живут внутри компонента (никогда в оформлении страницы), ключуются по `rowKey` и объявляются в вежливой live-области.

| Свойство | Описание | Тип | По умолчанию |
|----------|----------|-----|--------------|
| columns | Определения столбцов | HkEditableColumn[] | — |
| rows | Строки хоста (никогда не изменяются) | Record\<string, unknown\>[] | [] |
| rowKey | Поле идентичности строки | string | — |
| validate | Чистый построчный валидатор | (row, rows) => string \| null | — |
| canAdd / canRemove | Показать полосу добавления / средство удаления строки | bool / (row) => bool | false / — |
| addLabel / emptyText / caption | Переопределения локализованных текстов | string | — |
| disabled | Режим только для чтения (редакторы возвращаются к слотам отображения) | bool | false |
