import { createSSRApp, h } from "vue";
import { renderToString } from "@vue/server-renderer";
import * as fs from "fs";

// Import all components
import HkActionBar from "../src/components/HkActionBar";
import HkAlert from "../src/components/HkAlert";
import HkAvatar from "../src/components/HkAvatar";
import HkBadge from "../src/components/HkBadge";
import HkBreadcrumb from "../src/components/HkBreadcrumb";
import HkButton from "../src/components/HkButton";
import HkCard from "../src/components/HkCard";
import HkCheckbox from "../src/components/HkCheckbox";
import HkCollapse from "../src/components/HkCollapse";
import HkConfirmDialog from "../src/components/HkConfirmDialog";
import HkDivider from "../src/components/HkDivider";
import HkDrawer from "../src/components/HkDrawer";
import HkEmptyState from "../src/components/HkEmptyState";
import HkErrorBoundary from "../src/components/HkErrorBoundary";
import HkIcon from "../src/components/HkIcon";
import HkIconButton from "../src/components/HkIconButton";
import HkInput from "../src/components/HkInput";
import HkKbd from "../src/components/HkKbd";
import HkListTransition from "../src/components/HkListTransition";
import HkLogo from "../src/components/HkLogo";
import HkMarkdownRenderer from "../src/components/HkMarkdownRenderer";
import HkModal from "../src/components/HkModal";
import HkMorphingTabs from "../src/components/HkMorphingTabs";
import HkNavItem from "../src/components/HkNavItem";
import HkNumberInput from "../src/components/HkNumberInput";
import HkPasswordInput from "../src/components/HkPasswordInput";
import HkPhaseTransition from "../src/components/HkPhaseTransition";
import HkPopover from "../src/components/HkPopover";
import HkProgressBar from "../src/components/HkProgressBar";
import HkProgressRing from "../src/components/HkProgressRing";
import HkRadio from "../src/components/HkRadio";
import HkScrollContainer from "../src/components/HkScrollContainer";
import HkSearchInput from "../src/components/HkSearchInput";
import HkSelect from "../src/components/HkSelect";
import HkSidebar from "../src/components/HkSidebar";
import HkSkeleton from "../src/components/HkSkeleton";
import HkSkeletonList from "../src/components/HkSkeletonList";
import HkSpinner from "../src/components/HkSpinner";
import HkSwitch from "../src/components/HkSwitch";
import HkTable from "../src/components/HkTable";
import HkTabs from "../src/components/HkTabs";
import HkTag from "../src/components/HkTag";
import HkTextarea from "../src/components/HkTextarea";
import HkToast from "../src/components/HkToast";
import HkTooltip from "../src/components/HkTooltip";
import HkTree from "../src/components/HkTree";
import HkWindowedItem from "../src/components/HkWindowedItem";
import HkDateTimePicker from "../src/components/HkDateTimePicker";
import HkTimeline from "../src/components/HkTimeline";
import HkGaugeRing from "../src/components/HkGaugeRing";
import HkHoverRevealAction from "../src/components/HkHoverRevealAction";
import HkSelectionGrid from "../src/components/HkSelectionGrid";
import HkSelectionWaterfall from "../src/components/HkSelectionWaterfall";
import HkDraggableList from "../src/components/HkDraggableList";
import HkDraggableGrid from "../src/components/HkDraggableGrid";
import HkModalBreadcrumb from "../src/components/HkModalBreadcrumb";
import HkProgressDialog from "../src/components/HkProgressDialog";
import HkAdminShell from "../src/components/HkAdminShell";
import HkAdminHeader from "../src/components/HkAdminHeader";
import HkStatusBar from "../src/components/HkStatusBar";
import HkKeywordSearchModal from "../src/components/HkKeywordSearchModal";

