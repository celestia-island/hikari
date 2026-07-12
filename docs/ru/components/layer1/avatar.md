# Аватар

Компонент Avatar используется для отображения аватаров пользователей или сущностей.

## Размеры

Поддерживает пять размеров: Xs, Sm, Md, Lg, Xl.

```hikari
rsx! {
    div { style: "display:flex;gap:8px;padding:1rem;align-items:center;",
        div { style: "width:16px;height:16px;border-radius:50%;background:#3a6ea5;display:flex;align-items:center;justify-content:center;color:#fff;font-size:8px;", "XS" }
        div { style: "width:24px;height:24px;border-radius:50%;background:#3a6ea5;display:flex;align-items:center;justify-content:center;color:#fff;font-size:10px;", "S" }
        div { style: "width:32px;height:32px;border-radius:50%;background:#3a6ea5;display:flex;align-items:center;justify-content:center;color:#fff;font-size:12px;", "M" }
        div { style: "width:40px;height:40px;border-radius:50%;background:#3a6ea5;display:flex;align-items:center;justify-content:center;color:#fff;font-size:14px;", "L" }
        div { style: "width:48px;height:48px;border-radius:50%;background:#3a6ea5;display:flex;align-items:center;justify-content:center;color:#fff;font-size:16px;", "XL" }
    }
}
```

## Варианты формы

Поддерживает три формы: Круглая, Скруглённая, Квадратная.

```hikari
rsx! {
    div { style: "display:flex;gap:12px;padding:1rem;align-items:center;",
        div { style: "width:40px;height:40px;border-radius:50%;background:#3a6ea5;display:flex;align-items:center;justify-content:center;color:#fff;", "A" }
        div { style: "width:40px;height:40px;border-radius:8px;background:#3a6ea5;display:flex;align-items:center;justify-content:center;color:#fff;", "B" }
        div { style: "width:40px;height:40px;border-radius:0;background:#3a6ea5;display:flex;align-items:center;justify-content:center;color:#fff;", "C" }
    }
}
```

## Текстовая заглушка

Когда изображение недоступно, отображаются инициалы или пользовательский текст.

```hikari
rsx! {
    div { style: "display:flex;gap:8px;padding:1rem;",
        div { style: "width:40px;height:40px;border-radius:50%;background:#3a6ea5;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:600;", "JD" }
    }
}
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
