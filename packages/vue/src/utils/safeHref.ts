/**
 * Audit hikari-R1-4: URL scheme allowlist for component `href` props.
 *
 * The component library renders caller-supplied `href` values verbatim —
 * a caller that routes user data into a nav item or breadcrumb gets a
 * `javascript:` XSS for free. This helper enforces a scheme allowlist
 * (http/https/mailto/tel/relative/fragment) and neutralizes anything
 * else to an inert `"#"` so the anchor stays clickable but harmless.
 */
const SAFE_HREF_PATTERN = /^(?:https?:|mailto:|tel:|\/|#|\.\/|\.\.\/)/i;
const DANGEROUS_SCHEME_PATTERN = /^\s*(?:javascript|vbscript|data):/i;

export function isSafeHref(href: string): boolean {
  const trimmed = href.trim();
  if (trimmed.length === 0) {
    return false;
  }
  if (DANGEROUS_SCHEME_PATTERN.test(trimmed)) {
    return false;
  }
  return SAFE_HREF_PATTERN.test(trimmed);
}

/**
 * Return `href` when it passes the scheme allowlist, otherwise `"#"`.
 * Relative paths, fragments, and absolute http(s)/mailto/tel URLs pass
 * through unchanged.
 */
export function safeHref(href: string | undefined | null): string {
  if (!href) {
    return "#";
  }
  return isSafeHref(href) ? href : "#";
}
