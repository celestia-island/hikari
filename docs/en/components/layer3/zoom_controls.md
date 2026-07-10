# ZoomControls

Zoom control component for interface scaling.

## Basic Usage

```hikari
rsx! {
    div { style: "padding:1rem;display:inline-flex;gap:4px;align-items:center;border:1px solid #e2e2ea;border-radius:6px;padding:4px;",
        button { style: "width:28px;height:28px;border:none;background:none;cursor:pointer;font-size:16px;", "−" }
        span { style: "font-size:14px;min-width:40px;text-align:center;", "100%" }
        button { style: "width:28px;height:28px;border:none;background:none;cursor:pointer;font-size:16px;", "+" }
    }
}
```

## API

| Property | Description | Type | Default |
|----------|-------------|------|---------|
| zoom | Zoom level | f64 | 1.0 |
| min | Minimum | f64 | 0.5 |
| max | Maximum | f64 | 2.0 |
