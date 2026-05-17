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
    backgroundColor: "hsl(var(--card))",
    border: "1px solid hsl(var(--border))",
    borderRadius: "8px",
    boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
  },
  ".cm-tooltip.cm-tooltip-autocomplete > ul": {
    fontFamily:
      "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace",
  },
  ".cm-tooltip.cm-tooltip-autocomplete > ul > li": {
    padding: "3px 8px",
  },
  ".cm-tooltip.cm-tooltip-autocomplete > ul > li[aria-selected]": {
    backgroundColor: "hsl(var(--primary) / 0.3)",
    color: "hsl(var(--foreground))",
    outline: "1px solid hsl(var(--primary) / 0.75)",
    boxShadow: "inset 0 0 0 1px hsl(var(--primary) / 0.35)",
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
      const endLine = numericField(segment, "endLine", "end_line");
      if (startLine === null || endLine === null) {
        continue;
      }

      const normalizedStartLine = Math.max(1, Math.floor(startLine));
      const normalizedEndLine = Math.max(1, Math.floor(endLine));

      const maxLine = lineStarts.length;
      const fromLine = Math.max(1, Math.min(maxLine, normalizedStartLine));
      const toLine = Math.max(fromLine, Math.min(maxLine, normalizedEndLine));
      for (let line = fromLine; line <= toLine; line += 1) {
        if (lineDecorationCount >= MAX_SEGMENT_LINE_DECORATIONS) {
          break;
        }
        const lineStart = lineStarts[line - 1];
        if (lineStart === undefined) continue;
        ranges.push(Decoration.line({ class: lineClass }).range(lineStart));
        lineDecorationCount += 1;
      }
    }

    return Decoration.set(ranges, true);
  }, [displayCode, hoveredSegmentId, segments, selectedSegmentId]);

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
                return false;
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
