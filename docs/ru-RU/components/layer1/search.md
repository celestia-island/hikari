# Search

Search component for search input.

## Basic Usage

```_hikari_component
pages/components/layer1/search#basic
```

## With Suggestions

Search with suggestion dropdown.

```_hikari_component
pages/components/layer1/search#suggestions
```

## API

| Property | Description | Type | Default |
|----------|-------------|------|---------|
| placeholder | Placeholder text | String | "Search..." |
| on_search | Search callback | Option\<EventHandler\<String\>\> | None |
| suggestions | Suggestion list | Vec\<String> | [] |
| allow_clear | Show clear button | bool | true |
| loading | Show loading state | bool | false |
