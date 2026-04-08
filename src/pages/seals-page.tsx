import { useState, useCallback, useMemo } from "react";
import { GenericItemPage } from "@/components/pages/generic-item-page";
import { GenericItemCard } from "@/components/pages/generic-item-card";
import { GenericItemCardCompact } from "@/components/pages/generic-item-card-compact";
import { useProjectData, useModName } from "@/lib/storage";
import { Rule, SealData } from "@/lib/types";
import {
  PencilSimple,
  Sparkle,
  Trash,
  Image as ImageIcon,
  TextT,
  Palette,
  LockOpen,
  Lock,
  Eye,
  EyeSlash,
  Copy,
  Prohibit,
  VideoCamera,
} from "@phosphor-icons/react";
import {
  GenericItemDialog,
  DialogTab,
} from "@/components/pages/generic-item-dialog";
import { GenericDialogColorPicker } from "@/components/ui/generic-dialog-color-picker";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useConfirmDelete } from "@/hooks/use-confirm-delete";
import { BalatroCard } from "@/components/balatro/balatro-card";
import { SOUNDS } from "@/lib/balatro-utils";
import { getRandomPlaceholder } from "@/lib/placeholder-assets.ts";
import { PlaceholderPickerDialog } from "@/components/pages/placeholder-picker-dialog";
import { RuleBuilder } from "@/components/rule-builder";
import { processBalatroCardImage } from "@/lib/media/image-processing-utils";
import { ItemShowcaseDialog } from "@/components/pages/item-showcase-dialog";

