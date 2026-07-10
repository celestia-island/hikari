# Компоненты переключателей

Компоненты-переключатели предоставляют функциональность переключения с различными цветами и вариантами.

## Базовый Switch

Поддерживает несколько цветов: Success, Primary, Secondary, Danger, Warning, Info.

```hikari
rsx! {
    div { style: "padding:1rem;display:flex;gap:16px;align-items:center;",
        div { style: "width:40px;height:22px;border-radius:11px;background:#3a6ea5;position:relative;",
            div { style: "position:absolute;right:2px;top:2px;width:18px;height:18px;border-radius:50%;background:#fff;" }
        }
        div { style: "width:40px;height:22px;border-radius:11px;background:#ccc;position:relative;",
            div { style: "position:absolute;left:2px;top:2px;width:18px;height:18px;border-radius:50%;background:#fff;" }
        }
    }
}
```

## Switch с иконками

Переключатель с иконками, по умолчанию предоставляет символы ✓ и ✗.

```hikari
rsx! {
    div { style: "padding:1rem;display:flex;gap:8px;align-items:center;",
        span { style: "font-size:16px;", "🌙" }
        div { style: "width:40px;height:22px;border-radius:11px;background:#3a6ea5;position:relative;",
            div { style: "position:absolute;right:2px;top:2px;width:18px;height:18px;border-radius:50%;background:#fff;" } }
        span { style: "font-size:16px;", "☀" }
    }
}
```

## Switch с текстом

Переключатель с текстовыми метками, автоматически регулирует ширину ползунка.

```hikari
rsx! {
    div { style: "padding:1rem;display:flex;gap:8px;align-items:center;",
        span { style: "font-size:14px;color:#666;", "Off" }
        div { style: "width:40px;height:22px;border-radius:11px;background:#3a6ea5;position:relative;",
            div { style: "position:absolute;right:2px;top:2px;width:18px;height:18px;border-radius:50%;background:#fff;" } }
        span { style: "font-size:14px;color:#333;", "On" }
    }
}
```

## Размеры Switch

Поддерживаются размеры Small, Medium, Large.

```hikari
rsx! {
    div { style: "padding:1rem;display:flex;gap:16px;align-items:center;",
        div { style: "width:28px;height:16px;border-radius:8px;background:#3a6ea5;position:relative;",
            div { style: "position:absolute;right:1px;top:1px;width:14px;height:14px;border-radius:50%;background:#fff;" } }
        div { style: "width:40px;height:22px;border-radius:11px;background:#3a6ea5;position:relative;",
            div { style: "position:absolute;right:2px;top:2px;width:18px;height:18px;border-radius:50%;background:#fff;" } }
        div { style: "width:52px;height:28px;border-radius:14px;background:#3a6ea5;position:relative;",
            div { style: "position:absolute;right:2px;top:2px;width:24px;height:24px;border-radius:50%;background:#fff;" } }
    }
}
```

## Progress

Компонент прогресс-бара для отображения хода операций.

```hikari
rsx! {
    div { style: "padding:1rem;",
        div { style: "width:200px;height:6px;background:#e2e2ea;border-radius:3px;overflow:hidden;",
            div { style: "width:60%;height:100%;background:#3a6ea5;border-radius:3px;" }
        }
    }
}
```

## Slider

Компонент слайдера для числового выбора.

```hikari
rsx! {
    div { style: "padding:1rem;",
        input { type: "range", min: "0", max: "100", value: "60", style: "width:200px;" }
    }
}
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
