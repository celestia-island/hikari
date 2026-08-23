import { computed, defineComponent, ref, watch, type PropType } from "vue";
import {
  HModal,
  useI18n,
  type ModalAction,
  type ThemeSchemeTokens,
  type ThemeTokenGroupModes,
} from "@celestia-island/hikari";

import { HkColorSchemeEditor, type HCustomTheme } from "./HkColorSchemeEditor";


export { type HCustomTheme } from "./HkColorSchemeEditor";


/**
 * HColorSchemeDialog — custom color scheme editor over hikari's theme
 * presets/custom themes.
 *
 * Thin modal wrapper around HkColorSchemeEditor: it owns only the modal
 * chrome (title, footer actions) and the open→re-seed→save lifecycle,
 * delegating the actual token/group editing form to the editor.
 * Emits `confirm` with a `HCustomTheme` (a hikari `CustomThemePreset`);
 * the caller persists it via `useTheme().addCustomTheme()` and applies it
 * with `setTheme()`.
 */
export const HColorSchemeDialog = defineComponent({
  name: "HkColorSchemeDialog",
  props: {
    modelValue: { type: Boolean, required: true },
    /** Prefill dark tokens; defaults to the hikari synthwave dark scheme. */
    initialDark: { type: Object as PropType<ThemeSchemeTokens>, default: undefined },
    /** Prefill light tokens; defaults to the hikari synthwave light scheme. */
    initialLight: { type: Object as PropType<ThemeSchemeTokens>, default: undefined },
    /** Prefill extension token groups (per mode); defaults to registry defaults. */
    initialGroups: { type: Object as PropType<ThemeTokenGroupModes>, default: undefined },
  },
  emits: {
    "update:modelValue": (_v: boolean) => true,
    confirm: (_theme: HCustomTheme) => true,
  },
  setup(props, { emit }) {
    const { t } = useI18n();
    // The editor exposes { reset, getDraft } via defineExpose; those are
    // runtime-only and not part of InstanceType, so type the ref explicitly.
    const editorRef = ref<{ reset: () => void; getDraft: () => HCustomTheme } | null>(null);

    // Re-seed the editor each time the dialog opens so it reflects the
    // current effective mode and any (updated) prefills — same timing the
    // old inline watch had.
    watch(
      () => props.modelValue,
      (open) => {
        if (!open) return;
        editorRef.value?.reset();
      },
    );

    function handleConfirm() {
      const draft = editorRef.value?.getDraft();
      if (!draft) return;
      emit("confirm", draft);
      emit("update:modelValue", false);
    }

    const footerActions = computed<ModalAction[]>(() => [
      {
        label: t("hikari::protocol.decline"),
        variant: "secondary" as const,
        onClick: () => emit("update:modelValue", false),
      },
      {
        label: t("hikari::theme.save"),
        variant: "primary" as const,
        onClick: handleConfirm,
      },
    ]);

    return () => (
      <HModal
        modelValue={props.modelValue}
        onUpdate:modelValue={(v: boolean) => emit("update:modelValue", v)}
        title={t("hikari::theme.editScheme")}
        width="36rem"
        footerActions={footerActions.value}
      >
        <HkColorSchemeEditor
          ref={editorRef}
          initialDark={props.initialDark}
          initialLight={props.initialLight}
          initialGroups={props.initialGroups}
        />
      </HModal>
    );
  },
});
