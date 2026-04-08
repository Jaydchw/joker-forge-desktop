import { useState, useCallback, useMemo } from "react";
import { GenericItemPage } from "@/components/pages/generic-item-page";
import { GenericItemCard } from "@/components/pages/generic-item-card";
import { GenericItemCardCompact } from "@/components/pages/generic-item-card-compact";
import { useProjectData, useModName } from "@/lib/storage";
import { ConsumableData, Rule } from "@/lib/types";
import {
  PencilSimple,
  Sparkle,
  Trash,
  Image as ImageIcon,
  TextT,
  LockOpen,
  Lock,
  Copy,
  Eye,
  EyeSlash,
  VideoCamera,
} from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import {
  GenericItemDialog,
  DialogTab,
} from "@/components/pages/generic-item-dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useConfirmDelete } from "@/hooks/use-confirm-delete";
import { BalatroCard } from "@/components/balatro/balatro-card";
import {
  getConsumableSetByKey,
  getConsumableSetDropdownOptions,
  getCustomConsumableSetData,
} from "@/lib/balatro-utils";
import { getRandomPlaceholder } from "@/lib/placeholder-assets.ts";
import { PlaceholderPickerDialog } from "@/components/pages/placeholder-picker-dialog";
import { RuleBuilder } from "@/components/rule-builder";
import { processBalatroCardImage } from "@/lib/media/image-processing-utils";
import { ItemShowcaseDialog } from "@/components/pages/item-showcase-dialog";

