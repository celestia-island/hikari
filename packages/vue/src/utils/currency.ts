// AI-generated: developed with the DeepSeek Harness agent (model DeepSeek V4.1 Flash); human-directed.
/**
 * Money/currency primitives shared by the money-aware components
 * (HkMoneyInput, HkCurrencySelect, HkPrice) and available to hosts that
 * need the same canonical text contract without mounting a control.
 *
 * The whole family speaks ONE text form: the **canonical decimal text** —
 * ASCII digits, at most one `.` decimal separator, no grouping separator,
 * no currency symbol, no exponent (`"12"`, `"1.5"`, `"-0.25"`, `""` for
 * "unset"). A `modelValue` prop of `HkMoneyInput` and the `update:modelValue`
 * it emits are both canonical text; display formatting (grouping, fixed
 * precision, symbol) is a *rendering* concern that never leaks back into the
 * model. That split is what keeps a controlled amount field from rewriting
 * the DOM under the typist.
 *
 * `formatMoney` is deliberately locale-INDEPENDENT: grouping is `,` every
 * three integer digits and the decimal separator is `.`, so a formatted
 * string round-trips through `parseMoney` in every locale and a display
 * value can never be confused with a different number by the next parse.
 * Locale-sensitivity belongs to `currencyDisplayName` (the human name of a
 * code) — not to the digits, which a money field must keep unambiguous
 * (Arabic-Indic digits and `٬` / `٫` separators in an input would be
 * untypeable from a decimal keypad and unparseable by the same field).
 */

/** Hard ceiling for the fractional digit budget. Real currencies top out at
 *  3 (KWD / BHD / JOD); the headroom exists for per-million rates and
 *  fractional-cent prices, and the cap keeps `toFixed` and the rounding
 *  digit-string walk bounded. */
const MAX_DECIMALS = 8;

/** A currency as the hikari money family understands it: an ISO-4217-style
 *  code plus the minor-unit digit count that dictates the default display
 *  precision. `symbol` / `name` are presentation hints — omit them and the
 *  component falls back to the code itself (symbol) and
 *  {@link currencyDisplayName} (name). */
export interface HkCurrency {
  /** ISO-4217-style code, e.g. `"USD"`. Held upper-case by normalization. */
  code: string;
  /** Glyph rendered beside the amount, e.g. `"$"`, `"¥"`, `"€"`. */
  symbol?: string;
  /** Host-provided display name. Resolved before the Intl lookup. */
  name?: string;
  /** Minor-unit digits: 2 for USD, 0 for JPY, 3 for KWD. */
  decimals: number;
}

/** Options for {@link formatMoney}. */
export interface HkMoneyFormatOptions {
  /** Fraction digits to render. Defaults to `currency.decimals`; pass a
   *  larger number for rates (a per-million price may want 4–6) and a
   *  smaller one for compact summaries. Clamped to 0..8. */
  precision?: number;
  /** Thousands grouping. Defaults to `true`; pass `false` for a copyable,
   *  separator-free rendering. */
  grouping?: boolean;
}

/** Clamp an arbitrary numeric budget into the supported digit range. */
function clampDecimals(value: number | undefined, fallback: number): number {
  const raw = typeof value === "number" && Number.isFinite(value) ? Math.trunc(value) : fallback;
  if (!Number.isFinite(raw)) return fallback;
  if (raw < 0) return 0;
  if (raw > MAX_DECIMALS) return MAX_DECIMALS;
  return raw;
}

/** `1234567` -> `"1,234,567"`; non-digit input (a leading sign already
 *  stripped by the caller) passes through untouched. */
function groupDigits(digits: string): string {
  if (digits.length <= 3) return digits;
  let out = "";
  let run = "";
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    run = digits[i] + run;
    if (run.length === 3) {
      out = out === "" ? run : `${run},${out}`;
      run = "";
    }
  }
  return run === "" ? out : `${run},${out}`;
}

/** Digits-only increment with carry — the rounding step of
 *  {@link parseMoney}, kept on the digit string so `0.1 + 0.2`-style
 *  binary dust never decides where a money boundary lands. */
function incrementDigits(digits: string): string {
  const out = digits.split("");
  for (let i = out.length - 1; i >= 0; i -= 1) {
    if (out[i] !== "9") {
      out[i] = String(Number(out[i]) + 1);
      return out.join("");
    }
    out[i] = "0";
  }
  return `1${out.join("")}`;
}

