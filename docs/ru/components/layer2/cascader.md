# Каскадер

Каскадер используется для многоуровневого выбора данных.

## Базовое использование

```_hikari_component
pages/components/layer2/cascader#basic
```

## API

| Свойство | Описание | Тип | По умолчанию |
|----------|----------|-----|--------------|
| options | Данные опций | Vec\<CascaderOption\> | - |
| value | Текущее значение | Option\<String\> | None |
| on_change | Обратный вызов изменения | EventHandler\<String\> | - |
