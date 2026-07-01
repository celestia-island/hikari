/// Find first occurrence of `needle` in `haystack`, case-insensitively.
fn find_ci(haystack: &[u8], needle: &[u8]) -> Option<usize> {
    haystack
        .windows(needle.len())
        .position(|w| w.eq_ignore_ascii_case(needle))
}

/// Find the position of the next unquoted `>` starting from `start`.
/// Returns `None` if no `>` is found.
fn find_tag_close(haystack: &[u8], start: usize) -> Option<usize> {
    let mut i = start;
    let mut in_single = false;
    let mut in_double = false;
    while i < haystack.len() {
        match haystack[i] {
            b'\'' if !in_double => in_single = !in_single,
            b'"' if !in_single => in_double = !in_double,
            b'>' if !in_single && !in_double => return Some(i),
            _ => {}
        }
        i += 1;
    }
    None
}

/// Find the closing tag `</tag>` (case-insensitive) that correctly matches
/// the opening tag by accounting for nested tags of the same name.
/// Returns the position *after* the `>` of the closing tag.
fn find_close_tag(haystack: &str, tag: &str, from: usize) -> Option<usize> {
    let open_tag = format!("<{tag}");
    let open_tag_bytes = open_tag.as_bytes();
    let close_tag = format!("</{tag}");
    let close_tag_bytes = close_tag.as_bytes();
    let hbytes = haystack.as_bytes();
    let mut search_start = from;
    let mut depth = 1; // we already have one open tag

    while depth > 0 {
        // Find the next open or close tag, whichever comes first
        let next_open = find_ci(&hbytes[search_start..], open_tag_bytes).map(|p| search_start + p);
        let next_close =
            find_ci(&hbytes[search_start..], close_tag_bytes).map(|p| search_start + p);

        match (next_open, next_close) {
            (Some(o), Some(c)) if o < c => {
                // Found a nested open tag of the same type first —
                // verify it is a real tag (not a longer name like <scripting>)
                let after_tag = o + open_tag.len();
                if is_tag_boundary(hbytes, after_tag) {
                    depth += 1;
                }
                search_start = o + 1;
            }
            (Some(_), Some(c)) | (None, Some(c)) => {
                // Found a close tag
                if let Some(gt) = find_tag_close(hbytes, c + close_tag.len()) {
                    depth -= 1;
                    if depth == 0 {
                        return Some(gt + 1);
                    }
                    search_start = gt + 1;
                } else {
                    search_start = c + 1;
                }
            }
            (Some(o), None) => {
                let after_tag = o + open_tag.len();
                if is_tag_boundary(hbytes, after_tag) {
                    depth += 1;
                }
                search_start = o + 1;
            }
            (None, None) => return None,
        }
    }
    None
}

/// Check if the byte at `offset` is a valid tag-name boundary character
/// (i.e. the tag name has ended at this point).
fn is_tag_boundary(bytes: &[u8], after_name: usize) -> bool {
    after_name >= bytes.len()
        || bytes[after_name - 1] == b'>'
        || bytes[after_name - 1] == b'/'
        || bytes.get(after_name).is_none_or(|&b| {
            b == b' ' || b == b'>' || b == b'/' || b == b'\t' || b == b'\n' || b == b'\r'
        })
}

/// Remove the full element starting at a `<tag` opening, including all child content.
/// Expects `start` to point at the `<` of the opening tag.
/// Returns the byte position *after* the removed range.
fn remove_element(result: &mut String, start: usize, tag: &str) -> usize {
    let bytes = result.as_bytes();
    let after_open = start + 1 + tag.len(); // skip past "<tag"
    let close = find_tag_close(bytes, after_open);

    let after_open_tag = match close {
        Some(gt) => gt + 1,
        None => {
            result.replace_range(start.., "");
            return start;
        }
    };

    // Self-closing: `<tag ... />`
    let trimmed = bytes[start..after_open_tag]
        .iter()
        .rev()
        .take_while(|b| b.is_ascii_whitespace())
        .count();
    if after_open_tag >= 3
        && bytes
            .get(after_open_tag.wrapping_sub(trimmed + 1))
            .is_some_and(|&b| b == b'/')
    {
        // self-closing — just remove the opening tag
        result.replace_range(start..after_open_tag, "");
        return start;
    }

    // Find matching close tag
    if let Some(end) = find_close_tag(result, tag, after_open_tag) {
        result.replace_range(start..end, "");
    } else {
        // No closing tag — remove everything from open tag to end
        result.replace_range(start.., "");
    }
    start
}

/// Check whether `pos` is inside an opening HTML tag's attribute area.
/// Walks backwards from `pos` to find the nearest `<`. If that `<` starts
/// an opening tag (not a close tag `</`), then `pos` is in attribute space.
fn inside_open_tag(bytes: &[u8], pos: usize) -> bool {
    if pos == 0 {
        return false;
    }
    // Walk backwards looking for `<`
    let mut i = pos;
    while i > 0 {
        i -= 1;
        if bytes[i] == b'>' {
            // We crossed a tag boundary — we're in text content
            return false;
        }
        if bytes[i] == b'<' {
            // Found an opening bracket
            // Check it's not a close tag `</`
            if i + 1 < bytes.len() && bytes[i + 1] == b'/' {
                return false;
            }
            return true;
        }
    }
    false
}

