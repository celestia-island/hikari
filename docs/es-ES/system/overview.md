# Descripción General de la Arquitectura del Sistema

El framework Hikari adopta un diseño modular, consistiendo en múltiples paquetes independientes, cada uno responsable de dominios funcionales específicos.

## Sistemas Principales

### 1. Sistema Palette (hikari-palette)

Implementación en Rust del sistema de colores tradicionales chinos.

**Responsabilidades**:
- Proporciona más de 500 definiciones de colores tradicionales chinos
- Gestión de paletas de tema
- Generador de clases de utilidad
- Opacidad y mezcla de colores

**Características Principales**:
```rust
use hikari_palette::{ChineseColor, opacity};

// Usar colores tradicionales
let red = ChineseColor::Cinnabar;
let blue = ChineseColor::Azurite;

// Manejo de opacidad
let semi_red = opacity(red, 0.5);

// Sistema de tema
let theme = Hikari::default();
println!("Primario: {}", theme.primary.hex());
```

**Filosofía de Diseño**:
- **Confianza Cultural**: Uso de nombres de colores tradicionales
- **Seguridad de Tipos**: Verificación de valores de color en tiempo de compilación
- **Alto Rendimiento**: Abstracciones de costo cero

### 2. Sistema Theme (hikari-theme)

Contexto de tema y sistema de inyección de estilos.

**Responsabilidades**:
- Componente proveedor de tema
- Gestión de contexto de tema
- Generación de variables CSS
- Cambio de tema

**Características Principales**:
```rust
use hikari_theme::ThemeProvider;

rsx! {
    ThemeProvider { palette: "hikari" } {
        // Contenido de la aplicación
        App {}
    }
}
```

