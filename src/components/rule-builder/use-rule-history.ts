import { useCallback, useRef, useState, type SetStateAction } from "react";
import type { UserVariable } from "@/lib/core/types";
import type { Rule } from "./types";

const RULE_HISTORY_LIMIT = 64;

export type RuleHistory = {
  past: Rule[][];
  rules: Rule[];
  future: Rule[][];
  variableHistory?: {
    past: VariableOwnerMap[];
    owners: VariableOwnerMap;
    future: VariableOwnerMap[];
  };
};

export type VariableOwnerSnapshot = {
  ownerItemId: string;
  ownerItemType: string;
  variables: UserVariable[];
};

export type VariableOwnerMap = Record<string, VariableOwnerSnapshot>;

export type RuleHistoryAction =
  | { type: "reset"; rules: Rule[]; variableOwners?: VariableOwnerSnapshot[] }
  | { type: "update"; update: SetStateAction<Rule[]> }
  | { type: "variables"; owner: VariableOwnerSnapshot; previousVariables: UserVariable[] }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "restore"; index: number };

const cloneRules = (rules: Rule[]): Rule[] =>
  JSON.parse(JSON.stringify(rules)) as Rule[];

const cloneVariables = (variables: UserVariable[]): UserVariable[] =>
  JSON.parse(JSON.stringify(variables)) as UserVariable[];

const variableOwnerKey = (owner: VariableOwnerSnapshot): string =>
  `${owner.ownerItemType}:${owner.ownerItemId}`;

const cloneOwner = (owner: VariableOwnerSnapshot): VariableOwnerSnapshot =>
  ({ ...owner, variables: cloneVariables(owner.variables) });

const variableOwnersToMap = (owners: VariableOwnerSnapshot[]): VariableOwnerMap =>
  Object.fromEntries(owners.map((owner) => [variableOwnerKey(owner), cloneOwner(owner)]));

export const getChangedVariableOwners = (
  previous: VariableOwnerMap,
  next: VariableOwnerMap,
): VariableOwnerSnapshot[] =>
  Object.entries(next)
    .filter(([key, owner]) => JSON.stringify(previous[key]?.variables) !== JSON.stringify(owner.variables))
    .map(([, owner]) => cloneOwner(owner));

const retainUnchangedRules = (rules: Rule[], previousRules: Rule[]): Rule[] => {
  const previousById = new Map(previousRules.map((rule) => [rule.id, rule]));
  return rules.map((rule) => {
    const previous = previousById.get(rule.id);
    if (previous && (rule === previous || JSON.stringify(rule) === JSON.stringify(previous))) {
      return previous;
    }
    return JSON.parse(JSON.stringify(rule)) as Rule;
  });
};

