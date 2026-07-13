# ZoomControls

Componente de control de zoom para escalado de interfaz.

## Uso Básico

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

| Propiedad | Descripción | Tipo | Por Defecto |
|-----------|-------------|------|-------------|
| zoom | Nivel de zoom | f64 | 1.0 |
| min | Mínimo | f64 | 0.5 |
| max | Máximo | f64 | 2.0 |
