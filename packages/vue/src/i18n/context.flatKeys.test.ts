import { describe, expect, it } from "vitest";

import { setLocale, useI18n } from "./context";

/**
 * Regression (2026-09-08 user report): the language tag's "Not set"
 * placeholder stayed ENGLISH on a Chinese UI. Root cause —
 * buildLocaleMessages only merged nested domain sections and silently
 * DROPPED every top-level flat key ("hikari::x.y": "…"), so all
 * post-0.3 flat additions (affixPicker.*, messageBox.*,
 * localizedInput.noMatches, …) fell back to the inline English default
 * at runtime on every locale. These tests pin flat-key loading.
 */
describe("i18n flat-key loading", () => {
  it("serves top-level flat keys from the locale bundle", async () => {
    await setLocale("zh-Hans");
    const { t } = useI18n();
    expect(t("hikari::affixPicker.unset", "Not set")).toBe("未设置");
    expect(t("hikari::affixPicker.remove", "Remove")).toBe("移除");
    expect(t("hikari::affixPicker.removeConfirmTitle", "Remove entry")).toBe("移除条目");
    expect(t("hikari::messageBox.confirm", "Confirm")).toBe("确认");
  });

  it("keeps nested legacy sections loading beside the flat keys", async () => {
    await setLocale("zh-Hans");
    const { t } = useI18n();
    expect(t("hikari::localizedInput.chooseLanguage", "Choose editing language")).toBe(
      "选择编辑语言",
    );
    expect(t("hikari::modal.close", "Close")).toBe("关闭");
  });

  it("other locales serve their own flat translations, not English", async () => {
    await setLocale("ja");
    const { t } = useI18n();
    expect(t("hikari::affixPicker.unset", "Not set")).toBe("未設定");
    await setLocale("ko");
    expect(t("hikari::affixPicker.unset", "Not set")).toBe("미설정");
  });
});
