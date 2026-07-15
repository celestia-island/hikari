# UserGuide

User guide component for feature introduction.

## Basic Usage

```hikari
rsx! {
    div { style: "padding:1rem;",
        div { style: "display:flex;align-items:center;gap:12px;margin-bottom:16px;",
            div { style: "width:32px;height:32px;border-radius:50%;background:#3a6ea5;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:600;", "1" }
            div { style: "font-size:14px;", "Welcome! Click here to start." }
        }
        div { style: "display:flex;align-items:center;gap:12px;",
            div { style: "width:32px;height:32px;border-radius:50%;border:2px solid #ccc;color:#999;display:flex;align-items:center;justify-content:center;", "2" }
            div { style: "font-size:14px;color:#999;", "Configure your settings." }
        }
    }
}
```

## API

| Property | Description | Type | Default |
|----------|-------------|------|---------|
| steps | Guide steps | Vec\<GuideStep\> | - |
| active | Current step | usize | 0 |
