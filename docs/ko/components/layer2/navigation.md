# Navigation 컴포넌트

내비게이션 관련 복합 컴포넌트들입니다.

## Menu

```hikari
rsx! {
    div { style: "padding:1rem;width:200px;",
        div { style: "padding:8px 12px;border-radius:4px;background:rgba(58,110,165,0.1);color:#3a6ea5;font-size:14px;font-weight:500;", "Item 1 (Active)" }
        div { style: "padding:8px 12px;color:#666;font-size:14px;cursor:pointer;", "Item 2" }
        div { style: "padding:8px 12px;color:#666;font-size:14px;cursor:pointer;", "Item 3" }
    }
}
```

## Tabs

```hikari
rsx! {
    div { style: "padding:1rem;",
        div { style: "display:flex;gap:4px;border-bottom:2px solid #e2e2ea;margin-bottom:12px;",
            button { style: "padding:6px 16px;border:none;background:none;color:#3a6ea5;font-weight:500;border-bottom:2px solid #3a6ea5;margin-bottom:-2px;cursor:pointer;", "Tab 1" }
            button { style: "padding:6px 16px;border:none;background:none;color:#999;cursor:pointer;", "Tab 2" }
            button { style: "padding:6px 16px;border:none;background:none;color:#999;cursor:pointer;", "Tab 3" }
        }
        div { style: "padding:8px;color:#333;font-size:14px;", "Content of Tab 1" }
    }
}
```

## Breadcrumb

```hikari
rsx! {
    div { style: "padding:1rem;font-size:14px;color:#999;",
        a { href: "#", style: "color:#3a6ea5;text-decoration:none;", "Home" }
        span { " / " }
        a { href: "#", style: "color:#3a6ea5;text-decoration:none;", "Components" }
        span { " / " }
        span { style: "color:#333;", "Breadcrumb" }
    }
}
```
