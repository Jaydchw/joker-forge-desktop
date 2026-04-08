import { useCallback, useMemo, useState } from "react";
import { GenericItemPage } from "@/components/pages/generic-item-page";
import { GenericItemCard } from "@/components/pages/generic-item-card";
import { GenericItemCardCompact } from "@/components/pages/generic-item-card-compact";
import {
  GenericItemDialog,
  DialogTab,
} from "@/components/pages/generic-item-dialog";
import { GenericDialogColorPicker } from "@/components/ui/generic-dialog-color-picker";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useConfirmDelete } from "@/hooks/use-confirm-delete";
import { useProjectData, useModName } from "@/lib/storage";
import { BoosterData } from "@/lib/types";
import {
  PencilSimple,
  Trash,
  Eye,
  EyeSlash,
  Hand,
  Play,
  Image as ImageIcon,
  TextT,
  Gear,
  Copy,
  VideoCamera,
} from "@phosphor-icons/react";
import { BalatroCard } from "@/components/balatro/balatro-card";
import { getRandomPlaceholder } from "@/lib/placeholder-assets.ts";
import { PlaceholderPickerDialog } from "@/components/pages/placeholder-picker-dialog";
import { processBalatroCardImage } from "@/lib/media/image-processing-utils";
import { ItemShowcaseDialog } from "@/components/pages/item-showcase-dialog";

