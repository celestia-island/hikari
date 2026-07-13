# عناصر التحكم في التكبير

مكون التحكم في التكبير لتغيير حجم الواجهة.

## الاستخدام الأساسي

```hikari
rsx! {
    div { style: "padding:1rem;display:inline-flex;gap:4px;align-items:center;border:1px solid #e2e2ea;border-radius:6px;padding:4px;",
        button { style: "width:28px;height:28px;border:none;background:none;cursor:pointer;font-size:16px;", "−" }
        span { style: "font-size:14px;min-width:40px;text-align:center;", "100%" }
        button { style: "width:28px;height:28px;border:none;background:none;cursor:pointer;font-size:16px;", "+" }
    }
}
```

## واجهة البرمجة

| الخاصية | الوصف | النوع | الافتراضي |
|---------|-------|-------|-----------|
| zoom | مستوى التكبير | f64 | 1.0 |
| min | الحد الأدنى | f64 | 0.5 |
| max | الحد الأقصى | f64 | 2.0 |
