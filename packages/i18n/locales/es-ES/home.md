# Framework de UI Hikari

Hikari (光) es un framework moderno de UI para Rust, construido con:

- **Tairitsu 0.7** - Framework de UI reactivo
- **Grass** - Compilador SCSS
- **Axum** - Servidor web para SSR

## Filosofía de diseño

Hikari combina:

- **Estética Arknights** - Líneas limpias, alto contraste
- **FUI (Future User Interface)** - Efectos de brillo, indicadores dinámicos
- **Colores tradicionales chinos** - 500+ nombres de colores auténticos

## Inicio rápido

```bash
cargo new my-app
cd my-app
cargo add hikari-components hikari-theme
```

```rust
use hikari_components::{ThemeProvider, Button};

fn App() -> Element {
    rsx! {
        ThemeProvider { palette: "hikari" } {
            Button { label: "¡Hola, Hikari!" }
        }
    }
}
```

## Características

- 🎨 500+ colores tradicionales chinos
- 🌙 Temas claro y oscuro
- 🔧 Clases de utilidad con seguridad de tipos
- ✨ Animaciones fluidas
- 📱 Componentes responsivos
- 🌐 Soporte de i18n integrado

## Documentación

Visita [docs.hikari.dev](https://docs.hikari.dev) para la documentación completa.
