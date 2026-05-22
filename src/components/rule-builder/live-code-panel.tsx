import React, { useRef, useEffect, useState, useCallback } from "react";
import {
  BracketsCurly,
  WarningCircle,
  ArrowCounterClockwise,
  ArrowsClockwise,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  EditorState,
  Compartment,
  StateField,
  StateEffect,
  type Range,
} from "@codemirror/state";
import {
  EditorView,
  Decoration,
  type DecorationSet,
  keymap,
  lineNumbers,
  highlightActiveLine,
  highlightActiveLineGutter,
} from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { StreamLanguage } from "@codemirror/language";
import { lua } from "@codemirror/legacy-modes/mode/lua";
import { oneDark } from "@codemirror/theme-one-dark";
import { searchKeymap } from "@codemirror/search";
import { linter, type Diagnostic } from "@codemirror/lint";
import {
  autocompletion,
  acceptCompletion,
  completionStatus,
  completionKeymap,
  closeBrackets,
  closeBracketsKeymap,
  moveCompletionSelection,
} from "@codemirror/autocomplete";
import { luaSmodsCompletions } from "@/lib/content/lua-completions";
import type { CodeSegment } from "@/lib/content/code-sections";

interface LiveCodePanelProps {
  title: string;
  code: string;
  isLoading: boolean;
  statusMessage?: string;
  isError?: boolean;
  errorDetails?: string;
  widthPercent: number;
  isBlockPreview: boolean;
  onBackToItem: () => void;
  onStartResize: (e: React.MouseEvent) => void;
  onCodeChange?: (code: string) => void;
  onResetCustomCode?: () => void;
  hasCustomCode?: boolean;
  segments?: CodeSegment[];
  selectedSegmentId?: string;
  hoveredSegmentId?: string;
  conditionClauseIndexBySegmentId?: Record<string, number>;
}

// Theme that inherits the panel background (transparent)
const editorTheme = EditorView.theme({
  "&": {
    height: "100%",
    backgroundColor: "transparent !important",
  },
  "&.cm-editor": {
    backgroundColor: "transparent !important",
    userSelect: "text",
    WebkitUserSelect: "text",
  },
  "&.cm-editor ::selection": {
    backgroundColor: "hsl(var(--primary) / 0.5)",
  },
  ".cm-content": {
    fontFamily:
      "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace",
    caretColor: "hsl(var(--foreground))",
    lineHeight: "1.6",
    padding: "12px 0",
    userSelect: "text",
    WebkitUserSelect: "text",
    cursor: "text",
  },
  ".cm-content[contenteditable='false']": {
    cursor: "text",
  },
  ".cm-line": {
    userSelect: "text",
    WebkitUserSelect: "text",
    cursor: "text",
  },
  ".cm-gutters": {
    backgroundColor: "transparent !important",
    borderRight: "1px solid hsl(var(--border) / 0.3)",
    color: "hsl(var(--foreground) / 0.25)",
    minWidth: "3.4rem",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "hsl(var(--foreground) / 0.04)",
  },
  ".cm-activeLine": {
    backgroundColor: "hsl(var(--foreground) / 0.03)",
  },
  ".cm-selectionLayer .cm-selectionBackground": {
    backgroundColor: "hsl(var(--primary) / 0.42) !important",
  },
  "&.cm-focused .cm-selectionLayer .cm-selectionBackground": {
    backgroundColor: "hsl(var(--primary) / 0.58) !important",
  },
  ".cm-content ::selection": {
    backgroundColor: "hsl(var(--primary) / 0.5)",
  },
  ".cm-line ::selection": {
    backgroundColor: "hsl(var(--primary) / 0.5)",
  },
  ".cm-cursor": {
    borderLeftColor: "hsl(var(--foreground))",
    borderLeftWidth: "2px",
  },
  ".cm-scroller": {
    overflow: "auto",
  },
  // Autocomplete tooltip styling
  ".cm-tooltip.cm-tooltip-autocomplete": {
    backgroundColor: "hsl(var(--card) / 1)",
    border: "1px solid hsl(var(--border) / 0.9)",
    borderRadius: "8px",
    boxShadow: "0 10px 28px rgba(0,0,0,0.55)",
  },
  ".cm-tooltip.cm-tooltip-autocomplete > ul": {
    fontFamily:
      "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace",
  },
  ".cm-tooltip.cm-tooltip-autocomplete > ul > li": {
    padding: "3px 8px",
  },
  ".cm-tooltip.cm-tooltip-autocomplete > ul > li[aria-selected]": {
    backgroundColor: "hsl(var(--primary) / 0.58)",
    color: "hsl(var(--primary-foreground))",
    outline: "2px solid hsl(var(--primary))",
    boxShadow:
      "inset 4px 0 0 hsl(var(--primary-foreground) / 0.95), inset 0 0 0 1px hsl(var(--primary) / 0.35)",
    fontWeight: "700",
  },
  ".cm-completionLabel": {
    color: "hsl(var(--foreground))",
  },
  ".cm-completionDetail": {
    color: "hsl(var(--muted-foreground))",
    fontStyle: "normal",
    marginLeft: "8px",
  },
  ".cm-completionMatchedText": {
    color: "hsl(var(--primary))",
    textDecoration: "none",
    fontWeight: "600",
  },
  ".cm-line.jf-segment-hover-line": {
    backgroundColor: "rgba(34, 197, 94, 0.08) !important",
    boxShadow: "inset 2px 0 0 rgba(34, 197, 94, 0.38)",
  },
  ".cm-line.jf-segment-selected-line": {
    backgroundColor: "rgba(34, 197, 94, 0.12) !important",
    boxShadow: "inset 2px 0 0 rgba(34, 197, 94, 0.62)",
  },
  ".cm-jf-segment-hover-range": {
    backgroundColor: "rgba(34, 197, 94, 0.12)",
    borderRadius: "2px",
  },
  ".cm-jf-segment-selected-range": {
    backgroundColor: "rgba(34, 197, 94, 0.2)",
    boxShadow: "inset 0 0 0 1px rgba(34, 197, 94, 0.45)",
    borderRadius: "2px",
  },
});

