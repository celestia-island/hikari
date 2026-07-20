import { createServer } from "vite";
import { createSSRApp, h } from "vue";
import { renderToString } from "@vue/server-renderer";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(__dirname, "..", "src", "components");
const OUT = path.resolve(__dirname, "output");
fs.mkdirSync(OUT, { recursive: true });

async function renderComp(vite, name, filePath, props = {}, slotFns = {}) {
  try {
    const mod = await vite.ssrLoadModule(filePath);
    const Comp = mod.default;
    const app = createSSRApp({
      render() {
        return h(Comp, props, slotFns);
      },
    });
    const html = await renderToString(app);
    return { name, ok: true, html };
  } catch (e) {
    return { name, ok: false, error: e.message };
  }
}

async function main() {
  const vite = await createServer({
    root: path.resolve(__dirname, ".."),
    server: { middlewareMode: true },
    appType: "custom",
    plugins: [(await import("@vitejs/plugin-vue-jsx")).default()],
  });

  const f = (n) => path.join(SRC, n);

  const cases = {
    "HkButton": [{ name: "primary", file: f("HkButton.tsx"), props: { variant: "primary", size: "md" }, slots: { default: () => "Click Me" } }],
    "HkButton-loading": [{ name: "loading", file: f("HkButton.tsx"), props: { variant: "danger", loading: true, size: "lg" }, slots: { default: () => "Delete" } }],
    "HkButton-block": [{ name: "block", file: f("HkButton.tsx"), props: { variant: "outline", block: true, shortcut: "Ctrl+K" }, slots: { default: () => "Search" } }],
    "HkInput": [{ name: "default", file: f("HkInput.tsx"), props: { placeholder: "Enter text", label: "Username" } }],
    "HkInput-error": [{ name: "error", file: f("HkInput.tsx"), props: { placeholder: "Email", error: "Invalid email", label: "Email" } }],
    "HkBadge": [{ name: "primary", file: f("HkBadge.tsx"), props: { variant: "primary" }, slots: { default: () => "New" } }],
    "HkBadge-dot": [{ name: "dot", file: f("HkBadge.tsx"), props: { variant: "error", dot: true } }],
    "HkCard": [{ name: "default", file: f("HkCard.tsx"), props: { title: "Card Title", hoverable: true }, slots: { default: () => "Content", footer: () => "Footer" } }],
    "HkAlert": [{ name: "error", file: f("HkAlert.tsx"), props: { variant: "error", title: "Error", message: "Something went wrong", closable: true } }],
    "HkAlert-warning": [{ name: "warning", file: f("HkAlert.tsx"), props: { variant: "warning", message: "Proceed with caution" } }],
    "HkCheckbox": [{ name: "checked", file: f("HkCheckbox.tsx"), props: { modelValue: true, label: "Accept terms" } }],
    "HkCheckbox-unchecked": [{ name: "unchecked", file: f("HkCheckbox.tsx"), props: { modelValue: false, label: "Subscribe" } }],
    "HkRadio": [{ name: "default", file: f("HkRadio.tsx"), props: { modelValue: "a", options: [{ value: "a", label: "A" }, { value: "b", label: "B" }] } }],
    "HkSwitch": [{ name: "on", file: f("HkSwitch.tsx"), props: { modelValue: true, label: "Dark mode", checkedContent: "ON" } }],
    "HkTag": [{ name: "primary", file: f("HkTag.tsx"), props: { variant: "primary" }, slots: { default: () => "Tag" } }],
    "HkTag-closable": [{ name: "closable", file: f("HkTag.tsx"), props: { variant: "danger", closable: true }, slots: { default: () => "Remove" } }],
    "HkSpinner": [{ name: "md", file: f("HkSpinner.tsx"), props: { size: "md", text: "Loading..." } }],
    "HkSpinner-center": [{ name: "center", file: f("HkSpinner.tsx"), props: { size: "lg", center: true } }],
    "HkSkeleton": [{ name: "default", file: f("HkSkeleton.tsx"), props: { width: "200px", height: "20px" } }],
    "HkProgressBar": [{ name: "60%", file: f("HkProgressBar.tsx"), props: { value: 60, status: "loading", showLabel: true } }],
    "HkProgressBar-indeterminate": [{ name: "indeterminate", file: f("HkProgressBar.tsx"), props: { value: null } }],
    "HkProgressRing": [{ name: "75%", file: f("HkProgressRing.tsx"), props: { value: 75, size: 80, showLabel: true } }],
    "HkKbd": [{ name: "default", file: f("HkKbd.tsx"), props: { keys: "Ctrl+Shift+P" } }],
    "HkDivider": [{ name: "default", file: f("HkDivider.tsx"), props: { orientation: "horizontal", text: "or" } }],
    "HkTooltip": [{ name: "default", file: f("HkTooltip.tsx"), props: { text: "Help text" }, slots: { default: () => "Hover me" } }],
    "HkSelect": [{ name: "default", file: f("HkSelect.tsx"), props: { options: [{ value: "1", label: "Option 1" }, { value: "2", label: "Option 2" }], placeholder: "Choose..." } }],
    "HkTabs": [{ name: "default", file: f("HkTabs.tsx"), props: { modelValue: "tab1", tabs: [{ key: "tab1", label: "Tab 1" }, { key: "tab2", label: "Tab 2" }] }, slots: { tab1: () => "Content 1" } }],
    "HkTable": [{ name: "default", file: f("HkTable.tsx"), props: { columns: [{ key: "name", title: "Name" }, { key: "age", title: "Age" }], rows: [{ name: "Alice", age: 30 }, { name: "Bob", age: 25 }] } }],
    "HkTree": [{ name: "default", file: f("HkTree.tsx"), props: { nodes: [{ key: "1", label: "Root", children: [{ key: "1a", label: "Child" }] }] } }],
    "HkTimeline": [{ name: "default", file: f("HkTimeline.tsx"), props: { steps: [{ key: "1", label: "Step 1" }, { key: "2", label: "Step 2" }], currentKey: "1" } }],
    "HkEmptyState": [{ name: "default", file: f("HkEmptyState.tsx"), props: { title: "Nothing here", description: "Add some data" } }],
    "HkSidebar": [{ name: "default", file: f("HkSidebar.tsx"), props: {}, slots: { default: () => "Nav items" } }],
    "HkLogo": [{ name: "default", file: f("HkLogo.tsx"), props: { alt: "MyApp", size: "md" } }],
    "HkStatusBar": [{ name: "default", file: f("HkStatusBar.tsx"), props: { version: "1.0.0" } }],
    "HkGaugeRing": [{ name: "default", file: f("HkGaugeRing.tsx"), props: { rings: [{ pct: 65, color: "#ff6b9d", trackColor: "rgba(255,107,157,0.1)" }], centerValue: "65%" } }],
    "HkSelectionGrid": [{ name: "default", file: f("HkSelectionGrid.tsx"), props: { items: [{ id: "1", title: "Item 1" }, { id: "2", title: "Item 2" }], selectedId: "1" } }],
    "HkAdminShell": [{ name: "default", file: f("HkAdminShell.tsx"), props: {}, slots: { header: () => "Header", sidebar: () => "Sidebar", default: () => "Main" } }],
    "HkAdminHeader": [{ name: "default", file: f("HkAdminHeader.tsx"), props: { title: "Admin", username: "admin" } }],
    "HkNavItem": [{ name: "default", file: f("HkNavItem.tsx"), props: { active: true }, slots: { default: () => "Dashboard", icon: () => "📊" } }],
    "HkNumberInput": [{ name: "default", file: f("HkNumberInput.tsx"), props: { modelValue: 42 } }],
    "HkSearchInput": [{ name: "default", file: f("HkSearchInput.tsx"), props: { placeholder: "Search..." } }],
    "HkTextarea": [{ name: "default", file: f("HkTextarea.tsx"), props: { rows: 3, placeholder: "Enter text" } }],
    "HkSkeletonList": [{ name: "default", file: f("HkSkeletonList.tsx"), props: { count: 2 } }],
    "HkHoverRevealAction": [{ name: "default", file: f("HkHoverRevealAction.tsx"), props: {}, slots: { default: () => "Trigger", extension: () => "Action" } }],
    "HkSelectionWaterfall": [{ name: "default", file: f("HkSelectionWaterfall.tsx"), props: { items: [{ id: "1", title: "Item 1", tag: "New" }] } }],
  };

  const results = [];

  for (const [group, variants] of Object.entries(cases)) {
    for (const v of variants) {
      results.push(await renderComp(vite, group, v.file, v.props, v.slots));
    }
  }

  await vite.close();

  let report = `# Hikari Vue Component Verification Report\n\nGenerated: ${new Date().toISOString()}\n\n`;
  report += "| # | Component | Status | DOM Preview |\n";
  report += "|---|-----------|--------|-------------|\n";

  let ok = 0, fail = 0, i = 0;
  for (const r of results) {
    i++;
    const preview = r.ok
      ? r.html.replace(/<!--[\s\S]*?-->/g, "").replace(/<svg[\s\S]*?<\/svg>/g, "[SVG]").replace(/<style[\s\S]*?<\/style>/g, "[CSS]").replace(/<path[\s\S]*?\/>/g, "[PATH]").slice(0, 200).replace(/\n/g, " ").replace(/\s+/g, " ")
      : `ERROR: ${r.error}`;
    report += `| ${i} | ${r.name} | ${r.ok ? "OK" : "FAIL"} | \`${preview}\` |\n`;
    if (r.ok) ok++; else fail++;

    const slug = r.name.replace(/[^a-zA-Z0-9]/g, "_");
    fs.writeFileSync(path.join(OUT, `${slug}.html`), r.ok ? r.html : `<!-- ERROR: ${r.error} -->`);
  }

  report += `\n## Summary\n\n- **Passed**: ${ok}\n- **Failed**: ${fail}\n- **Total**: ${ok + fail}\n`;
  fs.writeFileSync(path.join(OUT, "report.md"), report);
  console.log(`Done: ${ok} OK, ${fail} FAIL`);
}

main().catch(e => { console.error(e); process.exit(1); });
