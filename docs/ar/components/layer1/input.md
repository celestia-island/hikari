# Input حقل الإدخال

مكون Input هو مكون إدخال نموذج أساسي يدعم حالات وأنماط مخصصة متعددة.

## التكوين ثلاثي المستويات

يدعم مكون Input بنية تكوين متغيرات CSS ثلاثية المستويات:

- **Layer1 (المستوى الأساسي)**: يحدد القيم الافتراضية العالمية من خلال السمات
- **Layer2 (مستوى المكون)**: يحدد متغيرات المكون من خلال `input-vars.scss`
- **Custom (وقت التشغيل)**: يستبدل ديناميكيًا من خلال خصائص المكون

## الاستخدام الأساسي

```hikari
rsx! {
    div { style: "padding:1rem;",
        input { type: "text", placeholder: "Basic input", style: "padding:8px 12px;border:1px solid #d9d9d9;border-radius:6px;font-size:14px;width:240px;" }
    }
}
```

## الحالة المعطلة

يمكن تعطيل حقل الإدخال، مما يجعله غير قابل للتحرير عند التعطيل.

```hikari
rsx! {
    div { style: "padding:1rem;",
        input { type: "text", placeholder: "Disabled", disabled: true, style: "padding:8px 12px;border:1px solid #d9d9d9;border-radius:6px;font-size:14px;width:240px;background:#f5f5f5;color:#999;" }
    }
}
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

## إدخال المبلغ

`HkMoneyInput` حقل مبلغ واعٍ بالعملة. نموذجه هو **نص عشري قانوني**: أرقام، وعلى الأكثر نقطة `.` واحدة، دون فاصل آلاف ودون رمز عملة (`""`, `"12"`, `"1.5"`, `"-0.25"`)؛ وتعني `""` «غير محدد / اتباع»، ولا تُحوَّل أبدًا إلى `0`.

لا يُعاد كتابة الحقل **إطلاقًا أثناء الكتابة**: يبقى النص المرئي كما كتبته تمامًا، وتُرسَل القيمة القانونية عند الإدخال، ولا يُطبَّق تنسيق العرض (الفواصل الآلاف ودقة العملة) إلا عند **فقدان التركيز**، ويعود النص صالحًا للتحرير عند **التركيز**. ولهذا يبقى `1.5` المكتوب `1.5` ولا ينهار إلى `5` أثناء الضغط.

```hikari:tsx
<HkMoneyInput
  label="سعر الوحدة"
  currency={{ code: "USD", symbol: "$", decimals: 2 }}
  min={0}
  modelValue={price}
  onUpdate:modelValue={(next: string) => (price = next)}
/>
```

القيمة الافتراضية لـ `maxDecimals` هي `currency.decimals`؛ ارفعها للأسعار (قد يحتاج سعر المليون إلى 4–6 أرقام). إن `min` / `max` **تبلّغان** فقط برسالة النطاق المترجمة — ولا يُقتطع مبلغ خارج النطاق من خلف المستخدم أبدًا. يُرسم رمز العملة داخل الحقل كبادئة تزيينية، والعنصر حقل نص عادي مع `inputmode="decimal"`، ويتولى المكوّن ربط `error` / `aria-invalid` / `aria-describedby`.

| الخاصية | الوصف | النوع | الافتراضي |
|---------|-------|-------|-----------|
| modelValue | نص عشري قانوني | string | "" |
| currency | العملة (الرمز، الكود، عدد الخانات العشرية) | HkCurrency | — |
| maxDecimals | ميزانية الخانات العشرية (دقة الخروج والتقريب) | number | currency.decimals |
| min / max | حدود إرشادية تُبلَّغ ولا تُقتطع | number | — |
| label / error / required / disabled | هيئة الحقل | string / string / bool / bool | — |
| size | درجة الحجم | "sm" \| "md" \| "lg" | "md" |

## العملات

`HkCurrency` هو نوع القيمة المشترك: `{ code, symbol?, name?, decimals }`. تُصدَّر أدواته من برميل الحزمة، فيستطيع المضيف تنسيق مبلغ دون تركيب أي عنصر تحكم: `formatMoney` و`parseMoney` و`canonicalMoneyText` و`currencyDisplayName` و`normalizeCurrency` و`isValidCurrency` و`currencySymbol`.

```hikari:tsx
formatMoney(1234.5, { code: "USD", decimals: 2 }); // "1,234.50"
parseMoney("1,234.50", 2);                          // 1234.5
currencyDisplayName("USD", "en");                   // "US Dollar"
```

`formatMoney` مستقل عن اللغة عمدًا (فاصل الآلاف `,` والعشري `.`) حتى يُعاد تحليل النص المنسّق إلى العدد نفسه دائمًا؛ أما الجزء المترجم فهو **اسم** العملة — `Intl.DisplayNames` ثم البديل الذي يمرره المستدعي ثم الكود.

```hikari:tsx
<HkCurrencySelect
  label="عملة الفوترة"
  currencies={currencies}
  groups={[{ key: "common", label: "الشائعة", codes: ["USD", "EUR"] }]}
  modelValue={code}
  onUpdate:modelValue={(next: string) => (code = next)}
/>
```

تعرض صفوف `HkCurrencySelect` الرمز والكود والاسم المترجم، ويطابق البحث الثلاثة معًا؛ والسطح المفتوح هو لوحة القائمة المنسدلة المشتركة (نافذة منبثقة على الحاسوب / ورقة سفلية على الهاتف) نفسها التي يستخدمها مكوّن الاختيار.
