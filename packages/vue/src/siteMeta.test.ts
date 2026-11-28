import { describe, expect, it, vi } from "vitest";

import {
  BEIAN_TAG_ID,
  GA_TAG_ID,
  isValidGaMeasurementId,
  parseBeianLines,
  readBeianLines,
  readGaMeasurementId,
  readSiteMeta,
} from "./siteMeta";

// MUT:site-meta-ga-tag-id — renaming the boot-tag id would silently detach
// the reader from both hosts' injected `<script id>` (erp core main.rs and
// chest static_files.rs both emit this exact id).
describe("GA_TAG_ID", () => {
  it("is the boot tag id both hosts inject", () => {
    expect(GA_TAG_ID).toBe("celestia-ga-measurement-id");
  });
});

// MUT:site-meta-ga-id-shape — the validator mirrors chest
// packages/chest-app/src/static_files.rs: `G-` + 1..=32 uppercase
// alphanumerics; loosening any branch lets a hostile id reach served HTML.
describe("isValidGaMeasurementId truth table", () => {
  it.each([
    ["G-A1B2C3", true],
    ["G-" + "A".repeat(32), true], // at the upper cap
    ["G-" + "A".repeat(33), false], // over the cap
    ["A1B2C3", false], // missing G- prefix
    ["g-abc", false], // lowercase prefix
    ["G-abc", false], // lowercase body
    ["G-", false], // empty body
    ["", false],
    ["G-AB C", false], // whitespace is not alphanumeric
  ])("isValidGaMeasurementId(%j) === %j", (raw, expected) => {
    expect(isValidGaMeasurementId(raw)).toBe(expected);
  });
});

function docWithBootTag(content: string | null): Document {
  const doc = document.implementation.createHTMLDocument("");
  if (content !== null) {
    const tag = doc.createElement("script");
    tag.id = GA_TAG_ID;
    tag.type = "application/json";
    tag.textContent = content;
    doc.head.appendChild(tag);
  }
  return doc;
}

// MUT:site-meta-ga-read-branches — every failure mode must resolve to null
// ("tracking disabled") rather than throwing or returning a malformed id;
// the placeholder branches pin the shared envsubst-leftover convention.
describe("readGaMeasurementId boot-tag branches", () => {
  it("reads a well-formed id, trimming surrounding whitespace", () => {
    expect(readGaMeasurementId(docWithBootTag("  G-TESTID01  \n"))).toBe("G-TESTID01");
  });

  it("returns null when the tag is absent", () => {
    expect(readGaMeasurementId(docWithBootTag(null))).toBeNull();
  });

  // MUT:site-meta-beian-codepoints — the 64 limit is CODE POINTS (Rust
  // chars().count() in erp), not UTF-16 units: astral characters must count
  // as one. A `.length`-based mutation reddens the first assertion here.
  it("counts astral code points, not UTF-16 units, against the 64 limit", () => {
    const fortyAstral = "😀".repeat(40); // 40 code points / 80 UTF-16 units
    expect(parseBeianLines(JSON.stringify([{ title: fortyAstral }]))).toHaveLength(1);
    // 65 astral code points are over the limit — and a `.length`-based
    // implementation would see 130 UTF-16 units and keep the line, so this
    // is the mutation-sensitive half.
    const sixtyFiveAstral = "😀".repeat(65);
    expect(parseBeianLines(JSON.stringify([{ title: sixtyFiveAstral }]))).toHaveLength(0);
  });

  // MUT:site-meta-beian-https-case — the protocol check is case-sensitive by
  // alignment with erp (`HTTPS://` is NOT a valid url → the entry is DROPPED,
  // not downgraded to plain text). A `.toLowerCase()`-style normalization
  // mutation would keep the entry and redden this.
  it("drops entries whose url uses an uppercase-scheme form", () => {
    expect(
      parseBeianLines(JSON.stringify([{ title: "x", url: "HTTPS://beian.example" }]))
    ).toHaveLength(0);
  });

  it("returns null for malformed JSON-ish junk, silently like the hosts", () => {
    // MUT:site-meta-ga-silent-reject — a warn on the invalid id (R2's S2:
    // the module originally warned per call) reddens THIS silent-null test.
    // The hosts' analytics.ts never warn on an invalid id (the boot tag is
    // our own deploy payload); this module must not either.
    expect(readGaMeasurementId(docWithBootTag("not-an-id"))).toBeNull();
  });

  it("returns null for envsubst leftovers", () => {
    expect(readGaMeasurementId(docWithBootTag("$CELESTIA_GA_MEASUREMENT_ID"))).toBeNull();
    expect(readGaMeasurementId(docWithBootTag("__CHEST_GA_MEASUREMENT_ID__"))).toBeNull();
    expect(readGaMeasurementId(docWithBootTag(""))).toBeNull();
  });
});

