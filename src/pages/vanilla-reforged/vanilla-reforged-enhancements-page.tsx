import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { GenericItemPage } from "@/components/pages/generic-item-page";
import { GenericItemCard } from "@/components/pages/generic-item-card";
import type { AceSelection } from "@/lib/balatro/card-preview-utils";
import { getItemLocVarsFromUserVariables } from "@/lib/description/description-loc-vars";
import { RuleBuilder } from "@/components/rule-builder";
import { useProjectData } from "@/lib/services/storage";
import { useVanillaReforgedData } from "@/lib/items/vanilla-reforged";
import { EnhancementData } from "@/lib/core/types";
import { fuzzyMatchAny } from "@/lib/core/search";
import { slugify } from "@/lib/balatro/balatro-utils";
import {
  Copy,
  Eye,
  EyeSlash,
  Lock,
  LockOpen,
  Prohibit,
  ShieldCheck,
  Sparkle,
  Heart,
} from "@phosphor-icons/react";

export default function VanillaReforgedEnhancementsPage() {
  const navigate = useNavigate();
  const { data: reforged, isLoading, error } = useVanillaReforgedData();
  const { data, updateEnhancements } = useProjectData();
  const [ruleViewingItem, setRuleViewingItem] =
    useState<EnhancementData | null>(null);

  const items = reforged?.enhancements ?? [];
  const subtitle = reforged?.metadata?.display_name || "Vanilla Reforged";

  const handleCopy = useCallback(
    (item: EnhancementData) => {
      const baseKey = item.objectKey || slugify(item.name);
      const duplicated: EnhancementData = {
        ...item,
        id: crypto.randomUUID(),
        name: `${item.name} (Copy)`,
        objectKey: `${baseKey}_copy`,
        orderValue: data.enhancements.length + 1,
      };
      updateEnhancements([...data.enhancements, duplicated]);
      navigate("/enhancements");
    },
    [data.enhancements, navigate, updateEnhancements],
  );

  const searchProps = useMemo(
    () => ({
      placeholder: "Search vanilla enhancements...",
      searchFn: (item: EnhancementData, term: string) =>
        fuzzyMatchAny([item.name, item.description], term),
    }),
    [],
  );

  const sortOptions = useMemo(
    () => [
      {
        label: "Order",
        value: "order",
        sortFn: (a: EnhancementData, b: EnhancementData) =>
          a.orderValue - b.orderValue,
      },
      {
        label: "Name",
        value: "name",
        sortFn: (a: EnhancementData, b: EnhancementData) =>
          a.name.localeCompare(b.name),
      },
    ],
    [],
  );

  const renderCard = useCallback(
    (
      item: EnhancementData,
      context: { selectedAce: AceSelection },
    ) => (
      <GenericItemCard
        key={item.id}
        reforged
        name={item.name}
        description={item.description}
        locVars={getItemLocVarsFromUserVariables(item)}
        idValue={item.orderValue}
        onUpdate={() => {}}
        image={
          item.image ? (
            <img
              src={item.image}
              className="w-full h-full object-contain [image-rendering:pixelated]"
              alt={item.name}
            />
          ) : (
            <div className="text-muted-foreground/30 text-xs font-bold uppercase tracking-widest border-2 border-dashed border-border p-4 rounded-lg">
              No Image
            </div>
          )
        }
        cardPreview={{
          type: "enhancement",
          selectedAce: context.selectedAce,
          replaceBaseCard: item.replace_base_card === true,
        }}
        properties={[
          {
            id: "unlocked",
            label: item.unlocked ? "Unlocked" : "Locked",
            icon: item.unlocked ? (
              <LockOpen className="h-4 w-4" weight="regular" />
            ) : (
              <Lock className="h-4 w-4" weight="regular" />
            ),
            isActive: item.unlocked ?? true,
            variant: "warning",
            onClick: () => {},
          },
          {
            id: "discovered",
            label: item.discovered ? "Discovered" : "Hidden",
            icon: item.discovered ? (
              <Eye className="h-4 w-4" weight="regular" />
            ) : (
              <EyeSlash className="h-4 w-4" weight="regular" />
            ),
            isActive: item.discovered ?? true,
            variant: "info",
            onClick: () => {},
          },
          {
            id: "no_collection",
            label: item.no_collection ? "Hidden Collection" : "In Collection",
            icon: <Prohibit className="h-4 w-4" weight="regular" />,
            isActive: item.no_collection === true,
            variant: "default",
            onClick: () => {},
          },
          {
            id: "any_suit",
            label: item.any_suit ? "Any Suit" : "Suit Specific",
            icon: <Heart className="h-4 w-4" weight="regular" />,
            isActive: item.any_suit === true,
            variant: "purple",
            onClick: () => {},
          },
          {
            id: "replace_base_card",
            label: item.replace_base_card ? "Replaces Base" : "Normal Card",
            icon: <ShieldCheck className="h-4 w-4" weight="regular" />,
            isActive: item.replace_base_card === true,
            variant: "info",
            onClick: () => {},
          },
        ]}
        actions={[
          {
            id: "rules",
            label: "View Rules",
            icon: <Sparkle className="h-4 w-4" />,
            badgeCount: item.rules?.length ?? 0,
            variant: "outline",
            onClick: () => setRuleViewingItem(item),
          },
          {
            id: "duplicate",
            label: "Copy to Project",
            icon: <Copy className="h-4 w-4" />,
            onClick: () => handleCopy(item),
          },
        ]}
      />
    ),
    [handleCopy],
  );

  if (error) {
    return (
      <div className="max-w-7xl mx-auto pb-20 text-destructive">{error}</div>
    );
  }

  return (
    <>
      <GenericItemPage<EnhancementData>
        isLoading={isLoading}
        title="Vanilla Enhancements"
        subtitle={subtitle}
        items={items}
        searchProps={searchProps}
        sortOptions={sortOptions}
        renderCard={renderCard}
        reforged
        aceSelectorMode="enhancement"
      />
      {ruleViewingItem && (
        <RuleBuilder
          isOpen={true}
          onClose={() => setRuleViewingItem(null)}
          existingRules={ruleViewingItem.rules ?? []}
          onSave={() => {}}
          item={ruleViewingItem}
          onUpdateItem={() => {}}
          itemType="card"
          reforged
        />
      )}
    </>
  );
}



