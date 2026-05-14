# Descripción General de la Arquitectura del Sistema

El framework Hikari adopta un diseño modular, construido sobre el runtime Tairitsu, compuesto por 6 paquetes independientes.

## Resumen de Paquetes

| Paquete | Descripción |
|---|---|
| hikari-palette | Sistema de colores tradicionales chinos (500+), gestión de paletas de tema |
| hikari-animation | Sistema de animación declarativa, funciones de easing, interpolación, control de línea de tiempo |
| hikari-icons | Integración de Material Design Icons (7000+), generación SVG |
| hikari-theme | Contexto de tema, generación de variables CSS, cambio de tema |
| hikari-components | Biblioteca de componentes UI principales (40+ componentes) |
| hikari-extra-components | Componentes avanzados (editor de nodos, texto enriquecido, etc.) |

## Arquitectura en Capas

```
┌─────────────────────────────────────┐
│     Capa de Aplicación (examples/)   │
├─────────────────────────────────────┤
│  Capa de Componentes (components, extra)│
├─────────────────────────────────────┤
│ Capa de Sistema (theme, animation, icons)│
├─────────────────────────────────────┤
│   Capa de Fundación (palette)        │
└─────────────────────────────────────┘
```

## Dependencias de Paquetes

```
hikari-palette ◄──── hikari-animation
      ▲                    │
      │                    ▼
      ├──────────── hikari-icons
      │
      ├─── hikari-theme
      │
      ├─── hikari-components ◄── hikari-theme, hikari-icons
      │
      └─── hikari-extra-components ◄── hikari-theme, hikari-icons
```

## Dependencias Externas

Todos los paquetes se basan en el framework **Tairitsu** (tairitsu-vdom, tairitsu-hooks, tairitsu-style, tairitsu-web) como runtime de UI reactiva / WASM.