// MUT:site-meta-beian-sanitize — line-by-line port of erp
// packages/core/src/routes/auth.rs::sanitize_beian_lines; any divergence
// re-opens the XSS / layout-breaker hole the backend contract closes.
describe("parseBeianLines (erp sanitize_beian_lines semantics)", () => {
  it("keeps well-formed entries, drops malformed ones, plain text has no url", () => {
    const raw = JSON.stringify([
      { title: "京ICP备00000000号-1", url: "https://beian.miit.gov.cn/" },
      { title: "  plain line  " },
      { title: "" },
      { title: 42 },
      { url: "https://x/" },
      { title: "bad url", url: "javascript:alert(1)" },
      { title: "relative", url: "/relative" },
      "just a string",
    ]);
    expect(parseBeianLines(raw)).toEqual([
      { title: "京ICP备00000000号-1", url: "https://beian.miit.gov.cn/" },
      { title: "plain line" },
    ]);
  });

  it("maps null and empty-string urls to plain-text lines (erp url-absence rule)", () => {
    const raw = JSON.stringify([
      { title: "nulled", url: null },
      { title: "blanked", url: "   " },
    ]);
    expect(parseBeianLines(raw)).toEqual([{ title: "nulled" }, { title: "blanked" }]);
  });

  it("returns [] for non-JSON, non-array JSON, and empty arrays", () => {
    expect(parseBeianLines("not json")).toEqual([]);
    expect(parseBeianLines('{"title":"x"}')).toEqual([]);
    expect(parseBeianLines("null")).toEqual([]);
    expect(parseBeianLines("[]")).toEqual([]);
  });

  it("caps the output at four lines (erp footer cap)", () => {
    const raw = JSON.stringify(
      Array.from({ length: 8 }, (_, i) => ({ title: `line ${i}` })),
    );
    const out = parseBeianLines(raw);
    expect(out).toHaveLength(4);
    expect(out[3]?.title).toBe("line 3");
  });

  it("drops overlong titles at 64 code points, keeping the at-cap one", () => {
    expect(parseBeianLines(`[{"title":"${"x".repeat(65)}"}]`)).toEqual([]);
    expect(parseBeianLines(`[{"title":"${"x".repeat(64)}"}]`)).toEqual([
      { title: "x".repeat(64) },
    ]);
  });

  it("drops entries whose url is a non-string JSON value (erp Some(_) => None)", () => {
    expect(parseBeianLines('[{"title":"ok","url":42}]')).toEqual([]);
  });
});

// MUT:site-meta-beian-tag-read — the beian boot tag is a SECOND injection
// channel (build-time hosts); deleting its reader while keeping
// parseBeianLines green would silently empty every static site's footer.
describe("readBeianLines", () => {
  const docWith = (id: string, text: string): Document => {
    const doc = document.implementation.createHTMLDocument("t");
    const tag = doc.createElement("script");
    tag.type = "application/json";
    tag.id = id;
    tag.textContent = text;
    doc.head.appendChild(tag);
    return doc;
  };

  it("reads and sanitizes the tag payload", () => {
    const doc = docWith(
      BEIAN_TAG_ID,
      JSON.stringify([{ title: "京ICP备00000000号-1", url: "https://beian.miit.gov.cn/" }]),
    );
    expect(readBeianLines(doc)).toEqual([
      { title: "京ICP备00000000号-1", url: "https://beian.miit.gov.cn/" },
    ]);
  });

  it("treats a missing tag, blank content and placeholders as no lines", () => {
    expect(readBeianLines(docWith("some-other-id", '[{"title":"x"}]'))).toEqual([]);
    expect(readBeianLines(docWith(BEIAN_TAG_ID, "   "))).toEqual([]);
    expect(readBeianLines(docWith(BEIAN_TAG_ID, "$BEIAN_LINES"))).toEqual([]);
    expect(readBeianLines(docWith(BEIAN_TAG_ID, "__BEIAN_LINES__"))).toEqual([]);
  });

  it("returns [] rather than throwing on malformed JSON", () => {
    expect(readBeianLines(docWith(BEIAN_TAG_ID, "{not json"))).toEqual([]);
    expect(readBeianLines(docWith(BEIAN_TAG_ID, '"just a string"'))).toEqual([]);
  });
});

// MUT:site-meta-aggregate — readSiteMeta is the single call hosts make at
// boot; dropping either half (or reading the wrong tag) has to redden here,
// because a host test that only asserts "it returned an object" would not.
describe("readSiteMeta", () => {
  const docWithBoth = (ga: string, beian: string): Document => {
    const doc = document.implementation.createHTMLDocument("t");
    for (const [id, text] of [
      [GA_TAG_ID, ga],
      [BEIAN_TAG_ID, beian],
    ]) {
      const tag = doc.createElement("script");
      tag.type = "application/json";
      tag.id = id;
      tag.textContent = text;
      doc.head.appendChild(tag);
    }
    return doc;
  };

  it("reads both halves in one call", () => {
    const doc = docWithBoth("G-ABCDEF1234", JSON.stringify([{ title: "备案" }]));
    expect(readSiteMeta(doc)).toEqual({
      gaMeasurementId: "G-ABCDEF1234",
      beianLines: [{ title: "备案" }],
    });
  });

  it("reads both halves as absent on a bare document", () => {
    const doc = document.implementation.createHTMLDocument("t");
    expect(readSiteMeta(doc)).toEqual({ gaMeasurementId: null, beianLines: [] });
  });
});
