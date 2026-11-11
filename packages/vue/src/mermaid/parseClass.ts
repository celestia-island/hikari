/**
 * parseClass.ts — `classDiagram` parser, a line-oriented mirror of
 * ratatui-markdown's `class_diagram.rs`:
 *
 *  - `class Name {` opens a member block (attributes before methods, in
 *    file order); a `}` closes it; `class Name { attr; method() }` on ONE
 *    line is also accepted (members split on `;`);
 *  - members: a leading `+/-/#/~` sets visibility, else Internal; `(` in
 *    the remainder marks a method (return type = after the LAST colon),
 *    else an attribute (`name: type` splits on the FIRST colon);
 *  - relationships: the pattern table is searched IN ORDER (`<|--`,
 *    `*--`, `o--`, `..|>`, `..`, `<--`, `-->`, `--`) — the first match
 *    wins, which is exactly why `<|--` must be probed before `..`;
 *    `to` may carry `: label`.
 *
 * No class blocks → null (a bare relationship list is not renderable as
 * the family models it).
 */

import type {
  ClassDefinition,
  ClassMember,
  ClassRelationship,
  ClassRelationshipType,
  ClassVisibility,
  MermaidClassDoc,
} from "./types";
import { MermaidParseError } from "./parseGraph";

const RELATIONS: Array<[string, ClassRelationshipType, ClassRelationship["arrowAt"]]> = [
  // Third tuple slot = where mermaid paints the adornment (the glyph
  // sits adjacent to that end): `<|`, `*`, `o`, `<` hug the FROM class.
  ["<|--", "inheritance", "from"],
  ["*--", "composition", "from"],
  ["o--", "aggregation", "from"],
  ["..|>", "implements", "to"],
  // `..>` BEFORE `..`: the dotted arrow is the standard mermaid
  // dependency form; the Rust reference lacks this entry and reads
  // `A ..> B` as dependency with a mangled `> B` target. Intentional,
  // documented deviation — sync ratatui-markdown's table when it grows
  // the same pattern.
  ["..>", "dependency", "to"],
  ["..", "dependency", "none"],
  ["<--", "directed-association", "from"],
  ["-->", "directed-association", "to"],
  ["--", "association", "none"],
];

function visibilityOf(ch: string): ClassVisibility | null {
  switch (ch) {
    case "+": return "public";
    case "-": return "private";
    case "#": return "protected";
    case "~": return "internal";
    default: return null;
  }
}

function parseMember(line: string): ClassMember | null {
  if (line === "" || line.startsWith("%")) return null;
  const first = line[0];
  const vis = visibilityOf(first);
  if (!vis) {
    return {
      visibility: "internal",
      name: line,
      typeInfo: "",
      isMethod: line.includes("("),
    };
  }
  const rest = line.slice(1).trim();
  const isMethod = rest.includes("(");
  if (isMethod) {
    const paren = rest.indexOf("(");
    const name = rest.slice(0, paren).trim();
    const afterParen = rest.slice(paren);
    const colon = afterParen.lastIndexOf(":");
    const typeInfo = colon >= 0 ? afterParen.slice(colon + 1).trim() : "";
    return { visibility: vis, name, typeInfo, isMethod: true };
  }
  const colon = rest.indexOf(":");
  if (colon >= 0) {
    return { visibility: vis, name: rest.slice(0, colon).trim(), typeInfo: rest.slice(colon + 1).trim(), isMethod: false };
  }
  return { visibility: vis, name: rest, typeInfo: "", isMethod: false };
}

function parseRelationship(line: string): ClassRelationship | null {
  if (line === "" || line.startsWith("%")) return null;
  for (const [pattern, relType, arrowAt] of RELATIONS) {
    const pos = line.indexOf(pattern);
    if (pos < 0) continue;
    const from = line.slice(0, pos).trim();
    const after = line.slice(pos + pattern.length);
    const colon = after.indexOf(":");
    const [to, label] =
      colon >= 0 ? [after.slice(0, colon).trim(), after.slice(colon + 1).trim()] : [after.trim(), null];
    if (from === "" || to === "") return null;
    // Rust `trim_matches('"')` strips ONLY edge quotes; replaceAll would
    // eat inner ones too (R2 finding 10c).
    const stripEdgeQuotes = (s: string): string => s.replace(/^"+/, "").replace(/"+$/, "");
    return {
      from: stripEdgeQuotes(from),
      to: stripEdgeQuotes(to),
      relType,
      label: label !== null && label !== "" ? label : null,
      arrowAt,
    };
  }
  return null;
}

export function parseClassDiagram(source: string): MermaidClassDoc {
  const classes: ClassDefinition[] = [];
  const relationships: ClassRelationship[] = [];
  let current: ClassDefinition | null = null;
  let inBody = false;
  let braceDepth = 0;

  const pushMember = (cls: ClassDefinition, member: ClassMember | null): void => {
    if (!member) return;
    if (member.isMethod) cls.methods.push(member);
    else cls.attributes.push(member);
  };

  for (const raw of source.split(/\r\n|\n/)) {
    const line = raw.trim();
    if (line === "" || line === "classDiagram") continue;

    if (inBody && current) {
      if (line === "}") {
        braceDepth -= 1;
        if (braceDepth === 0) {
          inBody = false;
          classes.push(current);
          current = null;
          continue;
        }
      }
      if (braceDepth > 0 && line !== "" && !line.startsWith("%")) {
        pushMember(current, parseMember(line));
      }
      continue;
    }

    if (line.startsWith("class ") && line.includes("{")) {
      const rest = line.slice(6).trim();
      const name = rest.split("{")[0].trim();
      if (name === "") continue;
      current = { name, attributes: [], methods: [] };
      inBody = true;
      braceDepth = 1;
      // One-line body: `class A { +x: int }`
      const bodyPart = line.split("{")[1] ?? "";
      if (bodyPart.includes("}")) {
        const content = bodyPart.split("}")[0];
        for (const member of content.split(/[;\n]/)) {
          pushMember(current, parseMember(member.trim()));
        }
        braceDepth = 0;
        inBody = false;
        classes.push(current);
        current = null;
      }
      continue;
    }

    const rel = parseRelationship(line);
    if (rel) relationships.push(rel);
  }

  // Unterminated block: keep it if it gathered anything (Rust parity).
  if (current && (current.attributes.length > 0 || current.methods.length > 0)) {
    classes.push(current);
  }

  if (classes.length === 0) throw new MermaidParseError("class diagram has no classes");
  return { kind: "class", classes, relationships };
}
