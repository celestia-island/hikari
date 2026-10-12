import { describe, expect, it } from "vitest";

import { languageForPath } from "./useHighlight";
import { LANGUAGE_LOADERS } from "./highlightLanguages";

/**
 * `languageForPath` is the ONE mapping from a file path to a highlight.js
 * language — shared so a diff pane, a file browser and a markdown fence
 * all derive the same language from the same path. Its two contracts:
 * every non-empty answer must be a language the lazy loader can actually
 * load (otherwise the promise is a lie), and unknown paths must answer ""
 * (callers treat "" as plaintext/auto-detect, never as an error).
 */
describe("languageForPath", () => {
  it("maps the common extensions onto canonical ids", () => {
    expect(languageForPath("crates/scheduler/src/main.rs")).toBe("rust");
    expect(languageForPath("src/index.ts")).toBe("typescript");
    expect(languageForPath("App.tsx")).toBe("typescript");
    expect(languageForPath("script.js")).toBe("javascript");
    expect(languageForPath("world.toml")).toBe("toml");
    expect(languageForPath("Cargo.toml")).toBe("toml");
    expect(languageForPath("config/world.yml")).toBe("yaml");
    expect(languageForPath("run.sh")).toBe("bash");
    expect(languageForPath("notes.md")).toBe("markdown");
    expect(languageForPath("query.sql")).toBe("sql");
    expect(languageForPath("theme.scss")).toBe("scss");
    expect(languageForPath("index.html")).toBe("xml");
  });

  it("is case-insensitive on name and extension", () => {
    expect(languageForPath("src/Main.RS")).toBe("rust");
    expect(languageForPath("Dockerfile")).toBe("dockerfile");
    expect(languageForPath("Makefile")).toBe("makefile");
    expect(languageForPath("CMakeLists.txt")).toBe("cmake");
    expect(languageForPath("Jenkinsfile")).toBe("groovy");
  });

  it("keeps dotted stems like Dockerfile.dev on their dialect", () => {
    expect(languageForPath("deploy/Dockerfile.dev")).toBe("dockerfile");
    expect(languageForPath("dockerfile.prod")).toBe("dockerfile");
    expect(languageForPath("Makefile.am")).toBe("makefile");
  });

  it("answers \"\" for unknown or extensionless paths, not a guess", () => {
    expect(languageForPath("bin/run")).toBe("");
    expect(languageForPath("README")).toBe("");
    expect(languageForPath("data.xyzzy")).toBe("");
    expect(languageForPath("")).toBe("");
  });

  it("every mapped id is a language the loader actually has", () => {
    const loaders = new Set(Object.keys(LANGUAGE_LOADERS));
    expect(loaders.size).toBeGreaterThan(50); // positive control
    const probes = [
      "a.rs", "a.ts", "a.tsx", "a.js", "a.json", "a.py", "a.rb", "a.go",
      "a.java", "a.kt", "a.scala", "a.groovy", "a.c", "a.h", "a.cpp",
      "a.hpp", "a.cs", "a.fs", "a.php", "a.swift", "a.m", "a.mm",
      "a.dart", "a.ex", "a.erl", "a.hs", "a.elm", "a.lua", "a.pl",
      "a.r", "a.jl", "a.nim", "a.cr", "a.ml", "a.vb", "a.pas", "a.bas",
      "a.f90", "a.coffee", "a.ls", "a.clj", "a.scm", "a.el", "a.xml",
      "a.html", "a.vue", "a.hbs", "a.twig", "a.haml", "a.erb", "a.dust",
      "a.css", "a.scss", "a.less", "a.yml", "a.yaml", "a.toml", "a.ini",
      "a.cfg", "a.properties", "a.env", "a.md", "a.graphql", "a.gql",
      "a.http", "a.sh", "a.zsh", "a.ps1", "a.bat", "a.cmd", "a.mk",
      "a.cmake", "a.awk", "a.tcl", "a.vim", "a.sql", "a.psql", "a.proto",
      "a.thrift", "a.glsl", "a.vert", "a.frag", "a.wasm", "a.asm",
      "a.v", "a.sv", "a.vhd", "a.vhdl", "a.tex", "a.sty", "a.diff",
      "a.patch", "a.txt", "a.log", "Dockerfile", "Makefile", "Jenkinsfile",
      "CMakeLists.txt", "Cargo.lock", ".gitignore", ".env", ".bashrc",
    ];
    const mapped = probes
      .map((p) => languageForPath(p))
      .filter((id): id is string => id !== "");
    // Each probe resolves to SOMETHING (the table is broad)…
    expect(mapped.length).toBe(probes.length);
    // …and every answer is loadable — no lying promises.
    for (const id of mapped) {
      expect(loaders, `languageForPath answered "${id}", which no loader provides`).toContain(id);
    }
  });

  it("does not fall off the path on dots in directories", () => {
    expect(languageForPath("my.dir/stuff/main.rs")).toBe("rust");
    expect(languageForPath("v1.2/config.yaml")).toBe("yaml");
  });
});
