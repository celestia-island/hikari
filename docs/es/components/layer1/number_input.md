# Number Input Entrada numérica

El componente Number Input se utiliza para la entrada numérica con soporte de incremento.

## Uso básico

```hikari
rsx! {
    div { style: "padding:1rem;",
        div { style: "display:inline-flex;border:1px solid #d9d9d9;border-radius:6px;overflow:hidden;",
            button { style: "padding:4px 12px;border:none;background:#f5f5f5;cursor:pointer;", "−" }
            input { type: "text", value: "0", style: "padding:8px;width:60px;border:none;text-align:center;font-size:14px;" }
            button { style: "padding:4px 12px;border:none;background:#f5f5f5;cursor:pointer;", "+" }
        }
    }
}
```

## Tamaños

Tres tamaños disponibles: Pequeño, Mediano (predeterminado) y Grande.

```hikari
rsx! {
    div { style: "display:flex;gap:12px;padding:1rem;align-items:center;",
        input { type: "text", value: "1", style: "padding:4px 8px;width:50px;border:1px solid #ccc;border-radius:4px;font-size:12px;text-align:center;" }
        input { type: "text", value: "10", style: "padding:8px 12px;width:60px;border:1px solid #ccc;border-radius:6px;font-size:14px;text-align:center;" }
        input { type: "text", value: "100", style: "padding:12px 16px;width:80px;border:1px solid #ccc;border-radius:8px;font-size:16px;text-align:center;" }
    }
}
```

## Estado deshabilitado

```hikari
rsx! {
    div { style: "padding:1rem;",
        div { style: "display:inline-flex;border:1px solid #d9d9d9;border-radius:6px;overflow:hidden;opacity:0.5;",
            button { disabled: true, style: "padding:4px 12px;border:none;background:#f5f5f5;", "−" }
            input { type: "text", value: "0", disabled: true, style: "padding:8px;width:60px;border:none;text-align:center;" }
            button { disabled: true, style: "padding:4px 12px;border:none;background:#f5f5f5;", "+" }
        }
    }
}
```

## Incrementador con rango

Puede establecer el valor mínimo, el valor máximo y el tamaño del paso.

```hikari
rsx! {
    div { style: "padding:1rem;",
        div { style: "display:inline-flex;border:1px solid #d9d9d9;border-radius:6px;",
            button { style: "padding:8px 16px;border:none;background:#3a6ea5;color:#fff;cursor:pointer;", "−" }
            span { style: "padding:8px 24px;font-size:16px;font-weight:600;", "5" }
            button { style: "padding:8px 16px;border:none;background:#3a6ea5;color:#fff;cursor:pointer;", "+" }
        }
    }
}
```

## API

| Propiedad | Descripción | Tipo | Predeterminado |
|-----------|-------------|------|----------------|
| value | Valor actual | i64 | 0 |
| on_change | Callback de cambio de valor | EventHandler<i64> | - |
| min | Valor mínimo | Option<i64> | None |
| max | Valor máximo | Option<i64> | None |
| step | Tamaño del paso | i64 | 1 |
| disabled | Si está deshabilitado | bool | false |
| size | Variante de tamaño | NumberInputSize | Medium |
| class | Nombre de clase personalizado | String | "" |
| style | Estilo personalizado | String | "" |

### NumberInputSize

- `Small` - Tamaño pequeño (24px)
- `Medium` - Tamaño mediano (32px, predeterminado)
- `Large` - Tamaño grande (40px)
