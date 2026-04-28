# Number Input Entrada numérica

El componente Number Input se utiliza para la entrada numérica con soporte de incremento.

## Uso básico

```_hikari_component
pages/components/layer1/number_input#basic
```

## Tamaños

Tres tamaños disponibles: Pequeño, Mediano (predeterminado) y Grande.

```_hikari_component
pages/components/layer1/number_input#sizes
```

## Estado deshabilitado

```_hikari_component
pages/components/layer1/number_input#disabled
```

## Incrementador con rango

Puede establecer el valor mínimo, el valor máximo y el tamaño del paso.

```_hikari_component
pages/components/layer1/number_input#stepper
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
