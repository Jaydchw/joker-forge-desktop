import React, { useState } from "react";
import type {
  Rule,
  Condition,
  Effect,
  RandomGroup,
  ConditionParameter,
  EffectParameter,
  ShowWhenCondition,
  LoopGroup,
} from "./types";
import { getModPrefix } from "@/lib/balatro-utils";
import type { JokerData } from "@/lib/types";
import {
  addSuitVariablesToOptions,
  addRankVariablesToOptions,
  getAllVariables,
  addPokerHandVariablesToOptions,
  addNumberVariablesToOptions,
  getNumberVariables,
  addKeyVariablesToOptions,
  addTextVariablesToOptions,
} from "@/lib/rules/user-variable-utils";
import { useProjectData } from "@/lib/storage";
import {
  collectGlobalVariables,
  mergeItemVariablesWithGlobals,
} from "@/lib/global-user-variables";

import {
  getTriggerById,
  getConditionTypeById,
  getEffectTypeById,
} from "./rule-catalog";

import { Input as InputField } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Eye,
  Info,
  Code as Brackets,
  X,
  Plus,
  Prohibit,
  Warning,
  ArrowsLeftRight,
  ArrowCounterClockwise,
  ChartPieSlice,
  Percent,
} from "@phosphor-icons/react";
import {
  validateVariableName,
  validateCustomMessage,
} from "@/lib/validation-utils";
import { GameVariable, getGameVariableById } from "@/lib/game-vars";
import { Cube } from "@phosphor-icons/react";
import { SelectedItem } from "./types";
import { Checkbox } from "@/components/ui/checkbox";
import ItemTypeBadge from "./item-type-badge";
import IconButton from "@/components/ui/icon-button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Toggle } from "@/components/ui/toggle";
import Panel from "./panel";

interface InspectorProps {
  position: { x: number; y: number };
  joker: JokerData;
  selectedRule: Rule | null;
  selectedCondition: Condition | null;
  selectedEffect: Effect | null;
  selectedRandomGroup: RandomGroup | null;
  selectedLoopGroup: LoopGroup | null;
  onUpdateCondition: (
    ruleId: string,
    conditionId: string,
    updates: Partial<Condition>,
  ) => void;
  onUpdateEffect: (
    ruleId: string,
    effectId: string,
    updates: Partial<Effect>,
  ) => void;
  onUpdateRandomGroup: (
    ruleId: string,
    randomGroupId: string,
    updates: Partial<RandomGroup>,
  ) => void;
  onUpdateLoopGroup: (
    ruleId: string,
    randomGroupId: string,
    updates: Partial<LoopGroup>,
  ) => void;
  onUpdateJoker: (updates: Partial<JokerData>) => void;
  onClose: () => void;
  onPositionChange: (position: { x: number; y: number }) => void;
  onToggleVariablesPanel: (
    preferredType?: "number" | "suit" | "rank" | "pokerhand" | "key" | "text",
  ) => void;
  onToggleGameVariablesPanel: () => void;
  onCreateRandomGroupFromEffect: (ruleId: string, effectId: string) => void;
  onCreateLoopGroupFromEffect: (ruleId: string, effectId: string) => void;
  selectedGameVariable: GameVariable | null;
  onGameVariableApplied: () => void;
  selectedItem: SelectedItem;
  itemType: "joker" | "consumable" | "card" | "voucher" | "deck";
}

interface ParameterFieldProps {
  param: ConditionParameter | EffectParameter;
  item: { value: unknown; valueType?: string };
  selectedRule: Rule;
  onChange: (param: { value: unknown; valueType?: string }) => void;
  selectedCondition?: Condition;
  selectedEffect?: Effect;
  parentValues?: Record<string, { value: unknown; valueType?: string }>;
  availableVariables?: Array<{
    value: string;
    label: string;
    valueType?: string;
  }>;
  onCreateVariable?: (name: string, initialValue: number) => void;
  onOpenVariablesPanel?: (
    preferredType?: "number" | "suit" | "rank" | "pokerhand" | "key" | "text",
  ) => void;
  onOpenGameVariablesPanel?: () => void;
  selectedGameVariable?: GameVariable | null;
  onGameVariableApplied?: () => void;
  isEffect?: boolean;
  joker?: JokerData;
  itemType: "joker" | "consumable" | "card" | "voucher" | "deck";
}

interface ChanceInputProps {
  label: string;
  value: string | number | undefined;
  onChange: (param: { value: string | number; valueType?: string }) => void;
  availableVariables: Array<{
    value: string;
    label: string;
    valueType?: string;
  }>;
  onCreateVariable: (name: string, initialValue: number) => void;
  onOpenVariablesPanel: (
    preferredType?: "number" | "suit" | "rank" | "pokerhand" | "key" | "text",
  ) => void;
  onOpenGameVariablesPanel: () => void;
  selectedGameVariable?: GameVariable | null;
  onGameVariableApplied?: () => void;
  itemType: "joker" | "consumable" | "card" | "voucher" | "deck";
}

