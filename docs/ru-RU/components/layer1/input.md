# Input Поле ввода

Компонент Input — это базовый компонент ввода формы, поддерживающий несколько состояний и пользовательские стили.

## Трёхуровневая конфигурация

Компонент Input поддерживает трёхуровневую архитектуру конфигурации CSS-переменных:

- **Layer1 (Базовый уровень)**: Определяет глобальные значения по умолчанию через темы
- **Layer2 (Уровень компонента)**: Определяет переменные компонента через `input-vars.scss`
- **Custom (Время выполнения)**: Динамически переопределяет через свойства компонента

## Базовое использование

```_hikari_component
pages/components/layer1/input#basic
```

## Отключённое состояние

Поле ввода может быть отключено, в отключённом состоянии его нельзя редактировать.

```_hikari_component
pages/components/layer1/input#disabled
```

## Пользовательские цвета

Цвета поля ввода могут быть динамически переопределены через свойства уровня Custom.

```rust
Input {
    placeholder: "Custom styled input",
    text_color: Some("#ff0000".to_string()),        // Пользовательский цвет текста
    border_color: Some("#ff4f00".to_string()),       // Пользовательский цвет границы
    background_color: Some("rgba(255, 255, 255, 0.1)".to_string()), // Пользовательский цвет фона
}
```

## Переопределение CSS-переменных

CSS-переменные могут быть переопределены пакетно через свойство `css_vars`.

```rust
Input {
    placeholder: "CSS Variables Override",
    css_vars: Some(vec![
        ("--hi-input-radius", "16px".to_string()),
        ("--hi-input-border-color-focus", "#22c55e".to_string()),
        ("--hi-input-shadow-focus", "0 0 0 2px rgba(34, 197, 94, 0.3)".to_string()),
    ]),
}
```

## Интеграция анимации

Эффекты анимации могут быть интегрированы с AnimationBuilder через свойство `animation_id`.

```rust
Input {
    placeholder: "Animated Input",
    animation_id: Some("animated-input".to_string()),
}

// Управление анимацией с помощью AnimationBuilder
AnimationBuilder::new()
    .style("--hi-input-border-color", "rgb(255, 79, 0)")
    .style("--hi-input-shadow-focus", "0 0 0 2px rgba(255, 79, 0, 0.3)")
    .duration(300)
    .apply_to_element("animated-input");
```

## API

### Input Props

| Свойство | Описание | Тип | По умолчанию |
|----------|----------|-----|--------------|
| size | Размер поля ввода | InputSize | Medium |
| disabled | Отключено ли | bool | false |
| readonly | Только для чтения | bool | false |
| placeholder | Текст заполнителя | Option\<String\> | None |
| value | Значение ввода | Option\<String\> | None |
| input_type | Тип ввода | Option\<String\> | "text" |
| autofocus | Автоматический фокус | bool | false |
| class | Пользовательский CSS-класс | String | "" |
| prefix_icon | Префиксная иконка | Option\<Element\> | None |
| suffix_icon | Суффиксная иконка | Option\<Element\> | None |
| oninput | Callback ввода | Option\<EventHandler\<String\>\> | None |
| onfocus | Callback фокуса | Option\<EventHandler\<FocusEvent\>\> | None |
| onblur | Callback потери фокуса | Option\<EventHandler\<FocusEvent\>\> | None |
| onkeydown | Callback нажатия клавиши | Option\<EventHandler\<KeyboardEvent\>\> | None |
| glow | Включён ли эффект свечения | bool | true |
| glow_blur | Интенсивность размытия свечения | GlowBlur | Medium |
| glow_intensity | Интенсивность свечения | GlowIntensity | Soft |
| glow_color | Цвет свечения | GlowColor | Ghost |
| **Свойства уровня Custom** | | | |
| text_color | Пользовательский цвет текста | Option\<String\> | None |
| placeholder_color | Пользовательский цвет заполнителя | Option\<String\> | None |
| border_color | Пользовательский цвет границы | Option\<String\> | None |
| background_color | Пользовательский цвет фона | Option\<String\> | None |
| animation_id | ID анимации AnimationBuilder | Option\<String\> | None |
| css_vars | Пакетное переопределение CSS-переменных | Option\<Vec\<(&'static str, String)\>\> | None |

## Справочник по CSS-переменным

### CSS-переменные Input

| Переменная | Описание | По умолчанию |
|------------|----------|--------------|
| --hi-input-text-color | Цвет текста | var(--hi-color-text-primary) |
| --hi-input-text-color-disabled | Цвет отключённого текста | var(--hi-color-text-disabled) |
| --hi-input-placeholder-color | Цвет заполнителя | var(--hi-color-text-secondary) |
| --hi-input-placeholder-opacity | Прозрачность заполнителя | 0.6 |
| --hi-input-bg | Цвет фона | transparent |
| --hi-input-bg-disabled | Отключённый фон | rgba(255, 255, 255, 0.5) |
| --hi-input-border-color | Цвет границы | var(--hi-color-border) |
| --hi-input-border-color-focus | Цвет границы при фокусе | var(--hi-color-primary) |
| --hi-input-border-color-disabled | Цвет отключённой границы | var(--hi-border-color-disabled) |
| --hi-input-border-color-error | Цвет границы ошибки | var(--hi-color-danger) |
| --hi-input-shadow-focus | Тень при фокусе | 0 0 0 2px var(--hi-color-primary) |
| --hi-input-radius | Радиус скругления | var(--hi-radius-md) |
| --hi-input-padding-x | Горизонтальный отступ | 0.75rem |
| --hi-input-padding-y | Вертикальный отступ | 0.5rem |
| --hi-input-font-size | Размер шрифта | var(--hi-font-size-sm) |

## Связанная документация

- [Обзор системы дизайна](../../design-system/overview.md)
- [Layer1 Базовый уровень](../../design-system/layer1.md)
- [Layer2 Уровень компонента](../../design-system/layer2.md)
- [Custom Пользовательский уровень](../../design-system/custom.md)
