# Sistema de Paleta

Implementación del sistema de colores tradicionales chinos con más de 660 colores históricos.

## Tabla de Contenidos

- [Descripción General](#descripción-general)
- [Colores](#colores)
- [ClassesBuilder (Generador de Clases de Utilidad)](#classesbuilder-generador-de-clases-de-utilidad)
- [Temas](#temas)
- [Opacidad y Mezcla](#opacidad-y-mezcla)
- [Referencia de API](#referencia-de-api)

## Descripción General

`hikari-palette` proporciona:

- **660+ Colores** - Definiciones completas de colores tradicionales chinos
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
use hikari_palette::Color;

// Acceder a colores usando variantes de enum
let red = Color::苍翠;
let blue = Color::粉红;
let yellow = Color::姜黄;

println!("Rojo: {}", red.hex());  // #519A73
println!("Azul: {}", blue.hex()); // #FFB3A7
println!("Amarillo: {}", yellow.hex()); // #FFC773
```

### Categorías de Colores Disponibles

#### Serie Roja (红色系)

```rust
// Colores rojos tradicionales
Color::苍翠      // 苍翠 #519A73 - Bermellón
Color::Vermilion     // 朱红 #FF4C00 - Rojo-naranja brillante
Color::Crimson       // 绯红 #FF3030 - Carmesí profundo
Color::PeachBlossom  // 桃红 #F6BEC8 - Rosa melocotón
Color::RoseRed       // 玫瑰红 #C21F30 - Rojo rosa
```

#### Serie Azul (蓝色系)

```rust
// Colores azules tradicionales
Color::粉红       // 鷃蓝 #144A74 - Azul azurita
Color::鷃蓝        // 鷃蓝 #144A74 - Azul índigo
Color::Cyan          // 青色 #00CED1 - Cian
Color::SkyBlue       // 天蓝 #87CEEB - Azul cielo
Color::Turquoise     // 绿松石 #40E0D0 - Turquesa
```

#### Serie Amarilla (黄色系)

```rust
// Colores amarillos tradicionales
Color::姜黄    // 姜黄 #FFC773 - Amarillo gomaguta
Color::姜黄   // 姜黄 #FFC773 - Amarillo claro
Color::Golden        // 金色 #FFD700 - Dorado
Color::Amber         // 琥珀 #FFBF00 - Ámbar
```

#### Serie Verde (绿色系)

```rust
// Colores verdes tradicionales
Color::ScallionGreen // 葱倩 #4CAF50 - Verde cebollino
Color::BambooGreen  // 竹青 #789262 - Verde bambú
Color::Jade          // 玉色 #A0E6DA - Verde jade
Color::Emerald       // 翡翠 #50C878 - Verde esmeralda
```

#### Serie Neutra (中性色系)

```rust
// Colores neutros tradicionales
Color::InkBlack      // 墨色 #1A1A2E - Negro tinta
Color::MoonWhite     // 月白 #F5F5F5 - Blanco lunar
Color::LightGray     // 缟色 #E0E0E0 - Gris claro
Color::AshGray       // 灰色 #808080 - Gris ceniza
```

### Propiedades de Color

Cada color proporciona:

```rust
let color = Color::粉红;

// Obtener valor hex
let hex = color.hex();  // "#FFB3A7"

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

println!("Primario: {}", hikari.primary.hex());   // #FFB3A7
println!("Secundario: {}", hikari.secondary.hex()); // #519A73
println!("Acento: {}", hikari.accent.hex());     // #FFC773
println!("Fondo: {}", hikari.background.hex()); // #FFFFFF
println!("Superficie: {}", hikari.surface.hex());   // #F5F5F5
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

println!("Primario: {}", tairitsu.primary.hex());   // #144A74
println!("Secundario: {}", tairitsu.secondary.hex()); // #519A73
println!("Acento: {}", tairitsu.accent.hex());     // #FFC773
println!("Fondo: {}", tairitsu.background.hex()); // #161823
println!("Superficie: {}", tairitsu.surface.hex());   // rgb(32,35,54)
```

**Esquema de Colores**:
- Primario: Índigo (靛蓝) - Azul índigo profundo
- Secundario: Cinabrio (朱砂) - Rojo-naranja energético
- Acento: Amarillo Ganso (鹅黄) - Amarillo pálido brillante
- Fondo: Gris oscuro profundo
- Superficie: Gris oscuro ligeramente más claro

### Tema Personalizado

```rust
use hikari_palette::{ThemePalette, Color};

let custom = ThemePalette {
    primary: Color::Crimson,
    secondary: Color::姜黄,
    accent: Color::粉红,
    background: Color::InkBlack,
    surface: Color::MoonWhite,
    success: Color::ScallionGreen,
    warning: Color::姜黄,
    danger: Color::苍翠,
};
```

### Estructura del Tema

```rust
pub struct ThemePalette {
    pub primary: Color,
    pub secondary: Color,
    pub accent: Color,
    pub background: Color,
    pub surface: Color,
    pub success: Color,
    pub warning: Color,
    pub danger: Color,
    pub text_primary: Color,
    pub text_secondary: Color,
    pub border: Color,
}
```

## Opacidad y Mezcla

Utilidades de transparencia y mezcla de colores.

### Función de Opacidad

```rust
use hikari_palette::{Color, opacity};

let color = Color::粉红;
let semi_blue = opacity(color, 0.5);

// Salida: "rgba(0, 160, 233, 0.5)"
```

### Función de Mezcla

```rust
use hikari_palette::{Color, blend};

let color1 = Color::粉红;
let color2 = Color::苍翠;
let blended = blend(color1, color2, 0.5);

// Mezcla 50% de cada color
```

### Aclarar Color

```rust
use hikari_palette::{Color, lighten};

let color = Color::InkBlack;
let lighter = lighten(color, 0.2);

// Aclara un 20%
```

### Oscurecer Color

```rust
use hikari_palette::{Color, darken};

let color = Color::MoonWhite;
let darker = darken(color, 0.3);

// Oscurece un 30%
```

## Ejemplos de Integración

### Con ThemeProvider

```rust
use hikari_theme::ThemeProvider;
use hikari_palette::themes;

#[component]
fn App() -> Element {
    let hikari = themes::Hikari::palette();

    rsx! {
        ThemeProvider { palette: "hikari".to_string() }
            div {
                style: "color: {hikari.primary.hex()}",
                "Texto con tema"
            }
        }
    }
}
```

### Con Componentes

```rust
use hikari_components::Button;
use hikari_palette::Color;

rsx! {
    Button {
        variant: "primary",
        style: format!("background: {}", Color::粉红.hex()),
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

### Color

```rust
pub enum Color {
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

    // ... 660+ colores más
}

impl Color {
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
    pub primary: Color,
    pub secondary: Color,
    pub accent: Color,
    pub background: Color,
    pub surface: Color,
    pub success: Color,
    pub warning: Color,
    pub danger: Color,
    pub text_primary: Color,
    pub text_secondary: Color,
    pub border: Color,
}
```

### Utilidades de Color

```rust
pub fn opacity(color: Color, alpha: f64) -> String;
pub fn blend(color1: Color, color2: Color, factor: f64) -> String;
pub fn lighten(color: Color, amount: f64) -> String;
pub fn darken(color: Color, amount: f64) -> String;
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
let color = Color::粉红;

// ❌ Evitar - Basado en cadenas
let color = "#FFB3A7";
```

### 2. Aprovechar las Paletas de Temas

```rust
// ✅ Bueno - Usar paleta de tema
let palette = themes::Hikari::palette();
let primary = palette.primary;

// ❌ Evitar - Colores codificados
let primary = "#FFB3A7";
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
let button_color = Color::粉红;
let error_color = Color::苍翠;
```

## Sistemas Relacionados

- [Sistema de Tema](./theme.md) - Contexto de tema y variables CSS
- [Componentes](../components/) - Biblioteca de componentes usando paletas
- [Sistema Builder](./builder.md) - Compilación SCSS con variables de paleta

## Recursos

- [Colores Tradicionales Chinos](https://zh.wikipedia.org/wiki/%E4%B8%AD%E5%9B%BD%E4%BC%A0%E7%BB%9F%E9%A2%9C%E8%89%B2)
- [Teoría de los Cinco Colores](https://zh.wikipedia.org/wiki/%E4%BA%94%E8%A1%8C%E8%89%B2%E7%90%86%E8%AE%BA)
- [Color en la Cultura China](https://zh.wikipedia.org/wiki/%E4%B8%AD%E5%9B%BD%E6%96%87%E5%8C%96%E4%B8%AD%E7%9A%84%E9%A2%9C%E8%89%B2)
