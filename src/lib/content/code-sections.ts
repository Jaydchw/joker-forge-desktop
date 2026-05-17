const MARKER_RE = /^(\s*)-- \[JF:([^\]]+)\] (begin|end)\s*$/;

export interface SectionInfo {
  /** Section identifier, e.g. "config", "loc_txt", "rule:<uuid>" */
  id: string;
  /** The clean content of this section (lines between markers, no markers) */
  content: string;
}

export interface ExtractedCode {
  /** The code with all marker lines removed */
  cleanCode: string;
  /** Ordered list of sections found in the code */
  sections: SectionInfo[];
}

// Parse marker-based code into clean code + section map.
export function extractSections(markedCode: string): ExtractedCode {
  const lines = markedCode.split("\n");
  const cleanLines: string[] = [];
  const sections: SectionInfo[] = [];

  let currentSectionId: string | null = null;
  let sectionContentLines: string[] = [];

  for (const line of lines) {
    const match = line.match(MARKER_RE);

    if (match) {
      const [, , sectionId, type] = match;

      if (type === "begin") {
        currentSectionId = sectionId;
        sectionContentLines = [];
      } else if (type === "end" && currentSectionId === sectionId) {
        sections.push({
          id: sectionId,
          content: sectionContentLines.join("\n"),
        });
        currentSectionId = null;
        sectionContentLines = [];
      }
      // Marker lines are NOT added to cleanLines
    } else if (currentSectionId !== null) {
      // Inside a section, include in both clean output and section content.
      sectionContentLines.push(line);
      cleanLines.push(line);
    } else {
      // Outside any section, pass through unchanged.
      cleanLines.push(line);
    }
  }

  return { cleanCode: cleanLines.join("\n"), sections };
}

/** Sections that always use the new generation (item property changes). */
const STRUCTURAL_SECTIONS = new Set(["config", "loc_txt", "props", "loc_vars"]);

interface Anchor {
  id: string;
  /** Char index in userCode where this section starts (-1 if not found). */
  start: number;
  /** Char index where it ends (-1 if not found). */
  end: number;
  /** True if the exact old content was found (user didn't modify it). */
  found: boolean;
}

