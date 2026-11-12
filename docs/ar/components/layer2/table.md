# الجدول

مكون الجدول لعرض البيانات المنظمة.

## الاستخدام الأساسي

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

| الخاصية | الوصف | النوع | الافتراضي |
|---------|-------|-------|-----------|
| columns | تعريفات الأعمدة | Vec\<Column\> | - |
| data | مصدر البيانات | Vec\<T\> | - |

## جدول قابل للتحرير

`HkEditableTable` غلاف تحرير مضمّن **مبني فوق `HkTable`**: تبقى الشبكة وإيقاع الرأس والتحويم وشرائط الأقسام والبنية في `HkTable`؛ ويضيف الغلاف الخلايا القابلة للتحرير وأدوات الإضافة/الحذف والتحقق على مستوى الصف. المكوّن **مُتحكَّم به** بالكامل: يمثل المضيف كائنات الصفوف والمصفوفة، ويطبّق بنفسه نوايا `add` / `remove(row, index)`. لا يعدّل الغلاف أي صف قط، لذا يبقى سجل التراجع أو مسودة الخادم ممكنًا.

```hikari:tsx
<HkEditableTable
  columns={[
    { key: "tier", title: "الفئة" },
    { key: "price", title: "سعر الوحدة", align: "right" },
  ]}
  rows={rows}
  rowKey="id"
  canAdd
  canRemove={() => rows.length > 1}
  validate={(row) => (row.price ? null : "سعر الوحدة مطلوب")}
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
    "row-error": ({ index, error }) => <span>الصف {index + 1}: {error}</span>,
  }}
</HkEditableTable>
```

عقد الفتحات: تعرض `cell-<key>` العمود (وإن غابت فسيُستخدم نص `row[key]` من `HkTable`)، و`edit-<key>` يركّب محرّر المضيف — وله الأولوية ما دام الجدول ممكّنًا، ومع `disabled` تُستخدم فتحة العرض فيصبح الجدول نفسه للقراءة فقط دون إعادة كتابة الفتحات — و`row-error` يرسم سطر خطأ صف غير صالح (وإن غاب فسيُستخدم «الصف N: الرسالة» المترجم). تستقبل كل فتحة خلية `{ row, value, index, error, errorId, disabled }`؛ اربط `errorId` بـ `aria-describedby` في المحرّر ليُقرأ الشرح مع الحقل. تسكن أسطر الأخطاء داخل المكوّن (لا في إطار الصفحة)، وتُفتَح بمفتاح `rowKey`، وتُعلَن في منطقة حيّة مهذّبة.

| الخاصية | الوصف | النوع | الافتراضي |
|---------|-------|-------|-----------|
| columns | تعريفات الأعمدة | HkEditableColumn[] | — |
| rows | صفوف المضيف (لا تُعدَّل أبدًا) | Record\<string, unknown\>[] | [] |
| rowKey | حقل هوية الصف | string | — |
| validate | مدقّق نقي لكل صف | (row, rows) => string \| null | — |
| canAdd / canRemove | رسم شريط الإضافة / أداة حذف الصف | bool / (row) => bool | false / — |
| addLabel / emptyText / caption | تجاوزات النصوص المترجمة | string | — |
| disabled | وضع القراءة فقط (تعود المحرّرات إلى فتحات العرض) | bool | false |
