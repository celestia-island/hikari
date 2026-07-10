# Search

Search component for search input.

## Basic Usage

```hikari
rsx! {
    div { style: "padding:1rem;",
        input { type: "search", placeholder: "Search...", style: "padding:8px 12px 8px 36px;border:1px solid #d9d9d9;border-radius:6px;font-size:14px;width:240px;" }
    }
}
```

## With Suggestions

Search with suggestion dropdown.

```hikari
rsx! {
    div { style: "padding:1rem;position:relative;width:240px;",
        input { type: "search", placeholder: "Search...", value: "ru", style: "padding:8px 12px;border:1px solid #3a6ea5;border-radius:6px;font-size:14px;width:100%;" }
        div { style: "margin-top:4px;border:1px solid #e2e2ea;border-radius:6px;box-shadow:0 4px 12px rgba(0,0,0,0.08);",
            div { style: "padding:8px 12px;font-size:14px;background:#f0f7ff;cursor:pointer;", "Rust" }
            div { style: "padding:8px 12px;font-size:14px;cursor:pointer;", "Ruby" }
        }
    }
}
```

## API

| Property | Description | Type | Default |
|----------|-------------|------|---------|
| placeholder | Placeholder text | String | "Search..." |
| on_search | Search callback | Option\<EventHandler\<String\>\> | None |
| suggestions | Suggestion list | Vec\<String> | [] |
| allow_clear | Show clear button | bool | true |
| loading | Show loading state | bool | false |
