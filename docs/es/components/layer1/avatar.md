# Avatar

El componente Avatar se utiliza para mostrar imágenes de avatar de usuarios o entidades.

## Tamaños

Soporta cinco tamaños: Xs, Sm, Md, Lg, Xl.

```_hikari_component
pages/components/layer1/avatar#sizes
```

## Variantes de Forma

Soporta tres formas: Circular, Redondeada, Cuadrada.

```_hikari_component
pages/components/layer1/avatar#variants
```

## Texto de Respaldo

Cuando no hay imagen disponible, muestra iniciales o texto personalizado.

```_hikari_component
pages/components/layer1/avatar#fallback
```

## API

### Props

| Propiedad | Descripción | Tipo | Por Defecto |
|-----------|-------------|------|-------------|
| src | URL de la imagen | Option\<String\> | None |
| alt | Texto alternativo | String | - |
| size | Tamaño | AvatarSize | Md |
| variant | Variante de forma | AvatarVariant | Circular |
| fallback | Texto de respaldo | Option\<String\> | None |
