import { reactive } from "vue";

type Messages = Record<string, string>;

interface LocaleModule {
  default: Record<string, Messages>;
}

// Glob all locale JSON files at build time.
// Files: res/i18n/locales/{lang}/{domain}.json → flat key-value per domain.
// Consumer apps add their own domain files; hikari provides components.json.
const localeModules = import.meta.glob<LocaleModule>(
  "./locales/**/*.json",
  { eager: true },
);

function buildLocaleMessages(locale: string): Messages {
  const prefix = `./locales/${locale}/`;
  const merged: Messages = {};

  for (const [path, mod] of Object.entries(localeModules)) {
    if (!path.startsWith(prefix)) continue;
    const domain = mod.default;
    for (const [_section, keys] of Object.entries(domain)) {
      if (typeof keys === "object" && keys !== null) {
        flatten(keys, "", merged);
      }
    }
  }

  return merged;
}

function flatten(obj: Record<string, unknown>, parentKey: string, out: Messages) {
  for (const [k, v] of Object.entries(obj)) {
    const fullKey = parentKey ? `${parentKey}.${k}` : k;
    if (typeof v === "object" && v !== null && !Array.isArray(v)) {
      flatten(v as Record<string, unknown>, fullKey, out);
    } else if (typeof v === "string") {
      out[fullKey] = v;
    }
  }
}

// Pre-load en as the default fallback
const enFallback: Messages = buildLocaleMessages("en");

const state = reactive({
  locale: "en",
  messages: { ...enFallback } as Messages,
});

const localeCache = new Map<string, Messages>();
localeCache.set("en", enFallback);

export async function setHikariLocale(locale: string): Promise<void> {
  if (!localeCache.has(locale)) {
    localeCache.set(locale, buildLocaleMessages(locale));
  }
  state.locale = locale;
  state.messages = { ...enFallback, ...localeCache.get(locale)! };
}

export function mergeHikariMessages(userMessages: Messages): void {
  state.messages = { ...state.messages, ...userMessages };
}

export function useHikariI18n() {
  function t(key: string, fallback?: string): string {
    return (
      state.messages[key] ??
      enFallback[key] ??
      fallback ??
      key
    );
  }

  return { t, locale: state.locale };
}
