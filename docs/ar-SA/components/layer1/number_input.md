# إدخال الأرقام

مكون إدخال الأرقام للإدخال الرقمي مع دعم المُدرّج.

## الاستخدام الأساسي

```_hikari_component
pages/components/layer1/number_input#basic
```

## مع المُدرّج

```_hikari_component
pages/components/layer1/number_input#stepper
```

## واجهة البرمجة

| الخاصية | الوصف | النوع | الافتراضي |
|---------|-------|-------|-----------|
| value | القيمة الحالية | i64 | 0 |
| min | الحد الأدنى | Option\<i64\> | None |
| max | الحد الأقصى | Option\<i64\> | None |
| step | حجم الخطوة | i64 | 1 |
