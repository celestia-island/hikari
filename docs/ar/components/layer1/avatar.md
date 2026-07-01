# الصورة الرمزية

مكون الصورة الرمزية يُستخدم لعرض صور المستخدم أو الكيان.

## الأحجام

يدعم خمسة أحجام: Xs، Sm، Md، Lg، Xl.

```_hikari_component
pages/components/layer1/avatar#sizes
```

## أشكال متنوعة

يدعم ثلاثة أشكال: دائري، مستدير، مربع.

```_hikari_component
pages/components/layer1/avatar#variants
```

## نص بديل

عند عدم توفر صورة، يعرض الأحرف الأولى أو نص مخصص.

```_hikari_component
pages/components/layer1/avatar#fallback
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
