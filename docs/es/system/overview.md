# Descripción General de la Arquitectura del Sistema

El framework Hikari adopta un diseño modular, construido sobre el runtime Tairitsu, compuesto por 6 paquetes independientes.

## Resumen de Paquetes

| Paquete | Descripción |
|---|---|
| hikari-palette | Sistema de colores tradicionales chinos (660+), gestión de paletas de tema |
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

## Sistemas Principales

### 1. Sistema de Paleta (hikari-palette)

Implementación en Rust del sistema de colores tradicionales chinos.

**Responsabilidades**:
- Proporciona más de 660 definiciones de colores tradicionales chinos
- Gestión de paletas de tema
- Generador de clases utilitarias
- Opacidad y mezcla de colores

**Características Principales**:
```rust
use hikari_palette::{Color, opacity};

// Usar colores tradicionales
let red = Color::Cinnabar;
let blue = Color::Azurite;

// Manejo de opacidad
let semi_red = opacity(red, 0.5);

// Sistema de temas
let theme = Hikari::default();
println!("Primary: {}", theme.primary.hex());
```

**Filosofía de Diseño**:
- **Confianza Cultural**: Uso de nombres de colores tradicionales
- **Seguridad de Tipos**: Verificación de valores de color en tiempo de compilación
- **Alto Rendimiento**: Abstracciones de costo cero

### 2. Sistema de Temas (hikari-theme)

Contexto de tema y sistema de inyección de estilos.

