# Изображение

Компонент Image для отображения изображений с состоянием загрузки и обработкой ошибок.

## Базовое использование

```hikari
rsx! {
    div { style: "padding:1rem;",
        img { src: "https://via.placeholder.com/200x120", alt: "Sample", style: "border-radius:8px;max-width:100%;" }
    }
}
```

## Заглушка загрузки

```hikari
rsx! {
    div { style: "padding:1rem;",
        div { style: "width:200px;height:120px;background:#f0f0f0;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#999;", "No Image" }
    }
}
```

## API

| Свойство | Описание | Тип | По умолчанию |
|----------|----------|-----|--------------|
| src | URL изображения | String | - |
| alt | Альтернативный текст | String | - |
| width | Ширина | Option\<String\> | None |
| height | Высота | Option\<String\> | None |
