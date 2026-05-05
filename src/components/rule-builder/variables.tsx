import React, { useState, useMemo } from "react";
import type { ConsumableData, UserVariable } from "@/lib/types";
import { getVariableUsageDetails } from "@/lib/rules/user-variable-utils";
import {
  SUITS,
  RANKS,
  POKER_HANDS,
  SUIT_VALUES,
  POKER_HAND_VALUES,
} from "@/lib/balatro-utils";
import {
  Terminal,
  Warning,
  Hash,
  Sparkle,
  Cube,
  Stack,
  Key,
  TextB,
  Code as Brackets,
  Plus,
  Trash,
  PencilSimple,
  GlobeHemisphereWest,
  Database,
} from "@phosphor-icons/react";
import { Input as InputField } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { validateVariableName } from "@/lib/validation-utils";
import { useProjectData } from "@/lib/storage";
import { collectGlobalVariables } from "@/lib/global-user-variables";
import Panel from "./panel";
import IconButton from "@/components/ui/icon-button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
type ItemData = any;

interface VariablesProps {
  position: { x: number; y: number };
  item: Exclude<ItemData, ConsumableData>;
  onUpdateItem: (updates: Partial<ItemData>) => void;
  onClose: () => void;
  onPositionChange: (position: { x: number; y: number }) => void;
}

const SUIT_OPTIONS = SUITS.map((suit) => ({
  value: suit.value,
  label: `${suit.label}`,
  type: "text",
}));

const RANK_OPTIONS = RANKS.map((rank) => ({
  value: rank.label,
  label: rank.label,
  type: "text",
}));

const POKER_HAND_OPTIONS = POKER_HANDS.map((hand) => ({
  value: hand.value,
  label: hand.label,
  type: "text",
}));

const VARIABLE_TYPE_OPTIONS = [
  { value: "number", label: "Number Variable" },
  { value: "suit", label: "Suit Variable" },
  { value: "rank", label: "Rank Variable" },
  {
    value: "pokerhand",
    label: "Poker Hand Variable",
  },
  {
    value: "key",
    label: "Key Variable",
  },
  { value: "text", label: "Text Variable" },
];

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

