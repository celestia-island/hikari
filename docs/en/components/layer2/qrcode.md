# QRCode

QR code generation component.

## Basic Usage

```hikari
rsx! {
    div { style: "padding:1rem;",
        div { style: "width:100px;height:100px;background:#000;display:grid;grid-template-columns:repeat(10,1fr);",
            div { style: "background:#fff;aspect-ratio:1;", "" }
        }
    }
}
```

## API

| Property | Description | Type | Default |
|----------|-------------|------|---------|
| value | QR code content | String | - |
| size | Size | u32 | 128 |
