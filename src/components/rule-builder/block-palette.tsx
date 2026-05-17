import React, { useState, useMemo, useEffect } from "react";
import { useDraggable } from "@dnd-kit/core";
import { motion, AnimatePresence } from "framer-motion";
import type {
  Rule,
  GlobalEffectTypeDefinition,
  GlobalTriggerDefinition,
  GlobalConditionTypeDefinition,
} from "./types";
import BlockComponent from "./block-component";
import {
  Palette,
  CaretDown,
  CaretRight,
  MagnifyingGlass,
  Sparkle,
  Lightning,
  PuzzlePiece,
  Flask,
} from "@phosphor-icons/react";
import IconButton from "@/components/ui/icon-button";
import ItemTypeBadge from "./item-type-badge";
import Panel from "./panel";
import HelpTooltipIcon from "@/components/ui/help-tooltip-icon";

import {
  TRIGGER_CATEGORIES,
  getTriggers,
  CategoryDefinition,
  CONDITION_CATEGORIES,
  getConditionsForTrigger,
  EFFECT_CATEGORIES,
  getEffectsForTrigger,
} from "./rule-catalog";

interface BlockPaletteProps {
  position: { x: number; y: number };
  selectedRule: Rule | null;
  onAddTrigger: (triggerId: string) => void;
  onAddCondition: (conditionType: string) => void;
  onAddEffect: (effectType: string) => void;
  onClose: () => void;
  onPositionChange: (position: { x: number; y: number }) => void;
  itemType: "joker" | "consumable" | "card" | "voucher" | "deck";
}

type FilterType = "triggers" | "conditions" | "effects";

const PaletteDraggableBlock: React.FC<{
  blockId: string;
  blockType: "trigger" | "condition" | "effect";
  label: string;
  onClick: () => void;
}> = ({ blockId, blockType, label, onClick }) => {
  const dragId = `palette:${blockType}:${blockId}`;
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: dragId });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        zIndex: 70,
      }
    : undefined;

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <BlockComponent
        label={label}
        type={blockType}
        onClick={onClick}
        variant="palette"
        isSelected={isDragging}
      />
    </div>
  );
};

