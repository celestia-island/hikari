# البحث

مكون البحث لإدخال البحث.

## الاستخدام الأساسي

```_hikari_component
pages/components/layer1/search#basic
```

## الإدخال الصوتي

يدعم وظيفة الإدخال الصوتي. انقر على أيقونة الميكروفون لبدء التسجيل.

```_hikari_component
pages/components/layer1/search#voice
```

## واجهة البرمجة

| الخاصية | الوصف | النوع | الافتراضي |
|---------|-------|-------|-----------|
| placeholder | نص العنصر النائب | String | "بحث..." |
| on_search | رد البحث | Option\<EventHandler\<String\>\> | None |
| voice_input | تفعيل الإدخال الصوتي | bool | false |
