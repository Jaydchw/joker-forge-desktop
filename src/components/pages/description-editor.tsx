import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Separator as UiSeparator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/core/utils";
import { applyAutoFormatting } from "@/lib/balatro/balatro-text-formatter";
import { buildDescriptionVariableTokens } from "@/lib/rules/description-variable-registry";
import { generateDescriptionFromRules } from "@/lib/rules/auto-description";
import { fuzzyMatchAny } from "@/lib/core/search";
import type { Rule, UserVariable } from "@/lib/core/types";
import {
  ArrowCounterClockwise,
  Cube,
  DiceFive,
  List,
  MagnifyingGlass,
  Palette,
  Sparkle,
  TextT,
  User,
} from "@phosphor-icons/react";

export interface DescriptionEditorItemContext {
  objectType?: string;
  rules?: Rule[];
  userVariables?: UserVariable[];
  locVars?: { vars?: Array<string | number> };
}

export interface DescriptionEditorProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  error?: string;
  item?: DescriptionEditorItemContext;
}

const COLOR_BUTTONS = [
  { tag: "{C:red}", color: "bg-balatro-red", name: "Red" },
  { tag: "{C:blue}", color: "bg-balatro-blue", name: "Blue" },
  { tag: "{C:green}", color: "bg-balatro-green", name: "Green" },
  { tag: "{C:purple}", color: "bg-balatro-purple", name: "Purple" },
  { tag: "{C:attention}", color: "bg-balatro-attention", name: "Orange" },
  { tag: "{C:money}", color: "bg-balatro-money", name: "Money" },
  { tag: "{C:gold}", color: "bg-balatro-gold-new", name: "Gold" },
  { tag: "{C:white}", color: "bg-balatro-white", name: "White" },
  { tag: "{C:inactive}", color: "bg-balatro-grey", name: "Inactive" },
  { tag: "{C:default}", color: "bg-balatro-default", name: "Default" },
  { tag: "{C:hearts}", color: "bg-balatro-hearts", name: "Hearts" },
  { tag: "{C:clubs}", color: "bg-balatro-clubs", name: "Clubs" },
  { tag: "{C:diamonds}", color: "bg-balatro-diamonds", name: "Diamonds" },
  { tag: "{C:spades}", color: "bg-balatro-spades", name: "Spades" },
  { tag: "{C:tarot}", color: "bg-balatro-tarot", name: "Tarot" },
  { tag: "{C:planet}", color: "bg-balatro-planet", name: "Planet" },
  { tag: "{C:spectral}", color: "bg-balatro-spectral", name: "Spectral" },
  { tag: "{C:enhanced}", color: "bg-balatro-enhanced-new", name: "Enhanced" },
  { tag: "{C:common}", color: "bg-balatro-common", name: "Common" },
  { tag: "{C:uncommon}", color: "bg-balatro-uncommon", name: "Uncommon" },
  { tag: "{C:rare}", color: "bg-balatro-rare", name: "Rare" },
  { tag: "{C:legendary}", color: "bg-balatro-legendary", name: "Legendary" },
  {
    tag: "{C:edition}",
    color: "bg-gradient-to-r from-purple-400 to-pink-400",
    name: "Edition",
  },
  {
    tag: "{C:dark_edition}",
    color: "bg-balatro-dark-edition border border-white/60",
    name: "Dark Edition",
  },
];

const BG_BUTTONS = [
  { tag: "{X:red,C:white}", color: "bg-balatro-red", name: "Red BG" },
  { tag: "{X:blue,C:white}", color: "bg-balatro-blue", name: "Blue BG" },
  { tag: "{X:mult,C:white}", color: "bg-balatro-mult", name: "Mult BG" },
  { tag: "{X:chips,C:white}", color: "bg-balatro-chips", name: "Chips BG" },
  { tag: "{X:money,C:white}", color: "bg-balatro-money", name: "Money BG" },
  {
    tag: "{X:attention,C:white}",
    color: "bg-balatro-attention",
    name: "Attention BG",
  },
  { tag: "{X:tarot,C:white}", color: "bg-balatro-tarot", name: "Tarot BG" },
  { tag: "{X:planet,C:white}", color: "bg-balatro-planet", name: "Planet BG" },
  {
    tag: "{X:spectral,C:white}",
    color: "bg-balatro-spectral",
    name: "Spectral BG",
  },
  {
    tag: "{X:enhanced,C:white}",
    color: "bg-balatro-enhanced-new",
    name: "Enhanced BG",
  },
  {
    tag: "{X:legendary,C:white}",
    color: "bg-balatro-legendary",
    name: "Legendary BG",
  },
  {
    tag: "{X:edition,C:white}",
    color: "bg-gradient-to-r from-purple-400 to-pink-400",
    name: "Edition BG",
  },
  {
    tag: "{X:dark_edition,C:white}",
    color: "bg-balatro-dark-edition",
    name: "Dark Edition BG",
  },
];

