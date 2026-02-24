# Search

Componente Search para entrada de búsqueda.

## Uso Básico

```_hikari_component
pages/components/layer1/search#basic
```

## Entrada de Voz

Admite funcionalidad de entrada de voz. Haga clic en el icono del micrófono para comenzar a grabar.

```_hikari_component
pages/components/layer1/search#voice
```

## API

| Propiedad | Descripción | Tipo | Por Defecto |
|-----------|-------------|------|-------------|
| placeholder | Texto de marcador de posición | String | "Buscar..." |
| on_search | Callback de búsqueda | Option\<EventHandler\<String\>\> | None |
| voice_input | Habilitar entrada de voz | bool | false |
