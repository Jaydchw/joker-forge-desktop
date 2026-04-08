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
import { EditionData, Rule } from "@/lib/types";
import {
  Palette,
  Image as ImageIcon,
  TextT,
  Gear,
  PencilSimple,
  Sparkle,
  Trash,
  LockOpen,
  Lock,
  Eye,
  EyeSlash,
  Copy,
  Prohibit,
  ShoppingBag,
  VideoCamera,
} from "@phosphor-icons/react";
import { BalatroCard } from "@/components/balatro/balatro-card";
import { CUSTOM_SHADERS, SOUNDS, VANILLA_SHADERS } from "@/lib/balatro-utils";
import { RuleBuilder } from "@/components/rule-builder";
import { ItemShowcaseDialog } from "@/components/pages/item-showcase-dialog";

export default function EditionsPage() {
  const { data, updateEditions, isHydrating } = useProjectData();
  const modName = useModName();
  const [editingItem, setEditingItem] = useState<EditionData | null>(null);
  const [ruleEditingItem, setRuleEditingItem] = useState<EditionData | null>(
    null,
  );
  const [showcaseItem, setShowcaseItem] = useState<EditionData | null>(null);

  const handleUpdate = useCallback(
    (id: string, updates: Partial<EditionData>) => {
      updateEditions(
        data.editions.map((e) =>
          e.id === id
            ? {
                ...e,
                ...updates,
                shader: updates.shader === "" ? false : updates.shader,
              }
            : e,
        ),
      );
    },
    [data.editions, updateEditions],
  );

  const handleCreate = useCallback(() => {
    const newEdition: EditionData = {
      id: crypto.randomUUID(),
      objectType: "edition",
      name: "New Edition",
      description: "Effect",
      objectKey: "new_edition",
      unlocked: true,
      discovered: true,
      rules: [],
      weight: 10,
      sound: "",
      orderValue: data.editions.length + 1,
      image: "",
    };
    updateEditions([...data.editions, newEdition]);
  }, [data.editions, updateEditions]);

  const handleDelete = useCallback(
    (id: string) => updateEditions(data.editions.filter((e) => e.id !== id)),
    [data.editions, updateEditions],
  );

  const {
    isDialogOpen: isDeleteDialogOpen,
    pendingLabel: pendingDeleteLabel,
    requestDelete,
    confirmDelete,
    handleOpenChange: handleDeleteDialogChange,
  } = useConfirmDelete(handleDelete);

  const editionDialogTabs: DialogTab<EditionData>[] = useMemo(
    () => [
      {
        id: "properties",
        label: "Properties",
        icon: ImageIcon,
        groups: [
          {
            id: "basic",
            label: "Basic Data",
            className: "grid grid-cols-2 gap-6",
            fields: [
              {
                id: "name",
                type: "text",
                label: "Name",
                placeholder: "Edition Name",
                className: "col-span-2",
                validate: (val) => (!val ? "Name is required" : null),
              },
              {
                id: "objectKey",
                type: "text",
                label: "Object Key",
                placeholder: "e_edition",
                className: "col-span-2",
              },
              {
                id: "shader",
                type: "select",
                label: "Shader",
                options: [
                  { value: "", label: "None" },
                  ...VANILLA_SHADERS.map((shader) => ({
                    value: shader.key,
                    label: shader.label,
                  })),
                  ...CUSTOM_SHADERS.map((shader) => ({
                    value: shader.key,
                    label: shader.label,
                  })),
                ],
              },
              {
                id: "extra_cost",
                type: "number",
                label: "Extra Cost",
                min: 0,
              },
            ],
          },
          {
            id: "weight",
            label: "Appearance Weight",
            fields: [
              {
                id: "weight",
                type: "custom",
                render: (value, onChange) => (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min={0}
                        max={20}
                        step={0.25}
                        value={typeof value === "number" ? value : 0}
                        onChange={(e) => onChange(parseFloat(e.target.value))}
                        className="flex-1 h-2 bg-muted rounded appearance-none cursor-pointer"
                      />
                      <input
                        type="number"
                        min={0}
                        max={20}
                        step={0.25}
                        value={typeof value === "number" ? value : 0}
                        onChange={(e) =>
                          onChange(parseFloat(e.target.value) || 0)
                        }
                        className="w-20 h-9 px-2 rounded border bg-background text-sm"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Higher values appear more frequently.
                    </p>
                  </div>
                ),
              },
            ],
          },
          {
            id: "flags",
            label: "State",
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
              {
                id: "in_shop",
                type: "switch",
                label: "Appears in Shop",
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
            id: "shader_flags",
            label: "Shader Options",
            className: "grid grid-cols-2 gap-6",
            fields: [
              {
                id: "apply_to_float",
                type: "switch",
                label: "Apply to Floating Sprites",
              },
              {
                id: "disable_shadow",
                type: "switch",
                label: "Disable Shadow",
              },
              {
                id: "disable_base_shader",
                type: "switch",
                label: "Disable Base Shader",
              },
            ],
          },
          {
            id: "badge",
            label: "Badge Color",
            fields: [
              {
                id: "badge_colour",
                type: "custom",
                render: (value, onChange) => (
                  <GenericDialogColorPicker
                    value={value}
                    onChange={onChange}
                    defaultColor="#FFAA00"
                    valueMode="with-hash"
                    placeholder="#FFAA00"
                  />
                ),
              },
            ],
          },
          {
            id: "sound",
            label: "Sound",
            className: "grid grid-cols-2 gap-6",
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
                step: 0.1,
              },
              {
                id: "volume",
                type: "number",
                label: "Volume",
                step: 0.1,
              },
            ],
          },
        ],
      },
    ],
    [],
  );

  const searchProps = useMemo(
    () => ({
      searchFn: (item: EditionData, term: string) =>
        item.name.toLowerCase().includes(term),
    }),
    [],
  );

  const sortOptions = useMemo(
    () => [
      {
        label: "Name",
        value: "name",
        sortFn: (a: EditionData, b: EditionData) =>
          a.name.localeCompare(b.name),
      },
    ],
    [],
  );

  const renderCard = useCallback(
    (item: EditionData) => (
      <GenericItemCard
        key={item.id}
        name={item.name}
        description={item.description}
        idValue={item.orderValue}
        onUpdate={(updates) => handleUpdate(item.id, updates)}
        onDuplicate={() => {
                  const duplicatedItem: EditionData = {
                    ...item,
                    id: crypto.randomUUID(),
                    name: `${item.name} (Copy)`,
                    objectKey: `${item.objectKey}_copy`,
                    orderValue: data.editions.length + 1,
                  };
                  updateEditions([...data.editions, duplicatedItem]);
                }}
        image={<Palette className="h-20 w-20 text-muted-foreground/20" />}
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
            id: "in_shop",
            label: item.in_shop ? "In Shop" : "Not in Shop",
            icon: <ShoppingBag className="h-4 w-4" weight="regular" />,
            isActive: item.in_shop === true,
            variant: "success",
            onClick: () => handleUpdate(item.id, { in_shop: !item.in_shop }),
          },
          {
            id: "shader",
            label: item.shader ? "Shader" : "No Shader",
            icon: <Sparkle className="h-4 w-4" weight="regular" />,
            isActive: !!item.shader,
            variant: "purple",
            onClick: () => {},
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
    (item: EditionData) => (
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
              const duplicatedEdition: EditionData = {
                ...item,
                id: crypto.randomUUID(),
                name: `${item.name} (Copy)`,
                objectKey: `${item.objectKey}_copy`,
                orderValue: data.editions.length + 1,
              };
              updateEditions([...data.editions, duplicatedEdition]);
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
    [requestDelete, data.editions, updateEditions],
  );

  return (
    <>
      <GenericItemPage<EditionData>
        title="Editions"
        subtitle={modName}
        items={data.editions}
        isLoading={isHydrating}
        onAddNew={handleCreate}
        addNewLabel="Create Edition"
        searchProps={searchProps}
        sortOptions={sortOptions}
        renderCard={renderCard}
        renderCompactCard={renderCompactCard}
      />
      <GenericItemDialog
        open={!!editingItem}
        onOpenChange={(open) => !open && setEditingItem(null)}
        item={editingItem}
        title={`Edit ${editingItem?.name || "Edition"}`}
        description="Modify edition properties."
        tabs={editionDialogTabs}
        onSave={handleUpdate}
        renderPreview={(item) => (
          <BalatroCard
            type="edition"
            data={{
              ...item,
              shader: item?.shader === "" ? undefined : item?.shader,
            }}
            editionBadgeColor={item?.badge_colour}
            size="lg"
          />
        )}
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
          onUpdateItem={(updates: Partial<EditionData>) => {
            handleUpdate(ruleEditingItem.id, updates as Partial<EditionData>);
            setRuleEditingItem((prev) =>
              prev ? { ...prev, ...updates } : prev,
            );
          }}
          itemType="card"
        />
      )}
      <ConfirmDialog
        open={isDeleteDialogOpen}
        onOpenChange={handleDeleteDialogChange}
        title="Delete this edition?"
        description={
          <span>
            You are about to delete{" "}
            <span className="font-semibold text-foreground">
              {pendingDeleteLabel || "this edition"}
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
        title={showcaseItem?.name || "Edition"}
        fileNameBase={showcaseItem?.name || "edition"}
        onOpenChange={(open) => {
          if (!open) {
            setShowcaseItem(null);
          }
        }}
      >
        {showcaseItem && (
          <BalatroCard
            type="edition"
            data={{
              ...showcaseItem,
              shader:
                showcaseItem.shader === "" ? undefined : showcaseItem.shader,
            }}
            editionBadgeColor={showcaseItem.badge_colour}
            size="lg"
          />
        )}
      </ItemShowcaseDialog>
    </>
  );
}