export default function BoostersPage() {
  const { data, updateBoosters, isHydrating } = useProjectData();
  const modName = useModName();
  const [editingItem, setEditingItem] = useState<BoosterData | null>(null);
  const [showcaseItem, setShowcaseItem] = useState<BoosterData | null>(null);
  const [isPlaceholderPickerOpen, setIsPlaceholderPickerOpen] = useState(false);
  const [placeholderTargetId, setPlaceholderTargetId] = useState<string | null>(
    null,
  );

  const processBoosterImage = processBalatroCardImage;

  const handleUpdate = useCallback(
    (id: string, updates: Partial<BoosterData>) => {
      updateBoosters(
        data.boosters.map((b) => (b.id === id ? { ...b, ...updates } : b)),
      );
    },
    [data.boosters, updateBoosters],
  );

  const handleCreate = useCallback(async () => {
    const placeholder = await getRandomPlaceholder("booster");
    const newBooster: BoosterData = {
      id: crypto.randomUUID(),
      objectType: "booster",
      name: "Standard Pack",
      description: "Choose 1 of 3",
      orderValue: data.boosters.length + 1,
      image: placeholder?.src || "",
      placeholderCreditIndex: placeholder?.index,
      placeholderCategory: placeholder?.category,
      cost: 4,
      weight: 1,
      draw_hand: true,
      instant_use: false,
      booster_type: "joker",
      config: { extra: 3, choose: 1 },
      card_rules: [],
      discovered: true,
      unlocked: true,
      objectKey: "new_pack",
    };
    updateBoosters([...data.boosters, newBooster]);
  }, [data.boosters, updateBoosters]);

  const handleDelete = useCallback(
    (id: string) => updateBoosters(data.boosters.filter((b) => b.id !== id)),
    [data.boosters, updateBoosters],
  );

  const {
    isDialogOpen: isDeleteDialogOpen,
    pendingLabel: pendingDeleteLabel,
    requestDelete,
    confirmDelete,
    handleOpenChange: handleDeleteDialogChange,
  } = useConfirmDelete(handleDelete);

  const boosterDialogTabs: DialogTab<BoosterData>[] = useMemo(
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
                processFile: processBoosterImage,
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
                placeholder: "Booster Name",
                className: "col-span-2",
                validate: (val) => (!val ? "Name is required" : null),
              },
              {
                id: "objectKey",
                type: "text",
                label: "Object Key",
                placeholder: "p_pack",
                className: "col-span-2",
              },
              {
                id: "booster_type",
                type: "select",
                label: "Booster Type",
                options: [
                  { value: "joker", label: "Joker Pack" },
                  { value: "consumable", label: "Consumable Pack" },
                  { value: "playing_card", label: "Playing Card Pack" },
                  { value: "voucher", label: "Voucher Pack" },
                ],
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
            id: "config",
            label: "Pack Settings",
            className: "grid grid-cols-2 gap-6",
            fields: [
              {
                id: "weight",
                type: "number",
                label: "Weight",
                min: 0,
                step: 0.05,
              },
              {
                id: "config.extra",
                type: "number",
                label: "Cards in Pack",
                min: 0,
              },
              {
                id: "config.choose",
                type: "number",
                label: "Cards to Choose",
                min: 0,
              },
            ],
          },
          {
            id: "props",
            label: "Properties",
            className: "grid grid-cols-2 gap-6",
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
                id: "draw_hand",
                type: "switch",
                label: "Draw to Hand",
              },
              {
                id: "instant_use",
                type: "switch",
                label: "Instant Use",
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
                label: "Description",
                validate: (val) => (!val ? "Description is required" : null),
              },
            ],
          },
        ],
      },
      {
        id: "advanced",
        label: "Advanced",
        icon: Gear,
        groups: [
          {
            id: "advanced_fields",
            label: "Advanced Settings",
            className: "grid grid-cols-2 gap-6",
            fields: [
              {
                id: "kind",
                type: "text",
                label: "Kind",
                placeholder: "e.g. Ephemeral",
              },
              {
                id: "group_key",
                type: "text",
                label: "Group Key",
                placeholder: "k_booster_group_mystical",
              },
              {
                id: "hidden",
                type: "switch",
                label: "Hidden from Collection",
              },
            ],
          },
          {
            id: "colors",
            label: "Pack Colors",
            fields: [
              {
                id: "background_colour",
                type: "custom",
                label: "Background Color",
                render: (value, onChange) => (
                  <GenericDialogColorPicker
                    value={value}
                    onChange={onChange}
                    defaultColor="#666666"
                    valueMode="without-hash"
                    placeholder="#666666"
                  />
                ),
              },
              {
                id: "special_colour",
                type: "custom",
                label: "Special Color",
                render: (value, onChange) => (
                  <GenericDialogColorPicker
                    value={value}
                    onChange={onChange}
                    defaultColor="#666666"
                    valueMode="without-hash"
                    placeholder="#666666"
                  />
                ),
              },
            ],
          },
        ],
      },
    ],
    [processBoosterImage],
  );

  const searchProps = useMemo(
    () => ({
      searchFn: (item: BoosterData, term: string) =>
        item.name.toLowerCase().includes(term),
    }),
    [],
  );

  const sortOptions = useMemo(
    () => [
      {
        label: "Name",
        value: "name",
        sortFn: (a: BoosterData, b: BoosterData) =>
          a.name.localeCompare(b.name),
      },
      {
        label: "Cost",
        value: "cost",
        sortFn: (a: BoosterData, b: BoosterData) => a.cost - b.cost,
      },
    ],
    [],
  );

  const renderCard = useCallback(
    (item: BoosterData) => (
      <GenericItemCard
        key={item.id}
        name={item.name}
        description={item.description}
        cost={item.cost}
        idValue={item.orderValue}
        onUpdate={(updates) => handleUpdate(item.id, updates)}
        onDuplicate={() => {
                  const duplicatedItem: BoosterData = {
                    ...item,
                    id: crypto.randomUUID(),
                    name: `${item.name} (Copy)`,
                    objectKey: `${item.objectKey}_copy`,
                    orderValue: data.boosters.length + 1,
                  };
                  updateBoosters([...data.boosters, duplicatedItem]);
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
        properties={[
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
            id: "draw_hand",
            label: item.draw_hand ? "Draws to Hand" : "Opens Normally",
            icon: <Hand className="h-4 w-4" weight="regular" />,
            isActive: item.draw_hand === true,
            variant: "success",
            onClick: () =>
              handleUpdate(item.id, { draw_hand: !item.draw_hand }),
          },
          {
            id: "instant_use",
            label: item.instant_use ? "Instant Use" : "Adds to Hand",
            icon: <Play className="h-4 w-4" weight="regular" />,
            isActive: item.instant_use === true,
            variant: "success",
            onClick: () =>
              handleUpdate(item.id, { instant_use: !item.instant_use }),
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
            id: "showcase",
            label: "Showcase",
            icon: <VideoCamera className="h-4 w-4" />,
            onClick: () => setShowcaseItem(item),
          },
          {
            id: "duplicate",
            label: "Duplicate",
            icon: <Copy className="h-5 w-5" weight="regular" />,
            onClick: () => { },
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
    (item: BoosterData) => (
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
            label: "Edit",
            icon: <PencilSimple className="h-4 w-4" />,
            onClick: () => setEditingItem(item),
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
              const duplicatedBooster: BoosterData = {
                ...item,
                id: crypto.randomUUID(),
                name: `${item.name} (Copy)`,
                objectKey: `${item.objectKey}_copy`,
                orderValue: data.boosters.length + 1,
              };
              updateBoosters([...data.boosters, duplicatedBooster]);
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
    [requestDelete, data.boosters, updateBoosters],
  );

  return (
    <>
      <GenericItemPage<BoosterData>
        title="Boosters"
        subtitle={modName}
        items={data.boosters}
        isLoading={isHydrating}
        onAddNew={handleCreate}
        addNewLabel="Create Pack"
        searchProps={searchProps}
        sortOptions={sortOptions}
        renderCard={renderCard}
        renderCompactCard={renderCompactCard}
      />
      <GenericItemDialog
        open={!!editingItem}
        onOpenChange={(open) => !open && setEditingItem(null)}
        item={editingItem}
        title={`Edit ${editingItem?.name || "Booster"}`}
        description="Modify booster properties."
        tabs={boosterDialogTabs}
        onSave={handleUpdate}
        showPlaceholderPicker
        placeholderCategory="booster"
        renderPreview={(item) => (
          <BalatroCard type="booster" data={item || {}} size="lg" />
        )}
      />
      <PlaceholderPickerDialog
        open={isPlaceholderPickerOpen}
        onOpenChange={setIsPlaceholderPickerOpen}
        initialCategory="booster"
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
        title="Delete this booster?"
        description={
          <span>
            You are about to delete{" "}
            <span className="font-semibold text-foreground">
              {pendingDeleteLabel || "this booster"}
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
        title={showcaseItem?.name || "Booster"}
        fileNameBase={showcaseItem?.name || "booster"}
        onOpenChange={(open) => {
          if (!open) {
            setShowcaseItem(null);
          }
        }}
      >
        {showcaseItem && (
          <BalatroCard type="booster" data={showcaseItem} size="lg" showCost />
        )}
      </ItemShowcaseDialog>
    </>
  );
}
