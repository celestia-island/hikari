# الصورة

مكون الصورة لعرض الصور مع حالة التحميل ومعالجة الأخطاء.

## الاستخدام الأساسي

```hikari
rsx! {
    div { style: "padding:1rem;",
        img { src: "https://via.placeholder.com/200x120", alt: "Sample", style: "border-radius:8px;max-width:100%;" }
    }
}
```

## عنصر التحميل المؤقت

```hikari
rsx! {
    div { style: "padding:1rem;",
        div { style: "width:200px;height:120px;background:#f0f0f0;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#999;", "No Image" }
    }
}
```

## واجهة البرمجة

| الخاصية | الوصف | النوع | الافتراضي |
|---------|-------|-------|-----------|
| src | رابط الصورة | String | - |
| alt | النص البديل | String | - |
| width | العرض | Option\<String\> | None |
| height | الارتفاع | Option\<String\> | None |
