# Input حقل الإدخال

مكون Input هو مكون إدخال نموذج أساسي يدعم حالات وأنماط مخصصة متعددة.

## التكوين ثلاثي المستويات

يدعم مكون Input بنية تكوين متغيرات CSS ثلاثية المستويات:

- **Layer1 (المستوى الأساسي)**: يحدد القيم الافتراضية العالمية من خلال السمات
- **Layer2 (مستوى المكون)**: يحدد متغيرات المكون من خلال `input-vars.scss`
- **Custom (وقت التشغيل)**: يستبدل ديناميكيًا من خلال خصائص المكون

## الاستخدام الأساسي

```_hikari_component
pages/components/layer1/input#basic
```

## الحالة المعطلة

يمكن تعطيل حقل الإدخال، مما يجعله غير قابل للتحرير عند التعطيل.

```_hikari_component
pages/components/layer1/input#disabled
```

## ألوان مخصصة

يمكن استبدال ألوان حقل الإدخال ديناميكيًا من خلال خصائص طبقة Custom.

```rust
Input {
    placeholder: "Custom styled input",
    text_color: Some("#ff0000".to_string()),        // لون النص المخصص
    border_color: Some("#ff4f00".to_string()),       // لون الحد المخصص
    background_color: Some("rgba(255, 255, 255, 0.1)".to_string()), // لون الخلفية المخصص
}
```

## استبدال متغيرات CSS

يمكن استبدال متغيرات CSS دفعة واحدة من خلال خاصية `css_vars`.

```rust
Input {
    placeholder: "CSS Variables Override",
    css_vars: Some(vec![
        ("--hi-input-radius", "16px".to_string()),
        ("--hi-input-border-color-focus", "#22c55e".to_string()),
        ("--hi-input-shadow-focus", "0 0 0 2px rgba(34, 197, 94, 0.3)".to_string()),
    ]),
}
```

## تكامل الرسوم المتحركة

يمكن دمج تأثيرات الرسوم المتحركة مع AnimationBuilder من خلال خاصية `animation_id`.

```rust
Input {
    placeholder: "Animated Input",
    animation_id: Some("animated-input".to_string()),
}

// التحكم في الرسوم المتحركة باستخدام AnimationBuilder
AnimationBuilder::new()
    .style("--hi-input-border-color", "rgb(255, 79, 0)")
    .style("--hi-input-shadow-focus", "0 0 0 2px rgba(255, 79, 0, 0.3)")
    .duration(300)
    .apply_to_element("animated-input");
```

## API

### Input Props

| الخاصية | الوصف | النوع | الافتراضي |
|----------|-------------|------|------------|
| size | حجم حقل الإدخال | InputSize | Medium |
| disabled | ما إذا كان معطلاً | bool | false |
| readonly | ما إذا كان للقراءة فقط | bool | false |
| placeholder | نص العنصر النائب | Option\<String\> | None |
| value | قيمة الإدخال | Option\<String\> | None |
| input_type | نوع الإدخال | Option\<String\> | "text" |
| autofocus | التركيز التلقائي | bool | false |
| class | فئة CSS مخصصة | String | "" |
| prefix_icon | أيقونة البادئة | Option\<Element\> | None |
| suffix_icon | أيقونة اللاحقة | Option\<Element\> | None |
| oninput | رد اتصال الإدخال | Option\<EventHandler\<String\>\> | None |
| onfocus | رد اتصال التركيز | Option\<EventHandler\<FocusEvent\>\> | None |
| onblur | رد اتصال فقدان التركيز | Option\<EventHandler\<FocusEvent\>\> | None |
| onkeydown | رد اتصال ضغط المفتاح | Option\<EventHandler\<KeyboardEvent\>\> | None |
| glow | تفعيل تأثير التوهج | bool | true |
| glow_blur | شدة ضبابية التوهج | GlowBlur | Medium |
| glow_intensity | شدة التوهج | GlowIntensity | Soft |
| glow_color | لون التوهج | GlowColor | Ghost |
| **خصائص طبقة Custom** | | | |
| text_color | لون النص المخصص | Option\<String\> | None |
| placeholder_color | لون العنصر النائب المخصص | Option\<String\> | None |
| border_color | لون الحد المخصص | Option\<String\> | None |
| background_color | لون الخلفية المخصص | Option\<String\> | None |
| animation_id | معرف رسوم AnimationBuilder المتحركة | Option\<String\> | None |
| css_vars | الاستبدال الجماعي لمتغيرات CSS | Option\<Vec\<(&'static str, String)\>\> | None |

## مرجع متغيرات CSS

### متغيرات CSS لـ Input

| المتغير | الوصف | الافتراضي |
|----------|-------------|------------|
| --hi-input-text-color | لون النص | var(--hi-color-text-primary) |
| --hi-input-text-color-disabled | لون النص المعطل | var(--hi-color-text-disabled) |
| --hi-input-placeholder-color | لون العنصر النائب | var(--hi-color-text-secondary) |
| --hi-input-placeholder-opacity | شفافية العنصر النائب | 0.6 |
| --hi-input-bg | لون الخلفية | transparent |
| --hi-input-bg-disabled | خلفية المعطل | rgba(255, 255, 255, 0.5) |
| --hi-input-border-color | لون الحد | var(--hi-color-border) |
| --hi-input-border-color-focus | لون الحد عند التركيز | var(--hi-color-primary) |
| --hi-input-border-color-disabled | لون الحد المعطل | var(--hi-border-color-disabled) |
| --hi-input-border-color-error | لون حد الخطأ | var(--hi-color-danger) |
| --hi-input-shadow-focus | ظل التركيز | 0 0 0 2px var(--hi-color-primary) |
| --hi-input-radius | نصف قطر الحد | var(--hi-radius-md) |
| --hi-input-padding-x | الحشو الأفقي | 0.75rem |
| --hi-input-padding-y | الحشو العمودي | 0.5rem |
| --hi-input-font-size | حجم الخط | var(--hi-font-size-sm) |
