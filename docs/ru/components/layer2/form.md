# Компоненты формы

Составные компоненты, связанные с формами.

## Форма

```hikari
rsx! {
    div { style: "padding:1rem;max-width:300px;",
        div { style: "margin-bottom:12px;",
            label { style: "display:block;font-size:14px;margin-bottom:4px;", "Username" }
            input { type: "text", style: "padding:6px 12px;border:1px solid #ccc;border-radius:4px;width:100%;font-size:14px;" }
        }
        div { style: "margin-bottom:12px;",
            label { style: "display:block;font-size:14px;margin-bottom:4px;", "Password" }
            input { type: "password", style: "padding:6px 12px;border:1px solid #ccc;border-radius:4px;width:100%;font-size:14px;" }
        }
        button { style: "padding:6px 16px;border:none;border-radius:4px;background:#3a6ea5;color:#fff;cursor:pointer;", "Submit" }
    }
}
```

## Выпадающий список

```hikari
rsx! {
    div { style: "padding:1rem;position:relative;width:200px;",
        button { style: "padding:6px 12px;border:1px solid #ccc;border-radius:4px;width:100%;text-align:left;cursor:pointer;", "Select ▼" }
    }
}
```

## Модальное окно

```hikari
rsx! {
    div { style: "padding:1rem;",
        button { style: "padding:6px 16px;border:1px solid #ccc;border-radius:4px;cursor:pointer;", "Open Modal" }
    }
}
```

## Аккордеон

```hikari
rsx! {
    div { style: "padding:1rem;max-width:300px;",
        div { style: "border:1px solid #e2e2ea;border-radius:8px;margin-bottom:4px;",
            div { style: "padding:10px 12px;font-weight:600;background:#f7f7fa;cursor:pointer;", "Panel 1 ▼" }
            div { style: "padding:10px 12px;color:#666;font-size:14px;", "Content 1" }
        }
        div { style: "border:1px solid #e2e2ea;border-radius:8px;",
            div { style: "padding:10px 12px;font-weight:600;background:#f7f7fa;cursor:pointer;", "Panel 2 ▶" }
        }
    }
}
```
