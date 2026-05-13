# Sistema de Paleta

Implementación del sistema de colores tradicionales chinos con más de 500 colores históricos.

## Tabla de Contenidos

- [Descripción General](#descripción-general)
- [Colores](#colores)
- [ClassesBuilder (Generador de Clases de Utilidad)](#classesbuilder-generador-de-clases-de-utilidad)
- [Temas](#temas)
- [Opacidad y Mezcla](#opacidad-y-mezcla)
- [Referencia de API](#referencia-de-api)

## Descripción General

`hikari-palette` proporciona:

- **500+ Colores** - Definiciones completas de colores tradicionales chinos
- **Seguridad de Tipos** - Verificación de valores de color en tiempo de compilación
- **Clases de Utilidad** - Generador de clases de utilidad estilo Tailwind con seguridad de tipos
- **Paletas de Temas** - Esquemas de colores de temas preconfigurados
- **Soporte de Opacidad** - Transparencia y mezcla de colores

Todas las definiciones de colores cuentan con:

- **Patrimonio Cultural** - Nombres de colores tradicionales chinos
- **Seguridad de Tipos** - Definiciones de colores basadas en enum
- **Valores Hex** - Códigos de color hex estándar
- **Categorías** - Organizados por familias de colores

## Colores

### Uso Básico

```rust
use hikari_palette::ChineseColor;

// Acceder a colores usando variantes de enum
let red = ChineseColor::Cinnabar;
let blue = ChineseColor::Azurite;
let yellow = ChineseColor::VineYellow;

println!("Rojo: {}", red.hex());  // #E94B35
println!("Azul: {}", blue.hex()); // #00A0E9
println!("Amarillo: {}", yellow.hex()); // #F8B62D
```

### Categorías de Colores Disponibles

#### Serie Roja (红色系)

```rust
// Colores rojos tradicionales
ChineseColor::Cinnabar      // 朱砂 #E94B35 - Bermellón
ChineseColor::Vermilion     // 朱红 #FF4C00 - Rojo-naranja brillante
ChineseColor::Crimson       // 绯红 #FF3030 - Carmesí profundo
ChineseColor::PeachBlossom  // 桃红 #F6BEC8 - Rosa melocotón
ChineseColor::RoseRed       // 玫瑰红 #C21F30 - Rojo rosa
```

#### Serie Azul (蓝色系)

```rust
// Colores azules tradicionales
ChineseColor::Azurite       // 石青 #00A0E9 - Azul azurita
ChineseColor::Indigo        // 靛蓝 #1a237e - Azul índigo
ChineseColor::Cyan          // 青色 #00CED1 - Cian
ChineseColor::SkyBlue       // 天蓝 #87CEEB - Azul cielo
ChineseColor::Turquoise     // 绿松石 #40E0D0 - Turquesa
```

#### Serie Amarilla (黄色系)

```rust
// Colores amarillos tradicionales
ChineseColor::VineYellow    // 藤黄 #F8B62D - Amarillo gomaguta
ChineseColor::GooseYellow   // 鹅黄 #FFF176 - Amarillo claro
ChineseColor::Golden        // 金色 #FFD700 - Dorado
ChineseColor::Amber         // 琥珀 #FFBF00 - Ámbar
```

#### Serie Verde (绿色系)

```rust
// Colores verdes tradicionales
ChineseColor::ScallionGreen // 葱倩 #4CAF50 - Verde cebollino
ChineseColor::BambooGreen  // 竹青 #789262 - Verde bambú
ChineseColor::Jade          // 玉色 #A0E6DA - Verde jade
ChineseColor::Emerald       // 翡翠 #50C878 - Verde esmeralda
```

#### Serie Neutra (中性色系)

```rust
// Colores neutros tradicionales
ChineseColor::InkBlack      // 墨色 #1A1A2E - Negro tinta
ChineseColor::MoonWhite     // 月白 #F5F5F5 - Blanco lunar
ChineseColor::LightGray     // 缟色 #E0E0E0 - Gris claro
ChineseColor::AshGray       // 灰色 #808080 - Gris ceniza
```

### Propiedades de Color

Cada color proporciona:

```rust
let color = ChineseColor::Azurite;

// Obtener valor hex
let hex = color.hex();  // "#00A0E9"

// Obtener valores RGB
let rgb = color.rgb();  // (0, 160, 233)

// Obtener nombre del color
let name = color.name();  // "石青"

// Obtener nombre en inglés
let english_name = color.english_name();  // "Azurite"
```

## ClassesBuilder

Generador de clases de utilidad con seguridad de tipos para clases tipo Tailwind CSS.

### Uso Básico

```rust
use hikari_palette::{ClassesBuilder, classes::*};

let classes = ClassesBuilder::new()
    .add(Display::Flex)
    .add(FlexDirection::Row)
    .add(Gap::Gap4)
    .build();

// Salida: "hi-flex hi-flex-row hi-gap-4"
```

### Clases de Utilidad Disponibles

#### Clases de Display

```rust
use hikari_palette::classes::Display;

Display::Block      // "hi-block"
Display::Flex       // "hi-flex"
Display::Grid       // "hi-grid"
Display::Hidden     // "hi-hidden"
```

#### Clases de Flexbox

```rust
use hikari_palette::classes::{FlexDirection, AlignItems, JustifyContent};

FlexDirection::Row        // "hi-flex-row"
FlexDirection::Column     // "hi-flex-column"
AlignItems::Center        // "hi-items-center"
AlignItems::Stretch       // "hi-items-stretch"
JustifyContent::Center    // "hi-justify-center"
JustifyContent::Between   // "hi-justify-between"
```

#### Clases de Espaciado

```rust
use hikari_palette::classes::{Padding, Margin, Gap};

Padding::P4        // "hi-p-4"
Padding::Px8       // "hi-px-8"
Margin::M4         // "hi-m-4"
Margin::MyAuto     // "hi-my-auto"
Gap::Gap4          // "hi-gap-4"
```

#### Clases de Color

```rust
use hikari_palette::classes::{TextColor, BackgroundColor};

TextColor::Primary       // "hi-text-primary"
TextColor::Secondary     // "hi-text-secondary"
BackgroundColor::Primary // "hi-bg-primary"
BackgroundColor::Surface // "hi-bg-surface"
```

#### Clases de Tipografía

```rust
use hikari_palette::classes::{FontSize, FontWeight};

FontSize::Base       // "hi-text-base"
FontSize::XL         // "hi-text-xl"
FontSize::2XL        // "hi-text-2xl"
FontWeight::Normal   // "hi-font-normal"
FontWeight::Bold     // "hi-font-bold"
```

#### Clases de Borde

```rust
use hikari_palette::classes::{Border, BorderRadius};

Border::B            // "hi-border"
Border::B2           // "hi-border-2"
BorderRadius::Md     // "hi-rounded-md"
BorderRadius::Full   // "hi-rounded-full"
```

### Combinando Clases

```rust
use hikari_palette::{ClassesBuilder, classes::*};

// Estilizado de componente complejo
let button_classes = ClassesBuilder::new()
    .add(Display::Flex)
    .add(AlignItems::Center)
    .add(JustifyContent::Center)
    .add(Padding::Px4)
    .add(Padding::Py2)
    .add(BorderRadius::Md)
    .add(BackgroundColor::Primary)
    .add(TextColor::White)
    .build();

// Salida: "hi-flex hi-items-center hi-justify-center hi-px-4 hi-py-2 hi-rounded-md hi-bg-primary hi-text-white"
```

### Beneficios de Seguridad de Tipos

```rust
// ✅ Seguro para tipos - verificación en tiempo de compilación
let classes = ClassesBuilder::new()
    .add(Display::Flex)
    .add(FlexDirection::Row)
    .build();

// ❌ No compilaría - protección contra errores tipográficos
let classes = ClassesBuilder::new()
    .add(Display::Flx)  // ¡Error de compilación!
    .build();
```

## Temas

Paletas de temas preconfiguradas.

### Tema Hikari (Claro)

```rust
use hikari_palette::themes;

let hikari = themes::Hikari::palette();

println!("Primario: {}", hikari.primary.hex);   // #00A0E9
println!("Secundario: {}", hikari.secondary.hex); // #E94B35
println!("Acento: {}", hikari.accent.hex);     // #F8B62D
println!("Fondo: {}", hikari.background.hex); // #FFFFFF
println!("Superficie: {}", hikari.surface.hex);   // #F5F5F5
```

**Esquema de Colores**:
- Primario: Azurita (石青) - Cian-azul fresco
- Secundario: Cinabrio (朱砂) - Rojo-naranja energético
- Acento: Amarillo Vid (藤黄) - Amarillo dorado cálido
- Fondo: Blanco Lunar (月白) - Blanco limpio
- Superficie: Gris claro con tinte sutil

### Tema Tairitsu (Oscuro)

```rust
use hikari_palette::themes;

let tairitsu = themes::Tairitsu::palette();

println!("Primario: {}", tairitsu.primary.hex);   // #1a237e
println!("Secundario: {}", tairitsu.secondary.hex); // #E94B35
println!("Acento: {}", tairitsu.accent.hex);     // #FFF176
println!("Fondo: {}", tairitsu.background.hex); // #0D1117
println!("Superficie: {}", tairitsu.surface.hex);   // #161B22
```

**Esquema de Colores**:
- Primario: Índigo (靛蓝) - Azul índigo profundo
- Secundario: Cinabrio (朱砂) - Rojo-naranja energético
- Acento: Amarillo Ganso (鹅黄) - Amarillo pálido brillante
- Fondo: Gris oscuro profundo
- Superficie: Gris oscuro ligeramente más claro

### Tema Personalizado

```rust
use hikari_palette::{ThemePalette, ChineseColor};

let custom = ThemePalette {
    primary: ChineseColor::Crimson,
    secondary: ChineseColor::VineYellow,
    accent: ChineseColor::Azurite,
    background: ChineseColor::InkBlack,
    surface: ChineseColor::MoonWhite,
    success: ChineseColor::ScallionGreen,
    warning: ChineseColor::GooseYellow,
    danger: ChineseColor::Cinnabar,
};
```

### Estructura del Tema

```rust
pub struct ThemePalette {
    pub primary: ChineseColor,
    pub secondary: ChineseColor,
    pub accent: ChineseColor,
    pub background: ChineseColor,
    pub surface: ChineseColor,
    pub success: ChineseColor,
    pub warning: ChineseColor,
    pub danger: ChineseColor,
    pub text_primary: ChineseColor,
    pub text_secondary: ChineseColor,
    pub border: ChineseColor,
}
```

## Opacidad y Mezcla

Utilidades de transparencia y mezcla de colores.

### Función de Opacidad

```rust
use hikari_palette::{ChineseColor, opacity};

let color = ChineseColor::Azurite;
let semi_blue = opacity(color, 0.5);

// Salida: "rgba(0, 160, 233, 0.5)"
```

### Función de Mezcla

```rust
use hikari_palette::{ChineseColor, blend};

let color1 = ChineseColor::Azurite;
let color2 = ChineseColor::Cinnabar;
let blended = blend(color1, color2, 0.5);

// Mezcla 50% de cada color
```

### Aclarar Color

```rust
use hikari_palette::{ChineseColor, lighten};

let color = ChineseColor::InkBlack;
let lighter = lighten(color, 0.2);

// Aclara un 20%
```

### Oscurecer Color

```rust
use hikari_palette::{ChineseColor, darken};

let color = ChineseColor::MoonWhite;
let darker = darken(color, 0.3);

// Oscurece un 30%
```

## Ejemplos de Integración

### Con ThemeProvider

```rust
use dioxus::prelude::*;
use hikari_theme::ThemeProvider;
use hikari_palette::themes;

#[component]
fn App() -> Element {
    let hikari = themes::Hikari::palette();

    rsx! {
        ThemeProvider { palette: "hikari".to_string() }
            div {
                style: "color: {hikari.primary.hex}",
                "Texto con tema"
            }
        }
    }
}
```

### Con Componentes

```rust
use hikari_components::Button;
use hikari_palette::ChineseColor;

rsx! {
    Button {
        variant: "primary",
        style: format!("background: {}", ChineseColor::Azurite.hex()),
        "Botón Personalizado"
    }
}
```

### Con Clases de Utilidad

```rust
use hikari_palette::{ClassesBuilder, classes::*};

let card_classes = ClassesBuilder::new()
    .add(BackgroundColor::Surface)
    .add(BorderRadius::Lg)
    .add(Padding::P6)
    .add(Shadow::Lg)
    .build();

rsx! {
    div {
        class: "{card_classes}",
        "Contenido de tarjeta"
    }
}
```

## Referencia de API

### ChineseColor

```rust
pub enum ChineseColor {
    // Serie roja
    Cinnabar,      // 朱砂
    Vermilion,     // 朱红
    Crimson,       // 绯红

    // Serie azul
    Azurite,       // 石青
    Indigo,        // 靛蓝
    Cyan,          // 青色

    // Serie amarilla
    VineYellow,    // 藤黄
    GooseYellow,   // 鹅黄

    // Serie verde
    ScallionGreen, // 葱倩
    BambooGreen,   // 竹青
    Jade,          // 玉色

    // Serie neutra
    InkBlack,      // 墨色
    MoonWhite,     // 月白
    LightGray,     // 缟色

    // ... 500+ colores más
}

impl ChineseColor {
    pub fn hex(&self) -> String;
    pub fn rgb(&self) -> (u8, u8, u8);
    pub fn name(&self) -> &'static str;
    pub fn english_name(&self) -> &'static str;
}
```

### ClassesBuilder

```rust
pub struct ClassesBuilder {
    // interno
}

impl ClassesBuilder {
    pub fn new() -> Self;
    pub fn add(mut self, class: impl Class) -> Self;
    pub fn build(self) -> String;
}
```

### ThemePalette

```rust
pub struct ThemePalette {
    pub primary: ChineseColor,
    pub secondary: ChineseColor,
    pub accent: ChineseColor,
    pub background: ChineseColor,
    pub surface: ChineseColor,
    pub success: ChineseColor,
    pub warning: ChineseColor,
    pub danger: ChineseColor,
    pub text_primary: ChineseColor,
    pub text_secondary: ChineseColor,
    pub border: ChineseColor,
}
```

### Utilidades de Color

```rust
pub fn opacity(color: ChineseColor, alpha: f64) -> String;
pub fn blend(color1: ChineseColor, color2: ChineseColor, factor: f64) -> String;
pub fn lighten(color: ChineseColor, amount: f64) -> String;
pub fn darken(color: ChineseColor, amount: f64) -> String;
```

## Filosofía de Diseño

### Significado Cultural

Cada color tradicional chino tiene un significado cultural e histórico:

- **Cinabrio (朱砂)**: Usado en sellos imperiales, representa poder y autoridad
- **Azurita (石青)**: Usado en pintura tradicional, representa elegancia
- **Amarillo Vid (藤黄)**: Pigmento de pintura tradicional, calidez y vitalidad
- **Negro Tinta (墨色)**: Tinta de caligrafía, representa conocimiento y profundidad
- **Blanco Lunar (月白)**: Blanco-azul pálido, representa pureza

### Armonía de Colores

Las combinaciones de colores tradicionales chinos siguen reglas específicas de armonía:

- **Complementaria**: Rojo + Verde (朱砂 + 竹青)
- **Análoga**: Azul + Cian (石青 + 青色)
- **Triádica**: Rojo + Amarillo + Azul (朱砂 + 藤黄 + 石青)

## Mejores Prácticas

### 1. Usar Enum para Seguridad de Tipos

```rust
// ✅ Bueno - Seguro para tipos
let color = ChineseColor::Azurite;

// ❌ Evitar - Basado en cadenas
let color = "#00A0E9";
```

### 2. Aprovechar las Paletas de Temas

```rust
// ✅ Bueno - Usar paleta de tema
let palette = themes::Hikari::palette();
let primary = palette.primary;

// ❌ Evitar - Colores codificados
let primary = "#00A0E9";
```

### 3. Usar Clases de Utilidad

```rust
// ✅ Bueno - Utilidades con seguridad de tipos
let classes = ClassesBuilder::new()
    .add(Display::Flex)
    .add(Gap::Gap4)
    .build();

// ✅ Aceptable - Basado en cadenas (menos seguro)
let classes = "hi-flex hi-gap-4";
```

### 4. Nomenclatura Semántica de Colores

```rust
// ✅ Bueno - Uso semántico
let button_color = theme.palette.primary;
let error_color = theme.palette.danger;

// ❌ Evitar - Referencias directas a colores
let button_color = ChineseColor::Azurite;
let error_color = ChineseColor::Cinnabar;
```

## Sistemas Relacionados

- [Sistema de Tema](./theme.md) - Contexto de tema y variables CSS
- [Componentes](../components/) - Biblioteca de componentes usando paletas
- [Sistema Builder](./builder.md) - Compilación SCSS con variables de paleta

## Recursos

- [Colores Tradicionales Chinos](https://zh.wikipedia.org/wiki/%E4%B8%AD%E5%9B%BD%E4%BC%A0%E7%BB%9F%E9%A2%9C%E8%89%B2)
- [Teoría de los Cinco Colores](https://zh.wikipedia.org/wiki/%E4%BA%94%E8%A1%8C%E8%89%B2%E7%90%86%E8%AE%BA)
- [Color en la Cultura China](https://zh.wikipedia.org/wiki/%E4%B8%AD%E5%9B%BD%E6%96%87%E5%8C%96%E4%B8%AD%E7%9A%84%E9%A2%9C%E8%89%B2)
