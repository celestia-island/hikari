import { computed, defineComponent, ref, useId, type PropType } from "vue";

import { useI18n } from "../i18n/context";
import HButton from "./HkButton";
import HkFileBrowserDialog from "./HkFileBrowserDialog";
import type {
  FilePickerBackend,
  FilePickerHook,
  FileQuickLink,
  RemoteFsAdapter,
} from "./filePicker";
import "./HkFilePickerField.scss";

/**
 * HkFilePickerField — the path-valued sibling of HkFileField. Where the
 * file field hands back file CONTENT (File objects / remote entries),
 * this one holds a PATH STRING the user can also type by hand: a
 * folder badge, an editable input, and a browse button pinned right.
 *
 * Three picker backends, all addressable through `backend`:
 *  - `hook`: the host opens its own picker (`pick`) and resolves the
 *    chosen path. The canonical case is a Tauri2/Electron host whose
 *    native dialog is a real OS window OUTSIDE the webview — neither
 *    of the other backends can stand in for it.
 *  - `remote`: HkFileBrowserDialog driven by the provided `adapter`
 *    (in `directory` mode it picks the folder being listed).
 *  - `native`: the browser's own FS Access picker
 *    (`showDirectoryPicker` / `showOpenFilePicker`) where the platform
 *    supplies one. Opaque handles only ever expose their leaf name —
 *    fine for relative targets, useless for absolute ones; installers
 *    and friends should reach for the hook instead.
 *
 * `auto` (default) resolves hook → remote → native from whichever
 * props are present, degrading to a purely typed field when none are.
 */
export default defineComponent({
  name: "HkFilePickerField",
  props: {
    modelValue: { type: String, default: "" },
    backend: {
      type: String as () => FilePickerBackend,
      default: "auto",
    },
    /** Pick a directory (default) or a file. */
    directory: { type: Boolean, default: true },
    /** The `hook` backend: open a host picker, resolve the path or null. */
    pick: { type: Function as PropType<FilePickerHook>, default: undefined },
    // ── remote backend ──
    adapter: { type: Object as () => RemoteFsAdapter, default: undefined },
    quickLinks: { type: Array as () => FileQuickLink[], default: () => [] },
    initialPath: { type: String, default: "/" },
    dialogTitle: { type: String, default: undefined },
    // ── field chrome ──
    label: { type: String, default: undefined },
    placeholder: { type: String, default: undefined },
    hint: { type: String, default: undefined },
    error: { type: String, default: undefined },
    disabled: { type: Boolean, default: false },
    /** Render the path in the mono face (the default — paths are code). */
    mono: { type: Boolean, default: true },
    /** Explicit input id (label `for` binding). */
    id: { type: String, default: undefined },
  },
  emits: {
    "update:modelValue": (_value: string) => true,
  },
  setup(props, { emit }) {
    const { t } = useI18n();
    const generatedId = useId();
    const inputId = computed(() => props.id ?? `${generatedId}-input`);

    const resolvedBackend = computed<"hook" | "remote" | "native">(() => {
      if (props.backend !== "auto") return props.backend;
      if (props.pick) return "hook";
      if (props.adapter) return "remote";
      return "native";
    });

    const placeholderText = computed(
      () =>
        props.placeholder ??
        (props.directory
          ? t("hikari::filePicker.fieldPickDirectory", "Choose a folder…")
          : t("hikari::filePicker.fieldPickFile", "Choose a file…")),
    );

    // Only the remote backend mounts the dialog; every other picker
    // opens outside the component (or nowhere, when typed by hand).
    const dialogOpen = ref(false);

    /** A backend with its required prop missing cannot open anything. */
    const canBrowse = computed(() => {
      const backend = resolvedBackend.value;
      if (backend === "hook") return typeof props.pick === "function";
      if (backend === "remote") return Boolean(props.adapter);
      return true;
    });

    async function browse() {
      if (props.disabled) return;
      const backend = resolvedBackend.value;
      if (backend === "hook" && props.pick) {
        const picked = await props.pick();
        if (picked) emit("update:modelValue", picked);
        return;
      }
      if (backend === "remote" && props.adapter) {
        dialogOpen.value = true;
        return;
      }
      if (backend === "native") {
        // FS Access pickers resolve to opaque handles; only the leaf
        // name is readable. Hosts needing absolute paths use the hook.
        const w = window as unknown as {
          showDirectoryPicker?: () => Promise<{ name: string } | undefined>;
          showOpenFilePicker?: () => Promise<{ name: string }[] | undefined>;
        };
        try {
          if (props.directory && w.showDirectoryPicker) {
            const handle = await w.showDirectoryPicker();
            if (handle) emit("update:modelValue", handle.name);
          } else if (!props.directory && w.showOpenFilePicker) {
            const [handle] = (await w.showOpenFilePicker()) ?? [];
            if (handle) emit("update:modelValue", handle.name);
          }
        } catch {
          // A dismissed native picker is not an error worth surfacing.
        }
      }
    }

    function onInput(event: Event) {
      emit("update:modelValue", (event.target as HTMLInputElement).value);
    }

    function onDialogConfirm(files: { name: string; path: string }[]) {
      const chosen = files[0];
      if (chosen) emit("update:modelValue", chosen.path);
      dialogOpen.value = false;
    }

    return () => (
      <div class="hk-file-picker-field">
        {props.label && (
          <label class="hk-file-picker-label" for={inputId.value}>
            {props.label}
          </label>
        )}
        <div
          class="hk-file-picker-box"
          data-disabled={props.disabled || undefined}
          data-error={props.error || undefined}
          data-mono={props.mono || undefined}
        >
          <span class="hk-file-picker-badge" aria-hidden="true">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              width="18"
              height="18"
            >
              {/* folder-open: the shittim-chest file-picker affordance */}
              <path d="m6 14 1.45-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.55 6a2 2 0 0 1-1.94 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.93a2 2 0 0 1 1.66.9l.82 1.2a2 2 0 0 0 1.66.9H18a2 2 0 0 1 2 2v2" />
            </svg>
          </span>
          <input
            id={inputId.value}
            class="hk-file-picker-input"
            type="text"
            value={props.modelValue}
            placeholder={placeholderText.value}
            spellcheck={false}
            disabled={props.disabled}
            onInput={onInput}
          />
          <HButton
            variant="ghost"
            size="sm"
            class="hk-file-picker-browse"
            disabled={props.disabled || !canBrowse.value}
            onClick={browse}
          >
            {t("hikari::filePicker.browse", "Browse…")}
          </HButton>
        </div>
        {props.error ? (
          <p class="hk-file-picker-hint" data-error>{props.error}</p>
        ) : props.hint ? (
          <p class="hk-file-picker-hint">{props.hint}</p>
        ) : null}
        {resolvedBackend.value === "remote" && props.adapter && (
          <HkFileBrowserDialog
            modelValue={dialogOpen.value}
            onUpdate:modelValue={(v: boolean) => {
              dialogOpen.value = v;
            }}
            adapter={props.adapter}
            pickDirectory={props.directory}
            initialPath={props.initialPath}
            quickLinks={props.quickLinks}
            title={props.dialogTitle}
            onConfirm={onDialogConfirm}
          />
        )}
      </div>
    );
  },
});
