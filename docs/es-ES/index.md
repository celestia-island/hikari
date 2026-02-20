# Hikari UI Framework

> Un framework UI moderno para Rust construido sobre Dioxus + Grass + Axum
>
> **Estilo de Diseño**: Diseño plano de Arknights + Estética sci-fi FUI + Colores tradicionales chinos
>
> **Origen del Nombre**: "Hikari" (Luz) del juego de ritmo Arcaea

## ¿Qué es Hikari?

Hikari es un framework UI moderno diseñado para el ecosistema Rust, que combina la estética de colores tradicionales chinos con el diseño de interfaz sci-fi. El framework adopta un diseño modular, proporcionando una biblioteca completa de componentes, sistema de temas y sistema de animación.

## Características Principales

### 🎨 Sistema de Colores Tradicionales Chinos
- **500+ Colores Tradicionales**: Paleta completa de colores tradicionales chinos
- **Sistema de Temas**: Temas integrados Hikari (claro) y Tairitsu (oscuro)
- **Seguridad de Tipos**: Valores de color verificados en tiempo de compilación

### 🧩 Rica Biblioteca de Componentes
- **Componentes Básicos**: Button, Input, Card, Badge
- **Componentes de Retroalimentación**: Alert, Toast, Tooltip, Spotlight
- **Componentes de Navegación**: Menu, Tabs, Breadcrumb
- **Componentes de Datos**: Table, Tree, Pagination
- **Componentes de Diseño**: Layout, Header, Aside, Content, Footer
- **Componentes Extra**: Collapsible, DragLayer, ZoomControls

### ✨ Potente Sistema de Animación
- **Animaciones Declarativas**: API fluida similar a CSS
- **Valores Dinámicos**: Valores de animación calculados en tiempo de ejecución
- **Funciones de Easing**: Más de 30 funciones de easing
- **Animaciones Predefinidas**: Fade, slide, scale, etc.

### 🎯 Características Avanzadas
- **Renderizado del Lado del Servidor**: Soporte completo SSR
- **Seguridad de Tipos**: Uso completo del sistema de tipos de Rust
- **Diseño Responsivo**: Utilidades de diseño responsivo integradas
- **Sistema de Compilación**: Compilación SCSS automatizada y generación de assets

## Inicio Rápido

### Instalar Dependencias

Añadir a `Cargo.toml`:

```toml
[dependencies]
hikari-components = "0.1"
hikari-palette = "0.1"
hikari-theme = "0.1"
dioxus = "0.5"
```

### Uso Básico

```rust
use dioxus::prelude::*;
use hikari_components::{ThemeProvider, Button};
use hikari_theme::ThemeProvider;

#[component]
fn App() -> Element {
    rsx! {
        ThemeProvider { palette: "hikari" } {
            div { class: "hi-flex hi-flex-col hi-gap-4" {
                Button { label: "Haz Clic" }
                Button { label: "Botón Primario", variant: "primary" }
                Button { label: "Botón Secundario", variant: "secondary" }
            }
        }
    }
}
```

### Compilar y Ejecutar

```bash
# Modo desarrollo
cargo run

# Compilar
cargo build --release

# Compilar WASM
trunk build --release
```

## Filosofía de Diseño

### Diseño Plano de Arknights
- Líneas limpias y jerarquía de información clara
- Alto contraste para legibilidad
- Diseño minimalista pero refinado

### Estética Sci-Fi FUI
- Efectos de brillo sutiles
- Indicadores dinámicos (luces respiratorias, animaciones de pulso)
- Bordes finos y patrones geométricos

### Colores Tradicionales Chinos
- Primario: 石青 (Cian/Azul), 朱砂 (Bermellón/Rojo), 藤黄 (Gambuja/Amarillo)
- Neutro: 月白 (Blanco Claro), 墨色 (Negro Tinta), 缟色 (Gris Claro)
- Funcional: 葱倩 (Éxito), 鹅黄 (Advertencia), 朱砂 (Peligro)

## Estructura del Proyecto

```
hikari/
  ├── packages/
  │   ├── hikari-palette/          # Paleta de colores tradicionales chinos
  │   ├── hikari-theme/            # Sistema de temas
  │   ├── hikari-animation/        # Sistema de animación
  │   ├── hikari-icons/            # Sistema de iconos
  │   ├── hikari-components/       # Biblioteca de componentes
  │   ├── hikari-extra-components/ # Biblioteca de componentes extra
  │   ├── hikari-builder/          # Sistema de compilación
  │   └── hikari-render-service/   # Servicio SSR
  │
  └── examples/
      ├── website/                 # Sitio web oficial
      ├── table-demo/              # Demo del componente Table
      ├── tree-demo/               # Demo del componente Tree
      └── node-graph-demo/         # Demo de grafo de nodos
```

## Documentación

- [Componentes](./components/) - Guía de uso de componentes UI
- [Sistema](./system/) - Arquitectura del sistema central
- [Referencia API](https://docs.rs/hikari-components) - Documentación API de Rust

## Ejemplos

### Cambio de Tema

```rust
use dioxus::prelude::*;
use hikari_theme::ThemeProvider;

fn App() -> Element {
    let mut theme = use_signal(|| "hikari".to_string());

    rsx! {
        ThemeProvider { palette: "{theme}" } {
            button {
                onclick: move |_| {
                    theme.set(if *theme() == "hikari" {
                        "tairitsu".to_string()
                    } else {
                        "hikari".to_string()
                    });
                },
                "Cambiar Tema"
            }
        }
    }
}
```

### Uso de Animaciones

```rust
use hikari_animation::{AnimationBuilder, AnimationContext};
use hikari_animation::style::CssProperty;

// Animación estática
AnimationBuilder::new(&elements)
    .add_style("button", CssProperty::Opacity, "0.8")
    .apply_with_transition("300ms", "ease-in-out");

// Animación dinámica (seguimiento del ratón)
AnimationBuilder::new(&elements)
    .add_style_dynamic("button", CssProperty::Transform, |ctx| {
        let x = ctx.mouse_x();
        let y = ctx.mouse_y();
        format!("translate({}px, {}px)", x, y)
    })
    .apply_with_transition("150ms", "ease-out");
```

## Contribuir

¡Las contribuciones son bienvenidas! Por favor, lee [CONTRIBUTING.md](../../CONTRIBUTING.md) para más detalles.

## Licencia

[Licencia MIT](../../LICENSE)

## Agradecimientos

- [Dioxus](https://dioxuslabs.com/) - Potente framework UI para Rust
- [Grass](https://github.com/kaj/kaj) - Compilador SCSS puro en Rust
- [Element Plus](https://element-plus.org/) - Excelente referencia de diseño de biblioteca de componentes
- [Material UI](https://mui.com/) - Inspiración de diseño UI moderno

---

**Hikari** - Minimalismo, Tecnología, Confianza Cultural
