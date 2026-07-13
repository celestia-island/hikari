# Cascader

Cascader se utiliza para selección de datos multinivel.

## Uso Básico

```hikari
rsx! {
    div { style: "padding:1rem;",
        select { style: "padding:6px 12px;border:1px solid #ccc;border-radius:4px;font-size:14px;",
            option { "Province / City / District" }
        }
    }
}
```

## API

| Propiedad | Descripción | Tipo | Por Defecto |
|-----------|-------------|------|-------------|
| options | Datos de opciones | Vec\<CascaderOption\> | - |
| value | Valor actual | Option\<String\> | None |
| on_change | Callback de cambio | EventHandler\<String\> | - |
