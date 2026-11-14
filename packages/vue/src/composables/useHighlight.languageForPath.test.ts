import { describe, expect, it } from "vitest";

import { languageForPath } from "./useHighlight";

/**
 * The wasm-highlight rewrite (#1313) replaced languageForPath with a
 * bare extension lookup and dropped PATH_FILENAME_LANG + EXT_TABLE —
 * extensionless files triaged as a bogus basename language ("readme"),
 * dotfiles/build files lost their mapping (chest FileBrowser preview
 * caught it downstream, 0.55.381 pickup). These pins hold the restored
 * surface: bare-name build files, dialect stems, dotfiles, and the
 * extensionless → "" (plaintext) contract.
 */
describe("languageForPath", () => {
  it("extensionless files are plaintext (no language)", () => {
    expect(languageForPath("README")).toBe("");
    expect(languageForPath("LICENSE")).toBe("");
    expect(languageForPath("dir/notes")).toBe("");
  });

  it("whole-filename build scripts keep their dialect", () => {
    expect(languageForPath("Dockerfile")).toBe("dockerfile");
    expect(languageForPath("dockerfile.prod")).toBe("dockerfile");
    expect(languageForPath("Makefile")).toBe("makefile");
    expect(languageForPath("Jenkinsfile")).toBe("groovy");
    expect(languageForPath("CMakeLists.txt")).toBe("cmake");
  });

  it("dotfiles map to ini/bash", () => {
    expect(languageForPath(".env")).toBe("ini");
    expect(languageForPath(".gitignore")).toBe("ini");
    expect(languageForPath(".bashrc")).toBe("bash");
  });

  it("extension mapping stays canonical", () => {
    expect(languageForPath("main.rs")).toBe("rust");
    expect(languageForPath("app.tsx")).toBe("typescript");
    expect(languageForPath("notes.txt")).toBe("plaintext");
    expect(languageForPath("run.log")).toBe("plaintext");
    expect(languageForPath("spec/api.yaml")).toBe("yaml");
    expect(languageForPath("page.vue")).toBe("xml");
  });

  it("the basename is lowercased before any lookup", () => {
    expect(languageForPath("DOCKERFILE")).toBe("dockerfile");
    expect(languageForPath("README.MD")).toBe("markdown");
  });
});