export default function SealsPage() {
  const { data, updateSeals, isHydrating } = useProjectData();
  const modName = useModName();
  const [editingItem, setEditingItem] = useState<SealData | null>(null);
  const [ruleEditingItem, setRuleEditingItem] = useState<SealData | null>(null);
  const [showcaseItem, setShowcaseItem] = useState<SealData | null>(null);
  const [isPlaceholderPickerOpen, setIsPlaceholderPickerOpen] = useState(false);
  const [placeholderTargetId, setPlaceholderTargetId] = useState<string | null>(
    null,
  );

  const processSealImage = processBalatroCardImage;

  const handleUpdate = useCallback(
    (id: string, updates: Partial<SealData>) => {
      updateSeals(
        data.seals.map((s) => (s.id === id ? { ...s, ...updates } : s)),
      );
    },
    [data.seals, updateSeals],
  );

  const handleCreate = useCallback(async () => {
    const placeholder = await getRandomPlaceholder("seal");
    const newSeal: SealData = {
      id: crypto.randomUUID(),
      objectType: "seal",
      name: "New Seal",
      description: "Effect",
      image: placeholder?.src || "",
      placeholderCreditIndex: placeholder?.index,
      placeholderCategory: placeholder?.category,
      objectKey: "new_seal",
      badge_colour: "HEX",
      unlocked: true,
      discovered: true,
      rules: [],
      orderValue: data.seals.length + 1,
    };
    updateSeals([...data.seals, newSeal]);
  }, [data.seals, updateSeals]);

  const handleDelete = useCallback(
    (id: string) => updateSeals(data.seals.filter((s) => s.id !== id)),
    [data.seals, updateSeals],
  );

  const {
    isDialogOpen: isDeleteDialogOpen,
    pendingLabel: pendingDeleteLabel,
    requestDelete,
    confirmDelete,
    handleOpenChange: handleDeleteDialogChange,
  } = useConfirmDelete(handleDelete);

  const sealDialogTabs: DialogTab<SealData>[] = useMemo(
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
                processFile: processSealImage,
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
                placeholder: "Seal Name",
                className: "col-span-2",
                validate: (val) => (!val ? "Name is required" : null),
              },
              {
                id: "objectKey",
                type: "text",
                label: "Object Key",
                placeholder: "seal_name",
                className: "col-span-2",
              },
            ],
          },
          {
            id: "properties",
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
                id: "no_collection",
                type: "switch",
                label: "Hidden from Collection",
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
        id: "badge",
        label: "Badge",
        icon: Palette,
        groups: [
          {
            id: "colors",
            label: "Badge Color",
            fields: [
              {
                id: "badge_colour",
                type: "custom",
                render: (value, onChange) => (
                  <GenericDialogColorPicker
                    value={value}
                    onChange={onChange}
                    defaultColor="#000000"
                    valueMode="with-hash"
                    placeholder="#000000"
                  />
                ),
              },
            ],
          },
          {
            id: "audio",
            label: "Sound",
            className: "grid grid-cols-2 gap-4",
            fields: [
              {
                id: "sound",
                type: "select",
                label: "Sound Effect",
                options: SOUNDS().map((sound) => ({
                  value: sound.key,
                  label: sound.label,
                })),
              },
              {
                id: "pitch",
                type: "number",
                label: "Pitch",
                placeholder: "1.0",
                step: 0.1,
              },
              {
                id: "volume",
                type: "number",
                label: "Volume",
                placeholder: "1.0",
                step: 0.1,
              },
            ],
          },
        ],
      },
    ],
    [processSealImage],
  );

  const searchProps = useMemo(
    () => ({
      searchFn: (item: SealData, term: string) =>
        item.name.toLowerCase().includes(term),
    }),
    [],
  );

  const sortOptions = useMemo(
    () => [
      {
        label: "Name",
        value: "name",
        sortFn: (a: SealData, b: SealData) => a.name.localeCompare(b.name),
      },
    ],
    [],
  );

  const renderPreview = useCallback(
    (item: SealData | null) => (
      <BalatroCard
        type="card"
        data={item || {}}
        isSeal={true}
        sealBadgeColor={item?.badge_colour}
        size="lg"
      />
    ),
    [],
  );

  const renderCard = useCallback(
    (item: SealData) => (
      <GenericItemCard
        key={item.id}
        name={item.name}
        description={item.description}
        idValue={item.orderValue}
        onUpdate={(updates) => handleUpdate(item.id, updates)}
        onDuplicate={() => {
                  const duplicatedItem: SealData = {
                    ...item,
                    id: crypto.randomUUID(),
                    name: `${item.name} (Copy)`,
                    objectKey: `${item.objectKey}_copy`,
                    orderValue: data.seals.length + 1,
                  };
                  updateSeals([...data.seals, duplicatedItem]);
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
    (item: SealData) => (
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
              const duplicatedSeal: SealData = {
                ...item,
                id: crypto.randomUUID(),
                name: `${item.name} (Copy)`,
                objectKey: `${item.objectKey}_copy`,
                orderValue: data.seals.length + 1,
              };
              updateSeals([...data.seals, duplicatedSeal]);
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
    [requestDelete, data.seals, updateSeals],
  );

  return (
    <>
      <GenericItemPage<SealData>
        title="Seals"
        subtitle={modName}
        items={data.seals}
        isLoading={isHydrating}
        onAddNew={handleCreate}
        addNewLabel="Create Seal"
        searchProps={searchProps}
        sortOptions={sortOptions}
        renderCard={renderCard}
        renderCompactCard={renderCompactCard}
      />
      <GenericItemDialog
        open={!!editingItem}
        onOpenChange={(open) => !open && setEditingItem(null)}
        item={editingItem}
        title={`Edit ${editingItem?.name || "Seal"}`}
        description="Modify seal properties."
        tabs={sealDialogTabs}
        onSave={handleUpdate}
        renderPreview={renderPreview}
        showPlaceholderPicker
        placeholderCategory="seal"
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
          onUpdateItem={(updates: Partial<SealData>) => {
            handleUpdate(ruleEditingItem.id, updates as Partial<SealData>);
            setRuleEditingItem((prev) =>
              prev ? { ...prev, ...(updates as Partial<SealData>) } : prev,
            );
          }}
          itemType="card"
        />
      )}
      <PlaceholderPickerDialog
        open={isPlaceholderPickerOpen}
        onOpenChange={setIsPlaceholderPickerOpen}
        initialCategory="seal"
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
        title="Delete this seal?"
        description={
          <span>
            You are about to delete{" "}
            <span className="font-semibold text-foreground">
              {pendingDeleteLabel || "this seal"}
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
        title={showcaseItem?.name || "Seal"}
        fileNameBase={showcaseItem?.name || "seal"}
        onOpenChange={(open) => {
          if (!open) {
            setShowcaseItem(null);
          }
        }}
      >
        {showcaseItem && (
          <BalatroCard
            type="card"
            data={showcaseItem}
            isSeal={true}
            sealBadgeColor={showcaseItem.badge_colour}
            size="lg"
          />
        )}
      </ItemShowcaseDialog>
    </>
  );
}
