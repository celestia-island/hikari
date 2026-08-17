// Temporary browser-verification scaffold — NOT committed.
import { defineComponent, ref } from "vue";
import { createApp } from "vue";
import { HMenu, HSelect, type HkMenuItem } from "./index";
import { LayoutDashboard, ShoppingCart, Settings, LogOut } from "lucide-vue-next";
import "./demo.scss";
import { initTheme } from "./theme/useTheme";

localStorage.setItem("hikari-theme", "tokyonight");
initTheme();

const nav: HkMenuItem[] = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  {
    key: "shop",
    label: "Shop",
    icon: ShoppingCart,
    children: [
      { key: "products", label: "Products" },
      { key: "listings", label: "Listings", badge: "3" },
      { key: "orders", label: "Orders", badge: "12" },
    ],
  },
  {
    key: "system",
    label: "System",
    icon: Settings,
    children: [
      { key: "general", label: "General" },
      { key: "network", label: "Network" },
    ],
  },
  { key: "logout", label: "Log out", icon: LogOut, danger: true },
];

const manyOptions = Array.from({ length: 20 }, (_, i) => ({
  value: `r${i}`,
  label: `Region option ${i + 1}`,
}));

const Scratch = defineComponent({
  name: "Scratch",
  setup() {
    const active = ref("listings");
    const region = ref("r0");
    const selLabel = ref("");
    return () => (
      <div style={{ display: "flex", gap: "32px", padding: "24px", alignItems: "flex-start" }}>
        <div style={{ width: "224px", flexShrink: 0 }}>
          <HMenu
            variant="sidebar"
            open={true}
            title="Navigation"
            items={nav}
            activeKey={active.value}
            onSelect={(k: string) => { active.value = k; }}
          />
        </div>
        <div style={{ width: "320px", display: "flex", flexDirection: "column", gap: "20px" }}>
          <HSelect
            label="Region (scroll me)"
            modelValue={region.value}
            onUpdate:modelValue={(v: string) => { region.value = v; }}
            options={manyOptions}
          />
          <HSelect
            label="With selection"
            modelValue={selLabel.value}
            onUpdate:modelValue={(v: string) => { selLabel.value = v; }}
            options={[{ value: "a", label: "Alpha" }, { value: "b", label: "Beta" }]}
          />
        </div>
      </div>
    );
  },
});

createApp(Scratch).mount("#app");
