import { useState, useCallback, useMemo } from "react";
import { GenericItemPage } from "@/components/pages/generic-item-page";
import { GenericItemCard } from "@/components/pages/generic-item-card";
import { useProjectData, useModName } from "@/lib/storage";
import { SealData } from "@/lib/types";
import {
  Stamp,
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
  Prohibit,
} from "@phosphor-icons/react";
import { formatBalatroText } from "@/lib/balatro-text-formatter";
import {
  GenericItemDialog,
  DialogTab,
} from "@/components/pages/generic-item-dialog";
import { BalatroCard } from "@/components/balatro/balatro-card";
import { SOUNDS } from "@/lib/balatro-utils";

export default function SealsPage() {
  const { data, updateSeals } = useProjectData();
  const modName = useModName();
  const [editingItem, setEditingItem] = useState<SealData | null>(null);

  const processSealImage = useCallback((file: File): Promise<string> => {
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
    (id: string, updates: Partial<SealData>) => {
      updateSeals(
        data.seals.map((s) => (s.id === id ? { ...s, ...updates } : s)),
      );
    },
    [data.seals, updateSeals],
  );

  const handleCreate = useCallback(() => {
    const newSeal: SealData = {
      id: crypto.randomUUID(),
      objectType: "seal",
      name: "New Seal",
      description: "Effect",
      image: "",
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
                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <input
                        type="color"
                        value={value || "#000000"}
                        onChange={(e) => onChange(e.target.value)}
                        className="w-16 h-16 rounded-lg border-2 border-border cursor-pointer"
                      />
                      <input
                        type="text"
                        value={value || "#000000"}
                        onChange={(e) => onChange(e.target.value)}
                        className="flex-1 h-10 px-3 rounded border bg-background"
                        placeholder="#000000"
                      />
                    </div>
                    <div className="grid grid-cols-8 gap-2">
                      {[
                        "#FF6B6B",
                        "#4ECDC4",
                        "#45B7D1",
                        "#96CEB4",
                        "#FFEAA7",
                        "#DDA0DD",
                        "#FFB347",
                        "#FF69B4",
                        "#87CEEB",
                        "#98FB98",
                        "#F0E68C",
                        "#DEB887",
                        "#FF4500",
                        "#32CD32",
                        "#1E90FF",
                        "#FF1493",
                        "#FFD700",
                        "#8A2BE2",
                        "#DC143C",
                        "#00CED1",
                        "#FF6347",
                        "#40E0D0",
                        "#EE82EE",
                        "#90EE90",
                      ].map((color) => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => onChange(color)}
                          className="w-8 h-8 rounded border-2 border-border hover:scale-110 transition-transform"
                          style={{ backgroundColor: color }}
                          title={color}
                        />
                      ))}
                    </div>
                  </div>
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
            <Stamp className="h-20 w-20 text-muted-foreground/20" />
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
            onClick: () => handleDelete(item.id),
          },
        ]}
      />
    ),
    [handleUpdate, handleDelete],
  );

  return (
    <>
      <GenericItemPage<SealData>
        title="Seals"
        subtitle={modName}
        items={data.seals}
        onAddNew={handleCreate}
        addNewLabel="Create Seal"
        searchProps={searchProps}
        sortOptions={sortOptions}
        renderCard={renderCard}
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
      />
    </>
  );
}
