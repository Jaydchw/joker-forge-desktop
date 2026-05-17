import { useMemo, useState } from "react";
import {
  POKER_HANDS,
  POKER_HAND_VALUES,
  RANKS,
  SUITS,
  SUIT_VALUES,
} from "@/lib/balatro/balatro-utils";
import type { ConsumableData, UserVariable } from "@/lib/core/types";
import {
  Cube,
  Hand,
  Hash,
  Key,
  Sparkle,
  Stack,
  TextB,
  Code as Brackets,
} from "@phosphor-icons/react";
import { validateVariableName } from "@/lib/core/validation-utils";
import { getVariableUsageDetails } from "@/lib/rules/user-variable-utils";
import { ItemData } from "./rule-builder";

export type VariableType =
  | "number"
  | "suit"
  | "rank"
  | "pokerhand"
  | "key"
  | "text";

type SuitValue = (typeof SUIT_VALUES)[number];
type RankLabel =
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "10"
  | "Jack"
  | "Queen"
  | "King"
  | "Ace";
type PokerHandValue = (typeof POKER_HAND_VALUES)[number];

export const SUIT_OPTIONS = SUITS.map((suit) => ({
  value: suit.value,
  label: `${suit.label}`,
  type: "text",
}));

export const RANK_OPTIONS = RANKS.map((rank) => ({
  value: rank.label,
  label: rank.label,
  type: "text",
}));

export const POKER_HAND_OPTIONS = POKER_HANDS.map((hand) => ({
  value: hand.value,
  label: hand.label,
  type: "text",
}));

export const VARIABLE_TYPE_OPTIONS = [
  { value: "number", label: "Number Variable", icon: Hash },
  { value: "suit", label: "Suit Variable", icon: Sparkle },
  { value: "rank", label: "Rank Variable", icon: Cube },
  { value: "pokerhand", label: "Poker Hand Variable", icon: Hand },
  { value: "key", label: "Key Variable", icon: Stack },
  { value: "text", label: "Text Variable", icon: TextB },
];

interface VariablesManagerArgs {
  item: Exclude<ItemData, ConsumableData>;
  onUpdateItem: (updates: Partial<ItemData>) => void;
}

export const getVariableIcon = (type: VariableType | undefined) => {
  switch (type) {
    case "number":
      return Brackets;
    case "suit":
      return Sparkle;
    case "rank":
      return Cube;
    case "pokerhand":
      return Stack;
    case "key":
      return Key;
    case "text":
      return TextB;
    default:
      return Hash;
  }
};

export const getVariableColor = (type: VariableType | undefined) => {
  switch (type) {
    case "suit":
      return "text-purple-400";
    case "rank":
      return "text-blue-400";
    case "pokerhand":
      return "text-green-400";
    case "key":
      return "text-orange-400";
    case "text":
      return "text-zinc-100";
    default:
      return "text-jungle-green-400";
  }
};