/** Render `amount` as a money string with the currency's minor-unit digits
 *  (or an explicit `precision`) — grouping optional, no symbol, no code.
 *
 *  Symbol placement is the caller's (a locale-correct placement differs by
 *  currency and region), which is why this helper emits the NUMBER only:
 *  `formatMoney` output is safe to parse back and safe to render inside an
 *  input whose symbol is a fixed affix.
 *
 *  Non-finite input (NaN / ±Infinity) renders `""` — callers show their own
 *  "not set" affordance (HkPrice's calm em dash) instead of `NaN`. A value
 *  that rounds to zero drops the sign, so `-0.001` at 2 digits reads `0.00`,
 *  never `-0.00`. */
export function formatMoney(
  amount: number,
  currency: HkCurrency,
  opts: HkMoneyFormatOptions = {},
): string {
  if (typeof amount !== "number" || !Number.isFinite(amount)) return "";
  const normalized = normalizeCurrency(currency);
  const precision = clampDecimals(opts.precision, normalized.decimals);
  const fixed = Math.abs(amount).toFixed(precision);
  const [intPart, fracPart = ""] = fixed.split(".");
  const body = opts.grouping === false ? intPart : groupDigits(intPart);
  const text = fracPart === "" ? body : `${body}.${fracPart}`;
  // Sign AFTER rounding: a value that collapses to zero must not read as
  // a negative amount.
  const negative = amount < 0 && Number(fixed) !== 0;
  return negative ? `-${text}` : text;
}

/** Render `amount` in the canonical model text form: ASCII digits, at most
 *  one `.`, no grouping, no symbol, trailing zeros trimmed (`1.5`, `12`,
 *  `0`), `""` for non-finite input.
 *
 *  This is the inverse of {@link parseMoney} for the editable surface: the
 *  value a money field hands back is exactly this string, so a host can
 *  compare model versions without normalizing first. */
export function canonicalMoneyText(amount: number, maxDecimals = 2): string {
  if (typeof amount !== "number" || !Number.isFinite(amount)) return "";
  const decimals = clampDecimals(maxDecimals, 2);
  let text = Math.abs(amount).toFixed(decimals);
  if (text.includes(".")) text = text.replace(/0+$/, "").replace(/\.$/, "");
  if (text === "") text = "0";
  const negative = amount < 0 && Number(text) !== 0;
  return negative ? `-${text}` : text;
}

/** Arabic-Indic (`٠١٢…`) and extended Arabic-Indic (`۰۱۲…`) digits, plus the
 *  Arabic thousands (`٬`) and decimal (`٫`) separators — mapped to their
 *  ASCII equivalents before parsing so a numeric keypad's locale output is
 *  understood instead of silently rejected. */
const EASTERN_DIGITS = /[\u0660-\u0669\u06F0-\u06F9]/g;
const ARABIC_SEPARATORS = /[\u066C\u066B]/g;
const MINUS_VARIANTS = /[\u2212\u2010\u2011]/g;

function asciiDigits(raw: string): string {
  return raw
    .replace(MINUS_VARIANTS, "-")
    .replace(ARABIC_SEPARATORS, (ch) => (ch === "\u066B" ? "." : ","))
    .replace(EASTERN_DIGITS, (ch) => {
      const code = ch.charCodeAt(0);
      const base = code >= 0x06f0 ? 0x06f0 : 0x0660;
      return String(code - base);
    });
}

/** Decide which separator is the decimal point in a typed money draft.
 *
 *  Money entry is the one place where `,` and `.` both legitimately appear
 *  as either grouping marks or the decimal mark (a US typist's `1,234.50`
 *  and a German typist's `1.234,50` are the same number). The rules, in
 *  order:
 *
 *  1. Both separator kinds present → the RIGHTMOST one is the decimal mark
 *     (`1,234.50` and `1.234,50` both resolve), and it may only appear once.
 *  2. One kind present, several occurrences → grouping, provided every
 *     3-digit tail group and the leading 1–3 digit group are well formed
 *     (`1.234.567`); anything else is invalid rather than silently guessed.
 *  3. One kind present, one occurrence → decimal (`.5`, `1.5`, `12.345`),
 *     EXCEPT the one case a decimal reading cannot explain: a `,` with a
 *     3-digit tail while the fraction budget is below 3 digits (`1,234` in a
 *     2-digit currency is twelve hundred, never 1.234). This uses the
 *     caller's `maxDecimals` — the information a bare string cannot carry —
 *     and applies only to the `,` mark, because `.` is the canonical
 *     separator and a 3-digit `.` tail is a genuine 3-digit fraction.
 *
 *  A leading zero is never a grouping group, so `0.123` always reads as a
 *  fraction. */
