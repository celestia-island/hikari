import {
  computed,
  defineComponent,
  nextTick,
  ref,
  watch,
  type PropType,
  type SlotsType,
} from "vue";

import {
  ClipboardPaste,
  Copy,
  LayoutGrid,
  Link2,
  List,
  RotateCw,
  Scissors,
  TextCursorInput,
} from "lucide-vue-next";

import { useI18n } from "../i18n/context";
import { useClipboardWithToast } from "../runtime/useClipboard";
import { useToast } from "../runtime/useToast";
import {
  acceptExtensions,
  type FileQuickLink,
  type RemoteFileEntry,
  type RemoteFsAdapter,
} from "./filePicker";
import HButton from "./HkButton";
import HModal from "./HkModal";
import HSelect, { type HkSelectOption } from "./HkSelect";
import HSpinner from "./HkSpinner";
import "./HkFileBrowserDialog.scss";

/** One file handed back through the `confirm` event. */
interface ConfirmedFile {
  name: string;
  /** Remote absolute path: the directory currently listed + the entry name. */
  path: string;
  size?: number;
}

type BrowserLayout = "list" | "grid";

/** Internal clipboard entry staged by the Cut/Copy toolbar ops. */
interface BrowserClipboard {
  mode: "copy" | "cut";
  name: string;
  /** Full path of the staged entry at stage time (the `copy`/`move` from). */
  fromPath: string;
}

/** Join a bare entry name onto a directory path ("/" + "a" → "/a"). */
function joinPath(dir: string, name: string): string {
  return dir.endsWith("/") ? `${dir}${name}` : `${dir}/${name}`;
}

/** Folder ordering: directories first, each group name-ascending. */
function compareEntries(a: RemoteFileEntry, b: RemoteFileEntry): number {
  if (a.kind !== b.kind) return a.kind === "dir" ? -1 : 1;
  return a.name.localeCompare(b.name);
}

/** Human-readable byte size on the picker's B/KB/MB/GB display scale. */
function formatSize(size: number | undefined): string {
  if (size === undefined || size === null || Number.isNaN(size)) return "";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

/** Best-effort modified timestamp: epoch millis render as locale strings. */
function formatModified(value: string | number | undefined): string {
  if (value === undefined) return "";
  if (typeof value === "number") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
  }
  return value;
}

/**
 * HkFileBrowserDialog — the remote half of the file-picker family. The
 * host supplies a `RemoteFsAdapter` and this dialog renders the whole
 * browsing surface inside an HModal: breadcrumb path bar with copy-path,
 * quick-link chips, a clipboard/rename toolbar (every op gated on the
 * adapter handler existing), a list/grid layout toggle, an extension
 * type filter derived from `accept`, and a footer with Cancel/Confirm
 * (plus the `footerForm` slot so hosts can stack extra fields above the
 * actions). The adapter is the ONLY data source — nothing is faked here.
 */
