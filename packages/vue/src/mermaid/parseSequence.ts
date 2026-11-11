/**
 * parseSequence.ts — `sequenceDiagram` parser, a line-oriented mirror of
 * ratatui-markdown's `sequence.rs`:
 *
 *  - `participant NAME` declares a lane (order preserved);
 *  - `A->B: text` sends a message; the four arrow kinds map 1:1;
 *  - message participants are auto-declared on first use, in order;
 *  - the arrow search order (`-->>`, `->>`, `-->`, `->`) matters — a
 *    longer token must win so `A-->>B` is never read as `A-` + `->>B`.
 *
 * A diagram with no participants at all is not a sequence diagram → null.
 */

import type { MermaidSequenceDoc, SeqArrowKind, SequenceMessage } from "./types";
import { MermaidParseError } from "./parseGraph";

const ARROWS: Array<[string, SeqArrowKind]> = [
  ["-->>", "dotted-open"],
  ["->>", "solid-open"],
  ["-->", "dotted"],
  ["->", "solid"],
];

function parseMessage(line: string): SequenceMessage | null {
  for (const [token, arrowKind] of ARROWS) {
    const idx = line.indexOf(token);
    if (idx < 0) continue;
    const from = line.slice(0, idx).trim();
    const toAndText = line.slice(idx + token.length).trim();
    const colon = toAndText.indexOf(":");
    const [to, text] =
      colon >= 0
        ? [toAndText.slice(0, colon).trim(), toAndText.slice(colon + 1).trim()]
        : [toAndText, ""];
    if (from === "" || to === "") return null;
    return { from, to, text, arrowKind };
  }
  return null;
}

export function parseSequence(source: string): MermaidSequenceDoc {
  const participants: string[] = [];
  const partSet = new Set<string>();
  const messages: SequenceMessage[] = [];

  for (const raw of source.split(/\r\n|\n/)) {
    const line = raw.trim();
    if (line === "" || line === "sequenceDiagram") continue;

    if (line.startsWith("participant ")) {
      const name = line.slice("participant ".length).trim();
      if (name !== "" && !partSet.has(name)) {
        partSet.add(name);
        participants.push(name);
      }
      continue;
    }

    // No explicit `autonumber` skip: Rust has none either — a bare
    // `autonumber` / `autonumber 2` line finds no arrow in parseMessage
    // and dies there naturally, while a lane literally named
    // "autonumber" keeps working (R4 finding 6, exact parity).
    const msg = parseMessage(line);
    if (msg) {
      for (const name of [msg.from, msg.to]) {
        if (!partSet.has(name)) {
          partSet.add(name);
          participants.push(name);
        }
      }
      messages.push(msg);
    }
  }

  if (participants.length === 0) throw new MermaidParseError("sequence diagram has no participants");
  return { kind: "sequence", participants, messages };
}
