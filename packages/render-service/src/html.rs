// hikari-render-service/src/html.rs
// HTML 服务 - 提供默认/自定义 index.html 渲染

use crate::registry::StyleRegistry;

/// HTML 服务
///
/// 用于生成带有样式的 HTML 页面
#[derive(Clone)]
pub struct HtmlService {
    title: String,
    styles: Option<String>,
    custom_head: Option<String>,
    lang: String,
    charset: String,
}

impl HtmlService {
    /// 创建新的 HTML 服务
    pub fn new() -> Self {
        Self {
            title: "Hikari App".to_string(),
            styles: None,
            custom_head: None,
            lang: "zh-CN".to_string(),
            charset: "utf-8".to_string(),
        }
    }

    /// 设置页面标题
    pub fn title(mut self, title: impl Into<String>) -> Self {
        self.title = title.into();
        self
    }

    /// 设置 CSS 样式
    pub fn styles(mut self, css: impl Into<String>) -> Self {
        self.styles = Some(css.into());
        self
    }

    /// 设置自定义 head 内容
    pub fn custom_head(mut self, html: impl Into<String>) -> Self {
        self.custom_head = Some(html.into());
        self
    }

    /// 设置语言
    pub fn lang(mut self, lang: impl Into<String>) -> Self {
        self.lang = lang.into();
        self
    }

    /// 设置字符编码
    pub fn charset(mut self, charset: impl Into<String>) -> Self {
        self.charset = charset.into();
        self
    }

    /// 使用默认 index.html 模板渲染
    pub fn render(&self, body_content: &str) -> String {
        let styles = self.styles.as_deref().unwrap_or("");
        let custom_head = self.custom_head.as_deref().unwrap_or("");

        format!(
            r#"<!DOCTYPE html>
<html lang="{lang}">
<head>
    <meta charset="{charset}">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{title}</title>
    {styles}
    {custom_head}
</head>
<body>
    <div id="main">{body}</div>
</body>
</html>"#,
            lang = self.lang,
            charset = self.charset,
            title = self.title,
            styles = styles,
            custom_head = custom_head,
            body = body_content
        )
    }

    /// 使用自定义 index.html 模板渲染
    ///
    /// 支持模板变量替换：
    /// - `{{ title }}` - 页面标题
    /// - `{{ styles }}` - CSS 样式
    /// - `{{ body }}` - 页面内容
    /// - `{{ lang }}` - 语言
    /// - `{{ charset }}` - 字符编码
    pub fn render_with_template(
        &self,
        template: &str,
        body_content: &str,
    ) -> String {
        let styles = self.styles.as_deref().unwrap_or("");

        template
            .replace("{{ title }}", &self.title)
            .replace("{{ styles }}", styles)
            .replace("{{ body }}", body_content)
            .replace("{{ lang }}", &self.lang)
            .replace("{{ charset }}", &self.charset)
    }

    /// 使用默认模板，从 StyleRegistry 生成样式
    pub fn render_with_registry(&self, registry: &StyleRegistry, body_content: &str) -> String {
        let styles = registry.css_bundle();
        let styles_tag = if !styles.is_empty() {
            format!(r#"<style type="text/css">{}</style>"#, styles)
        } else {
            String::new()
        };

        format!(
            r#"<!DOCTYPE html>
<html lang="{lang}">
<head>
    <meta charset="{charset}">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{title}</title>
    {styles}
    {custom_head}
</head>
<body>
    <div id="main">{body}</div>
</body>
</html>"#,
            lang = self.lang,
            charset = self.charset,
            title = self.title,
            styles = styles_tag,
            custom_head = self.custom_head.as_deref().unwrap_or(""),
            body = body_content
        )
    }
}

impl Default for HtmlService {
    fn default() -> Self {
        Self::new()
    }
}