export const DescriptionEditor = memo(
  ({
    value,
    onChange,
    placeholder,
    error,
    item,
  }: DescriptionEditorProps) => {
    const [autoFormat, setAutoFormat] = useState(true);
    const [variableSearch, setVariableSearch] = useState("");
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const historyRef = useRef<string[]>([]);
    const historyIndexRef = useRef(-1);
    const applyingHistoryRef = useRef(false);

    const variableTokens = useMemo(
      () => buildDescriptionVariableTokens(item),
      [item],
    );

    const generatedDescription = useMemo(() => {
      const objectType = (item?.objectType || "joker") as
        | "joker"
        | "consumable"
        | "voucher"
        | "deck"
        | "enhancement"
        | "edition"
        | "seal"
        | "card";
      return generateDescriptionFromRules(item?.rules, objectType);
    }, [item?.objectType, item?.rules]);

    useEffect(() => {
      if (applyingHistoryRef.current) {
        applyingHistoryRef.current = false;
        return;
      }

      const history = historyRef.current;
      const currentIndex = historyIndexRef.current;
      if (currentIndex >= 0 && history[currentIndex] === value) {
        return;
      }

      const nextHistory =
        currentIndex < history.length - 1
          ? history.slice(0, currentIndex + 1)
          : history.slice();
      nextHistory.push(value || "");
      historyRef.current = nextHistory;
      historyIndexRef.current = nextHistory.length - 1;
    }, [value]);

    const userVariablesByName = useMemo(() => {
      const map = new Map<string, UserVariable>();
      for (const variable of item?.userVariables || []) {
        if (!variable?.name) continue;
        map.set(variable.name.trim().toLowerCase(), variable);
      }
      return map;
    }, [item?.userVariables]);

    const groupedVariableEntries = useMemo(() => {
      const groups: Array<{
        id:
          | "user"
          | "generated"
          | "probability"
          | "game"
          | "userGlobal"
          | "userGlobalPersistent";
        label: string;
        items: Array<{
          index: number;
          token: (typeof variableTokens)[number];
        }>;
      }> = [
        { id: "user", label: "User", items: [] },
        { id: "userGlobal", label: "User Global", items: [] },
        {
          id: "userGlobalPersistent",
          label: "User Global Persistent",
          items: [],
        },
        { id: "generated", label: "Generated", items: [] },
        { id: "probability", label: "Probability Vars", items: [] },
        { id: "game", label: "Game", items: [] },
      ];

      variableTokens.forEach((token, idx) => {
        if (token.category === "loc") return;

        const index = idx + 1;
        const labelText = `#${index}# ${token.label}`;
        const sourceText = token.source;
        if (
          variableSearch.trim() &&
          !fuzzyMatchAny([labelText, sourceText], variableSearch)
        ) {
          return;
        }

        if (token.category === "config") {
          groups[3].items.push({ index, token });
          return;
        }

        if (token.category === "probability") {
          groups[4].items.push({ index, token });
          return;
        }

        if (token.category === "game") {
          groups[5].items.push({ index, token });
          return;
        }

        if (token.category === "user") {
          const name = token.source.replace("card.ability.extra.", "").trim();
          const matchedVar = userVariablesByName.get(name.toLowerCase());
          if (matchedVar?.isGlobal && matchedVar?.isPersistent) {
            groups[2].items.push({ index, token });
            return;
          }
          if (matchedVar?.isGlobal) {
            groups[1].items.push({ index, token });
            return;
          }
          groups[0].items.push({ index, token });
        }
      });

      return groups.filter((group) => group.items.length > 0);
    }, [userVariablesByName, variableSearch, variableTokens]);

    const applyValueWithCursor = useCallback(
      (nextValue: string, cursor: number) => {
        onChange(nextValue);
        requestAnimationFrame(() => {
          if (!textareaRef.current) return;
          textareaRef.current.focus();
          textareaRef.current.setSelectionRange(cursor, cursor);
        });
      },
      [onChange],
    );

    const insertTag = useCallback(
      (tag: string, autoClose = true) => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const currentVal = textarea.value;
        const selected = currentVal.substring(start, end);

        let newVal = "";
        let newCursor = 0;

        if (selected) {
          newVal =
            currentVal.substring(0, start) +
            tag +
            selected +
            (autoClose ? "{}" : "") +
            currentVal.substring(end);
          newCursor =
            start + tag.length + selected.length + (autoClose ? 2 : 0);
        } else {
          newVal =
            currentVal.substring(0, start) +
            tag +
            (autoClose ? "{}" : "") +
            currentVal.substring(end);
          newCursor = start + tag.length;
        }

        const formattedVal = autoFormat
          ? applyAutoFormatting(newVal, value).formatted
          : newVal;
        applyValueWithCursor(formattedVal, newCursor);
      },
      [applyValueWithCursor, autoFormat, value],
    );

    const handleTextChange = useCallback(
      (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const val = e.target.value;
        const formattedVal = autoFormat
          ? applyAutoFormatting(val, value).formatted
          : val;
        onChange(formattedVal);
      },
      [autoFormat, onChange, value],
    );

    const handleUndoRedo = useCallback(
      (direction: "undo" | "redo") => {
        const history = historyRef.current;
        if (history.length === 0) return;

        const currentIndex = historyIndexRef.current;
        const nextIndex =
          direction === "undo" ? currentIndex - 1 : currentIndex + 1;
        if (nextIndex < 0 || nextIndex >= history.length) return;

        historyIndexRef.current = nextIndex;
        applyingHistoryRef.current = true;
        onChange(history[nextIndex]);
      },
      [onChange],
    );

    const handleTextKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
          e.preventDefault();
          handleUndoRedo(e.shiftKey ? "redo" : "undo");
          return;
        }
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
          e.preventDefault();
          handleUndoRedo("redo");
          return;
        }

        if (e.key === "Enter") {
          e.preventDefault();
          insertTag("[s]", false);
        }
      },
      [handleUndoRedo, insertTag],
    );

    const quickEffects = [
      {
        key: "newline",
        icon: <TextT className="h-3.5 w-3.5" />,
        label: "New Line",
        action: () => insertTag("[s]", false),
      },
      {
        key: "scale",
        icon: <Cube className="h-3.5 w-3.5" />,
        label: "Scale",
        action: () => insertTag("{s:1.1}"),
      },
      {
        key: "float",
        icon: <Sparkle className="h-3.5 w-3.5" />,
        label: "Float",
        action: () => insertTag("{E:1}"),
      },
      {
        key: "reset",
        icon: <ArrowCounterClockwise className="h-3.5 w-3.5" />,
        label: "Reset",
        action: () => insertTag("{}", false),
      },
    ];

    return (
      <div className="space-y-4">
        <div className="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
          <aside className="bg-background/20 p-3.5 flex flex-col min-h-0 rounded-lg">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2.5 flex items-center gap-1.5">
              <List className="h-3.5 w-3.5" />
              Variables
            </p>
            <div className="relative w-full">
              <MagnifyingGlass className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/80" />
              <Input
                value={variableSearch}
                onChange={(e) => setVariableSearch(e.target.value)}
                placeholder="ExampleVar1"
                className="h-8 pl-7 text-[11px] bg-background/60 w-full"
              />
            </div>
            <UiSeparator className="my-2.5 bg-border/40" />
            <ScrollArea className="h-[22.5rem] pr-1">
              <div className="space-y-3.5 pb-1">
                {groupedVariableEntries.length > 0 ? (
                  groupedVariableEntries.map((group) => (
                    <div key={group.id} className="space-y-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/85 flex items-center gap-1.5">
                        {group.id === "user" && <User className="h-3 w-3" />}
                        {group.id === "userGlobal" && (
                          <User className="h-3 w-3" />
                        )}
                        {group.id === "userGlobalPersistent" && (
                          <User className="h-3 w-3" />
                        )}
                        {group.id === "generated" && (
                          <Sparkle className="h-3 w-3" />
                        )}
                        {group.id === "probability" && (
                          <DiceFive className="h-3 w-3" />
                        )}
                        {group.id === "game" && <Cube className="h-3 w-3" />}
                        <span>{group.label}</span>
                      </p>
                      <div className="space-y-2">
                        {group.items.map(({ token, index }) => (
                          <Tooltip
                            key={`desc-var-${token.category}-${token.source}-${index}`}
                          >
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                onClick={() => insertTag(`#${index}#`, false)}
                                className="w-full text-left px-2.5 py-2 rounded-md bg-background/45 hover:bg-background/80 transition-colors cursor-pointer"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <span className="text-xs font-medium text-foreground truncate">
                                    {token.label}
                                  </span>
                                  <span className="text-[10px] font-semibold text-primary shrink-0">
                                    #{index}#
                                  </span>
                                </div>
                                <div className="text-[10px] text-muted-foreground mt-0.5 truncate">
                                  {token.source}
                                </div>
                              </button>
                            </TooltipTrigger>
                            <TooltipContent>Insert #{index}#</TooltipContent>
                          </Tooltip>
                        ))}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-[11px] text-muted-foreground">
                    No variables match your search.
                  </p>
                )}
              </div>
            </ScrollArea>
          </aside>

          <div className="space-y-3">
            <div className="space-y-3 rounded-lg bg-background/20 p-3.5">
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                  <TextT className="h-3.5 w-3.5" />
                  Text Colors
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {COLOR_BUTTONS.map((btn) => (
                    <Tooltip key={btn.name}>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={() => insertTag(btn.tag)}
                          className={cn(
                            "h-6 w-6 rounded-md hover:scale-105 transition-transform cursor-pointer",
                            btn.color,
                          )}
                        />
                      </TooltipTrigger>
                      <TooltipContent>{btn.name}</TooltipContent>
                    </Tooltip>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                  <Palette className="h-3.5 w-3.5" />
                  Background Colors
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {BG_BUTTONS.map((btn) => (
                    <Tooltip key={btn.name}>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={() => insertTag(btn.tag)}
                          className={cn(
                            "h-6 w-6 rounded-md hover:scale-105 transition-transform cursor-pointer",
                            btn.color,
                          )}
                        />
                      </TooltipTrigger>
                      <TooltipContent>{btn.name}</TooltipContent>
                    </Tooltip>
                  ))}
                </div>
              </div>

              <div className="flex items-center mt-4 -mb-4">
                {quickEffects.map((effect) => (
                  <Tooltip key={effect.key}>
                    <TooltipTrigger asChild>
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-7 w-7 cursor-pointer mr-1.5"
                        onClick={effect.action}
                      >
                        {effect.icon}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{effect.label}</TooltipContent>
                  </Tooltip>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onChange(generatedDescription)}
                  className="h-7 cursor-pointer ml-auto mr-2 text-xs gap-1.5"
                >
                  <Sparkle className="h-3.5 w-3.5" />
                  Generate
                </Button>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setAutoFormat(!autoFormat)}
                      className={cn(
                        "h-7 w-7 cursor-pointer",
                        autoFormat && "bg-accent text-accent-foreground",
                      )}
                    >
                      <Sparkle
                        className={cn("h-3.5 w-3.5", autoFormat && "text-primary")}
                        weight={autoFormat ? "fill" : "regular"}
                      />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="font-bold">
                    Auto Format {autoFormat ? "On" : "Off"}
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>

            <div className="px-3.5">
              <Textarea
                ref={textareaRef}
                value={value || ""}
                onChange={handleTextChange}
                onKeyDown={handleTextKeyDown}
                placeholder={placeholder}
                className={cn(
                  "font-mono text-sm min-h-60 resize-y bg-background/40 border-border/40 cursor-text",
                  error && "border-destructive focus-visible:ring-destructive",
                )}
              />
              {error && (
                <p className="text-xs text-destructive mt-1">{error}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  },
);
