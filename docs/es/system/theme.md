# Sistema de Temas

Sistema de gestión de temas que proporciona contexto de tema, variables CSS y funcionalidad de cambio de tema.

## Tabla de Contenidos

- [Descripción General](#descripción-general)
- [ThemeProvider](#themeprovider-provider-de-tema)
- [ThemeContext](#themecontext-contexto-de-tema)
- [Recursos Generados](#recursos-generados)
- [Sistema de Variables CSS](#sistema-de-variables-css)
- [Cambio de Tema](#cambio-de-tema)
- [Personalización de Estilos](#personalización-de-estilos)
- [Referencia API](#referencia-api)

## Descripción General

`hikari-theme` proporciona una solución completa de gestión de temas:

- **ThemeProvider** - Componente proveedor de contexto de tema
- **ThemeContext** - Configuración de tema y definiciones de color
- **Generated** - Variables CSS y recursos generados automáticamente
- **CSS Variables** - Sistema de variables de tema dinámico
- **Theme Switching** - Soporte de cambio de tema en tiempo de ejecución

Todos los componentes del tema presentan:

- **Seguridad de Tipos** - Verificación de identificadores de tema en tiempo de compilación
- **Responsivo** - Se adapta automáticamente a diferentes temas
- **Extensible** - Soporta temas personalizados

## ThemeProvider

Proporciona contexto de tema para toda la aplicación.

### Uso Básico

```rust
use dioxus::prelude::*;
use hikari_theme::ThemeProvider;

rsx! {
    ThemeProvider { palette: "hikari".to_string() }
        // Contenido de la aplicación
        App {}
    }
}
```

### Cambio de Tema

```rust
#[component]
fn App() -> Element {
    let mut theme = use_signal(|| "hikari".to_string());

    rsx! {
        ThemeProvider { palette: theme() }
            div {
                button {
                    onclick: move |_| {
                        theme.set(if theme() == "hikari" {
                            "tairitsu".to_string()
                        } else {
                            "hikari".to_string()
                        });
                    },
                    "Cambiar Tema"
                }
                // Contenido de la aplicación
            }
        }
    }
}
```

### Props

| Propiedad | Tipo | Por Defecto | Descripción |
|-----------|------|-------------|-------------|
| `palette` | `String` | `"hikari"` | Identificador del tema |
| `children` | `Element` | - | Elementos hijos |

### Temas Soportados

- **hikari** - Tema claro
- **tairitsu** - Tema oscuro

## ThemeContext

Estructura de datos que contiene la configuración del tema y definiciones de color.

### Definición de Estructura

```rust
pub struct ThemeContext {
    pub palette: String,
    pub colors: Palette,
}
```

### Descripción de Campos

- **palette** - Cadena identificadora del tema
- **colors** - Configuración de paleta del tema (desde `hikari-palette`)

### Valores por Defecto

```rust
impl Default for ThemeContext {
    fn default() -> Self {
        ThemeContext {
            palette: "hikari".to_string(),
            colors: themes::Hikari::palette(),
        }
    }
}
```

## Recursos Generados

Recursos estáticos y variables CSS generados automáticamente.

### Tailwind CSS

```rust
use hikari_theme::generated::tailwind;

// Acceder a clases Tailwind CSS generadas
let tailwind_classes = tailwind::TAILWIND_CLASSES;
```

### Contenido Generado

El módulo `generated/mod.rs` contiene:

- `tailwind` - Clases y variables de Tailwind CSS generadas
- `components` - Constantes de estilo de componentes (generadas por builder)

### Ubicaciones de Archivos

```
packages/theme/src/generated/
├── mod.rs           # Entrada del módulo
├── tailwind.rs      # Contenido generado de Tailwind CSS
└── ...              # Otro contenido generado
```

## Sistema de Variables CSS

El sistema de temas usa variables CSS para el cambio dinámico de tema.

### Variables Raíz

Definidas bajo `:root` o `[data-theme]`:

```css
[data-theme="hikari"] {
    --hi-color-primary: #00A0E9;
    --hi-color-secondary: #E94B35;
    --hi-color-accent: #F8B62D;
    --hi-color-background: #FFFFFF;
    --hi-color-surface: #F5F5F5;
    --hi-color-text-primary: #1A1A2E;
    --hi-color-text-secondary: #666666;
}

[data-theme="tairitsu"] {
    --hi-color-primary: #1a237e;
    --hi-color-secondary: #E94B35;
    --hi-color-accent: #FFF176;
    --hi-color-background: #0D1117;
    --hi-color-surface: #161B22;
    --hi-color-text-primary: #C9D1D9;
    --hi-color-text-secondary: #8B949E;
}
```

### Uso de Variables CSS

Usar en estilos de componentes:

```rust
rsx! {
    div {
        style: "color: var(--hi-color-primary); background: var(--hi-color-surface);",
        "Usando variables de tema"
    }
}
```

O en SCSS:

```scss
.my-component {
    color: var(--hi-color-primary);
    background-color: var(--hi-color-surface);
    border: 1px solid var(--hi-color-border);
}
```

### Lista Completa de Variables

#### Variables de Color

```css
--hi-color-primary          /* Color primario */
--hi-color-secondary        /* Color secundario */
--hi-color-accent           /* Color de acento */
--hi-color-success          /* Color de éxito */
--hi-color-warning          /* Color de advertencia */
--hi-color-danger           /* Color de peligro */
--hi-color-background       /* Color de fondo */
--hi-color-surface          /* Color de superficie */
--hi-color-border           /* Color de borde */
--hi-color-text-primary     /* Color de texto primario */
--hi-color-text-secondary   /* Color de texto secundario */
```

#### Variables de Tipografía

```css
--hi-font-family-sans       /* Fuente sans-serif */
--hi-font-family-mono       /* Fuente monoespaciada */
--hi-font-size-xs           /* 12px */
--hi-font-size-sm           /* 14px */
--hi-font-size-base         /* 16px */
--hi-font-size-lg           /* 18px */
--hi-font-size-xl           /* 20px */
--hi-font-size-2xl          /* 24px */
--hi-font-size-3xl          /* 30px */
```

#### Variables de Espaciado

```css
--hi-spacing-xs            /* 4px */
--hi-spacing-sm            /* 8px */
--hi-spacing-md            /* 16px */
--hi-spacing-lg            /* 24px */
--hi-spacing-xl            /* 32px */
--hi-spacing-2xl           /* 48px */
```

#### Variables de Radio

```css
--hi-radius-sm             /* 4px */
--hi-radius-md             /* 8px */
--hi-radius-lg             /* 12px */
--hi-radius-xl             /* 16px */
--hi-radius-full           /* 9999px */
```

#### Variables de Sombra

```css
--hi-shadow-sm             /* Sombra pequeña */
--hi-shadow-md             /* Sombra mediana */
--hi-shadow-lg             /* Sombra grande */
--hi-shadow-xl             /* Sombra extra grande */
```

#### Variables de Transición

```css
--hi-transition-fast       /* 150ms */
--hi-transition-base       /* 200ms */
--hi-transition-slow       /* 300ms */
```

## Cambio de Tema

### Cambio en Tiempo de Ejecución

```rust
#[component]
fn ThemeSwitcher() -> Element {
    let mut theme = use_signal(|| "hikari".to_string());

    rsx! {
        ThemeProvider { palette: theme() }
            div {
                button {
                    onclick: move |_| theme.set("hikari".to_string()),
                    class: if theme() == "hikari" { "active" } else { "" },
                    "Claro"
                }
                button {
                    onclick: move |_| theme.set("tairitsu".to_string()),
                    class: if theme() == "tairitsu" { "active" } else { "" },
                    "Oscuro"
                }
            }
        }
    }
}
```

### Tema Persistente

```rust
use gloo::storage::LocalStorage;

#[component]
fn PersistentTheme() -> Element {
    // Cargar tema desde LocalStorage
    let mut theme = use_signal(|| {
        LocalStorage::get("theme")
            .unwrap_or_else(|_| Ok("hikari".to_string()))
            .unwrap_or("hikari".to_string())
    });

    // Guardar tema en LocalStorage cuando cambie
    use_effect(move || {
        let theme = theme();
        async move {
            if let Err(e) = LocalStorage::set("theme", &theme) {
                eprintln!("Error al guardar tema: {}", e);
            }
        }
    });

    rsx! {
        ThemeProvider { palette: theme() }
            // Contenido de la aplicación
        }
    }
}
```

### Detección de Tema del Sistema

```rust
use web_sys::window;

#[component]
fn SystemTheme() -> Element {
    let mut theme = use_signal(|| "hikari".to_string());

    // Detectar preferencia de tema del sistema
    use_effect(|| {
        let win = window()?;
        let media_query = win.match_media("(prefers-color-scheme: dark)")?;

        let listener = Closure::wrap(Box::new(move |e: Event| {
            let matches = e
                .dyn_ref::<MediaQueryListEvent>()
                .unwrap()
                .matches();
            theme.set(if matches {
                "tairitsu".to_string()
            } else {
                "hikari".to_string()
            });
        }) as Box<dyn Fn(_)>);

        media_query
            .add_listener_with_opt_callback(Some(listener.as_ref().unchecked_ref()))
            .unwrap();
        listener.forget();

        async move {}
    });

    rsx! {
        ThemeProvider { palette: theme() }
            // Contenido de la aplicación
        }
    }
}
```

## Personalización de Estilos

### Sobrescribir Variables de Tema

```css
/* Sobrescribir variables de tema en estilos globales */
[data-theme="hikari"] {
    --hi-color-primary: #0066CC;
    --hi-color-secondary: #FF6600;
}
```

### Tema a Nivel de Componente

```rust
rsx! {
    // Usar tema diferente para componente específico
    div {
        "data-theme": "tairitsu",
        style: "background: var(--hi-color-surface);",
        "Este componente usa tema oscuro"
    }
}
```

### Variables de Tema Personalizadas

```css
[data-theme="custom"] {
    --hi-color-primary: #FF0066;
    --hi-color-secondary: #00FF99;
    --hi-color-accent: #FFFF00;
    /* ... otras variables */
}
```

## Mejores Prácticas

### 1. Ubicación del Provider de Tema

```rust
// Bien: Colocar ThemeProvider en la raíz de la aplicación
#[component]
fn App() -> Element {
    rsx! {
        ThemeProvider { palette: "hikari".to_string() }
            Router {}
        }
    }
}

// Evitar: Anidar múltiples ThemeProviders
#[component]
fn BadExample() -> Element {
    rsx! {
        ThemeProvider { palette: "hikari".to_string() }
            ThemeProvider { palette: "tairitsu".to_string() }
                // El tema interno sobrescribirá al externo
            }
        }
    }
}
```

### 2. Animación de Cambio de Tema

```css
/* Añadir transición suave de cambio de tema */
* {
    transition: background-color 0.3s ease,
                color 0.3s ease,
                border-color 0.3s ease;
}
```

### 3. Estilo Condicional

```rust
rsx! {
    div {
        class: if theme() == "hikari" {
            "light-theme"
        } else {
            "dark-theme"
        },
        "Aplicar diferentes estilos según el tema"
    }
}
```

### 4. Fallback de Variables CSS

```css
/* Proporcionar fallback para navegadores que no soportan variables CSS */
.my-component {
    background-color: #00A0E9; /* Valor de fallback */
    background-color: var(--hi-color-primary, #00A0E9);
}
```

## Referencia API

### ThemeProvider

```rust
#[component]
pub fn ThemeProvider(
    palette: String,
    children: Element
) -> Element
```

### ThemeContext

```rust
pub struct ThemeContext {
    pub palette: String,
    pub colors: Palette,
}

impl Default for ThemeContext {
    fn default() -> Self { ... }
}
```

## Integración con Otros Sistemas

### Integración con Palette

```rust
use hikari_palette::{ChineseColor, themes};

let hikari_palette = themes::Hikari::palette();
println!("Primario: {}", hikari_palette.primary.hex);
```

### Integración con Animation

```rust
use hikari_animation::AnimationBuilder;
use hikari_theme::ThemeProvider;

// Las variables de tema se pueden usar en animaciones
AnimationBuilder::new(&elements)
    .add_style("button", "background-color", "var(--hi-color-primary)")
    .apply_with_transition("300ms", "ease-in-out");
```

### Integración con Componentes

Todos los componentes heredan automáticamente el tema proporcionado por ThemeProvider:

```rust
rsx! {
    ThemeProvider { palette: "hikari".to_string() }
        // Todos los componentes usan automáticamente el tema hikari
        Button { label: "Botón" }
        Card { "Tarjeta" }
        Input { placeholder: "Entrada" }
    }
}
```

## Filosofía de Diseño

### Estilo Arknights

- **Tema claro (hikari)**:
  - Primario: Azurita (#00A0E9)
  - Fondo: Blanco
  - Texto: Oscuro

- **Tema oscuro (tairitsu)**:
  - Primario: Índigo (#1a237e)
  - Fondo: Oscuro
  - Texto: Claro

### Elementos FUI

- Efectos de brillo sutiles
- Indicadores dinámicos (luces respiratorias)
- Bordes finos

### Responsivo

- Mobile-first
- Diseños adaptativos
- Sistema de breakpoints

## Sistemas Relacionados

- [Sistema Palette](./palette.md) - Definiciones de color y paletas de tema
- [Sistema Animation](./animation.md) - Animación e integración con tema
- [Componentes](../components/) - Biblioteca de componentes usando temas
