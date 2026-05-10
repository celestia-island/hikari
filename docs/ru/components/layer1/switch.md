# Компоненты переключателей

Компоненты-переключатели предоставляют функциональность переключения с различными цветами и вариантами.

## Базовый Switch

Поддерживает несколько цветов: Success, Primary, Secondary, Danger, Warning, Info.

```_hikari_component
pages/components/layer1/switch#switch
```

## Switch с иконками

Переключатель с иконками, по умолчанию предоставляет символы ✓ и ✗.

```_hikari_component
pages/components/layer1/switch#icon
```

## Switch с текстом

Переключатель с текстовыми метками, автоматически регулирует ширину ползунка.

```_hikari_component
pages/components/layer1/switch#text
```

## Размеры Switch

Поддерживаются размеры Small, Medium, Large.

```_hikari_component
pages/components/layer1/switch#sizes
```

## Progress

Компонент прогресс-бара для отображения хода операций.

```_hikari_component
pages/components/layer1/switch#progress
```

## Slider

Компонент слайдера для числового выбора.

```_hikari_component
pages/components/layer1/switch#slider
```

## API

### SwitchProps

| Свойство | Тип | По умолчанию | Описание |
|------|------|--------|------|
| checked | `bool` | `false` | Включён ли переключатель |
| on_change | `EventEmitter<bool>` | - | Callback изменения состояния |
| disabled | `bool` | `false` | Отключён ли |
| size | `SwitchSize` | `Medium` | Размер |
| variant | `SwitchVariant` | `Default` | Тип варианта |
| color | `SwitchColor` | `Success` | Цвет во включённом состоянии |
| checked_content | `Option<SwitchContent>` | `None` | Содержимое во включённом состоянии |
| unchecked_content | `Option<SwitchContent>` | `None` | Содержимое в выключенном состоянии |

### SwitchVariant

| Значение | Описание |
|------|------|
| `Default` | Стиль по умолчанию (точка) |
| `Text` | Текстовый вариант |
| `Icon` | Вариант с иконкой |
| `Custom` | Пользовательский вариант |

### SwitchColor

| Значение | Описание |
|------|------|
| `Success` | Успех/Вкл (зелёный, по умолчанию) |
| `Primary` | Основной цвет (синий) |
| `Secondary` | Вторичный цвет (фиолетовый) |
| `Danger` | Опасность (красный) |
| `Warning` | Предупреждение (жёлтый) |
| `Info` | Информация (индиго) |

### SwitchContent

| Значение | Описание |
|------|------|
| `Text(String)` | Текстовое содержимое |
| `Icon(SwitchIcon)` | Содержимое-иконка |
| `Image(String)` | URL изображения |

### SwitchIcon

| Значение | Описание |
|------|------|
| `Check` | Иконка галочки |
| `Close` | Иконка закрытия |
| `Plus` | Иконка плюса |
| `Minus` | Иконка минуса |
| `Custom(&'static str)` | Пользовательский SVG-путь |
