/**
 * Country dial-code dictionary for phone inputs (SMS enrollment, contact
 * forms, …). Deliberately NOT part of the locale JSON: it is a data
 * catalog, not copy — locale JSON files stay small and this table stays
 * machine-queryable.
 *
 * Every entry carries an ISO 3166-1 alpha-2 code (lowercase) plus
 * localized country names in English and Simplified Chinese. The flag is
 * derived from the ISO code at render time (`flagEmoji`), so the table
 * never carries hand-typed emoji that can silently rot.
 */

export interface DialCodeEntry {
  /** ISO 3166-1 alpha-2 country code, lowercase (e.g. "cn"). */
  iso: string;
  /** National dial code WITHOUT the leading "+" (e.g. "86"). */
  dial: string;
  /** English country name (index + fallback). */
  en: string;
  /** Simplified Chinese country name. */
  zh: string;
  /** Search-only Chinese alias — never rendered as the display name.
   *  HkPhoneInput folds it into the popup's keyword haystack so the old
   *  short form still finds the entry after a formal rename (e.g. the
   *  PRC row renamed to 中华人民共和国 no longer contains 中国 as a
   *  substring). */
  zhAlias?: string;
}

/** Flag glyph for an ISO 3166-1 alpha-2 code (regional indicators). */
export function flagEmoji(iso: string): string {
  const upper = iso.toUpperCase();
  if (!/^[A-Z]{2}$/.test(upper)) return "";
  return String.fromCodePoint(
    ...Array.from(upper, (c) => 0x1f1e6 + c.charCodeAt(0) - 65),
  );
}

/** Localized country name: zh locales read the zh field, everything else
 *  falls back to English (the dictionary ships en + zh only). */
export function dialCodeName(entry: DialCodeEntry, locale: string): string {
  return locale.toLowerCase().startsWith("zh") ? entry.zh : entry.en;
}

/**
 * Ordered catalog. China first (the primary audience of the workspace),
 * then Asia-Pacific neighbors, then the rest of the world. Order also
 * drives parse ambiguity resolution (first match wins for shared dial
 * prefixes like +1 / +7).
 */
