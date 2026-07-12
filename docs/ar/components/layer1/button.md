# الزر

مكون الزر هو مكون تفاعل المستخدم الأساسي، يدعم أنماطاً وحالات متعددة.

تُستخدم الأزرار لتشغيل الإجراءات أو الأحداث، مثل إرسال النماذج، أو فتح مربعات الحوار، أو إلغاء العمليات، أو تنفيذ عمليات الحذف.

## متغيرات الزر

يدعم أربعة متغيرات: أساسي، ثانوي، شبح، وخطر.

```hikari
rsx! {
    div { style: "display:flex;gap:8px;padding:1rem;flex-wrap:wrap;",
        button { style: "padding:6px 16px;border:none;border-radius:4px;background:#3a6ea5;color:#fff;cursor:pointer;", "Primary" }
        button { style: "padding:6px 16px;border:1px solid #ccc;border-radius:4px;background:#fff;color:#333;cursor:pointer;", "Secondary" }
        button { style: "padding:6px 16px;border:none;border-radius:4px;background:transparent;color:#3a6ea5;cursor:pointer;", "Ghost" }
        button { style: "padding:6px 16px;border:none;border-radius:4px;background:#ef4444;color:#fff;cursor:pointer;", "Danger" }
    }
}
```

## حالة التعطيل

يمكن تعطيل الأزرار، وفي هذه الحالة لا يمكن النقر عليها.

```hikari
rsx! {
    div { style: "display:flex;gap:8px;padding:1rem;",
        button { style: "padding:6px 16px;border:none;border-radius:4px;background:#3a6ea5;color:#fff;", "Normal" }
        button { disabled: true, style: "padding:6px 16px;border:none;border-radius:4px;background:#ccc;color:#999;cursor:not-allowed;", "Disabled" }
    }
}
```

## أحجام أزرار الأيقونات

تدعم أزرار الأيقونات ثلاثة أحجام: صغير (24px)، متوسط (32px)، وكبير (40px).

```hikari
rsx! {
    div { style: "display:flex;gap:12px;padding:1rem;align-items:center;",
        button { style: "width:24px;height:24px;border:1px solid #ccc;border-radius:4px;background:#fff;cursor:pointer;", "" }
        button { style: "width:32px;height:32px;border:1px solid #ccc;border-radius:4px;background:#fff;cursor:pointer;", "" }
        button { style: "width:40px;height:40px;border:1px solid #ccc;border-radius:4px;background:#fff;cursor:pointer;", "" }
    }
}
```

## متغيرات أزرار الأيقونات

تدعم أزرار الأيقونات خمسة متغيرات لونية: شبح، أساسي، ثانوي، خطر، ونجاح.

```hikari
rsx! {
    div { style: "display:flex;gap:8px;padding:1rem;",
        button { style: "width:32px;height:32px;border:none;border-radius:4px;background:transparent;color:#666;cursor:pointer;", "G" }
        button { style: "width:32px;height:32px;border:none;border-radius:4px;background:#3a6ea5;color:#fff;cursor:pointer;", "P" }
        button { style: "width:32px;height:32px;border:1px solid #ccc;border-radius:4px;background:#fff;color:#333;cursor:pointer;", "S" }
        button { style: "width:32px;height:32px;border:none;border-radius:4px;background:#ef4444;color:#fff;cursor:pointer;", "D" }
        button { style: "width:32px;height:32px;border:none;border-radius:4px;background:#22c55e;color:#fff;cursor:pointer;", "✓" }
    }
}
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