/// Remove all event-handler attributes (onclick, onload, etc.) from the string.
fn strip_event_handlers(s: &str) -> String {
    let mut result = s.to_string();
    let prefixes = [
        "onload",
        "onerror",
        "onclick",
        "ondblclick",
        "onmousedown",
        "onmouseup",
        "onmouseover",
        "onmousemove",
        "onmouseout",
        "onfocus",
        "onblur",
        "onchange",
        "onsubmit",
        "onreset",
        "onselect",
        "onscroll",
        "onwheel",
        "onkeydown",
        "onkeyup",
        "onkeypress",
        "oninput",
        "onabort",
        "onbeforeunload",
        "onhashchange",
        "onpageshow",
        "onpagehide",
        "onpopstate",
        "onresize",
        "onstorage",
        "ontoggle",
        "onpointerdown",
        "onpointerup",
        "onpointermove",
        "onpointerover",
        "onpointerout",
        "onpointerenter",
        "onpointerleave",
        "onpointercancel",
        "ongotpointercapture",
        "onlostpointercapture",
        "ontouchstart",
        "ontouchend",
        "ontouchmove",
        "ontouchcancel",
        "onanimationstart",
        "onanimationend",
        "onanimationiteration",
        "ontransitionstart",
        "ontransitionrun",
        "ontransitionend",
        "ontransitioncancel",
    ];

    loop {
        let bytes = result.as_bytes();
        let mut found = false;
        for prefix in &prefixes {
            let pbytes = prefix.as_bytes();
            if let Some(pos) = find_ci(bytes, pbytes) {
                // Must be inside an opening tag's attribute area
                if !inside_open_tag(bytes, pos) {
                    continue;
                }

                // Verify preceded by a word-boundary (space/tab/> or start of tag attrs)
                if pos > 0 {
                    let before = bytes[pos - 1];
                    if before != b' ' && before != b'\t' && before != b'>' {
                        continue;
                    }
                }

                // Find end of attribute value
                let after = pos + pbytes.len();
                // Skip any whitespace and '='
                let mut val_start = after;
                while val_start < bytes.len()
                    && (bytes[val_start] == b' ' || bytes[val_start] == b'\t')
                {
                    val_start += 1;
                }

                let attr_end = if val_start < bytes.len() && bytes[val_start] == b'=' {
                    val_start += 1; // skip '='
                    // Skip whitespace after =
                    while val_start < bytes.len()
                        && (bytes[val_start] == b' ' || bytes[val_start] == b'\t')
                    {
                        val_start += 1;
                    }
                    // Find end of value
                    if val_start < bytes.len()
                        && (bytes[val_start] == b'"' || bytes[val_start] == b'\'')
                    {
                        let quote = bytes[val_start];
                        val_start += 1;
                        // Find matching quote
                        let closing = bytes[val_start..].iter().position(|&b| b == quote);
                        match closing {
                            Some(close) => val_start + close + 1,
                            None => bytes.len(),
                        }
                    } else if val_start < bytes.len() && bytes[val_start] != b'>' {
                        // Unquoted value (to next space or >)
                        let end = bytes[val_start..]
                            .iter()
                            .position(|&b| b == b' ' || b == b'\t' || b == b'>');
                        match end {
                            Some(e) => val_start + e,
                            None => bytes.len(),
                        }
                    } else {
                        val_start // no value
                    }
                } else {
                    pos + pbytes.len() // no assignment, just the attribute name
                };

                // Remove the attribute including any preceding space
                let remove_start = if pos > 0 && (bytes[pos - 1] == b' ' || bytes[pos - 1] == b'\t')
                {
                    pos - 1
                } else {
                    pos
                };
                result.replace_range(remove_start..attr_end, "");
                found = true;
                break;
            }
        }
        if !found {
            break;
        }
    }

    result
}

/// Check whether `pos` lies inside an HTML attribute value by scanning
/// backwards from `pos` looking for an opening quote that was preceded
/// by `=`.
fn inside_attr_value(bytes: &[u8], pos: usize) -> bool {
    // Walk backwards over whitespace, then look for =" or ='
    let mut i = pos;
    // skip spaces / tabs
    while i > 0 && (bytes[i - 1] == b' ' || bytes[i - 1] == b'\t') {
        i -= 1;
    }
    if i == 0 {
        return false;
    }
    let quote = bytes[i - 1];
    if quote != b'"' && quote != b'\'' {
        return false;
    }
    // skip the quote
    let j = i - 1;
    if j == 0 {
        return false;
    }
    // skip spaces between = and quote
    let mut k = j;
    while k > 0 && (bytes[k - 1] == b' ' || bytes[k - 1] == b'\t') {
        k -= 1;
    }
    if k > 0 && bytes[k - 1] == b'=' {
        return true;
    }
    false
}

