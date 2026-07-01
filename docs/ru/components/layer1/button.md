# Button

Компонент Button — это самый базовый компонент пользовательского взаимодействия, поддерживающий множество стилей и состояний.

Кнопки используются для запуска действий или событий, таких как отправка форм, открытие диалогов, отмена операций или выполнение операций удаления.

## Варианты кнопок

Поддерживаются четыре варианта: Primary, Secondary, Ghost и Danger.

```_hikari_component
pages/components/layer1/button#variants
```

## Отключённое состояние

Кнопки могут быть отключены, в этом случае они не нажимаются.

```_hikari_component
pages/components/layer1/button#disabled
```

## Размеры кнопок с иконками

Кнопки с иконками поддерживают три размера: маленький (24px), средний (32px) и большой (40px).

```_hikari_component
pages/components/layer1/button#icon-sizes
```

## Варианты кнопок с иконками

Кнопки с иконками поддерживают пять цветовых вариантов: Ghost, Primary, Secondary, Danger и Success.

```_hikari_component
pages/components/layer1/button#icon-variants
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
