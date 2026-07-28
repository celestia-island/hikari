# Tree 树形

树形组件用于展示层级数据。

## 基础用法

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

| 属性 | 说明 | 类型 | 默认值 |
|------|------|------|--------|
| data | 树形数据 | Vec\<TreeNode\> | - |
| selected | 选中节点 | Option\<String\> | None |
