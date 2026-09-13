import { defineComponent, type PropType } from "vue";
import { HBadge, HModal } from "@celestia-island/hikari";

import { useI18n } from "../i18n/context";

import "./HkAboutModal.scss";

export interface HAboutLink {
  label: string;
  href: string;
}

/**
 * One software-component version row.
 *
 * `value` is the machine-readable half (version, optionally plus a build
 * hash) and renders in the mono/tabular face; `meta` is the optional
 * human-facing trailing tag (e.g. the environment word 生产 / 测试),
 * rendered as a separate muted pill so it never melts into the version
 * string. `metaTone` tints that pill when the tag carries a status
 * meaning (e.g. a production environment).
 */
export interface HAboutComponentVersion {
  label: string;
  value: string;
  meta?: string;
  metaTone?: "neutral" | "positive" | "caution";
}

/**
 * HkAboutModal — version / about dialog.
 * (Upstreamed from shittim-chest's plana-legacy layer.)
 *
 * Layout (2026-09 redesign): a centered identity hero (haloed logo, name,
 * then version + tagline on one compact line), an optional credits block
 * (made-by sentence with a linked author name + organization blurb), a
 * bordered spec card holding the software-component versions, ghost chip
 * rows for licenses / external links, and a muted legal footer (filing
 * links + copyright). Every branding prop is optional — the modal degrades
 * to the plain identity card when none are given.
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
    /** Optional one-liner shown beside the version (e.g. the app tagline). */
    tagline: { type: String, default: undefined },
    /** Optional centered small line under the credits (organization blurb). */
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

    const renderChips = (items: HAboutLink[], slot: string) => {
      if (items.length === 0) return null;
      return (
        <div class="s-about-modal-links" data-slot={slot}>
          <div class="s-about-modal-links-list">
            {items.map((item) => (
              <a
                key={item.href}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                class="s-about-modal-link"
              >
                {item.label}
              </a>
            ))}
          </div>
        </div>
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
              <div class="s-about-modal-logo-frame">
                {props.logoSrc ? (
                  <img
                    class="s-about-modal-logo-img"
                    src={props.logoSrc}
                    alt=""
                    draggable={false}
                  />
                ) : (
                  <div class="s-about-modal-logo">{props.appName.slice(0, 1).toUpperCase()}</div>
                )}
              </div>
              <div class="s-about-modal-identity">
                <h2 class="s-about-modal-name">{props.appName}</h2>
                <p class="s-about-modal-subtitle">
                  <span class="s-about-modal-version">
                    {t("hikari::about.version", "Version")} {props.version}
                  </span>
                  {props.tagline && (
                    <>
                      <span class="s-about-modal-subtitle-sep" aria-hidden="true">
                        ·
                      </span>
                      <span class="s-about-modal-tagline">{props.tagline}</span>
                    </>
                  )}
                </p>
              </div>
            </header>

            {(props.madeByName || props.description) && (
              <div class="s-about-modal-credits">
                {renderMadeBy()}
                {props.description && (
                  <p class="s-about-modal-description">{props.description}</p>
                )}
              </div>
            )}

            {props.componentVersions.length > 0 && (
              <div class="s-about-modal-rows">
                {props.componentVersions.map((component) => (
                  <div class="s-about-modal-row" key={component.label}>
                    <span class="s-about-modal-row-label">{component.label}</span>
                    <span class="s-about-modal-row-value">
                      <span class="s-about-modal-row-number">{component.value}</span>
                      {component.meta && (
                        <span
                          class="s-about-modal-row-meta"
                          data-tone={component.metaTone ?? "neutral"}
                        >
                          {component.meta}
                        </span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {(props.licenses.length > 0 || props.links.length > 0) && (
              <div class="s-about-modal-chips">
                {renderChips(props.licenses, "licenses")}
                {renderChips(props.links, "links")}
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
