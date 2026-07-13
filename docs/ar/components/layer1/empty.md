# فارغ

مكون فارغ لعرض حالة البيانات الفارغة.

## الاستخدام الأساسي

```hikari
rsx! {
    div { style: "padding:2rem;text-align:center;color:#999;",
        p { style: "font-size:14px;margin:0;", "No data available" }
    }
}
```

## واجهة البرمجة

| الخاصية | الوصف | النوع | الافتراضي |
|---------|-------|-------|-----------|
| description | نص الوصف | Option\<String\> | None |
