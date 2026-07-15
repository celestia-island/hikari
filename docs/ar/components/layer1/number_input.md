# Number Input إدخال رقمي

مكون Number Input يستخدم للإدخال الرقمي مع دعم العداد التدريجي.

## الاستخدام الأساسي

```hikari
rsx! {
    div { style: "padding:1rem;",
        div { style: "display:inline-flex;border:1px solid #d9d9d9;border-radius:6px;overflow:hidden;",
            button { style: "padding:4px 12px;border:none;background:#f5f5f5;cursor:pointer;", "−" }
            input { type: "text", value: "0", style: "padding:8px;width:60px;border:none;text-align:center;font-size:14px;" }
            button { style: "padding:4px 12px;border:none;background:#f5f5f5;cursor:pointer;", "+" }
        }
    }
}
```

## الأحجام

ثلاثة أحجام متاحة: صغير، متوسط (افتراضي)، وكبير.

```hikari
rsx! {
    div { style: "display:flex;gap:12px;padding:1rem;align-items:center;",
        input { type: "text", value: "1", style: "padding:4px 8px;width:50px;border:1px solid #ccc;border-radius:4px;font-size:12px;text-align:center;" }
        input { type: "text", value: "10", style: "padding:8px 12px;width:60px;border:1px solid #ccc;border-radius:6px;font-size:14px;text-align:center;" }
        input { type: "text", value: "100", style: "padding:12px 16px;width:80px;border:1px solid #ccc;border-radius:8px;font-size:16px;text-align:center;" }
    }
}
```

## الحالة المعطلة

```hikari
rsx! {
    div { style: "padding:1rem;",
        div { style: "display:inline-flex;border:1px solid #d9d9d9;border-radius:6px;overflow:hidden;opacity:0.5;",
            button { disabled: true, style: "padding:4px 12px;border:none;background:#f5f5f5;", "−" }
            input { type: "text", value: "0", disabled: true, style: "padding:8px;width:60px;border:none;text-align:center;" }
            button { disabled: true, style: "padding:4px 12px;border:none;background:#f5f5f5;", "+" }
        }
    }
}
```

## العداد التدريجي مع النطاق

يمكنك تعيين القيمة الدنيا، القيمة القصوى، وحجم الخطوة.

```hikari
rsx! {
    div { style: "padding:1rem;",
        div { style: "display:inline-flex;border:1px solid #d9d9d9;border-radius:6px;",
            button { style: "padding:8px 16px;border:none;background:#3a6ea5;color:#fff;cursor:pointer;", "−" }
            span { style: "padding:8px 24px;font-size:16px;font-weight:600;", "5" }
            button { style: "padding:8px 16px;border:none;background:#3a6ea5;color:#fff;cursor:pointer;", "+" }
        }
    }
}
```

## API

| الخاصية | الوصف | النوع | الافتراضي |
|---------|-------|-------|-----------|
| value | القيمة الحالية | i64 | 0 |
| on_change | رد اتصال تغيير القيمة | EventHandler<i64> | - |
| min | القيمة الدنيا | Option<i64> | None |
| max | القيمة القصوى | Option<i64> | None |
| step | حجم الخطوة | i64 | 1 |
| disabled | معطل أم لا | bool | false |
| size | متغير الحجم | NumberInputSize | Medium |
| class | اسم الفئة المخصص | String | "" |
| style | النمط المخصص | String | "" |

### NumberInputSize

- `Small` - الحجم الصغير (24px)
- `Medium` - الحجم المتوسط (32px، افتراضي)
- `Large` - الحجم الكبير (40px)
