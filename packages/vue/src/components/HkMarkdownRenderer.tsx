import { defineComponent, computed } from "vue";

const ESCAPE_MAP: Record<string, string> = {
  "&": "&amp;", "<": "&lt;", ">": "&gt;",
};

function escapeHtml(text: string): string {
  return text.replace(/[&<>]/g, (c) => ESCAPE_MAP[c] || c);
}

function renderMarkdown(md: string): string {
  let html = escapeHtml(md);

  // Code blocks (fenced)
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_m, lang, code) => {
    const escaped = escapeHtml(code.trimEnd());
    return `<pre class="hk-md-pre"><code class="hk-md-code${lang ? ` language-${lang}` : ""}">${escaped}</code></pre>`;
  });

  // Inline code
  html = html.replace(/`([^`]+)`/g, "<code class=\"hk-md-inline\">$1</code>");

  // Bold + italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>");
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");

  // Headers
  html = html.replace(/^#### (.+)$/gm, "<h4>$1</h4>");
  html = html.replace(/^### (.+)$/gm, "<h3>$1</h3>");
  html = html.replace(/^## (.+)$/gm, "<h2>$1</h2>");
  html = html.replace(/^# (.+)$/gm, "<h1>$1</h1>");

  // Unordered lists
  html = html.replace(/^[\*\-] (.+)$/gm, "<li>$1</li>");
  html = html.replace(/(<li>.*<\/li>\n?)+/g, "<ul>$&</ul>");

  // Ordered lists
  html = html.replace(/^\d+\. (.+)$/gm, "<li>$1</li>");

  // Blockquotes
  html = html.replace(/^> (.+)$/gm, "<blockquote>$1</blockquote>");

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

  // Horizontal rules
  html = html.replace(/^---$/gm, "<hr>");

  // Paragraphs — wrap remaining text blocks
  html = html.replace(/\n{2,}/g, "</p><p>");
  html = `<p>${html}</p>`;
  html = html.replace(/<p>\s*<\/p>/g, "");

  return html;
}

export default defineComponent({
  name: "HkMarkdownRenderer",
  props: {
    content: { type: String, default: "" },
    inline: { type: Boolean, default: false },
  },
  setup(props) {
    const html = computed(() => renderMarkdown(props.content));

    return () => {
      if (props.inline) {
        return <span class="hk-markdown hk-markdown--inline" innerHTML={html.value} />;
      }
      return <div class="hk-markdown" innerHTML={html.value} />;
    };
  },
});