async function renderComponent(name: string, comp: any, props: Record<string, unknown>, slots?: Record<string, any>) {
  try {
    const app = createSSRApp({
      render() {
        const slotFns: Record<string, () => any> = {};
        if (slots) {
          for (const [key, val] of Object.entries(slots)) {
            slotFns[key] = typeof val === "function" ? val : () => val;
          }
        }
        return h(comp, props, slotFns);
      },
    });
    const html = await renderToString(app);
    return { name, ok: true, html };
  } catch (e: any) {
    return { name, ok: false, error: e.message };
  }
}

async function main() {
  const results: any[] = [];

  // HkButton
  results.push(await renderComponent("HkButton", HkButton,
    { variant: "primary", size: "md" },
    { default: () => "Click Me" }));
  results.push(await renderComponent("HkButton (loading)", HkButton,
    { variant: "danger", loading: true, size: "lg" },
    { default: () => "Delete" }));
  results.push(await renderComponent("HkButton (block)", HkButton,
    { variant: "outline", block: true, shortcut: "Ctrl+K" },
    { default: () => "Search" }));

  // HkInput
  results.push(await renderComponent("HkInput", HkInput,
    { placeholder: "Enter text", label: "Username", size: "md" }));
  results.push(await renderComponent("HkInput (error)", HkInput,
    { placeholder: "Email", error: "Invalid email", label: "Email" }));
  results.push(await renderComponent("HkInput (textarea)", HkInput,
    { type: "textarea", rows: 3, placeholder: "Message", label: "Message" }));

  // HkBadge
  results.push(await renderComponent("HkBadge", HkBadge,
    { variant: "primary" }, { default: () => "New" }));
  results.push(await renderComponent("HkBadge (dot)", HkBadge,
    { variant: "error", dot: true }));

  // HkCard
  results.push(await renderComponent("HkCard", HkCard,
    { title: "Card Title", hoverable: true },
    { default: () => "Card content", footer: () => "Footer" }));

  // HkAlert
  results.push(await renderComponent("HkAlert", HkAlert,
    { variant: "error", title: "Error", message: "Something went wrong", closable: true }));
  results.push(await renderComponent("HkAlert (warning)", HkAlert,
    { variant: "warning", message: "Proceed with caution" }));

  // HkCheckbox
  results.push(await renderComponent("HkCheckbox", HkCheckbox,
    { modelValue: true, label: "Accept terms" }));
  results.push(await renderComponent("HkCheckbox (unchecked)", HkCheckbox,
    { modelValue: false, label: "Subscribe" }));

  // HkRadio
  results.push(await renderComponent("HkRadio", HkRadio,
    { modelValue: "a", options: [{ value: "a", label: "Option A" }, { value: "b", label: "Option B" }] }));

  // HkSwitch
  results.push(await renderComponent("HkSwitch", HkSwitch,
    { modelValue: true, label: "Dark mode", checkedContent: "ON" }));

  // HkTag
  results.push(await renderComponent("HkTag", HkTag,
    { variant: "primary" }, { default: () => "Tag" }));
  results.push(await renderComponent("HkTag (closable)", HkTag,
    { variant: "danger", closable: true }, { default: () => "Remove" }));

  // HkSpinner
  results.push(await renderComponent("HkSpinner", HkSpinner,
    { size: "md", text: "Loading..." }));

  // HkSkeleton
  results.push(await renderComponent("HkSkeleton", HkSkeleton,
    { width: "200px", height: "20px" }));

  // HkProgressBar
  results.push(await renderComponent("HkProgressBar", HkProgressBar,
    { value: 60, status: "loading", showLabel: true }));
  results.push(await renderComponent("HkProgressBar (indeterminate)", HkProgressBar,
    { value: null, status: "loading" }));

  // HkProgressRing
  results.push(await renderComponent("HkProgressRing", HkProgressRing,
    { value: 75, showLabel: true }));

  // HkKbd
  results.push(await renderComponent("HkKbd", HkKbd,
    { keys: "Ctrl+Shift+P" }));

  // HkDivider
  results.push(await renderComponent("HkDivider", HkDivider,
    { orientation: "horizontal", tone: "subtle", text: "or" }));

  // HkTooltip
  results.push(await renderComponent("HkTooltip", HkTooltip,
    { text: "Help text" }, { default: () => "Hover me" }));

  // HkSelect
  results.push(await renderComponent("HkSelect", HkSelect,
    { options: [{ value: "1", label: "Option 1" }, { value: "2", label: "Option 2" }], placeholder: "Choose..." }));

  // HkTabs
  results.push(await renderComponent("HkTabs", HkTabs,
    { modelValue: "tab1", tabs: [{ key: "tab1", label: "Tab 1" }, { key: "tab2", label: "Tab 2" }] },
    { "icon-tab1": () => "🔍", tab1: () => "Content 1" }));

  // HkTable
  results.push(await renderComponent("HkTable", HkTable,
    {
      columns: [{ key: "name", title: "Name" }, { key: "age", title: "Age" }],
      rows: [{ name: "Alice", age: 30 }, { name: "Bob", age: 25 }],
    }));

  // HkTree
  results.push(await renderComponent("HkTree", HkTree,
    { nodes: [{ key: "1", label: "Root", children: [{ key: "1a", label: "Child" }] }] }));

  // HkTimeline
  results.push(await renderComponent("HkTimeline", HkTimeline,
    { steps: [{ key: "1", label: "Step 1" }, { key: "2", label: "Step 2" }], currentKey: "1" }));

  // HkEmptyState
  results.push(await renderComponent("HkEmptyState", HkEmptyState,
    { title: "Nothing here", description: "Add some data" }));

  // HkSpinner
  results.push(await renderComponent("HkSpinner (center)", HkSpinner,
    { size: "lg", center: true }));

  // HkSidebar
  results.push(await renderComponent("HkSidebar", HkSidebar,
    {}, { default: () => "Nav items" }));

  // HkLogo
  results.push(await renderComponent("HkLogo", HkLogo,
    { alt: "MyApp", size: "md" }));

  // HkStatusBar
  results.push(await renderComponent("HkStatusBar", HkStatusBar,
    { version: "1.0.0", connectionStatus: "connected" }));

  // HkGaugeRing
  results.push(await renderComponent("HkGaugeRing", HkGaugeRing,
    { rings: [{ pct: 65, color: "#ff6b9d", trackColor: "rgba(255,107,157,0.1)" }], centerValue: "65%" }));

  // HkSelectionGrid
  results.push(await renderComponent("HkSelectionGrid", HkSelectionGrid,
    { items: [{ id: "1", title: "Item 1" }, { id: "2", title: "Item 2" }], selectedId: "1" }));

  // Write output
  const outDir = "/mnt/codespace/hikari/packages/vue/demo/output";
  fs.mkdirSync(outDir, { recursive: true });

  let report = "# Hikari Vue Component Verification Report\n\nGenerated: " + new Date().toISOString() + "\n\n";
  report += "| Component | Status | DOM Preview |\n";
  report += "|-----------|--------|-------------|\n";

  const count = { ok: 0, fail: 0 };

  for (const r of results) {
    const preview = r.ok ? r.html.slice(0, 120).replace(/\n/g, " ") : `ERROR: ${r.error}`;
    report += `| ${r.name} | ${r.ok ? "OK" : "FAIL"} | \`${preview}\` |\n`;
    if (r.ok) count.ok++;
    else count.fail++;

    // Write full HTML for each component
    const slug = r.name.replace(/[^a-zA-Z0-9]/g, "_").replace(/_{2,}/g, "_");
    fs.writeFileSync(`${outDir}/${slug}.html`, r.ok ? r.html : `<!-- ERROR: ${r.error} -->`);
  }

  report += `\n## Summary\n\n- **Passed**: ${count.ok}\n- **Failed**: ${count.fail}\n- **Total**: ${count.ok + count.fail}\n`;
  fs.writeFileSync(`${outDir}/report.md`, report);
  console.log(`Verification complete: ${count.ok} OK, ${count.fail} FAIL`);
}

main().catch(console.error);
