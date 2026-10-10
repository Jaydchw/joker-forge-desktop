import React from "react";
import {
  ClockCounterClockwise,
  PlusCircle,
  MinusCircle,
  PencilSimple,
  Shuffle,
} from "@phosphor-icons/react";
import type { Rule } from "./types";
import type { UserVariable } from "@/lib/core/types";
import type { VariableOwnerMap } from "./use-rule-history";
import Panel from "./panel";

interface HistoryPanelProps {
  position: { x: number; y: number };
  entries: Rule[][];
  variableEntries?: VariableOwnerMap[];
  currentIndex: number;
  onRestoreAt: (index: number) => void;
  onClose: () => void;
  onPositionChange: (position: { x: number; y: number }) => void;
}

const summarizeSnapshot = (rules: Rule[]) => {
  const ruleCount = rules.length;
  const conditionCount = rules.reduce(
    (acc, rule) =>
      acc +
      rule.conditionGroups.reduce((inner, g) => inner + g.conditions.length, 0),
    0,
  );
  const effectCount = rules.reduce(
    (acc, rule) =>
      acc +
      rule.effects.length +
      rule.randomGroups.reduce((inner, g) => inner + g.effects.length, 0) +
      rule.loops.reduce((inner, g) => inner + g.effects.length, 0),
    0,
  );

  return { ruleCount, conditionCount, effectCount };
};

type HistoryActionType =
  | "initial"
  | "added"
  | "deleted"
  | "reordered"
  | "edited"
  | "variable_added"
  | "variable_deleted"
  | "variable_edited";

const variablesByOwnerAndId = (owners: VariableOwnerMap) => {
  const variables = new Map<string, UserVariable>();
  for (const owner of Object.values(owners)) {
    for (const variable of owner.variables) {
      variables.set(
        JSON.stringify([owner.ownerItemType, owner.ownerItemId, variable.id]),
        variable,
      );
    }
  }
  return variables;
};

const detectVariableAction = (
  previous: VariableOwnerMap | undefined,
  current: VariableOwnerMap | undefined,
): { action: HistoryActionType; names: string[] } | undefined => {
  if (!previous || !current) return undefined;
  const before = variablesByOwnerAndId(previous);
  const after = variablesByOwnerAndId(current);
  const names: string[] = [];
  let added = 0;
  let deleted = 0;
  let edited = 0;

  for (const [id, variable] of before) {
    const nextVariable = after.get(id);
    if (!nextVariable) {
      deleted += 1;
      names.push(variable.name);
    } else if (JSON.stringify(variable) !== JSON.stringify(nextVariable)) {
      edited += 1;
      names.push(variable.name === nextVariable.name
        ? nextVariable.name
        : `${variable.name} → ${nextVariable.name}`);
    }
  }
  for (const [id, variable] of after) {
    if (!before.has(id)) {
      added += 1;
      names.push(variable.name);
    }
  }

  if (!added && !deleted && !edited) return undefined;
  return {
    action: added && !deleted && !edited
      ? "variable_added"
      : deleted && !added && !edited
        ? "variable_deleted"
        : "variable_edited",
    names: [...new Set(names)],
  };
};

const ruleOrderFingerprint = (rules: Rule[]): string => {
  return rules.map((rule) => rule.id).join("|");
};

const detectActionType = (
  previous: Rule[] | undefined,
  current: Rule[],
): HistoryActionType => {
  if (!previous) return "initial";

  const prev = summarizeSnapshot(previous);
  const next = summarizeSnapshot(current);

  if (
    next.ruleCount > prev.ruleCount ||
    next.conditionCount > prev.conditionCount ||
    next.effectCount > prev.effectCount
  ) {
    return "added";
  }

  if (
    next.ruleCount < prev.ruleCount ||
    next.conditionCount < prev.conditionCount ||
    next.effectCount < prev.effectCount
  ) {
    return "deleted";
  }

  if (ruleOrderFingerprint(previous) !== ruleOrderFingerprint(current)) {
    return "reordered";
  }

  return "edited";
};

const actionPresentation = (action: HistoryActionType) => {
  switch (action) {
    case "initial":
      return {
        icon: ClockCounterClockwise,
        label: "Initial",
        iconClass: "text-muted-foreground",
      };
    case "added":
      return {
        icon: PlusCircle,
        label: "Added",
        iconClass: "text-jungle-green-300",
      };
    case "variable_added":
      return {
        icon: PlusCircle,
        label: "Added variable",
        iconClass: "text-jungle-green-300",
      };
    case "deleted":
      return {
        icon: MinusCircle,
        label: "Deleted",
        iconClass: "text-destructive",
      };
    case "variable_deleted":
      return {
        icon: MinusCircle,
        label: "Deleted variable",
        iconClass: "text-destructive",
      };
    case "reordered":
      return {
        icon: Shuffle,
        label: "Reordered",
        iconClass: "text-balatro-blue",
      };
    case "variable_edited":
      return {
        icon: PencilSimple,
        label: "Edited variable",
        iconClass: "text-amber-300",
      };
    default:
      return {
        icon: PencilSimple,
        label: "Edited",
        iconClass: "text-amber-300",
      };
  }
};

const HistoryPanel: React.FC<HistoryPanelProps> = ({
  position,
  entries,
  variableEntries,
  currentIndex,
  onRestoreAt,
  onClose,
}) => {
  return (
    <Panel
      id="history"
      position={position}
      icon={ClockCounterClockwise}
      title="History"
      onClose={onClose}
      closeLabel="Close History"
      className="w-80 select-none max-h-[60vh]"
      contentClassName="p-2 overflow-y-auto custom-scrollbar"
    >
      <div>
        {entries.length === 0 ? (
          <div className="text-xs text-muted-foreground p-3">
            No history yet.
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {entries.map((snapshot, index) => {
              const isCurrent = index === currentIndex;
              const summary = summarizeSnapshot(snapshot);
              const variableChange = entries[index - 1]
                && JSON.stringify(entries[index - 1]) === JSON.stringify(snapshot)
                ? detectVariableAction(variableEntries?.[index - 1], variableEntries?.[index])
                : undefined;
              const action = variableChange?.action
                || detectActionType(entries[index - 1], snapshot);
              const presentation = actionPresentation(action);
              const ActionIcon = presentation.icon;

              return (
                <button
                  key={`history-${index}`}
                  onClick={() => onRestoreAt(index)}
                  className={`w-full text-left px-2.5 py-2 transition-colors cursor-pointer ${
                    isCurrent ? "bg-primary/10" : "hover:bg-accent/60"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <ActionIcon
                        className={`h-4 w-4 shrink-0 ${presentation.iconClass}`}
                      />
                      <span className="text-xs font-semibold text-foreground truncate">
                        {isCurrent
                          ? `${presentation.label} (Current)`
                          : `${presentation.label} - Step ${index + 1}`}
                      </span>
                    </div>
                    {isCurrent ? (
                      <span className="text-[10px] text-primary">Now</span>
                    ) : null}
                  </div>
                  <div
                    className="text-[11px] text-muted-foreground mt-1 truncate"
                    title={variableChange?.names.join(", ")}
                  >
                    {variableChange
                      ? `${variableChange.names.slice(0, 2).join(", ")}${variableChange.names.length > 2 ? ` and ${variableChange.names.length - 2} more` : ""}`
                      : <>{summary.ruleCount}R / {summary.conditionCount}C /{" "}{summary.effectCount}E</>}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </Panel>
  );
};

export default HistoryPanel;