const ChanceInput: React.FC<ChanceInputProps> = React.memo(
  ({
    label,
    value,
    onChange,
    availableVariables,
    onOpenVariablesPanel,
    onOpenGameVariablesPanel,
    selectedGameVariable,
    onGameVariableApplied,
    itemType,
  }) => {
    const [isVariableMode, setIsVariableMode] = React.useState(
      typeof value === "string" &&
        !value.startsWith("GAMEVAR:") &&
        !value.startsWith("RANGE:"),
    );
    const [isRangeMode, setIsRangeMode] = React.useState(
      typeof value === "string" && value.startsWith("RANGE:"),
    );
    const [inputValue, setInputValue] = React.useState("");

    const numericValue = typeof value === "number" ? value : 1;
    const actualValue = value || numericValue;

    React.useEffect(() => {
      if (typeof value === "number") {
        setInputValue(value.toString());
      }
    }, [value]);

    const parseRangeValue = (rangeStr: string | number | unknown) => {
      if (typeof rangeStr === "string" && rangeStr.startsWith("RANGE:")) {
        const parts = rangeStr.replace("RANGE:", "").split("|");
        return {
          min: parseFloat(parts[0] || "1"),
          max: parseFloat(parts[1] || "5"),
        };
      }
      return { min: 1, max: 5 };
    };

    const rangeValues =
      isRangeMode && typeof actualValue === "string"
        ? parseRangeValue(actualValue)
        : { min: 1, max: 5 };

    React.useEffect(() => {
      const isVar =
        typeof value === "string" &&
        !value.startsWith("GAMEVAR:") &&
        !value.startsWith("RANGE:");
      const isRange = typeof value === "string" && value.startsWith("RANGE:");
      setIsVariableMode(isVar);
      setIsRangeMode(isRange);
    }, [value]);

    React.useEffect(() => {
      if (selectedGameVariable) {
        const currentValue = value;
        const isAlreadyGameVar =
          typeof currentValue === "string" &&
          currentValue.startsWith("GAMEVAR:");
        const multiplier = isAlreadyGameVar
          ? parseFloat(currentValue.split("|")[1] || "1")
          : 1;
        const startsFrom = isAlreadyGameVar
          ? parseFloat(currentValue.split("|")[2] || "0")
          : 0;

        onChange({
          value: `GAMEVAR:${selectedGameVariable.id}|${multiplier}|${startsFrom}`,
          valueType: "game_var",
        });
        onGameVariableApplied?.();
      }
    }, [selectedGameVariable, value, onChange, onGameVariableApplied]);

    const handleModeChange = (mode: "number" | "variable" | "range") => {
      if (mode === "number") {
        setIsVariableMode(false);
        setIsRangeMode(false);
        onChange({ value: numericValue, valueType: "number" });
      } else if (mode === "variable") {
        setIsVariableMode(true);
        setIsRangeMode(false);
        onChange({ value: "", valueType: "user_var" });
      } else if (mode === "range") {
        setIsVariableMode(false);
        setIsRangeMode(true);
        onChange({ value: "RANGE:1|5", valueType: "range_var" });
      }
    };

    const handleNumberChange = (
      e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    ) => {
      const newValue = e.target.value;
      setInputValue(newValue);

      if (newValue === "" || newValue === "-") {
        onChange({ value: 0, valueType: "number" });
        return;
      }

      const parsed = parseFloat(newValue);
      if (!isNaN(parsed)) {
        onChange({ value: parsed, valueType: "number" });
      }
    };

    return (
      <div className="flex flex-col gap-2 items-start w-full">
        <div className="flex items-center gap-2">
          <span className="text-zinc-100 text-sm">{label}</span>
          {itemType !== "consumable" && (
            <Toggle
              pressed={isVariableMode}
              onPressedChange={() =>
                handleModeChange(isVariableMode ? "number" : "variable")
              }
              variant="outline"
              size="sm"
              className="cursor-pointer data-[state=on]:bg-jungle-green-500/20 data-[state=on]:text-jungle-green-400"
              title="Toggle variable mode"
            >
              <Brackets className="h-3 w-3" />
            </Toggle>
          )}
          <Toggle
            pressed={typeof value === "string" && value.startsWith("GAMEVAR:")}
            onPressedChange={() => onOpenGameVariablesPanel()}
            variant="outline"
            size="sm"
            className="cursor-pointer data-[state=on]:bg-jungle-green-500/20 data-[state=on]:text-jungle-green-400"
            title="Use game variable"
          >
            <Cube className="h-3 w-3" />
          </Toggle>
          <Toggle
            pressed={isRangeMode}
            onPressedChange={() =>
              handleModeChange(isRangeMode ? "number" : "range")
            }
            variant="outline"
            size="sm"
            className="cursor-pointer data-[state=on]:bg-jungle-green-500/20 data-[state=on]:text-jungle-green-400"
            title="Toggle range mode"
          >
            <ArrowsLeftRight className="h-3 w-3" />
          </Toggle>
        </div>

        {isRangeMode ? (
          <div className="flex items-center gap-2 w-full">
            <InputField
              type="number"
              value={rangeValues.min.toString()}
              onChange={(e) => {
                const newMin = parseFloat(e.target.value) ?? 1;
                onChange({
                  value: `RANGE:${newMin}|${rangeValues.max}`,
                  valueType: "range_var",
                });
              }}
              size="sm"
              className="w-16"
              placeholder="Min"
            />
            <span className="text-zinc-100 text-xs">to</span>
            <InputField
              type="number"
              value={rangeValues.max.toString()}
              onChange={(e) => {
                const newMax = parseFloat(e.target.value) ?? 1;
                onChange({
                  value: `RANGE:${rangeValues.min}|${newMax}`,
                  valueType: "range_var",
                });
              }}
              size="sm"
              className="w-16"
              placeholder="Max"
            />
          </div>
        ) : isVariableMode && itemType !== "consumable" ? (
          <div className="space-y-2 w-full">
            {availableVariables.length > 0 ? (
              <Select
                value={
                  ((actualValue as string) || "") === ""
                    ? undefined
                    : String(actualValue)
                }
                onValueChange={(selectedValue) => {
                  const selectedOption = availableVariables.find(
                    (opt) => String(opt.value) === selectedValue,
                  ) ?? {
                    value: selectedValue,
                    label: selectedValue,
                    valueType: "user_var",
                  };

                  onChange(selectedOption);
                }}
              >
                <SelectTrigger size="sm" className="w-full">
                  <SelectValue placeholder="Select variable" />
                </SelectTrigger>
                <SelectContent className="z-120 bg-popover text-popover-foreground border-border shadow-2xl">
                  {availableVariables.map((option) => (
                    <SelectItem
                      key={`chance-${option.value}-${option.label}`}
                      value={String(option.value)}
                      className="text-foreground"
                    >
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Button
                variant="secondary"
                size="sm"
                fullWidth
                onClick={() => onOpenVariablesPanel("number")}
                icon={<Plus className="h-4 w-4" />}
                className="cursor-pointer"
              >
                Create Variable
              </Button>
            )}
          </div>
        ) : (
          <InputField
            type="number"
            value={inputValue}
            onChange={handleNumberChange}
            size="sm"
            className="w-20"
          />
        )}
      </div>
    );
  },
);

ChanceInput.displayName = "ChanceInput";

function hasShowWhen(
  param: ConditionParameter | EffectParameter | undefined,
): param is (ConditionParameter | EffectParameter) & {
  showWhen: ShowWhenCondition;
} {
  if (!param || !param.showWhen) return false;
  else return "showWhen" in param;
}

const ParameterField: React.FC<ParameterFieldProps> = ({
  param,
  item,
  selectedRule,
  onChange,
  selectedCondition,
  selectedEffect,
  parentValues = {},
  availableVariables = [],
  onOpenVariablesPanel,
  onOpenGameVariablesPanel,
  selectedGameVariable,
  onGameVariableApplied,
  isEffect = false,
  joker = null,
  itemType,
}) => {
  const value = item.value;
  const [isVariableMode, setIsVariableMode] = React.useState(
    typeof value === "string" &&
      !value.startsWith("GAMEVAR:") &&
      !value.startsWith("RANGE:"),
  );
  const [isRangeMode, setIsRangeMode] = React.useState(
    typeof value === "string" && value.startsWith("RANGE:"),
  );
  const [inputValue, setInputValue] = React.useState("");
  const [inputError, setInputError] = React.useState<string>("");

  const [showStartsFromTooltip, setShowStartsFromTooltip] =
    React.useState(false);
  const [showMultiplierTooltip, setShowMultiplierTooltip] =
    React.useState(false);

  React.useEffect(() => {
    if (param.type === "number" && typeof value === "number") {
      setInputValue(value.toString());
    }
  }, [param.type, value]);

  React.useEffect(() => {
    const isVar =
      typeof value === "string" &&
      !value.startsWith("GAMEVAR:") &&
      !value.startsWith("RANGE:");
    const isRange = typeof value === "string" && value.startsWith("RANGE:");
    setIsVariableMode(isVar);
    setIsRangeMode(isRange);
  }, [value]);

  React.useEffect(() => {
    if (selectedGameVariable && param.type === "number") {
      const currentValue = value;
      const isAlreadyGameVar =
        typeof currentValue === "string" && currentValue.startsWith("GAMEVAR:");
      const multiplier = isAlreadyGameVar
        ? parseFloat(currentValue.split("|")[1] || "1")
        : 1;
      const startsFrom = isAlreadyGameVar
        ? parseFloat(currentValue.split("|")[2] || "0")
        : 0;

      onChange({
        value: `GAMEVAR:${selectedGameVariable.id}|${multiplier}|${startsFrom}`,
        valueType: "game_var",
      });
      onGameVariableApplied?.();
    }
  }, [
    selectedGameVariable,
    param.type,
    onChange,
    onGameVariableApplied,
    value,
  ]);

  if (hasShowWhen(param)) {
    let showing = true;
    let currentParam: ConditionParameter | EffectParameter | undefined = param;
    const parentObject = isEffect
      ? getEffectTypeById(selectedEffect?.type || "")
      : getConditionTypeById(selectedCondition?.type || "");

    while (showing && currentParam && hasShowWhen(currentParam)) {
      const { parameter, values }: ShowWhenCondition = currentParam.showWhen;
      const parentValue = parentValues[parameter].value;
      if (Array.isArray(parentValue) && typeof parentValue[0] === "boolean") {
        if (!values.some((item) => parentValue[parseFloat(item)])) {
          showing = false;
        }
      } else if (typeof parentValue === "string") {
        if (!values.includes(parentValue)) {
          showing = false;
        }
      }

      currentParam = parentObject?.params.find(
        (param) => param.id === parameter,
      );
    }
    if (showing === false) return false;
  }

  switch (param.type) {
    case "select": {
      let options: Array<{
        value: string;
        label: string;
        valueType?: string;
        exempt?: string[];
      }> = [];

      if (typeof param.options === "function") {
        // Check if the function expects parentValues parameter
        if (param.options.length > 0) {
          // Function expects parentValues
          options = param.options(parentValues || {});
        } else {
          // Function with no parameters, but expects parentValues argument
          options = param.options(parentValues || {});
        }
      } else if (Array.isArray(param.options)) {
        options = param.options.map((option) => ({
          value: option.value,
          label: option.label,
          valueType: option.valueType ?? "text",
          exempt: option.exempt ?? undefined,
        }));
      }

      const trigger = selectedRule.trigger;
      const triggerDef = getTriggerById(trigger);

      if (param.variableTypes?.includes("joker_context")) {
        if (trigger === "joker_evaluated") {
          options.push({
            value: "evaled_joker",
            label: "Evaluated Joker",
            valueType: "context",
          });
        }
        if (
          selectedRule.conditionGroups.some((groups) =>
            groups.conditions.some(
              (condition) =>
                condition.type === "joker_selected" &&
                condition.negate === false,
            ),
          )
        ) {
          options.push({
            value: "selected_joker",
            label: "Selected Joker",
            valueType: "context",
            exempt: ["joker", "card", "voucher", "deck"],
          });
        }
      }

      const cardContexts: Array<{
        context:
          | "rank_context"
          | "suit_context"
          | "enhancement_context"
          | "seal_context"
          | "edition_context";
        label: string;
      }> = [
        { context: "rank_context", label: "Rank" },
        { context: "suit_context", label: "Suit" },
        { context: "enhancement_context", label: "Enhancement" },
        { context: "seal_context", label: "Seal" },
        { context: "edition_context", label: "Edition" },
      ];

      cardContexts.forEach((item) => {
        if (param.variableTypes?.includes(item.context)) {
          if (trigger === "card_scored") {
            options.push({
              value: "scored_card",
              label: `Scored Card ${item.label}`,
              valueType: "context",
            });
          }
          if (trigger === "card_destroyed") {
            options.push({
              value: "destroyed_card",
              label: `Destroyed Card ${item.label}`,
              valueType: "context",
            });
          }
          if (trigger === "card_discarded") {
            options.push({
              value: "discarded_card",
              label: `Discarded Card ${item.label}`,
              valueType: "context",
            });
          }
          if (
            trigger === "card_held_in_hand" ||
            trigger === "card_held_in_hand_end_of_round"
          ) {
            options.push({
              value: "held_card",
              label: `Card Held in Hand ${item.label}`,
              valueType: "context",
            });
          }
          if (trigger === "card_added") {
            options.push({
              value: "added_card",
              label: `Added Card ${item.label}`,
              valueType: "context",
            });
          }
        }
      });

      if (param.variableTypes?.includes("edition_context")) {
        if (trigger === "joker_evaluated") {
          options.push({
            value: "evaled_joker",
            label: `Evaluated Joker Edition`,
            valueType: "context",
          });
        }
        if (
          selectedRule.conditionGroups.some((groups) =>
            groups.conditions.some(
              (condition) =>
                condition.type === "joker_selected" &&
                condition.negate === false,
            ),
          )
        ) {
          options.push({
            value: "selected_joker",
            label: "Selected Joker Edition",
            valueType: "context",
            exempt: ["joker", "card", "voucher", "deck"],
          });
        }
      }

      if (param.variableTypes?.includes("consumable_context")) {
        if (trigger === "consumable_used") {
          options.push({
            value: "used_consumable",
            label: `Used Consumable`,
            valueType: "context",
          });
        }
      }

      if (param.variableTypes?.includes("voucher_context")) {
        if (trigger === "voucher_redeemd") {
          options.push({
            value: "redeemed_voucher",
            label: `Redeemed Voucher`,
            valueType: "context",
          });
        }
      }

      if (param.variableTypes?.includes("booster_context")) {
        if (trigger === "booster_opened") {
          options.push({
            value: "opened_booster",
            label: `Opened Booster Pack`,
            valueType: "context",
          });
        }
        if (trigger === "booster_skipped") {
          options.push({
            value: "skipped_booster",
            label: `Skipped Booster Pack`,
            valueType: "context",
          });
        }
        if (trigger === "booster_exited") {
          options.push({
            value: "exited_booster",
            label: `Exited Booster Pack`,
            valueType: "context",
          });
        }
      }

      if (param.variableTypes?.includes("tag_context")) {
        if (trigger === "tag_added") {
          options.push({
            value: "added_tag",
            label: `Added Tag`,
            valueType: "context",
          });
        }
        if (
          trigger === "blind selected" ||
          triggerDef?.category === "In Blind Events" ||
          triggerDef?.category === "Hand Scoring"
        ) {
          options.push({
            value: "blind_tag",
            label: `Current Blind Skip Tag`,
            valueType: "context",
          });
        }
      }

      if (param.id === "variable_name" && joker && param.label) {
        if (param.variableTypes?.includes("number")) {
          const numberVariables =
            joker.userVariables?.filter(
              (v) => !v.type || v.type === "number",
            ) || [];
          options.push(
            ...numberVariables.map((variable) => ({
              value: variable.name,
              label: variable.name,
              valueType: "user_var",
            })),
          );
        }
        if (param.variableTypes?.includes("suit")) {
          const suitVariables =
            joker.userVariables?.filter(
              (v) => v.type === "suit",
            ) || [];
          options.push(
            ...suitVariables.map((variable) => ({
              value: variable.name,
              label: variable.name,
              valueType: "user_var",
            })),
          );
        }
        if (param.variableTypes?.includes("rank")) {
          const rankVariables =
            joker.userVariables?.filter(
              (v) => v.type === "rank",
            ) || [];
          options.push(
            ...rankVariables.map((variable) => ({
              value: variable.name,
              label: variable.name,
              valueType: "user_var",
            })),
          );
        }
        if (param.variableTypes?.includes("pokerhand")) {
          const pokerHandVariables =
            joker.userVariables?.filter(
              (v) => v.type === "pokerhand",
            ) || [];
          options.push(
            ...pokerHandVariables.map((variable) => ({
              value: variable.name,
              label: variable.name,
              valueType: "user_var",
            })),
          );
        }
        if (param.variableTypes?.includes("key")) {
          const keyVariables =
            joker.userVariables?.filter(
              (v) => v.type === "key",
            ) || [];
          options.push(
            ...keyVariables.map((variable) => ({
              value: variable.name,
              label: variable.name,
              valueType: "user_var",
            })),
          );
        }
        if (param.variableTypes?.includes("text")) {
          const textVariables =
            joker.userVariables?.filter(
              (v) => v.type === "text",
            ) || [];
          options.push(
            ...textVariables.map((variable) => ({
              value: variable.name,
              label: variable.name,
              valueType: "user_var",
            })),
          );
        }
      } else {
        if (param.variableTypes?.includes("number") && joker) {
          options = addNumberVariablesToOptions(options, joker);
        }

        if (param.variableTypes?.includes("suit") && joker) {
          options = addSuitVariablesToOptions(options, joker);
        }

        if (param.variableTypes?.includes("rank") && joker) {
          options = addRankVariablesToOptions(options, joker);
        }

        if (param.variableTypes?.includes("pokerhand") && joker) {
          options = addPokerHandVariablesToOptions(options, joker);
        }

        if (param.variableTypes?.includes("key") && joker) {
          options = addKeyVariablesToOptions(options, joker);
        }

        if (param.variableTypes?.includes("text") && joker) {
          options = addTextVariablesToOptions(options, joker);
        }
      }

      options = options.filter((option) => !option.exempt?.includes(itemType));
      const variableTypeOrder = [
        "number",
        "suit",
        "rank",
        "pokerhand",
        "key",
        "text",
      ] as const;
      const preferredVariableType = variableTypeOrder.find((type) =>
        param.variableTypes?.includes(type),
      );
      const isVariableOnlySelector = param.id === "variable_name";
      const variableOptions = options.filter((option) => option.valueType === "user_var");

      return (
        <div className="space-y-1">
          <label className="block text-zinc-200 text-sm">
            {String(param.label)}
          </label>
          {isVariableOnlySelector && variableOptions.length === 0 ? (
            <Button
              variant="secondary"
              size="sm"
              fullWidth
              onClick={() => onOpenVariablesPanel?.(preferredVariableType)}
              icon={<Plus className="h-4 w-4" />}
              className="cursor-pointer"
            >
              Add Variable
            </Button>
          ) : (
            <Select
              value={((value as string) || "") === "" ? undefined : String(value)}
              onValueChange={(selectedValue) => {
                const selectedOption = options.find(
                  (opt) => String(opt.value) === selectedValue,
                ) ?? {
                  value: selectedValue,
                  label: selectedValue,
                  valueType: "text",
                };

                onChange(selectedOption);
              }}
            >
              <SelectTrigger size="sm" className="w-full">
                <SelectValue placeholder="Select option" />
              </SelectTrigger>
              <SelectContent className="z-120 bg-popover text-popover-foreground border-border shadow-2xl">
                {options.map((option) => (
                  <SelectItem
                    key={`param-${param.id}-${option.value}-${option.label}`}
                    value={String(option.value)}
                    className="text-foreground"
                  >
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      );
    }

    case "number": {
      const isGameVariable =
        typeof value === "string" && value.startsWith("GAMEVAR:");
      const gameVariableId = isGameVariable
        ? value.replace("GAMEVAR:", "").split("|")[0]
        : null;
      const gameVariableMultiplier = isGameVariable
        ? parseFloat(value.replace("GAMEVAR:", "").split("|")[1] || "1")
        : 1;
      const gameVariableStartsFrom = isGameVariable
        ? parseFloat(value.replace("GAMEVAR:", "").split("|")[2] || "0")
        : 0;
      const gameVariable = gameVariableId
        ? getGameVariableById(gameVariableId)
        : null;

      const parseRangeValue = (rangeStr: string) => {
        if (rangeStr.startsWith("RANGE:")) {
          const parts = rangeStr.replace("RANGE:", "").split("|");
          return {
            min: parseFloat(parts[0] || "1"),
            max: parseFloat(parts[1] || "5"),
          };
        }
        return { min: 1, max: 5 };
      };

      const rangeValues =
        isRangeMode && typeof value === "string"
          ? parseRangeValue(value)
          : { min: 1, max: 5 };

      const numericValue =
        !isGameVariable && !isRangeMode && typeof value === "number"
          ? value
          : typeof param.default === "number"
            ? param.default
            : 0;

      const handleModeChange = (mode: "number" | "variable" | "range") => {
        if (mode === "number") {
          setIsVariableMode(false);
          setIsRangeMode(false);
          onChange({ value: numericValue, valueType: "number" });
          setInputValue(numericValue.toString());
        } else if (mode === "variable") {
          setIsVariableMode(true);
          setIsRangeMode(false);
          onChange({ value: "", valueType: "user_var" });
        } else if (mode === "range") {
          setIsVariableMode(false);
          setIsRangeMode(true);
          onChange({ value: "RANGE:1|5", valueType: "range_var" });
        }
      };

      const handleNumberChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
      ) => {
        const newValue = e.target.value;
        setInputValue(newValue);

        if (newValue === "" || newValue === "-") {
          onChange({ value: 0, valueType: "number" });
          return;
        }

        const parsed = parseFloat(newValue);
        if (!isNaN(parsed)) {
          onChange({ value: parsed, valueType: "number" });
        }
      };

      const handleGameVariableChange = (
        field: "multiplier" | "startsFrom",
        newValue: string,
      ) => {
        const parsed = parseFloat(newValue) || 0;
        if (field === "multiplier") {
          onChange({
            value: `GAMEVAR:${gameVariableId}|${parsed}|${gameVariableStartsFrom}`,
            valueType: "game_var",
          });
        } else {
          onChange({
            value: `GAMEVAR:${gameVariableId}|${gameVariableMultiplier}|${parsed}`,
            valueType: "game_var",
          });
        }
      };

      const handleRangeChange = (field: "min" | "max", newValue: string) => {
        const parsed = parseFloat(newValue) ?? 1;
        if (field === "min") {
          onChange({
            value: `RANGE:${parsed}|${rangeValues.max}`,
            valueType: "range_var",
          });
        } else {
          onChange({
            value: `RANGE:${rangeValues.min}|${parsed}`,
            valueType: "range_var",
          });
        }
      };

      return (
        <>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-zinc-100 text-sm">{String(param.label)}</span>
            {itemType !== "consumable" && (
              <Toggle
                pressed={isVariableMode}
                onPressedChange={() =>
                  handleModeChange(isVariableMode ? "number" : "variable")
                }
                variant="outline"
                size="sm"
                className="cursor-pointer data-[state=on]:bg-jungle-green-500/20 data-[state=on]:text-jungle-green-400"
                title="Toggle variable mode"
              >
                <Brackets className="h-4 w-4" />
              </Toggle>
            )}
            <Toggle
              pressed={isGameVariable}
              onPressedChange={() => onOpenGameVariablesPanel?.()}
              variant="outline"
              size="sm"
              className="cursor-pointer data-[state=on]:bg-jungle-green-500/20 data-[state=on]:text-jungle-green-400"
              title="Use game variable"
            >
              <Cube className="h-4 w-4" />
            </Toggle>
            {isEffect && (
              <Toggle
                pressed={isRangeMode}
                onPressedChange={() =>
                  handleModeChange(isRangeMode ? "number" : "range")
                }
                variant="outline"
                size="sm"
                className="cursor-pointer data-[state=on]:bg-jungle-green-500/20 data-[state=on]:text-jungle-green-400"
                title="Toggle range mode"
              >
                <ArrowsLeftRight className="h-4 w-4" />
              </Toggle>
            )}
          </div>

          {isGameVariable ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between p-2 bg-jungle-green-500/10 border border-jungle-green-400/30 rounded-lg">
                <div className="flex items-center gap-2">
                  <Cube className="h-4 w-4 text-jungle-green-400" />
                  <span className="text-jungle-green-400 text-sm font-medium">
                    {gameVariable?.label || "Unknown Game Variable"}
                  </span>
                </div>
                <button
                  onClick={() => {
                    onChange({ value: numericValue, valueType: "number" });
                    setInputValue(numericValue.toString());
                  }}
                  className="p-1 text-jungle-green-400 hover:text-white transition-colors cursor-pointer"
                  title="Remove game variable"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="relative">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-zinc-100 text-sm">Starts From</span>
                  <div
                    className="relative"
                    onMouseEnter={() => setShowStartsFromTooltip(true)}
                    onMouseLeave={() => setShowStartsFromTooltip(false)}
                  >
                    <Info className="h-4 w-4 text-zinc-400 hover:text-zinc-100 cursor-help transition-colors" />
                    {showStartsFromTooltip && (
                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/4 mb-2 px-3 py-2 bg-card border border-border rounded-lg text-sm text-foreground w-72 z-50 shadow-lg pointer-events-none">
                        Value that the Game Variable starts from. (e.g. 1 for
                        XMult)
                      </div>
                    )}
                  </div>
                </div>
                <InputField
                  type="number"
                  value={gameVariableStartsFrom.toString()}
                  onChange={(e) =>
                    handleGameVariableChange("startsFrom", e.target.value)
                  }
                  size="sm"
                />
              </div>
              <div className="relative">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-zinc-100 text-sm">Multiplier</span>
                  <div
                    className="relative"
                    onMouseEnter={() => setShowMultiplierTooltip(true)}
                    onMouseLeave={() => setShowMultiplierTooltip(false)}
                  >
                    <Info className="h-4 w-4 text-zinc-400 hover:text-zinc-100 cursor-help transition-colors" />
                    {showMultiplierTooltip && (
                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/4 mb-2 px-3 py-2 bg-card border border-border rounded-lg text-sm text-foreground w-72 z-50 shadow-lg pointer-events-none">
                        Factor that the Game Variable with multiply with /
                        increment by. (e.g. 0.1 for XMult)
                      </div>
                    )}
                  </div>
                </div>
                <InputField
                  type="number"
                  value={gameVariableMultiplier.toString()}
                  onChange={(e) =>
                    handleGameVariableChange("multiplier", e.target.value)
                  }
                  size="sm"
                />
              </div>
            </div>
          ) : isRangeMode && isEffect ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between p-2 bg-jungle-green-500/10 border border-jungle-green-400/30 rounded-lg">
                <div className="flex items-center gap-2">
                  <ArrowsLeftRight className="h-4 w-4 text-jungle-green-400" />
                  <span className="text-jungle-green-400 text-sm font-medium">
                    Range Mode: {rangeValues.min} to {rangeValues.max}
                  </span>
                </div>
                <button
                  onClick={() => handleModeChange("number")}
                  className="p-1 text-jungle-green-400 hover:text-white transition-colors cursor-pointer"
                  title="Remove range mode"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div>
                <span className="text-zinc-100 text-sm mb-2 block">
                  Minimum Value
                </span>
                <InputField
                  type="number"
                  value={rangeValues.min.toString()}
                  onChange={(e) => handleRangeChange("min", e.target.value)}
                  size="sm"
                />
              </div>
              <div>
                <span className="text-zinc-100 text-sm mb-2 block">
                  Maximum Value
                </span>
                <InputField
                  type="number"
                  value={rangeValues.max.toString()}
                  onChange={(e) => handleRangeChange("max", e.target.value)}
                  size="sm"
                />
              </div>
            </div>
          ) : isVariableMode && itemType !== "consumable" ? (
            <div className="space-y-2">
              {availableVariables && availableVariables.length > 0 ? (
                <Select
                  value={
                    ((value as string) || "") === "" ? undefined : String(value)
                  }
                  onValueChange={(selectedValue) => {
                    const selectedOption = availableVariables.find(
                      (opt) => String(opt.value) === selectedValue,
                    ) ?? {
                      value: selectedValue,
                      label: selectedValue,
                      valueType: "user_var",
                    };

                    onChange(selectedOption);
                  }}
                >
                  <SelectTrigger size="sm" className="w-full">
                    <SelectValue placeholder="Select variable" />
                  </SelectTrigger>
                  <SelectContent className="z-120 bg-popover text-popover-foreground border-border shadow-2xl">
                    {availableVariables.map((option) => (
                      <SelectItem
                        key={`num-${option.value}-${option.label}`}
                        value={String(option.value)}
                        className="text-foreground"
                      >
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Button
                  variant="secondary"
                  size="sm"
                  fullWidth
                  onClick={() => onOpenVariablesPanel?.("number")}
                  icon={<Plus className="h-4 w-4" />}
                  className="cursor-pointer"
                >
                  Create Variable
                </Button>
              )}
            </div>
          ) : (
            <InputField
              type="number"
              value={inputValue}
              onChange={handleNumberChange}
              size="sm"
              labelPosition="center"
            />
          )}
        </>
      );
    }

    case "text": {
      const isVariableName = param.id === "variable_name";
      let textSuggestions: Array<{ value: string; label: string }> = [];

      if (typeof param.options === "function") {
        textSuggestions = (param.options(parentValues || {}) || []).map(
          (option) => ({
            value: String(option.value),
            label: String(option.label),
          }),
        );
      } else if (Array.isArray(param.options)) {
        textSuggestions = param.options.map((option) => ({
          value: String(option.value),
          label: String(option.label),
        }));
      }

      const suggestionListId =
        textSuggestions.length > 0
          ? `rb-text-suggestions-${selectedRule.id}-${param.id}`
          : undefined;

      return (
        <div>
          <InputField
            label={String(param.label)}
            value={(value as string) || ""}
            list={suggestionListId}
            onChange={(e) => {
              const newValue = e.target.value;
              onChange({ value: newValue, valueType: "text" });

              if (isVariableName) {
                const validation = validateVariableName(newValue);
                setInputError(
                  validation.isValid ? "" : validation.error || "Invalid name",
                );
              }
            }}
            className="text-sm"
            size="sm"
            error={isVariableName ? inputError : undefined}
          />
          {suggestionListId && (
            <datalist id={suggestionListId}>
              {textSuggestions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </datalist>
          )}
          {isVariableName && inputError && (
            <div className="flex items-center gap-2 mt-1 text-balatro-red text-sm">
              <Warning className="h-4 w-4" />
              <span>{inputError}</span>
            </div>
          )}
        </div>
      );
    }

    case "checkbox": {
      const boxes = param.checkboxOptions || [];

      return (
        <div className="flex flex-col w-full select-none gap-1">
          {param.label && (
            <label className="text-zinc-200 text-sm">{param.label}</label>
          )}
          <div className="space-y-2">
            {boxes?.map((checkbox, idx) => (
              <div key={checkbox.value}>
                <Checkbox
                  id={`${param.id}-${checkbox.value}-${idx}`}
                  label={checkbox.label}
                  checked={checkbox.checked}
                  onChange={() => {
                    const index = boxes.indexOf(checkbox);
                    if (param.checkboxOptions && Array.isArray(value)) {
                      param.checkboxOptions[index].checked =
                        value[index] == true ? false : true;
                    }
                    onChange({
                      value: boxes[index].checked,
                      valueType: "checkbox",
                    });
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      );
    }

    default:
      return null;
  }
};

const Inspector: React.FC<InspectorProps> = ({
  position,
  joker,
  selectedRule,
  selectedCondition,
  selectedEffect,
  selectedRandomGroup,
  selectedLoopGroup,
  onUpdateCondition,
  onUpdateEffect,
  onUpdateRandomGroup,
  onUpdateLoopGroup,
  onUpdateJoker,
  onClose,
  onToggleVariablesPanel,
  onToggleGameVariablesPanel,
  onCreateRandomGroupFromEffect,
  onCreateLoopGroupFromEffect,
  selectedGameVariable,
  onGameVariableApplied,
  selectedItem,
  itemType,
}) => {
  const { data } = useProjectData();
  const [customMessageValidationError, setCustomMessageValidationError] =
    useState<string>("");
  const globalVariables = React.useMemo(
    () =>
      collectGlobalVariables(data, { excludeItemId: joker?.id }).map(
        (entry) => entry.variable,
      ),
    [data, joker?.id],
  );
  const scopedJoker = React.useMemo(
    () => mergeItemVariablesWithGlobals(joker, globalVariables),
    [joker, globalVariables],
  );

  const availableVariables = getNumberVariables(scopedJoker).map(
    (variable: { name: string }) => ({
      value: variable.name,
      label: variable.name,
      valueType: "user_var",
    }),
  );

  const handleCreateVariable = (name: string, initialValue: number) => {
    const validation = validateVariableName(name);

    if (!validation.isValid) {
      alert(validation.error);
      return;
    }

    const existingNames = getAllVariables(scopedJoker).map((v) =>
      v.name.toLowerCase(),
    );
    if (existingNames.includes(name.toLowerCase())) {
      alert("Variable name already exists");
      return;
    }

    const newVariable = {
      id: crypto.randomUUID(),
      name,
      initialValue,
    };

    const updatedVariables = [...(joker.userVariables || []), newVariable];
    onUpdateJoker({ userVariables: updatedVariables });
  };

  React.useEffect(() => {
    setCustomMessageValidationError("");
  }, [selectedEffect?.id]);

  React.useEffect(() => {
    if (selectedGameVariable && selectedItem) {
      if (selectedItem.type === "condition" && selectedCondition) {
        if (selectedCondition.type !== "generic_compare") {
          const valueParam = selectedCondition.params.value;
          if (valueParam !== undefined) {
            const currentValue = valueParam.value as string;
            const isAlreadyGameVar = valueParam.valueType === "game_var";
            const multiplier = isAlreadyGameVar
              ? parseFloat(currentValue.split("|")[1] || "1")
              : 1;
            const startsFrom = isAlreadyGameVar
              ? parseFloat(currentValue.split("|")[2] || "0")
              : 0;

            onUpdateCondition(selectedRule?.id || "", selectedCondition.id, {
              params: {
                ...selectedCondition.params,
                value: {
                  value: `GAMEVAR:${selectedGameVariable.id}|${multiplier}|${startsFrom}`,
                  valueType: "game_var",
                },
              },
            });
          }
          onGameVariableApplied();
        } else {
          let valueParam, item;
          if (selectedCondition.params.value1.value === 0) {
            valueParam = selectedCondition.params.value1.value;
            item = "value1";
          } else {
            valueParam = selectedCondition.params.value2.value;
            item = "value2";
          }
          if (valueParam !== undefined) {
            const currentValue = valueParam;
            const isAlreadyGameVar =
              typeof currentValue === "string" &&
              currentValue.startsWith("GAMEVAR:");
            const multiplier = isAlreadyGameVar
              ? parseFloat(currentValue.split("|")[1] || "1")
              : 1;
            const startsFrom = isAlreadyGameVar
              ? parseFloat(currentValue.split("|")[2] || "0")
              : 0;

            onUpdateCondition(selectedRule?.id || "", selectedCondition.id, {
              params: {
                ...selectedCondition.params,
                [item]: {
                  value: `GAMEVAR:${selectedGameVariable.id}|${multiplier}|${startsFrom}`,
                  valueType: "game_var",
                },
              },
            });
          }
          onGameVariableApplied();
        }
      } else if (selectedItem.type === "effect" && selectedEffect) {
        const valueParam =
          selectedEffect.params.value || selectedEffect.params.repetitions;
        if (valueParam !== undefined) {
          const currentValue = valueParam.value as string;
          const isAlreadyGameVar = valueParam.valueType === "game_var";
          const multiplier = isAlreadyGameVar
            ? parseFloat(currentValue.split("|")[1] || "1")
            : 1;
          const startsFrom = isAlreadyGameVar
            ? parseFloat(currentValue.split("|")[2] || "0")
            : 0;

          const paramKey =
            selectedEffect.params.value !== undefined ? "value" : "repetitions";
          onUpdateEffect(selectedRule?.id || "", selectedEffect.id, {
            params: {
              ...selectedEffect.params,
              [paramKey]: {
                value: `GAMEVAR:${selectedGameVariable.id}|${multiplier}|${startsFrom}`,
                valueType: "game_var",
              },
            },
          });
          onGameVariableApplied();
        }
      } else if (selectedItem.type === "randomgroup" && selectedRandomGroup) {
        onUpdateRandomGroup(selectedRule?.id || "", selectedRandomGroup.id, {
          chance_numerator: {
            value: `GAMEVAR:${selectedGameVariable.id}|1|0`,
            valueType: "game_var",
          },
        });
        onGameVariableApplied();
      } else if (selectedItem.type === "loopgroup" && selectedLoopGroup) {
        onUpdateLoopGroup(selectedRule?.id || "", selectedLoopGroup.id, {
          repetitions: {
            value: `GAMEVAR:${selectedGameVariable.id}|1|0`,
            valueType: "game_var",
          },
        });
        onGameVariableApplied();
      }
    }
  }, [
    selectedGameVariable,
    selectedItem,
    selectedCondition,
    selectedEffect,
    selectedRandomGroup,
    selectedLoopGroup,
    selectedRule?.id,
    onUpdateCondition,
    onUpdateEffect,
    onUpdateRandomGroup,
    onUpdateLoopGroup,
    onGameVariableApplied,
  ]);

  const renderTriggerInfo = () => {
    if (!selectedRule) return null;
    const trigger = getTriggerById(selectedRule.trigger);
    if (!trigger) return null;

    return (
      <div className="space-y-3">
        <div className="p-1">
          <div className="mb-2 flex items-center gap-3">
            <Eye className="h-3.5 w-3.5 text-balatro-money shrink-0" />
            <div>
              <h4 className="text-balatro-money font-semibold text-base leading-none mb-1">
                {trigger.label[itemType]}
              </h4>
              <span className="text-zinc-400 text-[11px] uppercase tracking-wide">
                Trigger Event
              </span>
            </div>
          </div>
          <p className="text-zinc-100 text-sm leading-snug">
            {trigger.description[itemType]}
          </p>
        </div>
      </div>
    );
  };

  const renderConditionEditor = () => {
    if (!selectedCondition || !selectedRule) return null;
    const conditionType = getConditionTypeById(selectedCondition.type);

    if (!conditionType) return null;
    const paramsToRender = conditionType.params.filter((param) => {
      let showing = true;
      let currentParam: ConditionParameter | undefined = param;

      while (showing && currentParam && hasShowWhen(currentParam)) {
        const { parameter, values }: ShowWhenCondition = currentParam.showWhen;
        const parentValue = selectedCondition.params[parameter].value;

        if (Array.isArray(parentValue) && typeof parentValue[0] === "boolean") {
          if (!values.some((value) => parentValue[parseFloat(value)])) {
            showing = false;
          }
        } else if (typeof parentValue === "string") {
          if (!values.includes(parentValue)) {
            showing = false;
          }
        }

        currentParam = conditionType?.params.find(
          (param) => param.id === parameter,
        );
      }
      return showing;
    });

    return (
      <div className="space-y-3">
        <div className="relative p-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() =>
                  onUpdateCondition(selectedRule.id, selectedCondition.id, {
                    negate: !selectedCondition.negate,
                  })
                }
                className={`absolute top-0 right-0 px-2 py-1 rounded-lg border transition-colors cursor-pointer z-10 inline-flex items-center gap-1 ${
                  selectedCondition.negate
                    ? "bg-balatro-red/15 border-balatro-red/60 text-balatro-red"
                    : "bg-background border-border text-muted-foreground hover:border-balatro-red/70 hover:text-balatro-red"
                }`}
                aria-label={
                  selectedCondition.negate
                    ? "Remove condition negation"
                    : "Negate condition"
                }
              >
                <Prohibit className="h-3.5 w-3.5" />
                <span className="text-[10px] uppercase tracking-wide font-semibold">
                  {selectedCondition.negate ? "Negated" : "Negate"}
                </span>
              </button>
            </TooltipTrigger>
            <TooltipContent side="left" sideOffset={8} className="text-xs">
              {selectedCondition.negate
                ? "Condition is currently negated. Click to remove NOT logic."
                : "Apply NOT logic to this condition."}
            </TooltipContent>
          </Tooltip>

          <div className="mb-2 pr-24 flex items-center gap-3">
            <Info className="h-3.5 w-3.5 text-balatro-blue shrink-0" />
            <div>
              <h4 className="text-balatro-blue font-semibold text-base leading-none mb-1">
                {conditionType.label}
              </h4>
              <span className="text-zinc-400 text-[11px] uppercase tracking-wide">
                Condition Logic
              </span>
            </div>
          </div>
          <p className="text-zinc-100 text-sm leading-snug">
            {conditionType.description}
          </p>
          <div className="mt-3 border-b border-border/70" />
        </div>

        {paramsToRender.length > 0 && (
          <div className="space-y-2">
            <h5 className="text-zinc-100 font-medium text-sm flex items-center gap-2">
              <div className="w-2 h-2 bg-balatro-blue rounded-full"></div>
              Parameters
            </h5>
            <div className="divide-y divide-border/70">
              {paramsToRender.map((param) => (
                <div key={param.id} className="py-2.5 first:pt-1 last:pb-1">
                  <ParameterField
                    param={param}
                    item={selectedCondition.params[param.id]}
                    selectedRule={selectedRule}
                    selectedCondition={selectedCondition}
                    selectedEffect={selectedEffect ?? undefined}
                    onChange={(item) => {
                      const newParams = {
                        ...selectedCondition.params,
                        [param.id]: item,
                      };
                      onUpdateCondition(selectedRule.id, selectedCondition.id, {
                        params: newParams,
                      });
                    }}
                    parentValues={selectedCondition.params}
                    availableVariables={availableVariables}
                    onCreateVariable={handleCreateVariable}
                    onOpenVariablesPanel={onToggleVariablesPanel}
                    onOpenGameVariablesPanel={onToggleGameVariablesPanel}
                    selectedGameVariable={selectedGameVariable}
                    onGameVariableApplied={onGameVariableApplied}
                    isEffect={false}
                    joker={scopedJoker}
                    itemType={itemType}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderRandomGroupEditor = () => {
    if (!selectedRandomGroup || !selectedRule) return null;

    return (
      <div className="space-y-3">
        <div className="p-1">
          <div className="flex items-center gap-3 mb-2">
            <Percent className="h-3.5 w-3.5 text-jungle-green-400 shrink-0" />
            <h4 className="text-jungle-green-400 font-semibold text-base leading-none">
              Random Group
            </h4>
            <span className="text-jungle-green-400 text-xs font-semibold">
              ({selectedRandomGroup.effects.length})
            </span>
          </div>
          <p className="text-zinc-100 text-sm leading-snug">
            Effects in this group will all be triggered together if the random
            chance succeeds.
          </p>
          <div className="mt-3 border-b border-border/70" />
        </div>

        <div className="space-y-3">
          <h5 className="text-zinc-100 font-medium text-sm flex items-center gap-2">
            <div className="w-2 h-2 bg-jungle-green-500 rounded-full"></div>
            Chance Configuration
          </h5>

          <div className="divide-y divide-border/70">
            <div className="py-2.5 first:pt-1 last:pb-1">
              <div className="max-w-60 mx-auto space-y-2">
                <ChanceInput
                  key="numerator"
                  label="Numerator"
                  value={selectedRandomGroup.chance_numerator.value}
                  onChange={(value) => {
                    onUpdateRandomGroup(
                      selectedRule.id,
                      selectedRandomGroup.id,
                      {
                        chance_numerator: value,
                      },
                    );
                  }}
                  availableVariables={availableVariables}
                  onCreateVariable={handleCreateVariable}
                  onOpenVariablesPanel={onToggleVariablesPanel}
                  onOpenGameVariablesPanel={onToggleGameVariablesPanel}
                  selectedGameVariable={selectedGameVariable}
                  onGameVariableApplied={onGameVariableApplied}
                  itemType={itemType}
                />
                <div className="border-b border-border/80" />
                <ChanceInput
                  key="denominator"
                  label="Denominator"
                  value={selectedRandomGroup.chance_denominator.value}
                  onChange={(value) => {
                    onUpdateRandomGroup(
                      selectedRule.id,
                      selectedRandomGroup.id,
                      {
                        chance_denominator: value,
                      },
                    );
                  }}
                  availableVariables={availableVariables}
                  onCreateVariable={handleCreateVariable}
                  onOpenVariablesPanel={onToggleVariablesPanel}
                  onOpenGameVariablesPanel={onToggleGameVariablesPanel}
                  selectedGameVariable={selectedGameVariable}
                  onGameVariableApplied={onGameVariableApplied}
                  itemType={itemType}
                />
              </div>
            </div>
          </div>
          <div className="space-y-3">
            <h5 className="text-zinc-100 font-medium text-sm flex items-center gap-2">
              <div className="w-2 h-2 bg-jungle-green-500 rounded-full"></div>
              Advanced Configuration
            </h5>

            <div className="divide-y divide-border/70">
              <div className="py-2.5 first:pt-1 last:pb-1">
                <div className="space-y-6 p-2">
                  <Checkbox
                    id="respect_probability_effects"
                    label="Affected by Probability Effects"
                    checked={
                      selectedRule.trigger === "change_probability"
                        ? false
                        : selectedRandomGroup.respect_probability_effects !==
                          false
                    }
                    disabled={selectedRule.trigger === "change_probability"}
                    onChange={(checked) => {
                      onUpdateRandomGroup(
                        selectedRule.id,
                        selectedRandomGroup.id,
                        {
                          respect_probability_effects: checked,
                        },
                      );
                    }}
                  />
                  <InputField
                    key="custom_key"
                    value={selectedRandomGroup.custom_key}
                    onChange={(e) => {
                      onUpdateRandomGroup(
                        selectedRule.id,
                        selectedRandomGroup.id,
                        {
                          custom_key: e.target.value,
                        },
                      );
                    }}
                    placeholder={(() => {
                      let classPrefix: string;
                      let key: string;
                      switch (itemType) {
                        case "joker":
                          classPrefix = "j";
                          key = joker.objectKey || "";
                          break;
                        case "consumable":
                          classPrefix = "c";
                          // @ts-expect-error: The inspector can take more than JokerData
                          key = joker.consumableKey || "";
                          break;
                        case "card":
                          classPrefix = "m";
                          // @ts-expect-error: The inspector can take more than JokerData
                          key = joker.sealKey || joker.enhancementKey || "";
                          break;
                        default:
                          classPrefix = "j";
                          key = joker.objectKey || "";
                      }
                      const modPrefix = getModPrefix();

                      return `${classPrefix}_${modPrefix}_${key}`;
                    })()}
                    label="Custom Probability key"
                    type="text"
                    size="sm"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderLoopGroupEditor = () => {
    if (!selectedLoopGroup || !selectedRule) return null;

    return (
      <div className="space-y-3">
        <div className="p-1">
          <div className="flex items-center gap-3 mb-2">
            <ArrowCounterClockwise className="h-3.5 w-3.5 text-balatro-blue shrink-0" />
            <h4 className="text-balatro-blue font-semibold text-base leading-none">
              Loop Group
            </h4>
            <span className="text-balatro-blue text-xs font-semibold">
              ({selectedLoopGroup.effects.length})
            </span>
          </div>
          <p className="text-zinc-100 text-sm leading-snug">
            Effects in this group will all be triggered together for the amount
            of repetitions you set.
          </p>
          <div className="mt-3 border-b border-border/70" />
        </div>

        <div className="space-y-3">
          <h5 className="text-zinc-100 font-medium text-sm flex items-center gap-2">
            <div className="w-2 h-2 bg-balatro-blue rounded-full"></div>
            Loop Configuration
          </h5>

          <div className="divide-y divide-border/70">
            <div className="py-2.5 first:pt-1 last:pb-1">
              <div className="flex flex-col items-start gap-4">
                <span className="text-zinc-100 text-sm">Loop</span>
                <ChanceInput
                  key="repetitions"
                  label=""
                  value={selectedLoopGroup.repetitions.value}
                  onChange={(value) => {
                    onUpdateLoopGroup(selectedRule.id, selectedLoopGroup.id, {
                      repetitions: value,
                    });
                  }}
                  availableVariables={availableVariables}
                  onCreateVariable={handleCreateVariable}
                  onOpenVariablesPanel={onToggleVariablesPanel}
                  onOpenGameVariablesPanel={onToggleGameVariablesPanel}
                  selectedGameVariable={selectedGameVariable}
                  onGameVariableApplied={onGameVariableApplied}
                  itemType={itemType}
                />
                <span className="text-zinc-100 text-sm">Time(s)</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderEffectEditor = () => {
    if (!selectedEffect || !selectedRule) return null;
    const effectType = getEffectTypeById(selectedEffect.type);
    if (!effectType) return null;

    const paramsToRender = effectType.params.filter((param) => {
      if (param.type == "checkbox") {
        let index = 0;
        param.checkboxOptions?.map((box) => {
          const checklist = selectedEffect.params[param.id]
            .value as Array<boolean>;
          if (checklist) {
            box.checked = !checklist[index] ? false : true;
            index += 1;
          }
        });
      }

      let showing = true;
      let currentParam: EffectParameter | undefined = param;

      while (showing && currentParam && hasShowWhen(currentParam)) {
        const { parameter, values }: ShowWhenCondition = currentParam.showWhen;
        const parentValue = selectedEffect.params[parameter].value;

        if (Array.isArray(parentValue) && typeof parentValue[0] === "boolean") {
          if (!values.some((value) => parentValue[parseFloat(value)])) {
            showing = false;
          }
        } else if (typeof parentValue === "string") {
          if (!values.includes(parentValue)) {
            showing = false;
          }
        }

        currentParam = effectType?.params.find(
          (param) => param.id === parameter,
        );
      }
      return showing;
    });

    const isInRandomGroup = selectedRule.randomGroups.some((group) =>
      group.effects.some((effect) => effect.id === selectedEffect.id),
    );
    const isInLoopGroup = selectedRule.loops.some((group) =>
      group.effects.some((effect) => effect.id === selectedEffect.id),
    );

    return (
      <div className="space-y-3">
        <div className="p-1">
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="min-w-0 flex items-center gap-2">
              <Percent className="h-3.5 w-3.5 text-balatro-green shrink-0" />
              <div>
                <h4 className="text-balatro-green font-semibold text-base leading-none mb-1">
                  {effectType.label}
                </h4>
                <span className="text-zinc-400 text-[11px] uppercase tracking-wide">
                  Effect Action
                </span>
              </div>
            </div>

            {!isInRandomGroup && !isInLoopGroup && (
              <div className="shrink-0 flex items-center gap-1.5">
                <IconButton
                  icon={ArrowCounterClockwise}
                  onClick={() =>
                    onCreateLoopGroupFromEffect(
                      selectedRule.id,
                      selectedEffect.id,
                    )
                  }
                  tooltip="Move this effect into a new loop group"
                  className="h-8 w-8 border-balatro-blue/60 text-balatro-blue bg-balatro-blue/10 hover:bg-balatro-blue/20"
                  iconClassName="h-3.5 w-3.5"
                />

                <IconButton
                  icon={Percent}
                  onClick={() =>
                    onCreateRandomGroupFromEffect(
                      selectedRule.id,
                      selectedEffect.id,
                    )
                  }
                  tooltip="Move this effect into a new random chance group"
                  className="h-8 w-8 border-jungle-green-400/60 text-jungle-green-400 bg-jungle-green-500/10 hover:bg-jungle-green-500/20"
                  iconClassName="h-3.5 w-3.5"
                />
              </div>
            )}
          </div>
          <p className="text-zinc-100 text-sm leading-snug">
            {effectType.description}
          </p>
          <div className="mt-3 border-b border-border/70" />
        </div>

        <div className="space-y-3">
          <h5 className="text-zinc-100 font-medium text-sm flex items-center gap-2">
            <div className="w-2 h-2 bg-balatro-green rounded-full"></div>
            Custom Message
          </h5>
          <div className="divide-y divide-border/70">
            <div className="py-2.5 first:pt-1 last:pb-1">
              <InputField
                label="Message"
                value={selectedEffect.customMessage || ""}
                onChange={(e) => {
                  const value = e.target.value;
                  const validation = validateCustomMessage(value);

                  if (validation.isValid) {
                    setCustomMessageValidationError("");
                  } else {
                    setCustomMessageValidationError(
                      validation.error || "Invalid message",
                    );
                  }

                  onUpdateEffect(selectedRule.id, selectedEffect.id, {
                    customMessage: value || undefined,
                  });
                }}
                placeholder="Leave blank for default message"
                size="sm"
              />
              {customMessageValidationError && (
                <div className="flex items-center gap-2 mt-1 text-balatro-red text-sm">
                  <Warning className="h-4 w-4" />
                  <span>{customMessageValidationError}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {paramsToRender.length > 0 && (
          <div className="space-y-2">
            <h5 className="text-zinc-100 font-medium text-sm flex items-center gap-2">
              <div className="w-2 h-2 bg-balatro-green rounded-full"></div>
              Parameters
            </h5>
            <div className="divide-y divide-border/70">
              {paramsToRender.map((param) => (
                <div key={param.id} className="py-2.5 first:pt-1 last:pb-1">
                  <ParameterField
                    param={param}
                    item={selectedEffect.params[param.id]}
                    selectedRule={selectedRule}
                    onChange={(item) => {
                      if (param.type == "checkbox") {
                        item.value = param.checkboxOptions?.map((box) =>
                          box.checked ? true : false,
                        );
                      }
                      const newParams = {
                        ...selectedEffect.params,
                        [param.id]: item,
                      };
                      onUpdateEffect(selectedRule.id, selectedEffect.id, {
                        params: newParams,
                      });
                    }}
                    selectedCondition={selectedCondition ?? undefined}
                    selectedEffect={selectedEffect ?? undefined}
                    parentValues={selectedEffect.params}
                    availableVariables={availableVariables}
                    onCreateVariable={handleCreateVariable}
                    onOpenVariablesPanel={onToggleVariablesPanel}
                    onOpenGameVariablesPanel={onToggleGameVariablesPanel}
                    selectedGameVariable={selectedGameVariable}
                    onGameVariableApplied={onGameVariableApplied}
                    isEffect={true}
                    joker={scopedJoker}
                    itemType={itemType}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <Panel
      id="inspector"
      position={position}
      icon={ChartPieSlice}
      title="Inspector"
      titleAccessory={<ItemTypeBadge itemType={itemType} />}
      onClose={onClose}
      closeLabel="Close Inspector"
      className="w-88 bg-card/98 border-2 border-border/90 rounded-2xl shadow-2xl max-h-[calc(100vh-5rem)] overflow-hidden"
      headerClassName="p-3 border-b border-border/90"
      contentClassName="p-3 overflow-y-auto custom-scrollbar"
    >
      <div>
        {!selectedRule && (
          <div className="flex items-center justify-center h-28 rounded-xl border border-dashed border-border/80 bg-background/50">
            <div className="text-center">
              <Info className="h-9 w-9 text-muted-foreground mx-auto mb-2 opacity-60" />
              <p className="text-muted-foreground text-sm">
                Select a rule to view its properties
              </p>
            </div>
          </div>
        )}

        {selectedRule &&
          !selectedCondition &&
          !selectedEffect &&
          !selectedRandomGroup &&
          !selectedLoopGroup &&
          renderTriggerInfo()}
        {selectedCondition && renderConditionEditor()}
        {selectedEffect && renderEffectEditor()}
        {selectedRandomGroup && renderRandomGroupEditor()}
        {selectedLoopGroup && renderLoopGroupEditor()}
      </div>
    </Panel>
  );
};

export default Inspector;
