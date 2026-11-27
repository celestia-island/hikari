import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { afterAll, afterEach, describe, expect, it } from "vitest";

import { setLocale } from "../i18n/context";
import {
  HK_CENTRAL_AUTH_NAME_EN,
  HK_CENTRAL_AUTH_NAME_KEY,
  HK_CENTRAL_AUTH_PROVIDER_ID,
  hkCentralAuthMarkSrc,
  hkCentralAuthName,
  hkProviderLabelIsId,
} from "./loginProviders";

const HERE = dirname(fileURLToPath(import.meta.url));
/** packages/vue */
const VUE_DIR = resolve(HERE, "../..");
const REPO_ROOT = resolve(VUE_DIR, "../..");
const GENERATOR = resolve(VUE_DIR, "scripts/build-central-auth-mark.py");
const MODULE_PATH = resolve(HERE, "centralAuthMarkData.ts");
const LOCALES_DIR = resolve(VUE_DIR, "src/i18n/locales");

const LOCALES = [
  "ar", "de", "en", "es", "fr", "ja", "ko", "pt", "ru", "zh-Hans", "zh-Hant",
] as const;

/** Every place the logo's single home (AGENTS.md 徽标唯一家) can be, relative
 *  to `packages/vue`: the sibling checkout of the repository itself, then the
 *  two shapes a worktree checkout sits at. The landing repo is NOT on the
 *  worktree path — `_worktree/<repo>/<slug>` is this repository's own worktree
 *  namespace, and `_worktree/celestia-island.github.io/` holds the LANDING
 *  repo's worktrees, not its trunk.
 *
 *  A missing source skips the determinism cases (and says why); a source that
 *  is present but is not the pinned logo (another branch checked out, a
 *  repainted mark) FAILS them — the committed bytes would no longer be what
 *  the generator produces, which is exactly the drift this suite guards. */
const SOURCE_LOGO = [
  resolve(REPO_ROOT, "../celestia-island.github.io/res/logos/celestia.webp"),
  resolve(REPO_ROOT, "../../../celestia-island.github.io/res/logos/celestia.webp"),
  resolve(REPO_ROOT, "../../../celestia-island.github.io/feat-logo-guard/res/logos/celestia.webp"),
].find((candidate) => existsSync(candidate));

/** sha256 of the decoded WebP payload, and the canvas the generator chose.
 *  Pinned so a silent regeneration (a new logo, a bumped quality, a
 *  different resample) has to be acknowledged here too. */
const MARK_SHA256 = "71d34aea2c1afc3b056d20e8a373f201a6619339a4853bac825d766e8575d849";
const MARK_CANVAS = 64;

function localeBundle(locale: string): Record<string, unknown> {
  return JSON.parse(
    readFileSync(join(LOCALES_DIR, locale, "components.json"), "utf8"),
  ) as Record<string, unknown>;
}

describe("hikari central identity provider — row defaults", () => {
  it("pins the wire provider id the live services already emit", () => {
    // Not a rename: `erp` is what kirino and every deployed service put in
    // `methods[].provider`. Changing it here would silently stop matching.
    expect(HK_CENTRAL_AUTH_PROVIDER_ID).toBe("erp");
  });

  it("names the provider in all 11 locales through one key", () => {
    expect(HK_CENTRAL_AUTH_NAME_KEY).toBe("hikari::loginFlow.providerCelestiaAuth");
    for (const locale of LOCALES) {
      const value = localeBundle(locale)[HK_CENTRAL_AUTH_NAME_KEY];
      expect(typeof value, `${locale} must define ${HK_CENTRAL_AUTH_NAME_KEY}`).toBe("string");
      expect((value as string).trim().length, `${locale} must not be empty`).toBeGreaterThan(0);
    }
    // The English bundle IS the canonical literal hosts pass as `t()`'s
    // fallback — a drift between the two renames the row for every locale
    // that has not loaded its bundle yet.
    expect(localeBundle("en")[HK_CENTRAL_AUTH_NAME_KEY]).toBe(HK_CENTRAL_AUTH_NAME_EN);
  });
});

describe("hkProviderLabelIsId", () => {
  it("treats an absent, empty or whitespace label as the id fallback", () => {
    expect(hkProviderLabelIsId("erp", undefined)).toBe(true);
    expect(hkProviderLabelIsId("erp", null)).toBe(true);
    expect(hkProviderLabelIsId("erp", "")).toBe(true);
    expect(hkProviderLabelIsId("erp", "  ")).toBe(true);
    expect(hkProviderLabelIsId("erp", "\t\n ")).toBe(true);
  });

  it("matches the id character for character only", () => {
    expect(hkProviderLabelIsId("erp", "erp")).toBe(true);
    expect(hkProviderLabelIsId("erp", "  erp  ")).toBe(true);
    // Case is a name the operator typed, not a fallback.
    expect(hkProviderLabelIsId("erp", "ERP")).toBe(false);
    expect(hkProviderLabelIsId("erp", "Erp")).toBe(false);
  });

  it("leaves a genuinely different name alone", () => {
    expect(hkProviderLabelIsId("erp", "Acme SSO")).toBe(false);
    expect(hkProviderLabelIsId("erp", "erp-europe")).toBe(false);
    // MUT:central-auth-label-prefix (a startsWith/contains test would
    // swallow every alias that merely begins with the id).
    expect(hkProviderLabelIsId("erp", "erpx")).toBe(false);
  });

  it("never matches an empty provider id", () => {
    expect(hkProviderLabelIsId("", "")).toBe(false);
    expect(hkProviderLabelIsId("", "   ")).toBe(false);
    expect(hkProviderLabelIsId("", undefined)).toBe(false);
    expect(hkProviderLabelIsId("", "erp")).toBe(false);
  });
});