export default defineComponent({
  name: "HkFileBrowserDialog",
  props: {
    /** Dialog open state (v-model). */
    modelValue: { type: Boolean, required: true },
    /** Header title; falls back to the hikari i18n default. */
    title: { type: String, default: undefined },
    /** The remote filesystem the browser operates on. */
    adapter: { type: Object as PropType<RemoteFsAdapter>, required: true },
    /** Allow multi-selection (file clicks toggle instead of replacing). */
    multiple: { type: Boolean, default: false },
    /** Native accept string (".csv,.json") driving the type filter select. */
    accept: { type: String, default: undefined },
    /** Directory listed when the dialog opens. */
    initialPath: { type: String, default: "/" },
    /** Bookmark chips rendered above the toolbar for one-click jumps. */
    quickLinks: {
      type: Array as PropType<FileQuickLink[]>,
      default: () => [],
    },
    confirmLabel: { type: String, default: undefined },
    cancelLabel: { type: String, default: undefined },
  },
  emits: {
    "update:modelValue": (_v: boolean) => true,
    confirm: (_files: ConfirmedFile[]) => true,
  },
  slots: Object as SlotsType<{
    /** Extra form fields rendered ABOVE the footer action buttons. */
    footerForm?: () => unknown;
  }>,
  setup(props, { emit, slots }) {
    const { t } = useI18n();
    const pathClipboard = useClipboardWithToast(
      useToast(),
      () => t("hikari::filePicker.pathCopied", "Path copied"),
    );

    // --- Browser state ---
    const currentPath = ref(props.initialPath);
    const entries = ref<RemoteFileEntry[]>([]);
    const loading = ref(false);
    /** Last lister (or clipboard-op) failure message; "" = healthy. */
    const loadError = ref("");
    /** Selected entry NAMES — cleared on navigation; dirs never select. */
    const selected = ref<Set<string>>(new Set());
    const layout = ref<BrowserLayout>("list");
    /** Active type filter: "" = All, otherwise an extension (".csv"). */
    const filterExt = ref("");
    const clipboard = ref<BrowserClipboard | null>(null);
    const renaming = ref(false);
    const renameValue = ref("");
    const renameError = ref(false);
    const renameInputRef = ref<HTMLInputElement>();
    /**
     * Out-of-order listing guard: a slow response for a directory the
     * user already left must never overwrite the current view.
     */
    let listSeq = 0;

    async function refresh() {
      const seq = ++listSeq;
      loading.value = true;
      loadError.value = "";
      try {
        const listing = await props.adapter.list(currentPath.value);
        if (seq !== listSeq) return;
        entries.value = [...listing.entries].sort(compareEntries);
        pruneSelection();
      } catch (err) {
        if (seq !== listSeq) return;
        entries.value = [];
        loadError.value = err instanceof Error ? err.message : String(err);
      } finally {
        if (seq === listSeq) loading.value = false;
      }
    }

    /**
     * Drop selected names that the fresh listing (or the active filter)
     * no longer shows — a confirm button left enabled over vanished
     * entries would silently no-op.
     */
    function pruneSelection(visible: RemoteFileEntry[] = entries.value) {
      const present = new Set(visible.map((entry) => entry.name));
      if (selected.value.size === 0) return;
      const next = new Set([...selected.value].filter((name) => present.has(name)));
      if (next.size !== selected.value.size) selected.value = next;
    }

    // Every open starts a fresh browsing session at initialPath; closing
    // keeps the last view so the leave transition does not flash empty.
    watch(
      () => props.modelValue,
      (open) => {
        if (!open) return;
        listSeq++; // invalidate any in-flight listing from a prior session
        currentPath.value = props.initialPath;
        entries.value = [];
        selected.value = new Set();
        filterExt.value = "";
        clipboard.value = null;
        renaming.value = false;
        renameValue.value = "";
        renameError.value = false;
        loadError.value = "";
        void refresh();
      },
      { immediate: true },
    );

    // A hot-swapped adapter (host re-wired the transport) re-lists too.
    watch(
      () => props.adapter,
      () => {
        if (props.modelValue) void refresh();
      },
    );

    // --- Derived view model ---

    const extensions = computed(() => acceptExtensions(props.accept));
    const filterActive = computed(() => extensions.value.length > 0);
    const filterOptions = computed<HkSelectOption[]>(() => [
      { value: "", label: t("hikari::filePicker.filterAll", "All") },
      ...extensions.value.map((ext) => ({ value: ext, label: ext })),
    ]);

    /** Dirs always pass the type filter; files must match the extension. */
    const visibleEntries = computed(() => {
      if (!filterActive.value || !filterExt.value) return entries.value;
      const ext = filterExt.value;
      return entries.value.filter(
        (entry) =>
          entry.kind === "dir" || entry.name.toLowerCase().endsWith(ext),
      );
    });

    const breadcrumbs = computed(() => {
      const crumbs: Array<{
        name: string;
        path: string;
        current: boolean;
      }> = [{ name: "/", path: "/", current: currentPath.value === "/" }];
      let acc = "";
      for (const part of currentPath.value.split("/")) {
        if (!part) continue;
        acc += `/${part}`;
        crumbs.push({
          name: part,
          path: acc,
          current: acc === currentPath.value,
        });
      }
      return crumbs;
    });

    const selectedEntry = computed<RemoteFileEntry | undefined>(() => {
      if (selected.value.size !== 1) return undefined;
      return entries.value.find((entry) => selected.value.has(entry.name));
    });

    // Toolbar gating: exactly-one selection AND the matching adapter
    // handler — a read-only adapter never arms an op it cannot run.
    const canCut = computed(
      () => selected.value.size === 1 && typeof props.adapter.move === "function",
    );
    const canCopy = computed(
      () => selected.value.size === 1 && typeof props.adapter.copy === "function",
    );
    const canPaste = computed(() => {
      const clip = clipboard.value;
      if (!clip) return false;
      return clip.mode === "cut"
        ? typeof props.adapter.move === "function"
        : typeof props.adapter.copy === "function";
    });
    const canRename = computed(
      () =>
        selected.value.size === 1 &&
        typeof props.adapter.rename === "function",
    );

    // --- Actions ---

    function navigate(path: string) {
      if (path === currentPath.value) return;
      currentPath.value = path;
      selected.value = new Set();
      renaming.value = false;
      void refresh();
    }

    function onEntryClick(entry: RemoteFileEntry) {
      if (entry.kind === "dir") {
        navigate(joinPath(currentPath.value, entry.name));
        return;
      }
      const next = new Set(selected.value);
      if (props.multiple) {
        if (next.has(entry.name)) next.delete(entry.name);
        else next.add(entry.name);
      } else if (next.has(entry.name)) {
        next.clear();
      } else {
        next.clear();
        next.add(entry.name);
      }
      selected.value = next;
    }

    /** Double-click activates: the file confirms immediately (and alone,
     *  even in multiple mode — a double-click names ONE file). */
    function onEntryActivate(entry: RemoteFileEntry) {
      if (entry.kind !== "file") return;
      selected.value = new Set([entry.name]);
      confirmSelection();
    }

    function stageClipboard(mode: "copy" | "cut") {
      const entry = selectedEntry.value;
      if (!entry) return;
      if (mode === "cut" && !props.adapter.move) return;
      if (mode === "copy" && !props.adapter.copy) return;
      clipboard.value = {
        mode,
        name: entry.name,
        fromPath: joinPath(currentPath.value, entry.name),
      };
    }

    async function pasteClipboard() {
      const clip = clipboard.value;
      if (!clip) return;
      const handler =
        clip.mode === "cut" ? props.adapter.move : props.adapter.copy;
      if (!handler) return;
      try {
        await handler(clip.fromPath, currentPath.value);
        // A move consumes the staged entry; a copy stays re-pastable.
        if (clip.mode === "cut") clipboard.value = null;
        await refresh();
      } catch (err) {
        loadError.value = err instanceof Error ? err.message : String(err);
      }
    }

    async function openRename() {
      const entry = selectedEntry.value;
      if (!entry || !props.adapter.rename) return;
      renaming.value = true;
      renameValue.value = entry.name;
      renameError.value = false;
      void nextTick(() => renameInputRef.value?.focus());
    }

    function cancelRename() {
      renaming.value = false;
      renameError.value = false;
    }

    async function confirmRename() {
      const adapter = props.adapter;
      const entry = selectedEntry.value;
      if (!renaming.value || !entry || !adapter.rename) return;
      const toName = renameValue.value.trim();
      // The adapter contract takes a bare sibling name: path separators or
      // dot segments would escape the current directory.
      if (!toName || toName === "." || toName === ".." || /[/\\]/.test(toName)) {
        renameError.value = true;
        return;
      }
      renameError.value = false;
      try {
        await adapter.rename(
          currentPath.value,
          joinPath(currentPath.value, entry.name),
          toName,
        );
        renaming.value = false;
        selected.value = new Set();
        await refresh();
      } catch (err) {
        loadError.value = err instanceof Error ? err.message : String(err);
      }
    }

    function onRenameKeydown(e: KeyboardEvent) {
      // Enter confirms, Escape cancels the inline prompt — both swallowed
      // so they never bubble into HModal's close-on-Escape handler.
      if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        void confirmRename();
      } else if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        cancelRename();
      }
    }

    function confirmSelection() {
      if (selected.value.size === 0) return;
      const files: ConfirmedFile[] = [];
      for (const name of selected.value) {
        const entry = entries.value.find((e) => e.name === name);
        if (!entry) continue;
        const path = joinPath(currentPath.value, name);
        files.push(
          entry.size === undefined
            ? { name, path }
            : { name, path, size: entry.size },
        );
      }
      if (files.length === 0) return;
      emit("confirm", files);
      close();
    }

    function close() {
      emit("update:modelValue", false);
    }

    function copyPathToClipboard() {
      void pathClipboard.copy(currentPath.value);
    }

    // --- Render helpers ---

    function renderPathbar() {
      return (
        <div class="hk-file-browser-pathbar">
          <nav class="hk-file-browser-crumbs" aria-label={t("hikari::filePicker.currentPath", "Current path")}>
            {breadcrumbs.value.map((crumb) =>
              crumb.current ? (
                <span
                  key={crumb.path}
                  class="hk-file-browser-crumb"
                  data-current
                >
                  {crumb.name}
                </span>
              ) : (
                <button
                  key={crumb.path}
                  type="button"
                  class="hk-file-browser-crumb"
                  onClick={() => navigate(crumb.path)}
                >
                  {crumb.name}
                </button>
              ),
            )}
          </nav>
          <button
            type="button"
            class="hk-file-browser-copy-path"
            aria-label={t("hikari::filePicker.copyPath", "Copy path")}
            title={t("hikari::filePicker.copyPath", "Copy path")}
            onClick={copyPathToClipboard}
          >
            <Link2 size={14} />
          </button>
        </div>
      );
    }

    function renderQuickLinks() {
      return (
        <div
          class="hk-file-browser-chips"
          aria-label={t("hikari::filePicker.quickLinks", "Quick links")}
        >
          <span class="hk-file-browser-chips-label">
            {t("hikari::filePicker.quickLinks", "Quick links")}
          </span>
          {props.quickLinks.map((link) => (
            <button
              key={link.path}
              type="button"
              class="hk-file-browser-chip"
              data-active={link.path === currentPath.value || undefined}
              onClick={() => navigate(link.path)}
            >
              {link.label}
            </button>
          ))}
        </div>
      );
    }

    function renderToolbar() {
      const cutLabel = t("hikari::filePicker.cut", "Cut");
      const copyLabel = t("hikari::filePicker.copy", "Copy");
      const pasteLabel = t("hikari::filePicker.paste", "Paste");
      const renameLabel = t("hikari::filePicker.rename", "Rename");
      const refreshLabel = t("hikari::filePicker.refresh", "Refresh");
      return (
        <div class="hk-file-browser-toolbar">
          <div class="hk-file-browser-ops" role="group">
            <button
              type="button"
              class="hk-file-browser-tool"
              data-op="cut"
              aria-label={cutLabel}
              title={cutLabel}
              disabled={!canCut.value}
              onClick={() => stageClipboard("cut")}
            >
              <Scissors size={16} />
            </button>
            <button
              type="button"
              class="hk-file-browser-tool"
              data-op="copy"
              aria-label={copyLabel}
              title={copyLabel}
              disabled={!canCopy.value}
              onClick={() => stageClipboard("copy")}
            >
              <Copy size={16} />
            </button>
            <button
              type="button"
              class="hk-file-browser-tool"
              data-op="paste"
              aria-label={pasteLabel}
              title={pasteLabel}
              disabled={!canPaste.value}
              onClick={() => void pasteClipboard()}
            >
              <ClipboardPaste size={16} />
            </button>
            <button
              type="button"
              class="hk-file-browser-tool"
              data-op="rename"
              aria-label={renameLabel}
              title={renameLabel}
              disabled={!canRename.value}
              onClick={() => void openRename()}
            >
              <TextCursorInput size={16} />
            </button>
            <button
              type="button"
              class="hk-file-browser-tool"
              data-op="refresh"
              aria-label={refreshLabel}
              title={refreshLabel}
              onClick={() => void refresh()}
            >
              <RotateCw size={16} />
            </button>
          </div>
          <div class="hk-file-browser-toolbar-side">
            {filterActive.value ? (
              <div class="hk-file-browser-filter">
                <HSelect
                  modelValue={filterExt.value}
                  options={filterOptions.value}
                  onUpdate:modelValue={(v: string) => {
                    filterExt.value = v;
                    // Entries the new filter hides must not ride along in
                    // the selection to a confirm the operator cannot see.
                    pruneSelection(visibleEntries.value);
                  }}
                />
              </div>
            ) : null}
            <div class="hk-file-browser-layout" role="group">
              <button
                type="button"
                class="hk-file-browser-layout-btn"
                data-layout="list"
                data-active={layout.value === "list" || undefined}
                aria-label={t("hikari::filePicker.listLayout", "List")}
                title={t("hikari::filePicker.listLayout", "List")}
                onClick={() => {
                  layout.value = "list";
                }}
              >
                <List size={16} />
              </button>
              <button
                type="button"
                class="hk-file-browser-layout-btn"
                data-layout="grid"
                data-active={layout.value === "grid" || undefined}
                aria-label={t("hikari::filePicker.gridLayout", "Grid")}
                title={t("hikari::filePicker.gridLayout", "Grid")}
                onClick={() => {
                  layout.value = "grid";
                }}
              >
                <LayoutGrid size={16} />
              </button>
            </div>
          </div>
        </div>
      );
    }

    function renderRenameRow() {
      return (
        <div class="hk-file-browser-rename">
          <span class="hk-file-browser-rename-label">
            {t("hikari::filePicker.renamePrompt", "New name")}
          </span>
          <input
            ref={renameInputRef}
            class="hk-file-browser-rename-input"
            type="text"
            value={renameValue.value}
            aria-label={t("hikari::filePicker.renamePrompt", "New name")}
            onInput={(e: Event) => {
              renameValue.value = (e.target as HTMLInputElement).value;
              renameError.value = false;
            }}
            onKeydown={onRenameKeydown}
          />
          <HButton
            variant="primary"
            size="sm"
            class="hk-file-browser-rename-confirm"
            onClick={() => void confirmRename()}
          >
            {t("hikari::filePicker.renameConfirm", "Rename")}
          </HButton>
          <HButton
            variant="secondary"
            size="sm"
            class="hk-file-browser-rename-cancel"
            onClick={cancelRename}
          >
            {t("hikari::filePicker.renameCancel", "Cancel")}
          </HButton>
          {renameError.value ? (
            <span class="hk-file-browser-rename-error" role="alert">
              {t("hikari::filePicker.nameRequired", "Name is required")}
            </span>
          ) : null}
        </div>
      );
    }

    function renderList(rows: RemoteFileEntry[]) {
      return (
        <div class="hk-file-browser-list">
          <div class="hk-file-browser-list-head" aria-hidden="true">
            <span class="hk-file-browser-col-name">
              {t("hikari::filePicker.name", "Name")}
            </span>
            <span class="hk-file-browser-col-size">
              {t("hikari::filePicker.size", "Size")}
            </span>
            <span class="hk-file-browser-col-modified">
              {t("hikari::filePicker.modified", "Modified")}
            </span>
          </div>
          {rows.map((entry) => (
            <button
              key={entry.name}
              type="button"
              class="hk-file-browser-row"
              data-kind={entry.kind}
              data-selected={selected.value.has(entry.name) || undefined}
              aria-pressed={selected.value.has(entry.name)}
              onClick={() => onEntryClick(entry)}
              onDblclick={() => onEntryActivate(entry)}
            >
              <span class="hk-file-browser-col-name">{entry.name}</span>
              <span class="hk-file-browser-col-size">
                {entry.kind === "file" ? formatSize(entry.size) : "—"}
              </span>
              <span class="hk-file-browser-col-modified">
                {formatModified(entry.modifiedAt)}
              </span>
            </button>
          ))}
        </div>
      );
    }

    function renderGrid(rows: RemoteFileEntry[]) {
      return (
        <div class="hk-file-browser-grid">
          {rows.map((entry) => (
            <button
              key={entry.name}
              type="button"
              class="hk-file-browser-tile"
              data-kind={entry.kind}
              data-selected={selected.value.has(entry.name) || undefined}
              aria-pressed={selected.value.has(entry.name)}
              onClick={() => onEntryClick(entry)}
              onDblclick={() => onEntryActivate(entry)}
            >
              <span class="hk-file-browser-tile-name">{entry.name}</span>
              <span class="hk-file-browser-tile-meta">
                {[
                  entry.kind === "file" ? formatSize(entry.size) : "",
                  formatModified(entry.modifiedAt),
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </button>
          ))}
        </div>
      );
    }

    function renderEntriesArea() {
      if (loading.value) {
        return (
          <div class="hk-file-browser-loading">
            <HSpinner
              size="sm"
              center
              text={t("hikari::filePicker.loading", "Loading…")}
            />
          </div>
        );
      }
      const rows = visibleEntries.value;
      return (
        <>
          {loadError.value ? (
            <div class="hk-file-browser-error" role="alert">
              <span class="hk-file-browser-error-text">
                {t("hikari::filePicker.listError", "Failed to list directory")}
                {loadError.value ? `: ${loadError.value}` : ""}
              </span>
              <HButton
                variant="secondary"
                size="sm"
                class="hk-file-browser-retry"
                onClick={() => void refresh()}
              >
                {t("hikari::filePicker.retry", "Retry")}
              </HButton>
            </div>
          ) : null}
          {/* An empty hint only means "empty" on a healthy listing — a
              failed one stays silent so the error band speaks alone. */}
          {rows.length === 0 && !loadError.value ? (
            <div class="hk-file-browser-empty">
              {t("hikari::filePicker.empty", "This folder is empty")}
            </div>
          ) : layout.value === "list" ? (
            renderList(rows)
          ) : (
            renderGrid(rows)
          )}
        </>
      );
    }

    function renderFooter() {
      return (
        <div class="hk-file-browser-footer">
          {slots.footerForm ? (
            <div class="hk-file-browser-footer-form">{slots.footerForm()}</div>
          ) : null}
          <div class="hk-file-browser-footer-actions">
            <HButton
              variant="secondary"
              size="md"
              class="hk-file-browser-cancel"
              onClick={close}
            >
              {props.cancelLabel ?? t("hikari::filePicker.cancel", "Cancel")}
            </HButton>
            <HButton
              variant="primary"
              size="md"
              class="hk-file-browser-confirm"
              disabled={selected.value.size === 0}
              onClick={confirmSelection}
            >
              {props.confirmLabel ?? t("hikari::filePicker.confirm", "Confirm")}
            </HButton>
          </div>
        </div>
      );
    }

    return () => (
      <HModal
        modelValue={props.modelValue}
        title={props.title ?? t("hikari::filePicker.title", "Browse files")}
        width="56rem"
        onUpdate:modelValue={(v: boolean) => emit("update:modelValue", v)}
      >
        {{
          default: () => (
            <div class="hk-file-browser">
              {renderPathbar()}
              {props.quickLinks.length > 0 ? renderQuickLinks() : null}
              {renderToolbar()}
              {renaming.value ? renderRenameRow() : null}
              <div class="hk-file-browser-entries" data-layout={layout.value}>
                {renderEntriesArea()}
              </div>
            </div>
          ),
          footer: () => renderFooter(),
        }}
      </HModal>
    );
  },
});
