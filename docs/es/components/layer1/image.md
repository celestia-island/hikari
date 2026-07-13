# Image

Componente Image para mostrar imágenes con estado de carga y manejo de errores.

## Uso Básico

```hikari
rsx! {
    div { style: "padding:1rem;",
        img { src: "https://via.placeholder.com/200x120", alt: "Sample", style: "border-radius:8px;max-width:100%;" }
    }
}
```

## Marcador de Posición de Carga

```hikari
rsx! {
    div { style: "padding:1rem;",
        div { style: "width:200px;height:120px;background:#f0f0f0;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#999;", "No Image" }
    }
}
```

## API

| Propiedad | Descripción | Tipo | Por Defecto |
|-----------|-------------|------|-------------|
| src | URL de la imagen | String | - |
| alt | Texto alternativo | String | - |
| width | Ancho | Option\<String\> | None |
| height | Alto | Option\<String\> | None |
