# Sistema de Animación

Sistema de animación declarativo de alto rendimiento que soporta valores estáticos, valores dinámicos, líneas de tiempo complejas y más de 30 funciones de easing.

## Tabla de Contenidos

- [Descripción General](#descripción-general)
- [Características Principales](#características-principales)
- [AnimationBuilder](#animationbuilder)
- [Tween](#tween)
- [Easing](#easing)
- [Timeline](#timeline)
- [Presets](#presets)
- [Spotlight](#spotlight)
- [Context](#context)
- [Style](#style)
- [Ejemplos de Uso](#ejemplos-de-uso)

## Descripción General

`hikari-animation` proporciona una solución de animación completa:

- **API Declarativa**: Sintaxis fluida tipo CSS
- **Valores Dinámicos**: Valores de animación calculados en tiempo de ejecución (como seguimiento del mouse)
- **Alto Rendimiento**: Optimizado para WASM, actualizaciones con debounce, requestAnimationFrame
- **Seguridad de Tipos**: Propiedades CSS verificadas en tiempo de compilación
- **Presets Riccos**: Fade, slide, scale y otras animaciones comunes

## Características Principales

### 1. AnimationBuilder

Constructor de animación avanzado que soporta:

- **Control Multi-elemento**: Controlar múltiples elementos DOM simultáneamente
- **Valores Dinámicos**: Computación en tiempo real basada en AnimationContext
- **Transiciones Automáticas**: Gestión inteligente de transiciones
- **Seguridad de Tipos**: El enum CssProperty previene errores tipográficos

### 2. Sistema Tween

Sistema de animación de interpolación:

- **Interpolación de Valores**: Transiciones numéricas suaves
- **Easing Personalizado**: Más de 30 funciones de easing integradas
- **Control de Tiempo**: Control de duración y retraso
- **Iteración de Bucle**: Soporte para reproducción en bucle

### 3. Funciones de Easing

Biblioteca rica de funciones de easing:

- **Básicas**: Linear, EaseIn, EaseOut, EaseInOut
- **Sine**: Easing sinusoidal
- **Quad**: Easing cuadrático
- **Cubic**: Easing cúbico
- **Quart**: Easing cuártico
- **Quint**: Easing quíntico
- **Expo**: Easing exponencial
- **Circ**: Easing circular
- **Back**: Efecto de retroceso/sobreimpulso
- **Elastic**: Efecto elástico
- **Bounce**: Efecto de rebote

### 4. Timeline

Control de línea de tiempo:

- **Animación Secuencial**: Reproducir múltiples animaciones en secuencia
- **Animación Paralela**: Reproducir múltiples animaciones simultáneamente
- **Ejecución Retardada**: Control de tiempo preciso
- **Grupos de Animación**: Organizar secuencias de animación complejas

### 5. Presets

Biblioteca de animaciones predefinidas:

- **Fade**: Fundir entrada/salida
- **Slide**: Deslizar entrada/salida
- **Scale**: Animación de escala
- **Rotate**: Animación de rotación
- **Flip**: Animación de volteo
- **Zoom**: Acercar/alejar

### 6. Spotlight

Efecto de foco:

- **Seguimiento del Mouse**: El efecto de brillo sigue el cursor del mouse
- **Iluminación Gradiente**: Gradientes radiales suaves
- **Rendimiento**: Actualizaciones con debounce, repintados limitados
- **Auto Init**: Escanear e inicializar elementos spotlight

## AnimationBuilder

### Uso Básico

```rust
use hikari_animation::{AnimationBuilder, AnimationContext};
use hikari_animation::style::CssProperty;
use std::collections::HashMap;

// Crear mapeo de elementos
let mut elements = HashMap::new();
elements.insert("button".to_string(), button_element);

// Aplicar estilos estáticos
AnimationBuilder::new(&elements)
    .add_style("button", CssProperty::Opacity, "0.8")
    .add_class("button", "hi-flex")
    .apply();
```

### Animación de Valor Dinámico

```rust
// Efecto de seguimiento del mouse
AnimationBuilder::new(&elements)
    .add_style_dynamic("button", CssProperty::Transform, |ctx| {
        let x = ctx.mouse_x();
        let y = ctx.mouse_y();
        format!("translate({}px, {}px)", x, y)
    })
    .apply_with_transition("150ms", "ease-out");
```

### Animación Multi-elemento

```rust
// Controlar múltiples elementos simultáneamente
let mut elements = HashMap::new();
elements.insert("button".to_string(), button_element);
elements.insert("icon".to_string(), icon_element);

AnimationBuilder::new(&elements)
    .add_style("button", CssProperty::Opacity, "0.8")
    .add_style("icon", CssProperty::Transform, "scale(1.1)")
    .add_class("button", "hi-flex")
    .apply();
```

### Animación de Transición

```rust
// Animación con transición
AnimationBuilder::new(&elements)
    .add_style("button", CssProperty::Width, "100px")
    .apply_with_transition("300ms", "ease-in-out");

// Propiedades de transición personalizadas
AnimationBuilder::new(&elements)
    .add_style("button", CssProperty::Transform, "rotate(90deg)")
    .apply_with_transition("500ms", "cubic-bezier(0.68, -0.55, 0.265, 1.55)");
```

### Referencia de API

```rust
impl AnimationBuilder {
    pub fn new(elements: &HashMap<String, Element>) -> Self;

    pub fn add_style(self, element: &str, property: CssProperty, value: &str) -> Self;
    pub fn add_style_dynamic<F>(self, element: &str, property: CssProperty, f: F) -> Self
    where
        F: Fn(&AnimationContext) -> String + 'static;

    pub fn add_class(self, element: &str, class: &str) -> Self;
    pub fn remove_class(self, element: &str, class: &str) -> Self;

    pub fn apply(self);
    pub fn apply_with_transition(self, duration: &str, easing: &str);
}
```

## Tween

Interpolación entre valores a lo largo del tiempo.

### Tween Básico

```rust
use hikari_animation::tween::{Tween, TweenBuilder};

let tween = TweenBuilder::new()
    .from(0.0)
    .to(100.0)
    .duration(1000) // ms
    .easing(ease::EaseOut)
    .build();
```

### Tween con Callbacks

```rust
let tween = TweenBuilder::new()
    .from(0.0)
    .to(1.0)
    .duration(500)
    .on_update(|value| {
        println!("Valor actual: {}", value);
    })
    .on_complete(|| {
        println!("¡Animación completa!");
    })
    .build();
```

### Tweens Encadenados

```rust
let mut timeline = Timeline::new();

timeline.push(
    TweenBuilder::new()
        .from(0.0)
        .to(100.0)
        .duration(300)
        .build()
);

timeline.push(
    TweenBuilder::new()
        .from(100.0)
        .to(0.0)
        .duration(300)
        .delay(200)
        .build()
);

timeline.play();
```

## Easing

Las funciones de easing controlan la velocidad de la animación.

### Easing Básico

```rust
use hikari_animation::easing;

// Linear - sin easing
linear(0.5); // 0.5

// Ease In - comienza lento, termina rápido
ease_in(0.5); // 0.25

// Ease Out - comienza rápido, termina lento
ease_out(0.5); // 0.75

// Ease In Out - lento en ambos extremos
ease_in_out(0.5); // 0.5
```

### Easing Avanzado

```rust
// Back - sobrepasa ligeramente
back_out(0.5); // 1.2

// Elastic - oscila
elastic_out(0.5); // 1.0

// Bounce - rebota al final
bounce_out(0.5); // 0.75
```

### Todas las Funciones de Easing

```rust
// Básicas
pub fn linear(t: f64) -> f64;
pub fn ease_in(t: f64) -> f64;
pub fn ease_out(t: f64) -> f64;
pub fn ease_in_out(t: f64) -> f64;

// Sine
pub fn sine_in(t: f64) -> f64;
pub fn sine_out(t: f64) -> f64;
pub fn sine_in_out(t: f64) -> f64;

// Quad
pub fn quad_in(t: f64) -> f64;
pub fn quad_out(t: f64) -> f64;
pub fn quad_in_out(t: f64) -> f64;

// Cubic
pub fn cubic_in(t: f64) -> f64;
pub fn cubic_out(t: f64) -> f64;
pub fn cubic_in_out(t: f64) -> f64;

// Quart
pub fn quart_in(t: f64) -> f64;
pub fn quart_out(t: f64) -> f64;
pub fn quart_in_out(t: f64) -> f64;

// Quint
pub fn quint_in(t: f64) -> f64;
pub fn quint_out(t: f64) -> f64;
pub fn quint_in_out(t: f64) -> f64;

// Expo
pub fn expo_in(t: f64) -> f64;
pub fn expo_out(t: f64) -> f64;
pub fn expo_in_out(t: f64) -> f64;

// Circ
pub fn circ_in(t: f64) -> f64;
pub fn circ_out(t: f64) -> f64;
pub fn circ_in_out(t: f64) -> f64;

// Back
pub fn back_in(t: f64) -> f64;
pub fn back_out(t: f64) -> f64;
pub fn back_in_out(t: f64) -> f64;

// Elastic
pub fn elastic_in(t: f64) -> f64;
pub fn elastic_out(t: f64) -> f64;
pub fn elastic_in_out(t: f64) -> f64;

// Bounce
pub fn bounce_in(t: f64) -> f64;
pub fn bounce_out(t: f64) -> f64;
pub fn bounce_in_out(t: f64) -> f64;
```

## Timeline

Control de secuencias de animación y tiempo.

### Animaciones Secuenciales

```rust
use hikari_animation::Timeline;

let mut timeline = Timeline::new();

// Agregar animaciones en secuencia
timeline.add(
    AnimationBuilder::new(&elements)
        .add_style("box", CssProperty::Opacity, "0")
        .build()
);

timeline.add(
    AnimationBuilder::new(&elements)
        .add_style("box", CssProperty::Opacity, "1")
        .with_delay(200)
        .build()
);

timeline.play();
```

### Animaciones Paralelas

```rust
let mut timeline = Timeline::new();

// Reproducir animaciones simultáneamente
timeline.add_parallel(
    AnimationBuilder::new(&elements)
        .add_style("box", CssProperty::Transform, "translateX(100px)")
        .build()
);

timeline.add_parallel(
    AnimationBuilder::new(&elements)
        .add_style("box", CssProperty::Opacity, "0.5")
        .build()
);

timeline.play();
```

### Control de Timeline

```rust
let timeline = Timeline::new();

// Controlar reproducción
timeline.play();      // Iniciar reproducción
timeline.pause();     // Pausar reproducción
timeline.reverse();   // Reproducción inversa
timeline.seek(0.5);   // Saltar al 50%

// Control de velocidad
timeline.set_speed(2.0);  // Velocidad 2x
timeline.set_speed(0.5);  // Velocidad 0.5x

// Control de bucle
timeline.set_loop(true);
timeline.set_repeat_count(3);
```

## Presets

Animaciones predefinidas.

### Animaciones Fade

```rust
use hikari_animation::presets;

// Fundir entrada
presets::fade_in(&elements, "box", 300);

// Fundir salida
presets::fade_out(&elements, "box", 300);

// Fundir a opacidad específica
presets::fade_to(&elements, "box", 0.5, 300);
```

### Animaciones Slide

```rust
// Deslizar entrada desde la izquierda
presets::slide_in_left(&elements, "box", 300);

// Deslizar entrada desde la derecha
presets::slide_in_right(&elements, "box", 300);

// Deslizar salida hacia la izquierda
presets::slide_out_left(&elements, "box", 300);

// Deslizar entrada desde arriba
presets::slide_in_top(&elements, "box", 300);
```

### Animaciones Scale

```rust
// Escalar hacia arriba
presets::scale_up(&elements, "box", 1.5, 300);

// Escalar hacia abajo
presets::scale_down(&elements, "box", 0.8, 300);

// Pulso
presets::pulse(&elements, "box", 300);
```

### Animaciones Rotate

```rust
// Rotar sentido horario
presets::rotate_cw(&elements, "box", 90, 500);

// Rotar sentido antihorario
presets::rotate_ccw(&elements, "box", 90, 500);

// Voltear
presets::flip_x(&elements, "box", 500);
presets::flip_y(&elements, "box", 500);
```

### Presets Personalizados

```rust
use hikari_animation::presets::PresetBuilder;

let custom_preset = PresetBuilder::new()
    .duration(500)
    .easing("ease-out")
    .add_keyframe(0.0, vec![
        (CssProperty::Opacity, "0"),
        (CssProperty::Transform, "translateY(-20px)")
    ])
    .add_keyframe(1.0, vec![
        (CssProperty::Opacity, "1"),
        (CssProperty::Transform, "translateY(0)")
    ])
    .build();

custom_preset.apply(&elements, "element");
```

## Spotlight

Efecto de brillo que sigue al mouse para elementos.

### Spotlight Básico

```rust
use hikari_animation::spotlight;

// Inicializar spotlight en todos los botones
spotlight::init();

// O inicializar en elementos específicos
spotlight::init_selector(".hi-button");
```

### Spotlight Personalizado

```rust
spotlight::Config {
    size: 200,              // Tamaño del spotlight en px
    opacity: 0.15,          // Opacidad (0-1)
    color: "#00A0E9",       // Color del brillo
    blur: 20,              // Radio de desenfoque en px
    transition: "150ms"     // Velocidad de transición
}.init();
```

### Spotlight en Componentes

```rust
rsx! {
    Button {
        label: "Pasa sobre mí",
        class: "hi-spotlight",  // Habilitar spotlight
        "Data: spot-{spot_id}"   // Identificador único
    }
}
```

### Deshabilitar Spotlight

```rust
// Deshabilitar en elementos específicos
spotlight::disable_selector(".no-spotlight");

// Deshabilitar todos
spotlight::disable_all();
```

## Context

El contexto de animación proporciona información en tiempo de ejecución.

### Posición del Mouse

```rust
AnimationBuilder::new(&elements)
    .add_style_dynamic("target", CssProperty::Transform, |ctx| {
        let x = ctx.mouse_x();
        let y = ctx.mouse_y();
        format!("translate({}px, {}px)", x, y)
    })
    .apply();
```

### Animación Basada en Tiempo

```rust
.add_style_dynamic("clock", CssProperty::Transform, |ctx| {
    let time = ctx.elapsed_time();
    let angle = (time.as_millis() % 1000) as f64 / 1000.0 * 360.0;
    format!("rotate({}deg)", angle)
})
```

### Posición de Scroll

```rust
.add_style_dynamic("header", CssProperty::Background, |ctx| {
    let scroll_y = ctx.scroll_y();
    let opacity = (scroll_y / 100.0).min(1.0);
    format!("rgba(0, 160, 233, {})", opacity)
})
```

## Style

Manipulación de propiedades CSS con seguridad de tipos.

### Enum CssProperty

```rust
use hikari_animation::style::CssProperty;

// Propiedades de color
CssProperty::Color
CssProperty::BackgroundColor
CssProperty::BorderColor

// Propiedades de diseño
CssProperty::Width
CssProperty::Height
CssProperty::Margin
CssProperty::Padding

// Propiedades de transformación
CssProperty::Transform
CssProperty::Translate
CssProperty::Scale
CssProperty::Rotate

// Propiedades de efecto
CssProperty::Opacity
CssProperty::BoxShadow
CssProperty::Filter
```

### Manipulación de Estilo

```rust
// Establecer propiedad individual
builder.add_style("element", CssProperty::Color, "#00A0E9");

// Establecer transformación
builder.add_style("element", CssProperty::Transform, "translate(10px, 20px)");

// Establecer opacidad
builder.add_style("element", CssProperty::Opacity, "0.5");

// Transformación compleja
builder.add_style("element", CssProperty::Transform,
    "perspective(1000px) rotateX(45deg) translateZ(50px)");
```

### Propiedades CSS Personalizadas

```rust
// Propiedad personalizada
builder.add_style("element", CssProperty::Custom("--my-var"), "value");

// Y usarla
builder.add_style("element", CssProperty::Color, "var(--my-var)");
```

## Ejemplos de Uso

### Efecto Hover en Botón

```rust
use hikari_animation::{AnimationBuilder, AnimationContext};
use hikari_animation::style::CssProperty;

#[component]
fn AnimatedButton() -> Element {
    let elements = use_signal(|| {
        let mut map = HashMap::new();
        map.insert("btn".to_string(), get_button_element());
        map
    });

    rsx! {
        button {
            class: "hi-button hi-spotlight",
            onmouseenter: move |_| {
                AnimationBuilder::new(&elements())
                    .add_style("btn", CssProperty::Transform, "scale(1.05)")
                    .add_style("btn", CssProperty::BoxShadow, "0 8px 16px rgba(0, 160, 233, 0.3)")
                    .apply_with_transition("200ms", "ease-out");
            },
            onmouseleave: move |_| {
                AnimationBuilder::new(&elements())
                    .add_style("btn", CssProperty::Transform, "scale(1)")
                    .add_style("btn", CssProperty::BoxShadow, "none")
                    .apply_with_transition("200ms", "ease-out");
            },
            "Pasa sobre mí"
        }
    }
}
```

### Animación de Carga

```rust
#[component]
fn LoadingSpinner() -> Element {
    let elements = use_signal(|| HashMap::new());

    use_effect(move || {
        let elements = elements.clone();
        async move {
            loop {
                AnimationBuilder::new(&elements())
                    .add_style("spinner", CssProperty::Transform, "rotate(0deg)")
                    .build();

                AnimationBuilder::new(&elements())
                    .add_style("spinner", CssProperty::Transform, "rotate(360deg)")
                    .apply_with_transition("1000ms", "linear");

                tokio::time::sleep(Duration::from_millis(1000)).await;
            }
        }
    });

    rsx! {
        div {
            id: "spinner",
            style: "width: 40px; height: 40px; border: 4px solid var(--hi-color-primary); border-top-color: transparent; border-radius: 50%;"
        }
    }
}
```

### Scroll Parallax

```rust
#[component]
fn ParallaxSection() -> Element {
    let scroll_y = use_signal(|| 0.0);

    rsx! {
        div {
            onscroll: move |e| {
                scroll_y.set(e.scroll_y());

                AnimationBuilder::new(&elements())
                    .add_style_dynamic("bg", CssProperty::Transform, |ctx| {
                        let y = ctx.scroll_y() * 0.5;
                        format!("translateY({}px)", y)
                    })
                    .apply_with_transition("100ms", "ease-out");
            },
            div {
                id: "bg",
                style: "position: fixed; width: 100%; height: 100%; background: url(bg.jpg);"
            },
            div {
                style: "position: relative; z-index: 1;",
                "Contenido"
            }
        }
    }
}
```

### Contador Animado

```rust
#[component]
fn AnimatedCounter() -> Element {
    let mut count = use_signal(|| 0);

    use_effect(move || {
        let target = 1000;
        let duration = 2000; // 2 segundos
        let steps = 60;
        let step_value = target as f64 / steps as f64;
        let step_duration = duration / steps;

        async move {
            for i in 0..=steps {
                count.set((i as f64 * step_value) as i32);
                tokio::time::sleep(Duration::from_millis(step_duration)).await;
            }
        }
    });

    rsx! {
        div {
            class: "counter",
            "{count()}"
        }
    }
}
```

## Optimización de Rendimiento

### Debounce de Actualizaciones

```rust
use hikari_animation::AnimationBuilder;

// AnimationBuilder automáticamente hace debounce de actualizaciones
AnimationBuilder::new(&elements)
    .add_style_dynamic("element", CssProperty::Transform, |ctx| {
        // Esto tiene debounce - no se actualiza en cada mousemove
        let x = ctx.mouse_x();
        format!("translateX({}px)", x)
    })
    .apply_with_transition("100ms", "ease-out");
```

### RequestAnimationFrame

El sistema de animación usa `requestAnimationFrame` para animaciones suaves a 60fps:

```rust
// Integración RAF automática
AnimationBuilder::new(&elements)
    .add_style("anim", CssProperty::Opacity, "1")
    .apply_with_transition("1000ms", "ease");
```

### Aceleración GPU

Usar transform y opacity para animaciones aceleradas por GPU:

```rust
// ✅ Bueno - Acelerado por GPU
builder.add_style("element", CssProperty::Transform, "translateX(100px)");
builder.add_style("element", CssProperty::Opacity, "0.5");

// ❌ Evitar - dispara relayout
builder.add_style("element", CssProperty::Width, "100px");
builder.add_style("element", CssProperty::Margin, "10px");
```

### Pista Will-change

```css
/* Pista al navegador para optimización */
.animated-element {
    will-change: transform, opacity;
}
```

## Referencia de API

### AnimationBuilder

```rust
pub struct AnimationBuilder<'a> {
    elements: &'a HashMap<String, Element>,
}

impl<'a> AnimationBuilder<'a> {
    pub fn new(elements: &'a HashMap<String, Element>) -> Self;

    pub fn add_style(self, element: &str, property: CssProperty, value: &str) -> Self;
    pub fn add_style_dynamic<F>(self, element: &str, property: CssProperty, f: F) -> Self
    where
        F: Fn(&AnimationContext) -> String + 'static;

    pub fn add_class(self, element: &str, class: &str) -> Self;
    pub fn remove_class(self, element: &str, class: &str) -> Self;

    pub fn apply(self);
    pub fn apply_with_transition(self, duration: &str, easing: &str);
    pub fn apply_with_custom_transition(self, transition: &str);
}
```

### AnimationContext

```rust
pub struct AnimationContext<'a> {
    pub mouse_x: f64,
    pub mouse_y: f64,
    pub scroll_x: f64,
    pub scroll_y: f64,
    pub elapsed_time: Duration,
    pub window_width: f64,
    pub window_height: f64,
}

impl<'a> AnimationContext<'a> {
    pub fn mouse_x(&self) -> f64;
    pub fn mouse_y(&self) -> f64;
    pub fn scroll_x(&self) -> f64;
    pub fn scroll_y(&self) -> f64;
    pub fn elapsed_time(&self) -> Duration;
}
```

### Timeline

```rust
pub struct Timeline {
    // interno
}

impl Timeline {
    pub fn new() -> Self;

    pub fn add(&mut self, animation: Animation) -> &mut Self;
    pub fn add_parallel(&mut self, animation: Animation) -> &mut Self;

    pub fn play(&mut self);
    pub fn pause(&mut self);
    pub fn stop(&mut self);
    pub fn reverse(&mut self);
    pub fn seek(&mut self, progress: f64);

    pub fn set_speed(&mut self, speed: f64);
    pub fn set_loop(&mut self, loop: bool);
    pub fn set_repeat_count(&mut self, count: usize);
}
```

## Mejores Prácticas

### 1. Usar Transiciones con Moderación

```rust
// ✅ Bueno - Solo en interacción del usuario
button {
    onmouseenter: move |_| {
        builder.apply_with_transition("200ms", "ease");
    }
}

// ❌ Evitar - Animación continua
loop {
    builder.apply_with_transition("16ms", "linear"); // 60fps, ¡pesado!
}
```

### 2. Preferir Transform sobre Layout

```rust
// ✅ Bueno - Acelerado por GPU
builder.add_style("el", CssProperty::Transform, "translateX(100px)");

// ❌ Evitar - Layout thrashing
builder.add_style("el", CssProperty::Margin, "100px");
```

### 3. Usar Easing Apropiado

```rust
// Sensación natural
"ease-out"      // Desacelerar
"ease-in-out"   // Acelerar luego desacelerar

// Sensación mecánica
"linear"        // Velocidad constante

// Juguetón
"elastic-out"   // Rebota
"bounce-out"    // Rebota al final
```

### 4. Respetar Movimiento Reducido

```rust
use_effect(move || {
    let prefers_reduced_motion = window()
        .match_media("(prefers-motion: reduce)")
        .ok()
        .and_then(|m| m.matches());

    if prefers_reduced_motion.unwrap_or(false) {
        // Usar animaciones más simples
        builder.apply_with_transition("0ms", "linear");
    } else {
        // Animación completa
        builder.apply_with_transition("300ms", "ease-out");
    }
});
```

## Sistemas Relacionados

- [Sistema de Tema](./theme.md) - Variables CSS para animaciones
- [Componentes](../components/) - Componentes UI animados
- [Sistema de Paleta](./palette.md) - Definiciones de color
