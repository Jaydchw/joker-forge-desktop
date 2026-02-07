import { useCallback, useMemo, useState } from "react";
import { GenericItemPage } from "@/components/pages/generic-item-page";
import { GenericItemCard } from "@/components/pages/generic-item-card";
import {
  GenericItemDialog,
  DialogTab,
} from "@/components/pages/generic-item-dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useConfirmDelete } from "@/hooks/use-confirm-delete";
import { useProjectData, useModName } from "@/lib/storage";
import { EnhancementData } from "@/lib/types";
import {
  Star,
  Image as ImageIcon,
  TextT,
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
import { BalatroCard } from "@/components/balatro/balatro-card";

export default function EnhancementsPage() {
  const { data, updateEnhancements } = useProjectData();
  const modName = useModName();
  const [editingItem, setEditingItem] = useState<EnhancementData | null>(null);

  const processEnhancementImage = useCallback((file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          if (img.width === 71 && img.height === 95) {
            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d");
            canvas.width = 142;
            canvas.height = 190;
            if (ctx) {
              ctx.imageSmoothingEnabled = false;
              ctx.drawImage(img, 0, 0, 142, 190);
              resolve(canvas.toDataURL("image/png"));
            } else {
              reject(new Error("Canvas context failed"));
            }
          } else {
            resolve(e.target?.result as string);
          }
        };
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }, []);

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

  const {
    isDialogOpen: isDeleteDialogOpen,
    pendingLabel: pendingDeleteLabel,
    requestDelete,
    confirmDelete,
    handleOpenChange: handleDeleteDialogChange,
  } = useConfirmDelete(handleDelete);

  const enhancementDialogTabs: DialogTab<EnhancementData>[] = useMemo(
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
                processFile: processEnhancementImage,
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
                placeholder: "Enhancement Name",
                className: "col-span-2",
                validate: (val) => (!val ? "Name is required" : null),
              },
              {
                id: "objectKey",
                type: "text",
                label: "Object Key",
                placeholder: "m_enhancement",
                className: "col-span-2",
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
              {
                id: "any_suit",
                type: "switch",
                label: "Works with Any Suit",
              },
              {
                id: "replace_base_card",
                type: "switch",
                label: "Replaces Base Card",
              },
              {
                id: "always_scores",
                type: "switch",
                label: "Always Scores",
              },
              {
                id: "no_rank",
                type: "switch",
                label: "Remove Rank",
              },
              {
                id: "no_suit",
                type: "switch",
                label: "Remove Suit",
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
                validate: (val) => (!val ? "Description is required" : null),
              },
            ],
          },
        ],
      },
    ],
    [processEnhancementImage],
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
            onClick: () => setEditingItem(item),
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
            onClick: () => requestDelete(item.id, item.name),
          },
        ]}
      />
    ),
    [handleUpdate, requestDelete],
  );

  return (
    <>
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
      <GenericItemDialog
        open={!!editingItem}
        onOpenChange={(open) => !open && setEditingItem(null)}
        item={editingItem}
        title={`Edit ${editingItem?.name || "Enhancement"}`}
        description="Modify enhancement properties."
        tabs={enhancementDialogTabs}
        onSave={handleUpdate}
        renderPreview={(item) => (
          <BalatroCard
            type="card"
            data={item || {}}
            enhancementReplaceBase={item?.replace_base_card === true}
            size="lg"
          />
        )}
      />
      <ConfirmDialog
        open={isDeleteDialogOpen}
        onOpenChange={handleDeleteDialogChange}
        title="Delete this enhancement?"
        description={
          <span>
            You are about to delete{" "}
            <span className="font-semibold text-foreground">
              {pendingDeleteLabel || "this enhancement"}
            </span>
            . This action cannot be undone.
          </span>
        }
        confirmLabel="Delete"
        confirmVariant="destructive"
        onConfirm={confirmDelete}
      />
    </>
  );
}