const readOnlyCompartment = new Compartment();
const fontSizeCompartment = new Compartment();

const setSegmentDecorationsEffect = StateEffect.define<DecorationSet>();

const segmentHighlightField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none;
  },
  update(value, tr) {
    let next = value.map(tr.changes);
    for (const effect of tr.effects) {
      if (effect.is(setSegmentDecorationsEffect)) {
        next = effect.value;
      }
    }
    return next;
  },
  provide: (field) => EditorView.decorations.from(field),
});

const makeFontSizeTheme = (size: number) =>
  EditorView.theme({
    "&": { fontSize: `${size}px` },
    ".cm-tooltip.cm-tooltip-autocomplete > ul": {
      fontSize: `${Math.max(size - 1, 9)}px`,
    },
  });

const MIN_FONT_SIZE = 8;
const MAX_FONT_SIZE = 24;
const DEFAULT_FONT_SIZE = 12;
const MAX_SEGMENT_LINE_DECORATIONS = 1200;

const OPEN_BLOCK_RE = /(?:\{|\(|\[|(?:^|\s)(do|then|function|repeat)\s*)$/;
const DEDENT_LINE_RE = /^\s*(?:end|until|else|elseif)\b/;
const INCREASE_LINE_RE =
  /^\s*(?:if\b.*\bthen\b|for\b.*\bdo\b|while\b.*\bdo\b|function\b|repeat\b|do\b|else\b|elseif\b)/;

const getIndentUnit = (lineIndent: string): string => {
  if (lineIndent.includes("\t")) return "\t";
  return "  ";
};

const getCurrentLineIndent = (lineText: string): string => {
  const match = lineText.match(/^\s*/);
  return match?.[0] ?? "";
};

const getPreviousLineIndentContext = (
  doc: EditorState["doc"],
  lineNo: number,
): { indent: string; unit: string } => {
  for (let ln = lineNo - 1; ln >= 1; ln -= 1) {
    const text = doc.line(ln).text;
    if (!text.trim()) continue;
    const indent = getCurrentLineIndent(text);
    const unit = getIndentUnit(indent);
    const inc = INCREASE_LINE_RE.test(text);
    return { indent: inc ? indent + unit : indent, unit };
  }
  return { indent: "", unit: "  " };
};

const shouldIncreaseIndent = (beforeCursor: string): boolean => {
  const trimmed = beforeCursor.trimEnd();
  if (!trimmed) return false;
  return OPEN_BLOCK_RE.test(trimmed);
};

const stripLuaStringsAndComments = (source: string): string => {
  return source
    .replace(/--\[\[[\s\S]*?\]\]/g, " ")
    .replace(/--[^\n]*/g, " ")
    .replace(/"(?:\\.|[^"\\])*"/g, '""')
    .replace(/'(?:\\.|[^'\\])*'/g, "''");
};

const luaBasicLinter = linter((view) => {
  const diagnostics: Diagnostic[] = [];
  const text = view.state.doc.toString();
  const clean = stripLuaStringsAndComments(text);

  const openerToCloser: Record<string, string> = {
    "(": ")",
    "[": "]",
    "{": "}",
  };
  const closerToOpener: Record<string, string> = {
    ")": "(",
    "]": "[",
    "}": "{",
  };

  const delimStack: Array<{ ch: string; pos: number }> = [];
  for (let i = 0; i < clean.length; i += 1) {
    const ch = clean[i];
    if (openerToCloser[ch]) {
      delimStack.push({ ch, pos: i });
      continue;
    }
    if (closerToOpener[ch]) {
      const expectedOpen = closerToOpener[ch];
      const top = delimStack[delimStack.length - 1];
      if (!top || top.ch !== expectedOpen) {
        diagnostics.push({
          from: i,
          to: i + 1,
          severity: "error",
          message: `Unexpected '${ch}'`,
        });
      } else {
        delimStack.pop();
      }
    }
  }
  for (const unclosed of delimStack) {
    diagnostics.push({
      from: unclosed.pos,
      to: unclosed.pos + 1,
      severity: "error",
      message: `Unclosed '${unclosed.ch}'`,
    });
  }

  const blockTokenRe = /\b(function|if|for|while|do|repeat|end|until)\b/g;
  const blockStack: Array<{ token: string; pos: number }> = [];
  for (const match of clean.matchAll(blockTokenRe)) {
    const token = match[1];
    const pos = match.index ?? 0;
    if (
      token === "function" ||
      token === "if" ||
      token === "for" ||
      token === "while" ||
      token === "do" ||
      token === "repeat"
    ) {
      blockStack.push({ token, pos });
      continue;
    }
    if (token === "end") {
      let matched = false;
      for (let i = blockStack.length - 1; i >= 0; i -= 1) {
        const t = blockStack[i].token;
        if (t !== "repeat") {
          blockStack.splice(i, 1);
          matched = true;
          break;
        }
      }
      if (!matched) {
        diagnostics.push({
          from: pos,
          to: pos + token.length,
          severity: "error",
          message: "Unexpected 'end'",
        });
      }
      continue;
    }
    if (token === "until") {
      let matched = false;
      for (let i = blockStack.length - 1; i >= 0; i -= 1) {
        if (blockStack[i].token === "repeat") {
          blockStack.splice(i, 1);
          matched = true;
          break;
        }
      }
      if (!matched) {
        diagnostics.push({
          from: pos,
          to: pos + token.length,
          severity: "error",
          message: "Unexpected 'until' (missing matching 'repeat')",
        });
      }
    }
  }
  for (const unclosed of blockStack) {
    diagnostics.push({
      from: unclosed.pos,
      to: unclosed.pos + unclosed.token.length,
      severity: "warning",
      message:
        unclosed.token === "repeat"
          ? "Missing matching 'until'"
          : `Missing matching 'end' for '${unclosed.token}' block`,
    });
  }

  return diagnostics;
});

const LiveCodePanel: React.FC<LiveCodePanelProps> = ({
  title,
  code,
  isLoading,
  statusMessage,
  isError = false,
  errorDetails,
  widthPercent,
  isBlockPreview,
  onBackToItem,
  onStartResize,
  onCodeChange,
  onResetCustomCode,
  hasCustomCode = false,
  segments: _segments,
  selectedSegmentId,
  hoveredSegmentId,
  conditionClauseIndexBySegmentId = {},
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onCodeChangeRef = useRef(onCodeChange);
  const isExternalUpdateRef = useRef(false);
  const refreshAnimTimeoutRef = useRef<number | null>(null);

  // Font size for Ctrl+scroll zoom
  const [fontSize, setFontSize] = useState(DEFAULT_FONT_SIZE);

  onCodeChangeRef.current = onCodeChange;

  const triggerRefreshAnimation = useCallback((charCount: number) => {
    const view = viewRef.current;
    if (!view) return;

    const content = view.contentDOM;
    const refreshDurationMs = Math.max(
      48,
      Math.min(120, 44 + Math.round(Math.sqrt(Math.max(charCount, 1)) * 1.1)),
    );
    content.style.setProperty("--jf-live-refresh-ms", `${refreshDurationMs}ms`);

    content.classList.remove("jf-live-refresh");
    // Force reflow so the class re-add retriggers the animation.
    void content.offsetWidth;
    content.classList.add("jf-live-refresh");

    if (refreshAnimTimeoutRef.current !== null) {
      window.clearTimeout(refreshAnimTimeoutRef.current);
    }

    refreshAnimTimeoutRef.current = window.setTimeout(() => {
      content.classList.remove("jf-live-refresh");
      content.style.removeProperty("--jf-live-refresh-ms");
      refreshAnimTimeoutRef.current = null;
    }, refreshDurationMs + 40);
  }, []);

  // Ctrl+scroll to change font size
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (!e.ctrlKey && !e.metaKey) return;
    if (e.cancelable) {
      e.preventDefault();
    }
    setFontSize((prev) => {
      const delta = e.deltaY > 0 ? -1 : 1;
      return Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, prev + delta));
    });
  }, []);

  // Update CM font size when state changes
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: fontSizeCompartment.reconfigure(makeFontSizeTheme(fontSize)),
    });
  }, [fontSize]);

  // Editable when not in block preview and onCodeChange is provided
  const isEditable = !isBlockPreview && !!onCodeChange;

  const displayCode = code;
  const segments = _segments ?? [];
  const selectedSegmentExists = !!(
    selectedSegmentId && segments.some((segment) => segment.id === selectedSegmentId)
  );
  const hoveredSegmentExists = !!(
    hoveredSegmentId && segments.some((segment) => segment.id === hoveredSegmentId)
  );

  const buildSegmentHighlightDecorations = useCallback(() => {
    if (!segments.length || (!selectedSegmentId && !hoveredSegmentId)) {
      return Decoration.none;
    }
    const lineStarts = [0];
    for (let i = 0; i < displayCode.length; i += 1) {
      if (displayCode[i] === "\n") lineStarts.push(i + 1);
    }
    const numericField = (
      segment: CodeSegment,
      camelCaseKey: keyof CodeSegment,
      snakeCaseKey: string,
    ): number | null => {
      const raw =
        (segment as unknown as Record<string, unknown>)[camelCaseKey as string] ??
        (segment as unknown as Record<string, unknown>)[snakeCaseKey];

      if (typeof raw === "number") {
        return Number.isFinite(raw) ? raw : null;
      }

      if (typeof raw === "string") {
        const parsed = Number(raw);
        return Number.isFinite(parsed) ? parsed : null;
      }

      return null;
    };

    const splitTopLevelBooleanClauses = (
      expr: string,
    ): Array<{ start: number; end: number }> => {
      const out: Array<{ start: number; end: number }> = [];
      let depth = 0;
      let clauseStart = 0;
      let i = 0;
      while (i < expr.length) {
        const ch = expr[i];
        if (ch === "(") {
          depth += 1;
          i += 1;
          continue;
        }
        if (ch === ")") {
          depth = Math.max(0, depth - 1);
          i += 1;
          continue;
        }
        if (depth === 0) {
          const andMatch = expr.slice(i).match(/^(?:\s+)and(?:\s+)/);
          const orMatch = expr.slice(i).match(/^(?:\s+)or(?:\s+)/);
          const m = andMatch ?? orMatch;
          if (m) {
            out.push({ start: clauseStart, end: i });
            clauseStart = i + m[0].length;
            i += m[0].length;
            continue;
          }
        }
        i += 1;
      }
      out.push({ start: clauseStart, end: expr.length });
      return out;
    };

    const trimOuterParens = (expr: string): { start: number; end: number } => {
      let start = 0;
      let end = expr.length;
      while (start < end && /\s/.test(expr[start] ?? "")) start += 1;
      while (end > start && /\s/.test(expr[end - 1] ?? "")) end -= 1;
      let changed = true;
      while (changed && end - start >= 2 && expr[start] === "(" && expr[end - 1] === ")") {
        changed = false;
        let depth = 0;
        let wrapsWhole = true;
        for (let i = start; i < end; i += 1) {
          const ch = expr[i];
          if (ch === "(") depth += 1;
          else if (ch === ")") depth -= 1;
          if (depth === 0 && i < end - 1) {
            wrapsWhole = false;
            break;
          }
        }
        if (wrapsWhole) {
          start += 1;
          end -= 1;
          while (start < end && /\s/.test(expr[start] ?? "")) start += 1;
          while (end > start && /\s/.test(expr[end - 1] ?? "")) end -= 1;
          changed = true;
        }
      }
      return { start, end };
    };

    const splitBooleanAtoms = (
      expr: string,
      baseOffset = 0,
    ): Array<{ start: number; end: number }> => {
      const top = splitTopLevelBooleanClauses(expr);
      if (top.length > 1) {
        const out: Array<{ start: number; end: number }> = [];
        for (const part of top) {
          const piece = expr.slice(part.start, part.end);
          out.push(...splitBooleanAtoms(piece, baseOffset + part.start));
        }
        return out;
      }

      const t = trimOuterParens(expr);
      if (t.end <= t.start) return [];
      const inner = expr.slice(t.start, t.end);
      const innerTop = splitTopLevelBooleanClauses(inner);
      if (innerTop.length > 1) {
        const out: Array<{ start: number; end: number }> = [];
        for (const part of innerTop) {
          const piece = inner.slice(part.start, part.end);
          out.push(...splitBooleanAtoms(piece, baseOffset + t.start + part.start));
        }
        return out;
      }

      return [{ start: baseOffset + t.start, end: baseOffset + t.end }];
    };

    const ranges: Range<Decoration>[] = [];
    let targetedSegments = 0;
    let lineDecorationCount = 0;
    for (const segment of segments) {
      let lineClass = "";
      if (selectedSegmentId && segment.id === selectedSegmentId) {
        lineClass = "jf-segment-selected-line";
      } else if (hoveredSegmentId && segment.id === hoveredSegmentId) {
        lineClass = "jf-segment-hover-line";
      }
      if (!lineClass) continue;
      targetedSegments += 1;

      const startLine = numericField(segment, "startLine", "start_line");
      const startColumn = numericField(segment, "startColumn", "start_column");
      const endLine = numericField(segment, "endLine", "end_line");
      const endColumn = numericField(segment, "endColumn", "end_column");
      if (startLine === null || endLine === null) {
        continue;
      }
      const segmentTypeRaw =
        (segment as unknown as Record<string, unknown>).segmentType ??
        (segment as unknown as Record<string, unknown>).segment_type;
      const segmentType =
        typeof segmentTypeRaw === "string" ? segmentTypeRaw : "";

      const normalizedStartLine = Math.max(1, Math.floor(startLine));
      const normalizedEndLine = Math.max(1, Math.floor(endLine));
      const normalizedStartColumn = Math.max(
        1,
        Math.floor(startColumn ?? 1),
      );
      const normalizedEndColumn = Math.max(1, Math.floor(endColumn ?? 1));

      const maxLine = lineStarts.length;
      const fromLine = Math.max(1, Math.min(maxLine, normalizedStartLine));
      const toLine = Math.max(fromLine, Math.min(maxLine, normalizedEndLine));

      const fromLineStart = lineStarts[fromLine - 1];
      const afterToLineStart =
        toLine < maxLine ? lineStarts[toLine] : displayCode.length;
      if (fromLineStart === undefined || afterToLineStart === undefined) {
        continue;
      }

      const fromIndex = Math.min(
        displayCode.length,
        Math.max(0, fromLineStart + (normalizedStartColumn - 1)),
      );
      const toLineStart = lineStarts[toLine - 1] ?? fromLineStart;
      const toIndexInclusive = Math.min(
        displayCode.length,
        Math.max(0, toLineStart + (normalizedEndColumn - 1)),
      );
      const toIndex = Math.max(fromIndex + 1, toIndexInclusive + 1);
      let clippedFromIndex = fromIndex;
      let clippedToIndex = Math.min(afterToLineStart, toIndex);

      if (segmentType === "condition") {
        const clauseIndex = Math.max(
          0,
          conditionClauseIndexBySegmentId[segment.id] ?? 0,
        );
        const searchLineStart = Math.max(1, fromLine - 2);
        const searchLineEnd = Math.min(maxLine, fromLine + 4);
        let bestClauseRange: { start: number; end: number; score: number } | null = null;
        for (let ln = searchLineStart; ln <= searchLineEnd; ln += 1) {
          const ls = lineStarts[ln - 1];
          const le = ln < maxLine ? lineStarts[ln] - 1 : displayCode.length;
          if (ls === undefined || le <= ls) continue;
          const lineText = displayCode.slice(ls, le);
          const ifPos = lineText.indexOf("if ");
          const elseifPos = lineText.indexOf("elseif ");
          const thenPos = lineText.lastIndexOf(" then");
          const headPos = ifPos >= 0 ? ifPos + 3 : elseifPos >= 0 ? elseifPos + 7 : -1;
          if (headPos < 0 || thenPos <= headPos) continue;
          const expr = lineText.slice(headPos, thenPos);
          const trimmedExpr = expr.trim();
          const isTriggerContextGate =
            /^context\./.test(trimmedExpr) || /\bcontext\.[a-zA-Z_]/.test(trimmedExpr);
          const lineTrimmed = lineText.trim();
          const isReturnRegionLine =
            /\breturn\b/.test(lineTrimmed) ||
            /\bextra\s*=\s*\{/.test(lineTrimmed) ||
            /\bmessage\s*=/.test(lineTrimmed) ||
            /\bjf_/.test(lineTrimmed);
          const distancePenalty = Math.abs(ln - fromLine) * 100;
          const booleanHint = /\band\b|\bor\b/.test(trimmedExpr) ? 20 : 0;
          const atoms = splitBooleanAtoms(expr);
          const target = atoms[Math.min(clauseIndex, atoms.length - 1)];
          if (!target) continue;
          const score =
            booleanHint -
            distancePenalty -
            (isTriggerContextGate ? 120 : 0) -
            (isReturnRegionLine ? 400 : 0);
          const candidate = {
            start: ls + headPos + target.start,
            end: ls + headPos + target.end,
            score,
          };
          if (!bestClauseRange || candidate.score > bestClauseRange.score) {
            bestClauseRange = candidate;
          }
        }
        if (bestClauseRange) {
          clippedFromIndex = bestClauseRange.start;
          clippedToIndex = bestClauseRange.end;
        }
      }

      // Trim leading/trailing whitespace so we only highlight text.
      while (
        clippedFromIndex < clippedToIndex &&
        /\s/.test(displayCode[clippedFromIndex] ?? "")
      ) {
        clippedFromIndex += 1;
      }
      while (
        clippedToIndex > clippedFromIndex &&
        /\s/.test(displayCode[clippedToIndex - 1] ?? "")
      ) {
        clippedToIndex -= 1;
      }

      if (clippedFromIndex >= clippedToIndex) {
        continue;
      }

      const startLineIdx = (() => {
        let idx = 0;
        while (idx + 1 < lineStarts.length && lineStarts[idx + 1] <= clippedFromIndex) {
          idx += 1;
        }
        return idx + 1;
      })();
      const endLineIdx = (() => {
        let idx = 0;
        const inclusiveEnd = Math.max(clippedFromIndex, clippedToIndex - 1);
        while (idx + 1 < lineStarts.length && lineStarts[idx + 1] <= inclusiveEnd) {
          idx += 1;
        }
        return idx + 1;
      })();

      if (lineDecorationCount < MAX_SEGMENT_LINE_DECORATIONS) {
        if (startLineIdx === endLineIdx) {
          ranges.push(
            Decoration.mark({
              class:
                lineClass === "jf-segment-selected-line"
                  ? "cm-jf-segment-selected-range"
                  : "cm-jf-segment-hover-range",
            }).range(clippedFromIndex, clippedToIndex),
          );
          lineDecorationCount += 1;
        } else {
          for (let line = startLineIdx; line <= endLineIdx; line += 1) {
            if (lineDecorationCount >= MAX_SEGMENT_LINE_DECORATIONS) break;
            const lineStart = lineStarts[line - 1];
            if (lineStart === undefined) continue;
            ranges.push(Decoration.line({ class: lineClass }).range(lineStart));
            lineDecorationCount += 1;
          }
        }
      }
    }

    return Decoration.set(ranges, true);
  }, [
    conditionClauseIndexBySegmentId,
    displayCode,
    hoveredSegmentId,
    segments,
    selectedSegmentId,
  ]);

  // Create editor on mount
  useEffect(() => {
    if (!editorRef.current) return;

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged && !isExternalUpdateRef.current) {
        const newCode = update.state.doc.toString();
        onCodeChangeRef.current?.(newCode);
      }
    });

    const state = EditorState.create({
      doc: displayCode,
      extensions: [
        lineNumbers(),
        highlightActiveLine(),
        highlightActiveLineGutter(),
        history(),
        StreamLanguage.define(lua),
        oneDark,
        editorTheme,
        fontSizeCompartment.of(makeFontSizeTheme(DEFAULT_FONT_SIZE)),
        keymap.of([
          {
            key: "Enter",
            run: (view) => {
              if (completionStatus(view.state) !== "active") {
                const { state } = view;
                const selection = state.selection.main;
                const line = state.doc.lineAt(selection.from);
                const lineText = line.text;
                const cursorInLine = selection.from - line.from;
                const beforeCursor = lineText.slice(0, cursorInLine);
                const lineIndent = getCurrentLineIndent(lineText);
                const lineIsWhitespaceOnly = lineText.trim().length === 0;
                const prevContext = getPreviousLineIndentContext(
                  state.doc,
                  line.number,
                );
                let baseIndent = lineIsWhitespaceOnly
                  ? prevContext.indent
                  : lineIndent;
                if (DEDENT_LINE_RE.test(beforeCursor)) {
                  const unit = getIndentUnit(baseIndent);
                  if (baseIndent.endsWith(unit)) {
                    baseIndent = baseIndent.slice(0, -unit.length);
                  }
                }
                const extraIndent = shouldIncreaseIndent(beforeCursor)
                  ? getIndentUnit(baseIndent || prevContext.unit)
                  : "";
                const insertText = `\n${baseIndent}${extraIndent}`;
                const anchor = selection.from + insertText.length;

                view.dispatch({
                  changes: {
                    from: selection.from,
                    to: selection.to,
                    insert: insertText,
                  },
                  selection: { anchor },
                  scrollIntoView: true,
                  userEvent: "input",
                });
                return true;
              }
              return acceptCompletion(view);
            },
          },
          {
            key: "Shift-Tab",
            run: (view) => {
              if (completionStatus(view.state) !== "active") {
                return false;
              }
              return moveCompletionSelection(false)(view);
            },
          },
          // Insert a literal tab at the cursor
          {
            key: "Tab",
            run: (view) => {
              if (completionStatus(view.state) === "active") {
                return moveCompletionSelection(true)(view);
              }
              view.dispatch(view.state.replaceSelection("\t"), {
                scrollIntoView: true,
                userEvent: "input",
              });
              return true;
            },
          },
          ...closeBracketsKeymap,
          ...defaultKeymap,
          ...historyKeymap,
          ...searchKeymap,
          ...completionKeymap,
        ]),
        closeBrackets(),
        autocompletion({
          override: [luaSmodsCompletions],
          activateOnTyping: true,
          maxRenderedOptions: 30,
        }),
        luaBasicLinter,
        EditorState.allowMultipleSelections.of(true),
        readOnlyCompartment.of(EditorState.readOnly.of(!isEditable)),
        segmentHighlightField,
        updateListener,
        EditorView.lineWrapping,
      ],
    });

    const view = new EditorView({
      state,
      parent: editorRef.current,
    });

    viewRef.current = view;

    return () => {
      if (refreshAnimTimeoutRef.current !== null) {
        window.clearTimeout(refreshAnimTimeoutRef.current);
      }
      view.destroy();
      viewRef.current = null;
    };
  }, []);

  // Update editor content when code changes
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    const currentCode = view.state.doc.toString();

    if (currentCode !== displayCode) {
      isExternalUpdateRef.current = true;
      view.dispatch({
        changes: {
          from: 0,
          to: currentCode.length,
          insert: displayCode,
        },
      });
      isExternalUpdateRef.current = false;

      if (!isLoading) {
        triggerRefreshAnimation(displayCode.length);
      }
    }
  }, [displayCode, isLoading, triggerRefreshAnimation]);

  // Toggle read-only based on block preview / onCodeChange
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: readOnlyCompartment.reconfigure(
        EditorState.readOnly.of(!isEditable),
      ),
    });
  }, [isEditable]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: setSegmentDecorationsEffect.of(buildSegmentHighlightDecorations()),
    });
  }, [buildSegmentHighlightDecorations]);

  return (
    <aside
      data-rb-live-code="true"
      className="relative h-full bg-card/95 backdrop-blur-md border-l border-border"
      style={{ width: `${widthPercent}%` }}
    >
      {/* Full-height resize edge */}
      <div
        className="absolute left-0 top-0 bottom-0 -translate-x-1/2 z-20 w-3 cursor-col-resize group"
        onMouseDown={onStartResize}
      >
        <div className="mx-auto h-full w-px bg-border/70 group-hover:bg-primary/55 group-active:bg-primary/75 transition-colors duration-150" />
      </div>

      <div className="h-full flex flex-col">
        {/* Header bar */}
        <div className="min-h-16 px-4 py-2 border-b border-border/80 flex items-center justify-between gap-3 bg-card/70">
          <div className="flex items-center gap-2 min-w-0">
            <BracketsCurly className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-xs font-bold tracking-widest text-muted-foreground uppercase shrink-0">
              {isBlockPreview ? "Live Code" : "Code Editor"}
            </span>
            <span className="text-xs text-foreground/70 truncate">{title}</span>
            {hasCustomCode && !isBlockPreview && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 font-medium shrink-0">
                Edited
              </span>
            )}
            {!isBlockPreview && (selectedSegmentId || hoveredSegmentId) && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/15 text-primary font-medium shrink-0">
                {selectedSegmentExists || hoveredSegmentExists ? "Linked" : "No Link"}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Reset custom code */}
            {hasCustomCode && onResetCustomCode && !isBlockPreview && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    onClick={onResetCustomCode}
                    className="h-8 w-8 rounded-lg border-2 transition-all duration-200 cursor-pointer bg-card/90 border-amber-400/40 text-amber-400 hover:bg-amber-400/10 hover:border-amber-400/60"
                    icon={<ArrowsClockwise className="h-3.5 w-3.5" />}
                  />
                </TooltipTrigger>
                <TooltipContent
                  side="bottom"
                  sideOffset={6}
                  className="text-xs font-medium"
                >
                  Reset all custom code changes
                </TooltipContent>
              </Tooltip>
            )}

            {/* Back to full item view */}
            {isBlockPreview && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs cursor-pointer"
                onClick={onBackToItem}
              >
                <ArrowCounterClockwise className="h-3.5 w-3.5 mr-1" />
                Full Item View
              </Button>
            )}

            {fontSize !== DEFAULT_FONT_SIZE && (
              <span className="text-[10px] text-muted-foreground">
                {fontSize}px
              </span>
            )}
            <span className="text-[10px] text-muted-foreground w-9 text-right">
              {Math.round(widthPercent)}%
            </span>
          </div>
        </div>

        {statusMessage ? (
          <div
            className={`mx-4 mt-4 rounded-md border px-3 py-2 text-xs flex items-start gap-2 ${
              isError
                ? "border-transparent bg-transparent text-destructive"
                : "border-amber-400/40 bg-amber-400/10 text-amber-200"
            }`}
          >
            <WarningCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <div className="min-w-0 w-full">
              <div className="font-semibold">{statusMessage}</div>
              {isError && errorDetails ? (
                <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap wrap-break-word px-0 py-0 text-[11px] leading-relaxed text-destructive/90">
                  {errorDetails}
                </pre>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="flex-1 min-h-0" onWheel={handleWheel}>
          <div
            ref={editorRef}
            className="h-full w-full overflow-hidden [&_.cm-editor]:h-full [&_.cm-editor]:bg-transparent! [&_.cm-gutters]:bg-transparent!"
          />
        </div>
      </div>
    </aside>
  );
};

export default LiveCodePanel;