function resolveSeparators(
  text: string,
  maxDecimals: number,
): { whole: string; fraction: string } | null {
  const dots = text.split(".").length - 1;
  const commas = text.split(",").length - 1;
  if (dots === 0 && commas === 0) {
    return /^\d+$/.test(text) ? { whole: text, fraction: "" } : null;
  }
  let decimalAt: number;
  if (dots > 0 && commas > 0) {
    const lastDot = text.lastIndexOf(".");
    const lastComma = text.lastIndexOf(",");
    decimalAt = Math.max(lastDot, lastComma);
    const decimalChar = text[decimalAt];
    if (text.split(decimalChar).length - 1 > 1) return null;
    if (decimalAt < text.length - 1 && !/^\d+$/.test(text.slice(decimalAt + 1))) return null;
  } else {
    const separator = dots > 0 ? "." : ",";
    const parts = text.split(separator);
    const head = parts[0];
    const tails = parts.slice(1);
    const count = tails.length;
    const groupingTail = tails.every((part) => /^\d{3}$/.test(part));
    const groupingHead = /^[1-9]\d{0,2}$/.test(head);
    if (count > 1) {
      if (!groupingHead || !groupingTail) return null;
      decimalAt = -1;
    } else if (separator === "," && groupingHead && groupingTail && maxDecimals < 3) {
      decimalAt = -1;
    } else {
      decimalAt = text.indexOf(separator);
    }
  }
  const wholeRaw = decimalAt < 0 ? text.replace(/[.,]/g, "") : text.slice(0, decimalAt).replace(/[.,]/g, "");
  const fractionRaw = decimalAt < 0 ? "" : text.slice(decimalAt + 1).replace(/[.,]/g, "");
  if (!/^\d*$/.test(wholeRaw) || !/^\d*$/.test(fractionRaw)) return null;
  if (wholeRaw === "" && fractionRaw === "") return null;
  return { whole: wholeRaw === "" ? "0" : wholeRaw, fraction: fractionRaw };
}

/** Parse a typed/displayed money draft into a number, tolerating the forms a
 *  real field receives: a leading currency symbol or code (`$1,234.50`,
 *  `USD 1.50`), grouping separators, a `,` decimal mark (`1,5`), a full-width
 *  or Arabic-Indic digit run, and an optional sign.
 *
 *  `maxDecimals` is the fraction budget: digits beyond it are ROUNDED
 *  half-up on the digit string (never binary-float rounded), so
 *  `parseMoney("1.005", 2)` is `1.01` and `parseMoney("1.999", 2)` is `2`.
 *  The draft text itself is never rewritten — that is the input's call on
 *  blur.
 *
 *  Returns `null` for anything that is not a money number (letters, a bare
 *  separator, an empty string), so a caller can distinguish "unset" (`""`)
 *  from "invalid" (`null`). */
export function parseMoney(raw: string, maxDecimals: number): number | null {
  if (typeof raw !== "string") return null;
  const decimals = clampDecimals(maxDecimals, 2);
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  // Currency decoration rides the edges (`$1,234.50`, `USD 1.50`,
  // `1,234.50 EUR`): a leading symbol run and a whitespace-separated
  // trailing/leading CODE are stripped BEFORE the letter guard, so a real
  // money string parses while `12abc` and `1e3` still fail it (no
  // whitespace, so the decoration strip never reaches them).
  const text = asciiDigits(trimmed)
    .replace(/^[^0-9A-Za-z+\-.,]*/, "")
    .replace(/^[A-Za-z]+\s+/, "")
    .replace(/\s+[A-Za-z][A-Za-z0-9]*$/, "");
  // ASCII letters are never part of a number ("1e3" must not parse as 13).
  if (/[A-Za-z]/.test(text)) return null;
  let body = text.replace(/[^0-9.,+\-\s]/g, "").replace(/\s+/g, "");
  let negative = false;
  if (body.startsWith("-") || body.startsWith("+")) {
    negative = body.startsWith("-");
    body = body.slice(1);
  }
  if (body === "" || body === "." || body === ",") return null;
  const split = resolveSeparators(body, decimals);
  if (split === null) return null;
  let whole = split.whole;
  let fraction = split.fraction;
  if (fraction.length > decimals) {
    const keep = fraction.slice(0, decimals);
    const roundUp = fraction.charCodeAt(decimals) >= 53; // "5"
    const digits = keep === "" ? whole : `${whole}${keep}`;
    const rounded = roundUp ? incrementDigits(digits) : digits;
    const tail = rounded.slice(Math.max(rounded.length - keep.length, 0));
    whole = rounded.length - tail.length === 0 ? "0" : rounded.slice(0, rounded.length - tail.length);
    fraction = tail;
  }
  const numericText = fraction === "" ? whole : `${whole}.${fraction}`;
  const value = Number(numericText);
  if (!Number.isFinite(value)) return null;
  return negative && value !== 0 ? -value : value;
}

