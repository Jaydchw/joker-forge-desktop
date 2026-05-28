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
  DotsThree,
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
    if (
      ruleChanged &&
      !hasRuleNow &&
      (activeFilter === "conditions" || activeFilter === "effects")
    ) {
      setActiveFilter("triggers");
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

  const activeTabTone =
    activeFilter === "triggers"
      ? {
          icon: Lightning,
          tint: "text-balatro-money/25",
          border: "border-balatro-money/45",
          focus: "focus:border-balatro-money/70 focus:ring-balatro-money/20",
          iconTint: "text-balatro-money/80",
        }
      : activeFilter === "conditions"
        ? {
            icon: Flask,
            tint: "text-balatro-blue/25",
            border: "border-balatro-blue/45",
            focus: "focus:border-balatro-blue/70 focus:ring-balatro-blue/20",
            iconTint: "text-balatro-blue/80",
          }
        : {
            icon: PuzzlePiece,
            tint: "text-balatro-green/25",
            border: "border-balatro-green/45",
            focus: "focus:border-balatro-green/70 focus:ring-balatro-green/20",
            iconTint: "text-balatro-green/80",
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
      <div className="relative overflow-hidden rounded-lg">
        <div className="pointer-events-none absolute inset-0 z-0 opacity-60">
          {Array.from({ length: 18 }).map((_, index) => {
            const BackIcon = activeTabTone.icon;
            const col = index % 3;
            const row = Math.floor(index / 3);
            return (
              <motion.div
                key={`${activeFilter}-bg-${index}`}
                className="absolute"
                style={{
                  left: `${col * 36 + 4}%`,
                  top: `${row * 16 + 2}%`,
                }}
                initial={{ opacity: 0.08, y: 0 }}
                animate={{
                  opacity: [0.08, 0.16, 0.08],
                  y: [0, -3, 0],
                  rotate: [0, 3, 0],
                }}
                transition={{
                  duration: 2.2 + (index % 5) * 0.2,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: index * 0.05,
                }}
              >
                <BackIcon className={`h-8 w-8 ${activeTabTone.tint}`} />
              </motion.div>
            );
          })}
        </div>

        <div className="relative z-10">
        <div className="w-1/4 h-px bg-border mx-auto mb-4"></div>

        <div className="flex justify-center gap-2 mb-4">
          <IconButton
            icon={Lightning}
            onClick={() => handleFilterToggle("triggers")}
            tooltip="Show all trigger types (starting point for rule compatibility)"
            isActive={activeFilter === "triggers"}
            iconOnly
            iconClassName={activeFilter === "triggers" ? "h-5 w-5" : "h-4 w-4"}
            className={
              activeFilter === "triggers"
                ? "text-balatro-money !bg-balatro-money/18 rounded-lg"
                : "text-balatro-money/70 hover:text-balatro-money"
            }
          />
          <IconButton
            icon={Flask}
            onClick={() => handleFilterToggle("conditions")}
            tooltip="Show only conditions valid for the selected rule's trigger"
            disabled={!selectedRule}
            isActive={activeFilter === "conditions"}
            iconOnly
            iconClassName={activeFilter === "conditions" ? "h-5 w-5" : "h-4 w-4"}
            className={
              !selectedRule
                ? "text-muted-foreground"
                : activeFilter === "conditions"
                  ? "text-balatro-blue !bg-balatro-blue/18 rounded-lg"
                  : "text-balatro-blue/70 hover:text-balatro-blue"
            }
          />
          <IconButton
            icon={PuzzlePiece}
            onClick={() => handleFilterToggle("effects")}
            tooltip="Show only effects valid for the selected rule's trigger"
            disabled={!selectedRule}
            isActive={activeFilter === "effects"}
            iconOnly
            iconClassName={activeFilter === "effects" ? "h-5 w-5" : "h-4 w-4"}
            className={
              !selectedRule
                ? "text-muted-foreground"
                : activeFilter === "effects"
                  ? "text-balatro-green !bg-balatro-green/18 rounded-lg"
                  : "text-balatro-green/70 hover:text-balatro-green"
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
            <MagnifyingGlass
              className={`absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 stroke-2 ${activeTabTone.iconTint}`}
            />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search blocks..."
              className={`w-full bg-background/90 border rounded-xl pl-10 pr-9 py-2 text-foreground text-sm placeholder-muted-foreground focus:outline-none focus:ring-2 transition-colors ${activeTabTone.border} ${activeTabTone.focus}`}
            />
            {searchTerm ? (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                aria-label="Clear search"
              >
                <DotsThree className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        </div>

        <div className="h-[calc(100vh-22rem)] overflow-y-auto invisible-scrollbar">
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
      </div>
    </Panel>
  );
};

export default BlockPalette;
