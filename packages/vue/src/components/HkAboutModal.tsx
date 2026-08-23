import { defineComponent, type PropType } from "vue";
import { HBadge, HModal } from "@celestia-island/hikari";

import { useI18n } from "../i18n/context";

import "./HkAboutModal.scss";

export interface HAboutLink {
  label: string;
  href: string;
}

/**
 * HkAboutModal — version / about dialog.
 * (Upstreamed from shittim-chest's plana-legacy layer.)
 *
 * Shows the app identity and version metadata plus optional external
 * links. Version/build hashes render as short hashes when longer than 12
 * chars (full value in `title` tooltip).
 */
export const HkAboutModal = defineComponent({
  name: "HkAboutModal",
  props: {
    modelValue: { type: Boolean, default: false },
    /** Application display name. */
    appName: { type: String, required: true },
    /** Application version (e.g. "0.1.4"). */
    version: { type: String, required: true },
    /** Optional app build hash / commit. */
    buildHash: { type: String, default: undefined },
    /** Optional engine version (backend), e.g. "0.2.1". */
    engineVersion: { type: String, default: undefined },
    /** Optional engine build hash / commit. */
    engineBuildHash: { type: String, default: undefined },
    /** Optional external links (e.g. GitHub, docs). */
    links: { type: Array as PropType<HAboutLink[]>, default: () => [] },
    title: { type: String, default: undefined },
  },
  emits: {
    "update:modelValue": (_v: boolean) => true,
  },
  setup(props, { emit }) {
    const { t } = useI18n();

    function shortHash(hash: string): string {
      return hash.length > 12 ? `${hash.slice(0, 12)}…` : hash;
    }

    return () => (
      <HModal
        modelValue={props.modelValue}
        onUpdate:modelValue={(v: boolean) => emit("update:modelValue", v)}
        title={props.title ?? t("hikari::about.title", "About")}
        width="30rem"
      >
        <div class="s-about-modal">
          <header class="s-about-modal-header">
            <div class="s-about-modal-logo">{props.appName.slice(0, 1).toUpperCase()}</div>
            <div>
              <h2 class="s-about-modal-name">{props.appName}</h2>
              <p class="s-about-modal-version">
                {t("hikari::about.version", "Version")} {props.version}
              </p>
            </div>
          </header>

          <div class="s-about-modal-rows">
            {props.buildHash && (
              <div class="s-about-modal-row">
                <span class="s-about-modal-row-label">{t("hikari::about.buildHash", "Build")}</span>
                <span class="s-about-modal-row-value" title={props.buildHash}>
                  {shortHash(props.buildHash)}
                </span>
              </div>
            )}
            {props.engineVersion && (
              <div class="s-about-modal-row">
                <span class="s-about-modal-row-label">{t("hikari::about.engineVersion", "Engine version")}</span>
                <span class="s-about-modal-row-value">{props.engineVersion}</span>
              </div>
            )}
            {props.engineBuildHash && (
              <div class="s-about-modal-row">
                <span class="s-about-modal-row-label">{t("hikari::about.engineBuildHash", "Engine build")}</span>
                <span class="s-about-modal-row-value" title={props.engineBuildHash}>
                  {shortHash(props.engineBuildHash)}
                </span>
              </div>
            )}
          </div>

          {props.links.length > 0 && (
            <div class="s-about-modal-links">
              <span class="s-about-modal-row-label">{t("hikari::about.links", "Links")}</span>
              <div class="s-about-modal-links-list">
                {props.links.map((link) => (
                  <a key={link.href} href={link.href} target="_blank" rel="noopener noreferrer" class="s-about-modal-link">
                    {link.label}
                  </a>
                ))}
              </div>
            </div>
          )}

          <footer class="s-about-modal-footer">
            <HBadge variant="muted">
              © {new Date().getFullYear()} {props.appName}
            </HBadge>
          </footer>
        </div>
      </HModal>
    );
  },
});
