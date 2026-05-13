# Number Input Числовой ввод

Компонент Number Input используется для числового ввода с поддержкой шагового переключателя.

## Базовое использование

```_hikari_component
pages/components/layer1/number_input#basic
```

## Размеры

Доступны три размера: Маленький, Средний (по умолчанию) и Большой.

```_hikari_component
pages/components/layer1/number_input#sizes
```

## Отключенное состояние

```_hikari_component
pages/components/layer1/number_input#disabled
```

## Шаговый переключатель с диапазоном

Вы можете установить минимальное значение, максимальное значение и размер шага.

```_hikari_component
pages/components/layer1/number_input#stepper
```

## API

| Свойство | Описание | Тип | По умолчанию |
|----------|----------|-----|--------------|
| value | Текущее значение | i64 | 0 |
| on_change | Обратный вызов изменения значения | EventHandler<i64> | - |
| min | Минимальное значение | Option<i64> | None |
| max | Максимальное значение | Option<i64> | None |
| step | Размер шага | i64 | 1 |
| disabled | Отключено ли | bool | false |
| size | Вариант размера | NumberInputSize | Medium |
| class | Пользовательское имя класса | String | "" |
| style | Пользовательский стиль | String | "" |

### NumberInputSize

- `Small` - Маленький размер (24px)
- `Medium` - Средний размер (32px, по умолчанию)
- `Large` - Большой размер (40px)
