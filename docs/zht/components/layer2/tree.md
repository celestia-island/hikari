# Tree 樹形

樹形元件用於展示層級資料。

## 基礎用法

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

| 屬性 | 說明 | 類型 | 預設值 |
|------|------|------|--------|
| data | 樹形資料 | Vec\<TreeNode\> | - |
| selected | 選中節點 | Option\<String\> | None |
