# Avatar

El componente Avatar se utiliza para mostrar imágenes de avatar de usuarios o entidades.

## Tamaños

Soporta cinco tamaños: Xs, Sm, Md, Lg, Xl.

```hikari
rsx! {
    div { style: "display:flex;gap:8px;padding:1rem;align-items:center;",
        div { style: "width:16px;height:16px;border-radius:50%;background:#3a6ea5;display:flex;align-items:center;justify-content:center;color:#fff;font-size:8px;", "XS" }
        div { style: "width:24px;height:24px;border-radius:50%;background:#3a6ea5;display:flex;align-items:center;justify-content:center;color:#fff;font-size:10px;", "S" }
        div { style: "width:32px;height:32px;border-radius:50%;background:#3a6ea5;display:flex;align-items:center;justify-content:center;color:#fff;font-size:12px;", "M" }
        div { style: "width:40px;height:40px;border-radius:50%;background:#3a6ea5;display:flex;align-items:center;justify-content:center;color:#fff;font-size:14px;", "L" }
        div { style: "width:48px;height:48px;border-radius:50%;background:#3a6ea5;display:flex;align-items:center;justify-content:center;color:#fff;font-size:16px;", "XL" }
    }
}
```

## Variantes de Forma

Soporta tres formas: Circular, Redondeada, Cuadrada.

```hikari
rsx! {
    div { style: "display:flex;gap:12px;padding:1rem;align-items:center;",
        div { style: "width:40px;height:40px;border-radius:50%;background:#3a6ea5;display:flex;align-items:center;justify-content:center;color:#fff;", "A" }
        div { style: "width:40px;height:40px;border-radius:8px;background:#3a6ea5;display:flex;align-items:center;justify-content:center;color:#fff;", "B" }
        div { style: "width:40px;height:40px;border-radius:0;background:#3a6ea5;display:flex;align-items:center;justify-content:center;color:#fff;", "C" }
    }
}
```

## Texto de Respaldo

Cuando no hay imagen disponible, muestra iniciales o texto personalizado.

```hikari
rsx! {
    div { style: "display:flex;gap:8px;padding:1rem;",
        div { style: "width:40px;height:40px;border-radius:50%;background:#3a6ea5;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:600;", "JD" }
    }
}
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
