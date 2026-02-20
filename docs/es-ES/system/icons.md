# Sistema de Iconos

Sistema de gestión y renderizado de iconos, integrado con Lucide Icons.

## Descripción General

`hikari-icons` proporciona:

- **1000+ Iconos** - Colección completa de Lucide Icons
- **Seguridad de Tipos** - Nombres de iconos basados en enum
- **Renderizado SVG** - Renderizado del lado del cliente y del servidor
- **Carga en Tiempo de Ejecución** - Carga de SVG de iconos bajo demanda

## Componente Icon

### Uso Básico

```rust
use dioxus::prelude::*;
use hikari_icons::{Icon, LucideIcon};

rsx! {
    Icon {
        icon: LucideIcon::Search,
        size: 24,
        color: "var(--hi-color-primary)"
    }
}
```

### Iconos Disponibles

```rust
pub enum LucideIcon {
    // Navegación
    Home,
    Menu,
    Search,
    Settings,
    ChevronDown,
    ChevronLeft,
    ChevronRight,

    // Acciones
    Edit,
    Trash,
    Check,
    X,
    Plus,
    Minus,

    // Estado
    AlertCircle,
    CheckCircle,
    Info,
    AlertTriangle,

    // ... 1000+ iconos
}
```

### Props

| Propiedad | Tipo | Por Defecto | Descripción |
|-----------|------|-------------|-------------|
| `icon` | `LucideIcon` | - | Tipo de icono |
| `size` | `u32` | `24` | Tamaño del icono |
| `color` | `&str` | - | Color |

## Carga en Tiempo de Ejecución

### Renderizado del Lado del Cliente

```rust
use hikari_icons::runtime;

// Cargar SVG de icono de forma asíncrona
async fn load_icon(name: &str) -> Result<String, Error> {
    runtime::load_icon(name).await
}
```

### Renderizado del Lado del Servidor

```rust
use hikari_icons::server;

// Renderizar icono del lado del servidor
fn render_icon(name: &str) -> String {
    server::render_icon(name)
}
```

## Referencia de API

### Icon

```rust
#[component]
pub fn Icon(
    icon: LucideIcon,
    size: Option<u32>,
    color: Option<&str>,
    class: Option<String>,
    style: Option<String>
) -> Element
```

### LucideIcon

```rust
pub enum LucideIcon {
    // 1000+ variantes de iconos
}
```

### runtime

```rust
pub mod runtime {
    pub async fn load_icon(name: &str) -> Result<String, Error>;
}
```

### server

```rust
pub mod server {
    pub fn render_icon(name: &str) -> String;
}
```

## Integración con Otros Sistemas

- **Componentes** - Iconos usados en Button, Input y otros componentes
- **Render-service** - Servicio de archivos de iconos estáticos
- **Tema** - Los colores de iconos heredan del tema

## Sistemas Relacionados

- [Componentes](../components/) - Componentes que usan iconos
- [Render-service](./render-service.md) - Servicio de archivos de iconos
- [Paleta](./palette.md) - Colores de iconos