// Keep blocks and their history in one state update. Loading or restoring rules
// must never be mistaken for an edit by an effect from an earlier render.
export const reduceRuleHistory = (
  state: RuleHistory,
  action: RuleHistoryAction,
): RuleHistory => {
  switch (action.type) {
    case "reset":
      return {
        past: [], rules: cloneRules(action.rules), future: [],
        ...(action.variableOwners ? {
          variableHistory: { past: [], owners: variableOwnersToMap(action.variableOwners), future: [] },
        } : {}),
      };
    case "update": {
      const rules = typeof action.update === "function"
        ? action.update(state.rules)
        : action.update;
      if (rules === state.rules || JSON.stringify(rules) === JSON.stringify(state.rules)) {
        return state;
      }
      return {
        past: [...state.past, cloneRules(state.rules)].slice(-RULE_HISTORY_LIMIT),
        rules: retainUnchangedRules(rules, state.rules),
        future: [],
        ...(state.variableHistory ? {
          variableHistory: {
            past: [...state.variableHistory.past, state.variableHistory.owners].slice(-RULE_HISTORY_LIMIT),
            owners: state.variableHistory.owners,
            future: [],
          },
        } : {}),
      };
    }
    case "variables": {
      if (JSON.stringify(action.previousVariables) === JSON.stringify(action.owner.variables)) return state;
      const key = variableOwnerKey(action.owner);
      const previousOwner = cloneOwner({ ...action.owner, variables: action.previousVariables });
      const history = state.variableHistory ?? {
        past: state.past.map(() => ({})), owners: {}, future: [],
      };
      const pastOwners = history.past.map((owners) => key in owners
        ? owners : { ...owners, [key]: previousOwner });
      const previousOwners = { ...history.owners, [key]: previousOwner };
      return {
        past: [...state.past, cloneRules(state.rules)].slice(-RULE_HISTORY_LIMIT),
        rules: state.rules,
        future: [],
        variableHistory: {
          past: [...pastOwners, previousOwners].slice(-RULE_HISTORY_LIMIT),
          owners: { ...previousOwners, [key]: cloneOwner(action.owner) },
          future: [],
        },
      };
    }
    case "undo": {
      if (state.past.length === 0) return state;
      return {
        past: state.past.slice(0, -1),
        rules: cloneRules(state.past[state.past.length - 1]),
        future: [...state.future, cloneRules(state.rules)].slice(-RULE_HISTORY_LIMIT),
        ...(state.variableHistory ? {
          variableHistory: {
            past: state.variableHistory.past.slice(0, -1),
            owners: state.variableHistory.past[state.variableHistory.past.length - 1],
            future: [...state.variableHistory.future, state.variableHistory.owners].slice(-RULE_HISTORY_LIMIT),
          },
        } : {}),
      };
    }
    case "redo": {
      if (state.future.length === 0) return state;
      return {
        past: [...state.past, cloneRules(state.rules)].slice(-RULE_HISTORY_LIMIT),
        rules: cloneRules(state.future[state.future.length - 1]),
        future: state.future.slice(0, -1),
        ...(state.variableHistory ? {
          variableHistory: {
            past: [...state.variableHistory.past, state.variableHistory.owners].slice(-RULE_HISTORY_LIMIT),
            owners: state.variableHistory.future[state.variableHistory.future.length - 1],
            future: state.variableHistory.future.slice(0, -1),
          },
        } : {}),
      };
    }
    case "restore": {
      const timeline = [...state.past, state.rules, ...state.future.slice().reverse()];
      if (!Number.isInteger(action.index) || action.index < 0
        || action.index >= timeline.length || action.index === state.past.length) {
        return state;
      }
      return {
        past: timeline.slice(0, action.index).slice(-RULE_HISTORY_LIMIT).map(cloneRules),
        rules: cloneRules(timeline[action.index]),
        future: timeline.slice(action.index + 1).reverse().slice(-RULE_HISTORY_LIMIT).map(cloneRules),
        ...(state.variableHistory ? (() => {
          const variableTimeline = [
            ...state.variableHistory.past, state.variableHistory.owners,
            ...state.variableHistory.future.slice().reverse(),
          ];
          return {
            variableHistory: {
              past: variableTimeline.slice(0, action.index).slice(-RULE_HISTORY_LIMIT),
              owners: variableTimeline[action.index],
              future: variableTimeline.slice(action.index + 1).reverse().slice(-RULE_HISTORY_LIMIT),
            },
          };
        })() : {}),
      };
    }
  }
};

export const useRuleHistory = (
  onRestoreVariables?: (owners: VariableOwnerSnapshot[]) => void,
) => {
  const [history, setHistory] = useState<RuleHistory>({
    past: [], rules: [], future: [],
  });
  const historyRef = useRef(history);
  const onRestoreVariablesRef = useRef(onRestoreVariables);
  onRestoreVariablesRef.current = onRestoreVariables;
  const dispatch = useCallback((action: RuleHistoryAction) => {
    const previous = historyRef.current;
    const next = reduceRuleHistory(previous, action);
    if (next === previous) return;
    historyRef.current = next;
    setHistory(next);
    if (action.type === "undo" || action.type === "redo" || action.type === "restore") {
      const changed = getChangedVariableOwners(
        previous.variableHistory?.owners ?? {}, next.variableHistory?.owners ?? {},
      );
      if (changed.length > 0) onRestoreVariablesRef.current?.(changed);
    }
  }, []);
  const setRules = useCallback((update: SetStateAction<Rule[]>) => {
    dispatch({ type: "update", update });
  }, [dispatch]);
  const resetHistory = useCallback((rules: Rule[], variableOwners?: VariableOwnerSnapshot[]) => {
    dispatch({ type: "reset", rules, variableOwners });
  }, [dispatch]);
  const recordVariableChange = useCallback((owner: VariableOwnerSnapshot, previousVariables: UserVariable[]) => {
    dispatch({ type: "variables", owner, previousVariables });
  }, [dispatch]);
  const handleUndo = useCallback(() => dispatch({ type: "undo" }), [dispatch]);
  const handleRedo = useCallback(() => dispatch({ type: "redo" }), [dispatch]);
  const restoreHistoryAt = useCallback((index: number) => {
    dispatch({ type: "restore", index });
  }, [dispatch]);

  return {
    rules: history.rules,
    setRules,
    resetHistory,
    recordVariableChange,
    handleUndo,
    handleRedo,
    restoreHistoryAt,
    historyTimeline: [...history.past, history.rules, ...history.future.slice().reverse()],
    historyVariableTimeline: history.variableHistory ? [
      ...history.variableHistory.past, history.variableHistory.owners,
      ...history.variableHistory.future.slice().reverse(),
    ] : [],
    historyCurrentIndex: history.past.length,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
  };
};