export const DIAL_CODES: readonly DialCodeEntry[] = [
  { iso: "cn", dial: "86", en: "China", zh: "中华人民共和国", zhAlias: "中国" },
  { iso: "hk", dial: "852", en: "Hong Kong (China)", zh: "中国香港" },
  { iso: "mo", dial: "853", en: "Macau (China)", zh: "中国澳门" },
  { iso: "tw", dial: "886", en: "Taiwan (China)", zh: "中国台湾" },
  { iso: "jp", dial: "81", en: "Japan", zh: "日本" },
  { iso: "kr", dial: "82", en: "South Korea", zh: "韩国" },
  { iso: "sg", dial: "65", en: "Singapore", zh: "新加坡" },
  { iso: "my", dial: "60", en: "Malaysia", zh: "马来西亚" },
  { iso: "th", dial: "66", en: "Thailand", zh: "泰国" },
  { iso: "vn", dial: "84", en: "Vietnam", zh: "越南" },
  { iso: "ph", dial: "63", en: "Philippines", zh: "菲律宾" },
  { iso: "id", dial: "62", en: "Indonesia", zh: "印度尼西亚" },
  { iso: "in", dial: "91", en: "India", zh: "印度" },
  { iso: "pk", dial: "92", en: "Pakistan", zh: "巴基斯坦" },
  { iso: "bd", dial: "880", en: "Bangladesh", zh: "孟加拉国" },
  { iso: "lk", dial: "94", en: "Sri Lanka", zh: "斯里兰卡" },
  { iso: "np", dial: "977", en: "Nepal", zh: "尼泊尔" },
  { iso: "kh", dial: "855", en: "Cambodia", zh: "柬埔寨" },
  { iso: "la", dial: "856", en: "Laos", zh: "老挝" },
  { iso: "mm", dial: "95", en: "Myanmar", zh: "缅甸" },
  { iso: "bn", dial: "673", en: "Brunei", zh: "文莱" },
  { iso: "mn", dial: "976", en: "Mongolia", zh: "蒙古" },
  { iso: "us", dial: "1", en: "United States", zh: "美国" },
  { iso: "ca", dial: "1", en: "Canada", zh: "加拿大" },
  { iso: "gb", dial: "44", en: "United Kingdom", zh: "英国" },
  { iso: "de", dial: "49", en: "Germany", zh: "德国" },
  { iso: "fr", dial: "33", en: "France", zh: "法国" },
  { iso: "it", dial: "39", en: "Italy", zh: "意大利" },
  { iso: "es", dial: "34", en: "Spain", zh: "西班牙" },
  { iso: "pt", dial: "351", en: "Portugal", zh: "葡萄牙" },
  { iso: "nl", dial: "31", en: "Netherlands", zh: "荷兰" },
  { iso: "be", dial: "32", en: "Belgium", zh: "比利时" },
  { iso: "ch", dial: "41", en: "Switzerland", zh: "瑞士" },
  { iso: "at", dial: "43", en: "Austria", zh: "奥地利" },
  { iso: "ie", dial: "353", en: "Ireland", zh: "爱尔兰" },
  { iso: "se", dial: "46", en: "Sweden", zh: "瑞典" },
  { iso: "no", dial: "47", en: "Norway", zh: "挪威" },
  { iso: "dk", dial: "45", en: "Denmark", zh: "丹麦" },
  { iso: "fi", dial: "358", en: "Finland", zh: "芬兰" },
  { iso: "is", dial: "354", en: "Iceland", zh: "冰岛" },
  { iso: "pl", dial: "48", en: "Poland", zh: "波兰" },
  { iso: "cz", dial: "420", en: "Czechia", zh: "捷克" },
  { iso: "sk", dial: "421", en: "Slovakia", zh: "斯洛伐克" },
  { iso: "hu", dial: "36", en: "Hungary", zh: "匈牙利" },
  { iso: "ro", dial: "40", en: "Romania", zh: "罗马尼亚" },
  { iso: "bg", dial: "359", en: "Bulgaria", zh: "保加利亚" },
  { iso: "gr", dial: "30", en: "Greece", zh: "希腊" },
  { iso: "hr", dial: "385", en: "Croatia", zh: "克罗地亚" },
  { iso: "rs", dial: "381", en: "Serbia", zh: "塞尔维亚" },
  { iso: "ua", dial: "380", en: "Ukraine", zh: "乌克兰" },
  { iso: "ru", dial: "7", en: "Russia", zh: "俄罗斯" },
  { iso: "kz", dial: "7", en: "Kazakhstan", zh: "哈萨克斯坦" },
  { iso: "tr", dial: "90", en: "Türkiye", zh: "土耳其" },
  { iso: "il", dial: "972", en: "Israel", zh: "以色列" },
  { iso: "ae", dial: "971", en: "United Arab Emirates", zh: "阿联酋" },
  { iso: "sa", dial: "966", en: "Saudi Arabia", zh: "沙特阿拉伯" },
  { iso: "qa", dial: "974", en: "Qatar", zh: "卡塔尔" },
  { iso: "kw", dial: "965", en: "Kuwait", zh: "科威特" },
  { iso: "bh", dial: "973", en: "Bahrain", zh: "巴林" },
  { iso: "om", dial: "968", en: "Oman", zh: "阿曼" },
  { iso: "jo", dial: "962", en: "Jordan", zh: "约旦" },
  { iso: "lb", dial: "961", en: "Lebanon", zh: "黎巴嫩" },
  { iso: "iq", dial: "964", en: "Iraq", zh: "伊拉克" },
  { iso: "ir", dial: "98", en: "Iran", zh: "伊朗" },
  { iso: "af", dial: "93", en: "Afghanistan", zh: "阿富汗" },
  { iso: "ge", dial: "995", en: "Georgia", zh: "格鲁吉亚" },
  { iso: "am", dial: "374", en: "Armenia", zh: "亚美尼亚" },
  { iso: "az", dial: "994", en: "Azerbaijan", zh: "阿塞拜疆" },
  { iso: "uz", dial: "998", en: "Uzbekistan", zh: "乌兹别克斯坦" },
  { iso: "eg", dial: "20", en: "Egypt", zh: "埃及" },
  { iso: "ma", dial: "212", en: "Morocco", zh: "摩洛哥" },
  { iso: "dz", dial: "213", en: "Algeria", zh: "阿尔及利亚" },
  { iso: "tn", dial: "216", en: "Tunisia", zh: "突尼斯" },
  { iso: "ng", dial: "234", en: "Nigeria", zh: "尼日利亚" },
  { iso: "ke", dial: "254", en: "Kenya", zh: "肯尼亚" },
  { iso: "et", dial: "251", en: "Ethiopia", zh: "埃塞俄比亚" },
  { iso: "tz", dial: "255", en: "Tanzania", zh: "坦桑尼亚" },
  { iso: "za", dial: "27", en: "South Africa", zh: "南非" },
  { iso: "gh", dial: "233", en: "Ghana", zh: "加纳" },
  { iso: "br", dial: "55", en: "Brazil", zh: "巴西" },
  { iso: "mx", dial: "52", en: "Mexico", zh: "墨西哥" },
  { iso: "ar", dial: "54", en: "Argentina", zh: "阿根廷" },
  { iso: "cl", dial: "56", en: "Chile", zh: "智利" },
  { iso: "co", dial: "57", en: "Colombia", zh: "哥伦比亚" },
  { iso: "pe", dial: "51", en: "Peru", zh: "秘鲁" },
  { iso: "ve", dial: "58", en: "Venezuela", zh: "委内瑞拉" },
  { iso: "uy", dial: "598", en: "Uruguay", zh: "乌拉圭" },
  { iso: "ec", dial: "593", en: "Ecuador", zh: "厄瓜多尔" },
  { iso: "au", dial: "61", en: "Australia", zh: "澳大利亚" },
  { iso: "nz", dial: "64", en: "New Zealand", zh: "新西兰" },
  { iso: "fj", dial: "679", en: "Fiji", zh: "斐济" },
];