describe("hkCentralAuthName", () => {
  // hikari's locale context is a module singleton shared with every other
  // suite in this worker — always hand "en" back.
  afterEach(async () => {
    await setLocale("en");
  });

  it("reads the name from hikari's own locale context", async () => {
    await setLocale("en");
    expect(hkCentralAuthName()).toBe(HK_CENTRAL_AUTH_NAME_EN);
    await setLocale("zh-Hans");
    // MUT:central-auth-name-vue-i18n (routing this through a host-side
    // `t()` with no hikari keys merged leaves the English fallback here —
    // exactly what 0721 would have shipped).
    expect(hkCentralAuthName()).toBe("Celestia 统一认证平台");
  });

  it("follows a later setLocale instead of caching the first answer", async () => {
    await setLocale("zh-Hans");
    const first = hkCentralAuthName();
    await setLocale("ja");
    const second = hkCentralAuthName();
    await setLocale("en");
    const third = hkCentralAuthName();
    // A hoisted constant (read once at import) returns `first` forever.
    expect(first).toBe("Celestia 统一认证平台");
    expect(second).toBe("Celestia 統一認証プラットフォーム");
    expect(third).toBe(HK_CENTRAL_AUTH_NAME_EN);
  });
});

describe("hkCentralAuthMarkSrc", () => {
  const prefix = "data:image/webp;base64,";

  it("is an inline WebP data URI", () => {
    expect(hkCentralAuthMarkSrc.startsWith(prefix)).toBe(true);
  });

  it("decodes to the pinned WebP bytes", () => {
    const payload = hkCentralAuthMarkSrc.slice(prefix.length);
    const bytes = Buffer.from(payload, "base64");
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(MARK_SHA256);

    // RIFF container: "RIFF" <size> "WEBP" <chunk>. The extended (VP8X)
    // chunk is what carries the alpha flag and the canvas size in the
    // first three bytes each, minus one, little-endian.
    expect(bytes.subarray(0, 4).toString("latin1")).toBe("RIFF");
    expect(bytes.subarray(8, 12).toString("latin1")).toBe("WEBP");
    expect(bytes.subarray(12, 16).toString("latin1")).toBe("VP8X");
    expect(bytes[20] & 0x10, "the X chunk must announce an alpha channel").toBeTruthy();
    expect(bytes.readUIntLE(24, 3) + 1).toBe(MARK_CANVAS);
    expect(bytes.readUIntLE(27, 3) + 1).toBe(MARK_CANVAS);
    expect(bytes.length).toBeLessThanOrEqual(3 * 1024);
  });

  it("is exported through the single module (the generated file stays internal)", () => {
    const generated = readFileSync(MODULE_PATH, "utf8");
    expect(generated).toContain("GENERATED — do not edit");
    expect(generated).toContain("export const hkCentralAuthMarkSrc");
  });
});

/** Generators run in a real child process, like the error-landing drift
 *  guard: Pillow lives outside vitest's module graph. */
function pythonAvailable(): { ok: boolean; reason?: string } {
  const probe = spawnSync("python3", ["-c", "from PIL import Image; print('ok')"], {
    encoding: "utf8",
  });
  if (probe.error) return { ok: false, reason: `python3 failed to start: ${probe.error.message}` };
  if (probe.status !== 0) {
    return { ok: false, reason: `Pillow (PIL) is not importable: ${probe.stderr.trim()}` };
  }
  return { ok: true };
}

const scratchDirs: string[] = [];
afterAll(() => {
  for (const dir of scratchDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("build-central-auth-mark.py", () => {
  const python = pythonAvailable();
  const skip = !python.ok
    ? `generator not re-run: ${python.reason}`
    : SOURCE_LOGO === undefined
      ? "generator not re-run: the logo source is absent from every candidate path (the landing repo is a separate checkout)"
      : false;

  it.skipIf(skip)("regenerates the committed module byte for byte", () => {
    const dir = mkdtempSync(join(tmpdir(), "hk-central-auth-mark-"));
    scratchDirs.push(dir);
    const out = join(dir, "centralAuthMarkData.ts");
    const run = spawnSync("python3", [GENERATOR, SOURCE_LOGO!, "--out", out], {
      encoding: "utf8",
      cwd: VUE_DIR,
    });
    expect(run.status, `generator failed:\n${run.stderr}`).toBe(0);
    // MUT:central-auth-mark-drift (hand-editing the data URI, changing the
    // quality, or rescaling with a different filter goes red here).
    expect(readFileSync(out, "utf8")).toBe(readFileSync(MODULE_PATH, "utf8"));
  });

  it.skipIf(skip)("refuses a source whose sha256 does not match the pin", () => {
    const dir = mkdtempSync(join(tmpdir(), "hk-central-auth-mark-"));
    scratchDirs.push(dir);
    const impostor = join(dir, "impostor.webp");
    // A REAL image (the logo itself, plus one appended byte): the generator
    // must refuse on the HASH, not because the file happens to be unreadable.
    writeFileSync(impostor, Buffer.concat([readFileSync(SOURCE_LOGO!), Buffer.from([0])]));
    const out = join(dir, "out.ts");
    const run = spawnSync("python3", [GENERATOR, impostor, "--out", out], {
      encoding: "utf8",
      cwd: VUE_DIR,
    });
    // A repainted logo must be confirmed, never silently adopted.
    expect(run.status).not.toBe(0);
    expect(run.stderr).toContain("sha256 mismatch");
    expect(existsSync(out)).toBe(false);
  });
});
