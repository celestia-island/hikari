# الصورة الرمزية

مكون الصورة الرمزية يُستخدم لعرض صور المستخدم أو الكيان.

## الأحجام

يدعم خمسة أحجام: Xs، Sm، Md، Lg، Xl.

```hikari
rsx! {
    div { style: "display:flex;gap:8px;padding:1rem;align-items:center;",
        div { style: "width:16px;height:16px;border-radius:50%;background:#3a6ea5;display:flex;align-items:center;justify-content:center;color:#fff;font-size:8px;", "XS" }
        div { style: "width:24px;height:24px;border-radius:50%;background:#3a6ea5;display:flex;align-items:center;justify-content:center;color:#fff;font-size:10px;", "S" }
        div { style: "width:32px;height:32px;border-radius:50%;background:#3a6ea5;display:flex;align-items:center;justify-content:center;color:#fff;font-size:12px;", "M" }
        div { style: "width:40px;height:40px;border-radius:50%;background:#3a6ea5;display:flex;align-items:center;justify-content:center;color:#fff;font-size:14px;", "L" }
        div { style: "width:48px;height:48px;border-radius:50%;background:#3a6ea5;display:flex;align-items:center;justify-content:center;color:#fff;font-size:16px;", "XL" }
    }
}
```

## أشكال متنوعة

يدعم ثلاثة أشكال: دائري، مستدير، مربع.

```hikari
rsx! {
    div { style: "display:flex;gap:12px;padding:1rem;align-items:center;",
        div { style: "width:40px;height:40px;border-radius:50%;background:#3a6ea5;display:flex;align-items:center;justify-content:center;color:#fff;", "A" }
        div { style: "width:40px;height:40px;border-radius:8px;background:#3a6ea5;display:flex;align-items:center;justify-content:center;color:#fff;", "B" }
        div { style: "width:40px;height:40px;border-radius:0;background:#3a6ea5;display:flex;align-items:center;justify-content:center;color:#fff;", "C" }
    }
}
```

## نص بديل

عند عدم توفر صورة، يعرض الأحرف الأولى أو نص مخصص.

```hikari
rsx! {
    div { style: "display:flex;gap:8px;padding:1rem;",
        div { style: "width:40px;height:40px;border-radius:50%;background:#3a6ea5;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:600;", "JD" }
    }
}
```

## واجهة البرمجة

### الخصائص

| الخاصية | الوصف | النوع | الافتراضي |
|---------|-------|-------|-----------|
| src | رابط الصورة | Option\<String\> | None |
| alt | النص البديل | String | - |
| size | الحجم | AvatarSize | Md |
| variant | شكل متنوع | AvatarVariant | Circular |
| fallback | نص بديل | Option\<String\> | None |