/// Strip dangerous protocol prefixes that appear inside attribute values.
fn strip_dangerous_protocols(s: &str) -> String {
    let mut result = s.to_string();
    let protocols = ["javascript:", "vbscript:", "data:text/html"];

    let mut changed = true;
    while changed {
        changed = false;
        let bytes = result.as_bytes();
        for proto in &protocols {
            let pbytes = proto.as_bytes();
            if let Some(pos) = find_ci(bytes, pbytes)
                && inside_attr_value(bytes, pos)
            {
                result.replace_range(pos..pos + proto.len(), "safe-");
                changed = true;
                break;
            }
        }
    }

    result
}

/// Sanitize HTML by removing dangerous tags and attributes.
///
/// This function removes:
/// - Dangerous elements (script, iframe, object, etc.) and their content
/// - Event handler attributes (onclick, onload, etc.)
/// - Dangerous URL protocols (javascript:, vbscript:, data:text/html) in href and src attributes
#[must_use]
pub fn sanitize_html(html: &str) -> String {
    let dangerous_tags = [
        "script", "iframe", "object", "embed", "form", "link", "meta", "base", "svg", "math",
    ];

    let mut result = html.to_string();
    for tag in &dangerous_tags {
        let open = format!("<{tag}");
        let close = format!("</{tag}");
        let obytes = open.as_bytes();
        let cbytes = close.as_bytes();

        // Remove open tags (with their content up to matching close tag)
        let mut search_from = 0;
        loop {
            if search_from >= result.len() {
                break;
            }
            let hbytes = result.as_bytes();
            let tail = &hbytes[search_from..];
            let Some(pos) = find_ci(tail, obytes) else {
                break;
            };
            let p = search_from + pos;

            let after_tag = p + open.len();
            if is_tag_boundary(hbytes, after_tag) {
                remove_element(&mut result, p, tag);
            } else {
                search_from = p + 1;
            }
        }

        // Remove orphan close tags (e.g. `</script>` without a matching open)
        search_from = 0;
        loop {
            if search_from >= result.len() {
                break;
            }
            let hbytes = result.as_bytes();
            let tail = &hbytes[search_from..];
            let Some(pos) = find_ci(tail, cbytes) else {
                break;
            };
            let p = search_from + pos;

            // Verify it's a close tag: after </tag there must be optional whitespace then >
            let after_name = p + close.len();
            let mut i = after_name;
            while i < hbytes.len()
                && (hbytes[i] == b' '
                    || hbytes[i] == b'\t'
                    || hbytes[i] == b'\n'
                    || hbytes[i] == b'\r')
            {
                i += 1;
            }
            if i < hbytes.len() && hbytes[i] == b'>' {
                let end = i + 1;
                result.replace_range(p..end, "");
            } else {
                search_from = p + 1;
            }
        }
    }

    strip_dangerous_protocols(&strip_event_handlers(&result))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sanitize_plain_text() {
        let result = sanitize_html("Hello World");
        assert_eq!(
            result, "Hello World",
            "plain text should pass through unchanged"
        );
    }

    #[test]
    fn test_sanitize_empty_input() {
        assert_eq!(sanitize_html(""), "");
        assert_eq!(sanitize_html("   "), "   ");
    }

    #[test]
    fn test_sanitize_script_stripped() {
        let result = sanitize_html("<script>alert('xss')</script><p>text</p>");
        assert!(!result.contains("script"), "script tag should be removed");
        assert!(result.contains("<p>"), "safe tags should remain");
    }

    #[test]
    fn test_sanitize_iframe_stripped() {
        let result = sanitize_html("<iframe src='https://evil.com'></iframe>");
        assert!(!result.contains("iframe"), "iframe tag should be removed");
    }

    #[test]
    fn test_sanitize_onclick_removed() {
        let result = sanitize_html(r#"<button onclick="alert('xss')">Click</button>"#);
        assert!(
            !result.contains("onclick"),
            "onclick handler should be removed"
        );
    }

    #[test]
    fn test_sanitize_onload_removed() {
        let result = sanitize_html(r#"<div onload="evil()">content</div>"#);
        assert!(
            !result.contains("onload"),
            "onload handler should be removed"
        );
    }

    #[test]
    fn test_sanitize_javascript_uri_removed() {
        let result = sanitize_html(r#"<a href="javascript:alert(1)">link</a>"#);
        assert!(
            !result.contains("javascript:"),
            "javascript: proto should be removed"
        );
    }

    #[test]
    fn test_sanitize_case_insensitive() {
        let result = sanitize_html("<SCRIPT>alert('xss')</SCRIPT>");
        assert!(
            !result.contains("SCRIPT"),
            "case variants should be stripped"
        );
    }

    #[test]
    fn test_sanitize_safe_html_preserved() {
        let result = sanitize_html("<p><strong>Hello</strong> <em>World</em></p>");
        assert_eq!(result, "<p><strong>Hello</strong> <em>World</em></p>");
    }

    #[test]
    fn test_sanitize_nested_dangerous() {
        let result = sanitize_html("<div><span><script>evil()</script></span></div>");
        assert!(
            !result.contains("script"),
            "nested script should be removed"
        );
    }

    #[test]
    fn test_sanitize_form_stripped_input_preserved() {
        let result = sanitize_html("<form action='https://evil.com'><input></form>");
        assert!(!result.contains("form"), "form tag should be removed");
    }

    #[test]
    fn test_sanitize_svg_stripped() {
        let result = sanitize_html("<svg onload='evil()'><path d='...'/></svg>");
        assert!(!result.contains("svg"), "svg tag should be removed");
    }

    #[test]
    fn test_sanitize_math_stripped() {
        let result = sanitize_html("<math><mi>x</mi></math>");
        assert!(!result.contains("math"), "math tag should be removed");
    }

    #[test]
    fn test_sanitize_leaves_no_script_content() {
        let result = sanitize_html("<script>alert('xss')</script><p>text</p>");
        assert!(
            !result.contains("alert"),
            "script content should be removed"
        );
        assert!(!result.contains("script"), "script tag should be removed");
        assert!(result.contains("<p>"), "safe tags should remain");
        assert!(result.contains("text"), "safe content should remain");
    }

    #[test]
    fn test_sanitize_script_without_closing() {
        let result = sanitize_html("<script>alert(1)<p>text</p>");
        assert!(
            !result.contains("alert"),
            "script content should be removed"
        );
        assert!(
            !result.contains("<p>"),
            "content after orphaned script tag should be removed"
        );
    }

    #[test]
    fn test_sanitize_nested_dangerous_content_removed() {
        let result = sanitize_html("<div><span><script>evil()</script></span></div>");
        assert!(!result.contains("evil"), "nested script content removed");
        assert!(!result.contains("script"), "nested script tag removed");
    }

    #[test]
    fn test_sanitize_onclick_preserves_html_structure() {
        let result = sanitize_html(r#"<button onclick="alert('xss')">Click</button>"#);
        assert!(
            !result.contains("onclick"),
            "onclick handler should be removed"
        );
        assert!(!result.contains("alert"), "handler value should be removed");
        assert!(
            result.contains("<button>") || result.contains("<button >"),
            "button tag structure preserved"
        );
        assert!(result.contains("Click"), "visible text preserved");
    }

    #[test]
    fn test_sanitize_multiple_event_handlers() {
        let result =
            sanitize_html(r#"<div onclick="a()" onmouseover="b()" onfocus="c()">text</div>"#);
        assert!(!result.contains("onclick"), "onclick removed");
        assert!(!result.contains("onmouseover"), "onmouseover removed");
        assert!(!result.contains("onfocus"), "onfocus removed");
        assert!(
            result.contains("<div>") || result.contains("<div >"),
            "div structure OK"
        );
        assert!(result.contains("text"), "text preserved");
    }

    #[test]
    fn test_sanitize_javascript_uri_in_href_removed() {
        let result = sanitize_html(r#"<a href="javascript:alert(1)">link</a>"#);
        assert!(
            !result.contains("javascript:"),
            "javascript: proto should be removed"
        );
        assert!(result.contains("link"), "link text preserved");
    }

    #[test]
    fn test_sanitize_self_closing_tag() {
        let result = sanitize_html(r#"<br><img src="x" onerror="evil()"><hr>"#);
        assert!(!result.contains("onerror"), "onerror handler removed");
        assert!(
            result.contains("<br>") || result.contains("<br/>") || result.contains("<br />"),
            "br preserved"
        );
        assert!(
            result.contains("<hr>") || result.contains("<hr/>") || result.contains("<hr />"),
            "hr preserved"
        );
    }

    #[test]
    fn test_sanitize_no_false_positives_on_normal_content() {
        let result = sanitize_html(
            "<p>Check out this section on <strong>math</strong> and <em>script</em></p>",
        );
        assert!(result.contains("math"), "word 'math' in content preserved");
        assert!(
            result.contains("script"),
            "word 'script' in content preserved"
        );
        assert!(!result.contains("alert"), "safe output has no alert");
    }

    // ────────────────────────────────────────────
    // Helper function unit tests
    // ────────────────────────────────────────────

    #[test]
    fn test_find_ci_basic() {
        assert_eq!(find_ci(b"hello world", b"world"), Some(6));
        assert_eq!(find_ci(b"hello world", b"World"), Some(6));
        assert_eq!(find_ci(b"HELLO WORLD", b"world"), Some(6));
        assert_eq!(find_ci(b"hello", b"xyz"), None);
        assert_eq!(find_ci(b"", b"abc"), None);
    }

    #[test]
    fn test_find_tag_close_basic() {
        // <div> — search from position 1 (after <)
        assert_eq!(find_tag_close(b"<div>", 1), Some(4));
        // <div class='x'> — the > is at index 14
        assert_eq!(find_tag_close(b"<div class='x'>text", 1), Some(14));
        // <div class="x"> — same structure
        assert_eq!(find_tag_close(b"<div class=\"x\">text", 1), Some(14));
        // past the closing >
        assert_eq!(find_tag_close(b"<div>", 5), None);
    }

    #[test]
    fn test_find_tag_close_quoted_gt() {
        // <div title="a>b"> — the > at index 13 is inside quotes;
        // the real tag-close > is at index 16.
        let html = br#"<div title="a>b">"#;
        assert_eq!(find_tag_close(html, 1), Some(16));
    }

    #[test]
    fn test_find_tag_close_single_quoted_gt() {
        // <div title='a>b'> — same structure with single quotes.
        let html = b"<div title='a>b'>";
        assert_eq!(find_tag_close(html, 1), Some(16));
    }

    #[test]
    fn test_inside_attr_value_cases() {
        // Standard: href="javascript:..."
        let html = r#"<a href="javascript:alert(1)">"#;
        let pos = html.find("javascript:").unwrap();
        assert!(inside_attr_value(html.as_bytes(), pos));

        // With spaces: href = "javascript:..."
        let html2 = r#"<a href = "javascript:alert(1)">"#;
        let pos2 = html2.find("javascript:").unwrap();
        assert!(inside_attr_value(html2.as_bytes(), pos2));

        // Single quotes
        let html3 = r#"<a href='javascript:alert(1)'>"#;
        let pos3 = html3.find("javascript:").unwrap();
        assert!(inside_attr_value(html3.as_bytes(), pos3));

        // Not in attribute value (plain text)
        let text = b"javascript:alert(1)";
        assert!(!inside_attr_value(text, 0));

        // Not in attribute value — just a word in text
        let plain = b"use javascript: wisely";
        let pos4 = 4; // position of "javascript:"
        assert!(!inside_attr_value(plain, pos4));
    }

    // ────────────────────────────────────────────
    // Tag removal: edge cases
    // ────────────────────────────────────────────

    #[test]
    fn test_script_with_attributes() {
        let result = sanitize_html(r#"<script type="text/javascript">evil()</script><p>ok</p>"#);
        assert!(!result.contains("script"), "script tag removed");
        assert!(!result.contains("evil"), "script content removed");
        assert!(result.contains("<p>"), "safe tag preserved");
        assert!(result.contains("ok"), "safe content preserved");
    }

    #[test]
    fn test_script_with_single_quote_attrs() {
        let result = sanitize_html("<script type='text/javascript'>evil()</script><p>ok</p>");
        assert!(!result.contains("evil"));
        assert!(result.contains("ok"));
    }

    #[test]
    fn test_multiple_script_tags() {
        let result = sanitize_html("<script>a()</script>safe<script>b()</script>");
        assert!(!result.contains("script"));
        assert!(!result.contains("a()"));
        assert!(!result.contains("b()"));
        assert!(result.contains("safe"));
    }

    #[test]
    fn test_nested_same_dangerous_tag() {
        let result = sanitize_html("<script><script>nested()</script></script><p>ok</p>");
        assert!(!result.contains("script"));
        assert!(!result.contains("nested"));
        assert!(result.contains("ok"));
    }

    #[test]
    fn test_dangerous_tag_with_newlines() {
        let result = sanitize_html("<script\n>\nevil()\n</script\n><p>ok</p>");
        assert!(!result.contains("script"));
        assert!(!result.contains("evil"));
        assert!(result.contains("ok"));
    }

    #[test]
    fn test_dangerous_tag_with_spaces_before_close() {
        let result = sanitize_html("<script >evil()</script ><p>ok</p>");
        assert!(!result.contains("script"));
        assert!(!result.contains("evil"));
        assert!(result.contains("ok"));
    }

    #[test]
    fn test_object_with_params() {
        let result =
            sanitize_html(r#"<object data="evil.swf"><param name="x" value="y"></object>"#);
        assert!(!result.contains("object"));
        assert!(!result.contains("param"));
    }

    #[test]
    fn test_embed_tag() {
        let result =
            sanitize_html(r#"<embed src="evil.swf" type="application/x-shockwave-flash">"#);
        assert!(!result.contains("embed"));
        assert!(!result.contains("evil"));
    }

    #[test]
    fn test_base_tag() {
        let result = sanitize_html(r#"<base href="https://evil.com/">"#);
        assert!(!result.contains("base"));
    }

    #[test]
    fn test_meta_tag() {
        let result =
            sanitize_html(r#"<meta http-equiv="refresh" content="0;url=https://evil.com">"#);
        assert!(!result.contains("meta"));
    }

    #[test]
    fn test_link_tag() {
        let result = sanitize_html(r#"<link rel="stylesheet" href="evil.css">"#);
        assert!(!result.contains("link"));
    }

    #[test]
    fn test_form_with_inputs() {
        let result = sanitize_html(
            r#"<form action="https://evil.com"><input name="user"><button>Go</button></form>"#,
        );
        assert!(!result.contains("form"));
    }

    #[test]
    fn test_svg_with_onload() {
        let result =
            sanitize_html(r#"<svg onload="alert(1)"><rect width="100" height="100"/></svg>"#);
        assert!(!result.contains("svg"));
        assert!(!result.contains("onload"));
    }

    #[test]
    fn test_math_tag_with_content() {
        let result = sanitize_html("<math><mrow><mi>x</mi></mrow></math>");
        assert!(!result.contains("math"));
    }

    #[test]
    fn test_self_closing_script() {
        let result = sanitize_html("<script />");
        assert!(!result.contains("script"));
    }

    #[test]
    fn test_self_closing_script_with_space() {
        let result = sanitize_html("<script  />");
        assert!(!result.contains("script"));
    }

    #[test]
    fn test_only_opening_script_no_content() {
        let result = sanitize_html("before<script>");
        assert!(result.contains("before"));
        assert!(!result.contains("script"));
    }

    #[test]
    fn test_only_closing_script() {
        let result = sanitize_html("</script>after");
        assert!(
            !result.contains("script"),
            "orphan </script> should be removed"
        );
        assert!(
            result.contains("after"),
            "text after orphan close tag preserved"
        );
    }

    #[test]
    fn test_case_insensitive_script() {
        for tag in ["<SCRIPT>", "<Script>", "<sCrIpT>", "<script>"] {
            let result = sanitize_html(&format!("{tag}evil()</script>"));
            assert!(!result.contains("evil"), "failed for tag: {tag}");
        }
    }

    #[test]
    fn test_tag_name_not_confused_by_longer_name() {
        let result = sanitize_html("<scripting>safe content</scripting>");
        assert!(
            result.contains("scripting") || result.contains("safe content"),
            "custom <scripting> tag should not be confused with <script>"
        );
    }

    #[test]
    fn test_mixed_dangerous_tags() {
        let result = sanitize_html("<script>a()</script><iframe>b()</iframe><p>ok</p>");
        assert!(!result.contains("script"));
        assert!(!result.contains("iframe"));
        assert!(!result.contains("a()"));
        assert!(!result.contains("b()"));
        assert!(result.contains("ok"));
    }

    #[test]
    fn test_deeply_nested_dangerous() {
        let result = sanitize_html("<div><p><span><b><script>deep()</script></b></span></p></div>");
        assert!(!result.contains("deep"));
        assert!(!result.contains("script"));
        assert!(result.contains("<div>"));
    }

    // ────────────────────────────────────────────
    // Event handler removal
    // ────────────────────────────────────────────

    #[test]
    fn test_onerror_on_img() {
        let result = sanitize_html(r#"<img src="x" onerror="alert(1)">"#);
        assert!(!result.contains("onerror"));
        assert!(!result.contains("alert"));
        assert!(result.contains("img"));
        assert!(result.contains("src"));
    }

    #[test]
    fn test_onclick_single_quotes() {
        let result = sanitize_html("<button onclick='alert(1)'>Click</button>");
        assert!(!result.contains("onclick"));
        assert!(result.contains("Click"));
    }

    #[test]
    fn test_onclick_unquoted_value() {
        let result = sanitize_html(r#"<div onclick=alert(1)>text</div>"#);
        assert!(!result.contains("onclick"));
        assert!(result.contains("text"));
    }

    #[test]
    fn test_onclick_with_spaces_around_equals() {
        let result = sanitize_html(r#"<div onclick = "alert(1)">text</div>"#);
        assert!(!result.contains("onclick"));
        assert!(result.contains("text"));
    }

    #[test]
    fn test_onfocus_handler() {
        let result = sanitize_html(r#"<input onfocus="evil()">"#);
        assert!(!result.contains("onfocus"));
    }

    #[test]
    fn test_onblur_handler() {
        let result = sanitize_html(r#"<input onblur="evil()">"#);
        assert!(!result.contains("onblur"));
    }

    #[test]
    fn test_onmouseover_handler() {
        let result = sanitize_html(r#"<div onmouseover="evil()">hover</div>"#);
        assert!(!result.contains("onmouseover"));
        assert!(result.contains("hover"));
    }

    #[test]
    fn test_onsubmit_handler() {
        let result = sanitize_html(r#"<div onsubmit="evil()">text</div>"#);
        assert!(!result.contains("onsubmit"));
    }

    #[test]
    fn test_onkeydown_handler() {
        let result = sanitize_html(r#"<input onkeydown="evil()">"#);
        assert!(!result.contains("onkeydown"));
    }

    #[test]
    fn test_oninput_handler() {
        let result = sanitize_html(r#"<input oninput="evil()">"#);
        assert!(!result.contains("oninput"));
    }

    #[test]
    fn test_multiple_handlers_same_element() {
        let result = sanitize_html(
            r#"<div onclick="a()" onmouseover="b()" onfocus="c()" onblur="d()">text</div>"#,
        );
        assert!(!result.contains("onclick"));
        assert!(!result.contains("onmouseover"));
        assert!(!result.contains("onfocus"));
        assert!(!result.contains("onblur"));
        assert!(result.contains("text"));
    }

    #[test]
    fn test_handler_preserves_other_attributes() {
        let result = sanitize_html(
            r#"<div class="box" id="main" onclick="evil()" title="hello">text</div>"#,
        );
        assert!(!result.contains("onclick"));
        assert!(!result.contains("evil"));
        assert!(result.contains(r#"class="box""#));
        assert!(result.contains(r#"id="main""#));
        assert!(result.contains(r#"title="hello""#));
        assert!(result.contains("text"));
    }

    #[test]
    fn test_handler_at_start_of_tag() {
        let result = sanitize_html(r#"<div onclick="evil()" class="ok">text</div>"#);
        assert!(!result.contains("onclick"));
        assert!(result.contains(r#"class="ok""#));
    }

    #[test]
    fn test_handler_at_end_of_tag() {
        let result = sanitize_html(r#"<div class="ok" onclick="evil()">text</div>"#);
        assert!(!result.contains("onclick"));
        assert!(result.contains(r#"class="ok""#));
    }

    #[test]
    fn test_ontouchstart_handler() {
        let result = sanitize_html(r#"<div ontouchstart="evil()">text</div>"#);
        assert!(!result.contains("ontouchstart"));
    }

    #[test]
    fn test_onanimationstart_handler() {
        let result = sanitize_html(r#"<div onanimationstart="evil()">text</div>"#);
        assert!(!result.contains("onanimationstart"));
    }

    // ────────────────────────────────────────────
    // Protocol stripping
    // ────────────────────────────────────────────

    #[test]
    fn test_javascript_protocol_in_href() {
        let result = sanitize_html(r#"<a href="javascript:alert(1)">click</a>"#);
        assert!(!result.contains("javascript:"));
        assert!(result.contains("click"));
    }

    #[test]
    fn test_javascript_protocol_in_src() {
        let result = sanitize_html(r#"<img src="javascript:alert(1)">"#);
        assert!(!result.contains("javascript:"));
    }

    #[test]
    fn test_vbscript_protocol() {
        let result = sanitize_html(r#"<a href="vbscript:MsgBox(1)">click</a>"#);
        assert!(!result.contains("vbscript:"));
    }

    #[test]
    fn test_data_text_html_protocol() {
        let result =
            sanitize_html(r#"<a href="data:text/html,<script>alert(1)</script>">click</a>"#);
        assert!(!result.contains("data:text/html"));
    }

    #[test]
    fn test_javascript_case_insensitive() {
        let result = sanitize_html(r#"<a href="JaVaScRiPt:alert(1)">click</a>"#);
        assert!(
            !result.contains("javascript:"),
            "case-insensitive protocol should be stripped"
        );
        assert!(
            !result.contains("JaVaScRiPt:"),
            "case-insensitive protocol should be stripped"
        );
    }

    #[test]
    fn test_javascript_with_spaces_around_equals() {
        let result = sanitize_html(r#"<a href = "javascript:alert(1)">click</a>"#);
        assert!(
            !result.contains("javascript:"),
            "protocol with spaces around = should be stripped"
        );
    }

    #[test]
    fn test_javascript_with_single_quotes() {
        let result = sanitize_html("<a href='javascript:alert(1)'>click</a>");
        assert!(!result.contains("javascript:"));
    }

    #[test]
    fn test_safe_href_preserved() {
        let result = sanitize_html(r#"<a href="https://example.com/page">link</a>"#);
        assert!(result.contains(r#"href="https://example.com/page""#));
    }

    #[test]
    fn test_safe_src_preserved() {
        let result = sanitize_html(r#"<img src="https://example.com/img.png">"#);
        assert!(result.contains(r#"src="https://example.com/img.png""#));
    }

    #[test]
    fn test_protocol_in_plain_text_not_stripped() {
        let result = sanitize_html("Learn about javascript: protocol schemes");
        assert!(
            result.contains("javascript:"),
            "javascript: in plain text should NOT be stripped"
        );
    }

    #[test]
    fn test_protocol_in_non_url_attribute_conservative() {
        // Note: strip_dangerous_protocols replaces dangerous protocols in ANY
        // attribute value context (not just href/src). This is intentionally
        // conservative — it may replace benign uses like title="javascript: ..."
        // but guarantees no protocol-based XSS vector survives.
        let result = sanitize_html(r#"<div title="javascript: is a protocol">text</div>"#);
        assert!(
            !result.contains("javascript:"),
            "protocol in attribute value is stripped"
        );
        assert!(result.contains("text"));
    }

    // ────────────────────────────────────────────
    // Combination attacks
    // ────────────────────────────────────────────

    #[test]
    fn test_script_with_event_handler_and_protocol() {
        let result =
            sanitize_html(r#"<script onclick="evil()" src="javascript:alert(1)">payload</script>"#);
        assert!(!result.contains("script"));
        assert!(!result.contains("payload"));
    }

    #[test]
    fn test_svg_with_script_child() {
        let result = sanitize_html("<svg><script>alert(1)</script></svg>");
        assert!(!result.contains("script"));
        assert!(!result.contains("svg"));
        assert!(!result.contains("alert"));
    }

    #[test]
    fn test_img_onerror_with_javascript_src() {
        let result = sanitize_html(r#"<img src="javascript:alert(1)" onerror="evil()">"#);
        assert!(!result.contains("onerror"));
        assert!(!result.contains("javascript:"));
    }

    #[test]
    fn test_div_with_handler_and_safe_content() {
        let result = sanitize_html(
            r#"<div onclick="evil()"><p>Safe paragraph</p><span>and span</span></div>"#,
        );
        assert!(!result.contains("onclick"));
        assert!(result.contains("<p>Safe paragraph</p>"));
        assert!(result.contains("<span>and span</span>"));
    }

    #[test]
    fn test_script_breakout_attempt() {
        // Attacker tries to break out of a script attribute
        let result =
            sanitize_html(r#"<script>var x = "</script><img onerror=alert(1) src=x>//"</script>"#);
        assert!(
            !result.contains("onerror"),
            "event handler after script breakout should be stripped"
        );
    }

    // ────────────────────────────────────────────
    // Boundary / edge cases
    // ────────────────────────────────────────────

    #[test]
    fn test_empty_tags() {
        assert_eq!(sanitize_html("<script></script>"), "");
        assert_eq!(sanitize_html("<iframe></iframe>"), "");
        assert_eq!(sanitize_html("<object></object>"), "");
    }

    #[test]
    fn test_only_whitespace() {
        assert_eq!(sanitize_html("   \t\n  "), "   \t\n  ");
    }

    #[test]
    fn test_unicode_content() {
        let result = sanitize_html("<p>你好世界 🌍</p>");
        assert_eq!(result, "<p>你好世界 🌍</p>");
    }

    #[test]
    fn test_unicode_in_script() {
        let result = sanitize_html("<script>日本語</script><p>安全的</p>");
        assert!(!result.contains("script"));
        assert!(result.contains("安全的"));
    }

    #[test]
    fn test_very_long_safe_content() {
        let long = "a".repeat(100_000);
        let result = sanitize_html(&format!("<p>{long}</p>"));
        assert!(result.contains(&long));
    }

    #[test]
    fn test_html_entities_preserved() {
        let result = sanitize_html("<p>&lt;script&gt;not a tag&lt;/script&gt;</p>");
        assert!(
            result.contains("&lt;script&gt;"),
            "HTML entities should be preserved"
        );
    }

    #[test]
    fn test_multiple_p_safe_tags() {
        let result = sanitize_html("<p>one</p><p>two</p><p>three</p>");
        assert_eq!(result, "<p>one</p><p>two</p><p>three</p>");
    }

    #[test]
    fn test_attribute_with_gt_inside_quotes() {
        let result = sanitize_html(r#"<div title="a > b">text</div>"#);
        assert!(result.contains("text"));
        assert!(result.contains("title"));
    }

    #[test]
    fn test_attribute_with_lt_inside_quotes() {
        let result = sanitize_html(r#"<div title="a < b">text</div>"#);
        assert!(result.contains("text"));
    }

    #[test]
    fn test_nested_quotes_different_type() {
        let result = sanitize_html(r#"<div title="it's 'quoted'">text</div>"#);
        assert!(result.contains("text"));
        assert!(result.contains("title"));
    }

    #[test]
    fn test_onclick_in_text_not_stripped() {
        let result = sanitize_html("<p>Use onclick to handle clicks</p>");
        assert!(
            result.contains("onclick"),
            "onclick in text content should be preserved"
        );
    }

    #[test]
    fn test_word_link_in_text_preserved() {
        let result = sanitize_html("<p>Click the link below</p>");
        assert!(result.contains("link"), "word 'link' in text preserved");
    }

    #[test]
    fn test_word_form_in_text_preserved() {
        let result = sanitize_html("<p>Fill in the form below</p>");
        assert!(result.contains("form"), "word 'form' in text preserved");
    }

    #[test]
    fn test_style_tag_in_script_context() {
        let result = sanitize_html("<style>body{color:red}</style><p>text</p>");
        assert!(
            result.contains("<style>"),
            "style is not in dangerous tags list"
        );
        assert!(result.contains("text"));
    }

    #[test]
    fn test_consecutive_dangerous_tags() {
        let result =
            sanitize_html("<script>a()</script><script>b()</script><script>c()</script><p>ok</p>");
        assert!(!result.contains("script"));
        assert!(!result.contains("a()"));
        assert!(!result.contains("b()"));
        assert!(!result.contains("c()"));
        assert!(result.contains("ok"));
    }

    #[test]
    fn test_dangerous_tag_surrounded_by_safe() {
        let result = sanitize_html("<p>before</p><script>evil()</script><p>after</p>");
        assert!(result.contains("<p>before</p>"));
        assert!(result.contains("<p>after</p>"));
        assert!(!result.contains("script"));
        assert!(!result.contains("evil"));
    }

    #[test]
    fn test_no_attributes_on_dangerous_tag() {
        let result = sanitize_html("<script>evil()</script>");
        assert_eq!(result, "");
    }

    #[test]
    fn test_tab_in_tag() {
        // <script\t...> is malformed HTML; our parser treats the entire
        // region up to the </script> closing > as part of the script element
        // and removes it all — which is safe (over-removal, not under-removal).
        let result = sanitize_html("<script\tevil()</script><p>ok</p>");
        assert!(!result.contains("script"));
        assert!(!result.contains("evil"));
    }

    // ────────────────────────────────────────────
    // Regression: ensure original tests still pass
    // ────────────────────────────────────────────

    #[test]
    fn regression_original_plain_text() {
        assert_eq!(sanitize_html("Hello World"), "Hello World");
    }

    #[test]
    fn regression_original_empty() {
        assert_eq!(sanitize_html(""), "");
        assert_eq!(sanitize_html("   "), "   ");
    }

    #[test]
    fn regression_original_script_stripped() {
        let result = sanitize_html("<script>alert('xss')</script><p>text</p>");
        assert!(!result.contains("script"));
        assert!(result.contains("<p>"));
    }

    #[test]
    fn regression_original_safe_html_preserved() {
        let result = sanitize_html("<p><strong>Hello</strong> <em>World</em></p>");
        assert_eq!(result, "<p><strong>Hello</strong> <em>World</em></p>");
    }
}
