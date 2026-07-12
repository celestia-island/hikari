# Contrôles de zoom

Composant de contrôle de zoom pour la mise à l'échelle de l'interface.

## Utilisation de base

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

| Propriété | Description | Type | Défaut |
|----------|-------------|------|--------|
| zoom | Niveau de zoom | f64 | 1.0 |
| min | Minimum | f64 | 0.5 |
| max | Maximum | f64 | 2.0 |
