# مكونات النموذج

مكونات النموذج الأساسية.

## حقل الإدخال

مكون إدخال النص الأساسي.

```hikari
rsx! {
    div { style: "padding:1rem;",
        input { type: "text", placeholder: "Enter text...", style: "padding:6px 12px;border:1px solid #ccc;border-radius:4px;font-size:14px;width:200px;" }
    }
}
```

## القائمة المنسدلة

مكون الاختيار من القائمة المنسدلة.

```hikari
rsx! {
    div { style: "padding:1rem;",
        select { style: "padding:6px 12px;border:1px solid #ccc;border-radius:4px;font-size:14px;",
            option { "Option 1" }
            option { "Option 2" }
            option { "Option 3" }
        }
    }
}
```

## مربع الاختيار

مكون مربع الاختيار.

```hikari
rsx! {
    div { style: "display:flex;gap:12px;padding:1rem;align-items:center;",
        label { style: "display:flex;align-items:center;gap:6px;cursor:pointer;font-size:14px;",
            input { type: "checkbox", checked: true, style: "width:16px;height:16px;" }
            "Checked" }
        label { style: "display:flex;align-items:center;gap:6px;cursor:pointer;font-size:14px;",
            input { type: "checkbox", style: "width:16px;height:16px;" }
            "Unchecked" }
    }
}
```

## زر الاختيار

مكون زر الاختيار.

```hikari
rsx! {
    div { style: "display:flex;gap:12px;padding:1rem;",
        label { style: "display:flex;align-items:center;gap:4px;font-size:14px;",
            input { type: "radio", checked: true, name: "g" } "Option A" }
        label { style: "display:flex;align-items:center;gap:4px;font-size:14px;",
            input { type: "radio", name: "g" } "Option B" }
    }
}
```
