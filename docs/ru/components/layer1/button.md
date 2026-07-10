# Button

Компонент Button — это самый базовый компонент пользовательского взаимодействия, поддерживающий множество стилей и состояний.

Кнопки используются для запуска действий или событий, таких как отправка форм, открытие диалогов, отмена операций или выполнение операций удаления.

## Варианты кнопок

Поддерживаются четыре варианта: Primary, Secondary, Ghost и Danger.

```hikari
rsx! {
    div { style: "display:flex;gap:8px;padding:1rem;flex-wrap:wrap;",
        button { style: "padding:6px 16px;border:none;border-radius:4px;background:#3a6ea5;color:#fff;cursor:pointer;", "Primary" }
        button { style: "padding:6px 16px;border:1px solid #ccc;border-radius:4px;background:#fff;color:#333;cursor:pointer;", "Secondary" }
        button { style: "padding:6px 16px;border:none;border-radius:4px;background:transparent;color:#3a6ea5;cursor:pointer;", "Ghost" }
        button { style: "padding:6px 16px;border:none;border-radius:4px;background:#ef4444;color:#fff;cursor:pointer;", "Danger" }
    }
}
```

## Отключённое состояние

Кнопки могут быть отключены, в этом случае они не нажимаются.

```hikari
rsx! {
    div { style: "display:flex;gap:8px;padding:1rem;",
        button { style: "padding:6px 16px;border:none;border-radius:4px;background:#3a6ea5;color:#fff;", "Normal" }
        button { disabled: true, style: "padding:6px 16px;border:none;border-radius:4px;background:#ccc;color:#999;cursor:not-allowed;", "Disabled" }
    }
}
```

## Размеры кнопок с иконками

Кнопки с иконками поддерживают три размера: маленький (24px), средний (32px) и большой (40px).

```hikari
rsx! {
    div { style: "display:flex;gap:12px;padding:1rem;align-items:center;",
        button { style: "width:24px;height:24px;border:1px solid #ccc;border-radius:4px;background:#fff;cursor:pointer;", "" }
        button { style: "width:32px;height:32px;border:1px solid #ccc;border-radius:4px;background:#fff;cursor:pointer;", "" }
        button { style: "width:40px;height:40px;border:1px solid #ccc;border-radius:4px;background:#fff;cursor:pointer;", "" }
    }
}
```

## Варианты кнопок с иконками

Кнопки с иконками поддерживают пять цветовых вариантов: Ghost, Primary, Secondary, Danger и Success.

```hikari
rsx! {
    div { style: "display:flex;gap:8px;padding:1rem;",
        button { style: "width:32px;height:32px;border:none;border-radius:4px;background:transparent;color:#666;cursor:pointer;", "G" }
        button { style: "width:32px;height:32px;border:none;border-radius:4px;background:#3a6ea5;color:#fff;cursor:pointer;", "P" }
        button { style: "width:32px;height:32px;border:1px solid #ccc;border-radius:4px;background:#fff;color:#333;cursor:pointer;", "S" }
        button { style: "width:32px;height:32px;border:none;border-radius:4px;background:#ef4444;color:#fff;cursor:pointer;", "D" }
        button { style: "width:32px;height:32px;border:none;border-radius:4px;background:#22c55e;color:#fff;cursor:pointer;", "✓" }
    }
}
```

## API

### Свойства Button

| Свойство | Описание | Тип | По умолчанию |
|----------|----------|-----|--------------|
| variant | Вариант стиля кнопки | ButtonVariant | Primary |
| size | Размер кнопки | ButtonSize | Medium |
| disabled | Отключена ли кнопка | bool | false |
| children | Содержимое кнопки | Element | - |

### Свойства IconButton

| Свойство | Описание | Тип | По умолчанию |
|----------|----------|-----|--------------|
| icon | Иконка для отображения | MdiIcon | - |
| size | Размер кнопки | IconButtonSize | Large |
| variant | Цветовой вариант | IconButtonVariant | Ghost |
| glow | Включить эффект свечения | bool | true |
| disabled | Отключена ли кнопка | bool | false |
| onclick | Обработчик клика | EventHandler\<MouseEvent\> | - |
