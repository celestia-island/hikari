# Table

Componente de tabla para mostrar datos estructurados.

## Uso Básico

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

| Propiedad | Descripción | Tipo | Por Defecto |
|-----------|-------------|------|-------------|
| columns | Definiciones de columnas | Vec\<Column\> | - |
| data | Fuente de datos | Vec\<T\> | - |

## Tabla editable

`HkEditableTable` es un armazón de edición en línea **compuesto sobre `HkTable`**: la rejilla, el ritmo de cabecera, el hover, las bandas de sección y la estructura permanecen en `HkTable`; el armazón añade celdas editables, los accesos de añadir/quitar y la validación por fila. Es totalmente **controlado**: el host es dueño de los objetos de fila y del array, y aplica él mismo las intenciones `add` / `remove(row, index)`. El armazón nunca muta una fila, así que un historial de deshacer o un borrador en servidor siguen siendo posibles.

```hikari:tsx
<HkEditableTable
  columns={[
    { key: "tier", title: "Plan" },
    { key: "price", title: "Precio unitario", align: "right" },
  ]}
  rows={rows}
  rowKey="id"
  canAdd
  canRemove={() => rows.length > 1}
  validate={(row) => (row.price ? null : "El precio unitario es obligatorio")}
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
    "row-error": ({ index, error }) => <span>Fila {index + 1}: {error}</span>,
  }}
</HkEditableTable>
```

Contrato de slots: `cell-<key>` muestra una columna (si se omite, el texto `row[key]` de `HkTable`), `edit-<key>` monta el editor del host —gana mientras la tabla está habilitada, y con `disabled` se usa el slot de visualización, de modo que la misma rejilla pasa a solo lectura sin re-slotear nada— y `row-error` pinta la línea de una fila inválida (si se omite, el «Fila N: mensaje» localizado). Cada slot de celda recibe `{ row, value, index, error, errorId, disabled }`; enlaza `errorId` al `aria-describedby` del editor para que el mensaje se lea con el campo. Las líneas de error viven dentro del componente (nunca en el chrome de la página), se identifican por `rowKey` y se anuncian en una región viva cortés.

| Propiedad | Descripción | Tipo | Predeterminado |
|-----------|-------------|------|----------------|
| columns | Definiciones de columna | HkEditableColumn[] | — |
| rows | Filas del host (nunca mutadas) | Record\<string, unknown\>[] | [] |
| rowKey | Campo de identidad de fila | string | — |
| validate | Validador puro por fila | (row, rows) => string \| null | — |
| canAdd / canRemove | Pintar la banda de añadir / el acceso de quitar por fila | bool / (row) => bool | false / — |
| addLabel / emptyText / caption | Sustitutos de texto localizado | string | — |
| disabled | Modo de solo lectura (los editores pasan a slots de visualización) | bool | false |