/** The glyph a component should render beside an amount: the currency's own
 *  `symbol`, else its (upper-case) code — never an empty string. */
export function currencySymbol(currency: HkCurrency): string {
  const normalized = normalizeCurrency(currency);
  return normalized.symbol ?? normalized.code;
}

/** Normalize a currency descriptor into its canonical shape without
 *  mutating the caller's object: code trimmed + upper-cased, `decimals`
 *  forced to an integer in 0..8, empty `symbol` / `name` dropped (so a
 *  blank hint never renders as a blank glyph).
 *
 *  Tolerates a missing/partial object so a host's half-filled settings row
 *  renders as a sane placeholder instead of throwing during setup. */
export function normalizeCurrency(
  currency: Partial<HkCurrency> | null | undefined,
): HkCurrency {
  const source = currency ?? {};
  const code = String(source.code ?? "").trim().toUpperCase();
  const symbol = typeof source.symbol === "string" ? source.symbol.trim() : "";
  const name = typeof source.name === "string" ? source.name.trim() : "";
  const out: HkCurrency = {
    code,
    decimals: clampDecimals(source.decimals, 2),
  };
  if (symbol !== "") out.symbol = symbol;
  if (name !== "") out.name = name;
  return out;
}

/** Structural guard for an externally supplied currency: a code that looks
 *  like a currency identifier (2–12 ASCII letters/digits, starting with a
 *  letter — ISO-4217 is 3, `USDT` / `XAUT` are real 4- and 5-letter codes)
 *  and a well-formed minor-unit count. Extra properties are ignored, so a
 *  host model row validates without a cast. */
export function isValidCurrency(value: unknown): value is HkCurrency {
  if (value === null || typeof value !== "object") return false;
  const candidate = value as Partial<HkCurrency>;
  if (typeof candidate.code !== "string") return false;
  const code = candidate.code.trim().toUpperCase();
  if (!/^[A-Z][A-Z0-9]{1,11}$/.test(code)) return false;
  if (typeof candidate.decimals !== "number" || !Number.isInteger(candidate.decimals)) return false;
  if (candidate.decimals < 0 || candidate.decimals > MAX_DECIMALS) return false;
  if (candidate.symbol !== undefined && typeof candidate.symbol !== "string") return false;
  if (candidate.name !== undefined && typeof candidate.name !== "string") return false;
  return true;
}

/** Localized human name of a currency code, resolving in a fixed order:
 *  `Intl.DisplayNames` → the caller's `fallback` → the upper-cased code.
 *
 *  Both `Intl.DisplayNames`-missing (older engines) and an invalid locale
 *  (a RangeError from the constructor) fall through to the fallback instead
 *  of throwing inside a render. `fallback: "none"` makes an unknown code
 *  return `undefined` rather than the code itself, which is what lets the
 *  caller's own fallback (usually the host-provided `HkCurrency.name`) win
 *  over a pointless echo of the code. */
export function currencyDisplayName(code: string, locale: string, fallback?: string): string {
  const upper = String(code ?? "").trim().toUpperCase();
  const own = typeof fallback === "string" && fallback.trim() !== "" ? fallback.trim() : "";
  if (upper === "") return own;
  try {
    const DisplayNames = (Intl as unknown as { DisplayNames?: typeof Intl.DisplayNames })
      .DisplayNames;
    if (typeof DisplayNames === "function") {
      const names = new DisplayNames([locale || "en"], {
        type: "currency",
        fallback: "none",
      });
      const resolved = names.of(upper);
      if (typeof resolved === "string" && resolved !== "") return resolved;
    }
  } catch {
    // Unknown locale, malformed ICU tag, or an engine without the API:
    // the fallback chain below is the whole contract.
  }
  return own !== "" ? own : upper;
}
