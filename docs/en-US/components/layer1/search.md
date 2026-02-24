# Search

Search component for search input.

## Basic Usage

```_hikari_component
pages/components/layer1/search#basic
```

## Voice Input

Supports voice input functionality. Click the microphone icon to start recording.

```_hikari_component
pages/components/layer1/search#voice
```

## API

| Property | Description | Type | Default |
|----------|-------------|------|---------|
| placeholder | Placeholder text | String | "Search..." |
| on_search | Search callback | Option\<EventHandler\<String\>\> | None |
| voice_input | Enable voice input | bool | false |
