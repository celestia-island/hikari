# QR-код

Компонент генерации QR-кода.

## Базовое использование

```hikari
rsx! {
    div { style: "padding:1rem;",
        div { style: "width:100px;height:100px;background:#000;display:grid;grid-template-columns:repeat(10,1fr);",
            div { style: "background:#fff;aspect-ratio:1;", "" }
        }
    }
}
```

## API

| Свойство | Описание | Тип | По умолчанию |
|----------|----------|-----|--------------|
| value | Содержимое QR-кода | String | - |
| size | Размер | u32 | 128 |