**Temas Soportados**:
- **Hikari (Claro)** - Tema claro
  - Primario: Azurita (#00A0E9)
  - Secundario: Bermellón (#E94B35)
  - Acento: Amarillo Vid (#F8B62D)

- **Tairitsu** - Tema oscuro
  - Primario: Índigo (#1a237e)
  - Secundario: Bermellón (#E94B35)
  - Acento: Amarillo Ganso (#FFF176)

### 3. Sistema Animation (hikari-animation)

Sistema de animación declarativa de alto rendimiento.

**Responsabilidades**:
- Constructor de animación
- Contexto de animación
- Funciones de easing
- Animaciones predefinidas

**Características Principales**:
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

**Componentes de Arquitectura**:
- **builder** - API del constructor de animación
- **context** - Contexto de animación en tiempo de ejecución
- **style** - Operaciones CSS con seguridad de tipos
- **easing** - Más de 30 funciones de easing
- **tween** - Sistema de interpolación
- **timeline** - Control de línea de tiempo
- **presets** - Animaciones predefinidas (fade, slide, scale)
- **spotlight** - Efecto de spotlight

**Características de Rendimiento**:
- Optimización WASM
- Actualizaciones con debounce
- Integración con requestAnimationFrame
- Reflujos y repintados minimizados

### 4. Sistema Icon (hikari-icons)

Sistema de gestión y renderizado de iconos.

**Responsabilidades**:
- Definiciones de enum de iconos
- Generación de contenido SVG
- Variantes de tamaño de icono
- Integración de Lucide Icons

**Características Principales**:
```rust
use hikari_icons::{Icon, LucideIcon};

rsx! {
    Icon {
        icon: LucideIcon::Search,
        size: 24,
        color: "var(--hi-primary)"
    }
}
```

**Fuentes de Iconos**:
- Lucide Icons (más de 1000 iconos)
- Iconos personalizados extensibles
- Soporte de múltiples tamaños

### 5. Biblioteca de Componentes (hikari-components)

Biblioteca completa de componentes UI.

**Responsabilidades**:
- Componentes UI básicos
- Componentes de diseño
- Registro de estilos
- Hooks responsivos

**Categorías de Componentes**:

1. **Componentes Básicos** (feature: "basic")
   - Button, Input, Card, Badge

2. **Componentes de Retroalimentación** (feature: "feedback")
   - Alert, Toast, Tooltip, Spotlight

3. **Componentes de Navegación** (feature: "navigation")
   - Menu, Tabs, Breadcrumb

4. **Componentes de Diseño** (siempre disponibles)
   - Layout, Header, Aside, Content, Footer

5. **Componentes de Datos** (feature: "data")
   - Table, Tree, Pagination

**Diseño Modular**:
```
hikari-components/
  ├── basic/          # Componentes básicos
  ├── feedback/       # Componentes de retroalimentación
  ├── navigation/     # Componentes de navegación
  ├── layout/         # Componentes de diseño
  ├── data/           # Componentes de datos
  ├── hooks.rs        # React hooks
  ├── styled.rs       # Traits de estilo
  └── theme_provider.rs  # Provider de tema
```

**Sistema de Estilos**:
- Fuente SCSS
- Clases de utilidad con seguridad de tipos
- Aislamiento de estilo a nivel de componente
- Integración de variables CSS

### 6. Sistema Build (hikari-builder)

Generación de código en tiempo de compilación y compilación SCSS.

**Responsabilidades**:
- Compilación SCSS (usando Grass)
- Descubrimiento de componentes
- Generación de código
- Empaquetado de recursos

**Proceso de Compilación**:
```
1. Encontrar directorio raíz del workspace
   ↓
2. Escanear archivos SCSS
   ↓
3. Generar constantes Rust
   ↓
4. Compilar bundle SCSS
   ↓
5. Salida a public/
```

**Uso**:
```rust
// build.rs
fn main() {
    hikari_builder::build().expect("Error de compilación");
}
```

**Archivos Generados**:
- `packages/builder/src/generated/components.rs` - Constantes de componente
- `public/styles/bundle.css` - CSS compilado

### 7. Servicio Render (hikari-render-service)

Renderizado del lado del servidor y servicio de assets estáticos.

**Responsabilidades**:
- Renderizado de plantillas HTML
- Registro de estilos
- Constructor de router
- Servicio de assets estáticos
- Integración con Axum

**Características Principales**:
```rust
use hikari_render_service::HikariRenderServicePlugin;

let app = HikariRenderServicePlugin::new()
    .component_style_registry(registry)
    .static_assets("./dist", "/static")
    .add_route("/api/health", get(health_check))
    .build()?;
```

**Módulos de Arquitectura**:
- **html** - Servicio HTML
- **registry** - Registro de estilos
- **router** - Constructor de router
- **static_files** - Servicio de archivos estáticos
- **styles_service** - Inyección de estilos
- **plugin** - Sistema de plugins

### 8. Biblioteca de Componentes Extra (hikari-extra-components)

Componentes UI avanzados para escenarios de interacción complejos.

**Responsabilidades**:
- Componentes de utilidad avanzados
- Interacciones de arrastre y zoom
- Paneles colapsables
- Integración de animación

**Componentes Principales**:

1. **Collapsible** - Panel colapsable
   - Animación de deslizamiento entrada/salida izquierda/derecha
   - Ancho configurable
   - Callback de estado expandido

2. **DragLayer** - Capa de arrastre
   - Restricciones de límites
   - Callbacks de eventos de arrastre
   - z-index personalizado

3. **ZoomControls** - Controles de zoom
   - Soporte de atajos de teclado
   - Rango de zoom configurable
   - Múltiples opciones de posicionamiento

**Características Principales**:
```rust
use hikari_extra_components::{Collapsible, DragLayer, ZoomControls};

// Panel colapsable
Collapsible {
    title: "Configuración".to_string(),
    expanded: true,
    position: CollapsiblePosition::Right,
    div { "Contenido" }
}

// Capa de arrastre
DragLayer {
    initial_x: 100.0,
    initial_y: 100.0,
    constraints: DragConstraints {
        min_x: Some(0.0),
        max_x: Some(500.0),
        ..Default::default()
    },
    div { "Arrástrame" }
}

// Controles de zoom
ZoomControls {
    zoom: 1.0,
    on_zoom_change: move |z| println!("Zoom: {}", z)
}
```

## Principios de Arquitectura

### 1. Diseño Modular

Cada paquete es independiente y se puede usar por separado:

```toml
# Usar solo palette
[dependencies]
hikari-palette = "0.1"

# Usar componentes y tema
[dependencies]
hikari-components = "0.1"
hikari-theme = "0.1"

# Usar sistema de animación
[dependencies]
hikari-animation = "0.1"
```

### 2. Arquitectura en Capas

```
┌─────────────────────────────────────┐
│     Capa de Aplicación (examples/)   │
├─────────────────────────────────────┤
│   Capa de Componentes (hikari-components)│
├─────────────────────────────────────┤
│ Capa de Sistema (theme, animation, icons)│
├─────────────────────────────────────┤
│  Capa de Fundación (palette, builder) │
└─────────────────────────────────────┘
```

### 3. Flujo de Datos Unidireccional

```
Acción del Usuario → Manejador de Eventos → Actualización de Estado → Re-renderizado UI
```

### 4. Seguridad de Tipos

Todas las APIs son seguras en tipos:
- Verificación en tiempo de compilación
- Autocompletado IDE
- Seguridad de refactorización

### 5. Rendimiento Primero

- Optimización WASM
- Scroll virtual
- Debouncing/throttling
- Manipulación DOM minimizada

## Proceso de Compilación

### Modo Desarrollo
```bash
cargo run
```

### Compilación de Producción
```bash
# 1. Compilar código Rust
cargo build --release

# 2. El sistema de compilación compila SCSS automáticamente
# 3. Generar bundle CSS
# 4. Empaquetar assets estáticos
```

### Compilación WASM
```bash
trunk build --release
```

## Dependencias

```
hikari-components
  ├── hikari-palette
  ├── hikari-theme
  ├── hikari-animation
  └── hikari-icons

hikari-extra-components
  ├── hikari-palette
  ├── hikari-theme
  └── hikari-animation

hikari-render-service
  ├── hikari-components
  └── axum

hikari-builder
  └── grass (compilador SCSS)
```

## Extensibilidad

### Añadir Componentes Personalizados

```rust
use hikari_components::{StyledComponent, StyleRegistry};

pub struct MyComponent;

impl StyledComponent for MyComponent {
    fn register_styles(registry: &mut StyleRegistry) {
        registry.register("my-component", include_str!("my-component.scss"));
    }
}
```

### Añadir Temas Personalizados

```rust
use hikari_palette::ThemePalette;

struct CustomTheme;

impl CustomTheme {
    pub fn palette() -> ThemePalette {
        ThemePalette {
            primary: "#FF0000",
            secondary: "#00FF00",
            // ...
        }
    }
}
```

### Añadir Presets de Animación Personalizados

```rust
use hikari_animation::{AnimationBuilder, AnimationContext};

pub fn fade_in(
    builder: AnimationBuilder,
    element: &str,
    duration: u32,
) -> AnimationBuilder {
    builder
        .add_style(element, CssProperty::Opacity, "0")
        .add_style(element, CssProperty::Opacity, "1")
        .apply_with_transition(&format!("{}ms", duration), "ease-out")
}
```

## Optimización de Rendimiento

### 1. Optimización CSS
- SCSS compilado a CSS optimizado
- Eliminar estilos no usados (tree-shaking)
- Minificar CSS de producción

### 2. Optimización WASM
- Optimización `wasm-opt`
- Carga perezosa de módulos WASM
- Optimización de memoria lineal

### 3. Optimización en Tiempo de Ejecución
- Scroll virtual (listas de datos grandes)
- Actualizaciones de animación con debounce
- requestAnimationFrame

### 4. Optimización de Compilación
- Compilación paralela
- Compilación incremental
- Caché de binarios

## Estrategia de Testing

### Tests Unitarios
Cada módulo tiene tests unitarios completos:

```rust
#[cfg(test)]
mod tests {
    #[test]
    fn test_color_conversion() {
        let color = ChineseColor::Cinnabar;
        assert_eq!(color.hex(), "#E94B35");
    }
}
```

### Tests de Integración
Las aplicaciones de ejemplo en `examples/` sirven como tests de integración

### Tests de Regresión Visual
Usar Percy o herramientas similares para tests de snapshot UI

## Siguientes Pasos

- Leer [Documentación de Componentes](../components/) para componentes específicos
- Ver [Documentación API](https://docs.rs/hikari-components) para detalles de API
- Explorar [Código de Ejemplo](../../examples/) para aprender mejores prácticas
