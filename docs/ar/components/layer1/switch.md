# مكونات التبديل

توفر مكونات التبديل وظيفة التبديل مع ألوان ومتغيرات متعددة.

## التبديل الأساسي

يدعم ألواناً متعددة: نجاح، أساسي، ثانوي، خطر، تحذير، معلومات.

```_hikari_component
pages/components/layer1/switch#switch
```

## متغير التبديل بالأيقونة

تبديل بأيقونات، يوفر افتراضياً رموز ✓ و ✗.

```_hikari_component
pages/components/layer1/switch#icon
```

## متغير التبديل بالنص

تبديل بملصقات نصية، يضبط عرض المنزلق تلقائياً.

```_hikari_component
pages/components/layer1/switch#text
```

## متغير أحجام التبديل

يدعم أحجام صغير، متوسط، وكبير.

```_hikari_component
pages/components/layer1/switch#sizes
```

## شريط التقدم

مكون شريط التقدم لعرض تقدم العملية.

```_hikari_component
pages/components/layer1/switch#progress
```

## المنزلق

مكون المنزلق للاختيار الرقمي.

```_hikari_component
pages/components/layer1/switch#slider
```

## API

### خصائص التبديل

| الخاصية | النوع | الافتراضي | الوصف |
|---------|-------|-----------|-------|
| checked | `bool` | `false` | ما إذا كان محدداً |
| on_change | `EventEmitter<bool>` | - | رد اتصال تغيير الحالة |
| disabled | `bool` | `false` | ما إذا كان معطلاً |
| size | `SwitchSize` | `Medium` | الحجم |
| variant | `SwitchVariant` | `Default` | نوع المتغير |
| color | `SwitchColor` | `Success` | اللون عند التحديد |
| checked_content | `Option<SwitchContent>` | `None` | المحتوى عند التحديد |
| unchecked_content | `Option<SwitchContent>` | `None` | المحتوى عند إلغاء التحديد |

### SwitchVariant

| القيمة | الوصف |
|--------|-------|
| `Default` | النمط الافتراضي (نقطة) |
| `Text` | متغير النص |
| `Icon` | متغير الأيقونة |
| `Custom` | متغير مخصص |

### SwitchColor

| القيمة | الوصف |
|--------|-------|
| `Success` | نجاح/تشغيل (أخضر، افتراضي) |
| `Primary` | اللون الأساسي (أزرق) |
| `Secondary` | اللون الثانوي (بنفسجي) |
| `Danger` | خطر (أحمر) |
| `Warning` | تحذير (أصفر) |
| `Info` | معلومات (نيلي) |

### SwitchContent

| القيمة | الوصف |
|--------|-------|
| `Text(String)` | محتوى نصي |
| `Icon(SwitchIcon)` | محتوى أيقونة |
| `Image(String)` | رابط صورة |

### SwitchIcon

| القيمة | الوصف |
|--------|-------|
| `Check` | أيقونة صح |
| `Close` | أيقونة إغلاق |
| `Plus` | أيقونة زائد |
| `Minus` | أيقونة ناقص |
| `Custom(&'static str)` | مسار SVG مخصص |
