import React, { useState, useMemo } from "react";
import {
  GAME_VARIABLE_CATEGORIES,
  GameVariable,
  GameVariableCategory,
  GameVariableSubcategory,
} from "@/lib/game-vars";
import {
  Cube,
  MagnifyingGlass,
  CaretRight,
  CaretDown,
} from "@phosphor-icons/react";
import Panel from "./panel";
import { fuzzyMatchAny, fuzzyMatch } from "@/lib/search";

interface GameVariablesProps {
  position: { x: number; y: number };
  selectedGameVariable: GameVariable | null;
  onSelectGameVariable: (variable: GameVariable) => void;
  onClose: () => void;
  onPositionChange: (position: { x: number; y: number }) => void;
}

const GameVariables: React.FC<GameVariablesProps> = ({
  position,
  onSelectGameVariable,
  onClose,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(),
  );
  const [expandedSubcategories, setExpandedSubcategories] = useState<
    Set<string>
  >(new Set());

  const filteredCategories = useMemo(() => {
    if (!searchTerm.trim()) {
      return GAME_VARIABLE_CATEGORIES;
    }

    const search = searchTerm.toLowerCase();
    return GAME_VARIABLE_CATEGORIES.map((category) => {
      const matchingVariables = category.variables.filter(
        (variable) => fuzzyMatchAny([variable.label, variable.description, variable.id], search),
      );

      const matchingSubcategories =
        category.subcategories
          ?.map((subcategory) => ({
            ...subcategory,
            variables: subcategory.variables.filter(
              (variable) =>
                fuzzyMatchAny([variable.label, variable.description, variable.id], search),
            ),
          }))
          .filter((subcategory) => subcategory.variables.length > 0) || [];

      const categoryMatches = fuzzyMatch(category.label, search);

      if (
        categoryMatches ||
        matchingVariables.length > 0 ||
        matchingSubcategories.length > 0
      ) {
        return {
          ...category,
          variables: categoryMatches ? category.variables : matchingVariables,
          subcategories: categoryMatches
            ? category.subcategories
            : matchingSubcategories,
        };
      }

      return null;
    }).filter(Boolean) as GameVariableCategory[];
  }, [searchTerm]);

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(categoryId)) {
        newSet.delete(categoryId);
      } else {
        newSet.add(categoryId);
      }
      return newSet;
    });
  };

  const toggleSubcategory = (subcategoryId: string) => {
    setExpandedSubcategories((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(subcategoryId)) {
        newSet.delete(subcategoryId);
      } else {
        newSet.add(subcategoryId);
      }
      return newSet;
    });
  };

  const handleVariableSelect = (variable: GameVariable) => {
    onSelectGameVariable(variable);
  };

  const renderVariable = (
    variable: GameVariable,
    isNested: boolean = false,
  ) => (
    <div
      key={variable.id}
      className={`p-2.5 rounded-xl bg-background/60 cursor-pointer transition-all hover:bg-accent/70 active:bg-jungle-green-500/10 ${
        isNested ? "ml-4 mr-2" : ""
      }`}
      onClick={() => handleVariableSelect(variable)}
    >
      <div className="flex items-center justify-between mb-1.5">
        <h4 className="text-foreground text-sm font-medium">
          {variable.label}
        </h4>
        <span className="text-xs px-1.5 py-0.5 bg-muted text-muted-foreground rounded uppercase tracking-wider">
          {variable.category}
        </span>
      </div>

      <p className="text-muted-foreground text-xs leading-relaxed mb-2">
        {variable.description}
      </p>
    </div>
  );

  const renderSubcategory = (
    category: GameVariableCategory,
    subcategory: GameVariableSubcategory,
  ) => {
    const subcategoryKey = `${category.id}-${subcategory.id}`;
    const isExpanded = expandedSubcategories.has(subcategoryKey);
    const hasVariables = subcategory.variables.length > 0;

    return (
      <div key={subcategoryKey} className="ml-6">
        <div
          className="flex items-center gap-2 p-2 rounded-lg cursor-pointer hover:bg-accent/60 transition-colors"
          onClick={() => hasVariables && toggleSubcategory(subcategoryKey)}
        >
          {hasVariables && (
            <>
              {isExpanded ? (
                <CaretDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <CaretRight className="h-4 w-4 text-muted-foreground" />
              )}
            </>
          )}
          <h4 className="text-foreground text-sm tracking-wide">
            {subcategory.label}
          </h4>
          <span className="text-xs text-muted-foreground">
            ({subcategory.variables.length})
          </span>
        </div>

        {isExpanded && (
          <div className="space-y-1.5 mt-2">
            {subcategory.variables.map((variable) =>
              renderVariable(variable, true),
            )}
          </div>
        )}
      </div>
    );
  };

  const renderCategory = (category: GameVariableCategory) => {
    const isExpanded = expandedCategories.has(category.id);
    const hasContent =
      category.variables.length > 0 ||
      (category.subcategories && category.subcategories.length > 0);
    const IconComponent = category.icon;

    return (
      <div
        key={category.id}
        className="border-b border-border/40 last:border-b-0"
      >
        <div
          className="flex items-center gap-3 p-3 cursor-pointer hover:bg-accent/60 transition-colors"
          onClick={() => hasContent && toggleCategory(category.id)}
        >
          {hasContent && (
            <>
              {isExpanded ? (
                <CaretDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <CaretRight className="h-4 w-4 text-muted-foreground" />
              )}
            </>
          )}
          <IconComponent className="h-5 w-5 text-jungle-green-300" />
          <h3 className="text-foreground text-sm font-medium tracking-widest flex-1">
            {category.label}
          </h3>
          <span className="text-xs text-muted-foreground">
            (
            {category.variables.length +
              (category.subcategories?.reduce(
                (acc, sub) => acc + sub.variables.length,
                0,
              ) || 0)}
            )
          </span>
        </div>

        {isExpanded && (
          <div className="pb-3">
            {category.variables.length > 0 && (
              <div className="space-y-1.5 px-3">
                {category.variables.map((variable) => renderVariable(variable))}
              </div>
            )}

            {category.subcategories && category.subcategories.length > 0 && (
              <div className="space-y-2 mt-3">
                {category.subcategories.map((subcategory) =>
                  renderSubcategory(category, subcategory),
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <Panel
      id="gameVariables"
      position={position}
      icon={Cube}
      title="Game Variables"
      onClose={onClose}
      closeLabel="Close Game Variables"
      className="w-96 select-none max-h-[70vh]"
      contentClassName="p-3 flex flex-col"
    >
      <div className="min-h-0 flex-1 flex flex-col">
        <div className="relative mb-3 shrink-0">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <MagnifyingGlass className="h-4 w-4 text-zinc-400" />
          </div>
          <input
            type="text"
            placeholder="Search variables..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-background/70 rounded-xl text-foreground placeholder-muted-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary/35 transition-colors"
          />
        </div>

        <div className="overflow-y-auto custom-scrollbar min-h-0 flex-1 -mx-3">
          {filteredCategories.length === 0 ? (
            <div className="text-center py-8 px-3">
              <div className="text-muted-foreground text-sm">
                No variables found
              </div>
              <div className="text-muted-foreground text-xs mt-1">
                Try adjusting your search terms
              </div>
            </div>
          ) : (
            <div className="space-y-0">
              {filteredCategories.map((category) => renderCategory(category))}
            </div>
          )}
        </div>
      </div>
    </Panel>
  );
};

export default GameVariables;
