export interface CodeSegment {
  id: string;
  segmentType: string;
  name: string;
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
}

const STRUCTURAL_SEGMENTS = new Set(["config", "loc_txt", "props", "loc_vars"]);

const lineOffsets = (code: string): number[] => {
  const offsets: number[] = [0];
  for (let i = 0; i < code.length; i += 1) {
    if (code[i] === "\n") offsets.push(i + 1);
  }
  return offsets;
};

const lineColToIndex = (
  offsets: number[],
  line: number,
  column: number,
  codeLength: number,
): number => {
  const lineStart = offsets[Math.max(0, line - 1)] ?? codeLength;
  return Math.min(codeLength, Math.max(0, lineStart + Math.max(0, column - 1)));
};

interface SegmentRange {
  id: string;
  start: number;
  end: number;
}

const toRanges = (code: string, segments: CodeSegment[]): SegmentRange[] => {
  const offsets = lineOffsets(code);
  return segments
    .map((segment) => ({
      id: segment.id,
      start: lineColToIndex(offsets, segment.startLine, segment.startColumn, code.length),
      end: lineColToIndex(offsets, segment.endLine, segment.endColumn, code.length),
    }))
    .sort((a, b) => a.start - b.start);
};

const ruleIdFromSegment = (segmentId: string): string | null => {
  if (!segmentId.startsWith("rule:")) return null;
  return segmentId.slice(5);
};

const isMergeManagedSegment = (segmentId: string): boolean =>
  STRUCTURAL_SEGMENTS.has(segmentId) || segmentId.startsWith("rule:");

export function mergeWithGeneratedSegments(
  userCode: string,
  oldGeneratedCode: string,
  oldSegments: CodeSegment[],
  newGeneratedCode: string,
  newSegments: CodeSegment[],
  changedRuleIds: Set<string>,
): string {
  const oldRanges = toRanges(
    oldGeneratedCode,
    oldSegments.filter((segment) => isMergeManagedSegment(segment.id)),
  );
  const newRanges = toRanges(
    newGeneratedCode,
    newSegments.filter((segment) => isMergeManagedSegment(segment.id)),
  );
  const newById = new Map(newRanges.map((range) => [range.id, range]));

  const oldSnippets = new Map(
    oldRanges.map((range) => [range.id, oldGeneratedCode.slice(range.start, range.end)]),
  );

  const replacements: Array<{ start: number; end: number; text: string }> = [];
  let searchFrom = 0;

  for (const oldRange of oldRanges) {
    const oldSnippet = oldSnippets.get(oldRange.id);
    if (!oldSnippet) continue;

    const userIndex = userCode.indexOf(oldSnippet, searchFrom);
    if (userIndex < 0) continue;

    const userStart = userIndex;
    const userEnd = userIndex + oldSnippet.length;
    searchFrom = userEnd;

    const newRange = newById.get(oldRange.id);
    const isStructural = STRUCTURAL_SEGMENTS.has(oldRange.id);
    const ruleId = ruleIdFromSegment(oldRange.id);
    const ruleChanged = !!ruleId && changedRuleIds.has(ruleId);

    if (!newRange) {
      if (isStructural || ruleChanged) {
        replacements.push({ start: userStart, end: userEnd, text: "" });
      }
      continue;
    }

    const newSnippet = newGeneratedCode.slice(newRange.start, newRange.end);
    if (isStructural || ruleChanged) {
      replacements.push({ start: userStart, end: userEnd, text: newSnippet });
    }
  }

  replacements.sort((a, b) => b.start - a.start);

  let merged = userCode;
  for (const replacement of replacements) {
    merged =
      merged.slice(0, replacement.start) +
      replacement.text +
      merged.slice(replacement.end);
  }

  const oldIds = new Set(oldRanges.map((range) => range.id));
  const appended = newRanges
    .filter((range) => !oldIds.has(range.id))
    .map((range) => newGeneratedCode.slice(range.start, range.end))
    .filter((text) => text.trim().length > 0);

  if (appended.length > 0) {
    merged = `${merged.trimEnd()}\n${appended.join("\n")}\n`;
  }

  return merged;
}