**Responsabilidades**:
- Componente proveedor de tema
- Gestión del contexto de tema
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
  - Primario: Rosa (#FFB3A7)
  - Secundario: Verde Oscuro (#519A73)
  - Acento: Cúrcuma (#FFC773)

- **Tairitsu** - Tema oscuro
  - Primario: Azul Pato (#144A74)
  - Secundario: Verde Oscuro (#519A73)
  - Acento: Cúrcuma (#FFC773)

### 3. Sistema de Animación (hikari-animation)

Sistema de animación declarativa de alto rendimiento.

**Responsabilidades**:
- Constructor de animaciones
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

**Componentes de la Arquitectura**:
- **builder** - API del constructor de animaciones
- **context** - Contexto de animación en tiempo de ejecución
- **style** - Operaciones CSS con seguridad de tipos
- **easing** - Más de 30 funciones de easing
- **tween** - Sistema de interpolación
- **timeline** - Control de línea de tiempo
- **presets** - Animaciones predefinidas (fade, slide, scale)
- **spotlight** - Efecto de foco

**Características de Rendimiento**:
- Optimización WASM
- Actualizaciones con debounce
- Integración con requestAnimationFrame
- Reflujos y repintados minimizados

### 4. Sistema de Iconos (hikari-icons)

Sistema de gestión y renderizado de iconos.

**Responsabilidades**:
- Definiciones de enum de iconos
- Generación de contenido SVG
- Variantes de tamaño de iconos
- Integración con Material Design Icons

**Características Principales**:
```rust
use hikari_icons::{Icon, MdiIcon};

rsx! {
    Icon {
        icon: MdiIcon::Search,
        size: 24,
        color: "var(--hi-primary)"
    }
}
```

**Fuentes de Iconos**:
- Material Design Icons (más de 7000 iconos)
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
 ├── styled.rs       # Rasgos de estilo
 └── theme_provider.rs  # Proveedor de tema
```

**Sistema de Estilos**:
- Fuente SCSS
- Clases utilitarias con seguridad de tipos
- Aislamiento de estilos a nivel de componente
- Integración con variables CSS

### 6. Sistema de Construcción de Iconos

Generación de código en tiempo de compilación y compilación SCSS.

**Responsabilidades**:
- Compilación SCSS (usando Grass)
- Descubrimiento de componentes
- Generación de código
- Empaquetado de recursos

**Proceso de Construcción**:
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
    tairitsu-icons build system::build().expect("Build failed");
}
```

**Archivos Generados**:
- `public/styles/bundle.css` - CSS compilado

### 7. Servicio de Renderizado (tairitsu-packager)

Renderizado del lado del servidor y servicio de recursos estáticos.

**Responsabilidades**:
- Renderizado de plantillas HTML
- Registro de estilos
- Constructor de rutas
- Servicio de recursos estáticos
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

**Módulos de la Arquitectura**:
- **html** - Servicio HTML
- **registry** - Registro de estilos
- **router** - Constructor de rutas
- **static_files** - Servicio de archivos estáticos
- **styles_service** - Inyección de estilos
- **plugin** - Sistema de plugins

### 8. Biblioteca de Componentes Extra (hikari-extra-components)

Componentes UI avanzados para escenarios de interacción compleja.

**Responsabilidades**:
- Componentes utilitarios avanzados
- Interacciones de arrastrar y zoom
- Paneles colapsables
- Integración de animaciones

**Componentes Principales**:

1. **Collapsible** - Panel colapsable
   - Animación de deslizamiento hacia adentro/afuera izquierda/derecha
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
    title: "Settings".to_string(),
    expanded: true,
    position: CollapsiblePosition::Right,
    div { "Content" }
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
    div { "Drag me" }
}

// Controles de zoom
ZoomControls {
    zoom: 1.0,
    on_zoom_change: move |z| println!("Zoom: {}", z)
}
```

## Principios de Arquitectura

### 1. Diseño Modular

Cada paquete es independiente y puede usarse por separado:

```toml
# Usar solo la paleta
[dependencies]
hikari-palette = "0.1"

# Usar componentes y tema
[dependencies]
hikari-components = "0.1"
hikari-theme = "0.1"

# Usar el sistema de animación
[dependencies]
hikari-animation = "0.1"
```

### 2. Arquitectura en Capas

```
┌─────────────────────────────────────┐
│     Capa de Aplicación (examples/)   │
├─────────────────────────────────────┤
│  Capa de Componentes (hikari-components)│
├─────────────────────────────────────┤
│ Capa de Sistema (theme, animation, icons)│
├─────────────────────────────────────┤
│   Capa de Fundación (palette, builder) │
└─────────────────────────────────────┘
```

### 3. Flujo de Datos Unidireccional

```
Acción del Usuario → Manejador de Eventos → Actualización de Estado → Re-renderizado de UI
```

### 4. Seguridad de Tipos

Todas las APIs tienen seguridad de tipos:
- Verificación en tiempo de compilación
- Autocompletado en IDE
- Seguridad en refactorización

### 5. Rendimiento Primero

- Optimización WASM
- Desplazamiento virtual
- Debouncing/throttling
- Manipulación DOM minimizada

## Proceso de Construcción

### Modo de Desarrollo
```bash
cargo run
```

### Construcción de Producción
```bash
# 1. Compilar código Rust
cargo build --release

# 2. El sistema de construcción compila SCSS automáticamente
# 3. Generar bundle CSS
# 4. Empaquetar recursos estáticos
```

### Construcción WASM
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

tairitsu-packager
  ├── hikari-components
  └── axum

hikari-icons (build)
  └── grass (compilador SCSS)
```

## Extensibilidad

### Agregar Componentes Personalizados

```rust
use hikari_components::{StyledComponent, StyleRegistry};

pub struct MyComponent;

impl StyledComponent for MyComponent {
    fn register_styles(registry: &mut StyleRegistry) {
        registry.register("my-component", include_str!("my-component.scss"));
    }
}
```

### Agregar Temas Personalizados

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

### Agregar Animaciones Predefinidas Personalizadas

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
- Eliminación de estilos no utilizados (tree-shaking)
- Minificación de CSS de producción

### 2. Optimización WASM
- Optimización con `wasm-opt`
- Carga diferida de módulos WASM
- Optimización de memoria lineal

### 3. Optimización en Tiempo de Ejecución
- Desplazamiento virtual (listas de datos grandes)
- Actualizaciones de animación con debounce
- requestAnimationFrame

### 4. Optimización de Construcción
- Compilación paralela
- Compilación incremental
- Caché de binarios

## Estrategia de Pruebas

### Pruebas Unitarias
Cada módulo tiene pruebas unitarias completas:

```rust
#[cfg(test)]
mod tests {
    #[test]
    fn test_color_conversion() {
        let color = Color::Cinnabar;
        assert_eq!(color.hex(), "#519A73");
    }
}
```

### Pruebas de Integración
Las aplicaciones de ejemplo en `examples/` sirven como pruebas de integración

### Pruebas de Regresión Visual
Usar Percy o herramientas similares para pruebas de instantáneas de UI

## Próximos Pasos

- Leer la [Documentación de Componentes](../components/) para componentes específicos
- Ver la [Documentación de API](https://docs.rs/hikari-components) para detalles de la API
- Explorar el [Código de Ejemplo](../../examples/) para aprender las mejores prácticas
