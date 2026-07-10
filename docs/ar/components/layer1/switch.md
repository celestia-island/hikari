# مكونات التبديل

توفر مكونات التبديل وظيفة التبديل مع ألوان ومتغيرات متعددة.

## التبديل الأساسي

يدعم ألواناً متعددة: نجاح، أساسي، ثانوي، خطر، تحذير، معلومات.

```hikari
rsx! {
    div { style: "padding:1rem;display:flex;gap:16px;align-items:center;",
        div { style: "width:40px;height:22px;border-radius:11px;background:#3a6ea5;position:relative;",
            div { style: "position:absolute;right:2px;top:2px;width:18px;height:18px;border-radius:50%;background:#fff;" }
        }
        div { style: "width:40px;height:22px;border-radius:11px;background:#ccc;position:relative;",
            div { style: "position:absolute;left:2px;top:2px;width:18px;height:18px;border-radius:50%;background:#fff;" }
        }
    }
}
```

## متغير التبديل بالأيقونة

تبديل بأيقونات، يوفر افتراضياً رموز ✓ و ✗.

```hikari
rsx! {
    div { style: "padding:1rem;display:flex;gap:8px;align-items:center;",
        span { style: "font-size:16px;", "🌙" }
        div { style: "width:40px;height:22px;border-radius:11px;background:#3a6ea5;position:relative;",
            div { style: "position:absolute;right:2px;top:2px;width:18px;height:18px;border-radius:50%;background:#fff;" } }
        span { style: "font-size:16px;", "☀" }
    }
}
```

## متغير التبديل بالنص

تبديل بملصقات نصية، يضبط عرض المنزلق تلقائياً.

```hikari
rsx! {
    div { style: "padding:1rem;display:flex;gap:8px;align-items:center;",
        span { style: "font-size:14px;color:#666;", "Off" }
        div { style: "width:40px;height:22px;border-radius:11px;background:#3a6ea5;position:relative;",
            div { style: "position:absolute;right:2px;top:2px;width:18px;height:18px;border-radius:50%;background:#fff;" } }
        span { style: "font-size:14px;color:#333;", "On" }
    }
}
```

## متغير أحجام التبديل

يدعم أحجام صغير، متوسط، وكبير.

```hikari
rsx! {
    div { style: "padding:1rem;display:flex;gap:16px;align-items:center;",
        div { style: "width:28px;height:16px;border-radius:8px;background:#3a6ea5;position:relative;",
            div { style: "position:absolute;right:1px;top:1px;width:14px;height:14px;border-radius:50%;background:#fff;" } }
        div { style: "width:40px;height:22px;border-radius:11px;background:#3a6ea5;position:relative;",
            div { style: "position:absolute;right:2px;top:2px;width:18px;height:18px;border-radius:50%;background:#fff;" } }
        div { style: "width:52px;height:28px;border-radius:14px;background:#3a6ea5;position:relative;",
            div { style: "position:absolute;right:2px;top:2px;width:24px;height:24px;border-radius:50%;background:#fff;" } }
    }
}
```

## شريط التقدم

مكون شريط التقدم لعرض تقدم العملية.

```hikari
rsx! {
    div { style: "padding:1rem;",
        div { style: "width:200px;height:6px;background:#e2e2ea;border-radius:3px;overflow:hidden;",
            div { style: "width:60%;height:100%;background:#3a6ea5;border-radius:3px;" }
        }
    }
}
```

## المنزلق

مكون المنزلق للاختيار الرقمي.

```hikari
rsx! {
    div { style: "padding:1rem;",
        input { type: "range", min: "0", max: "100", value: "60", style: "width:200px;" }
    }
}
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
