import { computed, defineComponent, ref, useId, watch } from "vue";

import { useI18n } from "../i18n/context";
import HkFileBrowserDialog from "./HkFileBrowserDialog";
import type { FileQuickLink, PickedFile, RemoteFsAdapter } from "./filePicker";
import "./HkFileField.scss";

/**
 * HkFileField — a visible file-input field. The left icon and the
 * placeholder spell out the affordance ("this opens a picker"), and the
 * native `<input type="file">` plumbing lives INSIDE the component in
 * local mode — hosts never render a hidden bare input again.
 *
 * Two modes:
 *  - `local` (default): clicking triggers the browser's native picker;
 *    the selection surfaces as `File` objects on `modelValue`.
 *  - `remote`: clicking opens HkFileBrowserDialog driven by the provided
 *    `adapter`; the selection surfaces as remote paths on `modelValue`.
 *
 * `modelValue` is an array of `PickedFile`; `multiple` controls whether
 * more than one entry may be picked (a second single pick replaces).
 */
export default defineComponent({
  name: "HkFileField",
  props: {
    modelValue: { type: Array as () => PickedFile[], default: () => [] },
    mode: {
      type: String as () => "local" | "remote",
      default: "local",
    },
    multiple: { type: Boolean, default: false },
    /** Native accept string; in remote mode it also seeds the dialog's type filter. */
    accept: { type: String, default: undefined },
    label: { type: String, default: undefined },
    placeholder: { type: String, default: undefined },
    hint: { type: String, default: undefined },
    error: { type: String, default: undefined },
    disabled: { type: Boolean, default: false },
    required: { type: Boolean, default: false },
    /** `name` for the internal native input (local mode). */
    name: { type: String, default: undefined },
    /** Explicit trigger id; generated when omitted (label `for` binding). */
    id: { type: String, default: undefined },
    // ── remote mode ──
    adapter: { type: Object as () => RemoteFsAdapter, default: undefined },
    quickLinks: { type: Array as () => FileQuickLink[], default: () => [] },
    initialPath: { type: String, default: "/" },
    dialogTitle: { type: String, default: undefined },
  },
  emits: {
    "update:modelValue": (_value: PickedFile[]) => true,
  },
  setup(props, { emit }) {
    const { t } = useI18n();
    const nativeInputRef = ref<HTMLInputElement>();
    const dialogOpen = ref(false);

    const generatedId = useId();
    const triggerId = computed(() => props.id ?? `${generatedId}-trigger`);

    const placeholderText = computed(() => {
      if (props.placeholder) return props.placeholder;
      const many = props.multiple;
      if (props.mode === "remote") {
        return many
          ? t("hikari::filePicker.fieldChooseRemoteMany", "Choose remote files…")
          : t("hikari::filePicker.fieldChooseRemoteOne", "Choose a remote file…");
      }
      return many
        ? t("hikari::filePicker.fieldChooseMany", "Choose files…")
        : t("hikari::filePicker.fieldChooseOne", "Choose a file…");
    });

    /** Compact display of the current selection: names, "+N" overflow. */
    const summary = computed(() => {
      const files = props.modelValue;
      if (files.length === 0) return "";
      if (files.length === 1) return files[0]!.name;
      return `${files[0]!.name} +${files.length - 1}`;
    });

    function onNativeChange(event: Event) {
      const input = event.target as HTMLInputElement;
      const files = Array.from(input.files ?? []).map<PickedFile>((file) => ({
        name: file.name,
        size: file.size,
        file,
      }));
      emit("update:modelValue", props.multiple ? files : files.slice(0, 1));
      // Reset so picking the same file again re-fires change.
      input.value = "";
    }

    function openPicker() {
      if (props.disabled) return;
      // Remote mode without an adapter cannot open anything: clicking is a
      // no-op rather than a dialog that would later pop open on its own.
      if (props.mode === "remote" && !props.adapter) return;
      if (props.mode === "remote") {
        dialogOpen.value = true;
        return;
      }
      nativeInputRef.value?.click();
    }

    function clear() {
      emit("update:modelValue", []);
    }

    function onDialogConfirm(files: { name: string; path: string; size?: number }[]) {
      emit(
        "update:modelValue",
        files.map<PickedFile>((f) => ({ name: f.name, path: f.path, size: f.size })),
      );
      dialogOpen.value = false;
    }

    // External clears (form reset) close the remote dialog too.
    watch(
      () => props.modelValue,
      (value) => {
        if (value.length === 0) dialogOpen.value = false;
      },
    );

    return () => {
      const files = props.modelValue;
      return (
        <div class="hk-file-field">
          {props.label && (
            <label class="hk-file-field-label" for={triggerId.value}>
              {props.label}
              {props.required && <span class="hk-file-field-required">*</span>}
            </label>
          )}
          <div
            class="hk-file-box"
            data-disabled={props.disabled || undefined}
            data-error={props.error || undefined}
            data-filled={files.length > 0 || undefined}
          >
            <button
              type="button"
              id={triggerId.value}
              class="hk-file-trigger"
              disabled={props.disabled}
              aria-haspopup={props.mode === "remote" ? "dialog" : undefined}
              onClick={openPicker}
            >
              <svg
                class="hk-file-trigger-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                width="16"
                height="16"
                aria-hidden="true"
              >
                {/* file-plus: the affordance says "file input" before any text does */}
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="12" y1="18" x2="12" y2="12" />
                <line x1="9" y1="15" x2="15" y2="15" />
              </svg>
              <span class="hk-file-trigger-text" data-filled={files.length > 0 || undefined}>
                {files.length > 0 ? summary.value : placeholderText.value}
              </span>
            </button>
            {files.length > 0 && !props.disabled && (
              <button
                type="button"
                class="hk-file-clear"
                aria-label={t("hikari::filePicker.fieldClear", "Clear selection")}
                onClick={clear}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  width="14"
                  height="14"
                  aria-hidden="true"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
            {props.mode === "local" && (
              <input
                ref={nativeInputRef}
                class="hk-file-native"
                type="file"
                multiple={props.multiple}
                accept={props.accept}
                name={props.name}
                disabled={props.disabled}
                tabindex={-1}
                aria-hidden="true"
                onChange={onNativeChange}
              />
            )}
          </div>
          {props.error ? (
            <p class="hk-file-field-error">{props.error}</p>
          ) : props.hint ? (
            <p class="hk-file-field-hint">{props.hint}</p>
          ) : null}
          {props.mode === "remote" && props.adapter && (
            <HkFileBrowserDialog
              modelValue={dialogOpen.value}
              onUpdate:modelValue={(v: boolean) => { dialogOpen.value = v; }}
              adapter={props.adapter}
              multiple={props.multiple}
              accept={props.accept}
              initialPath={props.initialPath}
              quickLinks={props.quickLinks}
              title={props.dialogTitle}
              onConfirm={onDialogConfirm}
            />
          )}
        </div>
      );
    };
  },
});