export default function ConsumablesPage() {
  const { data, updateConsumables, isHydrating } = useProjectData();
  const modName = useModName();
  const [editingItem, setEditingItem] = useState<ConsumableData | null>(null);
  const [ruleEditingItem, setRuleEditingItem] = useState<ConsumableData | null>(
    null,
  );
  const [showcaseItem, setShowcaseItem] = useState<ConsumableData | null>(null);
  const [isPlaceholderPickerOpen, setIsPlaceholderPickerOpen] = useState(false);
  const [placeholderTargetId, setPlaceholderTargetId] = useState<string | null>(
    null,
  );

  const processConsumableImage = processBalatroCardImage;

  const handleUpdate = useCallback(
    (id: string, updates: Partial<ConsumableData>) => {
      updateConsumables(
        data.consumables.map((c) => (c.id === id ? { ...c, ...updates } : c)),
      );
    },
    [data.consumables, updateConsumables],
  );

  const handleCreate = useCallback(async () => {
    const placeholder = await getRandomPlaceholder("consumable");
    const newConsumable: ConsumableData = {
      id: crypto.randomUUID(),
      objectType: "consumable",
      name: "New Tarot",
      description: "Effect",
      image: placeholder?.src || "",
      placeholderCreditIndex: placeholder?.index,
      placeholderCategory: placeholder?.category,
      orderValue: data.consumables.length + 1,
      set: "Tarot",
      cost: 3,
      unlocked: true,
      discovered: true,
      rules: [],
      objectKey: "new_tarot",
    };
    updateConsumables([...data.consumables, newConsumable]);
  }, [data.consumables, updateConsumables]);

  const handleDelete = useCallback(
    (id: string) =>
      updateConsumables(data.consumables.filter((c) => c.id !== id)),
    [data.consumables, updateConsumables],
  );

  const {
    isDialogOpen: isDeleteDialogOpen,
    pendingLabel: pendingDeleteLabel,
    requestDelete,
    confirmDelete,
    handleOpenChange: handleDeleteDialogChange,
  } = useConfirmDelete(handleDelete);

  const getCurrentSetName = useCallback(
    (setKey: string): string => {
      const set = getConsumableSetByKey(setKey, data.consumableSets);
      return set?.label || setKey;
    },
    [data.consumableSets],
  );

  const getCurrentSetColor = useCallback(
    (setKey: string): string => {
      const custom = getCustomConsumableSetData(setKey, data.consumableSets);
      if (custom?.primary_colour) {
        return custom.primary_colour.startsWith("#")
          ? custom.primary_colour
          : `#${custom.primary_colour}`;
      }
      return setKey === "Tarot"
        ? "#b26cbb"
        : setKey === "Planet"
          ? "#13afce"
          : setKey === "Spectral"
            ? "#4584fa"
            : "#666666";
    },
    [data.consumableSets],
  );

  const consumableDialogTabs: DialogTab<ConsumableData>[] = useMemo(
    () => [
      {
        id: "visual",
        label: "Visual & Data",
        icon: ImageIcon,
        groups: [
          {
            id: "assets",
            label: "Assets",
            className: "grid grid-cols-2 gap-6",
            fields: [
              {
                id: "image",
                type: "image",
                label: "Main Sprite",
                description: "71x95px (auto-upscaled) or 142x190px",
                processFile: processConsumableImage,
              },
              {
                id: "overlayImage",
                type: "image",
                label: "Overlay Sprite",
                description: "Optional overlay layer",
                processFile: processConsumableImage,
              },
            ],
          },
          {
            id: "data",
            label: "Basic Data",
            className: "grid grid-cols-2 gap-6",
            fields: [
              {
                id: "name",
                type: "text",
                label: "Name",
                placeholder: "Consumable Name",
                className: "col-span-2",
                validate: (val) => (!val ? "Name is required" : null),
              },
              {
                id: "objectKey",
                type: "text",
                label: "Object Key",
                placeholder: "c_tarot_name",
                description: "Internal ID",
                className: "col-span-2",
              },
              {
                id: "set",
                type: "select",
                label: "Set",
                options: getConsumableSetDropdownOptions(data.consumableSets),
              },
              {
                id: "cost",
                type: "number",
                label: "Cost ($)",
                min: 0,
              },
            ],
          },
          {
            id: "props",
            label: "Properties",
            fields: [
              {
                id: "unlocked",
                type: "switch",
                label: "Unlocked by Default",
              },
              {
                id: "discovered",
                type: "switch",
                label: "Discovered by Default",
              },
              {
                id: "hidden",
                type: "switch",
                label: "Hidden",
              },
              {
                id: "can_repeat_soul",
                type: "switch",
                label: "Can Repeat Soul",
              },
            ],
          },
        ],
      },
      {
        id: "description",
        label: "Description",
        icon: TextT,
        groups: [
          {
            id: "desc",
            fields: [
              {
                id: "description",
                type: "rich-textarea",
                label: "Effect Description",
                placeholder: "Description...",
                validate: (val) => (!val ? "Description is required" : null),
              },
            ],
          },
        ],
      },
    ],
    [processConsumableImage, data.consumableSets],
  );

  const searchProps = useMemo(
    () => ({
      searchFn: (item: ConsumableData, term: string) =>
        item.name.toLowerCase().includes(term),
    }),
    [],
  );

  const sortOptions = useMemo(
    () => [
      {
        label: "Set",
        value: "set",
        sortFn: (a: ConsumableData, b: ConsumableData) =>
          a.set.localeCompare(b.set),
      },
      {
        label: "Name",
        value: "name",
        sortFn: (a: ConsumableData, b: ConsumableData) =>
          a.name.localeCompare(b.name),
      },
    ],
    [],
  );

  const filterOptions = useMemo(
    () => [
      {
        id: "set",
        label: "Type",
        options: getConsumableSetDropdownOptions(data.consumableSets),
        predicate: (item: ConsumableData, val: string) =>
          String(item.set) === String(val),
      },
    ],
    [data.consumableSets],
  );

  const renderPreview = useCallback(
    (item: ConsumableData | null) => {
      if (!item) return null;
      return (
        <BalatroCard
          type="consumable"
          data={item}
          setName={getCurrentSetName(item.set)}
          setColor={getCurrentSetColor(item.set)}
        />
      );
    },
    [getCurrentSetName, getCurrentSetColor],
  );

  const renderCard = useCallback(
    (item: ConsumableData) => (
      <GenericItemCard
        key={item.id}
        name={item.name}
        description={item.description}
        cost={item.cost}
        idValue={item.orderValue}
        consumableSet={item.set}
        overlayImage={item.overlayImage}
        onUpdate={(updates) => handleUpdate(item.id, updates)}
        onDuplicate={() => {
                  const duplicatedItem: ConsumableData = {
                    ...item,
                    id: crypto.randomUUID(),
                    name: `${item.name} (Copy)`,
                    objectKey: `${item.objectKey}_copy`,
                    orderValue: data.consumables.length + 1,
                  };
                  updateConsumables([...data.consumables, duplicatedItem]);
                }}
        image={
          item.image ? (
            <img
              src={item.image}
              className="w-full h-full object-contain [image-rendering:pixelated]"
            />
          ) : (
            <div className="text-muted-foreground/30 text-xs font-bold uppercase tracking-widest border-2 border-dashed border-border p-4 rounded-lg">
              No Image
            </div>
          )
        }
        showPlaceholderPickerButton
        onOpenPlaceholderPicker={() => {
          setPlaceholderTargetId(item.id);
          setIsPlaceholderPickerOpen(true);
        }}
        badges={
          <Badge
            variant="secondary"
            className="font-bold uppercase tracking-wider"
          >
            {item.set}
          </Badge>
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
        ]}
        actions={[
          {
            id: "edit",
            label: "Edit",
            icon: <PencilSimple className="h-4 w-4" />,
            onClick: () => setEditingItem(item),
          },
          {
            id: "rules",
            label: "Rules",
            icon: <Sparkle className="h-4 w-4" />,
            badgeCount: item.rules?.length ?? 0,
            onClick: () => {
              setEditingItem(null);
              setRuleEditingItem(item);
            },
          },
          {
            id: "showcase",
            label: "Showcase",
            icon: <VideoCamera className="h-4 w-4" />,
            onClick: () => setShowcaseItem(item),
          },
          {
            id: "duplicate",
            label: "Duplicate",
            icon: <Copy className="h-5 w-5" weight="regular" />,
            onClick: () => {},
            variant: "ghost",
          },
          {
            id: "delete",
            label: "Delete",
            icon: <Trash className="h-4 w-4" />,
            variant: "destructive",
            onClick: () => requestDelete(item.id, item.name),
          },
        ]}
      />
    ),
    [handleUpdate, requestDelete],
  );

