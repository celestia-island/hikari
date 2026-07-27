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

// Merged-in messages survive locale switches (plana, apps register here).
// Stored per-locale so layer-2 components can register translations for
// every language without knowing which locale is currently active.
let mergedMessages: Record<string, Messages> = {};

export async function setLocale(locale: string): Promise<void> {
  if (!localeCache.has(locale)) {
    localeCache.set(locale, buildLocaleMessages(locale));
  }
  state.locale = locale;
  state.messages = {
    ...enFallback,
    ...localeCache.get(locale)!,
    ...(mergedMessages["en"] ?? {}),
    ...(mergedMessages[locale] ?? {}),
  };
}

export function mergeMessages(userMessages: Messages, locale?: string): void {
  if (locale) {
    mergedMessages[locale] = { ...(mergedMessages[locale] ?? {}), ...userMessages };
  } else {
    // Backward-compatible: no locale = merge into every locale bucket
    for (const loc of Object.keys(mergedMessages)) {
      mergedMessages[loc] = { ...mergedMessages[loc], ...userMessages };
    }
    // Also set for current locale
    mergedMessages[state.locale] = { ...(mergedMessages[state.locale] ?? {}), ...userMessages };
  }
  state.messages = {
    ...enFallback,
    ...(localeCache.get(state.locale) ?? {}),
    ...(mergedMessages["en"] ?? {}),
    ...(mergedMessages[state.locale] ?? {}),
  };
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
