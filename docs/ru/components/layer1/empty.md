# Пусто

Компонент Empty для отображения состояния пустых данных.

## Базовое использование

```hikari
rsx! {
    div { style: "padding:2rem;text-align:center;color:#999;",
        p { style: "font-size:14px;margin:0;", "No data available" }
    }
}
```

## API

| Свойство | Описание | Тип | По умолчанию |
|----------|----------|-----|--------------|
| description | Текст описания | Option\<String\> | None |
