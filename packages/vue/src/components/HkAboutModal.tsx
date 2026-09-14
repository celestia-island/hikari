import { defineComponent, type PropType } from "vue";
import { Github } from "lucide-vue-next";
import { HBadge, HModal } from "@celestia-island/hikari";

import { useI18n } from "../i18n/context";

import "./HkAboutModal.scss";

/**
 * How a link presents itself.
 *
 * `chip` is the dialog's original face — a ghost tag. `plain` is bare text:
 * no frame, no underline, so the hover colour shift is the whole
 * affordance. `accent` is also bare text, but tinted in the primary colour
 * so the link visibly stands out of the sentence it sits in — the "this is
 * clickable" cue (user direction 2026-09-15). Chosen per link, because one
 * dialog can want both (the credits names / URLs / filings read as sentence
 * text, the licenses stay tags).
 */
export type HAboutLinkFace = "chip" | "plain" | "accent";

/** Leading icon a link can carry; an icon-only link shows it alone. */
export type HAboutLinkIcon = "github";

// The mark behind each icon key. Brand names are locale-invariant, so they
// double as the accessible name of an icon-only link.
const ICONS: Record<HAboutLinkIcon, typeof Github> = { github: Github };
const ICON_NAMES: Record<HAboutLinkIcon, string> = { github: "GitHub" };

export interface HAboutLink {
  /** Visible text. Omit for an icon-only link — then name it with
   *  `ariaLabel`. */
  label?: string;
  href: string;
  /** Optional leading icon (e.g. the project's GitHub home). */
  icon?: HAboutLinkIcon;
  /** Link face; defaults to `chip`. */
  face?: HAboutLinkFace;
  /**
   * Accessible name for an icon-only link — falls back to `label`, then to
   * the icon's own name (brand names are locale-invariant, so they need no
   * i18n key of their own).
   */
  ariaLabel?: string;
}

/**
 * One piece of the credits line.
 *
 * The line is a sentence assembled from parts so a host can phrase (and
 * order) it freely per locale: literal `text` runs sit between linked
 * `name` runs (organization first, author second, …). Each linked name
 * carries its own `face`, so one dialog can mix a chip here with bare text
 * there (and an unlinked name is always plain text).
 */
export interface HAboutCredit {
  /** Literal sentence fragment (mutually exclusive with `name`). */
  text?: string;
  /** Linked name (mutually exclusive with `text`). */
  name?: string;
  /** Target for a `name`; opens in a new tab. */
  href?: string;
  /** Face for a linked `name` (an unlinked name stays plain text). */
  face?: HAboutLinkFace;
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
 * (a sentence built from text runs and linked names, plus the
 * organization blurb), a
 * bordered spec card holding the software-component versions, and the
 * link rows — licenses, external links and legal filings. Every link opens
 * in a new tab and renders in the face its entry asks for: the ghost chip,
 * or bare text (`plain` / tinted `accent`) for names / URLs / filings that
 * should read as ordinary sentence text. Every branding prop is optional — the modal
 * degrades to the plain identity card when none are given.
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
    /**
     * Credits sentence, assembled from text runs and linked names
     * (e.g. 来自 <Celestia Island>，由 <伊欧> 主创). Each name renders in the
     * face its entry asks for — `chip`, bare text with `plain`, or bare
     * text tinted in the primary colour with `accent`.
     */
    credits: { type: Array as PropType<HAboutCredit[]>, default: () => [] },
    /** License links (e.g. SySL-1.0 / BUSL-1.1), rendered centered. */
    licenses: { type: Array as PropType<HAboutLink[]>, default: () => [] },
    /** Software-component version rows (WebUI / engines), label + value. */
    componentVersions: {
      type: Array as PropType<HAboutComponentVersion[]>,
      default: () => [],
    },
    /** Optional copyright holder in the footer (defaults to the app name). */
    copyright: { type: String, default: undefined },
    /**
     * Optional external links (e.g. the site domains, the project's GitHub
     * home). An entry may carry an `icon` instead of a `label` — that is how
     * the GitHub mark rides at the end of the domain row.
     */
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

    // One link renderer for every link in the dialog: credits names,
    // licenses, external links and the legal filings. `face` picks the tag
    // or the bare-text face; an `icon` may replace or lead the label.
    const renderLink = (
      item: HAboutLink,
      extraClass: string,
      key: string,
    ) => {
      const label = item.label ?? "";
      const Icon = item.icon ? ICONS[item.icon] : undefined;
      const classes = ["s-about-modal-link", extraClass];
      if (Icon) classes.push("s-about-modal-link-has-icon");
      return (
        <a
          key={key}
          class={classes}
          data-face={item.face ?? "chip"}
          href={item.href}
          target="_blank"
          rel="noopener noreferrer"
          // A text link is named by its own label unless the host names it
          // explicitly; an icon-only link has no text to be named by, so it
          // always needs a name of its own.
          aria-label={
            item.ariaLabel ?? (label ? undefined : item.icon ? ICON_NAMES[item.icon] : item.href)
          }
        >
          {Icon && (
            // Wrapped rather than classed on the lucide component: lucide
            // merges its own classes with the passed ones and emits the token
            // twice.
            <span class="s-about-modal-link-icon" aria-hidden="true">
              <Icon size={14} />
            </span>
          )}
          {label}
        </a>
      );
    };

    const renderCredits = () => {
      const parts = props.credits.filter((part) => part.text || part.name);
      if (parts.length === 0) return null;
      return (
        <p class="s-about-modal-credits-line">
          {parts.map((part, index) =>
            part.name ? (
              part.href ? (
                renderLink(
                  { label: part.name, href: part.href, face: part.face },
                  "s-about-modal-credit-link",
                  `name:${index}`,
                )
              ) : (
                <span key={`name:${index}`} class="s-about-modal-credit-name">
                  {part.name}
                </span>
              )
            ) : (
              <span key={`text:${index}`}>{part.text}</span>
            ),
          )}
        </p>
      );
    };

    // An entry with neither text nor a mark would render an invisible but
    // focusable link whose only name is its raw URL — drop it rather than
    // ship a blank target. Every row filters through here.
    const visibleLinks = (items: HAboutLink[]) =>
      items.filter((item) => item.label || item.icon);

    const renderLinks = (items: HAboutLink[], slot: string) => {
      const visible = visibleLinks(items);
      if (visible.length === 0) return null;
      return (
        <div class="s-about-modal-links" data-slot={slot}>
          <div class="s-about-modal-links-list">
            {visible.map((item, index) => renderLink(item, "", `${slot}:${index}`))}
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

            {(props.credits.length > 0 || props.description) && (
              <div class="s-about-modal-credits">
                {renderCredits()}
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
                {renderLinks(props.licenses, "licenses")}
                {renderLinks(props.links, "links")}
              </div>
            )}

            {visibleLinks(props.footerLinks).length > 0 && (
              <div class="s-about-modal-footer-links">
                {visibleLinks(props.footerLinks).map((link, index) =>
                  renderLink(link, "s-about-modal-footer-link", `legal:${index}`),
                )}
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
