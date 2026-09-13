import { defineComponent, type PropType } from "vue";
import { HBadge, HModal } from "@celestia-island/hikari";

import { useI18n } from "../i18n/context";

import "./HkAboutModal.scss";

export interface HAboutLink {
  label: string;
  href: string;
}

/** One software-component version row (label left, composed value right). */
export interface HAboutComponentVersion {
  label: string;
  value: string;
}

/**
 * HkAboutModal — version / about dialog.
 * (Upstreamed from shittim-chest's plana-legacy layer.)
 *
 * Shows a centered identity block (logo above the name above the tagline)
 * plus optional branding: a made-by sentence with a linked author name, a
 * centered organization line, software-component version rows, license and
 * external link chips, a decorative backdrop layer (canvas or anything
 * else, rendered behind the content and pointer-inert) and centered legal
 * footer links (e.g. ICP filings). Every branding prop is optional — the
 * modal degrades to the plain identity card when none are given.
 */
export const HkAboutModal = defineComponent({
  name: "HkAboutModal",
  props: {
    modelValue: { type: Boolean, default: false },
    /** Application display name. */
    appName: { type: String, required: true },
    /** Application version (e.g. "0.1.4"). */
    version: { type: String, required: true },
    /** Optional logo image URL — replaces the first-letter tile. */
    logoSrc: { type: String, default: undefined },
    /** Optional one-liner under the version (e.g. the app tagline). */
    tagline: { type: String, default: undefined },
    /** Optional centered small line under the header (organization blurb). */
    description: { type: String, default: undefined },
    /** Made-by sentence: text before the linked author name (e.g. "由"). */
    madeByPrefix: { type: String, default: undefined },
    /** Made-by sentence: the linked author name (e.g. "伊欧"). */
    madeByName: { type: String, default: undefined },
    /** Link applied to the author name (e.g. the GitHub profile). */
    madeByNameHref: { type: String, default: undefined },
    /** Made-by sentence: text after the name (e.g. " 主创，来自 …"). */
    madeBySuffix: { type: String, default: undefined },
    /** License chips (e.g. SySL-1.0 / BUSL-1.1), rendered centered. */
    licenses: { type: Array as PropType<HAboutLink[]>, default: () => [] },
    /** Software-component version rows (WebUI / engines), label + value. */
    componentVersions: {
      type: Array as PropType<HAboutComponentVersion[]>,
      default: () => [],
    },
    /** Optional copyright holder in the footer (defaults to the app name). */
    copyright: { type: String, default: undefined },
    /** Optional external links (e.g. GitHub, docs). */
    links: { type: Array as PropType<HAboutLink[]>, default: () => [] },
    /** Optional centered legal links above the copyright (ICP filings). */
    footerLinks: { type: Array as PropType<HAboutLink[]>, default: () => [] },
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

    const renderMadeBy = () => {
      if (!props.madeByName) return null;
      const name = props.madeByNameHref ? (
        <a
          class="s-about-modal-row-link"
          href={props.madeByNameHref}
          target="_blank"
          rel="noopener noreferrer"
        >
          {props.madeByName}
        </a>
      ) : (
        <span>{props.madeByName}</span>
      );
      return (
        <p class="s-about-modal-made-by">
          {props.madeByPrefix}
          {name}
          {props.madeBySuffix}
        </p>
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

            {renderMadeBy()}
            {props.description && <p class="s-about-modal-description">{props.description}</p>}

            {props.componentVersions.length > 0 && (
              <div class="s-about-modal-rows">
                {props.componentVersions.map((component) => (
                  <div class="s-about-modal-row" key={component.label}>
                    <span class="s-about-modal-row-label">{component.label}</span>
                    <span class="s-about-modal-row-value">{component.value}</span>
                  </div>
                ))}
              </div>
            )}

            {props.licenses.length > 0 && (
              <div class="s-about-modal-links">
                <div class="s-about-modal-links-list">
                  {props.licenses.map((license) => (
                    <a
                      key={license.href}
                      href={license.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      class="s-about-modal-link"
                    >
                      {license.label}
                    </a>
                  ))}
                </div>
              </div>
            )}

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

            {props.footerLinks.length > 0 && (
              <div class="s-about-modal-footer-links">
                {props.footerLinks.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    class="s-about-modal-footer-link"
                  >
                    {link.label}
                  </a>
                ))}
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