export function mergeWithGenerated(
  userCode: string,
  oldSections: SectionInfo[],
  _newCleanCode: string,
  newSections: SectionInfo[],
  changedRuleIds: Set<string>,
): string {
  const newSectionMap = new Map(newSections.map((s) => [s.id, s]));
  const oldSectionSet = new Set(oldSections.map((s) => s.id));

  // Step 1: Find where each old section's content sits in the user's code.
  const anchors: Anchor[] = [];
  let searchFrom = 0;

  for (const section of oldSections) {
    const idx = userCode.indexOf(section.content, searchFrom);
    if (idx !== -1) {
      anchors.push({
        id: section.id,
        start: idx,
        end: idx + section.content.length,
        found: true,
      });
      searchFrom = idx + section.content.length;
    } else {
      anchors.push({ id: section.id, start: -1, end: -1, found: false });
    }
  }

  // Step 2: For user-modified sections (not found by exact match), infer
  // their boundaries from the nearest surrounding found anchors.
  for (let i = 0; i < anchors.length; i++) {
    if (anchors[i].found) continue;

    let prevEnd = 0;
    for (let j = i - 1; j >= 0; j--) {
      if (anchors[j].found || anchors[j].start >= 0) {
        prevEnd = anchors[j].end;
        break;
      }
    }

    let nextStart = userCode.length;
    for (let j = i + 1; j < anchors.length; j++) {
      if (anchors[j].found) {
        nextStart = anchors[j].start;
        break;
      }
    }

    // If multiple consecutive sections are unfound, they share this range.
    // Divide proportionally based on original content lengths.
    const consecutiveUnfound: number[] = [];
    for (let j = i; j < anchors.length && !anchors[j].found; j++) {
      consecutiveUnfound.push(j);
    }

    if (consecutiveUnfound.length === 1) {
      anchors[i].start = prevEnd;
      anchors[i].end = nextStart;
    } else {
      // Proportional split based on old section content lengths.
      const totalOldLen = consecutiveUnfound.reduce(
        (sum, idx) => sum + oldSections[idx].content.length,
        0,
      );
      const rangeLen = nextStart - prevEnd;
      let offset = prevEnd;

      for (const idx of consecutiveUnfound) {
        const proportion =
          totalOldLen > 0
            ? oldSections[idx].content.length / totalOldLen
            : 1 / consecutiveUnfound.length;
        const segLen = Math.round(rangeLen * proportion);
        anchors[idx].start = offset;
        anchors[idx].end = Math.min(offset + segLen, nextStart);
        offset = anchors[idx].end;
      }
      // Last one gets the remainder to avoid rounding gaps.
      anchors[consecutiveUnfound[consecutiveUnfound.length - 1]].end =
        nextStart;
    }

    // Skip ahead past the consecutive unfound group
    i = consecutiveUnfound[consecutiveUnfound.length - 1];
  }

  // Step 3: Build replacements (end-to-start preserves indexes).
  const replacements: Array<{
    start: number;
    end: number;
    newContent: string;
  }> = [];

  for (let i = anchors.length - 1; i >= 0; i--) {
    const anchor = anchors[i];
    const newSection = newSectionMap.get(anchor.id);
    const isRuleSection = anchor.id.startsWith("rule:");
    const ruleId = isRuleSection ? anchor.id.slice(5) : "";

    if (!newSection) {
      // Section deleted (rule removed), remove its content.
      if (anchor.start >= 0 && anchor.end > anchor.start) {
        replacements.push({
          start: anchor.start,
          end: anchor.end,
          newContent: "",
        });
      }
      continue;
    }

    if (anchor.found) {
      // User didn't modify this section
      if (STRUCTURAL_SECTIONS.has(anchor.id)) {
        // Always regenerate structural sections
        replacements.push({
          start: anchor.start,
          end: anchor.end,
          newContent: newSection.content,
        });
      } else if (isRuleSection && changedRuleIds.has(ruleId)) {
        // Rule changed, use new generation.
        replacements.push({
          start: anchor.start,
          end: anchor.end,
          newContent: newSection.content,
        });
      }
      // Otherwise unchanged in both, keep as-is.
    } else {
      // User modified this section
      if (STRUCTURAL_SECTIONS.has(anchor.id)) {
        replacements.push({
          start: anchor.start,
          end: anchor.end,
          newContent: newSection.content,
        });
      } else if (isRuleSection && changedRuleIds.has(ruleId)) {
        replacements.push({
          start: anchor.start,
          end: anchor.end,
          newContent: newSection.content,
        });
      }
      // Otherwise user modified + rule did not change, preserve user edits.
    }
  }

  // Apply replacements (they're already in reverse order)
  let result = userCode;
  for (const rep of replacements) {
    result =
      result.slice(0, rep.start) + rep.newContent + result.slice(rep.end);
  }

  // Step 4: Append any brand-new sections (new rules not in old generation).
  const newOnlySections = newSections.filter((s) => !oldSectionSet.has(s.id));
  if (newOnlySections.length > 0) {
    const newRuleContent = newOnlySections.map((s) => s.content).join("\n");
    result = result.trimEnd() + "\n" + newRuleContent + "\n";
  }

  return result;
}

// Detect which sections the user modified.
export function findModifiedSections(
  userCode: string,
  sections: SectionInfo[],
): string[] {
  const modified: string[] = [];
  let searchFrom = 0;

  for (const section of sections) {
    const idx = userCode.indexOf(section.content, searchFrom);
    if (idx !== -1) {
      searchFrom = idx + section.content.length;
    } else {
      modified.push(section.id);
    }
  }

  return modified;
}

// Reconstruct code with visible marker comments.
export function reconstructWithMarkers(
  cleanCode: string,
  sections: SectionInfo[],
): string {
  const lines = cleanCode.split("\n");
  // Find each section's line range in the clean code
  type LineRange = { id: string; startLine: number; endLine: number };
  const ranges: LineRange[] = [];
  let searchFromLine = 0;

  for (const section of sections) {
    if (!section.content) {
      // Empty section, skip marker insertion.
      // surrounding context. Skip for now (empty sections get no markers).
      continue;
    }
    const sectionLines = section.content.split("\n");
    let found = false;

    for (let i = searchFromLine; i <= lines.length - sectionLines.length; i++) {
      let match = true;
      for (let j = 0; j < sectionLines.length; j++) {
        if (lines[i + j] !== sectionLines[j]) {
          match = false;
          break;
        }
      }
      if (match) {
        ranges.push({
          id: section.id,
          startLine: i,
          endLine: i + sectionLines.length - 1,
        });
        searchFromLine = i + sectionLines.length;
        found = true;
        break;
      }
    }

    if (!found) {
      // Section was modified by user, cannot precisely locate, skip markers.
    }
  }

  // Insert markers in reverse order so line numbers stay valid
  const result = [...lines];
  for (let i = ranges.length - 1; i >= 0; i--) {
    const range = ranges[i];
    result.splice(range.endLine + 1, 0, `-- [JF:${range.id}] end`);
    result.splice(range.startLine, 0, `-- [JF:${range.id}] begin`);
  }

  return result.join("\n");
}
