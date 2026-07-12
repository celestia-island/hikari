# Media Components

Production-level media playback components. Reference: Video.js, Howler.js.

## VideoPlayer

```hikari
rsx! {
    div { style: "padding:1rem;",
        div { style: "position:relative;width:320px;height:180px;background:#000;border-radius:8px;display:flex;align-items:center;justify-content:center;",
            button { style: "width:48px;height:48px;border-radius:50%;border:none;background:rgba(255,255,255,0.9);color:#333;cursor:pointer;font-size:20px;", "▶" }
        }
    }
}
```

## AudioPlayer

```hikari
rsx! {
    div { style: "padding:1rem;display:flex;align-items:center;gap:12px;",
        button { style: "width:40px;height:40px;border-radius:50%;border:none;background:#3a6ea5;color:#fff;cursor:pointer;font-size:16px;", "▶" }
        div { style: "flex:1;",
            div { style: "height:4px;background:#e2e2ea;border-radius:2px;",
                div { style: "width:30%;height:100%;background:#3a6ea5;border-radius:2px;", "" } }
            div { style: "display:flex;justify-content:space-between;font-size:12px;color:#999;margin-top:4px;",
                span { "1:23" } span { "4:56" } }
        }
    }
}
```
