import { describe, expect, it } from "vitest";

import {
  formatTokenDisplay,
  parseTemplate,
  serializeTemplate,
  templateTokenIndex,
} from "./templateGrammar";

/**
 * templateGrammar contract tests:
 * - splitting: text and whole tokens, adjacent text merged, empty in →
 *   empty out
 * - byte-exact round-trip for every spacing variant (the invariant the
 *   editor's caret mapping leans on)
 * - the conservative boundary: anything that is not `{{ bare_word }}`
 *   stays literal (filters, dotted paths, unterminated braces, braces
 *   around spaces)
 * - helpers: display spelling, vocabulary lookup
 */

describe("parseTemplate", () => {
  it("parses text + tokens", () => {
    expect(parseTemplate("https://x/{{ md5_email }}?s=128")).toEqual([
      { kind: "text", text: "https://x/" },
      { kind: "token", token: "md5_email", raw: "{{ md5_email }}" },
      { kind: "text", text: "?s=128" },
    ]);
  });

  it("merges adjacent text runs and yields [] for empty input", () => {
    expect(parseTemplate("")).toEqual([]);
    expect(parseTemplate("plain")).toEqual([{ kind: "text", text: "plain" }]);
    expect(parseTemplate("a{{ b }}c{{ d }}e")).toEqual([
      { kind: "text", text: "a" },
      { kind: "token", token: "b", raw: "{{ b }}" },
      { kind: "text", text: "c" },
      { kind: "token", token: "d", raw: "{{ d }}" },
      { kind: "text", text: "e" },
    ]);
  });

  it("keeps the raw spelling verbatim (no space normalization)", () => {
    expect(parseTemplate("{{name}}")).toEqual([
      { kind: "token", token: "name", raw: "{{name}}" },
    ]);
    expect(parseTemplate("{{  name  }}")).toEqual([
      { kind: "token", token: "name", raw: "{{  name  }}" },
    ]);
  });

  it("leaves non-identifier interiors as literal text", () => {
    const literals = [
      "{{ name | lower }}", // tera filter
      "{{ user.name }}", // dotted path
      "{{ }}", // empty
      "{{ two words }}", // space inside
      "{{ unclosed", // no closing braces
      "}} lone closer", // no opening braces
    ];
    for (const lit of literals) {
      expect(parseTemplate(lit)).toEqual([{ kind: "text", text: lit }]);
    }
  });

  it("still tokenizes around unterminated braces", () => {
    expect(parseTemplate("{{ a }} {{ b")).toEqual([
      { kind: "token", token: "a", raw: "{{ a }}" },
      { kind: "text", text: " {{ b" },
    ]);
  });
});

describe("serializeTemplate", () => {
  it("round-trips byte-exact", () => {
    const samples = [
      "",
      "plain",
      "{{name}}",
      "{{ md5_email }}?s=128",
      "https://g.com/{{username}}.png?{{ sha256_email }}",
      "{{ a }}{{ b }}{{c}}",
      "{{ filter | pipe }} stays",
    ];
    for (const s of samples) {
      expect(serializeTemplate(parseTemplate(s))).toBe(s);
    }
  });

  it("re-emits raw spellings, not canonical ones", () => {
    const segs = parseTemplate("{{name}}");
    expect(serializeTemplate(segs)).toBe("{{name}}");
  });
});

describe("helpers", () => {
  it("formats the chip display spelling", () => {
    expect(formatTokenDisplay("md5_email")).toBe("{{ md5_email }}");
  });

  it("indexes a vocabulary by name", () => {
    const idx = templateTokenIndex([
      { name: "username", description: "the account name" },
      { name: "md5_email" },
    ]);
    expect(idx.get("username")?.description).toBe("the account name");
    expect(idx.has("md5_email")).toBe(true);
    expect(idx.has("nope")).toBe(false);
  });
});
