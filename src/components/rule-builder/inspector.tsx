import React, { useState } from "react";
import type {
  Rule,
  Condition,
  Effect,
  RandomGroup,
  ConditionParameter,
  EffectParameter,
  LoopGroup,
} from "./types";
import { getModPrefix } from "@/lib/balatro/balatro-utils";
import type { JokerData } from "@/lib/core/types";
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
import { useProjectData } from "@/lib/services/storage";
import {
  collectGlobalVariables,
  mergeItemVariablesWithGlobals,
} from "@/lib/app/global-user-variables";

import {
  getTriggerById,
  getConditionTypeById,
  getEffectTypeById,
} from "./rule-catalog";
import { isParameterVisible } from "./parameter-visibility";
import { getChanceGroupOptions } from "./probability-sources";

import { Input as InputField } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SearchableSelect } from "@/components/ui/searchable-select";
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
} from "@/lib/core/validation-utils";
import { GameVariable, getGameVariableById } from "@/lib/content/game-vars";
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
import HelpTooltipIcon from "@/components/ui/help-tooltip-icon";

interface InspectorProps {
  position: { x: number; y: number };
  joker: JokerData;
  rules?: Rule[];
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
  onToggleSoundsPanel: () => void;
  onCreateRandomGroupFromEffect: (ruleId: string, effectId: string) => void;
  onCreateLoopGroupFromEffect: (ruleId: string, effectId: string) => void;
  selectedGameVariable: GameVariable | null;
  onGameVariableApplied: () => void;
  selectedItem: SelectedItem;
  linkedFieldRequest?: { parameterId: string; selectionKey: string; nonce: number; focus: boolean } | null;
  itemType: "joker" | "consumable" | "card" | "voucher" | "deck";
}

interface ParameterFieldProps {
  param: ConditionParameter | EffectParameter;
  item?: { value: unknown; valueType?: string };
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
  onOpenSoundsPanel?: () => void;
  projectSounds?: Array<{ id: string; key: string }>;
  selectedGameVariable?: GameVariable | null;
  onGameVariableApplied?: () => void;
  isEffect?: boolean;
  joker?: JokerData;
  itemType: "joker" | "consumable" | "card" | "voucher" | "deck";
}