export const useVariablesManager = ({
  item,
  onUpdateItem,
}: VariablesManagerArgs) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingVariable, setEditingVariable] = useState<string | null>(null);

  const [newVariableType, setNewVariableType] =
    useState<VariableType>("number");
  const [newVariableName, setNewVariableName] = useState("");
  const [newVariableValue, setNewVariableValue] = useState("0");
  const [newVariableSuit, setNewVariableSuit] = useState<SuitValue>(
    SUIT_VALUES[0],
  );
  const [newVariableRank, setNewVariableRank] = useState<RankLabel>("Ace");
  const [newVariablePokerHand, setNewVariablePokerHand] =
    useState<PokerHandValue>(POKER_HAND_VALUES[0]);
  const [newVariableKey, setNewVariableKey] = useState<string>("none");
  const [newVariableText, setNewVariableText] = useState<string>("Hello");

  const [nameValidationError, setNameValidationError] = useState<string>("");
  const [editValidationError, setEditValidationError] = useState<string>("");

  const [editingType, setEditingType] = useState<VariableType>("number");
  const [editingName, setEditingName] = useState("");
  const [editingValue, setEditingValue] = useState(0);
  const [editingSuit, setEditingSuit] = useState<SuitValue>(SUIT_VALUES[0]);
  const [editingRank, setEditingRank] = useState<RankLabel>("Ace");
  const [editingJoker, setEditingJoker] = useState<string>("j_joker");
  const [editingText, setEditingText] = useState<string>("Hello");
  const [editingPokerHand, setEditingPokerHand] = useState<PokerHandValue>(
    POKER_HAND_VALUES[0],
  );

  const usageDetails = useMemo(() => getVariableUsageDetails(item), [item]);

  const userVariables =
    "userVariables" in item &&
    Array.isArray((item as { userVariables: UserVariable[] }).userVariables)
      ? (item as { userVariables: UserVariable[] }).userVariables
      : [];

  const getUsageInfo = (variableName: string) => {
    const usages = usageDetails.filter(
      (usage) => usage.variableName === variableName,
    );
    const ruleNumbers = [...new Set(usages.map((usage) => usage.ruleIndex))];

    return {
      count: usages.length,
      rules: ruleNumbers,
    };
  };

  const validateNewVariableName = (name: string) => {
    const validation = validateVariableName(name.trim());
    if (!validation.isValid) {
      setNameValidationError(validation.error || "Invalid variable name");
      return false;
    }

    const existingNames = userVariables.map((v: UserVariable) =>
      v.name.toLowerCase(),
    );
    if (existingNames.includes(name.trim().toLowerCase())) {
      setNameValidationError("Variable name already exists");
      return false;
    }

    setNameValidationError("");
    return true;
  };

  const validateEditVariableName = (
    name: string,
    currentVariableId: string,
  ) => {
    const validation = validateVariableName(name);
    if (!validation.isValid) {
      setEditValidationError(validation.error || "Invalid variable name");
      return false;
    }

    const existingNames = userVariables
      .filter((v: UserVariable) => v.id !== currentVariableId)
      .map((v: UserVariable) => v.name.toLowerCase());

    if (existingNames.includes(name.toLowerCase())) {
      setEditValidationError("Variable name already exists");
      return false;
    }

    setEditValidationError("");
    return true;
  };

  const resetAddForm = () => {
    setNewVariableName("");
    setNewVariableValue("0");
    setNewVariableSuit(SUIT_VALUES[0]);
    setNewVariableRank("Ace");
    setNewVariablePokerHand(POKER_HAND_VALUES[0]);
    setNewVariableKey("none");
    setNewVariableText("Hello");
    setNewVariableType("number");
    setNameValidationError("");
    setShowAddForm(false);
  };

  const handleAddVariable = () => {
    if (!validateNewVariableName(newVariableName)) {
      return;
    }

    const newVariable: UserVariable = {
      id: crypto.randomUUID(),
      name: newVariableName.trim(),
      type: newVariableType,
    };

    if (newVariableType === "number") {
      newVariable.initialValue = parseFloat(newVariableValue) || 0;
    } else if (newVariableType === "key") {
      newVariable.initialKey = newVariableKey;
    } else if (newVariableType === "suit") {
      newVariable.initialSuit = newVariableSuit;
    } else if (newVariableType === "rank") {
      newVariable.initialRank = newVariableRank;
    } else if (newVariableType === "pokerhand") {
      newVariable.initialPokerHand = newVariablePokerHand;
    } else if (newVariableType === "text") {
      newVariable.initialText = newVariableText;
    }

    onUpdateItem({ userVariables: [...userVariables, newVariable] });
    resetAddForm();
  };

  const handleDeleteVariable = (variableId: string) => {
    const updatedVariables = userVariables.filter(
      (v: UserVariable) => v.id !== variableId,
    );
    onUpdateItem({ userVariables: updatedVariables });
  };

  const handleStartEdit = (variable: UserVariable) => {
    setEditingVariable(variable.id);
    setEditingName(variable.name);
    setEditingType((variable.type as VariableType) || "number");
    setEditingValue(variable.initialValue || 0);
    setEditingText(variable.initialText || "");
    setEditingSuit((variable.initialSuit as SuitValue) || SUIT_VALUES[0]);
    setEditingRank((variable.initialRank as RankLabel) || "Ace");
    setEditingPokerHand(variable.initialPokerHand || POKER_HAND_VALUES[0]);
    setEditingJoker((variable.initialKey as string) || "j_joker");
    setEditValidationError("");
  };

  const handleSaveEdit = (variableId: string) => {
    if (!validateEditVariableName(editingName, variableId)) {
      return;
    }

    const updatedVariable: UserVariable = {
      id: variableId,
      name: editingName,
      type: editingType,
    };

    if (editingType === "number") {
      updatedVariable.initialValue = editingValue;
    } else if (editingType === "key") {
      updatedVariable.initialKey = editingJoker;
    } else if (editingType === "suit") {
      updatedVariable.initialSuit = editingSuit;
    } else if (editingType === "rank") {
      updatedVariable.initialRank = editingRank;
    } else if (editingType === "pokerhand") {
      updatedVariable.initialPokerHand = editingPokerHand;
    } else if (editingType === "text") {
      updatedVariable.initialText = editingText;
    }

    const updatedVariables = userVariables.map((v: UserVariable) =>
      v.id === variableId ? updatedVariable : v,
    );

    onUpdateItem({ userVariables: updatedVariables });
    setEditingVariable(null);
    setEditValidationError("");
  };

  const handleCancelEdit = () => {
    setEditingVariable(null);
    setEditValidationError("");
  };

  const getVariableDisplayValue = (variable: UserVariable) => {
    if (variable.type === "suit") {
      return variable.initialSuit || SUIT_VALUES[0];
    }
    if (variable.type === "text") {
      return variable.initialText || "Hello";
    }
    if (variable.type === "rank") {
      return variable.initialRank || "Ace";
    }
    if (variable.type === "pokerhand") {
      return variable.initialPokerHand || POKER_HAND_VALUES[0];
    }
    if (variable.type === "key") {
      return variable.initialKey || "j_joker";
    }

    return variable.initialValue?.toString() || "0";
  };

  return {
    userVariables,
    showAddForm,
    setShowAddForm,
    editingVariable,
    newVariableType,
    setNewVariableType,
    newVariableName,
    setNewVariableName,
    newVariableValue,
    setNewVariableValue,
    newVariableSuit,
    setNewVariableSuit,
    newVariableRank,
    setNewVariableRank,
    newVariablePokerHand,
    setNewVariablePokerHand,
    newVariableKey,
    setNewVariableKey,
    newVariableText,
    setNewVariableText,
    nameValidationError,
    editValidationError,
    editingType,
    setEditingType,
    editingName,
    setEditingName,
    editingValue,
    setEditingValue,
    editingSuit,
    setEditingSuit,
    editingRank,
    setEditingRank,
    editingJoker,
    setEditingJoker,
    editingText,
    setEditingText,
    editingPokerHand,
    setEditingPokerHand,
    getUsageInfo,
    validateNewVariableName,
    validateEditVariableName,
    handleAddVariable,
    handleDeleteVariable,
    handleStartEdit,
    handleSaveEdit,
    handleCancelEdit,
    resetAddForm,
    getVariableDisplayValue,
  };
};
