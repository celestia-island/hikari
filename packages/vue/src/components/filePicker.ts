/**
 * Shared contract for the file-picker family (HkFileField /
 * HkFileBrowserDialog). The dialog is transport-agnostic: callers hand in
 * a `RemoteFsAdapter` and hikari renders the whole browsing/picking UI —
 * list, breadcrumb, clipboard ops, rename — without knowing anything
 * about the backend behind it.
 */

/** One row in a remote directory listing. */
export interface RemoteFileEntry {
  name: string;
  kind: "file" | "dir";
  /** Byte size; directories usually omit it. */
  size?: number;
  /** Best-effort display timestamp (ISO string or epoch millis). */
  modifiedAt?: string | number;
}

/** Result of listing one remote directory. */
export interface RemoteDirListing {
  /** Normalized absolute path actually listed (echoed back for confirmation). */
  path: string;
  entries: RemoteFileEntry[];
}

/**
 * The adapter the host application provides. `list` is required — every
 * other operation is optional and its toolbar affordance is hidden while
 * the handler is missing, so hosts can ship read-only browsers first and
 * grow into full file management.
 */
export interface RemoteFsAdapter {
  list(path: string): Promise<RemoteDirListing>;
  /** Create a directory inside `path`. */
  mkdir?(path: string, name: string): Promise<void>;
  /** Rename `from` (full path) to `toName` (a bare sibling name). */
  rename?(path: string, from: string, toName: string): Promise<void>;
  /** Copy entry `fromPath` (full path) into directory `toDir`. */
  copy?(fromPath: string, toDir: string): Promise<void>;
  /** Move entry `fromPath` (full path) into directory `toDir` (cut+paste). */
  move?(fromPath: string, toDir: string): Promise<void>;
}

/** A bookmark chip rendered above the toolbar for one-click jumps. */
export interface FileQuickLink {
  label: string;
  path: string;
}

/** A file chosen through either picker mode. */
export interface PickedFile {
  name: string;
  /** Remote absolute path (remote mode). */
  path?: string;
  /** Byte size when known. */
  size?: number;
  /** The browser File object (local mode). */
  file?: File;
}

/** Parse a native `accept` string into lowercase extensions (".csv"). */
export function acceptExtensions(accept?: string): string[] {
  if (!accept) return [];
  return accept
    .split(",")
    .map((part) => part.trim().toLowerCase())
    .filter((part) => part.startsWith("."));
}
