# Tree

Tree component for displaying hierarchical data.

## Basic Usage

```hikari
rsx! {
    div { style: "padding:1rem;font-size:14px;",
        div { style: "padding:4px 0;cursor:pointer;font-weight:500;", "▼ src" }
        div { style: "padding:4px 0 4px 20px;", "main.rs" }
        div { style: "padding:4px 0 4px 20px;", "lib.rs" }
        div { style: "padding:4px 0;cursor:pointer;", "▶ tests" }
    }
}
```

## API

| Property | Description | Type | Default |
|----------|-------------|------|---------|
| data | Tree data | Vec\<TreeNode\> | - |
| selected | Selected node | Option\<String\> | None |
