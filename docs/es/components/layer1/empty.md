# Empty

Componente Empty para mostrar estado de datos vacíos.

## Uso Básico

```hikari
rsx! {
    div { style: "padding:2rem;text-align:center;color:#999;",
        p { style: "font-size:14px;margin:0;", "No data available" }
    }
}
```

## API

| Propiedad | Descripción | Tipo | Por Defecto |
|-----------|-------------|------|-------------|
| description | Texto de descripción | Option\<String\> | None |