const renderCompactCard = useCallback(
    (item: ConsumableData) => (
      <GenericItemCardCompact
        name={item.name}
        overlayImage={item.overlayImage}
        image={
          item.image ? (
            <img
              src={item.image}
              className="w-full h-full object-contain [image-rendering:pixelated]"
              alt={item.name}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground/30 text-xs font-bold uppercase tracking-widest border-2 border-dashed border-border/30 rounded-xl m-2">
              No Image
            </div>
          )
        }
        actions={[
          {
            id: "edit",
            label: "Edit Info",
            icon: <PencilSimple weight="bold" />,
            onClick: () => setEditingItem(item),
            variant: "secondary",
          },
          {
            id: "rules",
            label: "Edit Rules",
            icon: <Sparkle weight="bold" />,
            onClick: () => {
              setEditingItem(null);
              setRuleEditingItem(item);
            },
            variant: "outline",
          },
          {
            id: "showcase",
            label: "Showcase",
            icon: <VideoCamera weight="regular" />,
            onClick: () => setShowcaseItem(item),
            variant: "ghost",
          },
          {
            id: "duplicate",
            label: "Duplicate",
            icon: <Copy weight="regular" />,
            onClick: () => {
              const duplicatedConsumable: ConsumableData = {
                ...item,
                id: crypto.randomUUID(),
                name: `${item.name} (Copy)`,
                objectKey: `${item.objectKey}_copy`,
                orderValue: data.consumables.length + 1,
              };
              updateConsumables([...data.consumables, duplicatedConsumable]);
            },
            variant: "ghost",
          },
          {
            id: "delete",
            label: "Delete",
            icon: <Trash weight="bold" />,
            variant: "destructive",
            onClick: () => requestDelete(item.id, item.name),
          },
        ]}
      />
    ),
    [requestDelete, data.jokers, updateConsumables],
  );

  return (
    <>
      <GenericItemPage<ConsumableData>
        title="Consumables"
        subtitle={modName}
        items={data.consumables}
        isLoading={isHydrating}
        onAddNew={handleCreate}
        addNewLabel="Create Consumable"
        searchProps={searchProps}
        sortOptions={sortOptions}
        filterOptions={filterOptions}
        renderCard={renderCard}
        renderCompactCard={renderCompactCard}
      />
      <GenericItemDialog
        open={!!editingItem}
        onOpenChange={(open) => !open && setEditingItem(null)}
        item={editingItem}
        title={`Edit ${editingItem?.name || "Consumable"}`}
        description="Modify consumable properties."
        tabs={consumableDialogTabs}
        onSave={handleUpdate}
        renderPreview={renderPreview}
        showPlaceholderPicker
        placeholderCategory="consumable"
      />
      {ruleEditingItem && (
        <RuleBuilder
          isOpen={true}
          onClose={() => setRuleEditingItem(null)}
          existingRules={ruleEditingItem.rules ?? []}
          onSave={(rules: Rule[]) =>
            handleUpdate(ruleEditingItem.id, {
              rules,
            })
          }
          item={ruleEditingItem}
          onUpdateItem={(updates: Partial<ConsumableData>) => {
            handleUpdate(
              ruleEditingItem.id,
              updates as Partial<ConsumableData>,
            );
            setRuleEditingItem((prev) =>
              prev
                ? { ...prev, ...(updates as Partial<ConsumableData>) }
                : prev,
            );
          }}
          itemType="consumable"
        />
      )}
      <PlaceholderPickerDialog
        open={isPlaceholderPickerOpen}
        onOpenChange={setIsPlaceholderPickerOpen}
        initialCategory="consumable"
        onSelect={(entry) => {
          if (!placeholderTargetId) return;
          handleUpdate(placeholderTargetId, {
            image: entry.src,
            placeholderCreditIndex: entry.index,
            placeholderCategory: entry.category,
          });
        }}
      />
      <ConfirmDialog
        open={isDeleteDialogOpen}
        onOpenChange={handleDeleteDialogChange}
        title="Delete this consumable?"
        description={
          <span>
            You are about to delete{" "}
            <span className="font-semibold text-foreground">
              {pendingDeleteLabel || "this consumable"}
            </span>
            . This action cannot be undone.
          </span>
        }
        confirmLabel="Delete"
        confirmVariant="destructive"
        onConfirm={confirmDelete}
      />

      <ItemShowcaseDialog
        open={!!showcaseItem}
        title={showcaseItem?.name || "Consumable"}
        fileNameBase={showcaseItem?.name || "consumable"}
        onOpenChange={(open) => {
          if (!open) {
            setShowcaseItem(null);
          }
        }}
      >
        {showcaseItem && (
          <BalatroCard
            type="consumable"
            data={showcaseItem}
            size="lg"
            setName={getCurrentSetName(showcaseItem.set)}
            setColor={getCurrentSetColor(showcaseItem.set)}
            showCost
          />
        )}
      </ItemShowcaseDialog>
    </>
  );
}
