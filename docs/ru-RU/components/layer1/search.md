# Поиск

Компонент Search для поискового ввода.

## Базовое использование

```_hikari_component
pages/components/layer1/search#basic
```

## Голосовой ввод

Поддерживает функцию голосового ввода. Нажмите на значок микрофона, чтобы начать запись.

```_hikari_component
pages/components/layer1/search#voice
```

## API

| Свойство | Описание | Тип | По умолчанию |
|----------|----------|-----|--------------|
| placeholder | Текст-заполнитель | String | "Поиск..." |
| on_search | Обратный вызов поиска | Option\<EventHandler\<String\>\> | None |
| voice_input | Включить голосовой ввод | bool | false |