const dedupeSelectOptions = <T extends { value: string; label: string }>(
  options: T[],
): T[] => {
  const seen = new Set<string>();
  return options.filter((option) => {
    const key = `${String(option.value)}::${option.label}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

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
        ) : isVariableMode ? (
          <div className="space-y-2 w-full">
            {availableVariables.length > 0 ? (
              <SearchableSelect
                options={availableVariables}
                value={String(actualValue ?? "")}
                onValueChange={(_, selectedOption) => onChange(selectedOption)}
                aria-label={label}
                placeholder="Select variable"
                searchPlaceholder="Search variables…"
                emptyMessage="No matching variables"
              />
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
  onOpenSoundsPanel,
  projectSounds = [],
  selectedGameVariable,
  onGameVariableApplied,
  isEffect = false,
  joker = null,
  itemType,
}) => {
  const value = item?.value;
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

  const parentObject = isEffect
    ? getEffectTypeById(selectedEffect?.type || "")
    : getConditionTypeById(selectedCondition?.type || "");
  if (!isParameterVisible(param, parentObject?.params ?? [], parentValues)) {
    return null;
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

      options = dedupeSelectOptions(options).filter(
        (option) => !option.exempt?.includes(itemType),
      );
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
      const isSoundSelector = param.id === "sound";
      if (isSoundSelector) {
        const modPrefix = getModPrefix();
        const customSoundOptions = projectSounds.map((sound) => ({
          value: `${modPrefix}_${sound.key}`,
          label: sound.key,
          valueType: "text",
        }));
        options = dedupeSelectOptions([...options, ...customSoundOptions]);
      }
      const variableOptions = options.filter((option) => option.valueType === "user_var");
      const hasOnlyVariableOptions =
        options.length === 0 ||
        options.every((option) => option.valueType === "user_var");
      const shouldRenderAddVariableButton =
        !isSoundSelector &&
        (isVariableOnlySelector || hasOnlyVariableOptions) &&
        variableOptions.length === 0;
      const shouldRenderAddSoundButton = isSoundSelector && options.length === 0;

      return (
        <div className="space-y-1">
          <label className="block text-zinc-200 text-sm">
            {String(param.label)}
          </label>
          {shouldRenderAddSoundButton ? (
            <Button
              variant="secondary"
              size="sm"
              fullWidth
              onClick={() => onOpenSoundsPanel?.()}
              icon={<Plus className="h-4 w-4" />}
              className="cursor-pointer"
            >
              Add Sound
            </Button>
          ) : shouldRenderAddVariableButton ? (
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
            <SearchableSelect
              options={options}
              value={String(value ?? "")}
              onValueChange={(_, selectedOption) => onChange(selectedOption)}
              aria-label={String(param.label)}
              placeholder="Select option"
              searchPlaceholder="Search options…"
            />
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
                  <HelpTooltipIcon content="Final value is computed as: startsFrom + (gameVariable * multiplier). Use this to set a floor before scaling begins." />
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
                  <HelpTooltipIcon content="Per-step scaling factor in the game-variable formula. Negative values invert growth direction; decimals provide gradual scaling." />
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
          ) : isVariableMode ? (
            <div className="space-y-2">
              {availableVariables && availableVariables.length > 0 ? (
                <SearchableSelect
                  options={availableVariables}
                  value={String(value ?? "")}
                  onValueChange={(_, selectedOption) => onChange(selectedOption)}
                  aria-label={String(param.label)}
                  placeholder="Select variable"
                  searchPlaceholder="Search variables…"
                  emptyMessage="No matching variables"
                />
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
  rules = [],
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
  onToggleSoundsPanel,
  onCreateRandomGroupFromEffect,
  onCreateLoopGroupFromEffect,
  selectedGameVariable,
  onGameVariableApplied,
  selectedItem,
  linkedFieldRequest,
  itemType,
}) => {
  const { data } = useProjectData();
  const contentRef = React.useRef<HTMLDivElement>(null);
  const selectedItemKey = selectedItem ? JSON.stringify([
    selectedItem.type, selectedItem.ruleId, selectedItem.itemId,
    selectedItem.randomGroupId, selectedItem.loopGroupId,
  ]) : undefined;
  const requestedFieldId = linkedFieldRequest?.selectionKey === selectedItemKey
    ? linkedFieldRequest?.parameterId : undefined;
  React.useEffect(() => {
    if (!linkedFieldRequest || !requestedFieldId) return;
    const frame = requestAnimationFrame(() => {
      const field = Array.from(contentRef.current?.querySelectorAll<HTMLElement>("[data-live-code-field]") ?? [])
        .find((element) => element.dataset.liveCodeField === linkedFieldRequest.parameterId);
      if (!field) return;
      field.scrollIntoView({ block: "nearest", inline: "nearest" });
      if (linkedFieldRequest.focus) {
        const control = field.querySelector<HTMLElement>('input:not([type="hidden"]):not([disabled]), textarea:not([disabled])')
          ?? field.querySelector<HTMLElement>('button[role="combobox"]:not([disabled])')
          ?? field.querySelector<HTMLElement>('button:not([disabled])');
        (control ?? field).focus({ preventScroll: true });
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [linkedFieldRequest, requestedFieldId]);
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
    const paramsToRender = conditionType.params.filter((param) =>
      isParameterVisible(param, conditionType.params, selectedCondition.params),
    );
    const chanceGroupId = typeof selectedCondition.params.group_id?.value === "string"
      ? selectedCondition.params.group_id.value : undefined;
    const chanceGroupOptions = selectedCondition.type === "probability_succeeded"
      ? getChanceGroupOptions(rules, chanceGroupId) : [];

    return (
      <div className="space-y-3">
        <div className="relative p-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                data-live-code-field="negate"
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
              <HelpTooltipIcon content="Only parameters whose show-when dependencies are currently satisfied are shown. Changing one parent field can reveal or hide downstream fields." />
            </h5>
            <div className="divide-y divide-border/70">
              {paramsToRender.map((param) => (
                <div key={param.id} data-live-code-field={param.id} tabIndex={-1}
                  className={`py-2.5 first:pt-1 last:pb-1 rounded-md ${requestedFieldId === param.id ? "ring-2 ring-balatro-blue/60 px-2" : ""}`}>
                  {selectedCondition.type === "probability_succeeded" && param.id === "group_id" ? (
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-zinc-100">Chance Group</label>
                      <Select
                        value={chanceGroupId || undefined}
                        onValueChange={(value) => {
                          onUpdateCondition(selectedRule.id, selectedCondition.id, {
                            params: {
                              ...selectedCondition.params,
                              group_id: { value, valueType: "text" },
                            },
                          });
                        }}
                      >
                        <SelectTrigger aria-label="Chance Group">
                          <SelectValue placeholder="Choose a chance group" />
                        </SelectTrigger>
                        <SelectContent>
                          {chanceGroupOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value} disabled={option.disabled}>
                              {option.label}
                            </SelectItem>
                          ))}
                          {!chanceGroupOptions.some((option) => !option.disabled) && (
                            <SelectItem value="no_chance_groups" disabled>No chance groups available</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : <ParameterField
                    param={param}
                    item={selectedCondition.params[param.id] ?? (
                      selectedCondition.type === "probability_succeeded"
                        ? { value: param.default, valueType: "text" } : undefined
                    )}
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
                    onOpenSoundsPanel={onToggleSoundsPanel}
                    projectSounds={data.sounds}
                    selectedGameVariable={selectedGameVariable}
                    onGameVariableApplied={onGameVariableApplied}
                    isEffect={false}
                    joker={scopedJoker}
                    itemType={itemType}
                  />}
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
            <HelpTooltipIcon content="Random group applies one roll to the whole group, not per effect. If the roll fails, all contained effects are skipped together." />
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
            <HelpTooltipIcon content="Chance is evaluated as numerator / denominator at runtime. Variable-driven values are re-read each execution, so probability can change during play." />
          </h5>

          <div className="divide-y divide-border/70">
            <div className="py-2.5 first:pt-1 last:pb-1">
              <div className="max-w-60 mx-auto space-y-2">
                <div data-live-code-field="chance_numerator" tabIndex={-1}>
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
                />
                </div>
                <div className="border-b border-border/80" />
                <div data-live-code-field="chance_denominator" tabIndex={-1}>
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
                />
                </div>
              </div>
            </div>
          </div>
          <div className="space-y-3">
            <h5 className="text-zinc-100 font-medium text-sm flex items-center gap-2">
              <div className="w-2 h-2 bg-jungle-green-500 rounded-full"></div>
              Advanced Configuration
              <HelpTooltipIcon content="These fields alter how probability integrates with external systems. `Affected by Probability Effects` can be forced off by specific triggers, and `Custom Probability key` changes where modifiers are read/written." />
            </h5>

            <div className="divide-y divide-border/70">
              <div className="py-2.5 first:pt-1 last:pb-1">
                <div className="space-y-6 p-2">
                  <div data-live-code-field="respect_probability_effects" tabIndex={-1}>
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
                  </div>
                  <div data-live-code-field="custom_key" tabIndex={-1}>
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
            <HelpTooltipIcon content="Loop repeats the full effect sequence in order. If effects mutate state, each repetition sees updated state from the previous pass." />
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
                <div data-live-code-field="repetitions" tabIndex={-1}>
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
                />
                </div>
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
    const hasMessageOptions = [
      "edit_hand_size",
      "edit_play_size",
      "edit_discard_size",
    ].includes(selectedEffect.type);
    const messageMode = selectedEffect.messageMode ??
      (selectedEffect.customMessage ? "custom" : "default");

    const paramsToRender = effectType.params.filter((param) => {
      if (param.type == "checkbox") {
        let index = 0;
        param.checkboxOptions?.map((box) => {
          const checklist = selectedEffect.params[param.id]?.value as
            | Array<boolean>
            | undefined;
          if (checklist) {
            box.checked = !checklist[index] ? false : true;
            index += 1;
          }
        });
      }

      return isParameterVisible(param, effectType.params, selectedEffect.params);
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
            {hasMessageOptions ? "Message" : "Custom Message"}
          </h5>
          <div className="divide-y divide-border/70">
            {hasMessageOptions && (
              <div data-live-code-field="messageMode" tabIndex={-1} className="py-2.5 first:pt-1 last:pb-1">
                <Select
                  value={messageMode}
                  onValueChange={(value: "default" | "custom" | "none") => {
                    setCustomMessageValidationError("");
                    onUpdateEffect(selectedRule.id, selectedEffect.id, {
                      messageMode: value,
                    });
                  }}
                >
                  <SelectTrigger aria-label="Message" size="sm" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">Default message</SelectItem>
                    <SelectItem value="custom">Custom message</SelectItem>
                    <SelectItem value="none">No message</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            {(!hasMessageOptions || messageMode === "custom") && (
              <div data-live-code-field="customMessage" tabIndex={-1} className="py-2.5 first:pt-1 last:pb-1">
                <InputField
                  label={hasMessageOptions ? "Custom message" : "Message"}
                  value={selectedEffect.customMessage || ""}
                  onChange={(e) => {
                    const value = e.target.value;
                    const validation = hasMessageOptions
                      ? value.length > 100
                        ? { isValid: false, error: "Message must be 100 characters or less" }
                        : /[\r\n]/.test(value)
                          ? { isValid: false, error: "Message cannot contain line breaks" }
                          : { isValid: true, error: undefined }
                      : validateCustomMessage(value);

                    if (validation.isValid) {
                      setCustomMessageValidationError("");
                    } else {
                      setCustomMessageValidationError(
                        validation.error || "Invalid message",
                      );
                    }

                    onUpdateEffect(selectedRule.id, selectedEffect.id, {
                      customMessage: value || undefined,
                      ...(hasMessageOptions ? { messageMode: "custom" } : {}),
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
            )}
          </div>
        </div>

        {paramsToRender.length > 0 && (
          <div className="space-y-2">
            <h5 className="text-zinc-100 font-medium text-sm flex items-center gap-2">
              <div className="w-2 h-2 bg-balatro-green rounded-full"></div>
              Parameters
              <HelpTooltipIcon content="Parameter visibility and valid value types depend on effect definition and current selections. Some fields intentionally disappear when incompatible." />
            </h5>
            <div className="divide-y divide-border/70">
              {paramsToRender.map((param) => (
                <div key={param.id} data-live-code-field={param.id} tabIndex={-1}
                  className={`py-2.5 first:pt-1 last:pb-1 rounded-md ${requestedFieldId === param.id ? "ring-2 ring-balatro-green/60 px-2" : ""}`}>
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
                      if (
                        (param.id === "consumable_type" || param.id === "set") &&
                        selectedEffect.params[param.id]?.value !== item.value &&
                        effectType.params.some(
                          (definition) =>
                            definition.id === "specific_card" &&
                            definition.optionSource === "allConsumables",
                        )
                      ) {
                        // A card from the previous set is not a valid target.
                        newParams.specific_card = { value: "random" };
                      }
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
                    onOpenSoundsPanel={onToggleSoundsPanel}
                    projectSounds={data.sounds}
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
      headerActions={
        <HelpTooltipIcon content="Inspector binds to your current canvas selection. If edits seem to affect the wrong thing, re-select the exact node/group; this panel does not auto-lock to prior selections." />
      }
      onClose={onClose}
      closeLabel="Close Inspector"
      className="rb-inspector w-88 bg-card/98 border-2 border-border/90 rounded-2xl shadow-2xl max-h-[calc(100vh-5rem)] overflow-hidden"
      headerClassName="p-3 border-b border-border/90"
      contentClassName="p-3 overflow-y-auto custom-scrollbar"
    >
      <div ref={contentRef}>
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
