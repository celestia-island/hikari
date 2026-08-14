/* Crockford Base32: 0-9 + A-Z minus I L O U (32 chars, unambiguous) */
const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

import { createHash } from "crypto";
import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

/** SHA-256(raw) → first 4 bytes → Crockford Base32 (6 chars). Deterministic. */
function toReadableHash(raw: string): string {
  const digest = createHash("sha256").update(raw).digest();
  let n =
    ((digest[0] << 24) | (digest[1] << 16) | (digest[2] << 8) | digest[3]) >>> 0;
  let result = "";
  for (let i = 0; i < 6; i++) {
    result = CROCKFORD[n % 32] + result;
    n = Math.floor(n / 32);
  }
  return result;
}

/** Vite plugin: after build, extract entry chunk hash → SHA-256 → Crockford Base32 → inject window.__PANEL_BUILD_HASH__. */
export function buildHashPlugin() {
  let outDir = "";
  let panelHash = "";

  return {
    name: "build-hash",
    configResolved(cfg: any) {
      outDir = cfg.build.outDir;
    },
    generateBundle(_: any, bundle: any) {
      for (const chunk of Object.values(bundle) as any[]) {
        if (chunk.type === "chunk" && chunk.isEntry) {
          const fn = chunk.fileName.split("/").pop()?.replace(/\.js$/, "") ?? "";
          const parts = fn.split("-");
          panelHash = parts[parts.length - 1] ?? fn;
          break;
        }
      }
    },
    writeBundle() {
      if (!panelHash || !outDir) return;
      const hash = toReadableHash(panelHash);
      const htmlPath = resolve(outDir, "index.html");
      const scriptPath = resolve(outDir, "panel-build-hash.js");
      try {
        // External script keeps CSP `script-src 'self'` intact: an inline
        // script would need a per-build hash nonce and would be blocked.
        writeFileSync(
          scriptPath,
          `window.__PANEL_BUILD_HASH__ = "${hash}";\n`,
          "utf-8",
        );
        let html = readFileSync(htmlPath, "utf-8");
        html = html.replace(
          /<script>window\.__PANEL_BUILD_HASH__="[^"]*"<\/script>/,
          "",
        );
        html = html.replace(
          "</head>",
          `<script src="/panel-build-hash.js"></script></head>`
        );
        writeFileSync(htmlPath, html, "utf-8");
      } catch {}
    },
  };
}
