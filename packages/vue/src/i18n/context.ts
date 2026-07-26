import { reactive } from "vue";

type Messages = Record<string, string>;

interface LocaleModule {
  default: Record<string, Messages>;
}

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
        Object.assign(merged, keys);
      }
    }
  }

  return merged;
}

const enFallback: Messages = buildLocaleMessages("en");

const state = reactive({
  locale: "en",
  messages: { ...enFallback } as Messages,
});

const localeCache = new Map<string, Messages>();
localeCache.set("en", enFallback);

export async function setLocale(locale: string): Promise<void> {
  if (!localeCache.has(locale)) {
    localeCache.set(locale, buildLocaleMessages(locale));
  }
  state.locale = locale;
  state.messages = { ...enFallback, ...localeCache.get(locale)! };
}

export function mergeMessages(userMessages: Messages): void {
  state.messages = { ...state.messages, ...userMessages };
}

export function useI18n() {
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
