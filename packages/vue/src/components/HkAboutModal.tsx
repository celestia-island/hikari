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
 * Shows the app identity and version metadata plus optional branding: a
 * logo image, tagline, organization blurb, author / license rows, a
 * decorative backdrop layer (canvas or anything else, rendered behind the
 * content and pointer-inert) and external links. Version/build hashes
 * render as short hashes when longer than 12 chars (full value in `title`
 * tooltip). Every branding prop is optional — the modal degrades to the
 * plain identity + version card when none are given.
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
    /** Optional logo image URL — replaces the first-letter tile. */
    logoSrc: { type: String, default: undefined },
    /** Optional one-liner under the version (e.g. the app tagline). */
    tagline: { type: String, default: undefined },
    /** Optional paragraph below the header (vision / organization blurb). */
    description: { type: String, default: undefined },
    /** Optional author / organization row. */
    author: { type: String, default: undefined },
    /** Optional link applied to the author value. */
    authorHref: { type: String, default: undefined },
    /** Optional license identifier row (e.g. "BUSL-1.1"). */
    license: { type: String, default: undefined },
    /** Optional copyright holder in the footer (defaults to the app name). */
    copyright: { type: String, default: undefined },
    /** Optional external links (e.g. GitHub, docs). */
    links: { type: Array as PropType<HAboutLink[]>, default: () => [] },
    /**
     * Optional decorative backdrop factory, rendered behind the content
     * inside a clipped, pointer-inert layer. The modal owns only the layer —
     * sizing, theming and the render loop belong to the returned subtree.
     */
    backdrop: { type: Function as PropType<() => unknown>, default: undefined },
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

    const renderAuthorValue = () => {
      if (!props.authorHref) return props.author;
      return (
        <a
          class="s-about-modal-row-link"
          href={props.authorHref}
          target="_blank"
          rel="noopener noreferrer"
        >
          {props.author}
        </a>
      );
    };

    return () => (
      <HModal
        modelValue={props.modelValue}
        onUpdate:modelValue={(v: boolean) => emit("update:modelValue", v)}
        title={props.title ?? t("hikari::about.title", "About")}
        width="30rem"
      >
        <div class="s-about-modal">
          {props.backdrop && (
            <div class="s-about-modal-backdrop" aria-hidden="true">
              {props.backdrop()}
            </div>
          )}
          <div class="s-about-modal-body">
            <header class="s-about-modal-header">
              {props.logoSrc ? (
                <img class="s-about-modal-logo-img" src={props.logoSrc} alt="" draggable={false} />
              ) : (
                <div class="s-about-modal-logo">{props.appName.slice(0, 1).toUpperCase()}</div>
              )}
              <div>
                <h2 class="s-about-modal-name">{props.appName}</h2>
                <p class="s-about-modal-version">
                  {t("hikari::about.version", "Version")} {props.version}
                </p>
                {props.tagline && <p class="s-about-modal-tagline">{props.tagline}</p>}
              </div>
            </header>

            {props.description && <p class="s-about-modal-description">{props.description}</p>}

            <div class="s-about-modal-rows">
              {props.author && (
                <div class="s-about-modal-row">
                  <span class="s-about-modal-row-label">{t("hikari::about.author", "Author")}</span>
                  <span class="s-about-modal-row-value">{renderAuthorValue()}</span>
                </div>
              )}
              {props.license && (
                <div class="s-about-modal-row">
                  <span class="s-about-modal-row-label">
                    {t("hikari::about.license", "License")}
                  </span>
                  <span class="s-about-modal-row-value">{props.license}</span>
                </div>
              )}
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
                  <span class="s-about-modal-row-label">
                    {t("hikari::about.engineVersion", "Engine version")}
                  </span>
                  <span class="s-about-modal-row-value">{props.engineVersion}</span>
                </div>
              )}
              {props.engineBuildHash && (
                <div class="s-about-modal-row">
                  <span class="s-about-modal-row-label">
                    {t("hikari::about.engineBuildHash", "Engine build")}
                  </span>
                  <span class="s-about-modal-row-value" title={props.engineBuildHash}>
                    {shortHash(props.engineBuildHash)}
                  </span>
                </div>
              )}
            </div>

            {props.links.length > 0 && (
              <div class="s-about-modal-links">
                <div class="s-about-modal-links-list">
                  {props.links.map((link) => (
                    <a
                      key={link.href}
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      class="s-about-modal-link"
                    >
                      {link.label}
                    </a>
                  ))}
                </div>
              </div>
            )}

            <footer class="s-about-modal-footer">
              <HBadge variant="muted">
                © {new Date().getFullYear()} {props.copyright ?? props.appName}
              </HBadge>
            </footer>
          </div>
        </div>
      </HModal>
    );
  },
});
