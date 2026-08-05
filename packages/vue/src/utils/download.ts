/**
 * Browser file download helpers (upstreamed from shittim-chest).
 */
export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Download a text payload (CSV/TOML/JSON…) as a file. */
export function downloadTextAsFile(
  filename: string,
  text: string,
  mime = "text/plain",
): void {
  downloadBlob(filename, new Blob([text], { type: mime }));
}