const BlockPalette: React.FC<BlockPaletteProps> = ({
  position,
  selectedRule,
  onAddTrigger,
  onAddCondition,
  onAddEffect,
  onClose,
  itemType,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(),
  );
  const [activeFilter, setActiveFilter] = useState<FilterType>(
    selectedRule ? "conditions" : "triggers",
  );
  const [previousSelectedRule, setPreviousSelectedRule] = useState<Rule | null>(
    selectedRule,
  );

  const triggers = getTriggers(itemType);

  const triggerCategories = TRIGGER_CATEGORIES;
  const conditionCategories = CONDITION_CATEGORIES;
  const effectCategories = EFFECT_CATEGORIES;

  const getConditionsForTriggerFn = getConditionsForTrigger;
  const getEffectsForTriggerFn = getEffectsForTrigger;

  useEffect(() => {
    const ruleChanged = selectedRule !== previousSelectedRule;
    const hasRuleNow = !!selectedRule;

    if (ruleChanged && hasRuleNow && activeFilter === "triggers") {
      setActiveFilter("conditions");
    }

    setPreviousSelectedRule(selectedRule);
  }, [selectedRule, previousSelectedRule, activeFilter]);

  useEffect(() => {
    setExpandedCategories(new Set());
  }, [activeFilter]);

  const availableConditions = useMemo(() => {
    return selectedRule
      ? getConditionsForTriggerFn(selectedRule.trigger, itemType)
      : [];
  }, [selectedRule, getConditionsForTriggerFn, itemType]);

  const availableEffects = useMemo(() => {
    return selectedRule
      ? getEffectsForTriggerFn(selectedRule.trigger, itemType)
      : [];
  }, [selectedRule, getEffectsForTriggerFn, itemType]);

  const categorizedItems = useMemo(() => {
    const normalizedSearch = searchTerm.toLowerCase();

    const filteredTriggers = triggers.filter(
      (trigger) =>
        trigger.label[itemType].toLowerCase().includes(normalizedSearch) ||
        trigger.description[itemType].toLowerCase().includes(normalizedSearch),
    );

    const triggersByCategory: Record<
      string,
      { category: CategoryDefinition; items: GlobalTriggerDefinition[] }
    > = {};

    triggerCategories.forEach((category) => {
      triggersByCategory[category.label] = {
        category,
        items: [],
      };
    });

    const uncategorizedCategory: CategoryDefinition = {
      label: "Other",
      icon: Sparkle,
    };
    triggersByCategory["Other"] = {
      category: uncategorizedCategory,
      items: [],
    };

    filteredTriggers.forEach((trigger) => {
      const categoryLabel = trigger.category || "Other";
      if (
        triggersByCategory[categoryLabel] &&
        trigger.objectUsers.includes(itemType)
      ) {
        triggersByCategory[categoryLabel].items.push(trigger);
      } else if (trigger.objectUsers.includes(itemType)) {
        triggersByCategory["Other"].items.push(trigger);
      }
    });

    Object.keys(triggersByCategory).forEach((categoryLabel) => {
      if (triggersByCategory[categoryLabel].items.length === 0) {
        delete triggersByCategory[categoryLabel];
      }
    });

    const filteredConditions = availableConditions.filter(
      (condition) =>
        condition.label.toLowerCase().includes(normalizedSearch) ||
        condition.description.toLowerCase().includes(normalizedSearch),
    );

    const conditionsByCategory: Record<
      string,
      { category: CategoryDefinition; items: GlobalConditionTypeDefinition[] }
    > = {};

    conditionCategories.forEach((category) => {
      conditionsByCategory[category.label] = {
        category,
        items: [],
      };
    });

    conditionsByCategory["Other"] = {
      category: uncategorizedCategory,
      items: [],
    };

    filteredConditions.forEach((condition) => {
      const categoryLabel = condition.category || "Other";
      if (conditionsByCategory[categoryLabel]) {
        conditionsByCategory[categoryLabel].items.push(condition);
      } else {
        conditionsByCategory["Other"].items.push(condition);
      }
    });

    Object.keys(conditionsByCategory).forEach((categoryLabel) => {
      if (conditionsByCategory[categoryLabel].items.length === 0) {
        delete conditionsByCategory[categoryLabel];
      }
    });

    const filteredEffects = availableEffects.filter(
      (effect) =>
        effect.label.toLowerCase().includes(normalizedSearch) ||
        effect.description.toLowerCase().includes(normalizedSearch),
    );

    const effectsByCategory: Record<
      string,
      { category: CategoryDefinition; items: GlobalEffectTypeDefinition[] }
    > = {};

    effectCategories.forEach((category) => {
      effectsByCategory[category.label] = {
        category,
        items: [],
      };
    });

    effectsByCategory["Other"] = {
      category: uncategorizedCategory,
      items: [],
    };

    filteredEffects.forEach((effect) => {
      const categoryLabel = effect.category || "Other";
      if (effectsByCategory[categoryLabel]) {
        effectsByCategory[categoryLabel].items.push(effect);
      } else {
        effectsByCategory["Other"].items.push(effect);
      }
    });

    Object.keys(effectsByCategory).forEach((categoryLabel) => {
      if (effectsByCategory[categoryLabel].items.length === 0) {
        delete effectsByCategory[categoryLabel];
      }
    });

    return {
      triggers: triggersByCategory,
      conditions: conditionsByCategory,
      effects: effectsByCategory,
    };
  }, [
    searchTerm,
    availableConditions,
    availableEffects,
    triggers,
    triggerCategories,
    conditionCategories,
    effectCategories,
    itemType,
  ]);

  useEffect(() => {
    const section =
      activeFilter === "triggers"
        ? categorizedItems.triggers
        : activeFilter === "conditions"
          ? categorizedItems.conditions
          : categorizedItems.effects;

    const total = Object.values(section).reduce(
      (sum, { items }) => sum + items.length,
      0,
    );

    if (total > 0 && total < 8) {
      const allLabels = Object.values(section).map(
        ({ category }) => category.label,
      );
      setExpandedCategories(new Set(allLabels));
    }
  }, [activeFilter, searchTerm]);

  const shouldShowSection = (sectionType: FilterType) => {
    if (!selectedRule && sectionType !== "triggers") {
      return false;
    }

    return activeFilter === sectionType;
  };

  const toggleCategory = (categoryLabel: string) => {
    setExpandedCategories((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(categoryLabel)) {
        newSet.delete(categoryLabel);
      } else {
        newSet.add(categoryLabel);
      }
      return newSet;
    });
  };

  const handleFilterToggle = (filterType: FilterType) => {
    setActiveFilter(filterType);
  };

  const getCategoryIconColor = (type: "trigger" | "condition" | "effect") => {
    if (type === "trigger") return "text-balatro-money";
    if (type === "condition") return "text-balatro-blue";
    return "text-balatro-green";
  };

  const renderCategory = (
    categoryData: {
      category: CategoryDefinition;
      items:
        | GlobalTriggerDefinition[]
        | GlobalConditionTypeDefinition[]
        | GlobalEffectTypeDefinition[];
    },
    type: "trigger" | "condition" | "effect",
    onAdd: (id: string) => void,
  ) => {
    const { category, items } = categoryData;
    const isExpanded = expandedCategories.has(category.label);
    const IconComponent = category.icon;

    const getItemName = (
      item:
        | GlobalTriggerDefinition
        | GlobalConditionTypeDefinition
        | GlobalEffectTypeDefinition,
    ): string => {
      const label = item.label;
      if (typeof label === "string") {
        return label;
      }
      if (typeof label[itemType] === "string") {
        return label[itemType];
      }
      return "";
    };

    return (
      <div key={category.label} className="mb-3">
        <button
          onClick={() => toggleCategory(category.label)}
          className="w-full flex items-center justify-between p-2 hover:bg-accent rounded-lg transition-colors cursor-pointer focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/40"
        >
          <div className="flex items-center gap-2 text-left">
            <IconComponent
              className={`h-4 w-4 shrink-0 ${getCategoryIconColor(type)}`}
            />
            <span className="text-left text-foreground text-xs font-medium tracking-wider uppercase whitespace-nowrap flex items-center gap-1">
              {category.label}
            </span>
            <span className="text-muted-foreground text-xs font-normal">
              ({items.length})
            </span>
          </div>
          {isExpanded ? (
            <CaretDown className="h-3 w-3 text-muted-foreground" />
          ) : (
            <CaretRight className="h-3 w-3 text-muted-foreground" />
          )}
        </button>

        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="mt-2 space-y-2 ml-1 mr-1">
                {items.map((item, index) => (
                  <motion.div
                    key={`${activeFilter}-${item.id}`}
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{
                      delay: index * 0.03,
                      duration: 0.15,
                      ease: "easeOut",
                    }}
                    className="px-2"
                  >
                    <PaletteDraggableBlock
                      blockId={item.id}
                      blockType={type}
                      label={getItemName(item)}
                      onClick={() => onAdd(item.id)}
                    />
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  const renderSection = (
    categorizedData: Record<
      string,
      {
        category: CategoryDefinition;
        items:
          | GlobalTriggerDefinition[]
          | GlobalConditionTypeDefinition[]
          | GlobalEffectTypeDefinition[];
      }
    >,
    type: "trigger" | "condition" | "effect",
    onAdd: (id: string) => void,
    sectionKey: FilterType,
  ) => {
    if (!shouldShowSection(sectionKey)) return null;

    const totalItems = Object.values(categorizedData).reduce(
      (sum, { items }) => sum + items.length,
      0,
    );

    if (totalItems === 0 && searchTerm) return null;

    return (
      <AnimatePresence mode="wait">
        <motion.div
          key={activeFilter}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          className="space-y-3"
        >
          {Object.values(categorizedData).map((categoryData) =>
            renderCategory(categoryData, type, onAdd),
          )}
        </motion.div>
      </AnimatePresence>
    );
  };

  return (
    <Panel
      id="blockPalette"
      position={position}
      icon={Palette}
      title="Block Palette"
      titleAccessory={<ItemTypeBadge itemType={itemType} />}
      headerActions={
        <HelpTooltipIcon content="This panel is context-sensitive: Trigger list is global, but Condition/Effect lists are recalculated from the currently selected rule's trigger. Changing selected rule can completely change what appears here." />
      }
      onClose={onClose}
      closeLabel="Close Block Palette"
      className="w-80"
      contentClassName="p-3"
    >
      <div>
        <div className="w-1/4 h-px bg-border mx-auto mb-4"></div>

        <div className="flex justify-center gap-2 mb-4">
          <IconButton
            icon={Lightning}
            onClick={() => handleFilterToggle("triggers")}
            tooltip="Show all trigger types (starting point for rule compatibility)"
            isActive={activeFilter === "triggers"}
            className={
              activeFilter === "triggers"
                ? "bg-balatro-money/22 text-balatro-money border-balatro-money/70"
                : "bg-card text-balatro-money border-balatro-money/40 hover:bg-balatro-money/15"
            }
          />
          <IconButton
            icon={Flask}
            onClick={() => handleFilterToggle("conditions")}
            tooltip="Show only conditions valid for the selected rule's trigger"
            disabled={!selectedRule}
            isActive={activeFilter === "conditions"}
            className={
              !selectedRule
                ? "bg-card text-muted-foreground border-border"
                : activeFilter === "conditions"
                  ? "bg-balatro-blue/22 text-balatro-blue border-balatro-blue/70"
                  : "bg-card text-balatro-blue border-balatro-blue/40 hover:bg-balatro-blue/15"
            }
          />
          <IconButton
            icon={PuzzlePiece}
            onClick={() => handleFilterToggle("effects")}
            tooltip="Show only effects valid for the selected rule's trigger"
            disabled={!selectedRule}
            isActive={activeFilter === "effects"}
            className={
              !selectedRule
                ? "bg-card text-muted-foreground border-border"
                : activeFilter === "effects"
                  ? "bg-balatro-green/22 text-balatro-green border-balatro-green/70"
                  : "bg-card text-balatro-green border-balatro-green/40 hover:bg-balatro-green/15"
            }
          />
        </div>

        <div className="relative mb-4">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Search Blocks
            </span>
            <HelpTooltipIcon content="Search runs only inside the active filter tab and current compatibility set. If results seem missing, switch filter or select a different rule/trigger first." />
          </div>
          <div className="relative">
            <MagnifyingGlass className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-jungle-green-400 stroke-2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search blocks..."
              className="w-full bg-background border border-border rounded-xl pl-10 pr-4 py-2 text-foreground text-sm placeholder-muted-foreground focus:outline-none focus:border-primary/50 transition-colors"
            />
          </div>
        </div>

        <div className="h-[calc(100vh-18rem)] overflow-y-auto custom-scrollbar">
          {renderSection(
            categorizedItems.triggers,
            "trigger",
            onAddTrigger,
            "triggers",
          )}

          {renderSection(
            categorizedItems.conditions,
            "condition",
            onAddCondition,
            "conditions",
          )}

          {renderSection(
            categorizedItems.effects,
            "effect",
            onAddEffect,
            "effects",
          )}
        </div>
      </div>
    </Panel>
  );
};

export default BlockPalette;
