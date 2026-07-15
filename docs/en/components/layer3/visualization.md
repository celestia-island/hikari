# Visualization Components

Data visualization and user guidance components. Reference: Prism.js, Driver.js.

## DragLayer

```hikari
rsx! {
    div { style: "padding:1rem;position:relative;",
        div { style: "padding:12px;border:1px solid #ccc;border-radius:8px;background:#fff;box-shadow:0 4px 12px rgba(0,0,0,0.1);opacity:0.8;display:inline-block;", "Dragging item" }
    }
}
```

## Timeline

```hikari
rsx! {
    div { style: "padding:1rem;display:flex;gap:4px;overflow-x:auto;",
        div { style: "min-width:120px;padding:8px;border:1px solid #e2e2ea;border-radius:8px;font-size:12px;", "Task A
3 days" }
        div { style: "min-width:80px;padding:8px;border:1px solid #e2e2ea;border-radius:8px;font-size:12px;", "Task B
2 days" }
    }
}
```

## UserGuide

```hikari
rsx! {
    div { style: "padding:1rem;",
        div { style: "display:flex;gap:12px;align-items:center;padding:12px;border:1px solid #3a6ea5;border-radius:8px;background:rgba(58,110,165,0.05);",
            div { style: "width:32px;height:32px;border-radius:50%;background:#3a6ea5;color:#fff;display:flex;align-items:center;justify-content:center;", "!" }
            span { style: "font-size:14px;color:#333;", "Tip: Use arrow keys to navigate" }
        }
    }
}
```
