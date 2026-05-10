# Аватар

Компонент Avatar используется для отображения аватаров пользователей или сущностей.

## Размеры

Поддерживает пять размеров: Xs, Sm, Md, Lg, Xl.

```_hikari_component
pages/components/layer1/avatar#sizes
```

## Варианты формы

Поддерживает три формы: Круглая, Скруглённая, Квадратная.

```_hikari_component
pages/components/layer1/avatar#variants
```

## Текстовая заглушка

Когда изображение недоступно, отображаются инициалы или пользовательский текст.

```_hikari_component
pages/components/layer1/avatar#fallback
```

## API

### Свойства

| Свойство | Описание | Тип | По умолчанию |
|----------|----------|-----|--------------|
| src | URL изображения | Option\<String\> | None |
| alt | Альтернативный текст | String | - |
| size | Размер | AvatarSize | Md |
| variant | Вариант формы | AvatarVariant | Circular |
| fallback | Текст заглушки | Option\<String\> | None |
