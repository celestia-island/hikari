# Cascader

Cascader se utiliza para selección de datos multinivel.

## Uso Básico

```_hikari_component
pages/components/layer2/cascader#basic
```

## API

| Propiedad | Descripción | Tipo | Por Defecto |
|-----------|-------------|------|-------------|
| options | Datos de opciones | Vec\<CascaderOption\> | - |
| value | Valor actual | Option\<String\> | None |
| on_change | Callback de cambio | EventHandler\<String\> | - |
