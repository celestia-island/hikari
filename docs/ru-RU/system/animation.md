# Система анимации

Высокопроизводительная декларативная система анимации, поддерживающая статические значения, динамические значения, сложные временные шкалы и более 30 функций сглаживания.

## Содержание

- [Обзор](#обзор)
- [Основные функции](#основные-функции)
- [AnimationBuilder](#animationbuilder)
- [Tween](#tween)
- [Easing](#easing)
- [Timeline](#timeline)
- [Пресеты](#пресеты)
- [Spotlight](#spotlight)
- [Context](#context)
- [Style](#style)
- [Примеры использования](#примеры-использования)

## Обзор

`hikari-animation` предоставляет комплексное решение для анимации:

- **Декларативный API**: CSS-подобный плавный синтаксис
- **Динамические значения**: Анимационные значения, вычисляемые во время выполнения (например, следование за мышью)
- **Высокая производительность**: Оптимизация WASM, дебаунсинг обновлений, requestAnimationFrame
- **Типобезопасность**: Проверка CSS-свойств во время компиляции
- **Богатые пресеты**: Затухание, скольжение, масштабирование и другие распространённые анимации

## Основные функции

### 1. AnimationBuilder

Продвинутый сборщик анимации, поддерживающий:

- **Мультиэлементное управление**: Одновременное управление несколькими DOM-элементами
- **Динамические значения**: Вычисление в реальном времени на основе AnimationContext
- **Автоматические переходы**: Интеллектуальное управление переходами
- **Типобезопасность**: Перечисление CssProperty предотвращает опечатки

### 2. Система Tween

Система интерполяционной анимации:

- **Интерполяция значений**: Плавные числовые переходы
- **Пользовательское сглаживание**: Более 30 встроенных функций сглаживания
- **Управление временем**: Контроль длительности и задержки
- **Циклическое воспроизведение**: Поддержка зацикленного воспроизведения

### 3. Функции сглаживания

Богатая библиотека функций сглаживания:

- **Базовые**: Linear, EaseIn, EaseOut, EaseInOut
- **Синусоидальные**: Сглаживание по синусу
- **Квадратичные**: Квадратичное сглаживание
- **Кубические**: Кубическое сглаживание
- **Четвертичные**: Четвертичное сглаживание
- **Пятистепенные**: Пятистепенное сглаживание
- **Экспоненциальные**: Экспоненциальное сглаживание
- **Круговые**: Круговое сглаживание
- **Отдача**: Эффект отдачи/перелёта
- **Эластичные**: Эластичный эффект
- **Отскок**: Эффект отскока

### 4. Timeline

Управление временной шкалой:

- **Последовательная анимация**: Воспроизведение нескольких анимаций последовательно
- **Параллельная анимация**: Одновременное воспроизведение нескольких анимаций
- **Отложенное выполнение**: Точный контроль времени
- **Группы анимации**: Организация сложных анимационных последовательностей

### 5. Пресеты

Библиотека предустановленных анимаций:

- **Fade**: Появление/исчезновение
- **Slide**: Въезд/выезд
- **Scale**: Анимация масштабирования
- **Rotate**: Анимация вращения
- **Flip**: Анимация переворота
- **Zoom**: Приближение/отдаление

### 6. Spotlight

Эффект прожектора:

- **Следование за мышью**: Эффект свечения следует за курсором
- **Градиентное освещение**: Плавные радиальные градиенты
- **Производительность**: Дебаунсинг обновлений, регулировка перерисовки
- **Автоинициализация**: Сканирование и инициализация элементов прожектора

## AnimationBuilder

### Базовое использование

```rust
use hikari_animation::{AnimationBuilder, AnimationContext};
use hikari_animation::style::CssProperty;
use std::collections::HashMap;

// Создание отображения элементов
let mut elements = HashMap::new();
elements.insert("button".to_string(), button_element);

// Применение статических стилей
AnimationBuilder::new(&elements)
    .add_style("button", CssProperty::Opacity, "0.8")
    .add_class("button", "hi-flex")
    .apply();
```

### Анимация с динамическими значениями

```rust
// Эффект следования за мышью
AnimationBuilder::new(&elements)
    .add_style_dynamic("button", CssProperty::Transform, |ctx| {
        let x = ctx.mouse_x();
        let y = ctx.mouse_y();
        format!("translate({}px, {}px)", x, y)
    })
    .apply_with_transition("150ms", "ease-out");
```

### Мультиэлементная анимация

```rust
// Одновременное управление несколькими элементами
let mut elements = HashMap::new();
elements.insert("button".to_string(), button_element);
elements.insert("icon".to_string(), icon_element);

AnimationBuilder::new(&elements)
    .add_style("button", CssProperty::Opacity, "0.8")
    .add_style("icon", CssProperty::Transform, "scale(1.1)")
    .add_class("button", "hi-flex")
    .apply();
```

### Анимация перехода

```rust
// Анимация с переходом
AnimationBuilder::new(&elements)
    .add_style("button", CssProperty::Width, "100px")
    .apply_with_transition("300ms", "ease-in-out");

// Пользовательские свойства перехода
AnimationBuilder::new(&elements)
    .add_style("button", CssProperty::Transform, "rotate(90deg)")
    .apply_with_transition("500ms", "cubic-bezier(0.68, -0.55, 0.265, 1.55)");
```

### Справочник API

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

Интерполяция между значениями во времени.

### Базовый Tween

```rust
use hikari_animation::tween::{Tween, TweenBuilder};

let tween = TweenBuilder::new()
    .from(0.0)
    .to(100.0)
    .duration(1000) // мс
    .easing(ease::EaseOut)
    .build();
```

### Tween с обратными вызовами

```rust
let tween = TweenBuilder::new()
    .from(0.0)
    .to(1.0)
    .duration(500)
    .on_update(|value| {
        println!("Текущее значение: {}", value);
    })
    .on_complete(|| {
        println!("Анимация завершена!");
    })
    .build();
```

### Цепочки Tween

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

Функции сглаживания управляют скоростью анимации.

### Базовое сглаживание

```rust
use hikari_animation::easing;

// Linear - без сглаживания
linear(0.5); // 0.5

// Ease In - медленно начинается, быстро заканчивается
ease_in(0.5); // 0.25

// Ease Out - быстро начинается, медленно заканчивается
ease_out(0.5); // 0.75

// Ease In Out - медленно с обоих концов
ease_in_out(0.5); // 0.5
```

### Продвинутое сглаживание

```rust
// Back - небольшой перелёт
back_out(0.5); // 1.2

// Elastic - колебания
elastic_out(0.5); // 1.0

// Bounce - отскок в конце
bounce_out(0.5); // 0.75
```

### Все функции сглаживания

```rust
// Базовые
pub fn linear(t: f64) -> f64;
pub fn ease_in(t: f64) -> f64;
pub fn ease_out(t: f64) -> f64;
pub fn ease_in_out(t: f64) -> f64;

// Синусоидальные
pub fn sine_in(t: f64) -> f64;
pub fn sine_out(t: f64) -> f64;
pub fn sine_in_out(t: f64) -> f64;

// Квадратичные
pub fn quad_in(t: f64) -> f64;
pub fn quad_out(t: f64) -> f64;
pub fn quad_in_out(t: f64) -> f64;

// Кубические
pub fn cubic_in(t: f64) -> f64;
pub fn cubic_out(t: f64) -> f64;
pub fn cubic_in_out(t: f64) -> f64;

// Четвертичные
pub fn quart_in(t: f64) -> f64;
pub fn quart_out(t: f64) -> f64;
pub fn quart_in_out(t: f64) -> f64;

// Пятистепенные
pub fn quint_in(t: f64) -> f64;
pub fn quint_out(t: f64) -> f64;
pub fn quint_in_out(t: f64) -> f64;

// Экспоненциальные
pub fn expo_in(t: f64) -> f64;
pub fn expo_out(t: f64) -> f64;
pub fn expo_in_out(t: f64) -> f64;

// Круговые
pub fn circ_in(t: f64) -> f64;
pub fn circ_out(t: f64) -> f64;
pub fn circ_in_out(t: f64) -> f64;

// Отдача
pub fn back_in(t: f64) -> f64;
pub fn back_out(t: f64) -> f64;
pub fn back_in_out(t: f64) -> f64;

// Эластичные
pub fn elastic_in(t: f64) -> f64;
pub fn elastic_out(t: f64) -> f64;
pub fn elastic_in_out(t: f64) -> f64;

// Отскок
pub fn bounce_in(t: f64) -> f64;
pub fn bounce_out(t: f64) -> f64;
pub fn bounce_in_out(t: f64) -> f64;
```

## Timeline

Управление последовательностями анимации и временем.

### Последовательные анимации

```rust
use hikari_animation::Timeline;

let mut timeline = Timeline::new();

// Добавление анимаций последовательно
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

### Параллельные анимации

```rust
let mut timeline = Timeline::new();

// Одновременное воспроизведение анимаций
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

### Управление Timeline

```rust
let timeline = Timeline::new();

// Управление воспроизведением
timeline.play();      // Начать воспроизведение
timeline.pause();     // Приостановить воспроизведение
timeline.reverse();   // Обратное воспроизведение
timeline.seek(0.5);   // Перейти к 50%

// Управление скоростью
timeline.set_speed(2.0);  // 2x скорость
timeline.set_speed(0.5);  // 0.5x скорость

// Управление циклом
timeline.set_loop(true);
timeline.set_repeat_count(3);
```

## Пресеты

Предустановленные анимации.

### Анимации затухания

```rust
use hikari_animation::presets;

// Появление
presets::fade_in(&elements, "box", 300);

// Исчезновение
presets::fade_out(&elements, "box", 300);

// До определённой прозрачности
presets::fade_to(&elements, "box", 0.5, 300);
```

### Анимации скольжения

```rust
// Въезд слева
presets::slide_in_left(&elements, "box", 300);

// Въезд справа
presets::slide_in_right(&elements, "box", 300);

// Выезд влево
presets::slide_out_left(&elements, "box", 300);

// Въезд сверху
presets::slide_in_top(&elements, "box", 300);
```

### Анимации масштабирования

```rust
// Увеличение
presets::scale_up(&elements, "box", 1.5, 300);

// Уменьшение
presets::scale_down(&elements, "box", 0.8, 300);

// Пульсация
presets::pulse(&elements, "box", 300);
```

### Анимации вращения

```rust
// Вращение по часовой стрелке
presets::rotate_cw(&elements, "box", 90, 500);

// Вращение против часовой стрелки
presets::rotate_ccw(&elements, "box", 90, 500);

// Переворот
presets::flip_x(&elements, "box", 500);
presets::flip_y(&elements, "box", 500);
```

### Пользовательские пресеты

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

Эффект свечения, следующий за мышью для элементов.

### Базовый Spotlight

```rust
use hikari_animation::spotlight;

// Инициализация прожектора на всех кнопках
spotlight::init();

// Или инициализация на определённых элементах
spotlight::init_selector(".hi-button");
```

### Пользовательский Spotlight

```rust
spotlight::Config {
    size: 200,              // Размер прожектора в px
    opacity: 0.15,          // Прозрачность (0-1)
    color: "#00A0E9",       // Цвет свечения
    blur: 20,              // Радиус размытия в px
    transition: "150ms"     // Скорость перехода
}.init();
```

### Spotlight в компонентах

```rust
rsx! {
    Button {
        label: "Наведи на меня",
        class: "hi-spotlight",  // Включить прожектор
        "Data: spot-{spot_id}"   // Уникальный идентификатор
    }
}
```

### Отключение Spotlight

```rust
// Отключить на определённых элементах
spotlight::disable_selector(".no-spotlight");

// Отключить все
spotlight::disable_all();
```

## Context

Контекст анимации предоставляет информацию во время выполнения.

### Позиция мыши

```rust
AnimationBuilder::new(&elements)
    .add_style_dynamic("target", CssProperty::Transform, |ctx| {
        let x = ctx.mouse_x();
        let y = ctx.mouse_y();
        format!("translate({}px, {}px)", x, y)
    })
    .apply();
```

### Анимация на основе времени

```rust
.add_style_dynamic("clock", CssProperty::Transform, |ctx| {
    let time = ctx.elapsed_time();
    let angle = (time.as_millis() % 1000) as f64 / 1000.0 * 360.0;
    format!("rotate({}deg)", angle)
})
```

### Позиция прокрутки

```rust
.add_style_dynamic("header", CssProperty::Background, |ctx| {
    let scroll_y = ctx.scroll_y();
    let opacity = (scroll_y / 100.0).min(1.0);
    format!("rgba(0, 160, 233, {})", opacity)
})
```

## Style

Типобезопасная манипуляция CSS-свойствами.

### Перечисление CssProperty

```rust
use hikari_animation::style::CssProperty;

// Цветовые свойства
CssProperty::Color
CssProperty::BackgroundColor
CssProperty::BorderColor

// Свойства макета
CssProperty::Width
CssProperty::Height
CssProperty::Margin
CssProperty::Padding

// Свойства трансформации
CssProperty::Transform
CssProperty::Translate
CssProperty::Scale
CssProperty::Rotate

// Эффектные свойства
CssProperty::Opacity
CssProperty::BoxShadow
CssProperty::Filter
```

### Манипуляция стилем

```rust
// Установка одного свойства
builder.add_style("element", CssProperty::Color, "#00A0E9");

// Установка трансформации
builder.add_style("element", CssProperty::Transform, "translate(10px, 20px)");

// Установка прозрачности
builder.add_style("element", CssProperty::Opacity, "0.5");

// Сложная трансформация
builder.add_style("element", CssProperty::Transform,
    "perspective(1000px) rotateX(45deg) translateZ(50px)");
```

### Пользовательские CSS-свойства

```rust
// Пользовательское свойство
builder.add_style("element", CssProperty::Custom("--my-var"), "value");

// И его использование
builder.add_style("element", CssProperty::Color, "var(--my-var)");
```

## Примеры использования

### Эффект наведения кнопки

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
            "Наведи на меня"
        }
    }
}
```

### Анимация загрузки

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

### Параллакс-прокрутка

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
                "Контент"
            }
        }
    }
}
```

### Анимированный счётчик

```rust
#[component]
fn AnimatedCounter() -> Element {
    let mut count = use_signal(|| 0);

    use_effect(move || {
        let target = 1000;
        let duration = 2000; // 2 секунды
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

## Оптимизация производительности

### Дебаунсинг обновлений

```rust
use hikari_animation::AnimationBuilder;

// AnimationBuilder автоматически делает дебаунсинг обновлений
AnimationBuilder::new(&elements)
    .add_style_dynamic("element", CssProperty::Transform, |ctx| {
        // Это с дебаунсингом - не обновляется при каждом mousemove
        let x = ctx.mouse_x();
        format!("translateX({}px)", x)
    })
    .apply_with_transition("100ms", "ease-out");
```

### RequestAnimationFrame

Система анимации использует `requestAnimationFrame` для плавных 60fps анимаций:

```rust
// Автоматическая интеграция RAF
AnimationBuilder::new(&elements)
    .add_style("anim", CssProperty::Opacity, "1")
    .apply_with_transition("1000ms", "ease");
```

### GPU-ускорение

Используйте transform и opacity для GPU-ускоренных анимаций:

```rust
// ✅ Хорошо - GPU-ускорение
builder.add_style("element", CssProperty::Transform, "translateX(100px)");
builder.add_style("element", CssProperty::Opacity, "0.5");

// ❌ Избегайте - вызывает перерасчёт макета
builder.add_style("element", CssProperty::Width, "100px");
builder.add_style("element", CssProperty::Margin, "10px");
```

### Подсказка will-change

```css
/* Подсказка браузеру для оптимизации */
.animated-element {
    will-change: transform, opacity;
}
```

## Справочник API

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
    // внутреннее
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

## Лучшие практики

### 1. Используйте переходы умеренно

```rust
// ✅ Хорошо - Только при взаимодействии пользователя
button {
    onmouseenter: move |_| {
        builder.apply_with_transition("200ms", "ease");
    }
}

// ❌ Избегайте - Непрерывная анимация
loop {
    builder.apply_with_transition("16ms", "linear"); // 60fps, тяжело!
}
```

### 2. Предпочитайте transform вместо макета

```rust
// ✅ Хорошо - GPU-ускорение
builder.add_style("el", CssProperty::Transform, "translateX(100px)");

// ❌ Избегайте - Проблемы с макетом
builder.add_style("el", CssProperty::Margin, "100px");
```

### 3. Используйте подходящее сглаживание

```rust
// Естественное ощущение
"ease-out"      // Замедление
"ease-in-out"   // Ускорение, затем замедление

// Механическое ощущение
"linear"        // Постоянная скорость

// Игривое
"elastic-out"   // Колебания
"bounce-out"    // Отскок в конце
```

### 4. Уважайте уменьшенное движение

```rust
use_effect(move || {
    let prefers_reduced_motion = window()
        .match_media("(prefers-motion: reduce)")
        .ok()
        .and_then(|m| m.matches());

    if prefers_reduced_motion.unwrap_or(false) {
        // Используйте более простые анимации
        builder.apply_with_transition("0ms", "linear");
    } else {
        // Полная анимация
        builder.apply_with_transition("300ms", "ease-out");
    }
});
```

## Связанные системы

- [Система тем](./theme.md) - CSS-переменные для анимаций
- [Компоненты](../components/) - Анимированные UI-компоненты
- [Система палитры](./palette.md) - Определения цветов
