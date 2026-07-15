# エディタコンポーネント

プロダクションレベルのエディタコンポーネント。参考: Prism.js, CodeMirror。

## MarkdownEditor

```hikari
rsx! {
    div { style: "padding:1rem;border:1px solid #e2e2ea;border-radius:8px;",
        div { style: "padding:8px 12px;border-bottom:1px solid #e2e2ea;font-size:12px;color:#999;", "Markdown Editor" }
        div { style: "padding:12px;", "Type **markdown** here..." }
    }
}
```

## CodeEditor

```hikari
rsx! {
    div { style: "padding:1rem;",
        div { style: "background:#1e1e2a;border-radius:8px;overflow:hidden;",
            div { style: "padding:6px 12px;background:#16161e;color:#999;font-size:12px;border-bottom:1px solid #333;", "main.rs" }
            pre { style: "padding:12px;color:#e0e0e8;font-size:13px;margin:0;", "fn main() { println!("Hello"); }" }
        }
    }
}
```

## RichTextEditor

```hikari
rsx! {
    div { style: "padding:1rem;border:1px solid #e2e2ea;border-radius:8px;",
        div { style: "padding:8px 12px;border-bottom:1px solid #e2e2ea;display:flex;gap:8px;",
            button { style: "border:none;background:none;cursor:pointer;font-weight:bold;", "B" }
            button { style: "border:none;background:none;cursor:pointer;font-style:italic;", "I" }
            button { style: "border:none;background:none;cursor:pointer;text-decoration:underline;", "U" }
        }
        div { style: "padding:12px;min-height:60px;", "Rich text content" }
    }
}
```
