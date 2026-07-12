# QRCode

Componente de generación de código QR.

## Uso Básico

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

| Propiedad | Descripción | Tipo | Por Defecto |
|-----------|-------------|------|-------------|
| value | Contenido del código QR | String | - |
| size | Tamaño | u32 | 128 |
