# الزر

مكون الزر هو مكون تفاعل المستخدم الأساسي، يدعم أنماطاً وحالات متعددة.

تُستخدم الأزرار لتشغيل الإجراءات أو الأحداث، مثل إرسال النماذج، أو فتح مربعات الحوار، أو إلغاء العمليات، أو تنفيذ عمليات الحذف.

## متغيرات الزر

يدعم أربعة متغيرات: أساسي، ثانوي، شبح، وخطر.

```_hikari_component
pages/components/layer1/button#variants
```

## حالة التعطيل

يمكن تعطيل الأزرار، وفي هذه الحالة لا يمكن النقر عليها.

```_hikari_component
pages/components/layer1/button#disabled
```

## أحجام أزرار الأيقونات

تدعم أزرار الأيقونات ثلاثة أحجام: صغير (24px)، متوسط (32px)، وكبير (40px).

```_hikari_component
pages/components/layer1/button#icon-sizes
```

## متغيرات أزرار الأيقونات

تدعم أزرار الأيقونات خمسة متغيرات لونية: شبح، أساسي، ثانوي، خطر، ونجاح.

```_hikari_component
pages/components/layer1/button#icon-variants
```

## API

### خصائص الزر

| الخاصية | الوصف | النوع | الافتراضي |
|---------|-------|-------|-----------|
| variant | متغير نمط الزر | ButtonVariant | أساسي |
| size | حجم الزر | ButtonSize | متوسط |
| disabled | ما إذا كان معطلاً | bool | false |
| children | محتوى الزر | Element | - |

### خصائص زر الأيقونة

| الخاصية | الوصف | النوع | الافتراضي |
|---------|-------|-------|-----------|
| icon | الأيقونة للعرض | MdiIcon | - |
| size | حجم الزر | IconButtonSize | كبير |
| variant | متغير اللون | IconButtonVariant | شبح |
| glow | تفعيل تأثير التوهج | bool | true |
| disabled | ما إذا كان معطلاً | bool | false |
| onclick | معالج النقر | EventHandler\<MouseEvent\> | - |
