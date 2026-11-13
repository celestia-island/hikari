/**
 * Browser locale detection shared across webuis.
 *
 * Order: stored preference → exact navigator.language match → zh region
 * mapping (tw/hk/mo → zh-Hant, else zh-Hans) → base language → fallback.
 */
export function detectLocale(
  supported: readonly string[],
  opts?: { storageKey?: string; storage?: Storage },
): string {
  const storage = opts?.storage ?? (typeof localStorage !== "undefined" ? localStorage : null);
  const key = opts?.storageKey ?? "locale";
  const stored = storage?.getItem(key);
  if (stored && supported.includes(stored)) return stored;

  const raw = (typeof navigator !== "undefined" ? navigator.language : "").toLowerCase().replace(/_/g, "-");
  const direct = supported.find((l) => l.toLowerCase() === raw);
  if (direct) return direct;

  if (raw.startsWith("zh-")) {
    const region = raw.split("-")[1];
    return region === "tw" || region === "hk" || region === "mo" ? "zh-Hant" : "zh-Hans";
  }
  if (raw === "zh") return "zh-Hans";

  const base = raw.split("-")[0];
  return supported.includes(base) ? base : "en";
}
