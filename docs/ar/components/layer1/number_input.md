# Number Input إدخال رقمي

مكون Number Input يستخدم للإدخال الرقمي مع دعم العداد التدريجي.

## الاستخدام الأساسي

```_hikari_component
pages/components/layer1/number_input#basic
```

## الأحجام

ثلاثة أحجام متاحة: صغير، متوسط (افتراضي)، وكبير.

```_hikari_component
pages/components/layer1/number_input#sizes
```

## الحالة المعطلة

```_hikari_component
pages/components/layer1/number_input#disabled
```

## العداد التدريجي مع النطاق

يمكنك تعيين القيمة الدنيا، القيمة القصوى، وحجم الخطوة.

```_hikari_component
pages/components/layer1/number_input#stepper
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
