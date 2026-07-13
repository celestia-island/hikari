# الشجرة

مكون الشجرة لعرض البيانات الهرمية.

## الاستخدام الأساسي

```hikari
rsx! {
    div { style: "padding:1rem;font-size:14px;",
        div { style: "padding:4px 0;cursor:pointer;font-weight:500;", "▼ src" }
        div { style: "padding:4px 0 4px 20px;", "main.rs" }
        div { style: "padding:4px 0 4px 20px;", "lib.rs" }
        div { style: "padding:4px 0;cursor:pointer;", "▶ tests" }
    }
}
```

## واجهة البرمجة

| الخاصية | الوصف | النوع | الافتراضي |
|---------|-------|-------|-----------|
| data | بيانات الشجرة | Vec\<TreeNode\> | - |
| selected | العقدة المحددة | Option\<String\> | None |
