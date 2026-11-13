import { defineStore } from "pinia";
import { ref } from "vue";

export const useSystemStore = defineStore("system", () => {
  const panelVersion = ref<string>(__APP_VERSION__);
  const engineVersion = ref<string>("—");

  function setPanelVersion(v: string) {
    if (v) panelVersion.value = v;
  }

  function setEngineVersion(v: string) {
    engineVersion.value = v;
  }

  return {
    panelVersion,
    engineVersion,
    setPanelVersion,
    setEngineVersion,
  };
});