const Variables: React.FC<VariablesProps> = ({
  position,
  item,
  onUpdateItem,
  onClose,
}) => {
  const { data } = useProjectData();
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingVariable, setEditingVariable] = useState<string | null>(null);
  const [newVariableType, setNewVariableType] = useState<
    "number" | "suit" | "rank" | "pokerhand" | "key" | "text"
  >("number");
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
  const [newVariableIsGlobal, setNewVariableIsGlobal] = useState(false);
  const [newVariableIsPersistent, setNewVariableIsPersistent] = useState(false);

  const [nameValidationError, setNameValidationError] = useState<string>("");
  const [editValidationError, setEditValidationError] = useState<string>("");

  const [editingType, setEditingType] = useState<
    "number" | "suit" | "rank" | "pokerhand" | "key" | "text"
  >("number");
  const [editingName, setEditingName] = useState("");
  const [editingValue, setEditingValue] = useState(0);
  const [editingSuit, setEditingSuit] = useState<SuitValue>(SUIT_VALUES[0]);
  const [editingRank, setEditingRank] = useState<RankLabel>("Ace");
  const [editingJoker, setEditingJoker] = useState<string>("j_joker");
  const [editingText, setEditingText] = useState<string>("Hello");
  const [editingPokerHand, setEditingPokerHand] = useState<PokerHandValue>(
    POKER_HAND_VALUES[0],
  );
  const [editingIsGlobal, setEditingIsGlobal] = useState(false);
  const [editingIsPersistent, setEditingIsPersistent] = useState(false);

  const localUserVariables =
    "userVariables" in item &&
    Array.isArray((item as { userVariables: UserVariable[] }).userVariables)
      ? (item as { userVariables: UserVariable[] }).userVariables
      : [];
  const sharedGlobalVariables = useMemo(
    () =>
      collectGlobalVariables(data, { excludeItemId: item?.id }).map(
        (entry) => entry.variable,
      ),
    [data, item?.id],
  );
  const userVariables = useMemo(() => {
    const merged: UserVariable[] = [];
    const seen = new Set<string>();

    for (const variable of localUserVariables) {
      const key = variable.name.trim().toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(variable);
    }

    for (const variable of sharedGlobalVariables) {
      const key = variable.name.trim().toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(variable);
    }

    return merged;
  }, [localUserVariables, sharedGlobalVariables]);
  const localVariableIds = useMemo(
    () => new Set(localUserVariables.map((variable) => variable.id)),
    [localUserVariables],
  );
  const usageDetails = useMemo(
    () =>
      getVariableUsageDetails({
        ...item,
        userVariables,
      }),
    [item, userVariables],
  );

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

  const handleAddVariable = () => {
    if (!validateNewVariableName(newVariableName)) {
      return;
    }

    const newVariable: UserVariable = {
      id: crypto.randomUUID(),
      name: newVariableName.trim(),
      type: newVariableType,
      isGlobal: newVariableIsGlobal,
      isPersistent: newVariableIsGlobal ? newVariableIsPersistent : false,
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

    const updatedVariables = [...localUserVariables, newVariable];
    onUpdateItem({ userVariables: updatedVariables });

    setNewVariableName("");
    setNewVariableValue("0");
    setNewVariableSuit(SUIT_VALUES[0]);
    setNewVariableRank("Ace");
    setNewVariablePokerHand(POKER_HAND_VALUES[0]);
    setNewVariableKey("none");
    setNewVariableText("Hello");
    setNewVariableIsGlobal(false);
    setNewVariableIsPersistent(false);
    setNewVariableType("number");
    setNameValidationError("");
    setShowAddForm(false);
  };

  const handleDeleteVariable = (variableId: string) => {
    const updatedVariables = localUserVariables.filter(
      (v: UserVariable) => v.id !== variableId,
    );
    onUpdateItem({ userVariables: updatedVariables });
  };

  const handleStartEdit = (variable: UserVariable) => {
    setEditingVariable(variable.id);
    setEditingName(variable.name);
    setEditingType(variable.type || "number");
    setEditingValue(variable.initialValue || 0);
    setEditingText(variable.initialText || "");
    setEditingSuit((variable.initialSuit as SuitValue) || SUIT_VALUES[0]);
    setEditingRank((variable.initialRank as RankLabel) || "Ace");
    setEditingPokerHand(variable.initialPokerHand || POKER_HAND_VALUES[0]);
    setEditingJoker((variable.initialKey as string) || "j_joker");
    setEditingIsGlobal(!!variable.isGlobal);
    setEditingIsPersistent(!!variable.isPersistent);
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
      isGlobal: editingIsGlobal,
      isPersistent: editingIsGlobal ? editingIsPersistent : false,
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

    const updatedVariables = localUserVariables.map((v: UserVariable) =>
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
      const suit = variable.initialSuit || SUIT_VALUES[0];
      return suit;
    } else if (variable.type === "text") {
      const text = variable.initialText || "Hello";
      return text;
    } else if (variable.type === "rank") {
      const rank = variable.initialRank || "Ace";
      return rank;
    } else if (variable.type === "pokerhand") {
      const pokerHand = variable.initialPokerHand || POKER_HAND_VALUES[0];
      return pokerHand;
    } else if (variable.type === "key") {
      const pokerHand = variable.initialKey || "j_joker";
      return pokerHand;
    } else {
      return variable.initialValue?.toString() || "0";
    }
  };

  const getVariableIcon = (
    type: "number" | "suit" | "rank" | "pokerhand" | "key" | "text" | undefined,
  ) => {
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

  const getVariableColor = (
    type: "number" | "suit" | "rank" | "pokerhand" | "key" | "text" | undefined,
  ) => {
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

  const renderSelectField = (
    label: string,
    value: string,
    onChange: (value: string) => void,
    options: Array<{ value: string; label: string }>,
  ) => (
    <div className="space-y-1">
      <label className="text-xs text-muted-foreground">{label}</label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger size="sm" className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <Panel
      id="variables"
      position={position}
      icon={Terminal}
      title="Variables"
      onClose={onClose}
      closeLabel="Close Variables"
      className="w-80"
      headerClassName="p-4"
      contentClassName="p-4"
      headerActions={
        <span className="text-muted-foreground text-xs">
          {userVariables.length} variable{userVariables.length !== 1 ? "s" : ""}
        </span>
      }
    >
      <div>
        <div className="max-h-96 overflow-y-auto custom-scrollbar divide-y divide-border/40 mb-4">
          {userVariables.length === 0 && !showAddForm ? (
            <div className="text-center py-8">
              <Terminal className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-50" />
              <p className="text-muted-foreground text-sm">
                No variables created yet
              </p>
              <p className="text-muted-foreground text-xs mt-1">
                Create variables to store and modify values in your joker
              </p>
            </div>
          ) : (
            userVariables.map((variable) => {
              const usageInfo = getUsageInfo(variable.name);
              const isEditing = editingVariable === variable.id;
              const isLocalVariable = localVariableIds.has(variable.id);
              const VariableIcon = getVariableIcon(variable.type);
              const colorClass = getVariableColor(variable.type);

              return (
                <div
                  key={variable.id}
                  className="bg-background/60 rounded-xl p-3"
                >
                  {isEditing ? (
                    <div className="space-y-3">
                      <div>
                        <InputField
                          value={editingName}
                          onChange={(e) => {
                            setEditingName(e.target.value);
                            if (editValidationError) {
                              validateEditVariableName(
                                e.target.value,
                                variable.id,
                              );
                            }
                          }}
                          label="Name"
                          size="sm"
                        />
                        {editValidationError && (
                          <div className="flex items-center gap-2 mt-1 text-balatro-red text-sm">
                            <Warning className="h-4 w-4" />
                            <span>{editValidationError}</span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-end gap-2">
                        <div className="grow">
                          {renderSelectField(
                            "Type",
                            editingType,
                            (value) =>
                              setEditingType(
                                value as
                                  | "number"
                                  | "suit"
                                  | "rank"
                                  | "pokerhand"
                                  | "key"
                                  | "text",
                              ),
                            VARIABLE_TYPE_OPTIONS,
                          )}
                        </div>
                        <IconButton
                          icon={GlobeHemisphereWest}
                          tooltip={
                            editingIsGlobal
                              ? "Global variable enabled"
                              : "Make variable global"
                          }
                          onClick={() =>
                            setEditingIsGlobal((prev) => {
                              const next = !prev;
                              if (!next) {
                                setEditingIsPersistent(false);
                              }
                              return next;
                            })
                          }
                          isActive={editingIsGlobal}
                          className="h-8 w-8"
                        />
                        {editingIsGlobal ? (
                          <IconButton
                            icon={Database}
                            tooltip={
                              editingIsPersistent
                                ? "Persistent between runs"
                                : "Local to current run"
                            }
                            onClick={() =>
                              setEditingIsPersistent((prev) => !prev)
                            }
                            isActive={editingIsPersistent}
                            className="h-8 w-8"
                          />
                        ) : null}
                      </div>

                      {editingType === "number" && (
                        <InputField
                          value={editingValue.toString()}
                          onChange={(e) => {
                            const value = parseFloat(e.target.value) || 0;
                            setEditingValue(value);
                          }}
                          type="number"
                          label="Initial Value"
                          size="sm"
                        />
                      )}

                      {editingType === "key" && (
                        <InputField
                          value={editingJoker.toString()}
                          onChange={(e) => {
                            const value = e.target.value || "j_joker";
                            setEditingJoker(value as string);
                          }}
                          type="string"
                          label="Initial Joker"
                          size="sm"
                        />
                      )}

                      {editingType === "suit" &&
                        renderSelectField(
                          "Initial Suit",
                          editingSuit,
                          (value) => setEditingSuit(value as SuitValue),
                          SUIT_OPTIONS,
                        )}

                      {editingType === "rank" &&
                        renderSelectField(
                          "Initial Rank",
                          editingRank,
                          (value) => setEditingRank(value as RankLabel),
                          RANK_OPTIONS,
                        )}

                      {editingType === "pokerhand" &&
                        renderSelectField(
                          "Initial Poker Hand",
                          editingPokerHand,
                          (value) =>
                            setEditingPokerHand(value as PokerHandValue),
                          POKER_HAND_OPTIONS,
                        )}

                      {editingType === "text" && (
                        <InputField
                          value={editingText.toString()}
                          onChange={(e) => {
                            const value = e.target.value || "Hello";
                            setEditingText(value as string);
                          }}
                          type="string"
                          label="Initial Text"
                          size="sm"
                        />
                      )}

                      <div className="flex gap-2">
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => handleSaveEdit(variable.id)}
                          disabled={!!editValidationError}
                          className="cursor-pointer flex-1"
                        >
                          Save
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={handleCancelEdit}
                          className="cursor-pointer"
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <VariableIcon className={`h-4 w-4 ${colorClass}`} />
                          <span
                            className={`text-sm font-mono font-medium ${colorClass}`}
                          >
                            ${variable.name}
                          </span>
                        </div>

                        {isLocalVariable ? (
                          <div className="flex items-center gap-1">
                            <IconButton
                              icon={PencilSimple}
                              tooltip="Edit Variable"
                              onClick={() => handleStartEdit(variable)}
                              className="h-7 w-7"
                              iconClassName="h-3.5 w-3.5"
                            />
                            <IconButton
                              icon={Trash}
                              tooltip="Delete Variable"
                              onClick={() => handleDeleteVariable(variable.id)}
                              className="h-7 w-7 border-destructive/40 text-destructive hover:border-destructive/60 hover:text-destructive"
                              iconClassName="h-3.5 w-3.5"
                            />
                          </div>
                        ) : (
                          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                            Shared
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                          {variable.type === "number" ? "Initial:" : "Value:"}{" "}
                          {getVariableDisplayValue(variable)}
                        </span>
                        {variable.isGlobal ? (
                          <span className="text-[10px] uppercase tracking-wide text-jungle-green-400">
                            {variable.isPersistent
                              ? "Global - Persistent"
                              : "Global - Run"}
                          </span>
                        ) : null}
                        {usageInfo.count > 0 && (
                          <div className="flex items-center gap-1">
                            <span className="text-muted-foreground text-xs">
                              Used in:
                            </span>
                            {usageInfo.rules.map((ruleNum) => (
                              <span
                                key={ruleNum}
                                className={
                                  "bg-muted/40 text-xs px-1.5 py-0.5 rounded text-white"
                                }
                              >
                                {ruleNum + 1}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}

          {showAddForm && (
            <div className="bg-background/70 rounded-xl p-3">
              <div className="space-y-3">
                <div>
                  <InputField
                    value={newVariableName}
                    onChange={(e) => {
                      setNewVariableName(e.target.value);
                      validateNewVariableName(e.target.value);
                    }}
                    placeholder="myVariable"
                    label="Name"
                    size="sm"
                  />
                  {nameValidationError && (
                    <div className="flex items-center gap-2 mt-1 text-balatro-red text-sm">
                      <Warning className="h-4 w-4" />
                      <span>{nameValidationError}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-end gap-2">
                  <div className="grow">
                    {renderSelectField(
                      "Type",
                      newVariableType,
                      (value) =>
                        setNewVariableType(
                          value as
                            | "number"
                            | "suit"
                            | "rank"
                            | "pokerhand"
                            | "key"
                            | "text",
                        ),
                      VARIABLE_TYPE_OPTIONS,
                    )}
                  </div>
                  <IconButton
                    icon={GlobeHemisphereWest}
                    tooltip={
                      newVariableIsGlobal
                        ? "Global variable enabled"
                        : "Make variable global"
                    }
                    onClick={() =>
                      setNewVariableIsGlobal((prev) => {
                        const next = !prev;
                        if (!next) {
                          setNewVariableIsPersistent(false);
                        }
                        return next;
                      })
                    }
                    isActive={newVariableIsGlobal}
                    className="h-8 w-8"
                  />
                  {newVariableIsGlobal ? (
                    <IconButton
                      icon={Database}
                      tooltip={
                        newVariableIsPersistent
                          ? "Persistent between runs"
                          : "Local to current run"
                      }
                      onClick={() =>
                        setNewVariableIsPersistent((prev) => !prev)
                      }
                      isActive={newVariableIsPersistent}
                      className="h-8 w-8"
                    />
                  ) : null}
                </div>

                {newVariableType === "number" && (
                  <InputField
                    value={newVariableValue}
                    onChange={(e) => setNewVariableValue(e.target.value)}
                    placeholder="0"
                    label="Initial Value"
                    type="number"
                    size="sm"
                  />
                )}

                {newVariableType === "key" && (
                  <InputField
                    value={newVariableKey}
                    onChange={(e) => setNewVariableKey(e.target.value)}
                    placeholder="none"
                    label="Initial Key"
                    type="string"
                    size="sm"
                  />
                )}

                {newVariableType === "text" && (
                  <InputField
                    value={newVariableText}
                    onChange={(e) => setNewVariableText(e.target.value)}
                    placeholder="Hello"
                    label="Initial Text"
                    type="string"
                    size="sm"
                  />
                )}

                {newVariableType === "suit" &&
                  renderSelectField(
                    "Initial Suit",
                    newVariableSuit,
                    (value) => setNewVariableSuit(value as SuitValue),
                    SUIT_OPTIONS,
                  )}

                {newVariableType === "rank" &&
                  renderSelectField(
                    "Initial Rank",
                    newVariableRank,
                    (value) => setNewVariableRank(value as RankLabel),
                    RANK_OPTIONS,
                  )}

                {newVariableType === "pokerhand" &&
                  renderSelectField(
                    "Initial Poker Hand",
                    newVariablePokerHand,
                    (value) => setNewVariablePokerHand(value as PokerHandValue),
                    POKER_HAND_OPTIONS,
                  )}

                <div className="flex gap-2">
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleAddVariable}
                    disabled={!newVariableName.trim() || !!nameValidationError}
                    className="cursor-pointer flex-1"
                  >
                    Create
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setShowAddForm(false);
                      setNewVariableName("");
                      setNewVariableValue("0");
                      setNewVariableSuit(SUIT_VALUES[0]);
                      setNewVariableRank("Ace");
                      setNewVariableText("Hello");
                      setNewVariableKey("none");
                      setNewVariablePokerHand(POKER_HAND_VALUES[0]);
                      setNewVariableIsGlobal(false);
                      setNewVariableIsPersistent(false);
                      setNewVariableType("number");
                      setNameValidationError("");
                    }}
                    className="cursor-pointer"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        {!showAddForm && (
          <Button
            variant="secondary"
            size="sm"
            fullWidth
            onClick={() => setShowAddForm(true)}
            icon={<Plus className="h-4 w-4" />}
            className="cursor-pointer"
          >
            Add Variable
          </Button>
        )}
      </div>
    </Panel>
  );
};

export default Variables;
