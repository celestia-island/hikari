# المتتالي

المتتالي يُستخدم لاختيار البيانات متعددة المستويات.

## الاستخدام الأساسي

```hikari
rsx! {
    div { style: "padding:1rem;",
        select { style: "padding:6px 12px;border:1px solid #ccc;border-radius:4px;font-size:14px;",
            option { "Province / City / District" }
        }
    }
}
```

## واجهة البرمجة

| الخاصية | الوصف | النوع | الافتراضي |
|---------|-------|-------|-----------|
| options | بيانات الخيار | Vec\<CascaderOption\> | - |
| value | القيمة الحالية | Option\<String\> | None |
| on_change | رد التغيير | EventHandler\<String\> | - |
