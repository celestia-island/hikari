# Feedback Components

User feedback-related composite components.

## Drawer

```hikari
rsx! {
    div { style: "padding:1rem;color:#999;", "Component preview: pages/components/layer2/feedback#drawer" }
}
```

## Popover

```hikari
rsx! {
    div { style: "padding:1rem;position:relative;",
        button { style: "padding:6px 16px;border:1px solid #ccc;border-radius:4px;cursor:pointer;", "Hover me" }
        div { style: "position:absolute;top:40px;left:0;padding:8px 12px;background:#333;color:#fff;border-radius:4px;font-size:12px;white-space:nowrap;", "Popover content" }
    }
}
```

## Upload

```hikari
rsx! {
    div { style: "padding:1rem;",
        div { style: "border:2px dashed #ccc;border-radius:8px;padding:2rem;text-align:center;color:#999;",
            "Click or drag file to upload" }
    }
}
```
