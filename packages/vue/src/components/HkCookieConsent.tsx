import { defineComponent, onMounted, ref } from "vue";
import { Cookie } from "lucide-vue-next";

import { useI18n } from "../i18n/context";

import "./HkCookieConsent.scss";

// Upstream namespace rename: the plana-legacy original stored the flag
// under "plana-cookies-accepted"; hikari owns the key in its own
// "hikari-cookies-accepted" namespace.
const STORAGE_KEY = "hikari-cookies-accepted";

/**
 * HkCookieConsent — minimal GDPR cookie notice.
 * (Upstreamed from shittim-chest's plana-legacy layer.)
 *
 * Only surfaces the notice in European timezones and only until the
 * visitor accepts; afterwards a tiny cookie glyph remains as the
 * acknowledgment marker. Outside Europe nothing renders at all.
 */
export const HkCookieConsent = defineComponent({
  name: "HkCookieConsent",
  setup() {
    const { t } = useI18n();
    const accepted = ref(false);
    const show = ref(false);

    onMounted(() => {
      accepted.value = localStorage.getItem(STORAGE_KEY) === "1";
      if (!accepted.value) {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const eu = tz?.startsWith("Europe/") ?? false;
        show.value = eu;
      }
    });

    function accept() {
      localStorage.setItem(STORAGE_KEY, "1");
      accepted.value = true;
      show.value = false;
    }

    return () => {
      if (!show.value && !accepted.value) return null;
      if (accepted.value) return <Cookie size={12} class="s-cookie-consent-icon" />;
      return (
        <span class="s-cookie-consent">
          {t("hikari::cookie.text", "This site uses cookies.")}
          <button type="button" class="s-cookie-consent-ok" onClick={accept}>
            {t("hikari::cookie.ok", "OK")}
          </button>
        </span>
      );
    };
  },
});