/** Normalize a dial-code input ("86", "+86", "0086") to bare digits. */
export function normalizeDial(dial: string): string {
  return dial.replace(/^\+/, "").replace(/^00/, "").replace(/\D/g, "");
}

/** Strip every non-digit from a national number (keeps leading zeros
 *  where a country genuinely needs them, e.g. Italy). */
export function normalizeNational(national: string): string {
  return national.replace(/\D/g, "");
}

/** Find a catalog entry by lowercase ISO code. */
export function entryByIso(iso: string, list: readonly DialCodeEntry[] = DIAL_CODES) {
  return list.find((c) => c.iso === iso.toLowerCase());
}

/** Find the first catalog entry matching a dial code (order = priority
 *  for shared prefixes like +1 / +7). */
export function entryByDial(dial: string, list: readonly DialCodeEntry[] = DIAL_CODES) {
  const bare = normalizeDial(dial);
  return list.find((c) => c.dial === bare);
}

/** Resolve an entry from an ISO code OR dial code (dial wins when the
 *  caller only knows the number). */
export function entryByDialCode(
  isoOrDial: string,
  list: readonly DialCodeEntry[] = DIAL_CODES,
) {
  return entryByIso(isoOrDial, list) ?? entryByDial(isoOrDial, list);
}

/** Resolve an entry from a dial-code string in any shape ("+86" → CN). */
export function resolveDial(
  dial: string,
  isoHint?: string,
  list: readonly DialCodeEntry[] = DIAL_CODES,
): DialCodeEntry | undefined {
  const bare = normalizeDial(dial);
  if (!bare) return undefined;
  if (isoHint) {
    const byIso = entryByIso(isoHint, list);
    if (byIso && byIso.dial === bare) return byIso;
  }
  return list.find((c) => c.dial === bare);
}

/**
 * Compose an E.164 number: national digits plus the selected dial code.
 * Handles a national number that already carries a trunk prefix ("0…")
 * only where the dial code demands it (kept simple: leading "0" is
 * dropped for every country — trunk prefixes are caller territory).
 *
 * @returns full E.164 string ("+8613812345678") or "" when empty.
 */
export function formatE164(
  dialCode: string,
  national: string,
  list: readonly DialCodeEntry[] = DIAL_CODES,
): string {
  const bare = normalizeDial(dialCode);
  if (!bare) return "";
  const digits = normalizeNational(national);
  if (!digits) return "";
  return `+${bare}${digits}`;
}

export interface ParsedE164 {
  /** Bare dial digits (e.g. "86"), or "" when nothing parses. */
  dial: string;
  /** National digits after the dial code (e.g. "13812345678"). */
  national: string;
  /** Best-guess country (first catalog entry matching the dial). */
  iso?: string;
}

/** Split an E.164 string ("+8613812345678") into dial code + national
 *  digits. Longest dial prefix wins (so "+1" keeps US/CA whole). */
export function parseE164(
  e164: string,
  list: readonly DialCodeEntry[] = DIAL_CODES,
): ParsedE164 {
  const digits = e164.replace(/^\+/, "").replace(/\D/g, "");
  if (!digits) return { dial: "", national: "" };
  const byLength = [...list]
    .filter((c) => digits.startsWith(c.dial))
    .sort((a, b) => b.dial.length - a.dial.length);
  const best = byLength[0];
  if (!best) return { dial: "", national: digits };
  return {
    dial: best.dial,
    national: digits.slice(best.dial.length),
    iso: best.iso,
  };
}
