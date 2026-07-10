# Каскадер

Каскадер используется для многоуровневого выбора данных.

## Базовое использование

```hikari
rsx! {
    div { style: "padding:1rem;",
        select { style: "padding:6px 12px;border:1px solid #ccc;border-radius:4px;font-size:14px;",
            option { "Province / City / District" }
        }
    }
}
```

## API

| Свойство | Описание | Тип | По умолчанию |
|----------|----------|-----|--------------|
| options | Данные опций | Vec\<CascaderOption\> | - |
| value | Текущее значение | Option\<String\> | None |
| on_change | Обратный вызов изменения | EventHandler\<String\> | - |
