# Сворачиваемая панель

Компонент сворачиваемой панели.

## Базовое использование

```hikari
rsx! {
    div { style: "padding:1rem;border:1px solid #e2e2ea;border-radius:8px;max-width:300px;",
        div { style: "padding:12px;font-weight:600;cursor:pointer;background:#f7f7fa;", "Click to expand ▼" }
        div { style: "padding:12px;color:#666;font-size:14px;", "Collapsible content" }
    }
}
```

## API

| Свойство | Описание | Тип | По умолчанию |
|----------|----------|-----|--------------|
| title | Заголовок | String | - |
| expanded | Состояние развёрнутости | bool | false |
