# المتتالي

المتتالي يُستخدم لاختيار البيانات متعددة المستويات.

## الاستخدام الأساسي

```_hikari_component
pages/components/layer2/cascader#basic
```

## واجهة البرمجة

| الخاصية | الوصف | النوع | الافتراضي |
|---------|-------|-------|-----------|
| options | بيانات الخيار | Vec\<CascaderOption\> | - |
| value | القيمة الحالية | Option\<String\> | None |
| on_change | رد التغيير | EventHandler\<String\> | - |
