# Числовой ввод

Компонент Number Input для числового ввода с поддержкой шага.

## Базовое использование

```_hikari_component
pages/components/layer1/number_input#basic
```

## С шагом

```_hikari_component
pages/components/layer1/number_input#stepper
```

## API

| Свойство | Описание | Тип | По умолчанию |
|----------|----------|-----|--------------|
| value | Текущее значение | i64 | 0 |
| min | Минимальное значение | Option\<i64\> | None |
| max | Максимальное значение | Option\<i64\> | None |
| step | Размер шага | i64 | 1 |
