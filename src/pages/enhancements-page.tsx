import { useCallback, useMemo } from "react";
import { GenericItemPage } from "@/components/pages/generic-item-page";
import { GenericItemCard } from "@/components/pages/generic-item-card";
import { useProjectData, useModName } from "@/lib/storage";
import { EnhancementData } from "@/lib/types";
import {
  Star,
  PencilSimple,
  Sparkle,
  Trash,
  LockOpen,
  Lock,
  Eye,
  EyeSlash,
  Prohibit,
  Heart,
  ShieldCheck,
  Hash,
  X,
} from "@phosphor-icons/react";
import { formatBalatroText } from "@/lib/balatro-text-formatter";

export default function EnhancementsPage() {
  const { data, updateEnhancements } = useProjectData();
  const modName = useModName();

  const handleUpdate = useCallback(
    (id: string, updates: Partial<EnhancementData>) => {
      updateEnhancements(
        data.enhancements.map((e) => (e.id === id ? { ...e, ...updates } : e)),
      );
    },
    [data.enhancements, updateEnhancements],
  );

  const handleCreate = useCallback(() => {
    const newEnhancement: EnhancementData = {
      id: crypto.randomUUID(),
      objectType: "enhancement",
      name: "New Enhancement",
      description: "Effect",
      image: "",
      objectKey: "new_enhancement",
      unlocked: true,
      discovered: true,
      rules: [],
      weight: 5,
      orderValue: data.enhancements.length + 1,
    };
    updateEnhancements([...data.enhancements, newEnhancement]);
  }, [data.enhancements, updateEnhancements]);

  const handleDelete = useCallback(
    (id: string) =>
      updateEnhancements(data.enhancements.filter((e) => e.id !== id)),
    [data.enhancements, updateEnhancements],
  );

  const searchProps = useMemo(
    () => ({
      searchFn: (item: EnhancementData, term: string) =>
        item.name.toLowerCase().includes(term),
    }),
    [],
  );

  const sortOptions = useMemo(
    () => [
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
    (item: EnhancementData) => (
      <GenericItemCard
        key={item.id}
        name={item.name}
        description={formatBalatroText(item.description)}
        idValue={item.orderValue}
        onUpdate={(updates) => handleUpdate(item.id, updates)}
        image={
          item.image ? (
            <img
              src={item.image}
              className="w-full h-full object-contain [image-rendering:pixelated]"
            />
          ) : (
            <Star className="h-20 w-20 text-muted-foreground/20" />
          )
        }
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
            onClick: () => handleUpdate(item.id, { unlocked: !item.unlocked }),
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
            onClick: () =>
              handleUpdate(item.id, { discovered: !item.discovered }),
          },
          {
            id: "no_collection",
            label: item.no_collection ? "Hidden Collection" : "In Collection",
            icon: <Prohibit className="h-4 w-4" weight="regular" />,
            isActive: item.no_collection === true,
            variant: "default",
            onClick: () =>
              handleUpdate(item.id, { no_collection: !item.no_collection }),
          },
          {
            id: "any_suit",
            label: item.any_suit ? "Any Suit" : "Suit Specific",
            icon: <Heart className="h-4 w-4" weight="regular" />,
            isActive: item.any_suit === true,
            variant: "purple",
            onClick: () => handleUpdate(item.id, { any_suit: !item.any_suit }),
          },
          {
            id: "replace_base_card",
            label: item.replace_base_card ? "Replaces Base" : "Normal Card",
            icon: <ShieldCheck className="h-4 w-4" weight="regular" />,
            isActive: item.replace_base_card === true,
            variant: "info",
            onClick: () =>
              handleUpdate(item.id, {
                replace_base_card: !item.replace_base_card,
              }),
          },
          {
            id: "no_rank",
            label: item.no_rank ? "No Rank" : "Has Rank",
            icon: <Hash className="h-4 w-4" weight="regular" />,
            isActive: item.no_rank === true,
            variant: "default",
            onClick: () => handleUpdate(item.id, { no_rank: !item.no_rank }),
          },
          {
            id: "no_suit",
            label: item.no_suit ? "No Suit" : "Has Suit",
            icon: <X className="h-4 w-4" weight="regular" />,
            isActive: item.no_suit === true,
            variant: "default",
            onClick: () => handleUpdate(item.id, { no_suit: !item.no_suit }),
          },
          {
            id: "always_scores",
            label: item.always_scores ? "Always Scores" : "Normal Scoring",
            icon: <Star className="h-4 w-4" weight="regular" />,
            isActive: item.always_scores === true,
            variant: "success",
            onClick: () =>
              handleUpdate(item.id, { always_scores: !item.always_scores }),
          },
        ]}
        actions={[
          {
            id: "edit",
            label: "Edit",
            icon: <PencilSimple className="h-4 w-4" />,
            onClick: () => {},
          },
          {
            id: "rules",
            label: "Rules",
            icon: <Sparkle className="h-4 w-4" />,
            onClick: () => {},
          },
          {
            id: "delete",
            label: "Delete",
            icon: <Trash className="h-4 w-4" />,
            variant: "destructive",
            onClick: () => handleDelete(item.id),
          },
        ]}
      />
    ),
    [handleUpdate, handleDelete],
  );

  return (
    <GenericItemPage<EnhancementData>
      title="Enhancements"
      subtitle={modName}
      items={data.enhancements}
      onAddNew={handleCreate}
      addNewLabel="Create Enhancement"
      searchProps={searchProps}
      sortOptions={sortOptions}
      renderCard={renderCard}
    />
  );
}
