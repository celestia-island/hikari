# Number Input

Componente Number Input para entrada numérica con soporte de stepper.

## Uso Básico

```_hikari_component
pages/components/layer1/number_input#basic
```

## Con Stepper

```_hikari_component
pages/components/layer1/number_input#stepper
```

## API

| Propiedad | Descripción | Tipo | Por Defecto |
|-----------|-------------|------|-------------|
| value | Valor actual | i64 | 0 |
| min | Valor mínimo | Option\<i64\> | None |
| max | Valor máximo | Option\<i64\> | None |
| step | Tamaño del paso | i64 | 1 |
